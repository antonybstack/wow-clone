import {actionBindings,bindingLabel} from '../action-bindings.js';
import {ABILITIES} from './combat/ability-definitions.js';
import { onSceneDispose } from "@babylonjs/lite";
import {observeCanvasLayout} from './canvas-layout.js';
import {createHudProjection} from './hud-projection.js';
import { FIRE_BLAST } from "../spells/fire-blast.js";
import { LAVA_BALL } from "../spells/lava-ball.js";
import { GRAVE_PULSE } from "../spells/grave-pulse.js";
export function createCombatHud(canvas, scene) {
  const layout = observeCanvasLayout(canvas);
  const projection = createHudProjection(canvas, layout);
  onSceneDispose(scene, () => layout.dispose());
  const root = document.createElement("div");
  root.id = "combat";
  const icon = (s) =>
    s.key === 1 ? "fire_01.png" : s.key === 2 ? "spark_05.png" : "fire_01.png";
  const title = (s) =>
    s.key === 3
      ? `${s.name} — ${s.damage} fire damage · ${s.radius}m around you · Instant · ${s.cooldown}s cooldown`
      : `${s.name} — ${s.damage} damage · ${s.range}m · ${s.cooldown}s cooldown${s.castTime ? " · 1.5s cast, movement interrupts" : ""}`;
  root.innerHTML = `<button class="sound-toggle" type="button" aria-label="Unmute sound" aria-pressed="true">Muted</button><div class="target-plate"><span>Training Dummy</span><div class="hp-track"><div class="hp-fill"></div></div><small></small></div><div class="combat-error" role="status"></div><div class="damage-pool"></div><div class="target-auras" hidden></div><div class="player-auras" hidden></div><div class="cast-progress" hidden><span>Lava Ball</span><div role="progressbar" aria-label="Lava Ball cast" aria-valuemin="0" aria-valuemax="100"><i></i></div><small></small></div><div class="spell-bar">${[FIRE_BLAST, LAVA_BALL, GRAVE_PULSE].map((s) => `<div class="spell-slot"><button type="button" data-spell="${s.key}" title="${title(s)}"><kbd>${s.key}</kbd><img src="/ashen-reach/fire-blast/${icon(s)}" alt=""><strong></strong><i class="gcd-track" aria-hidden="true"></i></button><span>${s.name}</span><small class="action-state"></small></div>`).join("")}<div class="spell-slot attack-slot"><button type="button" data-attack aria-pressed="false" title="Auto attack">Attack<kbd>T</kbd><strong></strong></button><span>Attack</span></div></div><div class="level-up" hidden><strong>LEVEL UP</strong><small></small></div>`;
  const hudStyle = document.createElement("style");
  hudStyle.textContent =
    ".level-up{position:absolute;left:0;right:0;top:16%;text-align:center;z-index:11;pointer-events:none;color:#ffe1a8;text-shadow:0 2px 12px #000}" +
    ".level-up strong{display:block;font:18px Georgia;letter-spacing:.16em}" +
    ".level-up small{display:block;margin-top:4px;font:12px Georgia;letter-spacing:.08em;color:#ead1b5}" +
    ".world-name{position:absolute;transform:translate(-50%,-100%);font:13px Georgia,serif;letter-spacing:.03em;text-shadow:0 2px 4px #000;white-space:nowrap;pointer-events:none}" +
    ".world-name.watchman{font-size:14px;letter-spacing:.08em}" +
    ".target-plate{left:50%;top:118px;transform:translateX(-50%);width:190px;padding:7px 10px;background:#151713dc;border:1px solid #746745}.target-plate span{font-size:15px}.spell-bar{grid-template-columns:repeat(4,90px)}.action-state{height:12px;max-width:90px;font:10px system-ui;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.spell-bar button.queued{outline:2px solid #ffe0a0;outline-offset:3px}.spell-bar button.unusable img{opacity:.45}.spell-bar .gcd-track{position:absolute;bottom:-1px;left:0;height:3px;width:100%;transform:scaleX(var(--gcd,0));transform-origin:left;background:#fff0c0;z-index:4}.cast-progress{bottom:113px}.combat-error{bottom:158px}.combat-bindings{display:grid;gap:10px}.combat-bindings label{display:flex;justify-content:space-between;gap:12px}.damage-number{font-size:20px}.target-auras,.player-auras{position:absolute;left:50%;transform:translateX(-50%);font:12px system-ui}.target-auras{top:183px}.player-auras{bottom:165px}";
  root.prepend(hudStyle);
  const nameRoot = document.createElement("div");
  nameRoot.className = "world-names";
  const namePool = Array.from({ length: 8 }, () => {
    const el = document.createElement("div");
    el.className = "world-name";
    el.hidden = true;
    nameRoot.append(el);
    return el;
  });
  root.append(nameRoot);
  document.body.append(root);
  const plate = root.querySelector(".target-plate"),
    fill = root.querySelector(".hp-fill"),
    hp = root.querySelector(".target-plate small"),
    feedback = root.querySelector(".combat-error"),
    slot = root.querySelector(".spell-bar button");
  const lavaSlot = root.querySelector('[data-spell="2"]'),
    pulseSlot = root.querySelector('[data-spell="3"]'),
    castBar = root.querySelector(".cast-progress");
  const levelUp = root.querySelector(".level-up"),
    levelUpSub = root.querySelector(".level-up small");
  const text = (element,value) => { if (element.textContent !== value) element.textContent=value; };
  const damagePool = Array.from({length:6},(_,index)=>{
    const el=document.createElement('div');el.className='damage-number';el.hidden=true;root.querySelector('.damage-pool').append(el);
    return {el,remaining:0,index,position:{x:0,y:0,z:0},amount:0};
  });
  const slots=[[slot,spellId(1)],[lavaSlot,spellId(2)],[pulseSlot,spellId(3)]].map(([button,id])=>({button,id,definition:ABILITIES[id],value:button.querySelector('strong'),state:button.parentElement.querySelector('.action-state')}));
  function spellId(slot) { return Object.values(ABILITIES).find(a=>a.slot===slot).id; }
  const attackButtons=[...document.querySelectorAll('[data-attack]')];
  const syncKeys=()=>{
    const help=document.querySelector('#help > span:not(.help-secondary)');
    if(help)text(help,`WASD move · RMB look · Space jump · Tab target · ${bindingLabel(actionBindings.key('attack'))} attack · ${[1,2,3].map(id=>bindingLabel(actionBindings.key(id))).join(' / ')} spells`);
    for(const {button,definition} of slots){text(button.querySelector('kbd'),bindingLabel(actionBindings.key(definition.slot)));button.setAttribute('aria-keyshortcuts',bindingLabel(actionBindings.key(definition.slot)));}
    for(const button of attackButtons){const kbd=button.querySelector('kbd');if(kbd)text(kbd,bindingLabel(actionBindings.key('attack')));}
  };
  const unbind=actionBindings.subscribe(syncKeys);syncKeys();
  onSceneDispose(scene,()=>{unbind();root.remove();});
  let messageTime = 0, repeatedUntil=0, time=0, lastMessage='', visible = true;
  return {
    slot,
    lavaSlot,
    pulseSlot,
    soundToggle: root.querySelector(".sound-toggle"),
    setVisible(v) {
      visible = v;
      root.hidden = !v;
    },
    message(text) {
      if (text && text===lastMessage && time<repeatedUntil) return;
      feedback.textContent = text;lastMessage=text;repeatedUntil=time+1.5;
      messageTime = text?1.5:0;
    },
    hit(target, amount) {
      if (!target || amount<=0) return;
      const entry=damagePool.find(d=>d.remaining>.87&&d.targetId===target.id&&d.generation===(target.generation??0))
        ||damagePool.find(d=>d.remaining<=0)||damagePool.reduce((a,b)=>a.remaining<b.remaining?a:b);
      entry.amount=entry.remaining>.87&&entry.targetId===target.id&&entry.generation===(target.generation??0)?entry.amount+amount:amount;
      entry.targetId=target.id;entry.generation=target.generation??0;Object.assign(entry.position,target.position);entry.remaining=.95;
      text(entry.el,String(Math.round(entry.amount)));
    },
    paintMarks(camera, marks) {
      projection.begin(camera);
      let used = 0;
      for (const mark of marks || []) {
        if (used >= namePool.length) break;
        const spot = projection.project(mark.position, mark.y);
        const el = namePool[used++];
        if (!spot) {
          el.hidden = true;
          continue;
        }
        el.hidden = false;
        el.textContent = mark.text;
        el.style.color = mark.color || "#ead1b5";
        el.style.left = layout.size.left + spot.cssX + "px";
        el.style.top = layout.size.top + spot.cssY + "px";
        el.classList.toggle("watchman", !!mark.watchman);
      }
      for (; used < namePool.length; used++) namePool[used].hidden = true;
    },
    paintProgress(progress, time) {
      const fill = root.querySelector(".xp-fill");
      const text = root.querySelector(".player-xp");
      const next = progress.xpToNext || 1;
      if (fill)
        fill.style.width =
          Math.max(0, Math.min(1, progress.xp / next)) * 100 + "%";
      if (text) text.textContent = `${Math.floor(progress.xp)} / ${next}`;
      const age = time - (progress.lastLevelUp ?? -99);
      if (age >= 0 && age < 2.8) {
        levelUp.hidden = false;
        levelUpSub.textContent = `You reach level ${progress.level}`;
        const fadeIn = Math.min(1, age / 0.18);
        const fadeOut = age > 2 ? Math.max(0, 1 - (age - 2) / 0.8) : 1;
        levelUp.style.opacity = String(fadeIn * fadeOut);
      } else {
        levelUp.hidden = true;
      }
    },
    update(dt, target, spell, camera, lava, pending, gcd = 0, pulse, attack, actions = {}) {
      messageTime = Math.max(0, messageTime - dt);
      time+=dt;
      for(const d of damagePool) d.remaining=Math.max(0,d.remaining-dt);
      feedback.style.opacity = messageTime > 0 ? "1" : "0";
      if (!visible) return;
      projection.begin(camera);
      plate.hidden = !target;
      if (target) {
        text(plate.querySelector('span'),target.name||'Target');
        fill.style.width = Math.max(0,target.hp / target.hpMax) * 100 + "%";
        text(hp,target.hp>0?`${Math.ceil(target.hp)} / ${target.hpMax}`:'Defeated');
      }
      for (const d of damagePool) {
        const point=d.remaining>0&&projection.project(d.position,d.position.y+2.45+(.95-d.remaining)*.75);
        d.el.hidden=!point;
        if(point){
          d.x=layout.size.left+point.cssX;d.y=layout.size.top+point.cssY;
          // Six fixed entries bound both allocation and overlap work. Stack
          // coincident targets so a 90 + 90 never reads as a single 900 hit.
          for(let attempts=0;attempts<damagePool.length;attempts++){
            let overlap=false;
            for(let i=0;i<d.index;i++){const prior=damagePool[i];if(prior.remaining>0&&!prior.el.hidden&&Math.abs(prior.x-d.x)<48&&Math.abs(prior.y-d.y)<24){overlap=true;break;}}
            if(!overlap)break;d.y-=24;
          }
          d.el.style.left=d.x+'px';d.el.style.top=d.y+'px';d.el.style.opacity=String(Math.min(1,d.remaining*3));
        }
      }
      for(const {button,id,definition,value,state} of slots){
        const s=actions[id], cd=s?.cooldown??0, ready=s?.readyIn??0;
        const reason=({'Select a target · Tab':'Select target','Target is unavailable':'Select target','Not enough mana':'Low mana','Out of range · move closer':'Out of range','Stand still to cast':'Stand still','Land before casting':'Ground only','Face your target':'Face target','Target is blocked':'Blocked'})[s?.reason]||s?.reason;
        const label=s?.queued?'Queued':reason|| (ready>.05?(cd>.05?'Cooldown':'Global cooldown'):'Ready');
        text(value,cd>.05?cd.toFixed(1):'');text(state,label);
        button.style.setProperty('--cooldown',Math.min(1,cd/definition.cooldown));
        button.style.setProperty('--gcd',Math.min(1,gcd/1.5));
        button.classList.toggle('queued',!!s?.queued);button.classList.toggle('unusable',!!s?.reason);
        button.classList.toggle('unready',ready>.05);
        const description=`${definition.name}: ${label}${ready>.05?` · ${ready.toFixed(1)}s`:''}${s?.queuedTarget?` · ${s.queuedTarget}`:''}`;
        if(button.getAttribute('aria-label')!==description)button.setAttribute('aria-label',description);
        button.title=`${definition.name} · ${definition.castTime?definition.castTime+'s cast, movement interrupts':'Instant'} · ${definition.cost} mana · ${definition.range?definition.range+'m range':definition.radius+'m radius'} · ${definition.cooldown}s cooldown. ${label}`;
      }
      const ratio = attack?.enabled && attack.speed ? Math.max(0, Math.min(1, attack.timer / attack.speed)) : 0;
      for (const button of attackButtons) {
        button.classList.toggle("attacking", !!attack?.enabled);
        button.style.setProperty("--cooldown", attack?.enabled ? String(ratio) : "0");
        button.setAttribute("aria-pressed", attack?.enabled ? "true" : "false");
        if (attack?.name) button.title = `${attack.name} · ${attack.damage} damage · ${attack.speed.toFixed(2)}s · ${bindingLabel(actionBindings.key('attack'))} toggles`;
      }
      castBar.hidden = !pending;
      if (pending) {
        const hold = pending.castTime || LAVA_BALL.castTime;
        const fraction = Math.min(1, pending.elapsed / hold);
        castBar.querySelector("span").textContent = pending.name || "Lava Ball";
        castBar.querySelector("i").style.width = fraction * 100 + "%";
        castBar
          .querySelector("[role=progressbar]")
          .setAttribute("aria-valuenow", Math.round(fraction * 100));
        castBar.querySelector("[role=progressbar]").setAttribute("aria-label",`${pending.name} cast`);
        castBar.querySelector("small").textContent =
          Math.max(0, hold - pending.elapsed).toFixed(1) + "s";
      }
    },
  };
}
