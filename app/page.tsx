"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createWheel, deleteWheel } from "@/lib/api";
import { getMyWheels, saveMyWheel, removeMyWheel, type SavedWheel } from "@/lib/storage";
import { StatsTicker } from "@/components/StatsTicker";

// Wheels auto-delete 24h after creation (a pg_cron job server-side); mirror that here
// so the dashboard stops listing ones that have aged out.
const EXPIRY_MS = 24 * 60 * 60 * 1000;

function expiryLabel(createdAt: number): string {
  const ms = createdAt + EXPIRY_MS - Date.now();
  if (ms <= 0) return "expired";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `auto-deletes in ${h}h` : `auto-deletes in ${m}m`;
}

export default function Home() {
  const router = useRouter();
  const [wheels, setWheels] = useState<SavedWheel[]>([]);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    // Read this device's wheels after mount (localStorage is client-only; doing this
    // in an effect avoids a server/client hydration mismatch). Drop any that have
    // passed the 24h expiry (the server has/will delete them).
    const all = getMyWheels();
    const live = all.filter((w) => w.createdAt + EXPIRY_MS > Date.now());
    all.filter((w) => w.createdAt + EXPIRY_MS <= Date.now()).forEach((w) => removeMyWheel(w.id));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWheels(live);
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      const name = title.trim() || "My wheel";
      const { id, admin_token } = await createWheel(name);
      saveMyWheel({ id, adminToken: admin_token, title: name, createdAt: Date.now() });
      router.push(`/w/${id}/admin?k=${admin_token}`);
    } catch {
      setCreating(false);
    }
  }

  async function handleDelete(w: SavedWheel) {
    if (!confirm(`Delete "${w.title}" permanently? This removes it for everyone.`)) return;
    try {
      await deleteWheel(w.adminToken);
    } catch {
      // already gone (e.g. expired) — fall through and remove locally
    }
    removeMyWheel(w.id);
    setWheels((prev) => prev.filter((x) => x.id !== w.id));
  }

  return (
    <main className="w-full max-w-md mx-auto px-4 py-10 flex flex-col gap-8">
      <div className="text-center">
        <h1 className="text-4xl font-extrabold tracking-tight">
          Choice<span className="text-violet-400">Wheel</span>
        </h1>
        <p className="mt-2 text-white/60">
          Spin a wheel anyone can add to — live. Share a link, watch items pop on, then spin for a winner.
        </p>
      </div>

      <StatsTicker />

      <form onSubmit={handleCreate} className="rounded-2xl bg-white/5 border border-white/10 p-4">
        <label className="block text-sm text-white/60 mb-2">Name your wheel</label>
        <div className="flex gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Friday lunch pick"
            className="flex-1 rounded-lg bg-black/30 border border-white/15 px-3 py-2.5 outline-none focus:border-violet-400"
          />
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-violet-500 hover:bg-violet-400 disabled:opacity-50 font-semibold px-5 transition"
          >
            {creating ? "…" : "Create"}
          </button>
        </div>
        <p className="mt-2 text-xs text-white/40">No sign-up. Your wheels live on this device.</p>
      </form>

      {wheels.length > 0 && (
        <section>
          <h2 className="text-sm uppercase tracking-wide text-white/40 mb-1">Your wheels</h2>
          <p className="text-xs text-white/35 mb-3">Wheels auto-delete 24 hours after they&apos;re created.</p>
          <ul className="space-y-2">
            {wheels.map((w) => (
              <li key={w.id} className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 p-3">
                <Link href={`/w/${w.id}/admin?k=${w.adminToken}`} className="flex-1 min-w-0">
                  <span className="block font-medium hover:text-violet-300 truncate">{w.title}</span>
                  <span className="block text-xs text-white/35">{expiryLabel(w.createdAt)}</span>
                </Link>
                <Link
                  href={`/w/${w.id}`}
                  className="text-xs rounded-lg bg-white/10 hover:bg-white/20 px-2.5 py-1.5 transition"
                >
                  Guest view
                </Link>
                <button
                  onClick={() => handleDelete(w)}
                  className="text-sm text-white/40 hover:text-rose-300 px-1"
                  aria-label={`Delete ${w.title}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="text-center text-xs text-white/30">
        Day 07 of Savion&apos;s{" "}
        <a href="https://www.100dayaichallenge.com/share/savion" className="underline hover:text-white/50">
          100 Day AI Build Challenge
        </a>
      </footer>
    </main>
  );
}
