use axum::Router;

pub mod airports;
pub mod aviationweather;
pub mod models;
pub mod opensky;
pub mod risk;
pub mod routes;
pub mod sse;

pub fn app() -> Router {
    routes::router()
}
