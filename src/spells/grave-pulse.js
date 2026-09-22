/** Charged fire nova at the caster's feet. No target required. */
export const GRAVE_PULSE = Object.freeze({
  name: "Pyre Burst",
  key: 3,
  damage: 90,
  radius: 8,
  cooldown: 6,
  castTime: 1.1,
});

const xz = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export class GravePulse {
  constructor(config = GRAVE_PULSE) {
    this.config = config;
    this.cooldown = 0;
    this.casts = 0;
    this.lastResult = "";
    this.resetIn = 0;
    this.damagedTarget = null;
  }
  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.resetIn > 0) {
      this.resetIn = Math.max(0, this.resetIn - dt);
      if (!this.resetIn && this.damagedTarget) {
        this.damagedTarget.hp = this.damagedTarget.hpMax;
        this.damagedTarget = null;
      }
    }
  }
  inRange(position, hostiles = []) {
    return hostiles.filter(
      (h) =>
        h &&
        h.hp > 0 &&
        h.position &&
        xz(h.position, position) <= this.config.radius,
    );
  }
  validate({ position, grounded, hostiles = [] }) {
    if (!grounded) return "Land before casting";
    if (this.cooldown > 0) return this.config.name + " is not ready";
    if (!this.inRange(position, hostiles).length) return "No enemies in range";
    return "";
  }
  hit(target) {
    if (target.hp <= 0)
      return { ok: false, reason: "Training dummy is recovering" };
    const damage = Math.min(target.hp, this.config.damage);
    target.hp -= damage;
    target.hits = (target.hits || 0) + 1;
    if (!target.hp && target.recover) {
      this.damagedTarget = target;
      this.resetIn = 3;
    }
    return { ok: true, damage, target };
  }
  cast(args) {
    const reason = this.validate(args);
    this.lastResult = reason || "hit";
    if (reason) return { ok: false, reason, hits: [] };
    const hits = this.inRange(args.position, args.hostiles)
      .map((t) => this.hit(t))
      .filter((r) => r.ok);
    this.casts++;
    this.cooldown = this.config.cooldown;
    this.lastResult = hits.length ? "hit" : "No enemies in range";
    return {
      ok: hits.length > 0,
      hits,
      damage: hits.reduce((n, r) => n + r.damage, 0),
    };
  }
}
