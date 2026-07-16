use dashmap::DashMap;

use crate::models::Airport;

pub struct AirportIndex {
    by_icao: DashMap<String, Airport>,
}

impl AirportIndex {
    pub fn new() -> Self {
        Self {
            by_icao: DashMap::new(),
        }
    }

    pub fn get(&self, icao: &str) -> Option<Airport> {
        self.by_icao.get(icao).map(|e| e.clone())
    }

    pub fn insert(&self, airport: Airport) {
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
    tracing::info!("airports index loaded (empty - stage 4 will add full DB)");
    Ok(index)
}
