"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { WheelExperience } from "@/components/WheelExperience";
import { getItems, getWheelByToken } from "@/lib/api";
import { getAdminToken, saveMyWheel } from "@/lib/storage";
import type { Item, Wheel } from "@/lib/types";

export default function AdminPage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "denied" }
    | { status: "ready"; wheel: Wheel; items: Item[]; token: string }
  >({ status: "loading" });

  useEffect(() => {
    let active = true;
    (async () => {
      // token comes from the URL (?k=) on first visit, then from this device thereafter
      const urlToken = new URLSearchParams(window.location.search).get("k");
      const token = urlToken || getAdminToken(id);
      if (!token) {
        if (active) setState({ status: "denied" });
        return;
      }
      try {
        const wheel = await getWheelByToken(token);
        const items = await getItems(wheel.id);
        saveMyWheel({ id: wheel.id, adminToken: token, title: wheel.title, createdAt: Date.now() });
        if (active) setState({ status: "ready", wheel, items, token });
      } catch {
        if (active) setState({ status: "denied" });
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  if (state.status === "loading") {
    return <Centered>Loading…</Centered>;
  }
  if (state.status === "denied") {
    return (
      <Centered>
        <p>You don&apos;t have the creator key for this wheel on this device.</p>
        <Link href={`/w/${id}`} className="mt-3 inline-block underline text-violet-300">
          Open the guest view instead
        </Link>
      </Centered>
    );
  }

  return (
    <main className="flex-1">
      <WheelExperience
        mode="admin"
        adminToken={state.token}
        initialWheel={state.wheel}
        initialItems={state.items}
      />
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
