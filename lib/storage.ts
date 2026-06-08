"use client";

// All "ownership" lives in the browser since there's no login:
//  - the wheels this device created (id + secret admin token), for the dashboard
//  - the item ids this device submitted, so we can tell when *we* win

const WHEELS_KEY = "choicewheel:wheels";
const SUBMITTED_KEY = "choicewheel:submitted";

export type SavedWheel = {
  id: string;
  adminToken: string;
  title: string;
  createdAt: number;
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full / disabled — non-fatal
  }
}

export function getMyWheels(): SavedWheel[] {
  return read<SavedWheel[]>(WHEELS_KEY, []).sort((a, b) => b.createdAt - a.createdAt);
}

export function saveMyWheel(w: SavedWheel) {
  const all = read<SavedWheel[]>(WHEELS_KEY, []).filter((x) => x.id !== w.id);
  all.push(w);
  write(WHEELS_KEY, all);
}

export function updateMyWheelTitle(id: string, title: string) {
  const all = read<SavedWheel[]>(WHEELS_KEY, []).map((w) =>
    w.id === id ? { ...w, title } : w,
  );
  write(WHEELS_KEY, all);
}

export function removeMyWheel(id: string) {
  write(WHEELS_KEY, read<SavedWheel[]>(WHEELS_KEY, []).filter((w) => w.id !== id));
}

export function getAdminToken(id: string): string | null {
  return read<SavedWheel[]>(WHEELS_KEY, []).find((w) => w.id === id)?.adminToken ?? null;
}

type SubmittedMap = Record<string, string[]>;

export function addMySubmittedItem(wheelId: string, itemId: string) {
  const map = read<SubmittedMap>(SUBMITTED_KEY, {});
  const list = map[wheelId] ?? [];
  if (!list.includes(itemId)) list.push(itemId);
  map[wheelId] = list;
  write(SUBMITTED_KEY, map);
}

export function didISubmit(wheelId: string, itemId: string): boolean {
  const map = read<SubmittedMap>(SUBMITTED_KEY, {});
  return (map[wheelId] ?? []).includes(itemId);
}
