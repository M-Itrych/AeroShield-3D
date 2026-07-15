use axum::response::sse::{Event, Sse};
use futures_util::stream::{self, Stream};
use std::convert::Infallible;
use std::time::Duration;

pub async fn risk_stream() -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let stream = stream::pending();
    Sse::new(stream).keep_alive(
        axum::response::sse::KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("ping"),
    )
}
