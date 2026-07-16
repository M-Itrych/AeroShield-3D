import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RiskAssessment } from "@/types/domain";

const RISK_QUERY_KEY = ["risk-flights"] as const;
const SSE_URL = "/api/sse/risk-stream";
const INITIAL_RETRY_MS = 3_000;
const MAX_RETRY_MS = 30_000;

export type RiskConnectionState = "connecting" | "open" | "reconnecting" | "error";

export interface RiskStreamResult {
  risks: RiskAssessment[];
  connectionState: RiskConnectionState;
  lastUpdated: number | null;
}

interface RiskStreamOptions {
  enabled?: boolean;
}

export function useRiskStream(options: RiskStreamOptions = {}): RiskStreamResult {
  const { enabled = true } = options;
  const queryClient = useQueryClient();
  const [risks, setRisks] = useState<RiskAssessment[]>([]);
  const [connectionState, setConnectionState] =
    useState<RiskConnectionState>("connecting");
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const risksRef = useRef<Map<string, RiskAssessment>>(new Map());
  const retryDelayRef = useRef<number>(INITIAL_RETRY_MS);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const closedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    closedRef.current = false;

    const connect = () => {
      if (closedRef.current) return;

      setConnectionState((prev) =>
        prev === "connecting" ? "connecting" : "reconnecting",
      );

      const es = new EventSource(SSE_URL);
      eventSourceRef.current = es;

      es.onopen = () => {
        if (closedRef.current) return;
        retryDelayRef.current = INITIAL_RETRY_MS;
        setConnectionState("open");
      };

      es.addEventListener("risk", (event) => {
        if (closedRef.current) return;
        try {
          const data = JSON.parse(
            (event as MessageEvent).data,
          ) as RiskAssessment;
          if (!data.flight) return;
          risksRef.current.set(data.flight, data);
          const next = Array.from(risksRef.current.values());
          setRisks(next);
          setLastUpdated(Date.now());
          queryClient.setQueryData<RiskAssessment[]>(RISK_QUERY_KEY, next);
        } catch {
          // ignore malformed payloads
        }
      });

      es.onerror = () => {
        if (closedRef.current) return;
        es.close();
        setConnectionState("error");

        const delay = retryDelayRef.current;
        retryDelayRef.current = Math.min(delay * 2, MAX_RETRY_MS);

        retryTimerRef.current = setTimeout(() => {
          if (!closedRef.current) connect();
        }, delay);
      };
    };

    connect();

    return () => {
      closedRef.current = true;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [enabled, queryClient]);

  return { risks, connectionState, lastUpdated };
}

export { RISK_QUERY_KEY };
