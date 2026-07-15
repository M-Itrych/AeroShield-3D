use axum::extract::Path;
use axum::Json;
use axum::{routing::get, Router};
use serde_json::{json, Value};

use crate::sse;

pub fn router() -> Router {
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

async fn list_flights() -> Json<Value> {
    Json(json!({ "flights": [] }))
}

async fn list_sigmets() -> Json<Value> {
    Json(json!({ "sigmets": [] }))
}

async fn get_airport(Path(icao): Path<String>) -> Json<Value> {
    Json(json!({ "icao": icao }))
}
