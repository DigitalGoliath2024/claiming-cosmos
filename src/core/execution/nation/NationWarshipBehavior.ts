import {
  AllPlayers,
  Difficulty,
  Game,
  Gold,
  Player,
  PlayerType,
  Unit,
  UnitType,
} from "../../game/Game";
import { playerDocks } from "../../game/NavalDomain";
import { TileRef } from "../../game/GameMap";
import { PseudoRandom } from "../../PseudoRandom";
import { ConstructionExecution } from "../ConstructionExecution";
import {
  EMOJI_WARSHIP_RETALIATION,
  NationEmojiBehavior,
} from "./NationEmojiBehavior";

export class NationWarshipBehavior {
  // Track our transport ships we currently own
  private trackedTransportShips: Set<Unit> = new Set();
  // Track our trade ships we currently own
  private trackedTradeShips: Set<Unit> = new Set();
  // Track incoming transport ships
  private trackedIncomingTransportShips: Set<Unit> = new Set();
  // Track incoming transport ships we have dealt with
  private dealtWithTransportShip: Set<Unit> = new Set();

  constructor(
    private random: PseudoRandom,
    private game: Game,
    private player: Player,
    private emojiBehavior: NationEmojiBehavior,
  ) {}

  maybeSpawnWarship(): boolean {
    if (this.player === null) throw new Error("not initialized");
    if (!this.random.chance(50)) {
      return false;
    }
    const harborFirst = this.random.chance(2);
    return harborFirst
      ? this.trySpawnCombatHull(UnitType.Port, UnitType.Warship) ||
          this.trySpawnCombatHull(UnitType.Starport, UnitType.Voidship)
      : this.trySpawnCombatHull(UnitType.Starport, UnitType.Voidship) ||
          this.trySpawnCombatHull(UnitType.Port, UnitType.Warship);
  }

  private trySpawnCombatHull(
    dockType: UnitType.Port | UnitType.Starport,
    shipType: UnitType.Warship | UnitType.Voidship,
  ): boolean {
    if (this.game.config().isUnitDisabled(shipType)) {
      return false;
    }
    const docks = this.player.units(dockType);
    const ships = this.player.units(shipType);
    if (
      docks.length === 0 ||
      ships.length > 0 ||
      this.player.gold() <= this.cost(shipType)
    ) {
      return false;
    }
    const dock = this.random.randElement(docks);
    const targetTile = this.warshipSpawnTile(dock.tile(), 250);
    if (targetTile === null) {
      return false;
    }
    if (this.player.canBuild(shipType, targetTile) === false) {
      return false;
    }
    this.game.addExecution(
      new ConstructionExecution(this.player, shipType, targetTile),
    );
    return true;
  }

  /**
   * Nation Tender hints:
   * - Forward dock: park one off the enemy coast. Ships hit the beach, then
   *   duck back out to her 30-tile bubble instead of steaming all the way home.
   *   (WarshipExecution already retreats to a closer Tender than Port.)
   * - Follow the fleet: extra Tenders sit with hulls that are already out.
   * Port heal still wins inside Port range; do not stack.
   */
  maybeSpawnTender(): boolean {
    if (this.game.config().isUnitDisabled(UnitType.Tender)) {
      return false;
    }
    if (!this.random.chance(20)) {
      return false;
    }
    if (playerDocks(this.player).length === 0) {
      return false;
    }
    const hulls = this.combatHulls();
    if (hulls.length === 0) {
      return false;
    }
    const desired = Math.min(3, 1 + Math.floor(hulls.length / 3));
    if (this.player.units(UnitType.Tender).length >= desired) {
      return false;
    }
    if (this.player.gold() <= this.cost(UnitType.Tender)) {
      return false;
    }

    const existing = this.player.units(UnitType.Tender).length;
    const targetTile =
      existing === 0
        ? this.forwardStationTile(hulls)
        : this.fleetFollowTile(hulls);
    if (targetTile === null) {
      return false;
    }
    if (this.player.canBuild(UnitType.Tender, targetTile) === false) {
      return false;
    }
    this.game.addExecution(
      new ConstructionExecution(this.player, UnitType.Tender, targetTile),
    );
    return true;
  }

  maybeSpawnVestal(): boolean {
    if (this.game.config().isUnitDisabled(UnitType.Vestal)) {
      return false;
    }
    if (!this.random.chance(20)) {
      return false;
    }
    if (this.player.units(UnitType.Starport).length === 0) {
      return false;
    }
    const hulls = this.voidCombatHulls();
    if (hulls.length === 0) {
      return false;
    }
    const desired = Math.min(3, 1 + Math.floor(hulls.length / 3));
    if (this.player.units(UnitType.Vestal).length >= desired) {
      return false;
    }
    if (this.player.gold() <= this.cost(UnitType.Vestal)) {
      return false;
    }
    const existing = this.player.units(UnitType.Vestal).length;
    const targetTile =
      existing === 0
        ? this.forwardStationTile(hulls)
        : this.fleetFollowTile(hulls);
    if (targetTile === null) {
      return false;
    }
    if (this.player.canBuild(UnitType.Vestal, targetTile) === false) {
      return false;
    }
    this.game.addExecution(
      new ConstructionExecution(this.player, UnitType.Vestal, targetTile),
    );
    return true;
  }

  /** Keep the first Tender off the enemy coast; extras ride with the fleet. */
  maybeStationTenders(): void {
    if (this.game.config().isUnitDisabled(UnitType.Tender)) {
      return;
    }
    const tenders = this.player.units(UnitType.Tender);
    const hulls = this.combatHulls();
    if (tenders.length === 0 || hulls.length === 0) {
      return;
    }

    const range = this.game.config().tenderHealRange();
    const forward = this.enemyCoastStationTile(hulls);
    if (tenders.length === 1) {
      if (forward !== null) {
        this.parkTenderIfFar(tenders[0], forward, range);
      } else {
        this.sendTenderToward(tenders[0], this.farthestHullFromPort(hulls)!, range);
      }
      return;
    }

    const dock = this.closestTenderToPort(tenders);
    if (dock !== undefined && forward !== null) {
      this.parkTenderIfFar(dock, forward, range);
    }
    const followers = tenders.filter((t) => t !== dock);
    const farHulls = [...hulls].sort(
      (a, b) =>
        this.distToNearestPort(b.tile()) - this.distToNearestPort(a.tile()),
    );
    for (let i = 0; i < followers.length && i < farHulls.length; i++) {
      this.sendTenderToward(followers[i], farHulls[i], range);
    }
  }

  private combatHulls(): Unit[] {
    return [
      ...this.player.units(UnitType.Warship),
      ...this.player.units(UnitType.Marauder),
    ];
  }

  private voidCombatHulls(): Unit[] {
    return [
      ...this.player.units(UnitType.Voidship),
      ...this.player.units(UnitType.Corsair),
    ];
  }

  private forwardStationTile(hulls: Unit[]): TileRef | null {
    return (
      this.enemyCoastStationTile(hulls) ??
      this.fleetFollowTile(hulls) ??
      this.coastalStationTile()
    );
  }

  private hostilePlayers(): Player[] {
    return this.game.players().filter((p) => {
      if (p.id() === this.player.id() || !p.isAlive()) {
        return false;
      }
      return !this.player.isFriendly(p);
    });
  }

  private attackTargetEnemies(): Player[] {
    const seen = new Set<string>();
    const out: Player[] = [];
    for (const attack of this.player.outgoingAttacks()) {
      const target = attack.target();
      if (!target.isPlayer() || this.player.isFriendly(target)) {
        continue;
      }
      if (seen.has(target.id())) {
        continue;
      }
      seen.add(target.id());
      out.push(target);
    }
    return out;
  }

  /** Water just off a hostile shore so attacking hulls can duck out and heal. */
  private enemyCoastStationTile(hulls: Unit[]): TileRef | null {
    const enemies = [...this.attackTargetEnemies(), ...this.hostilePlayers()];
    const seen = new Set<string>();
    for (const enemy of enemies) {
      if (seen.has(enemy.id())) {
        continue;
      }
      seen.add(enemy.id());
      const tile = this.waterOffCoast(enemy);
      if (tile !== null) {
        return tile;
      }
    }
    void hulls;
    return null;
  }

  private waterOffCoast(enemy: Player): TileRef | null {
    const shores: TileRef[] = [];
    enemy.borderTiles().forEach((tile) => {
      if (this.game.isShore(tile)) {
        shores.push(tile);
      }
    });
    if (shores.length === 0) {
      return null;
    }
    const start = this.random.nextInt(0, shores.length);
    for (let i = 0; i < shores.length; i++) {
      const shore = shores[(start + i) % shores.length];
      let water: TileRef | undefined;
      this.game.forEachNeighbor(shore, (neighbor) => {
        if (water !== undefined) {
          return;
        }
        if (
          this.game.isWater(neighbor) &&
          this.player.canBuild(UnitType.Tender, neighbor) !== false
        ) {
          water = neighbor;
        }
      });
      if (water === undefined) {
        continue;
      }
      return this.warshipSpawnTile(water, 12) ?? water;
    }
    return null;
  }

  private coastalStationTile(): TileRef | null {
    const ports = playerDocks(this.player);
    if (ports.length === 0) {
      return null;
    }
    const port = this.random.randElement(ports);
    return (
      this.warshipSpawnTile(port.tile(), 15) ??
      this.warshipSpawnTile(port.tile(), 40)
    );
  }

  private fleetFollowTile(hulls: Unit[]): TileRef | null {
    const hull = this.farthestHullFromPort(hulls);
    if (hull === undefined) {
      return null;
    }
    const center = hull.warshipState().patrolTile ?? hull.tile();
    return this.warshipSpawnTile(center, this.game.config().tenderHealRange());
  }

  private farthestHullFromPort(hulls: Unit[]): Unit | undefined {
    if (hulls.length === 0) {
      return undefined;
    }
    let best = hulls[0];
    let bestDist = this.distToNearestPort(best.tile());
    for (let i = 1; i < hulls.length; i++) {
      const dist = this.distToNearestPort(hulls[i].tile());
      if (dist > bestDist) {
        best = hulls[i];
        bestDist = dist;
      }
    }
    return best;
  }

  private closestTenderToPort(tenders: Unit[]): Unit | undefined {
    if (tenders.length === 0) {
      return undefined;
    }
    let best = tenders[0];
    let bestDist = this.distToNearestPort(best.tile());
    for (let i = 1; i < tenders.length; i++) {
      const dist = this.distToNearestPort(tenders[i].tile());
      if (dist < bestDist) {
        best = tenders[i];
        bestDist = dist;
      }
    }
    return best;
  }

  private distToNearestPort(tile: TileRef): number {
    const ports = playerDocks(this.player);
    if (ports.length === 0) {
      return Number.MAX_SAFE_INTEGER;
    }
    let best = this.game.manhattanDist(tile, ports[0].tile());
    for (let i = 1; i < ports.length; i++) {
      const dist = this.game.manhattanDist(tile, ports[i].tile());
      if (dist < best) {
        best = dist;
      }
    }
    return best;
  }

  private sendTenderToward(tender: Unit, hull: Unit, range: number): void {
    const dest = hull.warshipState().patrolTile ?? hull.tile();
    const station = this.game.isWater(dest)
      ? dest
      : this.warshipSpawnTile(hull.tile(), range);
    if (station === null) {
      return;
    }
    this.parkTenderIfFar(tender, station, range);
  }

  private parkTenderIfFar(tender: Unit, dest: TileRef, range: number): void {
    const here = tender.warshipState().patrolTile ?? tender.tile();
    if (this.game.manhattanDist(here, dest) <= range) {
      return;
    }
    tender.updateWarshipState({ patrolTile: dest });
  }

  private warshipSpawnTile(portTile: TileRef, radius: number): TileRef | null {
    for (let attempts = 0; attempts < 50; attempts++) {
      const randX = this.random.nextInt(
        this.game.x(portTile) - radius,
        this.game.x(portTile) + radius,
      );
      const randY = this.random.nextInt(
        this.game.y(portTile) - radius,
        this.game.y(portTile) + radius,
      );
      if (!this.game.isValidCoord(randX, randY)) {
        continue;
      }
      const tile = this.game.ref(randX, randY);
      // Sanity check
      if (!this.game.isWater(tile)) {
        continue;
      }
      return tile;
    }
    return null;
  }

  trackShipsAndRetaliate(): void {
    this.trackTransportShipsAndRetaliate();
    this.trackTradeShipsAndRetaliate();
    this.trackIncomingTransportsAndRetaliate();
  }

  // Send out a warship if our transport ship got captured
  private trackTransportShipsAndRetaliate(): void {
    if (this.game.config().isUnitDisabled(UnitType.TransportShip)) {
      return;
    }
    // Add any currently owned transport ships to our tracking set
    this.player
      .units(UnitType.TransportShip)
      .forEach((u) => this.trackedTransportShips.add(u));

    // Iterate tracked transport ships; if it got destroyed by an enemy:
    // retaliate. Deleting the current entry while iterating a Set is safe.
    for (const ship of this.trackedTransportShips) {
      if (!ship.isActive()) {
        // Distinguish between arrival/retreat and enemy destruction
        if (ship.wasDestroyedByEnemy() && ship.destroyer() !== undefined) {
          this.maybeRetaliateWithWarship(
            ship.tile(),
            ship.destroyer()!,
            "transport",
          );
        }
        this.trackedTransportShips.delete(ship);
      }
    }
  }

  // Send out a warship if our trade ship got captured
  private trackTradeShipsAndRetaliate(): void {
    // Add any currently owned trade ships to our tracking map
    this.player
      .units(UnitType.TradeShip)
      .forEach((u) => this.trackedTradeShips.add(u));

    // Iterate tracked trade ships; if we no longer own it, it was captured:
    // retaliate. Deleting the current entry while iterating a Set is safe.
    for (const ship of this.trackedTradeShips) {
      if (!ship.isActive()) {
        this.trackedTradeShips.delete(ship);
        continue;
      }
      if (ship.owner().id() !== this.player.id()) {
        // Ship was ours and is now owned by someone else -> captured
        this.maybeRetaliateWithWarship(ship.tile(), ship.owner(), "trade");
        this.trackedTradeShips.delete(ship);
      }
    }
  }

  private trackIncomingTransportsAndRetaliate(): void {
    // Add any transports which are targeting us to our tracking map
    for (const p of this.game.units(UnitType.TransportShip)) {
      const target = p.targetTile();
      if (
        target &&
        p.isActive() &&
        !p.transportShipState().isRetreating &&
        this.game.ownerID(target) === this.player?.smallID() &&
        p.owner().smallID() !== this.player?.smallID()
      ) {
        this.trackedIncomingTransportShips.add(p);
      }
    }

    // Deleting the current entry while iterating a Set is safe.
    for (const transport of this.trackedIncomingTransportShips) {
      const target = transport.targetTile();
      if (
        !transport.isActive() ||
        target === undefined ||
        transport.transportShipState().isRetreating
      ) {
        this.trackedIncomingTransportShips.delete(transport);
        this.dealtWithTransportShip.delete(transport);
        continue;
      }
      // Transport has already been dealt with
      if (this.dealtWithTransportShip.has(transport)) {
        continue;
      }

      const distanceToTarget = this.game.manhattanDist(
        transport.tile(),
        target,
      );
      // Too close to deal with
      if (distanceToTarget < 20) {
        this.dealtWithTransportShip.add(transport);
        continue;
      }

      // Possible dock snipe counter? Too niche?
      if (!transport.owner().isAlliedWith(this.player)) {
        if (
          this.game.hasUnitNearby(
            target,
            90,
            UnitType.Warship,
            this.player.id(),
            true,
          ) ||
          this.player.units(UnitType.Warship).filter((p) => {
            const patrolTile = p.warshipState().patrolTile;
            return (
              patrolTile !== undefined &&
              this.game.manhattanDist(target, patrolTile) < 90
            );
          }).length > 0
        ) {
          this.dealtWithTransportShip.add(transport);
          continue;
        }
        const oceanTiles = this.warshipSpawnTile(target, 30);
        if (oceanTiles === null) continue;
        this.maybeRetaliateWithWarship(
          oceanTiles,
          transport.owner(),
          "transport",
        );
        this.dealtWithTransportShip.add(transport);
        break;
      }
    }
  }

  private maybeRetaliateWithWarship(
    tile: TileRef,
    enemy: Player,
    reason: "trade" | "transport",
  ): void {
    // Don't retaliate against ourselves (e.g. own nuke destroyed own ship)
    if (enemy === this.player) {
      return;
    }

    const hull = this.game.isOcean(tile)
      ? UnitType.Voidship
      : UnitType.Warship;

    // Don't send too many hulls of this fleet
    if (this.player.units(hull).length >= 10) {
      this.maybeMoveWarship(tile);
      return;
    }

    const { difficulty } = this.game.config().gameConfig();
    // In Easy never retaliate. In Medium retaliate with 15% chance. Hard with 50%, Impossible with 80%.
    if (
      (difficulty === Difficulty.Medium && this.random.nextInt(0, 100) < 15) ||
      (difficulty === Difficulty.Hard && this.random.nextInt(0, 100) < 50) ||
      (difficulty === Difficulty.Impossible && this.random.nextInt(0, 100) < 80)
    ) {
      const canBuild = this.player.canBuild(hull, tile);
      if (canBuild === false) {
        this.maybeMoveWarship(tile);
        return;
      }
      this.game.addExecution(
        new ConstructionExecution(this.player, hull, tile),
      );
      this.emojiBehavior.maybeSendEmoji(enemy, EMOJI_WARSHIP_RETALIATION);
      this.player.updateRelation(enemy, reason === "trade" ? -7.5 : -15);
    }
  }

  private maybeMoveWarship(tile: TileRef): void {
    // Make sure we are targeting water
    if (this.game.isWater(tile)) {
      const warship = this.player
        .units(this.game.isOcean(tile) ? UnitType.Voidship : UnitType.Warship)
        .filter((p) => {
          const patrolTile = p.warshipState().patrolTile;
          return (
            patrolTile !== undefined &&
            // Dont send ships which are already traveling
            this.game.manhattanDist(p.tile(), patrolTile) < 130
          );
        })
        .sort((a, b) => {
          // Sort by distance (closest first)
          const distA = this.game.manhattanDist(a.tile(), tile);
          const distB = this.game.manhattanDist(b.tile(), tile);
          return distA - distB;
        })[0];

      if (warship) {
        warship.updateWarshipState({ patrolTile: tile });
      }
    }
  }

  // Prevent warship infestations: if current player is one of the 3 richest and an enemy has too many warships, send a counter-warship.
  // What is a warship infestation? A player tries to dominate the entire ocean to block all trade and transport boats.
  counterWarshipInfestation(): void {
    if (!this.shouldCounterWarshipInfestation()) {
      return;
    }

    const isTeamGame = this.player.team() !== null;

    if (!this.isRichPlayer(isTeamGame)) {
      return;
    }

    const target = this.findWarshipInfestationCounterTarget(isTeamGame);
    if (target !== null) {
      this.buildCounterWarship(target);
    }
  }

  private shouldCounterWarshipInfestation(): boolean {
    if (this.game.config().isUnitDisabled(UnitType.Warship)) {
      return false;
    }

    // Only the smart nations can do this
    const { difficulty } = this.game.config().gameConfig();
    if (
      difficulty !== Difficulty.Hard &&
      difficulty !== Difficulty.Impossible
    ) {
      return false;
    }

    // Quit early if there aren't many warships in the game
    if (this.game.unitCount(UnitType.Warship) <= 10) {
      return false;
    }

    // Quit early if we can't afford a warship
    if (this.cost(UnitType.Warship) > this.player.gold()) {
      return false;
    }

    // Quit early if we don't have a port to send warships from
    if (playerDocks(this.player).length === 0) {
      return false;
    }

    // Don't send too many warships
    if (this.player.units(UnitType.Warship).length >= 10) {
      return false;
    }

    return true;
  }

  // Check if current player is one of the 3 richest (We don't want poor nations to use their precious gold on this)
  private isRichPlayer(isTeamGame: boolean): boolean {
    const players = this.game.players().filter((p) => {
      if (p.type() === PlayerType.Human) return false;
      return isTeamGame ? p.team() === this.player.team() : true;
    });
    const topThree = players
      .sort((a, b) => Number(b.gold() - a.gold()))
      .slice(0, 3);
    return topThree.some((p) => p.id() === this.player.id());
  }

  private findWarshipInfestationCounterTarget(
    isTeamGame: boolean,
  ): { player: Player; warship: Unit } | null {
    return isTeamGame
      ? this.findTeamGameWarshipTarget()
      : this.findFreeForAllWarshipTarget();
  }

  private findTeamGameWarshipTarget(): {
    player: Player;
    warship: Unit;
  } | null {
    const enemyTeamWarships = new Map<
      string,
      { count: number; team: string; players: Player[] }
    >();

    for (const p of this.game.players()) {
      // Skip friendly players (our team and allies)
      if (this.player.isFriendly(p) || p.id() === this.player.id()) {
        continue;
      }

      const team = p.team();
      if (team === null) continue;

      const teamKey = team.toString();
      const warshipCount = p.units(UnitType.Warship).length;

      if (!enemyTeamWarships.has(teamKey)) {
        enemyTeamWarships.set(teamKey, {
          count: 0,
          team: teamKey,
          players: [],
        });
      }
      const teamData = enemyTeamWarships.get(teamKey)!;
      teamData.count += warshipCount;
      teamData.players.push(p);
    }

    // Find team with more than 15 warships
    for (const [, teamData] of enemyTeamWarships.entries()) {
      if (teamData.count > 15) {
        // Find player in that team with most warships
        const playerWithMostWarships = teamData.players.reduce(
          (max, p) => {
            const count = p.units(UnitType.Warship).length;
            const maxCount = max ? max.units(UnitType.Warship).length : 0;
            return count > maxCount ? p : max;
          },
          null as Player | null,
        );

        if (playerWithMostWarships) {
          const warships = playerWithMostWarships.units(UnitType.Warship);
          if (warships.length > 3) {
            return {
              player: playerWithMostWarships,
              warship: this.random.randElement(warships),
            };
          }
        }
      }
    }

    return null;
  }

  private findFreeForAllWarshipTarget(): {
    player: Player;
    warship: Unit;
  } | null {
    const enemies = this.game
      .players()
      .filter((p) => !this.player.isFriendly(p) && p.id() !== this.player.id());

    for (const enemy of enemies) {
      const enemyWarships = enemy.units(UnitType.Warship);
      if (enemyWarships.length > 10) {
        return {
          player: enemy,
          warship: this.random.randElement(enemyWarships),
        };
      }
    }

    return null;
  }

  private buildCounterWarship(target: { player: Player; warship: Unit }): void {
    const tile = target.warship.tile();
    const hull = this.game.isOcean(tile)
      ? UnitType.Voidship
      : UnitType.Warship;
    const canBuild = this.player.canBuild(hull, tile);
    if (canBuild === false) {
      this.maybeMoveWarship(tile);
      return;
    }

    this.game.addExecution(
      new ConstructionExecution(this.player, hull, tile),
    );
    this.emojiBehavior.sendEmoji(AllPlayers, EMOJI_WARSHIP_RETALIATION);
  }

  private cost(type: UnitType): Gold {
    return this.game.unitInfo(type).cost(this.game, this.player);
  }
}
