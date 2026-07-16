import { useQuery } from "@tanstack/react-query";
import type { FlightRoute } from "@/types/domain";

export function useFlightRoute(icao24: string | null) {
  return useQuery<FlightRoute>({
    queryKey: ["flight-route", icao24],
    queryFn: async () => {
      if (!icao24) throw new Error("no icao24");
      const res = await fetch(`/api/flights/${icao24}/route`);
      if (!res.ok) throw new Error(`route: ${res.status}`);
      return res.json() as Promise<FlightRoute>;
    },
    enabled: !!icao24,
    staleTime: 120_000,
  });
}
