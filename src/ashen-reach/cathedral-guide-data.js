/** Read the already-authored route registry. These are route schematics, not new
 * walkable paths or a replacement for Havok's physical surfaces. */
export function floorRouteSegments(points, floorY) {
  return (points ?? []).slice(1).flatMap((p,i) =>
    Math.abs(p[1]-floorY)<.2&&Math.abs(points[i][1]-floorY)<.2 ? [[points[i],p]] : []);
}
const routeBounds=points=>({minX:Math.min(...points.map(p=>p[0]))-1.5,maxX:Math.max(...points.map(p=>p[0]))+1.5,
  minZ:Math.min(...points.map(p=>p[2]))-1.5,maxZ:Math.max(...points.map(p=>p[2]))+1.5});
const inside=(p,b)=>p[0]>=b.minX&&p[0]<=b.maxX&&p[2]>=b.minZ&&p[2]<=b.maxZ;

export function cathedralGuideLevels(cathedral) {
  const e=cathedral?.exploration;
  if(!e?.undercroft||!e.gallery?.length||e.towers?.length!==2)return [];
  const ground=cathedral.floorY, gallery=e.gallery[0][1], crypt=e.undercroft;
  const levels=[{
    id:'ground',name:'Nave and chapels',floorY:ground,bounds:cathedral.terrace,room:cathedral.nave,
    segments:[...floorRouteSegments(cathedral.route.waypoints,ground),...floorRouteSegments(crypt.route,ground),
      ...e.chapels.flatMap(c=>floorRouteSegments(c.stairs,ground))],
    markers:[{name:'Entrance',point:cathedral.entry},{name:'Altar',point:cathedral.altar},
      ...e.chapels.map(c=>({name:c.name,point:c.interior})),
      ...e.towers.map(t=>({name:t.id==='west-bell'?'West bell door':'East bell door',point:t.entrance}))],
    directions:['Enter the nave from the south terrace. Both chapels open off its sides.',
      'In the west chapel, the northward descent leads to the undercroft.',
      'The separate rising stair in either chapel reaches the gallery and exterior parapet.',
      'Bell-tower doors open onto the front terrace. Each tower has its own returning stair.'],
  },{
    id:'undercroft',name:'Undercroft',floorY:crypt.floorY,bounds:routeBounds(crypt.route),room:crypt.bounds,
    segments:floorRouteSegments(crypt.route,crypt.floorY),
    markers:[{name:'Stair bottom',point:crypt.bottom},{name:'Chamber doorway',point:crypt.route.find(p=>p[1]===crypt.floorY&&inside(p,crypt.bounds))}],
    directions:['Descend from the west chapel, then turn east at the lower landing.',
      'Follow the corridor south to the memorial chamber. Walk its circuit and return by the same stair.'],
  },{
    id:'gallery',name:'Gallery and parapet',floorY:gallery,bounds:routeBounds([...e.gallery,...e.parapet]),room:cathedral.nave,
    segments:[...floorRouteSegments(e.gallery,gallery),...floorRouteSegments(e.parapet,gallery),
      ...e.chapels.flatMap(c=>[[c.gallery,c.stairs.at(-1)],[c.stairs.at(-1),c.parapet]])],
    markers:e.chapels.flatMap(c=>[{name:c.name+' stair',point:c.stairs.at(-1)},{name:c.name.startsWith('West')?'West parapet':'East parapet',point:c.parapet}]),
    directions:['Either chapel stair reaches this level. The inner gallery forms a U around the nave.',
      'At the north landings, continue outward to the guarded exterior parapet.',
      'Return to either chapel stair to descend. The bell towers use separate stairs from the front terrace.'],
  }];
  for(const t of e.towers)levels.push({id:t.id,name:t.id==='west-bell'?'West bell tower':'East bell tower',
    floorY:t.landing[1],bounds:routeBounds(t.route),stair:t.route,markers:[{name:'Bell landing',point:t.landing}],
    directions:['Enter through this tower’s door on the front terrace.',
      'Follow the switchback stair to the bell landing. Descend by the same stair to return.',
      'The diagram plots distance along the authored stair against height; it is not a floor plan.']});
  return levels;
}

/** Tower stair footprints overlap other levels in plan. Include altitude before
 * identifying them, then distinguish the basement, gallery and ground floor. */
export function cathedralGuideLocation(levels, feet) {
  const tower=levels.find(l=>l.stair&&inside(feet,l.bounds)&&feet[1]>l.stair[0][1]+.6&&feet[1]<=l.floorY+.8);
  if(tower)return tower.id;
  return levels.find(l=>!l.stair&&inside(feet,l.bounds)&&Math.abs(feet[1]-l.floorY)<.8)?.id??null;
}

export function stairDiagram(points) {
  let distance=0;
  return points.map((point,i)=>{if(i)distance+=Math.hypot(point[0]-points[i-1][0],point[2]-points[i-1][2]);return {distance,height:point[1]-points[0][1]};});
}

/** Havok feet can settle slightly above a landing. Clamp the diagram marker to
 * its route endpoints instead of wrapping that top position to the first run. */
export function stairDiagramPosition(points,relativeHeight) {
  const data=stairDiagram(points),last=data.at(-1),height=Math.max(0,Math.min(last.height,relativeHeight));
  const i=data.findIndex(p=>p.height>=height),a=data[Math.max(0,i-1)],b=data[i];
  const t=b.height===a.height?0:(height-a.height)/(b.height-a.height);
  return {height,distance:a.distance+(b.distance-a.distance)*t,totalDistance:last.distance,totalHeight:last.height};
}
