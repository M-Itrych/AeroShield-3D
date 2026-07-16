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
  on_ground: boolean;
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

export interface TrailPoint {
  lat: number;
  lon: number;
  alt_m: number | null;
  ts: number;
}

export interface FlightRoute {
  icao24: string;
  callsign: string | null;
  departure: string | null;
  arrival: string | null;
  first_seen: number | null;
  last_seen: number | null;
  departure_airport: Airport | null;
  arrival_airport: Airport | null;
}

export interface Airport {
  icao: string;
  iata: string | null;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
}

export interface MetarReport {
  icao: string;
  raw_ob: string | null;
  temp_c: number | null;
  dewpoint_c: number | null;
  wind_dir: number | null;
  wind_speed_kt: number | null;
  visibility_sm: number | null;
  flight_category: string | null;
  obs_time: number | null;
}
