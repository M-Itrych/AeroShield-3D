import { useQuery } from "@tanstack/react-query";
import type { Airport } from "@/types/domain";

export function useAirport(icao: string | null) {
  return useQuery<Airport>({
    queryKey: ["airport", icao],
    queryFn: async () => {
      if (!icao) throw new Error("no icao");
      const res = await fetch(`/api/airports/${icao}`);
      if (!res.ok) throw new Error(`airport: ${res.status}`);
      return res.json() as Promise<Airport>;
    },
    enabled: !!icao,
    staleTime: 5 * 60_000,
  });
}
