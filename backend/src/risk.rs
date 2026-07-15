use crate::models::{FlightVector, HazardPolygon, RiskAssessment, RiskLevel};

pub fn assess(flight: &FlightVector, sigmets: &[HazardPolygon]) -> RiskAssessment {
    todo!("geo::contains polygon + altitude band -> HIGH (AGENTS.md §8)")
}
