use axum::Router;

pub mod airports;
pub mod aviationweather;
pub mod models;
pub mod opensky;
pub mod risk;
pub mod routes;
pub mod sse;
pub mod state;

pub fn app() -> Router<state::AppState> {
    routes::router()
}
