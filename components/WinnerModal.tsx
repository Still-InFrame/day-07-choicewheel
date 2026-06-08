"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";
import type { Item } from "@/lib/types";
import { ClaimForm } from "@/components/ClaimForm";
import { playCheer } from "@/lib/sound";

function fireConfetti() {
  const end = Date.now() + 1200;
  const colors = ["#8b7bff", "#ff7bd5", "#7bffd0", "#ffd97b", "#7bb8ff"];
  (function frame() {
    confetti({ particleCount: 5, angle: 60, spread: 70, origin: { x: 0 }, colors });
    confetti({ particleCount: 5, angle: 120, spread: 70, origin: { x: 1 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
  confetti({ particleCount: 140, spread: 90, origin: { y: 0.6 }, colors });
}

export function WinnerModal({
  winner,
  isMine,
  onClose,
}: {
  winner: Item;
  isMine: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    fireConfetti();
    playCheer();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="cw-pop w-full max-w-sm rounded-2xl bg-[#15152a] border border-white/10 shadow-2xl p-6 text-center">
        <p className="text-sm uppercase tracking-widest text-white/50">Winner</p>
        <div
          className="mx-auto mt-3 mb-1 inline-flex items-center justify-center rounded-xl px-5 py-3 text-2xl font-bold"
          style={{ background: winner.color }}
        >
          {winner.label}
        </div>
        <p className="text-sm text-white/60 mt-2">
          submitted by{" "}
          <span className="font-medium text-white/90">
            {winner.submitter_name?.trim() || "Anonymous"}
          </span>
        </p>

        {isMine ? (
          <ClaimForm itemId={winner.id} onDone={onClose} />
        ) : (
          <button
            onClick={onClose}
            className="mt-5 w-full rounded-lg bg-white/10 hover:bg-white/20 font-semibold py-2.5 transition"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}
