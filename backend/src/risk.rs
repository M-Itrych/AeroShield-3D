use crate::models::{FlightVector, HazardPolygon, RiskAssessment, RiskLevel};
use geo::{Contains, Point, Polygon};

const EARTH_R_M: f64 = 6_371_000.0;
const MEDIUM_TTI_THRESHOLD_MIN: f64 = 10.0;
const MEDIUM_PROXIMITY_KM: f64 = 50.0;

pub fn assess(flight: &FlightVector, sigmets: &[HazardPolygon]) -> RiskAssessment {
    let point = Point::new(flight.longitude, flight.latitude);
    let alt_ft = flight.baro_altitude.map(|m| m * 3.28084);
    let velocity_ms = flight.velocity.unwrap_or(0.0);

    let mut best_risk = RiskLevel::None;
    let mut best_sigmet: Option<String> = None;
    let mut best_tti: Option<f64> = None;

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
                best_tti = Some(0.0);
            } else if best_risk == RiskLevel::None {
                best_risk = RiskLevel::Medium;
                best_sigmet = Some(sig.sigmet_id.clone());
                best_tti = Some(0.0);
            }
            continue;
        }

        if velocity_ms <= 1.0 {
            continue;
        }

        let dist_km = min_distance_to_polygon_km(flight, &poly);
        let projected_entry_min = projected_entry_time_min(flight, sig, &poly);

        let qualifies_medium = match projected_entry_min {
            Some(tti) if tti <= MEDIUM_TTI_THRESHOLD_MIN => true,
            _ => dist_km.map(|d| d <= MEDIUM_PROXIMITY_KM).unwrap_or(false),
        };

        if qualifies_medium {
            let tti =
                projected_entry_min.or_else(|| dist_km.map(|d| d * 1000.0 / velocity_ms / 60.0));
            if best_risk != RiskLevel::High {
                best_risk = RiskLevel::Medium;
                best_sigmet = Some(sig.sigmet_id.clone());
                if let Some(t) = tti {
                    best_tti = Some(best_tti.map_or(t, |existing| existing.min(t)));
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
        minutes_to_impact: best_tti,
    }
}

fn min_distance_to_polygon_km(flight: &FlightVector, poly: &Polygon<f64>) -> Option<f64> {
    let p = Point::new(flight.longitude, flight.latitude);
    let exterior = poly.exterior();
    let mut min_km = f64::MAX;
    for line in exterior.lines() {
        let d = geo::HaversineDistance::haversine_distance(&p, &line.start_point()).min(
            geo::HaversineDistance::haversine_distance(&p, &line.end_point()),
        );
        let nearest = nearest_point_on_segment(&p, &line.start_point(), &line.end_point());
        let d2 = geo::HaversineDistance::haversine_distance(&p, &nearest);
        min_km = min_km.min(d.min(d2) / 1000.0);
    }
    Some(min_km)
}

fn nearest_point_on_segment(p: &Point, a: &Point, b: &Point) -> Point {
    let ax = a.x();
    let ay = a.y();
    let bx = b.x();
    let by = b.y();
    let px = p.x();
    let py = p.y();

    let dx = bx - ax;
    let dy = by - ay;
    let len_sq = dx * dx + dy * dy;
    if len_sq < 1e-12 {
        return *a;
    }
    let t = (((px - ax) * dx + (py - ay) * dy) / len_sq).clamp(0.0, 1.0);
    Point::new(ax + t * dx, ay + t * dy)
}

fn projected_entry_time_min(
    flight: &FlightVector,
    _sig: &HazardPolygon,
    poly: &Polygon<f64>,
) -> Option<f64> {
    let velocity_ms = flight.velocity?;
    if velocity_ms <= 1.0 {
        return None;
    }
    let heading_rad = flight.heading?.to_radians();
    let dist_m = velocity_ms * (MEDIUM_TTI_THRESHOLD_MIN * 60.0) * 1.5;
    let cos_lat = flight.latitude.to_radians().cos().max(0.01);

    let step_count = 30usize;
    let prev = Point::new(flight.longitude, flight.latitude);
    let mut prev_point = prev;

    for i in 1..=step_count {
        let frac = i as f64 / step_count as f64;
        let d = dist_m * frac;
        let d_lat = (d * heading_rad.cos()) / EARTH_R_M;
        let d_lon = (d * heading_rad.sin()) / (EARTH_R_M * cos_lat);
        let lon = flight.longitude + d_lon.to_degrees();
        let lat = flight.latitude + d_lat.to_degrees();
        let cur = Point::new(lon, lat);

        if segment_crosses_boundary(&prev_point, &cur, poly) {
            return Some(d / velocity_ms / 60.0);
        }
        prev_point = cur;
    }
    None
}

fn segment_crosses_boundary(a: &Point, b: &Point, poly: &Polygon<f64>) -> bool {
    for line in poly.exterior().lines() {
        if segments_intersect(a, b, &line.start_point(), &line.end_point()) {
            return true;
        }
    }
    false
}

fn segments_intersect(p1: &Point, p2: &Point, p3: &Point, p4: &Point) -> bool {
    let d1 = cross(p3, p4, p1);
    let d2 = cross(p3, p4, p2);
    let d3 = cross(p1, p2, p3);
    let d4 = cross(p1, p2, p4);
    ((d1 > 0.0 && d2 < 0.0) || (d1 < 0.0 && d2 > 0.0))
        && ((d3 > 0.0 && d4 < 0.0) || (d3 < 0.0 && d4 > 0.0))
}

fn cross(o: &Point, a: &Point, b: &Point) -> f64 {
    (a.x() - o.x()) * (b.y() - o.y()) - (a.y() - o.y()) * (b.x() - o.x())
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
        assert_eq!(result.minutes_to_impact, Some(0.0));
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
    fn test_heading_into_polygon_is_medium_with_tti() {
        let mut flight = make_flight(-84.0, 28.0, 10000.0);
        flight.velocity = Some(250.0);
        flight.heading = Some(90.0);
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
        let ring: Vec<Point<f64>> = sig
            .points
            .iter()
            .map(|(lon, lat)| Point::new(*lon, *lat))
            .collect();
        let _poly = Polygon::new(ring.into(), vec![]);
        let result = assess(&flight, &[sig]);
        assert_eq!(result.risk, RiskLevel::Medium);
        assert!(result.minutes_to_impact.is_some_and(|t| t > 0.0));
    }

    #[test]
    fn test_heading_away_from_polygon_is_none() {
        let mut flight = make_flight(-84.0, 28.0, 10000.0);
        flight.velocity = Some(250.0);
        flight.heading = Some(270.0);
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
