import { TILE, WORLD_H, WORLD_W, idx, inBounds, isSolid } from "./content";

const MAX_ROOM = 120;
const MIN_ROOM = 8;

export type Shelter = { enclosed: boolean; tooBig: boolean; count: number };

/**
 * Flood air from the player's body. A room counts when the flood stays
 * small and never reaches the map edge — a sealed hut or a walled pocket.
 */
export function shelterAt(fg: Uint8Array, feetX: number, feetY: number): Shelter {
  let tx = Math.floor(feetX / TILE);
  let ty = Math.floor((feetY - 10) / TILE);
  if (!inBounds(tx, ty)) return { enclosed: false, tooBig: false, count: 0 };
  if (isSolid(fg[idx(tx, ty)])) {
    const up = ty - 1;
    if (inBounds(tx, up) && !isSolid(fg[idx(tx, up)])) ty = up;
    else return { enclosed: false, tooBig: false, count: 0 };
  }

  const seen = new Uint8Array(fg.length);
  const q: number[] = [idx(tx, ty)];
  seen[q[0]] = 1;
  let count = 0;
  let escaped = false;

  while (q.length) {
    const i = q.pop() as number;
    const x = i % WORLD_W;
    const y = (i / WORLD_W) | 0;
    count++;
    if (count > MAX_ROOM) return { enclosed: false, tooBig: true, count };
    if (x <= 1 || x >= WORLD_W - 2 || y <= 1 || y >= WORLD_H - 2) escaped = true;
    const nbs = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    for (const [nx, ny] of nbs) {
      if (!inBounds(nx, ny)) {
        escaped = true;
        continue;
      }
      const ni = idx(nx, ny);
      if (seen[ni]) continue;
      if (isSolid(fg[ni])) continue;
      seen[ni] = 1;
      q.push(ni);
    }
  }

  return { enclosed: !escaped && count >= MIN_ROOM, tooBig: false, count };
}
