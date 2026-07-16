import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { Viewer as CesiumViewer } from "cesium";
import { Plane, TriangleAlert, Crosshair, X, ChevronUp, ChevronDown } from "lucide-react";
import { CesiumGlobe } from "@/components/CesiumGlobe";
import { FlightLayer } from "@/components/FlightLayer";
import { HazardLayer } from "@/components/HazardLayer";
import { FlightTrailLayer } from "@/components/FlightTrailLayer";
import { RouteLineLayer } from "@/components/RouteLineLayer";
import { FlightPredictLayer } from "@/components/FlightPredictLayer";
import { RerouteLayer } from "@/components/RerouteLayer";
import { RadarSweepLayer } from "@/components/RadarSweepLayer";
import { OffscreenIndicator } from "@/components/OffscreenIndicator";
import { BootSequence } from "@/components/BootSequence";
import { useFlights } from "@/hooks/use-flights";
import { useSigmets } from "@/hooks/use-sigmets";
import { useAirports } from "@/hooks/use-airports";
import { useRiskStream } from "@/hooks/use-risk-stream";
import { useViewportBbox } from "@/hooks/use-viewport-bbox";
import { useFlightTrail } from "@/hooks/use-flight-trail";
import { useFlightRoute } from "@/hooks/use-flight-route";
import { useGlobeClick } from "@/hooks/use-globe-click";
import { useAutoRotate } from "@/hooks/use-auto-rotate";
import { focusFlight as focusFlightCam } from "@/hooks/use-follow-flight";
import { resetView, focusSigmet } from "@/lib/camera-utils";
import { computeRerouteOptions, type RerouteOption } from "@/lib/reroute-utils";
import { AirportsLayer } from "@/components/AirportsLayer";
import type { RiskAssessment, FlightVector, HazardPolygon, FlightRoute } from "@/types/domain";

export const Route = createFileRoute("/m")({
  component: MobileGlobePage,
});

type SheetTab = "tracks" | "hazards" | "detail";
type SheetHeight = "collapsed" | "half" | "full";

function MobileGlobePage() {
  const [viewer, setViewer] = useState<CesiumViewer | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SheetTab>("tracks");
  const [sheetHeight, setSheetHeight] = useState<SheetHeight>("half");
  const [autoRotate, setAutoRotate] = useState(false);
  const [bootElapsed, setBootElapsed] = useState(false);
  const [bootForceTimeout, setBootForceTimeout] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBootElapsed(true), 2200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setBootForceTimeout(true), 15000);
    return () => clearTimeout(t);
  }, []);

  const bbox = useViewportBbox(viewer);
  const flightsQuery = useFlights("ALL");
  const sigmetsQuery = useSigmets();
  const airportsQuery = useAirports();
  const { risks, connectionState } = useRiskStream();

  const sigmets = sigmetsQuery.data?.sigmets ?? [];
  const airports = airportsQuery.data ?? [];

  const allFlights = useMemo(() => flightsQuery.data?.flights ?? [], [flightsQuery.data]);

  const flightsLoaded = !flightsQuery.isLoading && allFlights.length > 0;
  const bootReady = (bootElapsed && !!viewer && flightsLoaded) || bootForceTimeout;

  const selectedFlight: FlightVector | null = useMemo(() => {
    if (!selectedId) return null;
    return allFlights.find((f) => f.icao24 === selectedId) ?? null;
  }, [allFlights, selectedId]);

  const trailQuery = useFlightTrail(selectedId);
  const routeQuery = useFlightRoute(selectedId);

  const selectedRisk = useMemo(
    () => risks.find((r) => r.flight === selectedId) ?? null,
    [risks, selectedId],
  );

  const highRiskCount = risks.filter((r) => r.risk === "HIGH").length;

  const handleSelect = useCallback(
    (icao24: string) => {
      setSelectedId(icao24);
      setActiveTab("detail");
      setSheetHeight("half");
      const flight = allFlights.find((f) => f.icao24 === icao24);
      if (flight && viewer) focusFlightCam(viewer, flight);
    },
    [allFlights, viewer],
  );

  const handleDeselect = useCallback(() => {
    setSelectedId(null);
    setActiveTab("tracks");
  }, []);

  useGlobeClick({
    viewer,
    onPickFlight: (icao24) => {
      setSelectedId(icao24);
      setActiveTab("detail");
    },
    onPickSigmet: (sigmetId) => {
      const sig = sigmets.find((s) => s.sigmet_id === sigmetId);
      if (sig) focusSigmet(viewer, sig);
    },
    onBackgroundClick: handleDeselect,
  });

  useAutoRotate({ viewer, enabled: autoRotate });

  const sortedFlights = useMemo(() => {
    const riskMap = new Map(risks.map((r) => [r.flight, r.risk]));
    return [...allFlights].sort((a, b) => {
      const ra = riskMap.get(a.icao24) ?? "NONE";
      const rb = riskMap.get(b.icao24) ?? "NONE";
      const order = { HIGH: 0, MEDIUM: 1, NONE: 2 } as const;
      if (ra !== rb) return order[ra as keyof typeof order] - order[rb as keyof typeof order];
      const ca = a.callsign?.trim() ?? a.icao24;
      const cb = b.callsign?.trim() ?? b.icao24;
      return ca.localeCompare(cb);
    }).slice(0, 100);
  }, [allFlights, risks]);

  return (
    <>
      <BootSequence
        ready={bootReady}
        flightCount={allFlights.length}
        sigmetCount={sigmets.length}
        airportCount={airports.length}
      />
      <MobileHudBar
        flightCount={allFlights.length}
        sigmetCount={sigmets.length}
        highRiskCount={highRiskCount}
        connectionState={connectionState}
      />

      <CesiumGlobe onReady={setViewer}>
        <FlightLayer
          flights={allFlights}
          risks={risks}
          viewer={viewer}
          viewportBbox={bbox}
          selectedId={selectedId}
        />
        <AirportsLayer airports={airports} viewer={viewer} />
        <HazardLayer
          sigmets={sigmets}
          selectedFlight={selectedFlight}
          viewportBbox={bbox}
        />
        {selectedId && (
          <FlightTrailLayer trail={trailQuery.data?.trail ?? []} icao24={selectedId} />
        )}
        {selectedFlight && <RadarSweepLayer flight={selectedFlight} />}
        <RouteLineLayer route={routeQuery.data ?? null} flight={selectedFlight} />
        {selectedFlight && (
          <FlightPredictLayer flight={selectedFlight} route={routeQuery.data ?? null} />
        )}
        {selectedFlight && selectedRisk?.risk === "HIGH" && (
          <RerouteLayer
            flight={selectedFlight}
            route={routeQuery.data ?? null}
            sigmets={sigmets}
            risk={selectedRisk ?? null}
          />
        )}
      </CesiumGlobe>

      <OffscreenIndicator
        viewer={viewer}
        flights={allFlights}
        risks={risks}
        selectedId={selectedId}
      />

      <MobileControlBar
        autoRotate={autoRotate}
        onToggleAutoRotate={() => setAutoRotate((v) => !v)}
        onResetView={() => {
          resetView(viewer);
          setSelectedId(null);
          setAutoRotate(false);
        }}
      />

      <MobileSheet
        tab={activeTab}
        onTabChange={setActiveTab}
        height={sheetHeight}
        onHeightChange={setSheetHeight}
        selectedFlight={selectedFlight}
        highRiskCount={highRiskCount}
      >
        {activeTab === "tracks" && (
          <MobileTracksList
            flights={sortedFlights}
            risks={risks}
            onSelect={handleSelect}
            selectedId={selectedId}
            isLoading={flightsQuery.isLoading}
          />
        )}
        {activeTab === "hazards" && (
          <MobileHazardsList
            sigmets={sigmets}
            onSelect={(sigmetId) => {
              const sig = sigmets.find((s) => s.sigmet_id === sigmetId);
              if (sig) focusSigmet(viewer, sig);
            }}
          />
        )}
        {activeTab === "detail" && (
          <MobileDetailView
            flight={selectedFlight}
            route={routeQuery.data ?? null}
            risk={selectedRisk}
            sigmets={sigmets}
            onClose={handleDeselect}
          />
        )}
      </MobileSheet>
    </>
  );
}

function MobileHudBar({
  flightCount,
  sigmetCount,
  highRiskCount,
  connectionState,
}: {
  flightCount: number;
  sigmetCount: number;
  highRiskCount: number;
  connectionState: "connecting" | "open" | "reconnecting" | "error";
}) {
  const [utc, setUtc] = useState("");
  useEffect(() => {
    const update = () => {
      const d = new Date();
      setUtc(
        `${String(d.getUTCHours()).padStart(2, "0")}:${String(
          d.getUTCMinutes(),
        ).padStart(2, "0")}Z`,
      );
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, []);

  const dotColor =
    connectionState === "open"
      ? "bg-hud-grid"
      : connectionState === "error"
        ? "bg-hud-warn"
        : "bg-hud-dim";

  return (
    <header className="absolute left-0 right-0 top-0 z-40 flex h-8 items-center justify-between border-b border-hud-grid/20 bg-hud-space/95 px-2 backdrop-blur-md">
      <div className="flex items-center gap-1">
        <span className={`size-1.5 rounded-full ${dotColor} ${connectionState !== "open" ? "animate-status-blink" : ""}`} />
        <span className="font-mono text-[10px] font-bold tracking-[0.14em] text-hud-grid">
          AEROSHIELD
        </span>
      </div>
      <div className="flex items-center gap-2 font-mono text-[9px] tabular-nums">
        <span className="text-hud-grid">{String(flightCount).padStart(3, "0")}</span>
        <span className="text-hud-dim">TRK</span>
        <span className="text-hud-warn">{String(sigmetCount).padStart(2, "0")}</span>
        <span className="text-hud-dim">HAZ</span>
        {highRiskCount > 0 && (
          <span className="animate-status-blink text-hud-warn">
            {highRiskCount}CRIT
          </span>
        )}
        <span className="text-hud-ink">{utc}</span>
      </div>
    </header>
  );
}

function MobileControlBar({
  autoRotate,
  onToggleAutoRotate,
  onResetView,
}: {
  autoRotate: boolean;
  onToggleAutoRotate: () => void;
  onResetView: () => void;
}) {
  return (
    <div className="absolute bottom-3 right-3 z-30 flex flex-col gap-1.5">
      <button
        onClick={onResetView}
        className="flex size-10 items-center justify-center border border-hud-grid/25 bg-hud-charcoal/95 backdrop-blur-md active:bg-hud-grid/15"
        aria-label="Reset view"
      >
        <span className="font-mono text-[9px] text-hud-grid">HOME</span>
      </button>
      <button
        onClick={onToggleAutoRotate}
        className={`flex size-10 items-center justify-center border backdrop-blur-md ${
          autoRotate
            ? "border-hud-grid bg-hud-grid/15"
            : "border-hud-grid/25 bg-hud-charcoal/95"
        }`}
        aria-label="Toggle rotate"
      >
        <span className={`font-mono text-[9px] ${autoRotate ? "text-hud-grid" : "text-hud-dim"}`}>ROT</span>
      </button>
    </div>
  );
}

const SHEET_HEIGHTS: Record<SheetHeight, string> = {
  collapsed: "h-12",
  half: "h-[45vh]",
  full: "h-[85vh]",
};

function MobileSheet({
  tab,
  onTabChange,
  height,
  onHeightChange,
  selectedFlight,
  highRiskCount,
  children,
}: {
  tab: SheetTab;
  onTabChange: (t: SheetTab) => void;
  height: SheetHeight;
  onHeightChange: (h: SheetHeight) => void;
  selectedFlight: FlightVector | null;
  highRiskCount: number;
  children: React.ReactNode;
}) {
  const cycleHeight = () => {
    const order: SheetHeight[] = ["collapsed", "half", "full"];
    const idx = order.indexOf(height);
    onHeightChange(order[(idx + 1) % order.length]);
  };

  const tabs: { id: SheetTab; label: string; Icon: typeof Plane; badge?: number }[] = [
    { id: "tracks", label: "TRACKS", Icon: Plane },
    { id: "hazards", label: "HAZARDS", Icon: TriangleAlert },
    { id: "detail", label: "DETAIL", Icon: Crosshair, badge: selectedFlight ? 1 : highRiskCount },
  ];

  return (
    <div
      className={`absolute bottom-0 left-0 right-0 z-30 flex flex-col border-t border-hud-grid/25 bg-hud-charcoal/98 backdrop-blur-md ${SHEET_HEIGHTS[height]}`}
    >
      <button
        onClick={cycleHeight}
        className="flex shrink-0 items-center justify-center gap-2 border-b border-hud-grid/15 py-1.5"
        aria-label="Toggle sheet height"
      >
        <span className="h-1 w-8 rounded-full bg-hud-grid/30" />
        {height === "collapsed" ? (
          <ChevronUp className="size-3.5 text-hud-dim" />
        ) : (
          <ChevronDown className="size-3.5 text-hud-dim" />
        )}
      </button>

      <div className="flex shrink-0 border-b border-hud-grid/15">
        {tabs.map(({ id, label, Icon, badge }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`relative flex flex-1 items-center justify-center gap-1 py-2 font-mono text-[9px] tracking-wider transition-colors ${
              tab === id
                ? id === "hazards"
                  ? "text-hud-warn"
                  : "text-hud-grid"
                : "text-hud-dim"
            }`}
          >
            <Icon className="size-3.5" />
            {label}
            {badge ? (
              <span className="absolute right-3 top-1 border border-hud-warn/50 px-1 font-mono text-[7px] text-hud-warn">
                {badge}
              </span>
            ) : null}
            {tab === id && (
              <span
                className={`absolute bottom-0 left-0 right-0 h-0.5 ${
                  id === "hazards" ? "bg-hud-warn" : "bg-hud-grid"
                }`}
              />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

function MobileTracksList({
  flights,
  risks,
  onSelect,
  selectedId,
  isLoading,
}: {
  flights: FlightVector[];
  risks: RiskAssessment[];
  onSelect: (icao24: string) => void;
  selectedId: string | null;
  isLoading: boolean;
}) {
  const riskMap = useMemo(() => new Map(risks.map((r) => [r.flight, r])), [risks]);
  const scrollRef = useRef<HTMLDivElement>(null);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center font-mono text-[10px] text-hud-dim">
        LOADING TRACKS...
      </div>
    );
  }

  if (flights.length === 0) {
    return (
      <div className="flex h-full items-center justify-center font-mono text-[10px] text-hud-dim">
        NO TRACK DATA
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto overscroll-contain">
      {flights.map((f) => {
        const risk = riskMap.get(f.icao24);
        const isHigh = risk?.risk === "HIGH";
        const isWarn = isHigh || risk?.risk === "MEDIUM";
        const isSelected = selectedId === f.icao24;
        const tti = risk?.minutes_to_impact;
        return (
          <button
            key={f.icao24}
            onClick={() => onSelect(f.icao24)}
            className={`flex w-full items-center justify-between border-b border-hud-grid/10 px-3 py-2.5 text-left active:bg-hud-grid/10 ${
              isHigh ? "bg-hud-warn/10" : isSelected ? "bg-hud-grid/15" : ""
            }`}
          >
            <div className="min-w-0 flex-1">
              <div
                className={`truncate font-mono text-[11px] font-medium ${
                  isHigh ? "text-hud-warn" : "text-hud-ink"
                }`}
              >
                {f.callsign?.trim() || f.icao24}
              </div>
              <div className="truncate font-mono text-[9px] text-hud-dim">
                {f.origin_country}
                {f.baro_altitude ? ` ${Math.round(f.baro_altitude * 3.28)}ft` : ""}
                {tti != null && tti > 0 ? ` T${Math.ceil(tti)}M` : ""}
              </div>
            </div>
            <span
              className={`shrink-0 border px-1.5 py-0.5 font-mono text-[8px] tracking-wider ${
                isHigh
                  ? "border-hud-warn text-hud-warn"
                  : isWarn
                    ? "border-hud-warn/50 text-hud-warn/80"
                    : "border-hud-grid/30 text-hud-grid/80"
              }`}
            >
              {risk?.risk ?? "NONE"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function MobileHazardsList({
  sigmets,
  onSelect,
}: {
  sigmets: HazardPolygon[];
  onSelect: (id: string) => void;
}) {
  if (sigmets.length === 0) {
    return (
      <div className="flex h-full items-center justify-center font-mono text-[10px] text-hud-dim">
        NO ACTIVE HAZARDS
      </div>
    );
  }
  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      {sigmets.map((sig) => (
        <button
          key={sig.sigmet_id}
          onClick={() => onSelect(sig.sigmet_id)}
          className="flex w-full flex-col gap-1 border-b border-hud-warn/10 px-3 py-2.5 text-left active:bg-hud-warn/10"
        >
          <div className="flex items-center justify-between">
            <span className="border border-hud-warn/60 px-1.5 py-0.5 font-mono text-[8px] tracking-wider text-hud-warn">
              {sig.hazard_type}
            </span>
            <span className="font-mono text-[8px] text-hud-dim">
              {sig.sigmet_id}
            </span>
          </div>
          <div className="font-mono text-[9px] text-hud-dim">
            {sig.min_ft ? `FL${Math.round(sig.min_ft / 100)}` : "SFC"}
            {" - "}
            {sig.max_ft ? `FL${Math.round(sig.max_ft / 100)}` : "UNL"}
            {"  "}
            {sig.points.length}pts
          </div>
        </button>
      ))}
    </div>
  );
}

function MobileDetailView({
  flight,
  route,
  risk,
  sigmets,
  onClose,
}: {
  flight: FlightVector | null;
  route: FlightRoute | null;
  risk: RiskAssessment | null;
  sigmets: HazardPolygon[];
  onClose: () => void;
}) {
  const navigate = useNavigate();
  if (!flight) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4">
        <Crosshair className="size-6 text-hud-dim" />
        <span className="font-mono text-[10px] text-hud-dim">
          SELECT A TRACK TO VIEW DETAILS
        </span>
        <button
          onClick={() => navigate({ to: "/" })}
          className="mt-2 border border-hud-grid/25 px-3 py-1 font-mono text-[9px] text-hud-grid"
        >
          DESKTOP VERSION
        </button>
      </div>
    );
  }

  const altFt = flight.baro_altitude ? Math.round(flight.baro_altitude * 3.28084) : null;
  const velocityKt = flight.velocity ? Math.round(flight.velocity * 1.94384) : null;
  const headingDeg = flight.heading != null ? Math.round(flight.heading) : null;
  const riskLevel = risk?.risk ?? "NONE";
  const isWarn = riskLevel === "HIGH" || riskLevel === "MEDIUM";
  const tti = risk?.minutes_to_impact;

  return (
    <div className="flex h-full flex-col overflow-y-auto overscroll-contain">
      <div className="flex items-center justify-between border-b border-hud-grid/15 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Crosshair className={`size-3.5 ${isWarn ? "text-hud-warn" : "text-hud-grid"}`} />
          <span className={`font-mono text-[12px] font-bold tracking-wider ${isWarn ? "text-hud-warn" : "text-hud-grid"}`}>
            {flight.callsign?.trim() || flight.icao24}
          </span>
        </div>
        <button onClick={onClose} aria-label="Close">
          <X className="size-4 text-hud-dim" />
        </button>
      </div>

      <DetailRow label="ICAO24" value={flight.icao24.toUpperCase()} />
      <DetailRow label="REGISTRY" value={flight.origin_country} />
      <DetailRow label="ALTITUDE" value={altFt != null ? `${altFt.toLocaleString()} ft` : "---"} />
      <DetailRow label="VELOCITY" value={velocityKt != null ? `${velocityKt} kt` : "---"} />
      <DetailRow label="HEADING" value={headingDeg != null ? `${headingDeg}°` : "---"} />
      <DetailRow
        label="STATUS"
        value={flight.on_ground ? "ON GROUND" : "AIRBORNE"}
      />

      {route && (route.departure || route.arrival) && (
        <div className="border-t border-hud-grid/15 px-3 py-2">
          <div className="mb-1 font-mono text-[8px] tracking-[0.16em] text-hud-dim">ROUTE</div>
          <div className="font-mono text-[11px] text-hud-ink">
            <span className="text-hud-grid">
              {route.departure_airport?.iata ?? route.departure ?? "---"}
            </span>
            {" -> "}
            <span className="text-hud-warn">
              {route.arrival_airport?.iata ?? route.arrival ?? "---"}
            </span>
          </div>
        </div>
      )}

      <div className="border-t border-hud-grid/15 px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[8px] tracking-[0.16em] text-hud-dim">RISK</span>
          <span
            className={`border px-2 py-0.5 font-mono text-[10px] font-bold ${
              riskLevel === "HIGH"
                ? "border-hud-warn text-hud-warn"
                : riskLevel === "MEDIUM"
                  ? "border-hud-warn/50 text-hud-warn/80"
                  : "border-hud-grid/30 text-hud-grid/80"
            }`}
          >
            {riskLevel}
          </span>
        </div>
        {tti != null && tti > 0 && (
          <div className="mt-1 font-mono text-[10px] text-hud-warn animate-status-blink">
            TIME TO IMPACT: {Math.ceil(tti)} MIN
          </div>
        )}
        {risk?.sigmet_id && (
          <div className="mt-1 font-mono text-[9px] text-hud-warn/80">
            SIGMET: {risk.sigmet_id}
          </div>
        )}
      </div>

      {riskLevel === "HIGH" && (
        <MobileRerouteOptions
          flight={flight}
          route={route}
          sigmets={sigmets}
          risk={risk}
        />
      )}

      <button
        onClick={() => navigate({ to: "/flight/$id", params: { id: flight.icao24 } })}
        className="m-3 border border-hud-grid/25 py-2 font-mono text-[9px] text-hud-grid active:bg-hud-grid/10"
      >
        FULL DETAIL PAGE
      </button>
    </div>
  );
}

function MobileRerouteOptions({
  flight,
  route,
  sigmets,
  risk,
}: {
  flight: FlightVector;
  route: FlightRoute | null;
  sigmets: HazardPolygon[];
  risk: RiskAssessment | null;
}) {
  const options = useMemo(() => {
    if (!risk || risk.risk !== "HIGH" || !risk.sigmet_id) return [];
    return computeRerouteOptions(flight, route, sigmets, risk.sigmet_id);
  }, [flight, route, sigmets, risk]);

  if (options.length === 0) return null;

  return (
    <div className="border-t border-hud-grid/15 px-3 py-2">
      <div className="mb-1.5 font-mono text-[8px] font-bold tracking-[0.16em] text-hud-grid">
        REROUTE ADVISOR
      </div>
      {options.map((opt: RerouteOption) => (
        <div
          key={opt.id}
          className="mb-1 flex items-center justify-between border border-hud-grid/15 bg-hud-grid/5 px-2 py-1.5"
        >
          <span className="font-mono text-[10px] text-hud-grid">
            {opt.side} {opt.offset_nm}NM
          </span>
          <span className="font-mono text-[10px] text-hud-ink">+{Math.round(opt.extra_km)}km</span>
          <span className="font-mono text-[10px] text-hud-warn">+{Math.ceil(opt.extra_min)}min</span>
        </div>
      ))}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-hud-grid/8 px-3 py-1.5">
      <span className="font-mono text-[8px] tracking-[0.14em] text-hud-dim">{label}</span>
      <span className="font-mono text-[11px] font-medium text-hud-ink">{value}</span>
    </div>
  );
}
