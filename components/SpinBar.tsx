"use client";

import { useState } from "react";
import { setAutoRemove, setPublished } from "@/lib/api";
import type { Item, Wheel } from "@/lib/types";

// Sits directly under the wheel (full width): publish state + the SPIN / auto-remove row.
// The management controls live separately in <AdminPanel>.
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
  const [busy, setBusy] = useState(false);

  async function togglePublish() {
    setBusy(true);
    try {
      await setPublished(adminToken, !wheel.published);
    } finally {
      setBusy(false);
    }
  }

  async function toggleAutoRemove() {
    await setAutoRemove(adminToken, !wheel.auto_remove);
  }

  return (
    <div className="w-full space-y-3">
      {wheel.published ? (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-emerald-500/10 border border-emerald-400/30 px-3 py-2">
          <span className="text-sm text-emerald-200">● Published — your guest link is live</span>
          <button
            onClick={togglePublish}
            disabled={busy}
            className="text-xs rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 px-3 py-1.5 transition"
          >
            Unpublish
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-amber-400/10 border border-amber-300/30 px-3 py-2">
          <span className="text-sm text-amber-100">Draft — only you can see this. Guests can&apos;t open the link yet.</span>
          <button
            onClick={togglePublish}
            disabled={busy}
            className="text-sm font-semibold rounded-lg bg-amber-400 text-black hover:bg-amber-300 disabled:opacity-40 px-3 py-1.5 transition whitespace-nowrap"
          >
            Publish
          </button>
        </div>
      )}

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
