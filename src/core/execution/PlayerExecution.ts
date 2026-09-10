import { Config } from "../configuration/Config";
import {
  Cell,
  Execution,
  Game,
  Player,
  PlayerType,
  Structures,
  UnitType,
} from "../game/Game";
import { GameMap, TileRef } from "../game/GameMap";
import { tryClaimClusterCalcSlot } from "../game/TickWorkBudget";
import {
  bumpTraversalGeneration,
  tileTraversalScratch,
  TileTraversalScratch,
} from "../game/TileTraversalScratch";
import { calculateBoundingBox, getMode, inscribed, simpleHash } from "../Util";

export class PlayerExecution implements Execution {
  private readonly ticksPerClusterCalc = 30;

  private config: Config;
  private lastCalc = 0;
  private mg: Game;
  // Direct GameMap reference to skip the Game delegation hop in hot loops.
  private map: GameMap;
  private active = true;
  // Reusable neighbor buffer to avoid closures/allocation in cluster checks.
  private nbuf: TileRef[] = [0, 0, 0, 0];

  constructor(private player: Player) {}

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  init(mg: Game, ticks: number) {
    this.mg = mg;
    this.map = mg.map();
    this.config = mg.config();
    // Spread cluster work across a wide window so large-map empires do not
    // all land their expensive border floods on the same tick.
    this.lastCalc =
      ticks + (simpleHash(this.player.id()) % this.ticksPerClusterCalc);
  }

  tick(ticks: number) {
    this.player.decayRelations();
    for (const u of this.player.units()) {
      if (!Structures.has(u.type())) {
        continue;
      }

      const owner = this.mg!.owner(u.tile());
      if (!owner?.isPlayer()) {
        u.delete();
        continue;
      }
      if (owner === this.player) {
        continue;
      }

      const captor = this.mg!.player(owner.id());
      if (
        u.type() === UnitType.DefensePost ||
        u.type() === UnitType.InlandBattery ||
        this.config.unitInfo(u.type()).unique
      ) {
        u.delete(true, captor);
      } else {
        captor.captureUnit(u);
      }
    }

    if (!this.player.isAlive()) {
      this.removeOnDeath();
      this.active = false;
      // OFM live standings: finishing place = non-bot players still standing when
      // we fell, + 1 (we are the last of them). players() is alive-only and we
      // just dropped to zero tiles, so it already excludes us. Bots are fill, not
      // competitors, so they don't count. Deterministic (same on every client).
      // Fallback path: conquest deaths are stamped in GameImpl.conquerPlayer (so a
      // game-ending tick still records it); recordDeathPosition is first-write-wins.
      const stillStanding = this.mg
        .players()
        .filter((p) => p.type() !== PlayerType.Bot).length;
      this.mg.stats().recordDeathPosition(this.player, stillStanding + 1);
      this.mg.stats().playerKilled(this.player, ticks);
      return;
    }

    const troopInc = this.config.troopIncreaseRate(this.player);
    this.player.addTroops(troopInc);
    const goldFromWorkers = this.config.goldAdditionRate(this.player);
    this.player.addGold(goldFromWorkers);

    // Record stats
    this.mg.stats().goldWork(this.player, goldFromWorkers);

    for (const alliance of this.player.alliances()) {
      if (alliance.expiresAt() <= this.mg.ticks()) {
        alliance.expire();
      }
    }

    for (const embargo of this.player.getEmbargoes()) {
      if (
        embargo.isTemporary &&
        this.mg.ticks() - embargo.createdAt >
          this.mg.config().temporaryEmbargoDuration()
      ) {
        this.player.stopEmbargo(embargo.target);
      }
    }

    if (ticks - this.lastCalc > this.clusterCalcInterval()) {
      if (this.player.lastTileChange() >= this.lastCalc) {
        // Cap to one full border flood per tick across all players so large
        // empires cannot stack 300–500ms hits on the same frame.
        if (!tryClaimClusterCalcSlot(ticks)) {
          return;
        }
        this.lastCalc = ticks;
        this.removeClusters();
      }
    }
  }

  private clusterCalcInterval(): number {
    const tiles = this.player.numTilesOwned();
    const border = this.player.borderTiles().size;
    // Cosmic maps grow huge borders; full cluster floods used to stack across
    // nations and spike a tick past 800ms. Keep enclaves correct, just rarer.
    let interval: number;
    if (tiles < 100) {
      interval = 15;
    } else if (tiles < 5000) {
      interval = this.ticksPerClusterCalc;
    } else if (tiles < 20000) {
      interval = 80;
    } else if (tiles < 100000) {
      interval = 160;
    } else {
      interval = 240;
    }
    // Border length dominates cost more than owned tiles on void maps.
    if (border > 8000) {
      interval = Math.max(interval, 250);
    }
    if (border > 20000) {
      interval = Math.max(interval, 450);
    }
    if (border > 40000) {
      interval = Math.max(interval, 900);
    }
    return interval;
  }

  private removeClusters() {
    const { clusters, largestBox, largestSize } = this.calculateClusters();

    this.player.largestClusterBoundingBox = largestBox;

    if (clusters.length === 0) {
      return;
    }

    // Enclaves worth deleting are small relative to the main blob. Skipping
    // continent-sized secondary clusters avoids O(border) work that never
    // removes anything on sprawling cosmic maps.
    const enclaveLimit = Math.max(250, (largestSize / 20) | 0);

    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];
      if (cluster.length > enclaveLimit) continue;
      if (cluster.length === largestSize) {
        const clusterBox = calculateBoundingBox(this.mg, cluster);
        const surroundedBy = this.surroundedBySamePlayer(cluster, clusterBox);
        if (surroundedBy && !surroundedBy.isFriendly(this.player)) {
          this.removeCluster(cluster);
        }
      } else if (this.isSurrounded(cluster)) {
        this.removeCluster(cluster);
      }
    }
  }

  private surroundedBySamePlayer(
    cluster: readonly TileRef[],
    clusterBox: { min: Cell; max: Cell },
  ): false | Player {
    const enemies = new Set<number>();

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    const map = this.map;
    const mySmallID = this.player.smallID();
    for (const tile of cluster) {
      if (map.isOceanShore(tile) || map.isOnEdgeOfMap(tile)) {
        return false;
      }
      const numNeighbors = map.neighbors4(tile, this.nbuf);
      for (let i = 0; i < numNeighbors; i++) {
        const n = this.nbuf[i];
        const ownerId = map.ownerID(n);
        if (ownerId === 0) {
          // Unowned neighbor: the cluster is not fully surrounded.
          return false;
        }
        if (ownerId !== mySmallID) {
          enemies.add(ownerId);
          const px = map.x(n);
          const py = map.y(n);
          minX = Math.min(minX, px);
          minY = Math.min(minY, py);
          maxX = Math.max(maxX, px);
          maxY = Math.max(maxY, py);
        }
      }
      if (enemies.size !== 1) {
        return false;
      }
    }
    if (enemies.size !== 1) {
      return false;
    }

    const enemy = this.mg.playerBySmallID(Array.from(enemies)[0]) as Player;
    const localEnemyBox = {
      min: new Cell(minX, minY),
      max: new Cell(maxX, maxY),
    };
    if (inscribed(localEnemyBox, clusterBox)) {
      return enemy;
    }
    return false;
  }

  private isSurrounded(cluster: readonly TileRef[]): boolean {
    let hasEnemy = false;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    const map = this.map;
    const mySmallID = this.player.smallID();
    for (const tr of cluster) {
      if (map.isShore(tr) || map.isOnEdgeOfMap(tr)) {
        return false;
      }
      const numNeighbors = map.neighbors4(tr, this.nbuf);
      for (let i = 0; i < numNeighbors; i++) {
        const n = this.nbuf[i];
        const ownerId = map.ownerID(n);
        if (ownerId !== 0 && ownerId !== mySmallID) {
          hasEnemy = true;
          const x = map.x(n);
          const y = map.y(n);
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    if (!hasEnemy) {
      return false;
    }
    const clusterBox = calculateBoundingBox(this.mg, cluster);
    const enemyBox = { min: new Cell(minX, minY), max: new Cell(maxX, maxY) };
    return inscribed(enemyBox, clusterBox);
  }

  private removeCluster(cluster: readonly TileRef[]) {
    for (const t of cluster) {
      if (this.mg?.ownerID(t) !== this.player?.smallID()) {
        // Other removeCluster operations could change tile owners,
        // so double check.
        return;
      }
    }

    const capturing = this.getCapturingPlayer(cluster);
    if (capturing === null) {
      return;
    }

    const firstTile = cluster[0];
    if (firstTile === undefined) {
      return;
    }

    // The checks above only ever looked at this one cluster of border tiles,
    // but the fill below hands over the whole territory the cluster sits on.
    // Those are different sets: every hole in a territory — an enemy enclave,
    // a nuke crater — gives it another border cluster, so a cluster that
    // passes can be wrapped around a hole in the middle of a wide open
    // empire. Verify the land actually changing hands is sealed in.
    if (!this.isEnclosed(firstTile)) {
      return;
    }

    const tiles = this.floodFillWithGen(
      this.bumpGeneration(),
      this.traversalState().visited,
      [firstTile],
      (tile, cb) => this.mg.forEachNeighbor(tile, cb),
      (tile) => this.mg.ownerID(tile) === this.player.smallID(),
    );

    if (this.player.numTilesOwned() === tiles.length) {
      this.mg.conquerPlayer(capturing, this.player);
    }

    for (const tile of tiles) {
      capturing.conquer(tile);
    }
  }

  /**
   * Whether the player's territory reachable from `start` is walled in by
   * other players: walking from it through our own tiles and any unclaimed
   * land can never reach water or the edge of the map, so the only way out
   * is across someone else's territory.
   *
   * Unclaimed land is walked through rather than treated as a way out — a
   * crater inside our own land is a hole, not an exit — but water and the
   * map edge end it, matching what the cluster checks already require of the
   * tiles they inspect.
   */
  private isEnclosed(start: TileRef): boolean {
    const map = this.map;
    const mySmallID = this.player.smallID();
    const state = this.traversalState();
    const gen = bumpTraversalGeneration(state);
    const visited = state.visited;
    const stack = state.stack;
    stack.length = 0;
    visited[start] = gen;
    stack.push(start);

    while (stack.length > 0) {
      const tile = stack.pop()!;
      if (map.isOnEdgeOfMap(tile)) {
        return false;
      }
      const numNeighbors = map.neighbors4(tile, this.nbuf);
      for (let i = 0; i < numNeighbors; i++) {
        const n = this.nbuf[i];
        if (visited[n] === gen) {
          continue;
        }
        const ownerId = map.ownerID(n);
        if (ownerId !== 0 && ownerId !== mySmallID) {
          // Someone else's tile — part of the wall, so stop here.
          continue;
        }
        if (ownerId === 0 && !map.isLand(n)) {
          // Open water is a way out.
          return false;
        }
        visited[n] = gen;
        stack.push(n);
      }
    }
    return true;
  }

  private getCapturingPlayer(cluster: readonly TileRef[]): Player | null {
    const neighbors = new Map<Player, number>();
    const map = this.map;
    const mySmallID = this.player.smallID();
    for (const t of cluster) {
      const numNeighbors = map.neighbors4(t, this.nbuf);
      for (let i = 0; i < numNeighbors; i++) {
        const ownerId = map.ownerID(this.nbuf[i]);
        if (ownerId === 0 || ownerId === mySmallID) {
          continue;
        }
        const owner = this.mg.playerBySmallID(ownerId) as Player;
        if (!owner.isFriendly(this.player)) {
          neighbors.set(owner, (neighbors.get(owner) ?? 0) + 1);
        }
      }
    }

    // If there are no enemies, return null
    if (neighbors.size === 0) {
      return null;
    }

    // Get the largest attack from the neighbors
    let largestNeighborAttack: Player | null = null;
    let largestTroopCount = 0;
    for (const [neighbor] of neighbors) {
      for (const attack of neighbor.outgoingAttacks()) {
        if (attack.target() === this.player) {
          if (attack.troops() > largestTroopCount) {
            largestTroopCount = attack.troops();
            largestNeighborAttack = neighbor;
          }
        }
      }
    }

    if (largestNeighborAttack !== null) {
      return largestNeighborAttack;
    }

    // There are no ongoing attacks, so find the enemy with the largest border.
    return getMode(neighbors);
  }

  private calculateClusters(): {
    clusters: TileRef[][];
    largestBox: { min: Cell; max: Cell } | null;
    largestSize: number;
  } {
    const borderTiles = this.player.borderTiles();
    if (borderTiles.size === 0) {
      return { clusters: [], largestBox: null, largestSize: 0 };
    }

    const state = this.traversalState();
    const visited = state.visited;
    const map = this.map;
    // Two generation stamps on the one scratch array: first stamp every
    // border tile with `borderGen`, then flood with `currentGen`. Membership
    // becomes a single typed-array read instead of a hash probe for each of
    // the 8 neighbours of every border tile (this fill was ~15 % of a
    // headless game's CPU).
    const borderGen = this.bumpGeneration();
    borderTiles.forEach((tile) => {
      visited[tile] = borderGen;
    });
    const currentGen = this.bumpGeneration();

    // Set.forEach instead of for..of: iterating a large Set allocates an
    // iterator-result object per element, and border sets can be huge.
    const neighborFn = (tile: TileRef, cb: (neighbor: TileRef) => void) =>
      this.mg.forEachNeighborWithDiag(tile, cb);
    const includeFn = (tile: TileRef) => visited[tile] === borderGen;

    let largestSize = 0;
    let largestBox: { min: Cell; max: Cell } | null = null;

    const considerBox = (
      size: number,
      minX: number,
      minY: number,
      maxX: number,
      maxY: number,
    ) => {
      if (size <= largestSize) return;
      largestSize = size;
      largestBox = {
        min: new Cell(minX, minY),
        max: new Cell(maxX, maxY),
      };
    };

    // Shore/edge-connected border is never annexed (see isSurrounded). Mark
    // that exterior shell without allocating a giant TileRef[] — cosmic void
    // perimeters were tens of thousands of tiles.
    borderTiles.forEach((tile) => {
      if (visited[tile] === currentGen) return;
      if (!map.isOceanShore(tile) && !map.isOnEdgeOfMap(tile)) return;
      let size = 0;
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      this.floodFillMarkOnly(
        currentGen,
        visited,
        [tile],
        neighborFn,
        includeFn,
        (t) => {
          size++;
          const x = map.x(t);
          const y = map.y(t);
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        },
      );
      considerBox(size, minX, minY, maxX, maxY);
    });

    const clusters: TileRef[][] = [];
    borderTiles.forEach((startTile) => {
      if (visited[startTile] === currentGen) return;

      const cluster = this.floodFillWithGen(
        currentGen,
        visited,
        [startTile],
        neighborFn,
        includeFn,
      );
      if (cluster.length === 0) return;
      clusters.push(cluster);
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const t of cluster) {
        const x = map.x(t);
        const y = map.y(t);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      considerBox(cluster.length, minX, minY, maxX, maxY);
    });
    return { clusters, largestBox, largestSize };
  }

  owner(): Player {
    if (this.player === null) {
      throw new Error("Not initialized");
    }
    return this.player;
  }

  isActive(): boolean {
    return this.active;
  }

  private traversalState(): TileTraversalScratch {
    return tileTraversalScratch(this.mg);
  }

  private bumpGeneration(): number {
    return bumpTraversalGeneration(this.traversalState());
  }

  private floodFillWithGen(
    currentGen: number,
    visited: Uint32Array,
    startTiles: TileRef[],
    neighborFn: (tile: TileRef, callback: (neighbor: TileRef) => void) => void,
    includeFn: (tile: TileRef) => boolean,
  ): TileRef[] {
    // The visited generation array already deduplicates, so the result can be
    // a plain array (in mark order) — far cheaper than a Set of the same
    // size. The DFS stack is reused across fills via the traversal state.
    const result: TileRef[] = [];
    const stack = this.traversalState().stack;
    stack.length = 0;

    for (const start of startTiles) {
      if (visited[start] === currentGen) continue;
      if (!includeFn(start)) continue;
      visited[start] = currentGen;
      result.push(start);
      stack.push(start);
    }

    const visit = (neighbor: TileRef) => {
      if (visited[neighbor] === currentGen) {
        return;
      }
      if (!includeFn(neighbor)) {
        return;
      }
      visited[neighbor] = currentGen;
      result.push(neighbor);
      stack.push(neighbor);
    };

    while (stack.length > 0) {
      const tile = stack.pop()!;
      neighborFn(tile, visit);
    }

    return result;
  }

  /** Like floodFillWithGen but only marks visited — no TileRef[] allocation. */
  private floodFillMarkOnly(
    currentGen: number,
    visited: Uint32Array,
    startTiles: TileRef[],
    neighborFn: (tile: TileRef, callback: (neighbor: TileRef) => void) => void,
    includeFn: (tile: TileRef) => boolean,
    onTile: (tile: TileRef) => void,
  ): void {
    const stack = this.traversalState().stack;
    stack.length = 0;

    for (const start of startTiles) {
      if (visited[start] === currentGen) continue;
      if (!includeFn(start)) continue;
      visited[start] = currentGen;
      onTile(start);
      stack.push(start);
    }

    const visit = (neighbor: TileRef) => {
      if (visited[neighbor] === currentGen) {
        return;
      }
      if (!includeFn(neighbor)) {
        return;
      }
      visited[neighbor] = currentGen;
      onTile(neighbor);
      stack.push(neighbor);
    };

    while (stack.length > 0) {
      const tile = stack.pop()!;
      neighborFn(tile, visit);
    }
  }

  private removeOnDeath(): void {
    // Player (bot, human, nation) has no tiles
    // Delete any remaining gold, non-nuke units and alliances
    const gold = this.player.gold();
    this.player.removeGold(gold);

    this.player.units().forEach((u) => {
      if (
        u.type() !== UnitType.AtomBomb &&
        u.type() !== UnitType.HydrogenBomb &&
        u.type() !== UnitType.MIRVWarhead &&
        u.type() !== UnitType.MIRV
      ) {
        u.delete();
      }
    });

    this.player.removeAllAlliances();
  }
}
