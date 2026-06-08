"use client";

import { useEffect, useRef } from "react";
import type { Item, SpinSignal } from "@/lib/types";
import { playTick } from "@/lib/sound";

const SIZE = 320;
const R = SIZE / 2;
const C = SIZE / 2;
const MIN_TICK_MS = 26; // throttle clicks so a fast spin doesn't overlap them
const IDLE_DEG_PER_SEC = 14; // gentle attract spin while idle (~26s per turn)

// Point on the rim at `deg` clockwise from the top (12 o'clock).
function pointAt(deg: number, radius: number): [number, number] {
  const t = (deg * Math.PI) / 180;
  return [C + radius * Math.sin(t), C - radius * Math.cos(t)];
}

function slicePath(start: number, end: number): string {
  const [x1, y1] = pointAt(start, R);
  const [x2, y2] = pointAt(end, R);
  const large = end - start > 180 ? 1 : 0;
  return `M ${C} ${C} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

type SpinJob = {
  start: number;
  target: number;
  t0: number;
  duration: number;
  seg: number;
  winner: Item;
  lastBoundary: number;
};

export function Wheel({
  items,
  spin,
  onSpinStart,
  onSpinEnd,
}: {
  items: Item[];
  spin: SpinSignal | null;
  onSpinStart?: () => void;
  onSpinEnd?: (winner: Item) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const flipperRef = useRef<HTMLDivElement>(null);
  const rotationRef = useRef(0);
  const lastNonce = useRef<number | null>(null);
  const lastTickTime = useRef(0);
  const flapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spinJob = useRef<SpinJob | null>(null);
  const idleBoundary = useRef(0); // last peg the flipper flapped against while idling
  const itemsRef = useRef(items);
  const onSpinEndRef = useRef(onSpinEnd);
  // Keep the loop's refs current without touching them during render.
  useEffect(() => {
    itemsRef.current = items;
    onSpinEndRef.current = onSpinEnd;
  });

  function flap() {
    const f = flipperRef.current;
    if (!f) return;
    f.style.transform = "rotate(15deg)";
    if (flapTimer.current) clearTimeout(flapTimer.current);
    flapTimer.current = setTimeout(() => {
      if (flipperRef.current) flipperRef.current.style.transform = "rotate(0deg)";
    }, 55);
  }

  // One persistent loop: idle = slow drift; spin = eased deceleration with ticks.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = now - last;
      last = now;
      let rot = rotationRef.current;
      const job = spinJob.current;

      if (job) {
        const t = Math.min(1, (now - job.t0) / job.duration);
        rot = job.start + (job.target - job.start) * easeOutQuart(t);
        let passed = false;
        while (rot - job.lastBoundary >= job.seg) {
          job.lastBoundary += job.seg;
          passed = true;
        }
        if (passed && now - lastTickTime.current > MIN_TICK_MS) {
          lastTickTime.current = now;
          playTick();
          flap();
        }
        if (t >= 1) {
          rot = job.target;
          idleBoundary.current = job.target; // resume idle flaps from here
          spinJob.current = null; // resume idle drift next frames
          onSpinEndRef.current?.(job.winner);
        }
      } else if (itemsRef.current.length >= 2) {
        rot += (IDLE_DEG_PER_SEC * dt) / 1000;
        // Flipper reacts to each peg as it passes — visual only (no sound while idle).
        const seg = 360 / itemsRef.current.length;
        if (rot - idleBoundary.current > seg * 3) idleBoundary.current = rot - seg; // avoid a catch-up burst
        while (rot - idleBoundary.current >= seg) {
          idleBoundary.current += seg;
          flap();
        }
      }

      rotationRef.current = rot;
      if (svgRef.current) svgRef.current.style.transform = `rotate(${rot}deg)`;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      if (flapTimer.current) clearTimeout(flapTimer.current);
    };
  }, []);

  // A new spin broadcast → set up the spin job (the loop picks it up).
  useEffect(() => {
    if (!spin || spin.nonce === lastNonce.current) return;
    const n = items.length;
    const idx = items.findIndex((i) => i.id === spin.winnerItemId);
    if (n === 0 || idx < 0) return;
    lastNonce.current = spin.nonce;

    const seg = 360 / n;
    const centerAngle = idx * seg + seg / 2;
    const jitter = ((spin.nonce % 1000) / 1000 - 0.5) * seg * 0.6;
    const rmod = ((360 - (centerAngle % 360)) % 360) + jitter;
    const start = rotationRef.current;
    const base = Math.ceil(start / 360) * 360;
    const target = base + spin.extraTurns * 360 + rmod;

    onSpinStart?.();
    spinJob.current = { start, target, t0: performance.now(), duration: spin.durationMs, seg, winner: items[idx], lastBoundary: start };
  }, [spin, items]); // eslint-disable-line react-hooks/exhaustive-deps

  const n = items.length;
  const seg = n > 0 ? 360 / n : 0;
  const fontSize = n <= 6 ? 16 : n <= 12 ? 13 : n <= 20 ? 11 : 9;
  const maxChars = n <= 6 ? 16 : n <= 12 ? 12 : 9;

  return (
    <div className="relative" style={{ width: SIZE, height: SIZE }}>
      {/* flipper — pivots from its tip and flaps as pegs pass during a real spin */}
      <div
        ref={flipperRef}
        className="absolute left-1/2 -translate-x-1/2 z-10"
        style={{ top: -6, transformOrigin: "50% 0%", transition: "transform 0.05s ease-out" }}
        aria-hidden
      >
        <div
          style={{
            width: 0,
            height: 0,
            borderLeft: "13px solid transparent",
            borderRight: "13px solid transparent",
            borderTop: "22px solid #f5f5fb",
            filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.5))",
          }}
        />
      </div>

      {/* transform is driven imperatively by the animation loop (kept out of the
          style prop so React re-renders don't reset the rotation). */}
      <svg
        ref={svgRef}
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.45))" }}
      >
        <circle cx={C} cy={C} r={R} fill="rgba(255,255,255,0.04)" />

        {n === 0 && (
          <text x={C} y={C} textAnchor="middle" dominantBaseline="middle" fill="rgba(245,245,251,0.5)" fontSize={15}>
            No items yet
          </text>
        )}

        {n === 1 && (
          <>
            <circle cx={C} cy={C} r={R} fill={items[0].color} />
            <text x={C} y={C - 46} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={18} fontWeight={600}>
              {truncate(items[0].label, 18)}
            </text>
          </>
        )}

        {n > 1 &&
          items.map((item, i) => {
            const start = i * seg;
            const end = (i + 1) * seg;
            const labelAngle = start + seg / 2;
            const [lx, ly] = pointAt(labelAngle, R * 0.62);
            let textRot = labelAngle - 90;
            if (labelAngle > 180) textRot += 180;
            return (
              <g key={item.id}>
                <path d={slicePath(start, end)} fill={item.color} stroke="rgba(0,0,0,0.18)" strokeWidth={1} />
                <text
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#fff"
                  fontSize={fontSize}
                  fontWeight={600}
                  transform={`rotate(${textRot} ${lx} ${ly})`}
                  style={{ textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}
                >
                  {truncate(item.label, maxChars)}
                </text>
              </g>
            );
          })}

        {/* pegs at each slice boundary — these pass under the flipper */}
        {n > 1 &&
          items.map((_, i) => {
            const [px, py] = pointAt(i * seg, R - 4);
            return <circle key={`peg-${i}`} cx={px} cy={py} r={3.2} fill="#f5f5fb" stroke="rgba(0,0,0,0.25)" strokeWidth={1} />;
          })}

        {n > 0 && <circle cx={C} cy={C} r={18} fill="#0b0b16" stroke="rgba(255,255,255,0.6)" strokeWidth={3} />}
      </svg>
    </div>
  );
}
