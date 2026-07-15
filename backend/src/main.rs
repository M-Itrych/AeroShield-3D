use aeroshield_backend::app;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let app = app();
    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await?;
    tracing::info!("AeroShield backend listening on :8080");
    axum::serve(listener, app).await?;
    Ok(())
}
