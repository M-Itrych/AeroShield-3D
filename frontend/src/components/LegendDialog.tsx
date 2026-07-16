import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LegendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Term {
  term: string;
  desc: string;
}

const DATA_TERMS: Term[] = [
  { term: "TRACKS", desc: "Live aircraft currently being tracked on the globe. Each triangle points the way the plane is flying and is colored by altitude." },
  { term: "CALLSIGN", desc: "The flight identifier broadcast by the aircraft, e.g. THY23 = Turkish Airlines flight 23. Airline ICAO code + number." },
  { term: "ICAO24", desc: "A unique 6-character hex code permanently assigned to each aircraft transponder. Used to tell two identical flights apart." },
  { term: "ALTITUDE", desc: "Current height above sea level in feet (ft). Airliners cruise around 30,000 to 40,000 ft." },
  { term: "FL (Flight Level)", desc: "Altitude in hundreds of feet. FL350 = 35,000 ft. Pilots fly at standard FLs to keep vertical separation." },
  { term: "VELOCITY", desc: "Ground speed in knots (kt) and km/h. 1 kt = 1.852 km/h. A jet cruises near 450 to 500 kt." },
  { term: "HEADING", desc: "Compass direction the aircraft is pointed, in degrees. 0 = north, 90 = east, 180 = south, 270 = west." },
  { term: "POSITION", desc: "Latitude, longitude of the aircraft right now, in decimal degrees." },
  { term: "STATUS (AIRBORNE / ON GROUND)", desc: "Whether the aircraft is flying or parked on the ground." },
];

const HAZARD_TERMS: Term[] = [
  { term: "SIGMET", desc: "SIGnificant METeorological information. An official aviation warning of hazardous weather (storm, turbulence, icing, ash, etc.) in a defined area and altitude band." },
  { term: "TS (Thunderstorm)", desc: "Convective thunderstorm area with severe up/downdrafts. Avoid by at least 20 NM." },
  { term: "ICE (Icing)", desc: "Altitude band where airframe ice can build up, reducing lift." },
  { term: "TURB (Turbulence)", desc: "Air pockets that jolt the aircraft — light, moderate, or severe." },
  { term: "ASH (Volcanic Ash)", desc: "Volcanic ash cloud. Engine-flaming hazard; routes must avoid entirely." },
  { term: "ALT BAND (FL180 - FL340)", desc: "Vertical slice where the hazard exists. A flight is only at risk if it is inside the area AND inside this altitude band." },
  { term: "pts", desc: "Number of polygon points defining the hazard area outline." },
];

const RISK_TERMS: Term[] = [
  { term: "NONE", desc: "Aircraft is clear of all hazards — lime green marker." },
  { term: "MEDIUM", desc: "Aircraft is near a hazard (within ~50 km) and could reach it within ~5 minutes — orange marker." },
  { term: "HIGH", desc: "Aircraft is inside a SIGMET area AND inside its altitude band right now — bright orange marker, critical alert." },
  { term: "TIME TO IMPACT", desc: "Estimated minutes until the aircraft reaches the hazard area if its path and speed hold." },
  { term: "REROUTE ADVISOR", desc: "When a flight is HIGH risk, suggested lateral offsets (e.g. 25 NM left/right) that clear the hazard, with the added distance and time cost." },
];

const COLOR_TERMS: Term[] = [
  { term: "Lime (#39ff14)", desc: "Safe / nominal. Used for healthy tracks, standard routes, structural borders, and your selected flight." },
  { term: "Orange (#ff5f1f)", desc: "Hazard / risk. Used for SIGMETs, MEDIUM and HIGH-risk flights, and critical alerts." },
  { term: "Trail altitude color", desc: "Flight trail brightness shows altitude: dim below 10k ft, bright lime 10k to 25k, orange 25k to 40k, bright orange above 40k ft." },
  { term: "Dim gray (#5a6770)", desc: "Labels, metadata, and inactive elements." },
];

const PROFILE_TERMS: Term[] = [
  { term: "OBSERVED (solid line)", desc: "Past altitude the aircraft has actually flown, from recorded trail data." },
  { term: "PROJECTED (dashed line)", desc: "Predicted future altitude — cruise level then descent into the arrival airport." },
  { term: "NOW (vertical line)", desc: "The aircraft's current position along its route. Left of it is behind, right is ahead." },
  { term: "CUR FL", desc: "Current flight level the aircraft is at." },
  { term: "ETA", desc: "Estimated time to arrival based on current ground speed and distance to go." },
  { term: "VS (FPM)", desc: "Vertical speed in feet per minute — climbing (positive) or descending (negative)." },
  { term: "Hazard bands", desc: "Orange rectangles on the chart show where a SIGMET crosses the route and at which altitudes." },
];

function TermGroup({ title, terms }: { title: string; terms: Term[] }) {
  return (
    <section>
      <h3 className="mb-2 font-mono text-[12px] font-bold tracking-[0.16em] text-hud-grid">
        {title}
      </h3>
      <div className="flex flex-col gap-2">
        {terms.map((t) => (
          <div key={t.term} className="flex flex-col gap-0.5">
            <div className="font-mono text-[11px] font-bold tracking-wider text-hud-ink">
              {t.term}
            </div>
            <p className="font-mono text-[11px] leading-relaxed text-hud-dim">
              {t.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function LegendDialog({ open, onOpenChange }: LegendDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] gap-0 border-hud-border bg-hud-charcoal/98 p-0 backdrop-blur-md sm:max-w-lg">
        <DialogHeader className="border-b border-hud-border px-4 py-3">
          <DialogTitle className="font-mono text-[13px] font-bold tracking-[0.16em] text-hud-grid">
            FIELD GUIDE
          </DialogTitle>
          <DialogDescription className="font-mono text-[11px] tracking-wider text-hud-dim">
            What the telemetry, hazards, and colors mean.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh]">
          <div className="flex flex-col gap-5 px-4 py-4">
            <TermGroup title="TRACKS & TELEMETRY" terms={DATA_TERMS} />
            <TermGroup title="HAZARDS & WEATHER" terms={HAZARD_TERMS} />
            <TermGroup title="RISK LEVELS" terms={RISK_TERMS} />
            <TermGroup title="COLOR CODES" terms={COLOR_TERMS} />
            <TermGroup title="VERTICAL PROFILE" terms={PROFILE_TERMS} />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
