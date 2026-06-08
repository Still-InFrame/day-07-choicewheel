"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createWheel } from "@/lib/api";
import { getMyWheels, saveMyWheel, removeMyWheel, type SavedWheel } from "@/lib/storage";

export default function Home() {
  const router = useRouter();
  const [wheels, setWheels] = useState<SavedWheel[]>([]);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    // Read this device's wheels after mount (localStorage is client-only; doing this
    // in an effect avoids a server/client hydration mismatch).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWheels(getMyWheels());
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

  function handleForget(id: string) {
    if (!confirm("Remove this wheel from this device? (It won't be deleted for others.)")) return;
    removeMyWheel(id);
    setWheels(getMyWheels());
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
          <h2 className="text-sm uppercase tracking-wide text-white/40 mb-3">Your wheels</h2>
          <ul className="space-y-2">
            {wheels.map((w) => (
              <li key={w.id} className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 p-3">
                <Link href={`/w/${w.id}/admin?k=${w.adminToken}`} className="flex-1 font-medium hover:text-violet-300">
                  {w.title}
                </Link>
                <Link
                  href={`/w/${w.id}`}
                  className="text-xs rounded-lg bg-white/10 hover:bg-white/20 px-2.5 py-1.5 transition"
                >
                  Guest view
                </Link>
                <button
                  onClick={() => handleForget(w.id)}
                  className="text-xs text-white/40 hover:text-rose-300 px-1"
                  aria-label="Forget wheel"
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
