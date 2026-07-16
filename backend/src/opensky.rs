use crate::models::FlightVector;
use moka::future::Cache;
use serde::Deserialize;
use std::time::Duration;

#[derive(Debug, Deserialize)]
struct OpenSkyResponse {
    #[allow(dead_code)]
    time: u64,
    states: Option<Vec<Vec<serde_json::Value>>>,
}

#[derive(Debug, Clone, Copy)]
pub struct Bbox {
    pub lamin: f64,
    pub lamax: f64,
    pub lomin: f64,
    pub lomax: f64,
}

pub struct OpenSkyClient {
    client: reqwest::Client,
    base: String,
    auth: Option<(String, String)>,
    cache: Cache<(), Vec<FlightVector>>,
}

impl OpenSkyClient {
    pub fn new(base: &str, user: Option<String>, pass: Option<String>) -> Self {
        let auth = match (user, pass) {
            (Some(u), Some(p)) if !u.is_empty() => Some((u, p)),
            _ => None,
        };
        let cache = Cache::builder()
            .time_to_live(Duration::from_secs(60))
            .max_capacity(1)
            .build();
        Self {
            client: reqwest::Client::builder()
                .timeout(Duration::from_secs(15))
                .build()
                .unwrap(),
            base: base.to_string(),
            auth,
            cache,
        }
    }

    pub async fn fetch_states(&self) -> anyhow::Result<Vec<FlightVector>> {
        if let Some(cached) = self.cache.get(&()).await {
            tracing::debug!("opensky cache hit");
            return Ok(cached);
        }

        let url = format!("{}/states/all", self.base);
        let mut req = self.client.get(&url);
        if let Some((user, pass)) = &self.auth {
            req = req.basic_auth(user, Some(pass));
        }

        let resp = req.send().await?;
        let status = resp.status();
        if status.as_u16() == 429 {
            tracing::warn!("opensky rate limited");
            return Ok(Vec::new());
        }
        if !status.is_success() {
            anyhow::bail!("opensky error: {status}");
        }

        let body: OpenSkyResponse = resp.json().await?;
        let flights: Vec<FlightVector> = body
            .states
            .unwrap_or_default()
            .into_iter()
            .filter_map(parse_state)
            .collect();

        self.cache.insert((), flights.clone()).await;
        tracing::info!("opensky fetched {} flights", flights.len());
        Ok(flights)
    }

    pub async fn fetch_states_bbox(&self, bbox: Bbox) -> anyhow::Result<Vec<FlightVector>> {
        let url = format!("{}/states/all", self.base);
        let mut req = self.client.get(&url).query(&[
            ("lamin", bbox.lamin.to_string()),
            ("lamax", bbox.lamax.to_string()),
            ("lomin", bbox.lomin.to_string()),
            ("lomax", bbox.lomax.to_string()),
        ]);
        if let Some((user, pass)) = &self.auth {
            req = req.basic_auth(user, Some(pass));
        }

        let resp = req.send().await?;
        let status = resp.status();
        if status.as_u16() == 429 {
            tracing::warn!("opensky rate limited (bbox)");
            return Ok(Vec::new());
        }
        if !status.is_success() {
            anyhow::bail!("opensky bbox error: {status}");
        }

        let body: OpenSkyResponse = resp.json().await?;
        let flights: Vec<FlightVector> = body
            .states
            .unwrap_or_default()
            .into_iter()
            .filter_map(parse_state)
            .collect();

        tracing::info!("opensky bbox fetched {} flights", flights.len());
        Ok(flights)
    }

    pub async fn fetch_states_or_cached(&self) -> Vec<FlightVector> {
        self.fetch_states().await.unwrap_or_default()
    }

    pub async fn fetch_aircraft_route(
        &self,
        icao24: &str,
        begin: u64,
        end: u64,
    ) -> anyhow::Result<Option<crate::models::FlightRoute>> {
        let url = format!("{}/flights/aircraft", self.base);
        let mut req = self.client.get(&url).query(&[
            ("icao24", icao24),
            ("begin", &begin.to_string()),
            ("end", &end.to_string()),
        ]);
        if let Some((user, pass)) = &self.auth {
            req = req.basic_auth(user, Some(pass));
        }

        let resp = req.send().await?;
        let status = resp.status();
        if status.as_u16() == 429 {
            tracing::warn!("opensky rate limited (aircraft route)");
            return Ok(None);
        }
        if !status.is_success() {
            anyhow::bail!("opensky aircraft route error: {status}");
        }

        let flights: Vec<AircraftFlight> = resp.json().await?;
        let latest = flights.into_iter().max_by_key(|f| f.last_seen.unwrap_or(0));

        Ok(latest.map(|f| crate::models::FlightRoute {
            icao24: icao24.to_string(),
            callsign: f.callsign.filter(|c| !c.is_empty()),
            departure: f.est_departure_airport,
            arrival: f.est_arrival_airport,
            first_seen: f.first_seen,
            last_seen: f.last_seen,
            departure_airport: None,
            arrival_airport: None,
        }))
    }
}

#[derive(Debug, Deserialize)]
struct AircraftFlight {
    first_seen: Option<u64>,
    last_seen: Option<u64>,
    callsign: Option<String>,
    est_departure_airport: Option<String>,
    est_arrival_airport: Option<String>,
}

fn parse_state(s: Vec<serde_json::Value>) -> Option<FlightVector> {
    let get_str = |i: usize| -> Option<String> {
        s.get(i)
            .and_then(|v| v.as_str())
            .map(|x| x.trim().to_string())
    };
    let get_f64 = |i: usize| -> Option<f64> { s.get(i).and_then(|v| v.as_f64()) };

    let icao24 = get_str(0)?;
    let callsign = get_str(1).filter(|c| !c.is_empty());
    let origin_country = get_str(2)?;
    let longitude = get_f64(5)?;
    let latitude = get_f64(6)?;
    let baro_altitude = get_f64(7);
    let on_ground = s.get(8).and_then(|v| v.as_bool()).unwrap_or(false);
    let velocity = get_f64(9);
    let heading = get_f64(10);

    Some(FlightVector {
        icao24,
        callsign,
        origin_country,
        longitude,
        latitude,
        baro_altitude,
        velocity,
        heading,
        on_ground,
    })
}
