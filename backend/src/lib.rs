use axum::Router;

mod routes;

pub fn app() -> Router {
    routes::router()
}
