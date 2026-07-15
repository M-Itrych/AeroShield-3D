use axum::{routing::get, Router};

mod airports;
mod aviationweather;
mod models;
mod opensky;
mod risk;
mod sse;

pub fn router() -> Router {
    Router::new()
        .route("/healthz", get(healthz))
        .route("/api/flights", get(routes_handlers::list_flights))
        .route("/api/sigmets", get(routes_handlers::list_sigmets))
        .route("/api/airports/:icao", get(routes_handlers::get_airport))
        .route("/api/sse/risk-stream", get(sse::risk_stream))
}

async fn healthz() -> &'static str {
    "ok"
}

mod routes_handlers {
    use axum::extract::Path;
    use axum::Json;
    use serde_json::{json, Value};

    pub async fn list_flights() -> Json<Value> {
        Json(json!({ "flights": [] }))
    }

    pub async fn list_sigmets() -> Json<Value> {
        Json(json!({ "sigmets": [] }))
    }

    pub async fn get_airport(Path(icao): Path<String>) -> Json<Value> {
        Json(json!({ "icao": icao }))
    }
}
