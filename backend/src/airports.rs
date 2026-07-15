use dashmap::DashMap;

pub struct AirportIndex {
    by_icao: DashMap<String, Airport>,
}

#[derive(Debug, Clone)]
pub struct Airport {
    pub icao: String,
    pub iata: Option<String>,
    pub name: String,
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
}

impl Default for AirportIndex {
    fn default() -> Self {
        Self::new()
    }
}

pub async fn load() -> anyhow::Result<AirportIndex> {
    Ok(AirportIndex::new())
}
