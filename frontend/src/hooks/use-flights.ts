import { useQuery } from "@tanstack/react-query";
import type { FlightVector } from "@/types/domain";

export interface FlightsResponse {
  flights: FlightVector[];
}

export function useFlights() {
  return useQuery<FlightsResponse>({
    queryKey: ["flights"],
    queryFn: async () => {
      const res = await fetch("/api/flights");
      if (!res.ok) throw new Error(`flights: ${res.status}`);
      return res.json() as Promise<FlightsResponse>;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
