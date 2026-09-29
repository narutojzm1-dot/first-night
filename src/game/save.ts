import { ITEM_IDS, isKnownItem, type ItemId } from "./content";

export const SAVE_KEY = "first-night-v1";
const MUTE_KEY = "first-night-mute";

export type SaveData = {
  v: 1;
  seed: number;
  fg: string;
  bg: string;
  x: number;
  y: number;
  hp: number;
  time: number;
  survived: boolean;
  endured: boolean;
  inv: Partial<Record<ItemId, number>>;
  hotbar: (ItemId | null)[];
  selected: number;
  opened: number[];
  banner: "haven" | "endured" | null;
};

export function readMute(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeMute(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* ignore quota */
  }
}

export function hasSave(): boolean {
  try {
    return !!localStorage.getItem(SAVE_KEY);
  } catch {
    return false;
  }
}

export function readSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (data.v !== 1 || typeof data.fg !== "string" || typeof data.seed !== "number") return null;
    const inv: Partial<Record<ItemId, number>> = {};
    for (const id of ITEM_IDS) {
      const n = data.inv?.[id];
      if (typeof n === "number" && n > 0) inv[id] = Math.floor(n);
    }
    const hotbar = Array.from({ length: 8 }, (_, i) => {
      const id = data.hotbar?.[i];
      return id && isKnownItem(id) ? id : null;
    });
    return { ...data, inv, hotbar };
  } catch {
    return null;
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

export function u8ToB64(u: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < u.length; i += chunk) {
    s += String.fromCharCode(...u.subarray(i, Math.min(u.length, i + chunk)));
  }
  return btoa(s);
}

export function b64ToU8(s: string, size: number): Uint8Array | null {
  try {
    const bin = atob(s);
    if (bin.length !== size) return null;
    const out = new Uint8Array(size);
    for (let i = 0; i < size; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}
