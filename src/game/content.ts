export const TILE = 16;
export const WORLD_W = 240;
export const WORLD_H = 90;

/** Seconds. Dusk warns, night hunts, dawn ends the first night if you are still alive. */
export const DUSK_AT = 85;
export const NIGHT_AT = 125;
export const DAWN_AT = 195;

export const T = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  COPPER: 4,
  COAL: 5,
  LOG: 6,
  LEAVES: 7,
  PLANK: 8,
  BENCH: 9,
  DOOR: 10,
  DOOR_OPEN: 11,
  TORCH: 12,
  BED_L: 13,
  BED_R: 14,
  CAMP: 15,
  GLASS: 16,
  TABLE: 17,
  CHAIR: 18,
  POT: 19,
  LAMP: 20,
  RUG: 21,
  SHELF: 22,
  CHEST: 23,
} as const;

export type TileId = (typeof T)[keyof typeof T];

export const BG = { NONE: 0, DIRT: 1, STONE: 2 } as const;

export const ITEM_IDS = [
  "wood",
  "plank",
  "fiber",
  "dirt",
  "cobble",
  "coal",
  "copper",
  "axe",
  "pick",
  "pick2",
  "sword",
  "bench",
  "door",
  "torch",
  "camp",
  "bed",
  "glass",
  "table",
  "chair",
  "pot",
  "lamp",
  "shelf",
  "rug",
] as const;

export type ItemId = (typeof ITEM_IDS)[number];

export type Tool = "axe" | "pick" | "pick2" | "sword" | null;

export const ITEM_NAME: Record<ItemId, string> = {
  wood: "原木",
  plank: "木板",
  fiber: "纤维",
  dirt: "泥土",
  cobble: "石块",
  coal: "煤炭",
  copper: "铜矿",
  axe: "木斧",
  pick: "木镐",
  pick2: "石镐",
  sword: "木剑",
  bench: "工作台",
  door: "木门",
  torch: "火把",
  camp: "营火",
  bed: "床",
  glass: "玻璃窗",
  table: "桌子",
  chair: "椅子",
  pot: "花盆",
  lamp: "壁灯",
  shelf: "书架",
  rug: "地毯",
};

export const TOOL_OF: Record<ItemId, Tool> = {
  wood: null,
  plank: null,
  fiber: null,
  dirt: null,
  cobble: null,
  coal: null,
  copper: null,
  axe: "axe",
  pick: "pick",
  pick2: "pick2",
  sword: "sword",
  bench: null,
  door: null,
  torch: null,
  camp: null,
  bed: null,
  glass: null,
  table: null,
  chair: null,
  pot: null,
  lamp: null,
  shelf: null,
  rug: null,
};

export type PlaceKind = "any" | "floor" | "hang";

export const PLACE: Partial<Record<ItemId, { tile: number; w: number; h: number; kind: PlaceKind }>> = {
  plank: { tile: T.PLANK, w: 1, h: 1, kind: "any" },
  dirt: { tile: T.DIRT, w: 1, h: 1, kind: "any" },
  cobble: { tile: T.STONE, w: 1, h: 1, kind: "any" },
  copper: { tile: T.COPPER, w: 1, h: 1, kind: "any" },
  bench: { tile: T.BENCH, w: 1, h: 1, kind: "floor" },
  door: { tile: T.DOOR, w: 1, h: 2, kind: "floor" },
  torch: { tile: T.TORCH, w: 1, h: 1, kind: "hang" },
  camp: { tile: T.CAMP, w: 1, h: 1, kind: "floor" },
  bed: { tile: T.BED_L, w: 2, h: 1, kind: "floor" },
  glass: { tile: T.GLASS, w: 1, h: 1, kind: "any" },
  table: { tile: T.TABLE, w: 1, h: 1, kind: "floor" },
  chair: { tile: T.CHAIR, w: 1, h: 1, kind: "floor" },
  pot: { tile: T.POT, w: 1, h: 1, kind: "floor" },
  lamp: { tile: T.LAMP, w: 1, h: 1, kind: "hang" },
  shelf: { tile: T.SHELF, w: 1, h: 1, kind: "floor" },
  rug: { tile: T.RUG, w: 1, h: 1, kind: "floor" },
};

const SOLID = new Set<number>([
  T.GRASS,
  T.DIRT,
  T.STONE,
  T.COPPER,
  T.COAL,
  T.LOG,
  T.PLANK,
  T.BENCH,
  T.DOOR,
  T.GLASS,
  T.CHEST,
]);

export function isSolid(tile: number): boolean {
  return SOLID.has(tile);
}

/** Blocks sunlight completely (glass is handled separately). */
export function isOpaque(tile: number): boolean {
  return isSolid(tile) && tile !== T.GLASS;
}

export function isLight(tile: number): number {
  if (tile === T.TORCH) return 8;
  if (tile === T.CAMP) return 9;
  if (tile === T.LAMP) return 7;
  return 0;
}

export function isKnownItem(id: string): id is ItemId {
  return (ITEM_IDS as readonly string[]).includes(id);
}

export type Drop = { id: ItemId; n: number };

export function dropsFor(tile: number, x: number, y: number, seed: number): Drop[] {
  const h = hash2(x, y, seed + 17);
  switch (tile) {
    case T.GRASS:
      return h > 0.84 ? [{ id: "dirt", n: 1 }, { id: "fiber", n: 1 }] : [{ id: "dirt", n: 1 }];
    case T.DIRT:
      return [{ id: "dirt", n: 1 }];
    case T.STONE:
      return [{ id: "cobble", n: 1 }];
    case T.COPPER:
      return [{ id: "copper", n: 1 }];
    case T.COAL:
      return [{ id: "coal", n: 1 }];
    case T.LOG:
      return [{ id: "wood", n: 1 }];
    case T.LEAVES:
      return [{ id: "fiber", n: 1 }];
    case T.PLANK:
      return [{ id: "plank", n: 1 }];
    case T.BENCH:
      return [{ id: "bench", n: 1 }];
    case T.DOOR:
    case T.DOOR_OPEN:
      return [{ id: "door", n: 1 }];
    case T.TORCH:
      return [{ id: "torch", n: 1 }];
    case T.CAMP:
      return [{ id: "camp", n: 1 }];
    case T.BED_L:
    case T.BED_R:
      return [{ id: "bed", n: 1 }];
    case T.GLASS:
      return [{ id: "glass", n: 1 }];
    case T.TABLE:
      return [{ id: "table", n: 1 }];
    case T.CHAIR:
      return [{ id: "chair", n: 1 }];
    case T.POT:
      return [{ id: "pot", n: 1 }];
    case T.LAMP:
      return [{ id: "lamp", n: 1 }];
    case T.SHELF:
      return [{ id: "shelf", n: 1 }];
    case T.RUG:
      return [{ id: "rug", n: 1 }];
    default:
      return [];
  }
}

/** Seconds to break with bare hands before tool multipliers. */
export function baseBreak(tile: number): number {
  switch (tile) {
    case T.LEAVES:
      return 0.22;
    case T.GRASS:
    case T.DIRT:
    case T.RUG:
    case T.POT:
    case T.TORCH:
    case T.CAMP:
      return 0.26;
    case T.LOG:
    case T.PLANK:
    case T.DOOR:
    case T.DOOR_OPEN:
    case T.TABLE:
    case T.CHAIR:
    case T.SHELF:
    case T.LAMP:
    case T.BED_L:
    case T.BED_R:
    case T.BENCH:
      return 0.4;
    case T.GLASS:
      return 0.5;
    case T.COAL:
      return 0.95;
    case T.STONE:
      return 1.15;
    case T.COPPER:
      return 1.35;
    default:
      return 0.8;
  }
}

export function breakSeconds(tile: number, tool: Tool): number {
  let t = baseBreak(tile);
  const rock = tile === T.STONE || tile === T.COPPER || tile === T.COAL;
  const wood =
    tile === T.LOG ||
    tile === T.LEAVES ||
    tile === T.PLANK ||
    tile === T.BENCH ||
    tile === T.DOOR ||
    tile === T.DOOR_OPEN ||
    tile === T.TABLE ||
    tile === T.CHAIR ||
    tile === T.SHELF ||
    tile === T.BED_L ||
    tile === T.BED_R;
  if (rock) {
    if (tool === "pick2") t *= 0.32;
    else if (tool === "pick") t *= 0.5;
    else t *= 2.5;
  }
  if (wood && tool === "axe") t *= 0.38;
  if (tool === "sword") t *= 1.25;
  return t;
}

export type Recipe = {
  id: string;
  station: "hand" | "bench";
  dawn?: boolean;
  needs: { id: ItemId; n: number }[];
  give: { id: ItemId; n: number };
};

export const RECIPES: Recipe[] = [
  { id: "plank", station: "hand", needs: [{ id: "wood", n: 1 }], give: { id: "plank", n: 4 } },
  { id: "bench", station: "hand", needs: [{ id: "plank", n: 8 }], give: { id: "bench", n: 1 } },
  { id: "axe", station: "bench", needs: [{ id: "plank", n: 3 }], give: { id: "axe", n: 1 } },
  { id: "pick", station: "bench", needs: [{ id: "plank", n: 3 }], give: { id: "pick", n: 1 } },
  { id: "sword", station: "bench", needs: [{ id: "plank", n: 2 }], give: { id: "sword", n: 1 } },
  { id: "door", station: "bench", needs: [{ id: "plank", n: 6 }], give: { id: "door", n: 1 } },
  {
    id: "torch",
    station: "bench",
    needs: [
      { id: "coal", n: 1 },
      { id: "plank", n: 1 },
    ],
    give: { id: "torch", n: 4 },
  },
  {
    id: "camp",
    station: "bench",
    needs: [
      { id: "plank", n: 3 },
      { id: "fiber", n: 2 },
    ],
    give: { id: "camp", n: 1 },
  },
  {
    id: "bed",
    station: "bench",
    needs: [
      { id: "plank", n: 5 },
      { id: "fiber", n: 3 },
    ],
    give: { id: "bed", n: 1 },
  },
  { id: "pick2", station: "bench", needs: [{ id: "cobble", n: 3 }], give: { id: "pick2", n: 1 } },
  { id: "glass", station: "bench", dawn: true, needs: [{ id: "cobble", n: 4 }], give: { id: "glass", n: 2 } },
  { id: "table", station: "bench", dawn: true, needs: [{ id: "plank", n: 4 }], give: { id: "table", n: 1 } },
  { id: "chair", station: "bench", dawn: true, needs: [{ id: "plank", n: 3 }], give: { id: "chair", n: 1 } },
  {
    id: "pot",
    station: "bench",
    dawn: true,
    needs: [
      { id: "fiber", n: 2 },
      { id: "dirt", n: 1 },
    ],
    give: { id: "pot", n: 1 },
  },
  {
    id: "lamp",
    station: "bench",
    dawn: true,
    needs: [
      { id: "plank", n: 2 },
      { id: "coal", n: 1 },
    ],
    give: { id: "lamp", n: 1 },
  },
  { id: "shelf", station: "bench", dawn: true, needs: [{ id: "plank", n: 5 }], give: { id: "shelf", n: 1 } },
  { id: "rug", station: "bench", dawn: true, needs: [{ id: "fiber", n: 3 }], give: { id: "rug", n: 1 } },
];

export function hash2(x: number, y: number, seed: number): number {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + (seed | 0);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function idx(x: number, y: number): number {
  return x + y * WORLD_W;
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < WORLD_W && y < WORLD_H;
}

export type Phase = "day" | "dusk" | "night" | "haven" | "endured";

export function clockPhase(time: number, survived: boolean, endured: boolean): Phase {
  if (survived) return "haven";
  if (endured) return "endured";
  if (time < DUSK_AT) return "day";
  if (time < NIGHT_AT) return "dusk";
  if (time < DAWN_AT) return "night";
  return "night";
}

export const DECOR_TILES = new Set<number>([T.GLASS, T.TABLE, T.CHAIR, T.POT, T.LAMP, T.SHELF, T.RUG, T.CAMP]);

export const TILE_INK: Record<number, string> = {
  [T.GRASS]: "#5d9a3c",
  [T.DIRT]: "#8d5a34",
  [T.STONE]: "#8a8b93",
  [T.COPPER]: "#c46b34",
  [T.COAL]: "#2c2e33",
  [T.LOG]: "#8a5a30",
  [T.LEAVES]: "#3f8a38",
  [T.PLANK]: "#c49258",
  [T.BENCH]: "#a56b38",
  [T.DOOR]: "#b5814a",
  [T.DOOR_OPEN]: "#b5814a",
  [T.TORCH]: "#e8a23a",
  [T.CAMP]: "#e07a32",
  [T.BED_L]: "#8e3d4a",
  [T.BED_R]: "#8e3d4a",
  [T.GLASS]: "#b9d7e4",
  [T.TABLE]: "#c49258",
  [T.CHAIR]: "#c49258",
  [T.POT]: "#d06a4a",
  [T.LAMP]: "#e8a23a",
  [T.SHELF]: "#8d5a34",
  [T.RUG]: "#a84848",
  [T.CHEST]: "#c49258",
};
