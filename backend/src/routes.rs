use axum::extract::{Path, Query, State};
use axum::routing::get;
use axum::Json;
use axum::Router;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::sse;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/healthz", get(healthz))
        .route("/api/flights", get(list_flights))
        .route("/api/sigmets", get(list_sigmets))
        .route("/api/airports/:icao", get(get_airport))
        .route("/api/sse/risk-stream", get(sse::risk_stream))
}

async fn healthz() -> &'static str {
    "ok"
}

#[derive(Deserialize)]
struct FlightsQuery {
    risk: Option<String>,
}

async fn list_flights(State(state): State<AppState>, Query(q): Query<FlightsQuery>) -> Json<Value> {
    let flights = state.flights().await;
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

async fn get_airport(State(state): State<AppState>, Path(icao): Path<String>) -> Json<Value> {
    match state.get_airport(&icao).await {
        Some(airport) => Json(json!(airport)),
        None => Json(json!({ "icao": icao, "error": "not found" })),
    }
}
