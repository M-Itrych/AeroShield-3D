use crate::models::{FlightVector, HazardPolygon, RiskAssessment, RiskLevel};

pub fn assess(flight: &FlightVector, _sigmets: &[HazardPolygon]) -> RiskAssessment {
    RiskAssessment {
        flight: flight.icao24.clone(),
        callsign: flight.callsign.clone(),
        lat: flight.latitude,
        lon: flight.longitude,
        alt_ft: flight.baro_altitude.map(|m| m * 3.28084),
        risk: RiskLevel::None,
        sigmet_id: None,
    }
}

pub fn assess_many(flights: &[FlightVector], sigmets: &[HazardPolygon]) -> Vec<RiskAssessment> {
    flights.iter().map(|f| assess(f, sigmets)).collect()
}
