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

    pub async fn fetch_states_or_cached(&self) -> Vec<FlightVector> {
        self.fetch_states().await.unwrap_or_default()
    }
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
