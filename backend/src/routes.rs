use axum::extract::{Path, Query, State};
use axum::routing::get;
use axum::Json;
use axum::Router;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::opensky::Bbox;
use crate::sse;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/healthz", get(healthz))
        .route("/api/flights", get(list_flights))
        .route("/api/flights/:icao24", get(get_flight))
        .route("/api/flights/:icao24/trail", get(get_flight_trail))
        .route("/api/flights/:icao24/route", get(get_flight_route))
        .route("/api/sigmets", get(list_sigmets))
        .route("/api/airports/:icao", get(get_airport))
        .route("/api/airports/:icao/metar", get(get_airport_metar))
        .route("/api/sse/risk-stream", get(sse::risk_stream))
}

async fn healthz() -> &'static str {
    "ok"
}

#[derive(Deserialize)]
struct FlightsQuery {
    risk: Option<String>,
    lamin: Option<f64>,
    lamax: Option<f64>,
    lomin: Option<f64>,
    lomax: Option<f64>,
}

async fn list_flights(State(state): State<AppState>, Query(q): Query<FlightsQuery>) -> Json<Value> {
    let bbox = match (q.lamin, q.lamax, q.lomin, q.lomax) {
        (Some(lamin), Some(lamax), Some(lomin), Some(lomax)) => {
            if lamax < lamin || lomax < lomin {
                return Json(json!({ "flights": [] }));
            }
            Some(Bbox {
                lamin,
                lamax,
                lomin,
                lomax,
            })
        }
        _ => None,
    };

    let flights = match bbox {
        Some(b) => state.flights_bbox(b).await,
        None => state.flights().await,
    };

    let risks = state.risk_assessments().await;
    let risk_map: std::collections::HashMap<String, &str> = risks
        .iter()
        .map(|r| (r.flight.clone(), r.risk.as_str()))
        .collect();

    let filtered: Vec<Value> = flights
        .iter()
        .filter(|f| {
            if let Some(ref wanted) = q.risk {
                risk_map.get(&f.icao24).copied() == Some(wanted.as_str())
            } else {
                true
            }
        })
        .map(|f| {
            let risk = risk_map.get(&f.icao24).unwrap_or(&"NONE");
            json!({
                "icao24": f.icao24,
                "callsign": f.callsign,
                "origin_country": f.origin_country,
                "longitude": f.longitude,
                "latitude": f.latitude,
                "baro_altitude": f.baro_altitude,
                "velocity": f.velocity,
                "heading": f.heading,
                "on_ground": f.on_ground,
                "risk": risk,
            })
        })
        .collect();

    Json(json!({ "flights": filtered }))
}

async fn list_sigmets(State(state): State<AppState>) -> Json<Value> {
    let sigmets = state.sigmets().await;
    Json(json!({ "sigmets": sigmets }))
}

async fn get_flight(State(state): State<AppState>, Path(icao): Path<String>) -> Json<Value> {
    match state.flight(&icao).await {
        Some(f) => {
            let risks = state.risk_assessments().await;
            let risk = risks
                .iter()
                .find(|r| r.flight == icao)
                .map(|r| r.risk.as_str())
                .unwrap_or("NONE");
            Json(json!({
                "icao24": f.icao24,
                "callsign": f.callsign,
                "origin_country": f.origin_country,
                "longitude": f.longitude,
                "latitude": f.latitude,
                "baro_altitude": f.baro_altitude,
                "velocity": f.velocity,
                "heading": f.heading,
                "on_ground": f.on_ground,
                "risk": risk,
            }))
        }
        None => Json(json!({ "icao24": icao, "error": "not found" })),
    }
}

async fn get_flight_trail(State(state): State<AppState>, Path(icao): Path<String>) -> Json<Value> {
    let trail = state.trail(&icao).await;
    Json(json!({ "icao24": icao, "trail": trail }))
}

async fn get_flight_route(State(state): State<AppState>, Path(icao): Path<String>) -> Json<Value> {
    match state.flight_route(&icao).await {
        Some(route) => Json(json!(route)),
        None => Json(json!({ "icao24": icao, "error": "route not found" })),
    }
}

async fn get_airport(State(state): State<AppState>, Path(icao): Path<String>) -> Json<Value> {
    match state.get_airport(&icao).await {
        Some(airport) => Json(json!(airport)),
        None => Json(json!({ "icao": icao, "error": "not found" })),
    }
}

async fn get_airport_metar(State(state): State<AppState>, Path(icao): Path<String>) -> Json<Value> {
    match state.metar(&icao).await {
        Some(metar) => Json(json!(metar)),
        None => Json(json!({ "icao": icao, "error": "metar not available" })),
    }
}
