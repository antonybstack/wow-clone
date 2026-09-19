import {createArcRotateCamera, createPointLight, addToScene} from '@babylonjs/lite';
import {setInputEnabled} from '../input.js';
import './armory.css';

/** In-scene developer inspection. The renderer, actor and animation manager are shared. */
export function createArmory({scene, canvas, player, body, combat, equipment, getView, setView}) {
    const camera = createArcRotateCamera(Math.PI/2,1.36,4.8,{x:0,y:1,z:0});
    camera.fov=.56;camera.nearPlane=.05;camera.farPlane=450;
    // Two-point inspection rig. A single dim frontal lamp lit the character flat,
    // so muscle separation was invisible against the night churchyard and the
    // armory could not be used to judge anatomy at all. Key from the camera's
    // upper left, rim from behind the opposite shoulder to draw the silhouette.
    const key = createPointLight([0,3,0],0);key.diffuse=[.96,.90,.78];key.range=9;addToScene(scene,key);
    const rim = createPointLight([0,3,0],0);rim.diffuse=[.62,.72,.92];rim.range=9;addToScene(scene,rim);
    const launcher = document.createElement('button');
    launcher.id='armory-launch';launcher.textContent='Armory';launcher.title='Developer armory (C)';
    launcher.setAttribute('aria-keyshortcuts','C');launcher.setAttribute('aria-expanded','false');
    const element = document.createElement('section');
    element.id='armory';element.hidden=true;element.setAttribute('role','dialog');element.setAttribute('aria-modal','true');element.setAttribute('aria-labelledby','armory-title');
    element.innerHTML=`
      <div class="armory-stage" aria-label="Character view. Drag to orbit; scroll to zoom."></div>
      <header class="armory-heading"><small>ASHEN REACH / DEVELOPER TOOLS</small><h1 id="armory-title">The Armory</h1><p>Your character. The same world.</p></header>
      <aside class="armory-panel">
        <div class="armory-panel-title"><span>Character & equipment</span><button data-close aria-label="Close armory">×</button></div>
        <label class="armory-field">Race<select data-race><option value="human">Human</option><option value="orc">Orc</option><option value="undead" disabled>Undead — fit not ready</option></select></label>
        <p class="armory-note" data-race-note>Human is available. Orc is the print-sculpt body on the 65-joint source bind, wearing the same catalogue. Undead will unlock with its own fitted equipment.</p>
        <h2>Equipment</h2><p class="armory-note" data-equipment-status role="status" aria-live="polite"></p><div class="armory-presets">${Object.entries(equipment.presets).map(([id,preset])=>`<button data-outfit="${id}">${preset.name}</button>`).join('')}</div>
        <div class="armory-slots">${[['helmet','Helmet','Unequipped'],['torso','Torso','Base appearance'],['legs','Legs','Charcoal trousers'],['boots','Boots','Base appearance'],['gloves','Gloves','Unequipped'],['mainHand','Main hand','Unequipped'],['offHand','Off-hand','Unequipped']].map(([slot,label,value])=>`<button data-slot="${slot}" disabled><span>${label}</span><strong>${value}</strong><small>Items coming next</small></button>`).join('')}</div>
        <p class="armory-note">Select a fitted item or unequip it. Your selection stays equipped in the churchyard.</p>
        <label class="armory-check"><input type="checkbox" data-light> Inspection fill light</label>
        <button class="armory-return" data-close>Return to the churchyard <kbd>Esc</kbd></button>
      </aside>
      <footer class="armory-tools">
        <div class="armory-views" role="group" aria-label="Camera views"><button data-view="front">Front</button><button data-view="side">Side</button><button data-view="back">Back</button><button data-view="face">Face</button><button data-view="full">Full body</button></div>
        <div class="armory-animation"><label>Motion<select data-motion></select></label><button data-pause>Pause</button><output data-time></output></div>
        <input data-time-slider type="range" min="0" max="1" step="0.001" value="0" aria-label="Animation time">
        <p>Drag to orbit · Scroll to zoom · Pose previews do not move or deal damage</p>
      </footer>`;
    document.body.append(launcher,element);
    const stage=element.querySelector('.armory-stage'),motion=element.querySelector('[data-motion]'),slider=element.querySelector('[data-time-slider]'),pause=element.querySelector('[data-pause]'),timeLabel=element.querySelector('[data-time]');
    for(const slot of ['helmet','torso','legs','boots','gloves','mainHand','offHand']){
        const old=element.querySelector(`[data-slot="${slot}"]`),field=document.createElement('label');field.className='armory-equip';
        field.innerHTML=`<span>${{helmet:'Head',torso:'Torso',legs:'Legs',boots:'Boots',gloves:'Gloves',mainHand:'Main hand',offHand:'Off-hand'}[slot]}</span><select data-equipment="${slot}" aria-label="${slot} equipment"><option value="">Unequipped</option>${Object.values(equipment.items).filter(item=>item.slot===slot).map(item=>`<option value="${item.id}">${item.name}</option>`).join('')}</select>`;
        old.replaceWith(field);const select=field.querySelector('select');select.value=equipment.getState()[slot]||'';select.onchange=()=>changeEquipment(()=>equipment.equip(slot,select.value||null));
    }
    for(const button of element.querySelectorAll('[data-outfit]'))button.onclick=()=>changeEquipment(()=>equipment.equipPreset(button.dataset.outfit),true);
    async function changeEquipment(action,frame=false){
  const label=element.querySelector('[data-equipment-status]');label.textContent='Preparing equipment…';
  try{
   const result=await action();
   if(result?.status==='superseded')return;
   label.textContent=result?.status==='failed'?'Could not equip that item. Your current outfit is unchanged.':(race==='orc'?'Orc wears the same catalogue on the print-sculpt body. Report clipping.':'');
   const selection=equipment.getStatus?.().pending?equipment.getStatus().desired:equipment.getState();
   for(const select of element.querySelectorAll('[data-equipment]'))select.value=selection[select.dataset.equipment]||'';
   if(frame&&result?.status!=='failed')face('full');
  }catch(error){label.textContent='Could not equip that item. Your current outfit is unchanged.';}
 }
    let open=false, priorView='play', focusHeight=.78, drag=null, lastPaint=0;
    const raceField=element.querySelector('[data-race]'),raceNote=element.querySelector('[data-race-note]'),equipmentStatus=element.querySelector('[data-equipment-status]');
    let race='human';
    const raceScale=()=>race==='orc'?1.22:1;
    const setRaceUi=()=>{
        const orc=race==='orc';
        for(const select of element.querySelectorAll('[data-equipment]'))select.disabled=false;
        for(const button of element.querySelectorAll('[data-outfit]'))button.disabled=false;
        const selection=equipment.getState();
        for(const select of element.querySelectorAll('[data-equipment]'))select.value=selection[select.dataset.equipment]||'';
        equipmentStatus.textContent=orc?'Orc wears the same catalogue on the print-sculpt body. Report clipping.':'';
        raceNote.textContent=orc?'Orc is the print-sculpt retopo on the 65-joint source bind. The same logical items use an Orc fit; Human stays parked.':'Human is available. Undead will unlock with its own fitted equipment.';
    };
    async function chooseRace(){
        const want=raceField.value;if(want===race)return;
        const previous=race;raceField.disabled=true
        try{
            if(equipment.switchRace)await equipment.switchRace(want);
            else if(want==='orc'){equipment.setVisible(false);await body.swapSource('/ashen-reach/equipment-orc/body.glb');}
            else{body.restoreSource();equipment.setVisible(true);}
            race=want;
            body.endInspection();
            const preview=body.beginInspection();
            motion.innerHTML=preview.options.map(({id,label})=>`<option value="${id}">${label}</option>`).join('');
            slider.value='0';pause.textContent='Pause';
            focusHeight=.78*raceScale();camera.radius=4.8*raceScale();camera.beta=1.36;face('front');
            update(0);
        }catch(error){
            raceField.value=previous;
            equipmentStatus.textContent='Could not switch race. Your current character is unchanged.';
        }finally{raceField.disabled=false;setRaceUi();}
    }
    raceField.onchange=chooseRace;
    setRaceUi();
    const face = kind => {
        const facing=player.getFacing(),scale=raceScale();
        if(kind==='front') camera.alpha=Math.PI/2-facing;
        if(kind==='back') camera.alpha=-Math.PI/2-facing;
        if(kind==='side') camera.alpha=-facing;
        if(kind==='face'){focusHeight=1.56*scale;camera.radius=1.6*scale;camera.beta=1.46;}
        else if(kind==='full'){const main=equipment.getState().mainHand;const tall=main==='graveweaverStaff'||main==='graveweaverGreatstaff';focusHeight=(tall?.93:.78)*scale;camera.radius=(tall?5.35:4.8)*scale;camera.beta=1.36;}
    };
    const close = () => {
        if(!open)return;
        open=false;drag=null;key.intensity=0;rim.intensity=0;
        element.hidden=true;document.body.classList.remove('armory-open');launcher.setAttribute('aria-expanded','false');
        body.endInspection();
        setInputEnabled(true);setView(priorView);canvas.focus();
    };
    const show = () => {
        if(open)return;
        priorView=getView();
        for(const select of element.querySelectorAll('[data-equipment]'))select.value=equipment.getState()[select.dataset.equipment]||'';
        combat.interrupt('Armory opened');setInputEnabled(false);setView('play');combat.setVisible(false);
        const preview=body.beginInspection();
        motion.innerHTML=preview.options.map(({id,label})=>`<option value="${id}">${label}</option>`).join('');
        slider.value='0';pause.textContent='Pause';focusHeight=.78*raceScale();camera.radius=4.8*raceScale();camera.beta=1.36;face('front');
        open=true;scene.camera=camera;element.hidden=false;launcher.setAttribute('aria-expanded','true');
        document.body.classList.add('armory-open');element.querySelector('[data-close]').focus();update(0);
    };
    launcher.addEventListener('click',show);
    for(const button of element.querySelectorAll('[data-close]'))button.onclick=close;
    for(const button of element.querySelectorAll('[data-view]'))button.onclick=()=>face(button.dataset.view);
    motion.onchange=()=>{body.inspection?.select(motion.value);update(0);};
    pause.onclick=()=>{const preview=body.inspection;if(preview){preview.setPaused(!preview.getState().paused);update(0);}};
    slider.oninput=()=>body.inspection?.seek(Number(slider.value));
    stage.tabIndex=-1;
    stage.onpointerdown=e=>{stage.focus();if(e.button!==0&&e.button!==2)return;stage.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY};e.preventDefault();};
    stage.onpointermove=e=>{if(!drag)return;camera.alpha-=(e.clientX-drag.x)*.008;camera.beta=Math.max(.35,Math.min(2.55,camera.beta+(e.clientY-drag.y)*.006));drag={x:e.clientX,y:e.clientY};};
    stage.onpointerup=stage.onpointercancel=()=>{drag=null;};
    stage.addEventListener('wheel',e=>{e.preventDefault();camera.radius=Math.max(.8,Math.min(6,camera.radius*Math.exp(e.deltaY*.001)));},{passive:false});
    // Capture before the shared gameplay key handlers, including V/R/H and spells.
    window.addEventListener('keydown',e=>{
        if(!open){
            if(e.code==='KeyC'&&!e.repeat&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)){e.preventDefault();e.stopImmediatePropagation();show();}
            return;
        }
        if(e.code==='Escape'||(e.code==='KeyC'&&!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)close();return;}
        // Let native controls use arrows/space; never let their keys reach gameplay.
        e.stopPropagation();
        if(e.code==='Tab'){
            const controls=[...element.querySelectorAll('button:not(:disabled),select,input')],i=controls.indexOf(document.activeElement);
            if(e.shiftKey&&i<=0){e.preventDefault();controls.at(-1).focus();}
            else if(!e.shiftKey&&(i===controls.length-1||i<0)){e.preventDefault();controls[0].focus();}
        }
    },true);
    const update = dt => {
        if(!open)return;
        const p=player.body.position,feet=p.y-player.capsuleHeight/2;
        // Offset toward the panel to keep the character centered in the usable stage.
        const offset=innerWidth>760?.38:0;
        camera.target.x=p.x-Math.sin(camera.alpha)*offset;
        camera.target.z=p.z+Math.cos(camera.alpha)*offset;
        camera.target.y=feet+focusHeight;
        const lit=element.querySelector('[data-light]').checked;
        key.position.set(p.x+Math.cos(camera.alpha+.6)*2.1,feet+2.5,p.z+Math.sin(camera.alpha+.6)*2.1);
        key.intensity=lit?9:0;
        rim.position.set(p.x-Math.cos(camera.alpha+1.5)*2.3,feet+2.1,p.z-Math.sin(camera.alpha+1.5)*2.3);
        rim.intensity=lit?4:0;
        lastPaint+=dt;if(lastPaint<.05&&dt!==0)return;lastPaint=0;
        const state=body.inspection?.getState();if(!state)return;
        slider.max=String(state.duration);slider.value=String(state.time);
        timeLabel.textContent=`${state.time.toFixed(2)} / ${state.duration.toFixed(2)} s`;
        pause.textContent=state.paused?'Play':'Pause';pause.setAttribute('aria-pressed',String(state.paused));
    };
    // setFocus lets a capture script frame a body region the five preset views do
    // not cover (torso, legs, shoulder junction) without hand-dragging the stage.
    const setFocus = ({height, radius, beta, alpha}={}) => {
        if(height!==undefined)focusHeight=height*raceScale();
        if(radius!==undefined)camera.radius=radius*raceScale();
        if(beta!==undefined)camera.beta=beta;
        if(alpha!==undefined)camera.alpha=alpha-player.getFacing();
    };
    return {open:show,close,update,camera,setFocus,get isOpen(){return open;},getState:()=>({open, race,preview:body.inspection?.getState()||null})};
}
