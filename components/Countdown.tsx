"use client";

import { useEffect, useState } from "react";

function format(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// Local countdown to the deadline. Calls onExpire once when it crosses zero (the
// server also enforces the window, so this is just UI).
export function Countdown({ deadline, onExpire }: { deadline: string; onExpire?: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const target = new Date(deadline).getTime();

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = target - now;
  const expired = remaining <= 0;

  useEffect(() => {
    if (expired) onExpire?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired]);

  if (expired) {
    return <span className="text-rose-300 font-medium">Submissions closed</span>;
  }
  return (
    <span className={remaining < 30000 ? "text-rose-300 font-semibold cw-pulse" : "text-amber-200 font-semibold"}>
      {format(remaining)} left to submit
    </span>
  );
}
