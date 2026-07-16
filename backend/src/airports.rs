use dashmap::DashMap;

use crate::models::Airport;

const AIRPORTS_JSON_URL: &str =
    "https://raw.githubusercontent.com/mwgg/Airports/master/airports.json";

pub struct AirportIndex {
    by_icao: DashMap<String, Airport>,
    by_iata: DashMap<String, String>,
}

impl AirportIndex {
    pub fn new() -> Self {
        Self {
            by_icao: DashMap::new(),
            by_iata: DashMap::new(),
        }
    }

    pub fn get(&self, icao: &str) -> Option<Airport> {
        if let Some(a) = self.by_icao.get(icao) {
            return Some(a.clone());
        }
        if let Some(real_icao) = self.by_iata.get(icao) {
            let key = real_icao.value().clone();
            return self.by_icao.get(&key).map(|e| e.clone());
        }
        None
    }

    pub fn insert(&self, airport: Airport) {
        if let Some(iata) = &airport.iata {
            self.by_iata.insert(iata.clone(), airport.icao.clone());
        }
        self.by_icao.insert(airport.icao.clone(), airport);
    }

    pub fn count(&self) -> usize {
        self.by_icao.len()
    }
}

impl Default for AirportIndex {
    fn default() -> Self {
        Self::new()
    }
}

pub async fn load() -> anyhow::Result<AirportIndex> {
    let index = AirportIndex::new();

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()?;

    let resp = client.get(AIRPORTS_JSON_URL).send().await;
    let airports = match resp {
        Ok(r) if r.status().is_success() => {
            let json: serde_json::Value = r.json().await?;
            json.as_object()
                .map(|obj| obj.values().filter_map(parse_airport).collect::<Vec<_>>())
                .unwrap_or_default()
        }
        Ok(r) => {
            tracing::warn!("airports fetch failed: {}", r.status());
            Vec::new()
        }
        Err(e) => {
            tracing::warn!("airports fetch error: {e}");
            Vec::new()
        }
    };

    for airport in airports {
        index.insert(airport);
    }

    tracing::info!("airports index loaded: {} entries", index.count());
    Ok(index)
}

fn parse_airport(v: &serde_json::Value) -> Option<Airport> {
    let icao = v.get("icao")?.as_str()?.trim().to_string();
    if icao.is_empty() || icao == "N/A" {
        return None;
    }
    let iata = v
        .get("iata")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());
    let name = v.get("name")?.as_str()?.to_string();
    let country = v.get("country")?.as_str()?.to_string();
    let latitude = v.get("lat")?.as_f64()?;
    let longitude = v.get("lon")?.as_f64()?;

    Some(Airport {
        icao,
        iata,
        name,
        country,
        latitude,
        longitude,
    })
}
