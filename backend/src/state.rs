use crate::airports::AirportIndex;
use crate::aviationweather::AviationWeatherClient;
use crate::models::{FlightVector, HazardPolygon, RiskAssessment};
use crate::opensky::OpenSkyClient;
use crate::risk;
use std::sync::Arc;
use tokio::sync::RwLock;

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
            }),
        }
    }

    pub async fn flights(&self) -> Vec<FlightVector> {
        self.inner.flights.read().await.clone()
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
                *self.inner.flights.write().await = flights;
            }
            Err(e) => {
                tracing::error!("failed to refresh flights: {e}");
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
