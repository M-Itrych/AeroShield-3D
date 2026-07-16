import { useQuery } from "@tanstack/react-query";
import type { TrailPoint } from "@/types/domain";

export interface FlightTrailResponse {
  icao24: string;
  trail: TrailPoint[];
}

export function useFlightTrail(icao24: string | null) {
  return useQuery<FlightTrailResponse>({
    queryKey: ["flight-trail", icao24],
    queryFn: async () => {
      if (!icao24) throw new Error("no icao24");
      const res = await fetch(`/api/flights/${icao24}/trail`);
      if (!res.ok) throw new Error(`trail: ${res.status}`);
      return res.json() as Promise<FlightTrailResponse>;
    },
    enabled: !!icao24,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}
