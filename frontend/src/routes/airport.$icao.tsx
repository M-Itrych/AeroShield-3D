import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useAirport } from "@/hooks/use-airport";
import { useAirportMetar } from "@/hooks/use-airport-metar";
import type { MetarReport } from "@/types/domain";

export const Route = createFileRoute("/airport/$icao")({
  component: AirportDetail,
});

const CAT_VARIANT: Record<string, string> = {
  VFR: "border-hud-grid/60 text-hud-grid bg-hud-grid/10",
  MVFR: "border-hud-grid/40 text-hud-grid/80 bg-hud-grid/5",
  IFR: "border-hud-warn/60 text-hud-warn bg-hud-warn/10",
  LIFR: "border-hud-warn/80 text-hud-warn bg-hud-warn/20",
};

function AirportDetail() {
  const { icao } = useParams({ from: "/airport/$icao" });
  const airportQuery = useAirport(icao);
  const metarQuery = useAirportMetar(icao);

  const airport = airportQuery.data;
  const metar = metarQuery.data ?? null;

  return (
    <div className="flex h-full items-center justify-center p-4 sm:p-8">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="size-1.5 animate-status-blink rounded-full bg-hud-grid" />
              <CardTitle>
                {airport ? `${airport.icao} ${airport.name}` : `STATION ${icao}`}
              </CardTitle>
            </div>
            <Badge variant="secondary">ACTIVE</Badge>
          </div>
          {airport && (
            <span className="font-mono text-[13px] text-hud-dim">
              {airport.iata ?? "--"} | {airport.country}
            </span>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 font-mono text-sm sm:grid-cols-2">
            <InfoRow label="ICAO" value={airport?.icao ?? icao} />
            <InfoRow label="IATA" value={airport?.iata ?? "--"} />
            <InfoRow label="NAME" value={airport?.name ?? "--"} />
            <InfoRow label="COUNTRY" value={airport?.country ?? "--"} />
            <InfoRow
              label="LATITUDE"
              value={airport ? airport.latitude.toFixed(4) : "--"}
            />
            <InfoRow
              label="LONGITUDE"
              value={airport ? airport.longitude.toFixed(4) : "--"}
            />
          </div>

          {airportQuery.isLoading && <Skeleton className="h-32 w-full" />}

          {!airportQuery.isLoading && !airport && (
            <div className="border border-hud-border p-4 text-center font-mono text-[12px] tracking-wider text-hud-dim">
              STATION NOT IN DATABASE
            </div>
          )}

          {airport && <MetarCard metar={metar} loading={metarQuery.isLoading} />}
        </CardContent>
      </Card>
    </div>
  );
}

function MetarCard({
  metar,
  loading,
}: {
  metar: MetarReport | null;
  loading: boolean;
}) {
  if (loading) return <Skeleton className="h-40 w-full" />;
  if (!metar) {
    return (
      <div className="border border-hud-border p-4 text-center font-mono text-[12px] tracking-wider text-hud-dim">
        NO METAR DATA
      </div>
    );
  }

  const cat = metar.flight_category ?? "UNKNOWN";

  return (
    <div className="flex flex-col gap-2 border border-hud-border bg-hud-charcoal/40 p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[12px] font-bold tracking-[0.18em] text-hud-grid">
          METAR
        </span>
        <span
          className={`border px-2 py-0.5 font-mono text-[14px] font-bold tracking-wider ${
            CAT_VARIANT[cat] ?? "border-hud-border text-hud-dim"
          }`}
        >
          {cat}
        </span>
      </div>

      {metar.raw_ob && (
        <code className="block break-all font-mono text-[13px] text-hud-ink/80">
          {metar.raw_ob}
        </code>
      )}

      <div className="grid grid-cols-3 gap-2 font-mono text-[14px]">
        <MetarStat
          label="TEMP"
          value={metar.temp_c != null ? `${metar.temp_c}C` : "--"}
        />
        <MetarStat
          label="DEW"
          value={metar.dewpoint_c != null ? `${metar.dewpoint_c}C` : "--"}
        />
        <MetarStat
          label="WIND"
          value={
            metar.wind_dir != null && metar.wind_speed_kt != null
              ? `${metar.wind_dir}@${metar.wind_speed_kt}kt`
              : "--"
          }
        />
        <MetarStat
          label="VIS"
          value={metar.visibility_sm != null ? `${metar.visibility_sm}sm` : "--"}
        />
        <MetarStat
          label="OBS"
          value={
            metar.obs_time
              ? new Date(metar.obs_time * 1000).toISOString().slice(11, 19)
              : "--"
          }
        />
        <MetarStat label="STATION" value={metar.icao} />
      </div>
    </div>
  );
}

function MetarStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-l border-hud-border pl-1.5">
      <span className="tracking-[0.14em] text-hud-dim">{label}</span>
      <span className="text-hud-ink">{value}</span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-l border-hud-border pl-3">
      <span className="font-mono text-[14px] tracking-[0.16em] text-hud-dim">
        {label}
      </span>
      <span className="font-mono text-sm text-hud-ink">{value}</span>
    </div>
  );
}
