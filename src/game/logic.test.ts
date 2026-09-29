import assert from "node:assert/strict";
import test from "node:test";
import { T, TILE, WORLD_H, WORLD_W, idx } from "./content.ts";
import { shelterAt } from "./shelter.ts";
import { generateWorld } from "./world.ts";

test("spawn stands on grass with sky above and trees plus coal nearby", () => {
  for (const seed of [1, 42, 9001, 246813]) {
    const world = generateWorld(seed);
    const x = world.spawnX;
    const sy = world.spawnFeet / TILE;
    assert.equal(world.fg[idx(x, sy)], T.GRASS);
    assert.equal(world.fg[idx(x, sy - 1)], T.AIR);
    assert.equal(world.fg[idx(x, sy - 2)], T.AIR);
    let logs = 0;
    let coal = 0;
    for (let tx = x - 40; tx <= x + 40; tx++) {
      for (let ty = 0; ty < WORLD_H; ty++) {
        const t = world.fg[idx(tx, ty)];
        if (t === T.LOG) logs++;
        if (t === T.COAL && ty > world.surface[tx] && ty < world.surface[tx] + 16) coal++;
      }
    }
    assert.ok(logs >= 8, `seed ${seed} logs ${logs}`);
    assert.ok(coal >= 4, `seed ${seed} coal ${coal}`);
  }
});

test("a sealed room counts and the open sky does not", () => {
  const fg = new Uint8Array(WORLD_W * WORLD_H);
  fg.fill(T.STONE);
  for (let y = 20; y <= 22; y++) {
    for (let x = 40; x <= 46; x++) fg[idx(x, y)] = T.AIR;
  }
  const inside = shelterAt(fg, 43 * TILE + 8, 23 * TILE);
  assert.equal(inside.enclosed, true);

  const sky = new Uint8Array(WORLD_W * WORLD_H);
  const outside = shelterAt(sky, 80 * TILE, 10 * TILE);
  assert.equal(outside.enclosed, false);
});
