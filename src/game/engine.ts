import {
  DAWN_AT,
  DECOR_TILES,
  DUSK_AT,
  ITEM_NAME,
  NIGHT_AT,
  PLACE,
  RECIPES,
  T,
  TILE,
  TILE_INK,
  TOOL_OF,
  WORLD_H,
  WORLD_W,
  breakSeconds,
  clockPhase,
  dropsFor,
  idx,
  inBounds,
  isSolid,
  type ItemId,
  type Phase,
  type Recipe,
  type Tool,
} from "./content";
import { lightAt, recomputeLight, generateWorld, type WorldData } from "./world";
import { shelterAt, type Shelter } from "./shelter";
import { isMuted, playSfx, setMuted, setWind, unlockAudio } from "./audio";
import {
  b64ToU8,
  clearSave,
  hasSave,
  readMute,
  readSave,
  u8ToB64,
  writeMute,
  writeSave,
  type SaveData,
} from "./save";

const PW = 10;
const PH = 20;
const REACH = 78;
const MAX_HP = 5;

export type Mob = {
  kind: "eye" | "slime";
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  hurt: number;
  hop: number;
};

export type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number };
export type FloatText = { x: number; y: number; text: string; life: number };

export type RecipeView = {
  id: string;
  name: string;
  station: Recipe["station"];
  dawn: boolean;
  needs: { id: ItemId; name: string; have: number; need: number }[];
  ok: boolean;
  reason: string;
};

export type Hud = {
  mode: "menu" | "play";
  hp: number;
  maxHp: number;
  phase: Phase;
  seed: number;
  objective: string;
  clock: string;
  remain: string;
  remainPct: number;
  hotbar: ({ id: ItemId; n: number } | null)[];
  selected: number;
  bag: { id: ItemId; n: number }[];
  recipes: RecipeView[];
  safe: boolean;
  lit: boolean;
  enclosed: boolean;
  tooBig: boolean;
  bed: boolean;
  nearBench: boolean;
  toast: string | null;
  hasSave: boolean;
  survived: boolean;
  endured: boolean;
  cozy: number;
  cozyMax: number;
  paused: boolean;
  craftOpen: boolean;
  banner: "haven" | "endured" | null;
  muted: boolean;
  night: boolean;
};

export class Engine {
  world: WorldData;
  mode: "menu" | "play" = "menu";
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  facing: 1 | -1 = 1;
  grounded = false;
  hp = MAX_HP;
  time = 0;
  survived = false;
  endured = false;
  paused = false;
  craftOpen = false;
  banner: "haven" | "endured" | null = null;
  age = 0;
  walk = 0;
  squash = 0;
  swing = 0;
  hurt = 0;
  trauma = 0;
  camX = 0;
  camY = 0;
  aimTx = 0;
  aimTy = 0;
  aimOk = false;
  mineProg = 0;
  mineTx = -1;
  mineTy = -1;
  hand: Tool = null;
  mobs: Mob[] = [];
  particles: Particle[] = [];
  floats: FloatText[] = [];
  opened = new Set<number>();
  shelter: Shelter = { enclosed: false, tooBig: false, count: 0 };
  safe = false;
  lit = false;
  bedClose = false;
  nearBench = false;
  cozy = 0;
  toastText: string | null = null;
  toastLife = 0;
  view = { cssW: 390, cssH: 700, scale: 2, dpr: 1 };
  touchLayout = false;
  aimFromPointer = false;
  aimWorld: { x: number; y: number } | null = null;
  onHud: (() => void) | null = null;

  private keys = new Set<string>();
  private forced: Set<string> | null = null;
  private pad = { left: false, right: false, jump: false, mine: false };
  private pointerDown = false;
  private placeLatch = false;
  private useLatch = false;
  private jumpHeld = false;
  private canCut = false;
  private coyote = 0;
  private jumpBuf = 0;
  private iframe = 0;
  private hitstop = 0;
  private inv: Partial<Record<ItemId, number>> = {};
  hotbar: (ItemId | null)[] = Array.from({ length: 8 }, () => null);
  selected = 0;
  private spawnCd = 1.5;
  private scanCd = 0;
  private saveCd = 2;
  private lightBucket = -1;
  private tips = new Set<string>();
  private everWood = false;
  private sawBench = false;
  private placedDoor = false;
  private placedLight = false;
  private placedBed = false;
  private nightHorn = false;
  private prevPhase: Phase = "day";
  private unbind: (() => void) | null = null;

  constructor() {
    const saved = readSave();
    this.world = generateWorld(saved?.seed ?? ((Math.random() * 900000) | 0) + 1000);
    this.parkAtSpawn();
    if (readMute()) setMuted(true);
  }

  bind(win: Window) {
    const down = (e: KeyboardEvent) => {
      if (this.forced) return;
      this.keys.add(e.code);
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      if (e.code.startsWith("Digit")) {
        const n = Number(e.code.slice(5));
        if (n >= 1 && n <= 8) this.selected = n - 1;
      }
      if (e.code === "KeyE") this.craftOpen = !this.craftOpen;
      if (e.code === "Escape") this.togglePause();
      if (e.code === "KeyF") this.useLatch = true;
      if (e.code === "KeyM") this.toggleMute();
      this.emit();
    };
    const up = (e: KeyboardEvent) => this.keys.delete(e.code);
    const blur = () => this.keys.clear();
    win.addEventListener("keydown", down);
    win.addEventListener("keyup", up);
    win.addEventListener("blur", blur);
    this.unbind = () => {
      win.removeEventListener("keydown", down);
      win.removeEventListener("keyup", up);
      win.removeEventListener("blur", blur);
    };
  }

  destroy() {
    this.unbind?.();
    this.save();
  }

  attachDebug() {
    window.__controlsTest = {
      getYaw: () => 0,
      getSpeed: () => Math.abs(this.vx),
      getX: () => this.x,
      setKeys: (codes: string[]) => {
        this.forced = new Set(codes);
      },
    };
    window.__game = this;
  }

  setPad(partial: Partial<typeof this.pad>) {
    Object.assign(this.pad, partial);
  }

  setPointer(cssX: number, cssY: number) {
    this.aimWorld = { x: this.camX + cssX / this.view.scale, y: this.camY + cssY / this.view.scale };
    this.aimFromPointer = true;
  }

  setPointerDown(on: boolean) {
    this.pointerDown = on;
  }

  requestPlace() {
    this.placeLatch = true;
  }

  requestUse() {
    this.useLatch = true;
  }

  togglePause() {
    if (this.mode !== "play") return;
    this.paused = !this.paused;
    if (this.paused) this.save();
    this.emit();
  }

  toggleMute() {
    const next = !isMuted();
    setMuted(next);
    writeMute(next);
    this.emit();
  }

  toggleCraft() {
    this.craftOpen = !this.craftOpen;
    playSfx("ui");
    this.emit();
  }

  dismissBanner() {
    this.banner = null;
    this.emit();
  }

  selectSlot(i: number) {
    this.selected = i;
    this.emit();
  }

  assign(id: ItemId) {
    if ((this.inv[id] ?? 0) <= 0) return;
    for (let i = 0; i < 8; i++) if (this.hotbar[i] === id) this.hotbar[i] = null;
    this.hotbar[this.selected] = id;
    playSfx("ui");
    this.emit();
  }

  reroll() {
    if (this.mode !== "menu") return;
    const seed = ((Math.random() * 900000) | 0) + 1000;
    this.world = generateWorld(seed);
    this.parkAtSpawn();
    playSfx("ui");
    this.emit();
  }

  startNew() {
    unlockAudio();
    this.world = generateWorld(this.world.seed);
    this.resetRun();
    this.mode = "play";
    this.toast("天黑之前，给自己留一间能睡的屋子。");
    this.save();
    this.emit();
  }

  continueGame() {
    unlockAudio();
    if (!this.load()) return;
    this.mode = "play";
    this.paused = false;
    this.emit();
  }

  abandon() {
    clearSave();
    this.world = generateWorld(((Math.random() * 900000) | 0) + 1000);
    this.resetRun();
    this.mode = "menu";
    this.paused = false;
    this.emit();
  }

  give(id: ItemId, n: number) {
    this.add(id, n, true);
    this.emit();
  }

  setClock(t: number) {
    this.time = t;
    this.scanCd = 0;
    this.emit();
  }

  craft(id: string) {
    const recipe = RECIPES.find((r) => r.id === id);
    if (!recipe) return;
    const view = this.recipeState(recipe);
    if (!view.ok) {
      this.toast(view.reason);
      return;
    }
    for (const need of recipe.needs) this.consume(need.id, need.n);
    this.add(recipe.give.id, recipe.give.n, true);
    playSfx("craft");
    this.toast(`做出来了：${ITEM_NAME[recipe.give.id]} ×${recipe.give.n}`);
    this.emit();
  }

  fixed(dt: number) {
    if (this.hitstop > 0) {
      this.hitstop = Math.max(0, this.hitstop - dt);
      return;
    }
    if (this.mode !== "play" || this.paused) return;

    const left = this.down("KeyA") || this.down("ArrowLeft") || this.pad.left;
    const right = this.down("KeyD") || this.down("ArrowRight") || this.pad.right;
    const jump = this.down("Space") || this.down("KeyW") || this.down("ArrowUp") || this.pad.jump;
    if (left && !right) this.facing = -1;
    if (right && !left) this.facing = 1;

    const ax = this.grounded ? 2200 : 1400;
    if (left) this.vx -= ax * dt;
    if (right) this.vx += ax * dt;
    const max = 98;
    if (this.vx > max) this.vx = max;
    if (this.vx < -max) this.vx = -max;
    if (!left && !right) {
      const fr = this.grounded ? 2400 : 360;
      if (Math.abs(this.vx) < fr * dt) this.vx = 0;
      else this.vx -= Math.sign(this.vx) * fr * dt;
    }

    if (jump && !this.jumpHeld) this.jumpBuf = 0.12;
    this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    if (this.grounded) this.coyote = 0.1;
    else this.coyote = Math.max(0, this.coyote - dt);
    if (this.jumpBuf > 0 && this.coyote > 0) {
      this.vy = -268;
      this.jumpBuf = 0;
      this.coyote = 0;
      this.grounded = false;
      this.canCut = true;
      this.squash = -0.18;
      playSfx("jump");
    }
    if (this.canCut && !jump && this.vy < 0) {
      this.vy *= 0.5;
      this.canCut = false;
    }
    this.jumpHeld = jump;

    let g = this.vy < 0 ? 860 : 1680;
    if (Math.abs(this.vy) < 36) g *= 0.62;
    this.vy += g * dt;
    if (this.vy > 380) this.vy = 380;

    this.unstuck();
    this.moveX(dt);
    const landed = this.moveY(dt);
    if (landed) {
      this.squash = 0.32;
      this.trauma = Math.min(1, this.trauma + 0.15);
      playSfx("land");
    }

    if (!this.survived && !this.endured) this.time += dt;
    const phase = this.phaseNow();
    if (phase === "night" && this.prevPhase !== "night" && !this.nightHorn) {
      this.nightHorn = true;
      playSfx("night");
      this.toast("天黑了。没进屋的话，会被盯上。");
    }
    if (!this.survived && !this.endured && this.time >= DAWN_AT) {
      this.finishNight(this.safe);
    }
    this.prevPhase = this.phaseNow();

    this.scanCd -= dt;
    if (this.scanCd <= 0) {
      this.refreshScan();
      this.scanCd = 0.2;
    }
    const amb = this.ambient();
    const bucket = amb >> 3;
    if (bucket !== this.lightBucket) {
      recomputeLight(this.world, amb);
      this.lightBucket = bucket;
    }

    this.updateAim();
    this.updateMine(dt);
    if (this.placeLatch) {
      this.placeLatch = false;
      this.tryPlace();
    }
    if (this.useLatch) {
      this.useLatch = false;
      this.tryUse();
    }

    this.updateMobs(dt);
    this.touchDamage();
    this.iframe = Math.max(0, this.iframe - dt);
    this.hurt = this.iframe;

    this.saveCd -= dt;
    if (this.saveCd <= 0) {
      this.saveCd = 4;
      this.save();
    }
  }

  visual(dt: number) {
    this.age += dt;
    this.walk += Math.abs(this.vx) * dt * 0.18;
    this.squash += (0 - this.squash) * (1 - Math.exp(-10 * dt));
    this.swing = Math.max(0, this.swing - dt);
    this.trauma = Math.max(0, this.trauma - dt * 1.8);
    this.toastLife -= dt;
    if (this.toastLife <= 0) this.toastText = null;
    const reduce =
      typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) this.trauma = 0;

    for (const p of this.particles) {
      p.life -= dt;
      p.vy += 500 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const f of this.floats) {
      f.life -= dt;
      f.y -= 16 * dt;
    }
    this.floats = this.floats.filter((f) => f.life > 0);

    const night =
      this.mode === "play" && this.phaseNow() === "night" ? 1 : this.phaseNow() === "dusk" ? 0.45 : 0.1;
    setWind(this.mode === "menu" ? 0.2 : night);

    const viewW = this.view.cssW / this.view.scale;
    const viewH = this.view.cssH / this.view.scale;
    const look = this.mode === "play" ? this.facing * 22 : Math.sin(this.age * 0.35) * 36;
    const lift = this.touchLayout ? 70 : 20;
    let tx = this.x + look - viewW / 2;
    let ty = this.y - viewH * 0.58 - lift;
    const maxX = WORLD_W * TILE - viewW;
    const maxY = WORLD_H * TILE - viewH;
    if (maxX > 0) tx = Math.max(0, Math.min(maxX, tx));
    else tx = maxX / 2;
    if (maxY > 0) ty = Math.max(0, Math.min(maxY, ty));
    else ty = maxY / 2;
    const k = 1 - Math.exp(-8 * dt);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;
    this.camX = Math.round(this.camX);
    this.camY = Math.round(this.camY);
  }

  hud(): Hud {
    const phase = this.mode === "menu" ? "day" : this.phaseNow();
    return {
      mode: this.mode,
      hp: this.hp,
      maxHp: MAX_HP,
      phase,
      seed: this.world.seed,
      objective: this.objectiveText(),
      clock: this.clockLabel(phase),
      remain: this.remainLabel(phase),
      remainPct: this.remainPct(phase),
      hotbar: this.hotbar.map((id) => (id && this.count(id) > 0 ? { id, n: this.count(id) } : null)),
      selected: this.selected,
      bag: (Object.keys(this.inv) as ItemId[])
        .filter((id) => (this.inv[id] ?? 0) > 0)
        .map((id) => ({ id, n: this.inv[id] ?? 0 })),
      recipes: RECIPES.map((r) => this.recipeState(r)),
      safe: this.safe,
      lit: this.lit,
      enclosed: this.shelter.enclosed,
      tooBig: this.shelter.tooBig,
      bed: this.bedClose,
      nearBench: this.nearBench,
      toast: this.toastText,
      hasSave: hasSave(),
      survived: this.survived,
      endured: this.endured,
      cozy: this.cozy,
      cozyMax: 7,
      paused: this.paused,
      craftOpen: this.craftOpen,
      banner: this.banner,
      muted: isMuted(),
      night: phase === "night",
    };
  }

  displayTime(): number {
    if (this.mode === "menu") return 42 + Math.sin(this.age * 0.25) * 8;
    if (this.survived || this.endured) return 18;
    return this.time;
  }

  phaseNow(): Phase {
    return clockPhase(this.time, this.survived, this.endured);
  }

  private resetRun() {
    this.parkAtSpawn();
    this.vx = 0;
    this.vy = 0;
    this.hp = MAX_HP;
    this.time = 0;
    this.survived = false;
    this.endured = false;
    this.paused = false;
    this.banner = null;
    this.inv = {};
    this.hotbar = Array.from({ length: 8 }, () => null);
    this.selected = 0;
    this.mobs = [];
    this.opened.clear();
    this.tips.clear();
    this.everWood = false;
    this.sawBench = false;
    this.placedDoor = false;
    this.placedLight = false;
    this.placedBed = false;
    this.nightHorn = false;
    this.prevPhase = "day";
    this.iframe = 0;
    this.craftOpen = false;
    this.lightBucket = -1;
    recomputeLight(this.world, 235);
    this.lightBucket = 235 >> 3;
    this.refreshScan();
  }

  private parkAtSpawn() {
    this.x = this.world.spawnX * TILE + TILE / 2;
    this.y = this.world.spawnFeet;
    this.grounded = true;
    this.snapCamera();
  }

  private snapCamera() {
    const viewW = Math.max(160, this.view.cssW / this.view.scale);
    const viewH = Math.max(200, this.view.cssH / this.view.scale);
    const maxX = WORLD_W * TILE - viewW;
    const maxY = WORLD_H * TILE - viewH;
    let tx = this.x - viewW / 2;
    let ty = this.y - viewH * 0.58;
    this.camX = Math.round(Math.max(0, Math.min(Math.max(0, maxX), tx)));
    this.camY = Math.round(Math.max(0, Math.min(Math.max(0, maxY), ty)));
  }

  private down(code: string): boolean {
    if (this.forced) return this.forced.has(code);
    return this.keys.has(code);
  }

  private count(id: ItemId): number {
    return this.inv[id] ?? 0;
  }

  private add(id: ItemId, n: number, silent = false) {
    this.inv[id] = this.count(id) + n;
    if (id === "wood" || id === "plank") this.everWood = true;
    if (id === "bench") this.sawBench = true;
    const empty = this.hotbar.findIndex((s) => s === null);
    if (empty >= 0 && !this.hotbar.includes(id)) this.hotbar[empty] = id;
    if (!silent) this.float(`+${ITEM_NAME[id]}`);
  }

  private consume(id: ItemId, n: number) {
    const left = this.count(id) - n;
    if (left > 0) this.inv[id] = left;
    else {
      delete this.inv[id];
      for (let i = 0; i < 8; i++) if (this.hotbar[i] === id) this.hotbar[i] = null;
    }
  }

  private selectedItem(): ItemId | null {
    const id = this.hotbar[this.selected];
    if (!id || this.count(id) <= 0) return null;
    return id;
  }

  private toast(text: string) {
    this.toastText = text;
    this.toastLife = 2.6;
  }

  private tip(id: string, text: string) {
    if (this.tips.has(id)) return;
    this.tips.add(id);
    this.toast(text);
  }

  private float(text: string) {
    this.floats.push({ x: this.x, y: this.y - 28, text, life: 0.9 });
    if (this.floats.length > 6) this.floats.shift();
  }

  private burst(tx: number, ty: number, color: string) {
    for (let i = 0; i < 8; i++) {
      this.particles.push({
        x: tx * TILE + 8,
        y: ty * TILE + 8,
        vx: (Math.random() - 0.5) * 80,
        vy: -30 - Math.random() * 70,
        life: 0.35 + Math.random() * 0.25,
        max: 0.5,
        color,
        size: 2 + (i % 2),
      });
    }
    if (this.particles.length > 180) this.particles.splice(0, this.particles.length - 180);
  }

  private emit() {
    this.onHud?.();
  }

  private hits(cx: number, feet: number): boolean {
    const l = cx - PW / 2;
    const r = cx + PW / 2;
    const t = feet - PH;
    const b = feet;
    const x0 = Math.floor((l + 0.02) / TILE);
    const x1 = Math.floor((r - 0.02) / TILE);
    const y0 = Math.floor((t + 0.02) / TILE);
    const y1 = Math.floor((b - 0.02) / TILE);
    const fg = this.world.fg;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!inBounds(x, y)) return true;
        if (isSolid(fg[idx(x, y)])) return true;
      }
    }
    return false;
  }

  private unstuck() {
    if (!this.hits(this.x, this.y)) return;
    for (let i = 1; i <= 48; i++) {
      if (!this.hits(this.x, this.y - i)) {
        this.y -= i;
        return;
      }
    }
  }

  private moveX(dt: number) {
    const delta = this.vx * dt;
    const steps = Math.max(1, Math.ceil(Math.abs(delta)));
    const step = delta / steps;
    for (let i = 0; i < steps; i++) {
      this.x += step;
      if (!this.hits(this.x, this.y)) continue;
      let lifted = false;
      if (this.vy >= 0) {
        for (const up of [8, 16]) {
          if (!this.hits(this.x, this.y - up)) {
            this.y -= up;
            lifted = true;
            break;
          }
        }
      }
      if (lifted) continue;
      this.x -= step;
      this.vx = 0;
      break;
    }
    const min = 6;
    const max = WORLD_W * TILE - 6;
    if (this.x < min) {
      this.x = min;
      this.vx = 0;
    }
    if (this.x > max) {
      this.x = max;
      this.vx = 0;
    }
  }

  private moveY(dt: number): boolean {
    const delta = this.vy * dt;
    const steps = Math.max(1, Math.ceil(Math.abs(delta)));
    const step = delta / steps;
    let landed = false;
    const wasGround = this.grounded;
    this.grounded = false;
    for (let i = 0; i < steps; i++) {
      this.y += step;
      if (!this.hits(this.x, this.y)) continue;
      this.y -= step;
      if (delta > 0) {
        this.grounded = true;
        this.vy = 0;
        landed = !wasGround && this.vyPrevFall(delta);
      } else this.vy = 0;
      break;
    }
    if (!this.grounded && this.vy >= 0 && this.hits(this.x, this.y + 2)) {
      this.grounded = true;
      this.vy = 0;
    }
    if (this.y > WORLD_H * TILE) {
      this.y = this.world.spawnFeet;
      this.x = this.world.spawnX * TILE + 8;
    }
    return landed;
  }

  private vyPrevFall(delta: number): boolean {
    return delta > 1.2;
  }

  private inReach(tx: number, ty: number): boolean {
    const dx = tx * TILE + 8 - this.x;
    const dy = ty * TILE + 8 - (this.y - 12);
    return dx * dx + dy * dy <= REACH * REACH;
  }

  private updateAim() {
    if (this.aimFromPointer && this.aimWorld) {
      if (this.aimWorld.x < this.x - 6) this.facing = -1;
      if (this.aimWorld.x > this.x + 6) this.facing = 1;
      const tx = Math.floor(this.aimWorld.x / TILE);
      const ty = Math.floor(this.aimWorld.y / TILE);
      if (inBounds(tx, ty) && this.inReach(tx, ty)) {
        this.aimTx = tx;
        this.aimTy = ty;
        this.aimOk = true;
        return;
      }
    }
    const cx = Math.floor(this.x / TILE);
    const cy = Math.floor((this.y - 12) / TILE);
    let best: { tx: number; ty: number; d: number } | null = null;
    for (let ty = cy - 3; ty <= cy + 3; ty++) {
      for (let tx = cx + (this.facing < 0 ? -4 : 0); tx <= cx + (this.facing > 0 ? 4 : 0); tx++) {
        if (!inBounds(tx, ty) || !this.inReach(tx, ty)) continue;
        const tile = this.world.fg[idx(tx, ty)];
        if (tile === T.AIR) continue;
        const dx = tx * TILE + 8 - (this.x + this.facing * 12);
        const dy = ty * TILE + 8 - (this.y - 12);
        const d = dx * dx + dy * dy;
        if (!best || d < best.d) best = { tx, ty, d };
      }
    }
    if (best) {
      this.aimTx = best.tx;
      this.aimTy = best.ty;
    } else {
      this.aimTx = cx + this.facing;
      this.aimTy = cy;
    }
    this.aimOk = this.inReach(this.aimTx, this.aimTy);
  }

  private updateMine(dt: number) {
    const mining = this.pointerDown || this.pad.mine || this.down("KeyJ");
    const tool = this.selectedItem();
    this.hand = tool ? TOOL_OF[tool] : null;
    if (this.hand === "sword" && mining) {
      if (this.swing <= 0.02) this.swingSword();
    }
    if (!mining || !this.aimOk) {
      this.mineProg = 0;
      return;
    }
    const tile = this.world.fg[idx(this.aimTx, this.aimTy)];
    if (tile === T.AIR || tile === T.CHEST || this.aimTy === WORLD_H - 1) {
      this.mineProg = 0;
      return;
    }
    if (this.mineTx !== this.aimTx || this.mineTy !== this.aimTy) {
      this.mineProg = 0;
      this.mineTx = this.aimTx;
      this.mineTy = this.aimTy;
    }
    const secs = breakSeconds(tile, this.hand);
    this.mineProg += dt / secs;
    if (this.mineProg >= 1) {
      this.mineProg = 0;
      this.breakTile(this.aimTx, this.aimTy);
    }
  }

  private breakTile(tx: number, ty: number) {
    const fg = this.world.fg;
    const tile = fg[idx(tx, ty)];
    if (!tile || tile === T.CHEST || ty === WORLD_H - 1) return;
    const cleared: { x: number; y: number; tile: number }[] = [{ x: tx, y: ty, tile }];
    const extra = this.linked(tx, ty, tile);
    for (const e of extra) cleared.push(e);
    const dropped = new Map<ItemId, number>();
    for (const d of dropsFor(tile, tx, ty, this.world.seed)) {
      dropped.set(d.id, (dropped.get(d.id) ?? 0) + d.n);
    }
    for (const c of cleared) {
      fg[idx(c.x, c.y)] = T.AIR;
      this.burst(c.x, c.y, TILE_INK[c.tile] ?? "#f4e7cb");
    }
    for (const [id, n] of dropped) this.add(id, n);
    if (tile === T.LOG || tile === T.LEAVES) playSfx("chop");
    else playSfx("break");
    this.hitstop = 0.035;
    this.trauma = Math.min(1, this.trauma + 0.12);
    this.relight();
    if (tile === T.LOG) this.tip("tree", "原木可以徒手做成木板。工作台要放下来才算数。");
  }

  private linked(tx: number, ty: number, tile: number): { x: number; y: number; tile: number }[] {
    const fg = this.world.fg;
    if (tile === T.BED_L && inBounds(tx + 1, ty) && fg[idx(tx + 1, ty)] === T.BED_R) {
      return [{ x: tx + 1, y: ty, tile: T.BED_R }];
    }
    if (tile === T.BED_R && inBounds(tx - 1, ty) && fg[idx(tx - 1, ty)] === T.BED_L) {
      return [{ x: tx - 1, y: ty, tile: T.BED_L }];
    }
    if (tile === T.DOOR || tile === T.DOOR_OPEN) {
      const up = ty - 1;
      const down = ty + 1;
      if (inBounds(tx, up) && (fg[idx(tx, up)] === T.DOOR || fg[idx(tx, up)] === T.DOOR_OPEN)) {
        return [{ x: tx, y: up, tile: fg[idx(tx, up)] }];
      }
      if (inBounds(tx, down) && (fg[idx(tx, down)] === T.DOOR || fg[idx(tx, down)] === T.DOOR_OPEN)) {
        return [{ x: tx, y: down, tile: fg[idx(tx, down)] }];
      }
    }
    return [];
  }

  private tryPlace() {
    const id = this.selectedItem();
    if (!id) {
      this.toast("先在热栏里选一个能放的东西。");
      return;
    }
    const spec = PLACE[id];
    if (!spec) {
      this.toast("这个不能往地上放。");
      return;
    }
    if (!this.aimOk) {
      this.toast("太远了。");
      return;
    }
    const cells = this.footprint(id, this.aimTx, this.aimTy);
    if (!cells) return;
    for (const c of cells) {
      if (!inBounds(c.x, c.y) || this.world.fg[idx(c.x, c.y)] !== T.AIR) {
        this.toast("这儿被占住了。");
        return;
      }
    }
    if (!this.supported(id, cells)) {
      this.toast(spec.kind === "floor" ? "得放在结实的地面上。" : "要贴着已有的方块。");
      return;
    }
    for (const c of cells) {
      if (isSolid(c.tile) && this.overlapsPlayer(c.x, c.y)) {
        this.toast("会被自己卡住。");
        return;
      }
    }
    if (!this.consumeSafe(id)) return;
    for (const c of cells) this.world.fg[idx(c.x, c.y)] = c.tile;
    if (id === "door") this.placedDoor = true;
    if (id === "torch" || id === "camp" || id === "lamp") this.placedLight = true;
    if (id === "bed") this.placedBed = true;
    if (id === "bench") this.tip("bench", "站在工作台旁边，才能做镐、门和床。");
    if (id === "plank") this.tip("plank", "屋子内部留两格高，人才能站直。门也是两格高。");
    playSfx("place");
    this.relight();
    this.refreshScan();
    this.emit();
  }

  private consumeSafe(id: ItemId): boolean {
    if (this.count(id) <= 0) return false;
    this.consume(id, 1);
    return true;
  }

  private footprint(id: ItemId, tx: number, ty: number): { x: number; y: number; tile: number }[] | null {
    if (id === "door") return [
      { x: tx, y: ty, tile: T.DOOR },
      { x: tx, y: ty - 1, tile: T.DOOR },
    ];
    if (id === "bed") return [
      { x: tx, y: ty, tile: T.BED_L },
      { x: tx + 1, y: ty, tile: T.BED_R },
    ];
    const spec = PLACE[id];
    if (!spec) return null;
    return [{ x: tx, y: ty, tile: spec.tile }];
  }

  private supported(id: ItemId, cells: { x: number; y: number; tile: number }[]): boolean {
    const spec = PLACE[id];
    if (!spec) return false;
    const solidNear = (x: number, y: number) => {
      const nbs = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      return nbs.some(([dx, dy]) => inBounds(x + dx, y + dy) && isSolid(this.world.fg[idx(x + dx, y + dy)]));
    };
    if (spec.kind === "floor") {
      if (id === "door") {
        const foot = cells[0];
        return inBounds(foot.x, foot.y + 1) && isSolid(this.world.fg[idx(foot.x, foot.y + 1)]);
      }
      return cells.every((c) => inBounds(c.x, c.y + 1) && isSolid(this.world.fg[idx(c.x, c.y + 1)]));
    }
    if (spec.kind === "hang" || spec.kind === "any") return cells.some((c) => solidNear(c.x, c.y));
    return false;
  }

  private overlapsPlayer(tx: number, ty: number): boolean {
    const l = tx * TILE;
    const r = l + TILE;
    const t = ty * TILE;
    const b = t + TILE;
    const pl = this.x - PW / 2;
    const pr = this.x + PW / 2;
    const pt = this.y - PH;
    const pb = this.y;
    return pl < r - 0.5 && pr > l + 0.5 && pt < b - 0.5 && pb > t + 0.5;
  }

  private tryUse() {
    if (!this.aimOk) {
      this.trySleep();
      return;
    }
    const tile = this.world.fg[idx(this.aimTx, this.aimTy)];
    if (tile === T.DOOR || tile === T.DOOR_OPEN) {
      this.toggleDoor(this.aimTx, this.aimTy);
      return;
    }
    if (tile === T.CHEST) {
      this.openChest(this.aimTx, this.aimTy);
      return;
    }
    if (tile === T.BED_L || tile === T.BED_R || this.bedClose) {
      this.trySleep();
      return;
    }
    this.tryPlace();
  }

  private toggleDoor(tx: number, ty: number) {
    const fg = this.world.fg;
    const cells = [
      { x: tx, y: ty },
      { x: tx, y: ty - 1 },
      { x: tx, y: ty + 1 },
    ];
    const doors = cells.filter((c) => inBounds(c.x, c.y) && (fg[idx(c.x, c.y)] === T.DOOR || fg[idx(c.x, c.y)] === T.DOOR_OPEN));
    if (!doors.length) return;
    const open = fg[idx(doors[0].x, doors[0].y)] === T.DOOR;
    for (const c of doors) fg[idx(c.x, c.y)] = open ? T.DOOR_OPEN : T.DOOR;
    playSfx("place");
    this.toast(open ? "门开了。" : "门关上了。");
    this.relight();
    this.refreshScan();
  }

  private openChest(tx: number, ty: number) {
    const i = idx(tx, ty);
    if (this.opened.has(i)) {
      this.toast("箱子已经空了。");
      return;
    }
    this.opened.add(i);
    this.add("coal", 6, true);
    this.add("fiber", 4, true);
    this.add("wood", 3, true);
    playSfx("craft");
    this.toast("箱子里有煤炭、纤维和原木。");
    this.emit();
  }

  private trySleep() {
    if (this.survived || this.endured) {
      this.toast("已经是白天了。");
      return;
    }
    if (this.phaseNow() !== "night") {
      this.toast("还早。等天黑再睡。");
      return;
    }
    if (!this.shelter.enclosed) {
      this.toast(this.shelter.tooBig ? "这地方太大，封小一点才像屋子。" : "屋子还漏风。把门关上，顶也要封住。");
      return;
    }
    if (!this.lit) {
      this.toast("太黑了，先点上营火或火把。");
      return;
    }
    if (!this.bedClose) {
      this.toast("站到床边上。");
      return;
    }
    this.finishNight(true, true);
  }

  private finishNight(cozy: boolean, slept = false) {
    this.mobs = [];
    this.survived = cozy;
    this.endured = !cozy;
    this.banner = cozy ? "haven" : "endured";
    this.craftOpen = false;
    playSfx(slept ? "sleep" : "dawn");
    this.toast(cozy ? "你撑过了第一夜。" : "天亮了。你还活着，屋子却没成型。");
    this.relight();
    this.save();
    this.emit();
  }

  private refreshScan() {
    const fg = this.world.fg;
    this.shelter = shelterAt(fg, this.x, this.y);
    const body = lightAt(this.world, this.x, this.y - 10);
    this.lit = body >= 0.32;
    this.safe = this.shelter.enclosed && this.lit;
    const cx = Math.floor(this.x / TILE);
    const cy = Math.floor((this.y - 8) / TILE);
    this.nearBench = false;
    this.bedClose = false;
    let hasBench = false;
    let hasDoor = false;
    let hasLight = false;
    let hasBed = false;
    const fgAll = this.world.fg;
    for (let i = 0; i < fgAll.length; i++) {
      const t = fgAll[i];
      if (t === T.BENCH) hasBench = true;
      else if (t === T.DOOR || t === T.DOOR_OPEN) hasDoor = true;
      else if (t === T.TORCH || t === T.CAMP || t === T.LAMP) hasLight = true;
      else if (t === T.BED_L) hasBed = true;
    }
    this.sawBench = hasBench;
    this.placedDoor = hasDoor;
    this.placedLight = hasLight;
    this.placedBed = hasBed;
    for (let y = cy - 5; y <= cy + 4; y++) {
      for (let x = cx - 6; x <= cx + 6; x++) {
        if (!inBounds(x, y)) continue;
        const t = fg[idx(x, y)];
        if (t === T.BENCH) this.nearBench = true;
        if ((t === T.BED_L || t === T.BED_R) && Math.abs(x - cx) <= 2 && Math.abs(y - cy) <= 2) this.bedClose = true;
      }
    }
  }

  private scanCozy() {
    const kinds = new Set<number>();
    const fg = this.world.fg;
    for (let i = 0; i < fg.length; i++) if (DECOR_TILES.has(fg[i]) && fg[i] !== T.CAMP) kinds.add(fg[i]);
    this.cozy = kinds.size;
  }

  private relight() {
    recomputeLight(this.world, this.ambient());
    this.lightBucket = this.ambient() >> 3;
    this.scanCozy();
    this.scanCd = 0;
  }

  private ambient(): number {
    const phase = this.phaseNow();
    if (this.mode === "menu") return 220;
    if (phase === "haven" || phase === "endured") return 235;
    if (this.time < DUSK_AT) return 235 - (this.time / DUSK_AT) * 20;
    if (this.time < NIGHT_AT) {
      const u = (this.time - DUSK_AT) / (NIGHT_AT - DUSK_AT);
      return 215 - u * 175;
    }
    const u = Math.min(1, (this.time - NIGHT_AT) / 24);
    return 40 - u * 28;
  }

  private updateMobs(dt: number) {
    const phase = this.phaseNow();
    if (phase !== "night") {
      this.mobs = [];
      return;
    }
    if (this.safe) {
      this.mobs = this.mobs.filter((m) => {
        m.x += Math.sign(m.x - this.x || 1) * 90 * dt;
        return Math.abs(m.x - this.x) < 200;
      });
      return;
    }
    this.spawnCd -= dt;
    if (this.spawnCd <= 0 && this.mobs.length < 3) {
      this.spawnCd = 2.3;
      this.spawnMob();
    }
    for (const m of this.mobs) {
      m.hurt = Math.max(0, m.hurt - dt);
      if (m.kind === "slime") {
        const gnd = this.mobHits(m.x, m.y + 2, 10, 8);
        m.hop -= dt;
        if (gnd && m.hop <= 0) {
          m.vy = -155;
          const dir = Math.sign(this.x - m.x) || 1;
          m.vx = dir * 52;
          m.hop = 0.85 + Math.random() * 0.4;
        }
        m.vy += 1500 * dt;
        if (m.vy > 300) m.vy = 300;
      } else {
        const dx = this.x - m.x;
        const dy = this.y - 14 - m.y;
        const len = Math.hypot(dx, dy) || 1;
        m.vx = (dx / len) * 42;
        m.vy = (dy / len) * 30 + Math.sin(this.age * 5 + m.x) * 12;
      }
      this.moveMob(m, dt);
    }
    this.mobs = this.mobs.filter((m) => m.hp > 0 && Math.hypot(m.x - this.x, m.y - this.y) < 460);
  }

  private spawnMob() {
    if (this.shelter.enclosed && !this.lit) {
      this.mobs.push({
        kind: "slime",
        x: this.x + this.facing * 18,
        y: this.y,
        vx: 0,
        vy: 0,
        hp: 3,
        hurt: 0,
        hop: 0.2,
      });
      this.toast("没点灯的屋子，守不住。");
      return;
    }
    const dir = Math.random() < 0.5 ? -1 : 1;
    const sx = this.x + dir * (90 + Math.random() * 40);
    this.mobs.push({
      kind: "eye",
      x: sx,
      y: this.y - 36,
      vx: 0,
      vy: 0,
      hp: 2,
      hurt: 0,
      hop: 0,
    });
  }

  private mobHits(cx: number, feet: number, w: number, h: number): boolean {
    const l = cx - w / 2;
    const r = cx + w / 2;
    const t = feet - h;
    const b = feet;
    const x0 = Math.floor((l + 0.5) / TILE);
    const x1 = Math.floor((r - 0.5) / TILE);
    const y0 = Math.floor((t + 0.5) / TILE);
    const y1 = Math.floor((b - 0.5) / TILE);
    const fg = this.world.fg;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!inBounds(x, y)) return true;
        if (isSolid(fg[idx(x, y)])) return true;
      }
    }
    return false;
  }

  private moveMob(m: Mob, dt: number) {
    const w = m.kind === "slime" ? 10 : 12;
    const h = m.kind === "slime" ? 8 : 12;
    m.x += m.vx * dt;
    if (this.mobHits(m.x, m.y, w, h)) {
      m.x -= m.vx * dt;
      m.vx *= -0.4;
    }
    m.y += m.vy * dt;
    if (this.mobHits(m.x, m.y, w, h)) {
      m.y -= m.vy * dt;
      m.vy = 0;
    }
  }

  private touchDamage() {
    if (this.iframe > 0 || this.safe) return;
    for (const m of this.mobs) {
      const mw = m.kind === "slime" ? 10 : 12;
      const mh = m.kind === "slime" ? 8 : 12;
      const overlap =
        Math.abs(this.x - m.x) < PW / 2 + mw / 2 &&
        this.y > m.y - mh &&
        this.y - PH < m.y;
      if (!overlap) continue;
      this.hp -= 1;
      this.iframe = 0.9;
      this.hurt = 0.9;
      this.vx = Math.sign(this.x - m.x || this.facing) * 140;
      this.vy = -120;
      this.trauma = Math.min(1, this.trauma + 0.45);
      this.hitstop = 0.05;
      playSfx("hurt");
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(12);
      if (this.hp <= 0) {
        this.hp = MAX_HP;
        this.x = this.world.spawnX * TILE + 8;
        this.y = this.world.spawnFeet;
        this.vx = 0;
        this.vy = 0;
        this.iframe = 1.6;
        this.mobs = [];
        this.toast("你被夜里抓住了，又回到了起点。");
      }
      break;
    }
  }

  private swingSword() {
    this.swing = 0.18;
    playSfx("swing");
    let hit = false;
    for (const m of this.mobs) {
      const dx = m.x - this.x;
      if (Math.sign(dx || this.facing) !== this.facing && Math.abs(dx) > 8) continue;
      if (Math.abs(dx) > 28) continue;
      if (Math.abs(m.y - (this.y - 10)) > 22) continue;
      m.hp -= 1;
      m.hurt = 0.15;
      m.vx = this.facing * 120;
      m.vy = -40;
      hit = true;
      this.floats.push({ x: m.x, y: m.y - 10, text: "砍", life: 0.45 });
      if (m.hp <= 0) this.burst(Math.floor(m.x / TILE), Math.floor(m.y / TILE), "#c9b6e0");
    }
    if (hit) {
      this.hitstop = 0.04;
      this.trauma = Math.min(1, this.trauma + 0.18);
    }
  }

  private recipeState(recipe: Recipe): RecipeView {
    const dawnOk = !recipe.dawn || this.survived || this.endured;
    const stationOk = recipe.station === "hand" || this.nearBench;
    const needs = recipe.needs.map((n) => ({
      id: n.id,
      name: ITEM_NAME[n.id],
      have: this.count(n.id),
      need: n.n,
    }));
    const mats = needs.every((n) => n.have >= n.need);
    let reason = "制作";
    if (!dawnOk) reason = "天亮之后";
    else if (!stationOk) reason = "要站在工作台旁";
    else if (!mats) reason = "材料不够";
    return {
      id: recipe.id,
      name: `${ITEM_NAME[recipe.give.id]} ×${recipe.give.n}`,
      station: recipe.station,
      dawn: !!recipe.dawn,
      needs,
      ok: dawnOk && stationOk && mats,
      reason,
    };
  }

  private objectiveText(): string {
    if (this.mode === "menu") return "地图每次都不一样。天黑的时间，从来不变。";
    if (this.survived) return "天亮了。窗、桌子、灯、花，慢慢把屋子变成家。";
    if (this.endured) return "你熬过了这一夜。今天没有怪物，把屋子补上吧。";
    if (!this.everWood && this.count("wood") + this.count("plank") === 0) return "砍一棵树。原木能直接做成木板。";
    if (!this.sawBench) return "做一张工作台，放在身边。";
    if (!this.placedDoor) return "做一扇门并装上。屋子内部要留两格高。";
    if (!this.placedLight) return "做营火或火把，点在屋里。营火只要木板和树叶纤维。";
    if (!this.placedBed) return "用木板和纤维做一张床，放在屋里。";
    if (this.phaseNow() === "night") {
      if (!this.shelter.enclosed) return "封严屋子、关上门，再站到床边睡。";
      if (!this.lit) return "点上灯。黑屋子睡不着，也守不住。";
      return "关好门，靠近床，按「睡」。";
    }
    return "天黑前准备好：小屋、灯、床。时间在头顶。";
  }

  private clockLabel(phase: Phase): string {
    if (phase === "haven") return "第二天 · 清晨";
    if (phase === "endured") return "第二天 · 平安";
    if (phase === "night") return "第一夜";
    if (phase === "dusk") return "黄昏";
    return "第一天";
  }

  private remainLabel(phase: Phase): string {
    if (phase === "haven" || phase === "endured") return "今天不会再黑";
    if (phase === "night") return `距天亮 ${fmt(DAWN_AT - this.time)}`;
    return `距入夜 ${fmt(NIGHT_AT - this.time)}`;
  }

  private remainPct(phase: Phase): number {
    if (phase === "haven" || phase === "endured") return 1;
    if (phase === "night") return Math.max(0, Math.min(1, (DAWN_AT - this.time) / (DAWN_AT - NIGHT_AT)));
    return Math.max(0, Math.min(1, 1 - this.time / NIGHT_AT));
  }

  save() {
    if (this.mode !== "play") return;
    const data: SaveData = {
      v: 1,
      seed: this.world.seed,
      fg: u8ToB64(this.world.fg),
      bg: u8ToB64(this.world.bg),
      x: this.x,
      y: this.y,
      hp: this.hp,
      time: this.time,
      survived: this.survived,
      endured: this.endured,
      inv: this.inv,
      hotbar: this.hotbar,
      selected: this.selected,
      opened: [...this.opened],
      banner: this.banner,
    };
    writeSave(data);
  }

  private load(): boolean {
    const data = readSave();
    if (!data) return false;
    const size = WORLD_W * WORLD_H;
    const fg = b64ToU8(data.fg, size);
    const bg = b64ToU8(data.bg, size);
    if (!fg || !bg) return false;
    this.world = generateWorld(data.seed);
    this.world.fg = fg;
    this.world.bg = bg;
    this.x = data.x;
    this.y = data.y;
    this.hp = data.hp;
    this.time = data.time;
    this.survived = data.survived;
    this.endured = data.endured;
    this.inv = { ...data.inv };
    this.hotbar = data.hotbar.slice();
    this.selected = data.selected;
    this.opened = new Set(data.opened);
    this.banner = data.banner;
    this.paused = false;
    this.mobs = [];
    this.everWood = this.count("wood") + this.count("plank") > 0;
    this.sawBench = false;
    this.placedDoor = false;
    this.placedLight = false;
    this.placedBed = false;
    this.nightHorn = this.time >= NIGHT_AT;
    this.lightBucket = -1;
    this.relight();
    this.refreshScan();
    for (let i = 0; i < fg.length; i++) {
      if (fg[i] === T.DOOR || fg[i] === T.DOOR_OPEN) this.placedDoor = true;
      if (fg[i] === T.TORCH || fg[i] === T.CAMP || fg[i] === T.LAMP) this.placedLight = true;
      if (fg[i] === T.BED_L) this.placedBed = true;
      if (fg[i] === T.BENCH) this.sawBench = true;
    }
    return true;
  }
}

function fmt(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      getX: () => number;
      setKeys: (codes: string[]) => void;
    };
    __game?: Engine;
  }
}
