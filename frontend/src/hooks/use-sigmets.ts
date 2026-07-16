import { useQuery } from "@tanstack/react-query";
import type { HazardPolygon } from "@/types/domain";

export interface SigmetsResponse {
  sigmets: HazardPolygon[];
}

export function useSigmets() {
  return useQuery<SigmetsResponse>({
    queryKey: ["sigmets"],
    queryFn: async () => {
      const res = await fetch("/api/sigmets");
      if (!res.ok) throw new Error(`sigmets: ${res.status}`);
      return res.json() as Promise<SigmetsResponse>;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
