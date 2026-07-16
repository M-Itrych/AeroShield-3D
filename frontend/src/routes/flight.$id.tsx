import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { createFileRoute, useParams } from "@tanstack/react-router";

export const Route = createFileRoute("/flight/$id")({
  component: FlightDetail,
});

function FlightDetail() {
  const { id } = useParams({ from: "/flight/$id" });

  return (
    <div className="flex h-full items-center justify-center p-4 sm:p-8">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="size-1.5 animate-status-blink rounded-full bg-hud-grid" />
              <CardTitle>
                TRACK {id}
              </CardTitle>
            </div>
            <Badge variant="secondary">NONE</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 font-mono text-sm sm:grid-cols-2">
            <InfoRow label="CALLSIGN" value="--" />
            <InfoRow label="ORIGIN" value="--" />
            <InfoRow label="ALTITUDE" value="-- ft" />
            <InfoRow label="VELOCITY" value="-- m/s" />
            <InfoRow label="HEADING" value="-- deg" />
            <InfoRow label="RISK" value="NONE" accent="grid" />
          </div>
          <div className="mt-6">
            <Skeleton className="h-32 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "grid" | "warn";
}) {
  return (
    <div className="flex flex-col gap-1 border-l border-hud-grid/15 pl-3">
      <span className="font-mono text-[9px] tracking-[0.16em] text-hud-dim">
        {label}
      </span>
      <span
        className={`font-mono text-sm ${
          accent === "warn"
            ? "text-hud-warn"
            : accent === "grid"
              ? "text-hud-grid"
              : "text-hud-ink"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
