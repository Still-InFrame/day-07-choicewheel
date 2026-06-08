"use client";

import { useEffect, useRef, useState } from "react";
import type { Item, SpinSignal } from "@/lib/types";
import { playTick } from "@/lib/sound";

const SIZE = 320;
const R = SIZE / 2;
const C = SIZE / 2;
const MIN_TICK_MS = 26; // throttle clicks so a fast spin doesn't overlap them

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
  const [rotation, setRotation] = useState(0); // resting transform (set at spin end)
  const svgRef = useRef<SVGSVGElement>(null);
  const flipperRef = useRef<HTMLDivElement>(null);
  const rotationRef = useRef(0);
  const lastNonce = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTickTime = useRef(0);
  const flapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flap() {
    const f = flipperRef.current;
    if (!f) return;
    f.style.transform = "rotate(15deg)";
    if (flapTimer.current) clearTimeout(flapTimer.current);
    flapTimer.current = setTimeout(() => {
      if (flipperRef.current) flipperRef.current.style.transform = "rotate(0deg)";
    }, 55);
  }

  useEffect(() => {
    if (!spin || spin.nonce === lastNonce.current) return;
    const n = items.length;
    const idx = items.findIndex((i) => i.id === spin.winnerItemId);
    if (n === 0 || idx < 0) return;
    lastNonce.current = spin.nonce;
    const winner = items[idx];

    const seg = 360 / n;
    const centerAngle = idx * seg + seg / 2;
    const jitter = ((spin.nonce % 1000) / 1000 - 0.5) * seg * 0.6;
    const rmod = ((360 - (centerAngle % 360)) % 360) + jitter;
    const start = rotationRef.current;
    const base = Math.ceil(start / 360) * 360;
    const target = base + spin.extraTurns * 360 + rmod;

    onSpinStart?.();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const t0 = performance.now();
    let lastBoundary = start; // rotation of the most recent peg passed
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / spin.durationMs);
      const rot = start + (target - start) * easeOutQuart(t);
      if (svgRef.current) svgRef.current.style.transform = `rotate(${rot}deg)`;
      rotationRef.current = rot;

      // A peg passes the flipper every `seg` degrees → tick + flap (throttled).
      let passed = false;
      while (rot - lastBoundary >= seg) {
        lastBoundary += seg;
        passed = true;
      }
      if (passed && now - lastTickTime.current > MIN_TICK_MS) {
        lastTickTime.current = now;
        playTick();
        flap();
      }

      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
        rotationRef.current = target;
        setRotation(target);
        onSpinEnd?.(winner);
      }
    };
    rafRef.current = requestAnimationFrame(step);
  }, [spin, items]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (flapTimer.current) clearTimeout(flapTimer.current);
    };
  }, []);

  const n = items.length;
  const seg = n > 0 ? 360 / n : 0;
  const fontSize = n <= 6 ? 16 : n <= 12 ? 13 : n <= 20 ? 11 : 9;
  const maxChars = n <= 6 ? 16 : n <= 12 ? 12 : 9;

  return (
    <div className="relative" style={{ width: SIZE, height: SIZE }}>
      {/* flipper — pivots from its tip and flaps as pegs pass */}
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

      <svg
        ref={svgRef}
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ transform: `rotate(${rotation}deg)`, filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.45))" }}
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
