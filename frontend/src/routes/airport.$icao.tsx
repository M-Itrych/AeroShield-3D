import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { createFileRoute, useParams } from "@tanstack/react-router";

export const Route = createFileRoute("/airport/$icao")({
  component: AirportDetail,
});

function AirportDetail() {
  const { icao } = useParams({ from: "/airport/$icao" });

  return (
    <div className="flex h-full items-center justify-center p-8">
      <Card className="w-full max-w-2xl border-cyan-500/15 bg-black/60 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-mono text-radar-grid">
              AIRPORT {icao}
            </CardTitle>
            <Badge variant="secondary" className="font-mono">ACTIVE</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 font-mono text-sm">
            <InfoRow label="ICAO" value={icao} />
            <InfoRow label="IATA" value="--" />
            <InfoRow label="Name" value="--" />
            <InfoRow label="Traffic Count" value="--" />
          </div>
          <div className="mt-6">
            <Skeleton className="h-32 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
