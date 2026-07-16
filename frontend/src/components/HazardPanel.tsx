import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { HazardPolygon } from "@/types/domain";

interface HazardPanelProps {
  sigmets: HazardPolygon[];
  isLoading?: boolean;
  onSelect?: (sigmetId: string) => void;
}

export function HazardPanel({
  sigmets,
  isLoading,
  onSelect,
}: HazardPanelProps) {
  return (
    <aside className="absolute right-0 top-9 z-30 flex h-[calc(100%-2.25rem)] w-72 flex-col border-l border-cyan-500/15 bg-black/60 backdrop-blur-sm">
      <div className="border-b border-cyan-500/15 px-3 py-2">
        <h2 className="font-mono text-xs font-bold tracking-wider text-radar-hazard">
          ACTIVE SIGMETS
        </h2>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col">
          {isLoading && (
            <div className="flex flex-col gap-1 p-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          )}
          {!isLoading && sigmets.length === 0 && (
            <div className="p-4 text-center font-mono text-xs text-muted-foreground">
              No active hazards
            </div>
          )}
          {sigmets.map((sig) => (
            <button
              key={sig.sigmet_id}
              onClick={() => onSelect?.(sig.sigmet_id)}
              className="border-b border-cyan-500/5 px-3 py-2 text-left transition-colors hover:bg-radar-hazard/5"
            >
              <div className="mb-1 flex items-center justify-between">
                <Badge variant="destructive" className="font-mono text-[9px]">
                  {sig.hazard_type}
                </Badge>
                <span className="font-mono text-[9px] text-muted-foreground">
                  {sig.sigmet_id}
                </span>
              </div>
              <div className="flex gap-2 font-mono text-[10px] text-muted-foreground">
                {sig.min_ft && <span>FL{Math.round(sig.min_ft / 100)}</span>}
                {sig.max_ft && <span>- FL{Math.round(sig.max_ft / 100)}</span>}
                <span>{sig.points.length} pts</span>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
