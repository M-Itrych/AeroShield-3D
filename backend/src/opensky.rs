use crate::models::FlightVector;

pub async fn fetch_states() -> anyhow::Result<Vec<FlightVector>> {
    todo!("wire OpenSky /states/all with moka cache (AGENTS.md §6)")
}
