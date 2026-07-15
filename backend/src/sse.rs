use axum::response::sse::Sse;

pub async fn risk_stream() -> Sse<std::convert::Infallible> {
    todo!("SSE: event: risk with JSON payload per AGENTS.md §9")
}
