use crate::models::HazardPolygon;

pub async fn fetch_sigmets() -> anyhow::Result<Vec<HazardPolygon>> {
    todo!("wire AviationWeather.gov SIGMET parser (AGENTS.md §6, §8)")
}
