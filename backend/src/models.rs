use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlightVector {
    pub icao24: String,
    pub callsign: Option<String>,
    pub origin_country: String,
    pub longitude: f64,
    pub latitude: f64,
    pub baro_altitude: Option<f64>,
    pub velocity: Option<f64>,
    pub heading: Option<f64>,
    pub on_ground: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HazardPolygon {
    pub sigmet_id: String,
    pub points: Vec<(f64, f64)>,
    pub min_ft: Option<f64>,
    pub max_ft: Option<f64>,
    pub hazard_type: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "UPPERCASE")]
pub enum RiskLevel {
    None,
    Medium,
    High,
}

impl RiskLevel {
    pub fn as_str(&self) -> &'static str {
        match self {
            RiskLevel::None => "NONE",
            RiskLevel::Medium => "MEDIUM",
            RiskLevel::High => "HIGH",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskAssessment {
    pub flight: String,
    pub callsign: Option<String>,
    pub lat: f64,
    pub lon: f64,
    pub alt_ft: Option<f64>,
    pub risk: RiskLevel,
    pub sigmet_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub minutes_to_impact: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Airport {
    pub icao: String,
    pub iata: Option<String>,
    pub name: String,
    pub country: String,
    pub latitude: f64,
    pub longitude: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlightRoute {
    pub icao24: String,
    pub callsign: Option<String>,
    pub departure: Option<String>,
    pub arrival: Option<String>,
    pub first_seen: Option<u64>,
    pub last_seen: Option<u64>,
    pub departure_airport: Option<Airport>,
    pub arrival_airport: Option<Airport>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetarReport {
    pub icao: String,
    pub raw_ob: Option<String>,
    pub temp_c: Option<f64>,
    pub dewpoint_c: Option<f64>,
    pub wind_dir: Option<i32>,
    pub wind_speed_kt: Option<i32>,
    pub visibility_sm: Option<f64>,
    pub flight_category: Option<String>,
    pub obs_time: Option<u64>,
}
