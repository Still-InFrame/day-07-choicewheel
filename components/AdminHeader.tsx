"use client";

import Link from "next/link";
import { useState } from "react";
import { setPublished } from "@/lib/api";
import type { Wheel } from "@/lib/types";

// Sticky top bar for the creator view: back-to-dashboard on the left, publish on the right.
export function AdminHeader({ wheel, adminToken }: { wheel: Wheel; adminToken: string }) {
  const [busy, setBusy] = useState(false);

  async function togglePublish() {
    setBusy(true);
    try {
      await setPublished(adminToken, !wheel.published);
    } finally {
      setBusy(false);
    }
  }

  return (
    <header className="sticky top-0 z-20 -mx-4 px-4 h-14 flex items-center justify-between border-b border-white/10 bg-[#0b0b16]/85 backdrop-blur">
      <Link
        href="/"
        className="flex items-center gap-1.5 text-sm font-semibold text-white/80 hover:text-white transition"
      >
        <span aria-hidden>←</span>
        <span>
          Choice<span className="text-violet-400">Wheel</span>
        </span>
      </Link>

      {wheel.published ? (
        <div className="flex items-center gap-3">
          <span className="text-sm text-emerald-300">● Live</span>
          <button
            onClick={togglePublish}
            disabled={busy}
            className="text-sm rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 px-3 py-1.5 transition"
          >
            Unpublish
          </button>
        </div>
      ) : (
        <button
          onClick={togglePublish}
          disabled={busy}
          title="Make the guest link work — guests can't open it until you publish"
          className="text-sm font-semibold rounded-lg bg-amber-400 text-black hover:bg-amber-300 disabled:opacity-40 px-4 py-1.5 transition"
        >
          Publish
        </button>
      )}
    </header>
  );
}
