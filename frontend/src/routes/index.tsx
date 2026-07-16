import { useMemo, useState, useCallback, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { Viewer as CesiumViewer } from "cesium";
import { CesiumGlobe } from "@/components/CesiumGlobe";
import { FlightLayer } from "@/components/FlightLayer";
import { HazardLayer } from "@/components/HazardLayer";
import { FlightTrailLayer } from "@/components/FlightTrailLayer";
import { RouteLineLayer } from "@/components/RouteLineLayer";
import { FlightPredictLayer } from "@/components/FlightPredictLayer";
import { AirportsLayer } from "@/components/AirportsLayer";
import { FlightDetailPanel } from "@/components/FlightDetailPanel";
import { GlobeControlBar, type LayerVisibility } from "@/components/GlobeControlBar";
import { HudBar } from "@/components/HudBar";
import { FlightsPanel } from "@/components/FlightsPanel";
import { HazardPanel } from "@/components/HazardPanel";
import { useFlights } from "@/hooks/use-flights";
import { useSigmets } from "@/hooks/use-sigmets";
import { useAirports } from "@/hooks/use-airports";
import { useViewportBbox } from "@/hooks/use-viewport-bbox";
import { useFlightTrail } from "@/hooks/use-flight-trail";
import { useFlightRoute } from "@/hooks/use-flight-route";
import { useFollowFlight, focusFlight } from "@/hooks/use-follow-flight";
import { useGlobeClick } from "@/hooks/use-globe-click";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useAutoRotate } from "@/hooks/use-auto-rotate";
import { resetView, focusSigmet } from "@/lib/camera-utils";
import type { RiskAssessment, FlightVector } from "@/types/domain";

export const Route = createFileRoute("/")({
  component: GlobePage,
});

const DEFAULT_LAYERS: LayerVisibility = {
  flights: true,
  airports: true,
  sigmets: true,
  trails: true,
  routes: true,
};

function GlobePage() {
  const [viewer, setViewer] = useState<CesiumViewer | null>(null);
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [followMode, setFollowMode] = useState(false);
  const [layers, setLayers] = useState<LayerVisibility>(DEFAULT_LAYERS);
  const [sceneMode, setSceneMode] = useState<"3D" | "2D">("3D");
  const [autoRotate, setAutoRotate] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const bbox = useViewportBbox(viewer);
  const flightsQuery = useFlights(riskFilter);
  const sigmetsQuery = useSigmets();
  const airportsQuery = useAirports();

  const sigmets = sigmetsQuery.data?.sigmets ?? [];
  const airports = airportsQuery.data ?? [];

  const risks: RiskAssessment[] = useMemo(() => [], []);

  const filteredFlights = useMemo(() => {
    const allFlights = flightsQuery.data?.flights ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return allFlights;
    return allFlights.filter(
      (f) =>
        f.callsign?.toLowerCase().includes(q) ||
        f.icao24.toLowerCase().includes(q) ||
        f.origin_country.toLowerCase().includes(q),
    );
  }, [flightsQuery.data, search]);

  const selectedFlight: FlightVector | null = useMemo(() => {
    if (!selectedId) return null;
    return filteredFlights.find((f) => f.icao24 === selectedId) ?? null;
  }, [filteredFlights, selectedId]);

  const trailQuery = useFlightTrail(selectedId);
  const routeQuery = useFlightRoute(selectedId);
  useFollowFlight({ viewer, selectedFlight, enabled: followMode });

  const selectedRisk = useMemo(
    () => risks.find((r) => r.flight === selectedId) ?? null,
    [risks, selectedId],
  );

  const handleSelect = useCallback(
    (icao24: string) => {
      setSelectedId(icao24);
      setFollowMode(false);
      const flight = filteredFlights.find((f) => f.icao24 === icao24);
      if (flight && viewer) {
        focusFlight(viewer, flight);
      }
    },
    [filteredFlights, viewer],
  );

  const handleDeselect = useCallback(() => {
    setSelectedId(null);
    setFollowMode(false);
  }, []);

  const handleResetView = useCallback(() => {
    resetView(viewer);
    setSelectedId(null);
    setFollowMode(false);
    setAutoRotate(false);
  }, [viewer]);

  const handleToggleSceneMode = useCallback(() => {
    if (!viewer) return;
    if (sceneMode === "3D") {
      viewer.scene.morphTo2D(1.0);
      setSceneMode("2D");
    } else {
      viewer.scene.morphTo3D(1.0);
      setSceneMode("3D");
    }
  }, [viewer, sceneMode]);

  const handleToggleAutoRotate = useCallback(() => {
    setAutoRotate((v) => !v);
  }, []);

  useAutoRotate({ viewer, enabled: autoRotate });

  useGlobeClick({
    viewer,
    onPickFlight: (icao24) => setSelectedId(icao24),
    onPickSigmet: (sigmetId) => {
      const sig = sigmets.find((s) => s.sigmet_id === sigmetId);
      if (sig) focusSigmet(viewer, sig);
    },
    onBackgroundClick: handleDeselect,
  });

  useKeyboardShortcuts({
    onSearchFocus: () => searchInputRef.current?.focus(),
    onDeselect: handleDeselect,
    onToggleFollow: () => setFollowMode((v) => !v),
    onResetView: handleResetView,
    onToggleAutoRotate: handleToggleAutoRotate,
    hasSelectedFlight: !!selectedFlight,
  });

  const highRiskCount = risks.filter((r) => r.risk === "HIGH").length;

  return (
    <>
      <CesiumGlobe onReady={setViewer}>
        {layers.flights && (
          <FlightLayer
            flights={filteredFlights}
            risks={risks}
            viewportBbox={bbox}
            selectedId={selectedId}
          />
        )}
        {layers.airports && <AirportsLayer airports={airports} />}
        {layers.sigmets && <HazardLayer sigmets={sigmets} />}
        {layers.trails && selectedId && (
          <FlightTrailLayer trail={trailQuery.data?.trail ?? []} icao24={selectedId} />
        )}
        {layers.routes && (
          <RouteLineLayer route={routeQuery.data ?? null} flight={selectedFlight} />
        )}
        {layers.routes && selectedFlight && (
          <FlightPredictLayer flight={selectedFlight} />
        )}
      </CesiumGlobe>

      <HudBar
        flightCount={filteredFlights.length}
        sigmetCount={sigmets.length}
        highRiskCount={highRiskCount}
      />

      <FlightsPanel
        flights={filteredFlights}
        risks={risks}
        isLoading={flightsQuery.isLoading}
        onSelect={handleSelect}
        selectedId={selectedId}
        riskFilter={riskFilter}
        onRiskFilterChange={setRiskFilter}
        search={search}
        onSearchChange={setSearch}
        followMode={followMode}
        onFollowModeChange={setFollowMode}
        selectedFlight={selectedFlight}
        route={routeQuery.data ?? null}
        searchInputRef={searchInputRef}
      />

      <HazardPanel
        sigmets={sigmets}
        isLoading={sigmetsQuery.isLoading}
        onSelect={(sigmetId) => {
          const sig = sigmets.find((s) => s.sigmet_id === sigmetId);
          if (sig) focusSigmet(viewer, sig);
        }}
      />

      <FlightDetailPanel
        flight={selectedFlight}
        route={routeQuery.data ?? null}
        risk={selectedRisk ?? undefined}
        onClose={handleDeselect}
        onFollow={() => setFollowMode((v) => !v)}
        followMode={followMode}
      />

      <GlobeControlBar
        layers={layers}
        onLayersChange={setLayers}
        onResetView={handleResetView}
        sceneMode={sceneMode}
        onToggleSceneMode={handleToggleSceneMode}
        autoRotate={autoRotate}
        onToggleAutoRotate={handleToggleAutoRotate}
      />
    </>
  );
}
