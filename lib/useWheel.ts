"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Item, SpinSignal, Wheel } from "@/lib/types";

// Joins the shared `wheel:<id>` Realtime channel and keeps wheel + items live for
// every viewer (creator and guests). Also carries the synced spin broadcast and a
// presence-based "watching" count.
export function useWheel(opts: { wheelId: string; initialWheel: Wheel; initialItems: Item[] }) {
  const { wheelId } = opts;
  const [wheel, setWheel] = useState<Wheel>(opts.initialWheel);
  const [items, setItems] = useState<Item[]>(opts.initialItems);
  const [watchers, setWatchers] = useState(1);
  const [spin, setSpin] = useState<SpinSignal | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const sb = createClient();
    const channel = sb.channel(`wheel:${wheelId}`, {
      config: { broadcast: { self: true }, presence: { key: crypto.randomUUID() } },
    });
    channelRef.current = channel;

    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "choicewheel_items", filter: `wheel_id=eq.${wheelId}` },
        (payload) => {
          const item = payload.new as Item;
          setItems((prev) => (prev.some((i) => i.id === item.id) ? prev : [...prev, item]));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "choicewheel_items", filter: `wheel_id=eq.${wheelId}` },
        (payload) => {
          const old = payload.old as { id: string };
          setItems((prev) => prev.filter((i) => i.id !== old.id));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "choicewheel_wheels", filter: `id=eq.${wheelId}` },
        (payload) => setWheel(payload.new as Wheel),
      )
      .on("broadcast", { event: "spin" }, ({ payload }) => setSpin(payload as SpinSignal))
      .on("presence", { event: "sync" }, () => {
        const count = Object.keys(channel.presenceState()).length;
        setWatchers(count || 1);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") channel.track({ joined_at: Date.now() });
      });

    return () => {
      sb.removeChannel(channel);
      channelRef.current = null;
    };
  }, [wheelId]);

  const sendSpin = useCallback((signal: SpinSignal) => {
    channelRef.current?.send({ type: "broadcast", event: "spin", payload: signal });
  }, []);

  return { wheel, items, watchers, spin, sendSpin, setWheel, setItems };
}
