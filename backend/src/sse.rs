use crate::state::AppState;
use axum::extract::State;
use axum::response::sse::{Event, KeepAlive, Sse};
use futures_util::stream::{self, StreamExt};
use std::collections::HashMap;
use std::convert::Infallible;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;

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

    let last_sent: Arc<Mutex<HashMap<String, crate::models::RiskAssessment>>> =
        Arc::new(Mutex::new(HashMap::new()));

    let stream = stream::unfold((state, last_sent), move |(state, last_sent)| async move {
        tokio::time::sleep(Duration::from_secs(5)).await;
        let risks = state.risk_assessments().await;

        let mut events: Vec<Result<Event, Infallible>> = Vec::new();
        {
            let mut last = last_sent.lock().await;
            for r in &risks {
                let changed = match last.get(&r.flight) {
                    Some(prev) => prev.risk != r.risk || prev.sigmet_id != r.sigmet_id,
                    None => true,
                };
                if changed {
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
                    events.push(Ok(Event::default().event("risk").data(data.to_string())));
                    last.insert(r.flight.clone(), r.clone());
                }
            }
        }

        Some((stream::iter(events), (state, last_sent)))
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
