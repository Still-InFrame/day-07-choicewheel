"use client";

import { useState } from "react";
import { adminAddItem, submitItem } from "@/lib/api";
import { addMySubmittedItem } from "@/lib/storage";
import { findSimilarLabel } from "@/lib/dedup";

// Add-item form. Two modes:
//  - guest (no adminToken): calls submit_item, window-gated, records the id locally so
//    we know if this device wins.
//  - creator (adminToken): calls admin_add_item, always enabled, not recorded as "mine"
//    (creator-seeded items don't trigger the personal claim flow).
export function SubmitForm({
  wheelId,
  disabled,
  adminToken,
  existingLabels = [],
}: {
  wheelId: string;
  disabled: boolean;
  adminToken?: string;
  existingLabels?: string[];
}) {
  const [label, setLabel] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // The label the user has been warned is similar — a 2nd Add with the same text adds it anyway.
  const [confirmFor, setConfirmFor] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isCreator = !!adminToken;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed || submitting) return;
    setError(null);
    setNotice(null);

    // 1. Exact (case-insensitive) duplicate — hard block. Server enforces this too.
    if (existingLabels.some((l) => l.toLowerCase() === trimmed.toLowerCase())) {
      setNotice(`"${trimmed}" is already on the wheel 👀`);
      return;
    }

    // 2. Fuzzy near-duplicate — soft warning. A 2nd Add with the same text overrides.
    if (confirmFor !== trimmed.toLowerCase()) {
      const similar = findSimilarLabel(trimmed, existingLabels);
      if (similar) {
        setNotice(`Looks a lot like "${similar}" already on the wheel — tap Add again to add it anyway.`);
        setConfirmFor(trimmed.toLowerCase());
        return;
      }
    }

    setSubmitting(true);
    try {
      if (isCreator) {
        await adminAddItem(adminToken!, trimmed, name);
      } else {
        const item = await submitItem(wheelId, trimmed, name);
        addMySubmittedItem(wheelId, item.id);
      }
      setLabel("");
      setConfirmFor(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not add item";
      if (msg.includes("already on the wheel")) setNotice(msg);
      else setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  // Only guests get locked out by the submission window; the creator can always add.
  if (disabled && !isCreator) {
    return (
      <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center text-white/60 text-sm">
        Submissions are closed for this wheel.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <input
        value={label}
        onChange={(e) => {
          setLabel(e.target.value);
          if (notice) setNotice(null);
          if (error) setError(null);
          if (confirmFor) setConfirmFor(null);
        }}
        maxLength={60}
        placeholder={isCreator ? "Add your own item…" : "Add an item to the wheel…"}
        className="w-full rounded-lg bg-white/5 border border-white/15 px-3 py-2.5 outline-none focus:border-violet-400"
      />
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder={isCreator ? "Attribute to (optional)" : "Your name (optional)"}
          className="flex-1 rounded-lg bg-white/5 border border-white/15 px-3 py-2.5 outline-none focus:border-violet-400 text-sm"
        />
        <button
          type="submit"
          disabled={!label.trim() || submitting}
          className="rounded-lg bg-violet-500 hover:bg-violet-400 disabled:opacity-40 font-semibold px-5 transition"
        >
          {submitting ? "…" : "Add"}
        </button>
      </div>
      {notice && <p className="text-sm text-amber-200">{notice}</p>}
      {error && <p className="text-sm text-rose-300">{error}</p>}
    </form>
  );
}
