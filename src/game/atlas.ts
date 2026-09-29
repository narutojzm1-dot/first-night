import { T } from "./content";
import type { ItemId } from "./content";

const cache = new Map<string, HTMLCanvasElement>();

function sprite(key: string, draw: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 16;
  const g = c.getContext("2d");
  if (!g) return c;
  g.imageSmoothingEnabled = false;
  draw(g);
  cache.set(key, c);
  return c;
}

function px(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
}

export function tileSprite(tile: number, variant: number): HTMLCanvasElement {
  const v = variant % 3;
  return sprite(`t${tile}-${v}`, (g) => paintTile(g, tile, v));
}

export function bgSprite(kind: number): HTMLCanvasElement {
  return sprite(`b${kind}`, (g) => {
    if (kind === 1) {
      px(g, 0, 0, 16, 16, "#5a3a28");
      px(g, 2, 3, 3, 2, "#6b4630");
      px(g, 9, 8, 4, 2, "#4a2e1e");
      px(g, 5, 12, 2, 2, "#6b4630");
    } else if (kind === 2) {
      px(g, 0, 0, 16, 16, "#3e414a");
      px(g, 1, 2, 4, 3, "#4a4e58");
      px(g, 8, 7, 5, 4, "#33363e");
      px(g, 3, 11, 3, 2, "#4a4e58");
    } else {
      px(g, 0, 0, 16, 16, "#4a3424");
      px(g, 0, 5, 16, 1, "#3a2818");
      px(g, 0, 11, 16, 1, "#3a2818");
      px(g, 4, 2, 2, 2, "#6a4a30");
      px(g, 11, 8, 2, 2, "#6a4a30");
    }
  });
}

function paintTile(g: CanvasRenderingContext2D, tile: number, v: number) {
  if (tile === T.DIRT) return paintDirt(g, v, false);
  if (tile === T.GRASS) return paintDirt(g, v, true);
  if (tile === T.STONE) return paintStone(g, v, "#8a8b93", "#6e6f78", "#b0b1b8");
  if (tile === T.COAL) {
    paintStone(g, v, "#5c5e66", "#3a3c44", "#8a8b93");
    px(g, 4, 5, 3, 3, "#1a1c20");
    px(g, 9, 9, 3, 2, "#141518");
    px(g, 6, 11, 2, 2, "#2a2c30");
    return;
  }
  if (tile === T.COPPER) {
    paintStone(g, v, "#8a8b93", "#6e6f78", "#b0b1b8");
    px(g, 3, 4, 4, 3, "#c46b34");
    px(g, 8, 9, 5, 3, "#a85628");
    px(g, 5, 6, 2, 1, "#f0b27a");
    return;
  }
  if (tile === T.LOG) {
    px(g, 0, 0, 16, 16, "#6b4428");
    px(g, 3, 0, 10, 16, "#8d5a32");
    px(g, 6, 0, 4, 16, "#c4945c");
    px(g, 7, 2, 2, 2, "#6b4428");
    px(g, 7, 7, 2, 2, "#6b4428");
    px(g, 7, 12, 2, 2, "#6b4428");
    px(g, 4, 0, 1, 16, "#a56b3c");
    return;
  }
  if (tile === T.LEAVES) {
    const base = v === 1 ? "#347430" : v === 2 ? "#4a9840" : "#3d8636";
    px(g, 0, 0, 16, 16, base);
    px(g, 2, 2, 3, 2, "#6eae48");
    px(g, 8, 4, 4, 2, "#2f6a2c");
    px(g, 4, 9, 3, 2, "#6eae48");
    px(g, 11, 11, 3, 2, "#2f6a2c");
    px(g, 1, 6, 2, 3, "#2c5e28");
    px(g, 0, 0, 16, 1, "#7dba5a");
    if (v === 2) px(g, 10, 2, 2, 2, "#e8a23a");
    return;
  }
  if (tile === T.PLANK) {
    px(g, 0, 0, 16, 16, "#c49258");
    px(g, 0, 0, 16, 5, "#d4a66a");
    px(g, 0, 5, 16, 1, "#8a5a30");
    px(g, 0, 6, 16, 4, "#b5814a");
    px(g, 0, 10, 16, 1, "#8a5a30");
    px(g, 0, 11, 16, 5, "#c49258");
    px(g, 4, 1, 1, 4, "#8a5a30");
    px(g, 11, 7, 1, 3, "#8a5a30");
    px(g, 7, 12, 1, 3, "#a56b3c");
    px(g, 0, 15, 16, 1, "#6b4428");
    return;
  }
  if (tile === T.BENCH) {
    px(g, 0, 6, 16, 4, "#d4a66a");
    px(g, 0, 10, 16, 1, "#6b4428");
    px(g, 2, 11, 2, 5, "#8d5a32");
    px(g, 12, 11, 2, 5, "#8d5a32");
    px(g, 6, 3, 6, 3, "#8a8b93");
    px(g, 7, 1, 2, 3, "#6e6f78");
    px(g, 4, 7, 2, 1, "#f4e7cb");
    return;
  }
  if (tile === T.DOOR || tile === T.DOOR_OPEN) {
    px(g, 2, 0, 12, 16, "#b5814a");
    px(g, 3, 1, 10, 14, tile === T.DOOR_OPEN ? "#6a3a28" : "#d4a66a");
    px(g, 4, 3, 8, 4, "#8d5a32");
    px(g, 4, 9, 8, 4, "#8d5a32");
    px(g, 10, 8, 2, 2, "#e8a23a");
    if (tile === T.DOOR_OPEN) px(g, 6, 2, 4, 12, "#1a140f");
    return;
  }
  if (tile === T.TORCH) {
    px(g, 7, 6, 2, 9, "#8d5a32");
    px(g, 6, 3, 4, 4, "#e07a32");
    px(g, 7, 2, 2, 3, "#f2c14e");
    px(g, 7, 1, 1, 2, "#f4e7cb");
    return;
  }
  if (tile === T.CAMP) {
    px(g, 2, 11, 12, 3, "#5c4030");
    px(g, 4, 9, 8, 3, "#8d5a32");
    px(g, 6, 5, 4, 5, "#e07a32");
    px(g, 7, 3, 2, 4, "#f2c14e");
    px(g, 5, 7, 2, 2, "#f4e7cb");
    return;
  }
  if (tile === T.BED_L || tile === T.BED_R) {
    px(g, 0, 8, 16, 5, "#f4e7cb");
    px(g, 0, 8, 16, 2, "#8e3d4a");
    px(g, 0, 13, 16, 3, "#6b4428");
    if (tile === T.BED_L) {
      px(g, 1, 4, 6, 5, "#f4e7cb");
      px(g, 2, 5, 4, 3, "#e7b89a");
    } else {
      px(g, 8, 9, 6, 2, "#6b4428");
    }
    return;
  }
  if (tile === T.GLASS) {
    px(g, 0, 0, 16, 16, "#8ec4d4");
    px(g, 0, 0, 16, 1, "#f4e7cb");
    px(g, 0, 15, 16, 1, "#5a7e8a");
    px(g, 0, 0, 1, 16, "#f4e7cb");
    px(g, 15, 0, 1, 16, "#5a7e8a");
    px(g, 7, 0, 1, 16, "#d5eef5");
    px(g, 0, 7, 16, 1, "#d5eef5");
    px(g, 3, 3, 3, 2, "#f4e7cb");
    return;
  }
  if (tile === T.TABLE) {
    px(g, 1, 5, 14, 3, "#d4a66a");
    px(g, 1, 8, 14, 1, "#6b4428");
    px(g, 3, 9, 2, 6, "#8d5a32");
    px(g, 11, 9, 2, 6, "#8d5a32");
    return;
  }
  if (tile === T.CHAIR) {
    px(g, 4, 2, 8, 3, "#d4a66a");
    px(g, 4, 8, 8, 2, "#c49258");
    px(g, 5, 10, 2, 5, "#8d5a32");
    px(g, 10, 10, 2, 5, "#8d5a32");
    px(g, 11, 2, 2, 8, "#8d5a32");
    return;
  }
  if (tile === T.POT) {
    px(g, 4, 8, 8, 6, "#c45a3a");
    px(g, 5, 7, 6, 2, "#a84830");
    px(g, 7, 3, 2, 5, "#3f7a2c");
    px(g, 5, 2, 3, 2, "#7dba5a");
    px(g, 9, 3, 3, 2, "#e8a23a");
    px(g, 6, 11, 2, 1, "#f4e7cb");
    return;
  }
  if (tile === T.LAMP) {
    px(g, 7, 8, 2, 6, "#6b4428");
    px(g, 4, 3, 8, 6, "#f2c14e");
    px(g, 6, 4, 4, 3, "#fff4d2");
    px(g, 5, 2, 6, 2, "#e8a23a");
    return;
  }
  if (tile === T.SHELF) {
    px(g, 1, 2, 14, 3, "#8d5a32");
    px(g, 1, 8, 14, 3, "#8d5a32");
    px(g, 3, 5, 3, 3, "#8e3d4a");
    px(g, 7, 5, 3, 3, "#3d6ea8");
    px(g, 11, 5, 2, 3, "#e8a23a");
    px(g, 4, 11, 3, 3, "#5d9a3c");
    px(g, 9, 11, 4, 3, "#f4e7cb");
    return;
  }
  if (tile === T.RUG) {
    px(g, 1, 10, 14, 4, "#8e3d4a");
    px(g, 2, 11, 12, 2, "#c45a4a");
    px(g, 4, 11, 2, 2, "#f4e7cb");
    px(g, 10, 11, 2, 2, "#f4e7cb");
    return;
  }
  if (tile === T.CHEST) {
    px(g, 2, 5, 12, 8, "#c49258");
    px(g, 2, 5, 12, 3, "#d4a66a");
    px(g, 2, 8, 12, 1, "#6b4428");
    px(g, 7, 7, 2, 3, "#e8a23a");
    px(g, 3, 10, 10, 2, "#a56b3c");
    return;
  }
}

function paintDirt(g: CanvasRenderingContext2D, v: number, grass: boolean) {
  px(g, 0, 0, 16, 16, v === 1 ? "#7a4c2c" : "#8d5a34");
  px(g, 0, 14, 16, 2, "#5e3a22");
  px(g, 2, 8, 2, 2, "#a56b40");
  px(g, 9, 10, 3, 2, "#6b4428");
  px(g, 6, 5, 2, 1, "#a56b40");
  if (!grass) return;
  px(g, 0, 0, 16, 5, v === 2 ? "#6eae48" : "#5d9a3c");
  px(g, 0, 4, 16, 2, "#3f7a2c");
  px(g, 0, 0, 16, 1, "#8dcc62");
  const starts = [1, 5, 8, 12];
  for (let i = 0; i < starts.length; i++) {
    const h = 2 + ((i + v) % 2);
    px(g, starts[i], 0, 1, h, "#7dba5a");
  }
  if (v === 2) {
    px(g, 11, 0, 3, 3, "#f4e7cb");
    px(g, 12, 0, 1, 1, "#e8a23a");
  } else if (v === 1) {
    px(g, 3, 0, 1, 3, "#3f7a2c");
  }
}

function paintStone(g: CanvasRenderingContext2D, v: number, base: string, dark: string, lite: string) {
  px(g, 0, 0, 16, 16, v === 1 ? dark : base);
  px(g, 1, 2, 5, 3, lite);
  px(g, 9, 8, 5, 4, dark);
  px(g, 4, 11, 3, 2, lite);
  px(g, 0, 15, 16, 1, "#3e4048");
  px(g, 0, 7, 16, 1, "#5c5e66");
}

const ITEM_TILE: Partial<Record<ItemId, number>> = {
  plank: T.PLANK,
  dirt: T.DIRT,
  cobble: T.STONE,
  bench: T.BENCH,
  door: T.DOOR,
  torch: T.TORCH,
  camp: T.CAMP,
  bed: T.BED_L,
  glass: T.GLASS,
  table: T.TABLE,
  chair: T.CHAIR,
  pot: T.POT,
  lamp: T.LAMP,
  shelf: T.SHELF,
  rug: T.RUG,
};

export function drawItemIcon(ctx: CanvasRenderingContext2D, id: ItemId, x: number, y: number, size: number) {
  const tile = ITEM_TILE[id];
  if (tile) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tileSprite(tile, 0), x, y, size, size);
    return;
  }
  const c = sprite(`item-${id}`, (g) => paintItem(g, id));
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(c, x, y, size, size);
}

function paintItem(g: CanvasRenderingContext2D, id: ItemId) {
  if (id === "wood") {
    px(g, 3, 1, 10, 14, "#8d5a32");
    px(g, 6, 1, 4, 14, "#c4945c");
    px(g, 7, 4, 2, 2, "#6b4428");
    px(g, 7, 9, 2, 2, "#6b4428");
    return;
  }
  if (id === "fiber") {
    px(g, 4, 2, 2, 12, "#7dba5a");
    px(g, 7, 1, 2, 13, "#3f7a2c");
    px(g, 10, 3, 2, 11, "#6eae48");
    px(g, 6, 6, 4, 2, "#c6e38a");
    return;
  }
  if (id === "coal") {
    px(g, 4, 4, 8, 8, "#2a2c30");
    px(g, 6, 5, 3, 3, "#4a4e56");
    px(g, 8, 9, 3, 2, "#141518");
    return;
  }
  if (id === "copper") {
    px(g, 4, 4, 8, 7, "#c46b34");
    px(g, 6, 5, 3, 2, "#f0b27a");
    px(g, 5, 9, 5, 2, "#8a4a24");
    return;
  }
  if (id === "axe" || id === "pick" || id === "pick2" || id === "sword") {
    px(g, 8, 8, 2, 7, "#8d5a32");
    px(g, 9, 9, 1, 5, "#c4945c");
    if (id === "sword") {
      px(g, 7, 1, 3, 8, "#d5dde4");
      px(g, 8, 1, 1, 7, "#f4e7cb");
      px(g, 6, 8, 5, 2, "#e8a23a");
    } else if (id === "axe") {
      px(g, 4, 2, 6, 5, "#c5ccd2");
      px(g, 5, 3, 4, 2, "#f4e7cb");
      px(g, 3, 4, 2, 3, "#8a9098");
    } else {
      const head = id === "pick2" ? "#8a8b93" : "#d4a66a";
      px(g, 3, 3, 10, 3, head);
      px(g, 4, 2, 8, 1, "#f4e7cb");
      px(g, 2, 5, 3, 2, "#5c5e66");
      px(g, 11, 5, 3, 2, "#5c5e66");
    }
  }
}
