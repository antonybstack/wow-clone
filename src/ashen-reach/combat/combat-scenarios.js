/** Reversible diagnostic fixtures, deliberately separate from the encounter.
 * No actors/assets are created. The owner suppresses XP/journal writes while active.
 */
export const COMBAT_SCENARIOS = Object.freeze([
  { id: 'dummy', name: 'Training dummy', note: 'Current spells, repress, movement, target switching and mana exhaustion.' },
  { id: 'pack', name: 'Three-target pack', note: 'Three stationary shades, no rewards. Diagnostic placement; normal damage and mana.' },
  { id: 'cathedral', name: 'Cathedral wall / floor', note: 'Nave, side chapel and gallery targets. Walk and test actual walls and floor separation.' },
  { id: 'mortal', name: 'Mortal combat route', note: 'Ordinary shade AI, God / Fly off. No rewards or journal changes during rehearsal.' },
]);
const entityKeys = ['hp', 'hpMax', 'hostile', 'hits', 'hitsLanded', 'state', 'stateAge', 'idleFor', 'waypoint', 'attackCooldown', 'age', 'deadAge', 'hidden', 'yaw', 'lockedState', 'diagnosticFloorY'];
const captureEntity = entity => ({ entity, position: { ...entity.position }, values: Object.fromEntries(entityKeys.map(k => [k, entity[k]])) });
const primitives = object => Object.fromEntries(Object.entries(object).filter(([, v]) => ['number', 'boolean', 'string'].includes(typeof v)));
export function createCombatScenarios({ enabled, ready, player, rig, life, progress, dummy, enemies, dev, destinations, groundHeight, reset, syncEnemy, setModes }) {
  let saved = null, active = null;
  function restore() {
    if (!saved) return false;
    reset();
    Object.assign(life, saved.life);
    // xpToNext is a getter; only restore mutable data fields.
    for (const [key, value] of Object.entries(saved.progress)) if (key !== 'xpToNext') progress[key] = value;
    for (const { entity, position, values } of saved.entities) {
      Object.assign(entity.position, position);
      for (const [key, value] of Object.entries(values)) {
        if (value === undefined) delete entity[key]; else entity[key] = value;
      }
      syncEnemy(entity);
    }
    player.setWorldPos(saved.position.x, saved.position.y, saved.position.z);
    player.setFacing(saved.facing);
    Object.assign(rig, saved.rig);
    setModes(saved.god, saved.flying);
    active = saved = null;
    return true;
  }
  return {
    list: COMBAT_SCENARIOS,
    get active() { return active; },
    restore,
    start(id) {
      const scenario = COMBAT_SCENARIOS.find(s => s.id === id);
      if (!enabled() || !ready() || !scenario || life.dead || enemies.length < 3) return false;
      const places = destinations();
      const nave = places.find(p => p.id === 'cathedral-nave');
      const chapel = places.find(p => p.id === 'cathedral-west-chapel');
      const gallery = places.find(p => p.id === 'cathedral-gallery');
      if (id === 'cathedral' && (!nave || !chapel || !gallery)) return false;
      restore();
      saved = { position: { ...player.body.position }, facing: player.getFacing(),
        rig: { yaw: rig.yaw, pitch: rig.pitch, distance: rig.distance },
        god: dev.god, flying: dev.flying, life: { ...life }, progress: primitives(progress),
        entities: [dummy, ...enemies].map(captureEntity) };
      reset();
      active = id;
      setModes(false, false);
      life.hp = life.hpMax; life.dead = false; life.inCombat = false; life.combatUntil = 0;
      progress.mana = progress.manaMax;
      dummy.hp = dummy.hpMax;
      let floor = [dummy.position.x, groundHeight(dummy.position.x, dummy.position.z - 5), dummy.position.z - 5];
      if (id === 'cathedral') floor = nave.floor;
      if (id === 'mortal') {
        const enemy = enemies[0];
        floor = [enemy.spawn.x, groundHeight(enemy.spawn.x, enemy.spawn.z - 10), enemy.spawn.z - 10];
      }
      if (id === 'pack' || id === 'cathedral') {
        const points = id === 'pack'
          ? [-2, 0, 2].map(x => [floor[0] + x, groundHeight(floor[0] + x, floor[2] + 5), floor[2] + 5])
          : [[floor[0], floor[1], floor[2] + 4], chapel.floor, gallery.floor];
        enemies.slice(0, 3).forEach((enemy, i) => {
          const [x, y, z] = points[i];
          Object.assign(enemy.position, { x, y, z });
          Object.assign(enemy, { hp: enemy.hpMax, hostile: true, hidden: false, state: 'diagnostic',
            stateAge: 0, deadAge: 0, lockedState: true, diagnosticFloorY: y });
          syncEnemy(enemy);
        });
      }
      player.setWorldPos(floor[0], floor[1] + player.capsuleHeight / 2 + .12, floor[2]);
      player.setFacing(0); rig.yaw = 0; rig.pitch = .04; rig.distance = 3.5;
      return true;
    },
  };
}
