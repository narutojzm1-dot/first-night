import { NIGHT_AT, T, TILE, WORLD_H, WORLD_W, hash2, idx, inBounds } from "./content";
import { bgSprite, tileSprite } from "./atlas";
import type { Engine, Mob } from "./engine";

function mix(a: string, b: string, t: number): string {
  const pa = hex(a);
  const pb = hex(b);
  const u = Math.max(0, Math.min(1, t));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * u));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function hex(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function skyColor(time: number): { top: string; bot: string; u: number } {
  const u = Math.max(0, Math.min(1, time / NIGHT_AT));
  const stops = [
    { u: 0, top: "#6eb6e0", bot: "#d7eef8" },
    { u: 0.62, top: "#e2884a", bot: "#f3c59a" },
    { u: 0.82, top: "#5c3458", bot: "#e08a55" },
    { u: 1, top: "#0e1224", bot: "#1a2038" },
  ];
  let i = 0;
  while (i < stops.length - 2 && u > stops[i + 1].u) i++;
  const a = stops[i];
  const b = stops[i + 1];
  const t = (u - a.u) / (b.u - a.u || 1);
  return { top: mix(a.top, b.top, t), bot: mix(a.bot, b.bot, t), u };
}

export function renderFrame(canvas: HTMLCanvasElement, game: Engine) {
  const cssW = canvas.clientWidth || game.view.cssW || 390;
  const cssH = canvas.clientHeight || game.view.cssH || 700;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const scale = cssW < 900 ? 2 : 3;
  game.view.cssW = cssW;
  game.view.cssH = cssH;
  game.view.scale = scale;
  game.view.dpr = dpr;
  const bw = Math.max(1, Math.floor(cssW * dpr));
  const bh = Math.max(1, Math.floor(cssH * dpr));
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;

  const time = game.displayTime();
  const sky = skyColor(time);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const grad = ctx.createLinearGradient(0, 0, 0, cssH);
  grad.addColorStop(0, sky.top);
  grad.addColorStop(1, sky.bot);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cssW, cssH);

  if (sky.u > 0.45) {
    ctx.globalAlpha = Math.min(1, (sky.u - 0.45) / 0.4);
    ctx.fillStyle = "#f4e7cb";
    for (let i = 0; i < 40; i++) {
      const sx = hash2(i, 1, game.world.seed) * cssW;
      const sy = hash2(i, 2, game.world.seed) * cssH * 0.55;
      const s = hash2(i, 3, game.world.seed) > 0.8 ? 2 : 1;
      ctx.fillRect(sx, sy, s, s);
    }
    ctx.globalAlpha = 1;
  }

  drawHills(ctx, cssW, cssH, game, sky.u);
  drawSun(ctx, cssW, cssH, sky.u, game.age);

  const shake = game.trauma * game.trauma;
  const ox = Math.sin(game.age * 47) * 5 * shake;
  const oy = Math.cos(game.age * 41) * 4 * shake;
  const camX = game.camX + ox;
  const camY = game.camY + oy;
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, -camX * dpr * scale, -camY * dpr * scale);

  const x0 = Math.max(0, Math.floor(camX / TILE) - 1);
  const y0 = Math.max(0, Math.floor(camY / TILE) - 1);
  const x1 = Math.min(WORLD_W - 1, Math.ceil((camX + cssW / scale) / TILE) + 1);
  const y1 = Math.min(WORLD_H - 1, Math.ceil((camY + cssH / scale) / TILE) + 1);
  const fg = game.world.fg;
  const bg = game.world.bg;
  const light = game.world.light;
  const skyMask = game.world.sky;

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = idx(x, y);
      const tile = fg[i];
      const px = x * TILE;
      const py = y * TILE;
      if (tile === T.AIR || !isOpaqueEnough(tile)) {
        if (!skyMask[i]) {
          const wall = bg[i] === 2 ? 2 : bg[i] === 1 ? 1 : 3;
          ctx.drawImage(bgSprite(wall), px, py);
        }
      }
      if (tile !== T.AIR) {
        const v = (hash2(x, y, 9) * 3) | 0;
        ctx.drawImage(tileSprite(tile, v), px, py);
        if (tile === T.TORCH || tile === T.CAMP || tile === T.LAMP) drawFlame(ctx, px, py, game.age, tile);
        if (tile === T.CHEST && game.opened.has(i)) {
          ctx.fillStyle = "#1a140f";
          ctx.fillRect(px + 4, py + 8, 8, 3);
        }
      }
    }
  }

  for (const m of game.mobs) drawMob(ctx, m, game.age);

  for (const p of game.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = idx(x, y);
      const darkness = 1 - light[i] / 255;
      if (darkness < 0.05) continue;
      ctx.fillStyle = `rgba(6,8,18,${darkness * 0.94})`;
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
  }

  ctx.globalCompositeOperation = "lighter";
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const tile = fg[idx(x, y)];
      if (tile !== T.TORCH && tile !== T.CAMP && tile !== T.LAMP) continue;
      const flick = 0.75 + Math.sin(game.age * 14 + x) * 0.25;
      const rad = (tile === T.CAMP ? 36 : 28) * flick;
      const g = ctx.createRadialGradient(x * TILE + 8, y * TILE + 6, 1, x * TILE + 8, y * TILE + 6, rad);
      g.addColorStop(0, "rgba(255,196,90,0.45)");
      g.addColorStop(1, "rgba(255,140,40,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x * TILE + 8 - rad, y * TILE + 6 - rad, rad * 2, rad * 2);
    }
  }
  ctx.globalCompositeOperation = "source-over";

  drawPlayer(ctx, game);
  if (game.swing > 0 && game.mode === "play") {
    ctx.strokeStyle = "rgba(244,231,203,0.9)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    const sx = game.x + game.facing * 10;
    const sy = game.y - 12;
    ctx.arc(sx, sy, 12, game.facing > 0 ? -1.2 : Math.PI - 1.2, game.facing > 0 ? 1 : Math.PI + 1);
    ctx.stroke();
  }

  if (game.mode === "play" && game.placeOk) {
    ctx.fillStyle = "rgba(232,162,58,0.38)";
    ctx.strokeStyle = "#e8a23a";
    ctx.lineWidth = 1;
    for (const cell of game.placeCells) {
      ctx.fillRect(cell.x * TILE, cell.y * TILE, TILE, TILE);
      ctx.strokeRect(cell.x * TILE + 0.5, cell.y * TILE + 0.5, TILE - 1, TILE - 1);
    }
  }

  if (game.mode === "play" && game.aimOk && inBounds(game.aimTx, game.aimTy)) {
    const aimed = game.world.fg[idx(game.aimTx, game.aimTy)];
    const showMine = aimed !== T.AIR && aimed !== T.CHEST && (game.mineProg > 0 || !game.placeOk);
    if (showMine) {
      ctx.strokeStyle = game.mineProg > 0 ? "#f4e7cb" : "rgba(244,231,203,0.75)";
      ctx.lineWidth = 1;
      ctx.strokeRect(game.aimTx * TILE + 0.5, game.aimTy * TILE + 0.5, TILE - 1, TILE - 1);
      if (game.mineProg > 0) {
        ctx.strokeStyle = "rgba(20,16,12,0.75)";
        const cracks = Math.ceil(game.mineProg * 3);
        ctx.beginPath();
        if (cracks >= 1) {
          ctx.moveTo(game.aimTx * TILE + 3, game.aimTy * TILE + 4);
          ctx.lineTo(game.aimTx * TILE + 8, game.aimTy * TILE + 9);
        }
        if (cracks >= 2) {
          ctx.moveTo(game.aimTx * TILE + 12, game.aimTy * TILE + 3);
          ctx.lineTo(game.aimTx * TILE + 7, game.aimTy * TILE + 10);
        }
        if (cracks >= 3) {
          ctx.moveTo(game.aimTx * TILE + 5, game.aimTy * TILE + 13);
          ctx.lineTo(game.aimTx * TILE + 13, game.aimTy * TILE + 8);
        }
        ctx.stroke();
      }
    }
  }

  ctx.font = '8px "Noto Sans SC", sans-serif';
  ctx.textAlign = "center";
  for (const f of game.floats) {
    ctx.globalAlpha = Math.max(0, f.life);
    ctx.fillStyle = "#1a140f";
    ctx.fillText(f.text, f.x + 1, f.y + 1);
    ctx.fillStyle = "#f4e7cb";
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;

  if (sky.u > 0.75 && game.mode === "play") {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const vig = ctx.createRadialGradient(cssW / 2, cssH / 2, cssH * 0.2, cssW / 2, cssH / 2, cssH * 0.72);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, `rgba(4,6,16,${(sky.u - 0.75) * 1.3})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, cssW, cssH);
  }
}

function isOpaqueEnough(tile: number): boolean {
  return tile !== T.AIR && tile !== T.TORCH && tile !== T.CAMP && tile !== T.LAMP && tile !== T.RUG && tile !== T.LEAVES;
}

function drawFlame(ctx: CanvasRenderingContext2D, px: number, py: number, age: number, tile: number) {
  const flick = Math.sin(age * 18 + px) > 0 ? 0 : 1;
  ctx.fillStyle = flick ? "#f4e7cb" : "#f2c14e";
  if (tile === T.TORCH) ctx.fillRect(px + 7, py + 1 - flick, 2, 3);
  else if (tile === T.CAMP) ctx.fillRect(px + 7, py + 2 - flick, 2, 3);
  else ctx.fillRect(px + 7, py + 4, 2, 2);
}

function drawHills(ctx: CanvasRenderingContext2D, w: number, h: number, game: Engine, u: number) {
  const base = u > 0.8 ? "#121628" : u > 0.6 ? "#6a3a48" : "#3e6d86";
  const far = u > 0.8 ? "#1a2036" : u > 0.6 ? "#8a4a48" : "#5e8ea4";
  const shift = game.camX * 0.15;
  ctx.fillStyle = far;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.62);
  for (let x = 0; x <= w; x += 16) {
    const n = Math.sin((x + shift) * 0.01) * 18 + Math.sin((x + shift) * 0.02) * 8;
    ctx.lineTo(x, h * 0.48 + n);
  }
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.72);
  const shift2 = game.camX * 0.28;
  for (let x = 0; x <= w; x += 12) {
    const n = Math.sin((x + shift2) * 0.016) * 22;
    ctx.lineTo(x, h * 0.58 + n);
  }
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();
}

function drawSun(ctx: CanvasRenderingContext2D, w: number, h: number, u: number, age: number) {
  const x = w * (0.14 + 0.72 * Math.min(1, u));
  const y = h * (0.28 - Math.sin(Math.min(1, u) * Math.PI) * 0.16);
  if (u < 0.92) {
    ctx.fillStyle = u > 0.7 ? "#f2c14e" : "#fff4d2";
    ctx.globalAlpha = 1 - Math.max(0, u - 0.75) * 4;
    ctx.beginPath();
    ctx.arc(x, y, u > 0.65 ? 16 : 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (u > 0.55) {
    ctx.globalAlpha = Math.min(1, (u - 0.55) / 0.35);
    ctx.fillStyle = "#f4e7cb";
    const mx = w * (0.2 + (1 - u) * 0.3);
    const my = h * 0.18 + Math.sin(age * 0.2) * 2;
    ctx.beginPath();
    ctx.arc(mx, my, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d9d0bc";
    ctx.beginPath();
    ctx.arc(mx + 4, my - 2, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, game: Engine) {
  const body = (ox: number, oy: number, ink: string | null) => {
    ctx.save();
    ctx.translate(Math.round(game.x) + ox, Math.round(game.y) + oy);
    ctx.scale(game.facing, 1);
    const stretch = game.vy < -40 ? -0.12 : game.squash;
    ctx.translate(0, -20);
    ctx.transform(1 + stretch, 0, 0, 1 - stretch * 0.65, 0, stretch * 8);
    if (!ink && game.hurt > 0 && Math.sin(game.age * 40) > 0) ctx.globalAlpha = 0.55;
    const step = Math.sin(game.walk) * (Math.abs(game.vx) > 8 ? 2 : 0);
    const paint = (color: string) => {
      ctx.fillStyle = ink ?? color;
    };
    paint("#1a140f");
    ctx.fillRect(-4, 16, 3, 4);
    ctx.fillRect(1, 16, 3, 4);
    paint("#6b4a32");
    ctx.fillRect(-4, 10, 3, 6);
    ctx.fillRect(1, 10, 3, 6);
    if (!ink && step !== 0) {
      paint("#6b4a32");
      ctx.fillRect(step > 0 ? 1 : -4, 14, 3, Math.abs(step));
    }
    paint("#3d6ea8");
    ctx.fillRect(-5, 5, 10, 7);
    paint("#e8a23a");
    ctx.fillRect(-5, 4, 10, 2);
    paint("#efc09a");
    ctx.fillRect(-4, -1, 8, 7);
    paint("#3a2e28");
    ctx.fillRect(-5, -4, 10, 4);
    ctx.fillRect(-5, -1, 2, 3);
    paint("#1a140f");
    ctx.fillRect(1, 1, 1, 2);
    ctx.fillRect(3, 1, 1, 2);
    ctx.restore();
  };
  body(-1, 0, "#1a140f");
  body(1, 0, "#1a140f");
  body(0, -1, "#1a140f");
  body(0, 0, null);
}

function drawMob(ctx: CanvasRenderingContext2D, m: Mob, age: number) {
  ctx.save();
  ctx.translate(Math.round(m.x), Math.round(m.y));
  if (m.hurt > 0) ctx.globalAlpha = 0.7;
  if (m.kind === "slime") {
    const bob = Math.sin(age * 8 + m.x) * 1;
    ctx.fillStyle = "#6b4a8a";
    ctx.fillRect(-6, -10 + bob, 12, 8);
    ctx.fillStyle = "#c9b6e0";
    ctx.fillRect(-4, -8 + bob, 3, 2);
    ctx.fillStyle = "#1a140f";
    ctx.fillRect(-3, -7 + bob, 2, 2);
    ctx.fillRect(2, -7 + bob, 2, 2);
  } else {
    const bob = Math.sin(age * 6 + m.y) * 2;
    ctx.fillStyle = "#22182e";
    ctx.beginPath();
    ctx.arc(0, bob, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f4e7cb";
    ctx.beginPath();
    ctx.arc(0, bob, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a140f";
    ctx.beginPath();
    ctx.arc(1, bob, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

