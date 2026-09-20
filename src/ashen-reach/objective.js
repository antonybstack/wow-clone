/**
 * One Hollowmere beat: proximity at the gate watchman prompts the player to
 * clear the original four churchyard shades, then pays a completion bonus.
 *
 * Repeats after those four have all respawned. A one-shot would brick the
 * only town loop; a wall-clock cooldown would desync from the 8 s shade
 * respawn the encounter already uses.
 */
import { pathX } from "./geometry.js";

export const CHURCHYARD_SHADE_IDS = Object.freeze([
  "grave-shade-1",
  "grave-shade-2",
  "grave-shade-3",
  "grave-shade-4",
]);

export const OBJECTIVE_BONUS_XP = 100;

export const PROMPT_TEXT =
  "The watchman asks you to clear the churchyard shades.";

/** Spear townsfolk at the town gate: person(batch, pathX(75)+1.45, 77.4, π). */
export const WATCHMAN = Object.freeze({
  x: pathX(75) + 1.45,
  z: 77.4,
});

export const TRIGGER_RADIUS = 8;

const HOLD = 3.2;

export function isChurchyardShade(target) {
  return !!target && CHURCHYARD_SHADE_IDS.includes(target.id);
}

function churchyard(enemies) {
  return (enemies || []).filter(isChurchyardShade);
}

function allAlive(enemies) {
  const pack = churchyard(enemies);
  return (
    pack.length >= CHURCHYARD_SHADE_IDS.length &&
    pack.every((e) => e.hp > 0 && e.state !== "dead")
  );
}

export function createObjective() {
  const killed = new Set();
  let phase = "idle";
  let inside = false;
  let promptCount = 0;
  let completeCount = 0;
  let lastMessage = "";
  let hold = 0;

  const remaining = () =>
    CHURCHYARD_SHADE_IDS.filter((id) => !killed.has(id));

  const snapshot = () => ({
    phase,
    inside,
    promptCount,
    completeCount,
    lastMessage,
    killed: [...killed],
    remaining: remaining(),
    bonusXp: OBJECTIVE_BONUS_XP,
    watchman: { x: WATCHMAN.x, z: WATCHMAN.z },
    triggerRadius: TRIGGER_RADIUS,
  });

  const remember = (text, seconds = HOLD) => {
    lastMessage = text;
    hold = seconds;
  };

  const creditDead = (enemies) => {
    for (const enemy of churchyard(enemies)) {
      if (enemy.hp <= 0 || enemy.state === "dead") killed.add(enemy.id);
    }
  };

  const finish = () => {
    phase = "done";
    completeCount += 1;
    hold = 0;
    return { prompted: false, completed: true, message: "" };
  };

  const tick = ({ player, enemies, dt = 0, dead = false } = {}) => {
    const event = { prompted: false, completed: false, message: "" };
    if (hold > 0) {
      hold = Math.max(0, hold - (dt || 0));
      event.message = lastMessage;
    }

    if (phase === "done" && allAlive(enemies)) {
      killed.clear();
      phase = "idle";
    }

    const p = player?.body?.position;
    const dist = p
      ? Math.hypot(p.x - WATCHMAN.x, p.z - WATCHMAN.z)
      : Infinity;
    const nowInside = !dead && dist <= TRIGGER_RADIUS;
    const entered = nowInside && !inside;
    inside = nowInside;

    if (phase !== "idle" || !entered) return event;

    phase = "active";
    promptCount += 1;
    killed.clear();
    creditDead(enemies);
    if (remaining().length === 0) return finish();
    remember(PROMPT_TEXT);
    event.prompted = true;
    event.message = PROMPT_TEXT;
    return event;
  };

  const onKill = (enemy) => {
    const event = { prompted: false, completed: false, message: "" };
    if (phase !== "active" || !isChurchyardShade(enemy)) return event;
    killed.add(enemy.id);
    hold = 0;
    if (remaining().length === 0) return finish();
    return event;
  };

  const noteComplete = (gained) => {
    remember(`Churchyard cleared. +${gained} experience`);
  };

  return {
    tick,
    onKill,
    noteComplete,
    snapshot,
    bonusXp: OBJECTIVE_BONUS_XP,
  };
}
