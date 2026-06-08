"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { clearItems, deleteWheel, getClaims, updateWheel } from "@/lib/api";
import { removeMyWheel, updateMyWheelTitle } from "@/lib/storage";
import type { Claim, Item, Wheel } from "@/lib/types";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-3">
      <p className="text-xs uppercase tracking-wide text-white/40 mb-2">{title}</p>
      {children}
    </div>
  );
}

export function AdminPanel({
  wheel,
  items,
  adminToken,
}: {
  wheel: Wheel;
  items: Item[];
  adminToken: string;
}) {
  const router = useRouter();
  // AdminPanel only ever mounts client-side (the page gates on a useEffect fetch),
  // so window is always defined here.
  const guestUrl = typeof window !== "undefined" ? `${window.location.origin}/w/${wheel.id}` : "";
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [title, setTitle] = useState(wheel.title);
  const [minutes, setMinutes] = useState(5);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getClaims(adminToken).then(setClaims).catch(() => {});
  }, [adminToken, wheel.last_spun_at]);

  async function saveTitle() {
    const t = title.trim();
    if (!t || t === wheel.title) return;
    await updateWheel(adminToken, { title: t });
    updateMyWheelTitle(wheel.id, t);
  }

  async function toggleOpen() {
    await updateWheel(adminToken, { submissions_open: !wheel.submissions_open });
  }

  async function startTimer() {
    const deadline = new Date(Date.now() + minutes * 60_000).toISOString();
    await updateWheel(adminToken, { submit_deadline: deadline, submissions_open: true });
  }

  async function clearTimer() {
    await updateWheel(adminToken, { submit_deadline: null });
  }

  async function handleClear() {
    if (!confirm("Remove all items from this wheel?")) return;
    setBusy(true);
    try {
      await clearItems(adminToken);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this wheel permanently? This cannot be undone.")) return;
    setBusy(true);
    try {
      await deleteWheel(adminToken);
      removeMyWheel(wheel.id);
      router.push("/");
    } catch {
      setBusy(false);
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(guestUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="w-full space-y-3">
      <Section title="Share with guests (submit + watch only)">
        <div className="flex gap-2">
          <input
            readOnly
            value={guestUrl}
            className="flex-1 rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm text-white/70"
          />
          <button onClick={copyLink} className="rounded-lg bg-white/10 hover:bg-white/20 px-3 text-sm transition">
            {copied ? "Copied" : "Copy"}
          </button>
          <button onClick={() => setShowQr((v) => !v)} className="rounded-lg bg-white/10 hover:bg-white/20 px-3 text-sm transition">
            QR
          </button>
        </div>
        {showQr && guestUrl && (
          <div className="mt-3 flex justify-center bg-white rounded-lg p-3">
            <QRCodeSVG value={guestUrl} size={160} />
          </div>
        )}
        {!wheel.published && (
          <p className="mt-2 text-xs text-amber-200/80">Publish the wheel above for this link to work for guests.</p>
        )}
      </Section>

      <Section title="Wheel">
        <div className="flex gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            className="flex-1 rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-2 flex gap-2">
          <button onClick={toggleOpen} className="flex-1 rounded-lg bg-white/10 hover:bg-white/20 px-3 py-2 text-sm transition">
            {wheel.submissions_open ? "Close submissions" : "Open submissions"}
          </button>
          <button
            onClick={handleClear}
            disabled={busy || items.length === 0}
            className="rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 px-3 py-2 text-sm transition"
          >
            Clear items
          </button>
        </div>
      </Section>

      <Section title="Submission timer">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={minutes}
            onChange={(e) => setMinutes(Math.max(1, Number(e.target.value)))}
            className="w-20 rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm"
          />
          <span className="text-sm text-white/50">min</span>
          <button onClick={startTimer} className="rounded-lg bg-white/10 hover:bg-white/20 px-3 py-2 text-sm transition">
            Start timer
          </button>
          {wheel.submit_deadline && (
            <button onClick={clearTimer} className="rounded-lg bg-white/10 hover:bg-white/20 px-3 py-2 text-sm transition">
              Clear
            </button>
          )}
        </div>
      </Section>

      {claims.length > 0 && (
        <Section title={`Prize claims (${claims.length})`}>
          <ul className="space-y-2">
            {claims.map((c) => (
              <li key={c.id} className="text-sm rounded-lg bg-black/30 p-2">
                <p className="font-medium">{c.name}</p>
                <p className="text-white/60">{c.email}</p>
                <p className="text-white/60">{c.phone_e164}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <button
        onClick={handleDelete}
        disabled={busy}
        className="w-full rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 text-rose-200 py-2 text-sm transition"
      >
        Delete wheel
      </button>
    </div>
  );
}
