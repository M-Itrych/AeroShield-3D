use crate::models::{FlightVector, HazardPolygon, RiskAssessment, RiskLevel};
use geo::{Contains, Point, Polygon};

pub fn assess(flight: &FlightVector, sigmets: &[HazardPolygon]) -> RiskAssessment {
    let point = Point::new(flight.longitude, flight.latitude);
    let alt_ft = flight.baro_altitude.map(|m| m * 3.28084);

    let mut best_risk = RiskLevel::None;
    let mut best_sigmet: Option<String> = None;

    for sig in sigmets {
        if sig.points.len() < 3 {
            continue;
        }

        let ring: Vec<Point> = sig
            .points
            .iter()
            .map(|(lon, lat)| Point::new(*lon, *lat))
            .collect();
        let poly = Polygon::new(ring.into(), vec![]);

        if poly.contains(&point) {
            let in_band = match (sig.min_ft, sig.max_ft, alt_ft) {
                (Some(min), Some(max), Some(alt)) => alt >= min && alt <= max,
                (None, Some(max), Some(alt)) => alt <= max,
                (Some(min), None, Some(alt)) => alt >= min,
                _ => true,
            };

            if in_band {
                best_risk = RiskLevel::High;
                best_sigmet = Some(sig.sigmet_id.clone());
            } else {
                if best_risk == RiskLevel::None {
                    best_risk = RiskLevel::Medium;
                    best_sigmet = Some(sig.sigmet_id.clone());
                }
            }
        }
    }

    RiskAssessment {
        flight: flight.icao24.clone(),
        callsign: flight.callsign.clone(),
        lat: flight.latitude,
        lon: flight.longitude,
        alt_ft,
        risk: best_risk,
        sigmet_id: best_sigmet,
    }
}

pub fn assess_many(flights: &[FlightVector], sigmets: &[HazardPolygon]) -> Vec<RiskAssessment> {
    flights.iter().map(|f| assess(f, sigmets)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_flight(lon: f64, lat: f64, alt_m: f64) -> FlightVector {
        FlightVector {
            icao24: "abc123".to_string(),
            callsign: Some("TEST".to_string()),
            origin_country: "US".to_string(),
            longitude: lon,
            latitude: lat,
            baro_altitude: Some(alt_m),
            velocity: Some(200.0),
            heading: Some(90.0),
            on_ground: false,
        }
    }

    fn make_sigmet(
        points: Vec<(f64, f64)>,
        min_ft: Option<f64>,
        max_ft: Option<f64>,
    ) -> HazardPolygon {
        HazardPolygon {
            sigmet_id: "SIG_TEST".to_string(),
            points,
            min_ft,
            max_ft,
            hazard_type: "CONVECTIVE".to_string(),
        }
    }

    #[test]
    fn test_inside_polygon_in_alt_band_is_high() {
        let flight = make_flight(-82.8, 28.0, 10000.0);
        let sig = make_sigmet(
            vec![
                (-83.0, 28.5),
                (-82.0, 28.5),
                (-82.0, 27.5),
                (-83.0, 27.5),
                (-83.0, 28.5),
            ],
            Some(0.0),
            Some(43000.0),
        );
        let result = assess(&flight, &[sig]);
        assert_eq!(result.risk, RiskLevel::High);
        assert_eq!(result.sigmet_id, Some("SIG_TEST".to_string()));
    }

    #[test]
    fn test_inside_polygon_outside_alt_band_is_medium() {
        let flight = make_flight(-82.8, 28.0, 50000.0);
        let sig = make_sigmet(
            vec![
                (-83.0, 28.5),
                (-82.0, 28.5),
                (-82.0, 27.5),
                (-83.0, 27.5),
                (-83.0, 28.5),
            ],
            Some(0.0),
            Some(43000.0),
        );
        let result = assess(&flight, &[sig]);
        assert_eq!(result.risk, RiskLevel::Medium);
    }

    #[test]
    fn test_outside_polygon_is_none() {
        let flight = make_flight(0.0, 0.0, 10000.0);
        let sig = make_sigmet(
            vec![
                (-83.0, 28.5),
                (-82.0, 28.5),
                (-82.0, 27.5),
                (-83.0, 27.5),
                (-83.0, 28.5),
            ],
            Some(0.0),
            Some(43000.0),
        );
        let result = assess(&flight, &[sig]);
        assert_eq!(result.risk, RiskLevel::None);
        assert!(result.sigmet_id.is_none());
    }

    #[test]
    fn test_no_sigmets_is_none() {
        let flight = make_flight(0.0, 0.0, 10000.0);
        let result = assess(&flight, &[]);
        assert_eq!(result.risk, RiskLevel::None);
    }

    #[test]
    fn test_assess_many() {
        let flights = vec![
            make_flight(-82.8, 28.0, 10000.0),
            make_flight(0.0, 0.0, 10000.0),
        ];
        let sig = make_sigmet(
            vec![
                (-83.0, 28.5),
                (-82.0, 28.5),
                (-82.0, 27.5),
                (-83.0, 27.5),
                (-83.0, 28.5),
            ],
            Some(0.0),
            Some(43000.0),
        );
        let results = assess_many(&flights, &[sig]);
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].risk, RiskLevel::High);
        assert_eq!(results[1].risk, RiskLevel::None);
    }
}
