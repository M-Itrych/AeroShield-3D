import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CesiumGlobe } from "@/components/CesiumGlobe";
import { FlightLayer } from "@/components/FlightLayer";
import { HazardLayer } from "@/components/HazardLayer";
import { HudBar } from "@/components/HudBar";
import { FlightsPanel } from "@/components/FlightsPanel";
import { HazardPanel } from "@/components/HazardPanel";
import { useFlights } from "@/hooks/use-flights";
import { useSigmets } from "@/hooks/use-sigmets";
import type { RiskAssessment } from "@/types/domain";

export const Route = createFileRoute("/")({
  component: GlobePage,
});

function GlobePage() {
  const flightsQuery = useFlights();
  const sigmetsQuery = useSigmets();

  const flights = flightsQuery.data?.flights ?? [];
  const sigmets = sigmetsQuery.data?.sigmets ?? [];

  const risks: RiskAssessment[] = useMemo(() => [], []);

  const highRiskCount = risks.filter((r) => r.risk === "HIGH").length;

  return (
    <>
      <CesiumGlobe>
        <FlightLayer flights={flights} risks={risks} />
        <HazardLayer sigmets={sigmets} />
      </CesiumGlobe>

      <HudBar
        flightCount={flights.length}
        sigmetCount={sigmets.length}
        highRiskCount={highRiskCount}
      />

      <FlightsPanel
        flights={flights}
        risks={risks}
        isLoading={flightsQuery.isLoading}
      />

      <HazardPanel
        sigmets={sigmets}
        isLoading={sigmetsQuery.isLoading}
      />
    </>
  );
}
