"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getStats } from "@/lib/api";
import type { Stats } from "@/lib/types";

// Counts up to `value` and re-animates whenever it changes (e.g. a live spin).
function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    const t0 = performance.now();
    const dur = 700;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(step);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{display.toLocaleString()}</>;
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl font-extrabold tabular-nums">
        <AnimatedNumber value={value} />
      </div>
      <div className="mt-0.5 text-xs uppercase tracking-wide text-white/40">{label}</div>
    </div>
  );
}

// Live lifetime counters (separate from row counts, so deletions never lower them).
export function StatsTicker() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let active = true;
    getStats()
      .then((s) => {
        if (active && s) setStats(s);
      })
      .catch(() => {});

    const sb = createClient();
    const channel = sb
      .channel("choicewheel:stats")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "choicewheel_stats", filter: "id=eq.1" },
        (payload) => setStats(payload.new as Stats),
      )
      .subscribe();

    return () => {
      active = false;
      sb.removeChannel(channel);
    };
  }, []);

  if (!stats) return null;

  return (
    <div className="flex items-center justify-center gap-10 rounded-2xl bg-white/5 border border-white/10 py-4">
      <Stat value={stats.wheels_created} label="wheels created" />
      <span className="h-10 w-px bg-white/10" aria-hidden />
      <Stat value={stats.total_spins} label="spins" />
    </div>
  );
}
