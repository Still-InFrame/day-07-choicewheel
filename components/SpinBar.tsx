"use client";

import { setAutoRemove } from "@/lib/api";
import type { Item, Wheel } from "@/lib/types";

// Sits directly under the wheel (full width): the SPIN / auto-remove row.
// Publish moved to <AdminHeader>; management controls live in <AdminPanel>.
export function SpinBar({
  wheel,
  items,
  adminToken,
  spinning,
  onSpin,
}: {
  wheel: Wheel;
  items: Item[];
  adminToken: string;
  spinning: boolean;
  onSpin: () => void;
}) {
  async function toggleAutoRemove() {
    await setAutoRemove(adminToken, !wheel.auto_remove);
  }

  return (
    <div className="w-full">
      <div className="flex gap-2">
        <button
          onClick={onSpin}
          disabled={items.length < 2 || spinning}
          className="flex-1 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:opacity-90 disabled:opacity-40 font-bold text-lg py-3 transition shadow-lg shadow-fuchsia-500/20"
        >
          {spinning ? "Spinning…" : items.length < 2 ? "Add 2+ items to spin" : "SPIN"}
        </button>
        <button
          onClick={toggleAutoRemove}
          title="Auto-remove the winner after each spin"
          className={`shrink-0 rounded-xl px-3 border text-xs font-semibold flex flex-col items-center justify-center gap-0.5 transition ${
            wheel.auto_remove
              ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-200"
              : "bg-white/5 border-white/15 text-white/60 hover:bg-white/10"
          }`}
        >
          <span>Auto-remove</span>
          <span className={wheel.auto_remove ? "text-emerald-300" : "text-white/40"}>
            {wheel.auto_remove ? "On" : "Off"}
          </span>
        </button>
      </div>
    </div>
  );
}
