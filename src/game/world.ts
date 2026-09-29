import {
  BG,
  T,
  TILE,
  WORLD_H,
  WORLD_W,
  hash2,
  idx,
  inBounds,
  isLight,
  isOpaque,
  isSolid,
} from "./content";

export type WorldData = {
  seed: number;
  fg: Uint8Array;
  bg: Uint8Array;
  light: Uint8Array;
  /** 1 if this cell has open sky straight above. */
  sky: Uint8Array;
  surface: Int16Array;
  spawnX: number;
  spawnFeet: number;
};

function noise1(x: number, seed: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash2(i, 0, seed) * (1 - u) + hash2(i + 1, 0, seed) * u;
}

function tryTree(fg: Uint8Array, surface: Int16Array, x: number, seed: number): boolean {
  if (x < 3 || x >= WORLD_W - 3) return false;
  const s = surface[x];
  if (fg[idx(x, s)] !== T.GRASS) return false;
  for (let dx = -4; dx <= 4; dx++) {
    const nx = x + dx;
    if (nx < 0 || nx >= WORLD_W) continue;
    if (s - 1 > 0 && fg[idx(nx, s - 1)] === T.LOG) return false;
  }
  const h = 4 + Math.floor(hash2(x, 7, seed) * 3);
  if (s - h - 2 < 2) return false;
  for (let i = 1; i <= h + 2; i++) {
    if (fg[idx(x, s - i)] !== T.AIR) return false;
  }
  for (let i = 1; i <= h; i++) fg[idx(x, s - i)] = T.LOG;
  const top = s - h;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > 3) continue;
      const tx = x + dx;
      const ty = top + dy;
      if (!inBounds(tx, ty)) continue;
      if (fg[idx(tx, ty)] === T.AIR) fg[idx(tx, ty)] = T.LEAVES;
    }
  }
  fg[idx(x, top)] = T.LOG;
  return true;
}

function blob(fg: Uint8Array, cx: number, cy: number, r: number, tile: number) {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (!inBounds(x, y)) continue;
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) > r * r + 0.2) continue;
      if (fg[idx(x, y)] === T.STONE) fg[idx(x, y)] = tile;
    }
  }
}

function carveRoom(fg: Uint8Array, bg: Uint8Array, cx: number, cy: number) {
  for (let y = cy - 2; y <= cy + 1; y++) {
    for (let x = cx - 3; x <= cx + 3; x++) {
      if (!inBounds(x, y)) continue;
      const edge = Math.abs(x - cx) === 3 || y === cy - 2 || y === cy + 1;
      if (edge) {
        if (fg[idx(x, y)] === T.AIR) fg[idx(x, y)] = T.STONE;
        continue;
      }
      fg[idx(x, y)] = T.AIR;
      if (bg[idx(x, y)] === BG.NONE) bg[idx(x, y)] = BG.STONE;
    }
  }
  if (inBounds(cx, cy)) fg[idx(cx, cy)] = T.CHEST;
}

export function generateWorld(seedIn: number): WorldData {
  const seed = (seedIn >>> 0) || 1;
  const fg = new Uint8Array(WORLD_W * WORLD_H);
  const bg = new Uint8Array(WORLD_W * WORLD_H);
  const light = new Uint8Array(WORLD_W * WORLD_H);
  const sky = new Uint8Array(WORLD_W * WORLD_H);
  const surface = new Int16Array(WORLD_W);
  const spawnX = 118;

  for (let x = 0; x < WORLD_W; x++) {
    const n = noise1(x * 0.075, seed) * 8 + noise1(x * 0.02, seed + 41) * 11;
    let s = Math.round(32 + n);
    if (s < 20) s = 20;
    if (s > 46) s = 46;
    surface[x] = s;
  }
  for (let pass = 0; pass < 2; pass++) {
    const next = new Int16Array(WORLD_W);
    for (let x = 0; x < WORLD_W; x++) {
      const a = surface[Math.max(0, x - 1)];
      const b = surface[x];
      const c = surface[Math.min(WORLD_W - 1, x + 1)];
      next[x] = Math.round((a + b * 2 + c) / 4);
    }
    surface.set(next);
  }
  const pad = surface[spawnX];
  for (let x = spawnX - 4; x <= spawnX + 4; x++) surface[x] = pad;

  for (let x = 0; x < WORLD_W; x++) {
    const s = surface[x];
    const dirtDepth = 5 + Math.floor(hash2(x, 2, seed) * 4);
    for (let y = 0; y < WORLD_H; y++) {
      const i = idx(x, y);
      if (y < s) {
        fg[i] = T.AIR;
        bg[i] = BG.NONE;
      } else if (y === s) {
        fg[i] = T.GRASS;
        bg[i] = BG.NONE;
      } else if (y < s + dirtDepth) {
        fg[i] = T.DIRT;
        bg[i] = BG.DIRT;
      } else {
        fg[i] = T.STONE;
        bg[i] = BG.STONE;
      }
    }
    fg[idx(x, WORLD_H - 1)] = T.STONE;
  }

  // Caves — keep a crust, and don't hollow the spawn porch.
  for (let c = 0; c < 9; c++) {
    let x = 6 + Math.floor(hash2(c, 1, seed) * (WORLD_W - 12));
    let y = 52 + Math.floor(hash2(c, 2, seed) * 28);
    const len = 36 + Math.floor(hash2(c, 3, seed) * 48);
    for (let k = 0; k < len; k++) {
      const r = 1 + (hash2(c, k, seed + 5) > 0.7 ? 2 : 1);
      for (let oy = -r; oy <= r; oy++) {
        for (let ox = -r; ox <= r; ox++) {
          if (ox * ox + oy * oy > r * r + 1) continue;
          const tx = x + ox;
          const ty = y + oy;
          if (!inBounds(tx, ty) || ty <= 2 || ty >= WORLD_H - 2) continue;
          if (ty < surface[tx] + 6) continue;
          if (Math.abs(tx - spawnX) < 12 && ty < surface[tx] + 14) continue;
          fg[idx(tx, ty)] = T.AIR;
          if (bg[idx(tx, ty)] === BG.NONE) bg[idx(tx, ty)] = BG.STONE;
        }
      }
      x += Math.floor(hash2(c, k, seed + 8) * 3) - 1;
      y += Math.floor(hash2(c, k, seed + 9) * 3) - 1;
      if (x < 4) x = 4;
      if (x > WORLD_W - 5) x = WORLD_W - 5;
      const minY = surface[Math.max(0, Math.min(WORLD_W - 1, x))] + 7;
      if (y < minY) y = minY;
      if (y > WORLD_H - 4) y = WORLD_H - 4;
    }
  }

  for (let y = 0; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      if (fg[idx(x, y)] !== T.STONE) continue;
      const h = hash2(x, y, seed + 3);
      const depth = y - surface[x];
      if (depth > 8 && h < 0.055) fg[idx(x, y)] = T.COAL;
      else if (depth > 12 && h > 0.972) fg[idx(x, y)] = T.COPPER;
    }
  }

  blob(fg, spawnX + 6, surface[Math.min(WORLD_W - 1, spawnX + 6)] + 8, 2, T.COAL);
  blob(fg, spawnX - 14, surface[Math.max(0, spawnX - 14)] + 11, 2, T.COAL);

  for (let x = 4; x < WORLD_W - 4; x++) {
    if (hash2(x, 3, seed) > 0.2) continue;
    tryTree(fg, surface, x, seed);
  }
  for (const dx of [-24, -16, -8, 9, 17, 26, 35]) {
    tryTree(fg, surface, spawnX + dx, seed);
  }

  for (const x of [spawnX - 1, spawnX, spawnX + 1]) {
    const s = surface[x];
    for (let y = 0; y < s; y++) {
      const t = fg[idx(x, y)];
      if (t === T.LOG || t === T.LEAVES) fg[idx(x, y)] = T.AIR;
    }
  }

  const chestX = Math.min(WORLD_W - 8, spawnX + 28);
  carveRoom(fg, bg, chestX, surface[chestX] + 10);

  const spawnFeet = surface[spawnX] * TILE;
  recomputeLight({ fg, light, sky }, 230);

  return { seed, fg, bg, light, sky, surface, spawnX, spawnFeet };
}

export function recomputeLight(
  world: { fg: Uint8Array; light: Uint8Array; sky: Uint8Array },
  ambient: number,
): void {
  const { fg, light, sky } = world;
  light.fill(0);
  sky.fill(0);
  const sun = Math.max(0, Math.min(255, ambient));
  for (let x = 0; x < WORLD_W; x++) {
    let open = true;
    let bleed = 0;
    for (let y = 0; y < WORLD_H; y++) {
      const i = idx(x, y);
      const tile = fg[i];
      if (open) sky[i] = 1;
      if (open) light[i] = sun;
      else if (bleed > 0) light[i] = Math.max(light[i], bleed);
      if (tile === T.GLASS) {
        light[i] = Math.max(light[i], (sun * 0.72) | 0);
        open = false;
        bleed = (sun * 0.45) | 0;
      } else if (isOpaque(tile)) {
        open = false;
        bleed = 0;
      } else if (!open) {
        bleed = (bleed * 0.78) | 0;
      }
    }
  }

  const seeds: { i: number; rad: number }[] = [];
  for (let i = 0; i < fg.length; i++) {
    const rad = isLight(fg[i]);
    if (rad > 0) seeds.push({ i, rad });
  }
  const qx: number[] = [];
  const qy: number[] = [];
  const qd: number[] = [];
  for (const s of seeds) {
    const x = s.i % WORLD_W;
    const y = (s.i / WORLD_W) | 0;
    qx.push(x);
    qy.push(y);
    qd.push(0);
    const add = 255;
    if (light[s.i] < add) light[s.i] = add;
    const maxR = s.rad;
    let head = qx.length - 1;
    const seen = new Uint8Array(fg.length);
    seen[s.i] = 1;
    while (head < qx.length) {
      const cx = qx[head];
      const cy = qy[head];
      const cd = qd[head];
      head++;
      if (cd >= maxR) continue;
      const next = 255 - ((cd + 1) * 255) / maxR;
      const dirs = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      for (const [dx, dy] of dirs) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (!inBounds(nx, ny)) continue;
        const ni = idx(nx, ny);
        if (seen[ni]) continue;
        if (isOpaque(fg[ni])) continue;
        seen[ni] = 1;
        if (light[ni] < next) light[ni] = next;
        qx.push(nx);
        qy.push(ny);
        qd.push(cd + 1);
      }
    }
  }
}

export function lightAt(world: WorldData, px: number, py: number): number {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  if (!inBounds(tx, ty)) return 0;
  return world.light[idx(tx, ty)] / 255;
}
