import { useQuery } from "@tanstack/react-query";
import type { MetarReport } from "@/types/domain";

export function useAirportMetar(icao: string | null) {
  return useQuery<MetarReport>({
    queryKey: ["airport-metar", icao],
    queryFn: async () => {
      if (!icao) throw new Error("no icao");
      const res = await fetch(`/api/airports/${icao}/metar`);
      if (!res.ok) throw new Error(`metar: ${res.status}`);
      return res.json() as Promise<MetarReport>;
    },
    enabled: !!icao,
    refetchInterval: 5 * 60_000,
    staleTime: 3 * 60_000,
  });
}
