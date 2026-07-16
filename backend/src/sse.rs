use crate::state::AppState;
use axum::extract::State;
use axum::response::sse::{Event, KeepAlive, Sse};
use futures_util::stream::{self, StreamExt};
use std::convert::Infallible;
use std::time::Duration;

struct SubscriberGuard {
    state: AppState,
}

impl Drop for SubscriberGuard {
    fn drop(&mut self) {
        self.state.sse_unsubscribe();
    }
}

pub async fn risk_stream(
    State(state): State<AppState>,
) -> Sse<impl futures_util::Stream<Item = Result<Event, Infallible>>> {
    state.sse_subscribe();
    let guard = SubscriberGuard {
        state: state.clone(),
    };

    let stream = stream::unfold(state, move |state| async move {
        tokio::time::sleep(Duration::from_secs(5)).await;
        let risks = state.risk_assessments().await;

        let events: Vec<Result<Event, Infallible>> = risks
            .iter()
            .map(|r| {
                let data = serde_json::json!({
                    "flight": r.flight,
                    "callsign": r.callsign,
                    "lat": r.lat,
                    "lon": r.lon,
                    "alt_ft": r.alt_ft,
                    "risk": r.risk,
                    "sigmet_id": r.sigmet_id,
                    "minutes_to_impact": r.minutes_to_impact,
                });
                Ok(Event::default().event("risk").data(data.to_string()))
            })
            .collect();

        Some((stream::iter(events), state))
    })
    .flat_map(|events| events)
    .chain(stream::once(async move {
        drop(guard);
        Ok::<Event, Infallible>(Event::default())
    }));

    Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("ping"),
    )
}
