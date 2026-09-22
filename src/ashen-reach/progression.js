/**
 * Experience, levels and mana. Health regeneration stays in combat.js;
 * mana uses the same out-of-combat delay and per-second rate.
 */

export const PLAYER_HP_BASE = 100;
export const PLAYER_MANA_BASE = 100;
export const HP_PER_LEVEL = 15;
export const MANA_PER_LEVEL = 15;
export const SHADE_XP = 50;
export const FIRE_BLAST_MANA = 20;
export const LAVA_BALL_MANA = 40;
export const GRAVE_PULSE_MANA = 30;

/** XP required to go from `level` to `level + 1`. */
export function xpToNext(level) {
  return 100 * Math.max(1, level);
}

export function hpMaxFor(level) {
  return PLAYER_HP_BASE + HP_PER_LEVEL * (Math.max(1, level) - 1);
}

export function manaMaxFor(level) {
  return PLAYER_MANA_BASE + MANA_PER_LEVEL * (Math.max(1, level) - 1);
}

export function manaCost(spellKey) {
  if (spellKey === 2) return LAVA_BALL_MANA;
  if (spellKey === 3) return GRAVE_PULSE_MANA;
  return FIRE_BLAST_MANA;
}

export function xpForKill(target) {
  if (!target || target.recover) return 0;
  return target.xp ?? SHADE_XP;
}

export function createProgression() {
  const progress = {
    level: 1,
    xp: 0,
    mana: PLAYER_MANA_BASE,
    manaMax: PLAYER_MANA_BASE,
    lastLevelUp: -99,
    get xpToNext() {
      return xpToNext(this.level);
    },
  };

  const snapshot = () => ({
    level: progress.level,
    xp: progress.xp,
    xpToNext: progress.xpToNext,
    mana: progress.mana,
    manaMax: progress.manaMax,
  });

  const refuseMana = (spellKey) => {
    const cost = manaCost(spellKey);
    if (progress.mana < cost) return "Not enough mana";
    return "";
  };

  const spendMana = (spellKey) => {
    const cost = manaCost(spellKey);
    if (progress.mana < cost) return false;
    progress.mana -= cost;
    return true;
  };

  const regenMana = (dt, inCombat, perSec) => {
    if (inCombat || progress.mana >= progress.manaMax) return;
    progress.mana = Math.min(progress.manaMax, progress.mana + perSec * dt);
  };

  const fillMana = () => {
    progress.mana = progress.manaMax;
  };

  const applyLevelCaps = (life) => {
    const nextHp = hpMaxFor(progress.level);
    progress.manaMax = manaMaxFor(progress.level);
    if (life) {
      life.hpMax = nextHp;
      life.hp = nextHp;
    }
    progress.mana = progress.manaMax;
  };

  const awardXp = (target, life, time) => {
    const amount = xpForKill(target);
    if (amount <= 0) return { gained: 0, leveled: false };
    progress.xp += amount;
    let leveled = false;
    while (progress.xp >= progress.xpToNext) {
      progress.xp -= progress.xpToNext;
      progress.level += 1;
      progress.lastLevelUp = time;
      leveled = true;
      applyLevelCaps(life);
    }
    return { gained: amount, leveled };
  };

  return {
    progress,
    snapshot,
    refuseMana,
    spendMana,
    regenMana,
    fillMana,
    awardXp,
  };
}
