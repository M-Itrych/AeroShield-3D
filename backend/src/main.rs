use aeroshield_backend::airports;
use aeroshield_backend::aviationweather::AviationWeatherClient;
use aeroshield_backend::opensky::OpenSkyClient;
use aeroshield_backend::routes;
use aeroshield_backend::state::AppState;
use std::env;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "aeroshield_backend=info,tower_http=info".into()),
        )
        .init();

    let opensky_base =
        env::var("OPENSKY_BASE").unwrap_or_else(|_| "https://opensky-network.org/api".to_string());
    let opensky_user = env::var("OPENSKY_USER").ok().filter(|s| !s.is_empty());
    let opensky_pass = env::var("OPENSKY_PASS").ok().filter(|s| !s.is_empty());
    let aw_base = env::var("AVIATION_WEATHER_BASE")
        .unwrap_or_else(|_| "https://aviationweather.gov/api/data".to_string());

    let opensky = OpenSkyClient::new(&opensky_base, opensky_user, opensky_pass);
    let aviationweather = AviationWeatherClient::new(&aw_base);
    let airports = airports::load().await?;

    let state = AppState::new(opensky, aviationweather, airports);
    state.clone().start_background_tasks().await;

    let app = routes::router().with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await?;
    tracing::info!("AeroShield backend listening on :8080");
    axum::serve(listener, app).await?;
    Ok(())
}
