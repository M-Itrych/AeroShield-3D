# ADR-001: SSE over WebSocket for risk streaming

**Date**: 2026-07-16
**Status**: Accepted

## Context

The backend needs to push real-time risk assessment updates to the frontend.
The data flow is strictly unidirectional — the server pushes, the client
receives. There are no client-to-server messages in the risk stream.

Options considered:
1. **WebSocket** — bidirectional, persistent connection
2. **Server-Sent Events (SSE)** — unidirectional, HTTP-based
3. **Long polling** — client polls REST endpoint on an interval

## Decision

Use **Server-Sent Events**.

## Rationale

- **Unidirectional**: Risk updates are server-to-client only. WebSocket's
  bidirectional capability is unnecessary overhead.
- **Built-in reconnection**: `EventSource` auto-reconnects (though we add
  manual backoff for non-200 cases).
- **Axum support**: Axum has first-class SSE support via `Sse<Stream>`,
  simpler than WebSocket upgrade handling.
- **HTTP infrastructure**: SSE works through proxies, load balancers, and
  CDNs without special configuration.
- **Simpler protocol**: SSE is just `text/event-stream` with `event:` and
  `data:` lines. No framing, no heartbeat protocol to design.

## Consequences

- Cannot send client-to-server messages over the same connection (not needed).
- Manual backoff wrapper required for non-200 reconnection (EventSource only
  retries on network errors, not HTTP errors).
- Maximum 6 SSE connections per browser domain (HTTP/1.1 limit); mitigated by
  HTTP/2 multiplexing in production.
