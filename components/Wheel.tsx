"use client";

import { useEffect, useRef, useState } from "react";
import type { Item, SpinSignal } from "@/lib/types";

const SIZE = 320;
const R = SIZE / 2;
const C = SIZE / 2;

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
  const [anim, setAnim] = useState({ rotation: 0, duration: 0, active: false });
  const rotationRef = useRef(0);
  const lastNonce = useRef<number | null>(null);
  const pendingWinner = useRef<Item | null>(null);

  useEffect(() => {
    if (!spin || spin.nonce === lastNonce.current) return;
    const n = items.length;
    const idx = items.findIndex((i) => i.id === spin.winnerItemId);
    if (n === 0 || idx < 0) return;
    lastNonce.current = spin.nonce;
    pendingWinner.current = items[idx];

    const seg = 360 / n;
    const centerAngle = idx * seg + seg / 2;
    // Deterministic jitter from the nonce so every client lands at the same spot
    // (within the slice, so the winner never changes).
    const jitter = ((spin.nonce % 1000) / 1000 - 0.5) * seg * 0.6;
    const rmod = ((360 - (centerAngle % 360)) % 360) + jitter;
    const base = Math.ceil(rotationRef.current / 360) * 360;
    const target = base + spin.extraTurns * 360 + rmod;
    rotationRef.current = target;

    onSpinStart?.();
    setAnim({ rotation: target, duration: spin.durationMs, active: true });
  }, [spin, items, onSpinStart]);

  const handleEnd = () => {
    if (!anim.active) return;
    setAnim((a) => ({ ...a, active: false }));
    if (pendingWinner.current) {
      onSpinEnd?.(pendingWinner.current);
      pendingWinner.current = null;
    }
  };

  const n = items.length;
  const seg = n > 0 ? 360 / n : 0;
  const fontSize = n <= 6 ? 16 : n <= 12 ? 13 : n <= 20 ? 11 : 9;
  const maxChars = n <= 6 ? 16 : n <= 12 ? 12 : 9;

  return (
    <div className="relative" style={{ width: SIZE, height: SIZE }}>
      {/* fixed pointer at the top, pointing into the wheel */}
      <div className="absolute left-1/2 -translate-x-1/2 z-10" style={{ top: -6 }} aria-hidden>
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
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{
          transform: `rotate(${anim.rotation}deg)`,
          transition: anim.active ? `transform ${anim.duration}ms cubic-bezier(0.17, 0.67, 0.16, 1)` : "none",
          filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.45))",
        }}
        onTransitionEnd={handleEnd}
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

        {n > 0 && <circle cx={C} cy={C} r={18} fill="#0b0b16" stroke="rgba(255,255,255,0.6)" strokeWidth={3} />}
      </svg>
    </div>
  );
}
