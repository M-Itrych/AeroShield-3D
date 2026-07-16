import { useQuery } from "@tanstack/react-query";

interface NominatimAddress {
  country?: string;
  country_code?: string;
  state?: string;
  city?: string;
}

interface NominatimResponse {
  address?: NominatimAddress;
}

export interface RegionInfo {
  country: string | null;
  state: string | null;
}

export function useFlightRegion(
  lat: number | null,
  lon: number | null,
  icao24: string | null,
) {
  return useQuery<RegionInfo>({
    queryKey: ["flight-region", icao24, lat, lon],
    queryFn: async () => {
      if (lat == null || lon == null) {
        return { country: null, state: null };
      }
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&zoom=5&addressdetails=1`;
      const res = await fetch(url, {
        headers: { "Accept-Language": "en" },
      });
      if (!res.ok) throw new Error(`region: ${res.status}`);
      const data = (await res.json()) as NominatimResponse;
      return {
        country: data.address?.country ?? null,
        state: data.address?.state ?? null,
      };
    },
    enabled: !!icao24 && lat != null && lon != null,
    staleTime: 300_000,
    retry: false,
  });
}
