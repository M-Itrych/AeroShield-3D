import { useQuery } from "@tanstack/react-query";
import type { FlightVector } from "@/types/domain";

export interface FlightsResponse {
  flights: FlightVector[];
}

function buildUrl(risk?: string): string {
  const params = new URLSearchParams();
  if (risk && risk !== "ALL") params.set("risk", risk);
  const qs = params.toString();
  return qs ? `/api/flights?${qs}` : "/api/flights";
}

export function useFlights(risk: string = "ALL") {
  return useQuery<FlightsResponse>({
    queryKey: ["flights", risk],
    queryFn: async () => {
      const res = await fetch(buildUrl(risk));
      if (!res.ok) throw new Error(`flights: ${res.status}`);
      return res.json() as Promise<FlightsResponse>;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
