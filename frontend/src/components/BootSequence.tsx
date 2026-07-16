import { useState, useEffect, useRef, useCallback } from "react";

interface BootSequenceProps {
  ready: boolean;
  flightCount: number;
  sigmetCount: number;
  airportCount: number;
}

interface CheckItem {
  label: string;
  done: boolean;
}

const CHECKS: { label: string; delay: number }[] = [
  { label: "GLOBE RENDERER", delay: 200 },
  { label: "OPENSKY UPLINK", delay: 500 },
  { label: "SIGMET FEED", delay: 800 },
  { label: "AIRPORT INDEX", delay: 1100 },
  { label: "RISK ENGINE", delay: 1400 },
  { label: "SSE STREAM", delay: 1700 },
];

export function BootSequence({
  ready,
  flightCount,
  sigmetCount,
  airportCount,
}: BootSequenceProps) {
  const [phase, setPhase] = useState<"booting" | "fadeout" | "done">("booting");
  const [checks, setChecks] = useState<CheckItem[]>(
    CHECKS.map((c) => ({ label: c.label, done: false })),
  );
  const [displayedFlights, setDisplayedFlights] = useState(0);
  const [displayedSigmets, setDisplayedSigmets] = useState(0);
  const [BootRingAngle, setBootRingAngle] = useState(0);
  const animRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    CHECKS.forEach((check, i) => {
      const t = setTimeout(() => {
        setChecks((prev) =>
          prev.map((c, idx) => (idx === i ? { ...c, done: true } : c)),
        );
      }, check.delay);
      timers.push(t);
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    let last = performance.now();
    let angle = 0;

    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      angle = (angle + dt * 0.18) % 360;
      setBootRingAngle(angle);
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  const allChecksDone = checks.every((c) => c.done);

  useEffect(() => {
    if (!ready || !allChecksDone) return;

    setPhase("fadeout");
    fadeTimerRef.current = setTimeout(() => setPhase("done"), 1200);

    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [ready, allChecksDone]);

  const animateCount = useCallback(() => {
    if (flightCount > 0) {
      setDisplayedFlights((prev) => {
        const remaining = flightCount - prev;
        if (remaining <= 0) return flightCount;
        return prev + Math.max(1, Math.ceil(remaining * 0.12));
      });
    }
    if (sigmetCount > 0) {
      setDisplayedSigmets((prev) => {
        const remaining = sigmetCount - prev;
        if (remaining <= 0) return sigmetCount;
        return prev + Math.max(1, Math.ceil(remaining * 0.18));
      });
    }
  }, [flightCount, sigmetCount]);

  useEffect(() => {
    if (phase !== "booting") return;
    const interval = setInterval(animateCount, 50);
    return () => clearInterval(interval);
  }, [animateCount, phase]);

  const removeBootScreen = useCallback(() => {
    if (typeof window !== "undefined" && window.__removeBootScreen) {
      window.__removeBootScreen();
    }
  }, []);

  useEffect(() => {
    if (phase === "fadeout") {
      const t = setTimeout(removeBootScreen, 200);
      return () => clearTimeout(t);
    }
  }, [phase, removeBootScreen]);

  if (phase === "done") return null;

  const fadeClass = phase === "fadeout" ? "opacity-0" : "opacity-100";

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-[9000] flex items-center justify-center bg-hud-space transition-opacity duration-700 ${fadeClass}`}
    >
      <div className="flex flex-col items-center gap-5">
        <div className="relative flex size-16 items-center justify-center">
          <svg className="absolute inset-0" viewBox="0 0 64 64">
            <circle
              cx="32"
              cy="32"
              r="28"
              fill="none"
              stroke="rgba(57,255,20,0.1)"
              strokeWidth="1"
            />
            <circle
              cx="32"
              cy="32"
              r="28"
              fill="none"
              stroke="#39ff14"
              strokeWidth="1.5"
              strokeDasharray="60 120"
              strokeLinecap="round"
              style={{
                transform: `rotate(${BootRingAngle}deg)`,
                transformOrigin: "center",
                filter: "drop-shadow(0 0 4px rgba(57,255,20,0.5))",
              }}
            />
            <circle
              cx="32"
              cy="32"
              r="20"
              fill="none"
              stroke="rgba(57,255,20,0.15)"
              strokeWidth="0.5"
              strokeDasharray="2 3"
            />
            <circle
              cx="32"
              cy="32"
              r="3"
              fill="#39ff14"
              style={{ filter: "drop-shadow(0 0 6px rgba(57,255,20,0.8))" }}
            />
          </svg>
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <h1
            className="font-mono text-base font-bold tracking-[0.2em] text-hud-grid"
            style={{ textShadow: "0 0 12px rgba(57,255,20,0.3)" }}
          >
            AEROSHIELD
          </h1>
          <span className="font-mono text-[12px] tracking-[0.16em] text-hud-dim">
            TACTICAL TELEMETRY SYSTEM
          </span>
        </div>

        <div className="flex w-56 flex-col gap-0.5">
          {checks.map((check) => (
            <div
              key={check.label}
              className="flex items-center justify-between font-mono text-[12px] tracking-wider"
            >
              <span className={check.done ? "text-hud-grid" : "text-hud-dim"}>
                {check.label}
              </span>
              <span
                className={
                  check.done ? "text-hud-grid" : "text-hud-dim animate-pulse"
                }
              >
                {check.done ? "[OK]" : "[..]"}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 font-mono text-[13px]">
          <div className="flex flex-col items-center">
            <span className="font-bold tabular-nums text-hud-grid">
              {String(displayedFlights).padStart(4, "0")}
            </span>
            <span className="text-[12px] tracking-wider text-hud-dim">TRACKS</span>
          </div>
          <span className="h-6 w-px bg-hud-grid/15" />
          <div className="flex flex-col items-center">
            <span className="font-bold tabular-nums text-hud-warn">
              {String(displayedSigmets).padStart(2, "0")}
            </span>
            <span className="text-[12px] tracking-wider text-hud-dim">HAZARDS</span>
          </div>
          <span className="h-6 w-px bg-hud-grid/15" />
          <div className="flex flex-col items-center">
            <span className="font-bold tabular-nums text-hud-ink">
              {String(airportCount).padStart(5, "0")}
            </span>
            <span className="text-[12px] tracking-wider text-hud-dim">AIRPORTS</span>
          </div>
        </div>
      </div>
    </div>
  );
}
