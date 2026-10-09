import {createMapTransform,paintPlayerPin,strokeMapRoute} from './map-drawing.js';
import {cathedralGuideLevels,cathedralGuideLocation,stairDiagram,stairDiagramPosition} from './cathedral-guide-data.js';
const SIZE=560;

/** Mounted only by the late Region map provider. Static plans are cached per
 * level; the existing menu pauses movement and owns focus/input/scene abort.
 * https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
 */
export function createCathedralGuide({world,player,signal,onBack}) {
  const levels=cathedralGuideLevels(world.cathedral),layers=new Map();
  let content,canvas,ctx,select,status,directions,selectedId;
  const feet=()=>[player.body.position.x,player.body.position.y-player.capsuleHeight/2,player.body.position.z];
  function staticPlan(level){
    if(layers.has(level.id))return layers.get(level.id);
    const layer=document.createElement('canvas');layer.width=layer.height=SIZE;
    const c=layer.getContext('2d',{alpha:false});c.fillStyle='#10140f';c.fillRect(0,0,SIZE,SIZE);
    c.fillStyle='#ead1b5';c.font='20px Georgia';c.textAlign='center';c.fillText(level.name,SIZE/2,28);
    c.font='13px sans-serif';c.fillStyle='#c1c0ab';c.fillText(level.stair?'Stair ascent — distance along route':'Authored route schematic · North ↑',SIZE/2,49);
    let transform;
    if(level.stair){
      const data=stairDiagram(level.stair),last=data.at(-1),xy=p=>[50+p.distance/last.distance*460,490-p.height/last.height*380];
      c.strokeStyle='#9bdddf';c.lineWidth=3;c.beginPath();data.forEach((p,i)=>{const[x,y]=xy(p);i?c.lineTo(x,y):c.moveTo(x,y);});c.stroke();
      for(const p of [data[0],last]){const[x,y]=xy(p);c.fillStyle='#e8bb72';c.beginPath();c.arc(x,y,4,0,Math.PI*2);c.fill();}
      c.textAlign='left';c.fillStyle='#ead1b5';c.fillText('Terrace door',50,516);c.textAlign='right';c.fillText(`Bell landing · +${last.height.toFixed(1)} m`,510,90);
      c.textAlign='center';c.fillStyle='#c1c0ab';c.fillText(`${last.distance.toFixed(0)} m along the stair · return the same way`,280,543);
    }else{
      // Each plan keeps its own transform: switching levels cannot alter the
      // region chart or minimap's bounds. The shaded outline is context only.
      const b=level.bounds,spanX=b.maxX-b.minX,spanZ=b.maxZ-b.minZ;
      const baseTransform=createMapTransform({...b,minX:b.minX-spanX*.1,maxX:b.maxX+spanX*.1,minZ:b.minZ-spanZ*.1,maxZ:b.maxZ+spanZ*.1},SIZE,SIZE-64,35);
      const project=(x,z)=>{const[u,v]=baseTransform(x,z);return [u,v+64];};transform=project;
      if(level.room){const r=level.room,[x,n]=project(r.minX,r.maxZ),[east,south]=project(r.maxX,r.minZ);
        c.fillStyle='#292b23';c.fillRect(x,n,east-x,south-n);c.strokeStyle='#6a6250';c.strokeRect(x,n,east-x,south-n);}
      c.strokeStyle='#9bdddf';c.lineWidth=3;for(const segment of level.segments)strokeMapRoute(c,project,segment);
      for(const [i,marker]of level.markers.entries()){if(!marker.point)continue;const[x,y]=project(marker.point[0],marker.point[2]);c.fillStyle='#e8bb72';c.beginPath();c.arc(x,y,4,0,Math.PI*2);c.fill();c.font='12px sans-serif';
        const textWidth=c.measureText(marker.name).width,tx=Math.max(textWidth/2+5,Math.min(SIZE-textWidth/2-5,x));c.textAlign='center';
        const ty=y+(i%2?20:-7);
        // Outline the glyphs rather than covering a connection with an opaque
        // label rectangle; short stair/corridor segments must remain readable.
        c.strokeStyle='#10140f';c.lineWidth=3;c.strokeText(marker.name,tx,ty);
        c.fillStyle='#ead1b5';c.fillText(marker.name,tx,ty);}
    }
    const result={layer,transform};layers.set(level.id,result);return result;
  }
  function paint(){
    if(!content||signal.aborted)return;
    const level=levels.find(l=>l.id===selectedId),location=cathedralGuideLocation(levels,feet()),plan=staticPlan(level);
    ctx.drawImage(plan.layer,0,0);
    if(location===level.id){
      if(plan.transform)paintPlayerPin(ctx,plan.transform,player);
      else{const p=stairDiagramPosition(level.stair,feet()[1]-level.stair[0][1]);
        const x=50+p.distance/p.totalDistance*460,y=490-p.height/p.totalHeight*380;
        ctx.fillStyle='#ead1b5';ctx.beginPath();ctx.arc(x,y,6,0,Math.PI*2);ctx.fill();}
    }
    const here=levels.find(l=>l.id===location);
    status.textContent=location===level.id?(level.stair?'You are on this level. Cream marker: approximate stair progress by height.':'You are on this level. Cream marker: your position.'):here?`You are on ${here.name}. Your marker is hidden on this other level.`:'You are outside a mapped level or on a connecting stair. Your marker is hidden.';
    canvas.setAttribute('aria-label',`Vaelmark ${level.name}. ${level.stair?'Stair ascent diagram.':'Authored route schematic, north is up.'} ${status.textContent}`);
    directions.replaceChildren(...level.directions.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
  }
  function mount(container){
    if(content)return;
    content=document.createElement('div');content.className='region-map-content cathedral-guide-content';
    canvas=document.createElement('canvas');canvas.width=canvas.height=SIZE;canvas.setAttribute('role','img');
    const aside=document.createElement('div');aside.className='region-map-destinations';
    const title=document.createElement('h2');title.textContent='Vaelmark exploration';
    const label=document.createElement('label');label.textContent='Cathedral level';select=document.createElement('select');select.setAttribute('aria-label','Cathedral level');
    for(const level of levels){const option=document.createElement('option');option.value=level.id;option.textContent=level.name;select.append(option);}
    label.append(select);select.addEventListener('change',()=>{selectedId=select.value;paint();},{signal});
    directions=document.createElement('ol');directions.className='cathedral-guide-directions';
    status=document.createElement('p');status.setAttribute('role','status');status.className='region-map-status';
    const back=document.createElement('button');back.type='button';back.textContent='Back to region';back.addEventListener('click',()=>{content.hidden=true;onBack();},{signal});
    const legend=document.createElement('p');legend.className='region-map-legend';legend.textContent='Blue: authored route · Gold: connection or landmark. Shaded outlines provide context; they are not a collision map.';
    aside.append(title,label,directions,status,legend,back);content.append(canvas,aside);container.append(content);ctx=canvas.getContext('2d',{alpha:false});
  }
  signal.addEventListener('abort',()=>{content?.remove();layers.clear();content=canvas=ctx=select=status=directions=null;},{once:true});
  return {get available(){return levels.length>0;},get isOpen(){return !!content&&!content.hidden;},
    open(container){if(signal.aborted||!levels.length)return false;mount(container);content.hidden=false;selectedId=cathedralGuideLocation(levels,feet())??'ground';select.value=selectedId;paint();select.focus();return true;},
    refresh(){paint();}};
}
