"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { WheelExperience } from "@/components/WheelExperience";
import { getItems, getPublicWheel } from "@/lib/api";
import { getAdminToken } from "@/lib/storage";
import type { Item, Wheel } from "@/lib/types";

export default function GuestPage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "missing" }
    | { status: "ready"; wheel: Wheel; items: Item[]; adminToken: string | null }
  >({ status: "loading" });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const wheel = await getPublicWheel(id);
        if (!wheel) {
          if (active) setState({ status: "missing" });
          return;
        }
        const items = await getItems(id);
        if (active) setState({ status: "ready", wheel, items, adminToken: getAdminToken(id) });
      } catch {
        if (active) setState({ status: "missing" });
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  if (state.status === "loading") {
    return <Centered>Loading wheel…</Centered>;
  }
  if (state.status === "missing") {
    return (
      <Centered>
        <p>This wheel doesn&apos;t exist (or was deleted).</p>
        <Link href="/" className="mt-3 inline-block underline text-violet-300">
          Make your own
        </Link>
      </Centered>
    );
  }

  // A draft wheel is hidden from guests, but its creator can still preview it.
  if (!state.wheel.published && !state.adminToken) {
    return (
      <Centered>
        <p>This wheel isn&apos;t live yet.</p>
        <p className="text-sm text-white/40 mt-1">Check back once the organizer publishes it.</p>
        <Link href="/" className="mt-3 inline-block underline text-violet-300">
          Make your own
        </Link>
      </Centered>
    );
  }

  return (
    <main className="flex-1">
      {state.adminToken && (
        <div className="text-center pt-3">
          <Link
            href={`/w/${id}/admin?k=${state.adminToken}`}
            className="text-xs rounded-full bg-violet-500/20 border border-violet-400/30 px-3 py-1 text-violet-200"
          >
            You created this — open creator view
          </Link>
        </div>
      )}
      <WheelExperience mode="guest" initialWheel={state.wheel} initialItems={state.items} />
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center text-center text-white/70 px-4">
      {children}
    </main>
  );
}
