use crate::models::HazardPolygon;
use serde::Deserialize;
use std::time::Duration;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SigmetResponse {
    #[allow(dead_code)]
    icao_id: String,
    alpha_char: Option<String>,
    series_id: String,
    #[allow(dead_code)]
    air_sigmet_type: Option<String>,
    hazard: Option<String>,
    altitude_hi1: Option<f64>,
    altitude_low1: Option<f64>,
    coords: Option<Vec<Coord>>,
}

#[derive(Debug, Deserialize)]
struct Coord {
    lat: f64,
    lon: f64,
}

pub struct AviationWeatherClient {
    client: reqwest::Client,
    base: String,
}

impl AviationWeatherClient {
    pub fn new(base: &str) -> Self {
        Self {
            client: reqwest::Client::builder()
                .timeout(Duration::from_secs(15))
                .build()
                .unwrap(),
            base: base.to_string(),
        }
    }

    pub async fn fetch_sigmets(&self) -> anyhow::Result<Vec<HazardPolygon>> {
        let url = format!("{}/sigmet?format=json", self.base);
        let resp = self.client.get(&url).send().await?;
        let status = resp.status();
        if !status.is_success() {
            anyhow::bail!("aviationweather error: {status}");
        }

        let items: Vec<SigmetResponse> = resp.json().await?;
        let sigmets: Vec<HazardPolygon> = items.into_iter().filter_map(parse_sigmet).collect();
        tracing::info!("aviationweather fetched {} sigmets", sigmets.len());
        Ok(sigmets)
    }

    pub async fn fetch_sigmets_or_cached(&self) -> Vec<HazardPolygon> {
        self.fetch_sigmets().await.unwrap_or_default()
    }
}

fn parse_sigmet(s: SigmetResponse) -> Option<HazardPolygon> {
    let coords = s.coords?;
    if coords.is_empty() {
        return None;
    }

    let sigmet_id = match (&s.icao_id, &s.alpha_char, &s.series_id) {
        (icao, Some(alpha), series) => format!("{icao}-{alpha}-{series}"),
        (icao, None, series) => format!("{icao}-{series}"),
    };

    let points: Vec<(f64, f64)> = coords.into_iter().map(|c| (c.lon, c.lat)).collect();
    let hazard_type = s.hazard.unwrap_or_else(|| "UNKNOWN".to_string());

    Some(HazardPolygon {
        sigmet_id,
        points,
        min_ft: s.altitude_low1,
        max_ft: s.altitude_hi1,
        hazard_type,
    })
}
