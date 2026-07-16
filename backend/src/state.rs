use crate::airports::AirportIndex;
use crate::aviationweather::AviationWeatherClient;
use crate::models::{FlightVector, HazardPolygon, RiskAssessment};
use crate::opensky::{Bbox, OpenSkyClient};
use crate::risk;
use dashmap::DashMap;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;

#[derive(Debug, Clone, serde::Serialize)]
pub struct TrailPoint {
    pub lat: f64,
    pub lon: f64,
    pub alt_m: Option<f64>,
    pub ts: u64,
}

const MAX_TRAIL_POINTS: usize = 60;

#[derive(Clone)]
pub struct AppState {
    inner: Arc<Inner>,
}

struct Inner {
    opensky: OpenSkyClient,
    aviationweather: AviationWeatherClient,
    airports: AirportIndex,
    flights: RwLock<Vec<FlightVector>>,
    sigmets: RwLock<Vec<HazardPolygon>>,
    trails: DashMap<String, Vec<TrailPoint>>,
}

impl AppState {
    pub fn new(
        opensky: OpenSkyClient,
        aviationweather: AviationWeatherClient,
        airports: AirportIndex,
    ) -> Self {
        Self {
            inner: Arc::new(Inner {
                opensky,
                aviationweather,
                airports,
                flights: RwLock::new(Vec::new()),
                sigmets: RwLock::new(Vec::new()),
                trails: DashMap::new(),
            }),
        }
    }

    pub async fn flights(&self) -> Vec<FlightVector> {
        self.inner.flights.read().await.clone()
    }

    pub async fn flights_bbox(&self, bbox: Bbox) -> Vec<FlightVector> {
        match self.inner.opensky.fetch_states_bbox(bbox).await {
            Ok(f) => {
                self.append_trails(&f);
                f
            }
            Err(e) => {
                tracing::error!("bbox fetch failed: {e}");
                Vec::new()
            }
        }
    }

    pub async fn sigmets(&self) -> Vec<HazardPolygon> {
        self.inner.sigmets.read().await.clone()
    }

    pub async fn get_airport(&self, icao: &str) -> Option<crate::models::Airport> {
        self.inner.airports.get(icao)
    }

    pub async fn refresh_flights(&self) {
        match self.inner.opensky.fetch_states().await {
            Ok(flights) => {
                self.append_trails(&flights);
                *self.inner.flights.write().await = flights;
            }
            Err(e) => {
                tracing::error!("failed to refresh flights: {e}");
            }
        }
    }

    fn append_trails(&self, flights: &[FlightVector]) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        for f in flights {
            let mut entry = self.inner.trails.entry(f.icao24.clone()).or_default();
            let trail = entry.value_mut();
            let is_new = trail.is_empty();
            let moved_enough = trail.last().is_some_and(|last| {
                (last.lat - f.latitude).abs() > 0.001 || (last.lon - f.longitude).abs() > 0.001
            });
            if is_new || moved_enough {
                trail.push(TrailPoint {
                    lat: f.latitude,
                    lon: f.longitude,
                    alt_m: f.baro_altitude,
                    ts: now,
                });
                if trail.len() > MAX_TRAIL_POINTS {
                    let drop_n = trail.len() - MAX_TRAIL_POINTS;
                    trail.drain(0..drop_n);
                }
            }
        }
    }

    pub async fn trail(&self, icao24: &str) -> Vec<TrailPoint> {
        self.inner
            .trails
            .get(icao24)
            .map(|e| e.clone())
            .unwrap_or_default()
    }

    pub async fn flight(&self, icao24: &str) -> Option<FlightVector> {
        let flights = self.inner.flights.read().await;
        flights.iter().find(|f| f.icao24 == icao24).cloned()
    }

    pub async fn flight_route(&self, icao24: &str) -> Option<crate::models::FlightRoute> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let begin = now.saturating_sub(48 * 3600);

        let route = self
            .inner
            .opensky
            .fetch_aircraft_route(icao24, begin, now)
            .await
            .ok()
            .flatten()?;

        let departure_airport = route
            .departure
            .as_deref()
            .and_then(|code| self.inner.airports.get(code));

        let arrival_airport = route
            .arrival
            .as_deref()
            .and_then(|code| self.inner.airports.get(code));

        Some(crate::models::FlightRoute {
            departure_airport,
            arrival_airport,
            icao24: route.icao24,
            callsign: route.callsign,
            departure: route.departure,
            arrival: route.arrival,
            first_seen: route.first_seen,
            last_seen: route.last_seen,
        })
    }

    pub async fn metar(&self, icao: &str) -> Option<crate::models::MetarReport> {
        match self.inner.aviationweather.fetch_metar(icao).await {
            Ok(m) => m,
            Err(e) => {
                tracing::error!("metar fetch failed: {e}");
                None
            }
        }
    }

    pub async fn refresh_sigmets(&self) {
        match self.inner.aviationweather.fetch_sigmets().await {
            Ok(sigmets) => {
                *self.inner.sigmets.write().await = sigmets;
            }
            Err(e) => {
                tracing::error!("failed to refresh sigmets: {e}");
            }
        }
    }

    pub async fn risk_assessments(&self) -> Vec<RiskAssessment> {
        let flights = self.inner.flights.read().await;
        let sigmets = self.inner.sigmets.read().await;
        risk::assess_many(&flights, &sigmets)
    }

    pub async fn start_background_tasks(self) {
        self.refresh_flights().await;
        self.refresh_sigmets().await;

        let state = self.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(60));
            loop {
                interval.tick().await;
                state.refresh_flights().await;
            }
        });

        let state = self.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(300));
            loop {
                interval.tick().await;
                state.refresh_sigmets().await;
            }
        });
    }
}
