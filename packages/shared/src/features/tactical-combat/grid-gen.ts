// ──────────────────────────────────────────────
// Tactical Combat — seeded procedural grid + spawn placement
// ──────────────────────────────────────────────
// Deterministic given the rng stream: terrain clusters (forest/mountain/ruin/
// water/wall blobs) over a plains base, spawn columns kept clear, and a
// guaranteed-connected corridor carved between the party (left) and enemy
// (right) spawn strips so a battle can never generate an unwinnable no-path map.

import { isImpassable, manhattan } from "./math.js";
import type { TacticalCoord, TacticalGrid, TacticalTerrain, TacticalUnit } from "./types.js";

const CLUSTER_TERRAINS: { terrain: TacticalTerrain; weight: number }[] = [
  { terrain: "forest", weight: 4 },
  { terrain: "mountain", weight: 3 },
  { terrain: "ruin", weight: 3 },
  { terrain: "water", weight: 2 },
  { terrain: "wall", weight: 1 },
];

function pickTerrain(rng: () => number): TacticalTerrain {
  const total = CLUSTER_TERRAINS.reduce((s, c) => s + c.weight, 0);
  let roll = rng() * total;
  for (const c of CLUSTER_TERRAINS) {
    if (roll < c.weight) return c.terrain;
    roll -= c.weight;
  }
  return "forest";
}

/** Grid dimensions scale with the number of combatants. Default 12x8, cap 14x10. */
export function gridDimensions(unitCount: number): { width: number; height: number } {
  if (unitCount > 8) return { width: 14, height: 10 };
  if (unitCount > 5) return { width: 13, height: 9 };
  return { width: 12, height: 8 };
}

const SPAWN_COLS = 2;

function set(grid: TacticalGrid, x: number, y: number, terrain: TacticalTerrain): void {
  if (x >= 0 && y >= 0 && x < grid.width && y < grid.height) grid.tiles[y]![x] = terrain;
}

function inSpawnZone(grid: TacticalGrid, x: number): boolean {
  return x < SPAWN_COLS || x >= grid.width - SPAWN_COLS;
}

/** Grow a blob of `terrain` around a center via a bounded random walk. */
function growBlob(grid: TacticalGrid, cx: number, cy: number, size: number, terrain: TacticalTerrain, rng: () => number): void {
  let x = cx;
  let y = cy;
  for (let i = 0; i < size; i++) {
    if (!inSpawnZone(grid, x)) set(grid, x, y, terrain);
    const dir = Math.floor(rng() * 4);
    if (dir === 0) x += 1;
    else if (dir === 1) x -= 1;
    else if (dir === 2) y += 1;
    else y -= 1;
    x = Math.max(0, Math.min(grid.width - 1, x));
    y = Math.max(0, Math.min(grid.height - 1, y));
  }
}

/** Convert impassable tiles along a greedy path from → to into plains. */
function carveCorridor(grid: TacticalGrid, from: TacticalCoord, to: TacticalCoord): void {
  let { x, y } = from;
  let guard = 0;
  const limit = grid.width * grid.height * 2;
  while ((x !== to.x || y !== to.y) && guard++ < limit) {
    set(grid, x, y, "plains");
    if (x < to.x) x += 1;
    else if (x > to.x) x -= 1;
    else if (y < to.y) y += 1;
    else if (y > to.y) y -= 1;
  }
  set(grid, to.x, to.y, "plains");
}

/** BFS reachability over passable tiles. */
function reachable(grid: TacticalGrid, from: TacticalCoord, to: TacticalCoord): boolean {
  const seen = new Set<string>();
  const queue: TacticalCoord[] = [from];
  seen.add(`${from.x},${from.y}`);
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur.x === to.x && cur.y === to.y) return true;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const key = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue;
      if (seen.has(key) || isImpassable(grid, nx, ny)) continue;
      seen.add(key);
      queue.push({ x: nx, y: ny });
    }
  }
  return false;
}

/** Build a seeded terrain grid with clear spawn strips and guaranteed left↔right connectivity. */
export function generateGrid(unitCount: number, rng: () => number): TacticalGrid {
  const { width, height } = gridDimensions(unitCount);
  const tiles: TacticalTerrain[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => "plains" as TacticalTerrain),
  );
  const grid: TacticalGrid = { width, height, tiles };

  // Terrain clusters over the contested middle band.
  const blobCount = Math.round((width * height) / 14) + Math.floor(rng() * 3);
  for (let i = 0; i < blobCount; i++) {
    const cx = SPAWN_COLS + Math.floor(rng() * Math.max(1, width - SPAWN_COLS * 2));
    const cy = Math.floor(rng() * height);
    const size = 3 + Math.floor(rng() * 5);
    growBlob(grid, cx, cy, size, pickTerrain(rng), rng);
  }

  // Spawn strips stay plains so units always have clean footing.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (inSpawnZone(grid, x)) set(grid, x, y, "plains");
    }
  }

  // Guarantee a passable route between the spawn strips.
  const midY = Math.floor(height / 2);
  const partyAnchor = { x: SPAWN_COLS - 1, y: midY };
  const enemyAnchor = { x: width - SPAWN_COLS, y: midY };
  if (!reachable(grid, partyAnchor, enemyAnchor)) {
    carveCorridor(grid, partyAnchor, enemyAnchor);
  }

  return grid;
}

/** Ordered candidate spawn tiles for a side, spread across rows within its columns. */
function spawnTiles(grid: TacticalGrid, side: "party" | "enemy", count: number): TacticalCoord[] {
  const cols =
    side === "party"
      ? [0, 1].slice(0, SPAWN_COLS)
      : [grid.width - 1, grid.width - 2].slice(0, SPAWN_COLS);
  const perCol = Math.ceil(count / cols.length);
  const out: TacticalCoord[] = [];
  for (const col of cols) {
    for (let i = 0; i < perCol; i++) {
      const y = perCol === 1 ? Math.floor(grid.height / 2) : Math.round((i * (grid.height - 1)) / (perCol - 1));
      out.push({ x: col, y });
    }
  }
  return out;
}

/**
 * Place party on the left strip and enemies on the right strip, boss furthest
 * back (rightmost column, center). Mutates each unit's x/y in place.
 */
export function placeSpawns(grid: TacticalGrid, units: TacticalUnit[]): void {
  const occupied = new Set<string>();
  const take = (candidates: TacticalCoord[], preferred?: TacticalCoord): TacticalCoord => {
    const ordered = preferred ? [preferred, ...candidates] : candidates;
    for (const c of ordered) {
      const key = `${c.x},${c.y}`;
      if (!occupied.has(key) && c.x >= 0 && c.y >= 0 && c.x < grid.width && c.y < grid.height) {
        occupied.add(key);
        return c;
      }
    }
    // Fallback: scan the whole grid for any free tile.
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const key = `${x},${y}`;
        if (!occupied.has(key)) {
          occupied.add(key);
          return { x, y };
        }
      }
    }
    return { x: 0, y: 0 };
  };

  const party = units.filter((u) => u.side === "party");
  const enemies = units.filter((u) => u.side === "enemy");

  const partyCandidates = spawnTiles(grid, "party", party.length);
  party.forEach((u, i) => {
    const tile = take(partyCandidates, partyCandidates[i]);
    u.x = tile.x;
    u.y = tile.y;
  });

  const bossCenter = { x: grid.width - 1, y: Math.floor(grid.height / 2) };
  const enemyCandidates = spawnTiles(grid, "enemy", enemies.length);
  // Bosses first so they claim the back-center anchor.
  const orderedEnemies = [...enemies].sort((a, b) => Number(!!b.isBoss) - Number(!!a.isBoss));
  orderedEnemies.forEach((u, i) => {
    const tile = u.isBoss ? take(enemyCandidates, bossCenter) : take(enemyCandidates, enemyCandidates[i]);
    u.x = tile.x;
    u.y = tile.y;
  });

  // Nudge any unit that landed on an impassable tile (spawn strips are plains,
  // but the whole-grid fallback could land somewhere odd).
  for (const u of units) {
    if (isImpassable(grid, u.x, u.y)) {
      let best: TacticalCoord | null = null;
      let bestDist = Infinity;
      for (let y = 0; y < grid.height; y++) {
        for (let x = 0; x < grid.width; x++) {
          if (isImpassable(grid, x, y) || occupied.has(`${x},${y}`)) continue;
          const d = manhattan({ x, y }, u);
          if (d < bestDist) {
            bestDist = d;
            best = { x, y };
          }
        }
      }
      if (best) {
        occupied.delete(`${u.x},${u.y}`);
        occupied.add(`${best.x},${best.y}`);
        u.x = best.x;
        u.y = best.y;
      }
    }
  }
}
