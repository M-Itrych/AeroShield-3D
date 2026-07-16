import { useQuery } from "@tanstack/react-query";
import type { Airport } from "@/types/domain";
import airportsData from "@/data/airports.json";

export function useAirports() {
  return useQuery<Airport[]>({
    queryKey: ["airports"],
    queryFn: async () => {
      return airportsData as Airport[];
    },
    staleTime: Infinity,
  });
}
