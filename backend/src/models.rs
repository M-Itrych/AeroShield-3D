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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskAssessment {
    pub flight: String,
    pub callsign: Option<String>,
    pub lat: f64,
    pub lon: f64,
    pub alt_ft: Option<f64>,
    pub risk: RiskLevel,
    pub sigmet_id: Option<String>,
}
