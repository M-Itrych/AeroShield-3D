export type RiskLevel = "NONE" | "MEDIUM" | "HIGH";

export interface FlightVector {
  icao24: string;
  callsign: string | null;
  origin_country: string;
  longitude: number;
  latitude: number;
  baro_altitude: number | null;
  velocity: number | null;
  heading: number | null;
}

export interface HazardPolygon {
  sigmet_id: string;
  points: [number, number][];
  min_ft: number | null;
  max_ft: number | null;
  hazard_type: string;
}

export interface RiskAssessment {
  flight: string;
  callsign: string | null;
  lat: number;
  lon: number;
  alt_ft: number | null;
  risk: RiskLevel;
  sigmet_id: string | null;
}
