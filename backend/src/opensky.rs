use crate::models::FlightVector;
use moka::future::Cache;
use serde::Deserialize;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

const TOKEN_URL: &str =
    "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";
const TOKEN_REFRESH_MARGIN: Duration = Duration::from_secs(30);

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

impl Bbox {
    fn rounded_key(self) -> (i32, i32, i32, i32) {
        (
            self.lamin.floor() as i32,
            self.lamax.ceil() as i32,
            self.lomin.floor() as i32,
            self.lomax.ceil() as i32,
        )
    }
}

async fn backoff_sleep(attempt: u32) {
    let delay = Duration::from_millis(500 * 2u64.pow(attempt.min(4)));
    tokio::time::sleep(delay).await;
}

#[derive(Clone)]
struct TokenState {
    access_token: String,
    expires_at: Instant,
}

impl TokenState {
    fn is_valid(&self) -> bool {
        self.expires_at
            > Instant::now()
                .checked_add(TOKEN_REFRESH_MARGIN)
                .unwrap_or(Instant::now())
    }
}

pub struct OpenSkyClient {
    client: reqwest::Client,
    auth_client: reqwest::Client,
    base: String,
    client_id: Option<String>,
    client_secret: Option<String>,
    token: Arc<Mutex<Option<TokenState>>>,
    cache: Cache<(), Vec<FlightVector>>,
    bbox_cache: Cache<(i32, i32, i32, i32), Vec<FlightVector>>,
    route_cache: Cache<String, Option<crate::models::FlightRoute>>,
}

impl OpenSkyClient {
    pub fn new(base: &str, client_id: Option<String>, client_secret: Option<String>) -> Self {
        let cache = Cache::builder()
            .time_to_live(Duration::from_secs(60))
            .max_capacity(1)
            .build();
        let bbox_cache = Cache::builder()
            .time_to_live(Duration::from_secs(30))
            .max_capacity(64)
            .build();
        let route_cache = Cache::builder()
            .time_to_live(Duration::from_secs(300))
            .max_capacity(500)
            .build();
        Self {
            client: reqwest::Client::builder()
                .timeout(Duration::from_secs(15))
                .build()
                .unwrap(),
            auth_client: reqwest::Client::builder()
                .timeout(Duration::from_secs(15))
                .build()
                .unwrap(),
            base: base.to_string(),
            client_id,
            client_secret,
            token: Arc::new(Mutex::new(None)),
            cache,
            bbox_cache,
            route_cache,
        }
    }

    fn has_credentials(&self) -> bool {
        self.client_id
            .as_ref()
            .zip(self.client_secret.as_ref())
            .is_some()
    }

    async fn fetch_token(&self) -> anyhow::Result<String> {
        let client_id = self
            .client_id
            .clone()
            .ok_or_else(|| anyhow::anyhow!("opensky client_id not configured"))?;
        let client_secret = self
            .client_secret
            .clone()
            .ok_or_else(|| anyhow::anyhow!("opensky client_secret not configured"))?;

        let resp = self
            .auth_client
            .post(TOKEN_URL)
            .form(&[
                ("grant_type", "client_credentials"),
                ("client_id", client_id.as_str()),
                ("client_secret", client_secret.as_str()),
            ])
            .send()
            .await?;

        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            anyhow::bail!("opensky token error: {status} body: {body}");
        }

        let body: TokenResponse = resp.json().await?;
        let expires_in = body.expires_in.unwrap_or(1800);
        let token = TokenState {
            access_token: body.access_token,
            expires_at: Instant::now() + Duration::from_secs(expires_in),
        };
        let access = token.access_token.clone();
        *self.token.lock().await = Some(token);
        tracing::debug!("opensky token refreshed, expires in {expires_in}s");
        Ok(access)
    }

    async fn get_token(&self) -> anyhow::Result<String> {
        {
            let guard = self.token.lock().await;
            if let Some(t) = guard.as_ref() {
                if t.is_valid() {
                    return Ok(t.access_token.clone());
                }
            }
        }
        self.fetch_token().await
    }

    async fn invalidate_token(&self) {
        *self.token.lock().await = None;
    }

    async fn send_with_auth(
        &self,
        req: reqwest::RequestBuilder,
    ) -> anyhow::Result<reqwest::Response> {
        if !self.has_credentials() {
            return Ok(req.send().await?);
        }

        let token = self.get_token().await?;
        let resp = req
            .try_clone()
            .ok_or_else(|| anyhow::anyhow!("opensky request not cloneable for retry"))?
            .bearer_auth(&token)
            .send()
            .await?;

        if resp.status().as_u16() == 401 {
            tracing::warn!("opensky token rejected (401), refreshing");
            self.invalidate_token().await;
            let token = self.fetch_token().await?;
            return Ok(req
                .try_clone()
                .ok_or_else(|| anyhow::anyhow!("opensky request not cloneable for retry"))?
                .bearer_auth(token)
                .send()
                .await?);
        }

        Ok(resp)
    }

    pub async fn fetch_states(&self) -> anyhow::Result<Vec<FlightVector>> {
        if let Some(cached) = self.cache.get(&()).await {
            tracing::debug!("opensky cache hit");
            return Ok(cached);
        }

        let url = format!("{}/states/all", self.base);
        let mut last_err: Option<anyhow::Error> = None;

        for attempt in 0u32..3 {
            let req = self.client.get(&url);
            let resp = match self.send_with_auth(req).await {
                Ok(r) => r,
                Err(e) => {
                    last_err = Some(e);
                    backoff_sleep(attempt).await;
                    continue;
                }
            };

            let status = resp.status();
            if status.as_u16() == 429 {
                tracing::warn!("opensky rate limited, backing off (attempt {attempt})");
                backoff_sleep(attempt).await;
                continue;
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
            return Ok(flights);
        }

        Err(last_err.unwrap_or_else(|| anyhow::anyhow!("opensky exhausted retries")))
    }

    pub async fn fetch_states_bbox(&self, bbox: Bbox) -> anyhow::Result<Vec<FlightVector>> {
        let key = bbox.rounded_key();
        if let Some(cached) = self.bbox_cache.get(&key).await {
            tracing::debug!("opensky bbox cache hit");
            return Ok(cached);
        }

        let url = format!("{}/states/all", self.base);
        let req = self.client.get(&url).query(&[
            ("lamin", bbox.lamin.to_string()),
            ("lamax", bbox.lamax.to_string()),
            ("lomin", bbox.lomin.to_string()),
            ("lomax", bbox.lomax.to_string()),
        ]);

        let resp = self.send_with_auth(req).await?;
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

        self.bbox_cache.insert(key, flights.clone()).await;
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
        if let Some(cached) = self.route_cache.get(icao24).await {
            return Ok(cached);
        }

        let url = format!("{}/flights/aircraft", self.base);
        let req = self.client.get(&url).query(&[
            ("icao24", icao24),
            ("begin", &begin.to_string()),
            ("end", &end.to_string()),
        ]);

        let resp = self.send_with_auth(req).await?;
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

        let result = latest.map(|f| crate::models::FlightRoute {
            icao24: icao24.to_string(),
            callsign: f.callsign.filter(|c| !c.is_empty()),
            departure: f.est_departure_airport,
            arrival: f.est_arrival_airport,
            first_seen: f.first_seen,
            last_seen: f.last_seen,
            departure_airport: None,
            arrival_airport: None,
        });

        self.route_cache
            .insert(icao24.to_string(), result.clone())
            .await;
        Ok(result)
    }
}

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
    expires_in: Option<u64>,
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
