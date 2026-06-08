"use client";

import { useCallback, useEffect, useState } from "react";
import { Wheel } from "@/components/Wheel";
import { WinnerModal } from "@/components/WinnerModal";
import { SubmitForm } from "@/components/SubmitForm";
import { Countdown } from "@/components/Countdown";
import { AdminPanel } from "@/components/AdminPanel";
import { AdminHeader } from "@/components/AdminHeader";
import { SpinBar } from "@/components/SpinBar";
import { useWheel } from "@/lib/useWheel";
import { deleteItem, removeItem, setWinner as persistWinner } from "@/lib/api";
import { didISubmit } from "@/lib/storage";
import type { Item, Wheel as WheelT } from "@/lib/types";

export function WheelExperience({
  mode,
  adminToken,
  initialWheel,
  initialItems,
}: {
  mode: "guest" | "admin";
  adminToken?: string;
  initialWheel: WheelT;
  initialItems: Item[];
}) {
  const { wheel, items, watchers, spin, sendSpin } = useWheel({
    wheelId: initialWheel.id,
    initialWheel,
    initialItems,
  });

  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<Item | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // A second-resolution clock so the submission window flips live as the deadline passes.
  useEffect(() => {
    if (!wheel.submit_deadline) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [wheel.submit_deadline]);

  const deadlinePassed = !!wheel.submit_deadline && now > new Date(wheel.submit_deadline).getTime();
  const windowOpen = wheel.published && wheel.submissions_open && !deadlinePassed;

  // Fired by the Wheel the moment a spin broadcast (incl. our own echo) begins.
  const handleSpinStart = useCallback(() => {
    setWinner(null);
    setSpinning(true);
  }, []);

  const handleSpinEnd = useCallback(
    (w: Item) => {
      setSpinning(false);
      setWinner(w);
      // Elimination mode: the creator's client soft-removes the winner so it can't be
      // picked again. Soft-remove keeps the row, so the winner's claim still works.
      if (mode === "admin" && adminToken && wheel.auto_remove) {
        removeItem(adminToken, w.id).catch(() => {});
      }
    },
    [mode, adminToken, wheel.auto_remove],
  );

  // Admin-only: pick a winner, persist it (gates claims), then broadcast to all viewers.
  const handleSpin = useCallback(async () => {
    if (!adminToken || items.length < 2 || spinning) return;
    const idx = Math.floor(Math.random() * items.length);
    const chosen = items[idx];
    try {
      await persistWinner(adminToken, chosen.id);
    } catch {
      // even if persistence hiccups, still spin; claim gating just won't apply
    }
    sendSpin({ winnerItemId: chosen.id, extraTurns: 5, durationMs: 4500, nonce: Date.now() });
  }, [adminToken, items, spinning, sendSpin]);

  const isAdmin = mode === "admin" && !!adminToken;

  const itemsList =
    items.length > 0 ? (
      <ul className="w-full flex flex-wrap gap-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="cw-slide-in flex items-center gap-2 rounded-full bg-white/5 border border-white/10 pl-2 pr-3 py-1 text-sm"
          >
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: item.color }} />
            <span>{item.label}</span>
            <span className="text-white/40 text-xs">— {item.submitter_name?.trim() || "Anonymous"}</span>
            {isAdmin && (
              <button
                onClick={() => deleteItem(adminToken!, item.id).catch(() => {})}
                className="ml-1 text-white/40 hover:text-rose-300 text-xs leading-none"
                aria-label={`Remove ${item.label}`}
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>
    ) : null;

  const addForm = (
    <SubmitForm
      wheelId={wheel.id}
      disabled={!windowOpen}
      adminToken={isAdmin ? adminToken : undefined}
      existingLabels={items.map((i) => i.label)}
    />
  );

  const headerBlock = (
    <header className="w-full text-center">
      <h1 className="text-2xl font-bold">
        {wheel.title}
        {!wheel.published && (
          <span className="ml-2 align-middle text-xs font-semibold uppercase tracking-wide rounded-full bg-amber-400/20 border border-amber-300/40 text-amber-200 px-2 py-0.5">
            Draft
          </span>
        )}
      </h1>
      <div className="mt-1 flex items-center justify-center gap-3 text-sm text-white/55">
        <span>👀 {watchers} watching</span>
        <span aria-hidden>·</span>
        <span>
          {items.length} on the wheel
          {wheel.total_submissions > items.length && ` · ${wheel.total_submissions} all-time`}
        </span>
      </div>
      {wheel.submit_deadline && (
        <div className="mt-1 text-sm">
          <Countdown deadline={wheel.submit_deadline} />
        </div>
      )}
    </header>
  );

  // The wheel is the hero: header + wheel + (admin) SPIN. Reused by both layouts.
  const wheelHero = (
    <>
      {headerBlock}
      <Wheel items={items} spin={spin} onSpinStart={handleSpinStart} onSpinEnd={handleSpinEnd} />
      {isAdmin && (
        <SpinBar wheel={wheel} items={items} adminToken={adminToken!} spinning={spinning} onSpin={handleSpin} />
      )}
    </>
  );

  return (
    <div className="w-full max-w-md lg:max-w-5xl mx-auto px-4">
      {isAdmin && <AdminHeader wheel={wheel} adminToken={adminToken!} />}

      {isAdmin ? (
        // Desktop: wheel hero on the left, one control panel on the right.
        // Mobile: stacks — wheel + SPIN, then the panel (add form first).
        <div className="py-6 lg:grid lg:grid-cols-[1fr_minmax(0,420px)] lg:gap-8 lg:items-start">
          <div className="flex flex-col items-center gap-5 lg:sticky lg:top-20">{wheelHero}</div>
          <div className="mt-6 lg:mt-0 flex flex-col gap-4">
            {addForm}
            {itemsList}
            <AdminPanel wheel={wheel} items={items} adminToken={adminToken!} />
          </div>
        </div>
      ) : (
        <div className="py-6 max-w-md mx-auto flex flex-col items-center gap-5">
          {wheelHero}
          <div className="w-full flex flex-col gap-4">
            {addForm}
            {itemsList}
          </div>
        </div>
      )}

      {winner && (
        <WinnerModal winner={winner} isMine={didISubmit(wheel.id, winner.id)} onClose={() => setWinner(null)} />
      )}
    </div>
  );
}
