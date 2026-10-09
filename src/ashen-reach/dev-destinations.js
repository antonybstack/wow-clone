/** Named floor positions shared by the developer menu and ?dev&at= links.
 * Read the built world's metadata; do not duplicate its terrain/floor heights.
 */
export function devDestinations(world) {
  const destinations = [];
  const add = (id, name, floor, yaw = 0) => {
    if (Array.isArray(floor) && floor.length === 3 && floor.every(Number.isFinite))
      destinations.push({id, name, floor: [...floor], yaw});
  };
  const spawn = world.spawn;
  if (spawn) add('start', 'Starting meadow', [spawn.x, world.groundHeight(spawn.x, spawn.z), spawn.z]);
  const cathedral = world.cathedral;
  if (cathedral) {
    add('cathedral-bridge', 'Vaelmark — bridge approach', cathedral.route?.waypoints?.[0]);
    add('cathedral-entrance', 'Vaelmark — entrance', cathedral.entry);
    add('cathedral-nave', 'Vaelmark — nave', cathedral.route?.waypoints?.[4]);
    const exploration = cathedral.exploration;
    for (const [i, chapel] of (exploration?.chapels || []).entries())
      add(`cathedral-${i === 0 ? 'west' : 'east'}-chapel`, `Vaelmark — ${chapel.name}`, chapel.interior, i === 0 ? -Math.PI / 2 : Math.PI / 2);
    add('cathedral-gallery', 'Vaelmark — upper gallery', exploration?.gallery?.[0], Math.PI);
    add('cathedral-parapet', 'Vaelmark — exterior parapet', exploration?.parapet?.[0]);
    for (const tower of exploration?.towers || [])
      add(`cathedral-${tower.id}`, `Vaelmark — ${tower.id === 'west-bell' ? 'west' : 'east'} bell landing`, tower.landing);
    const crypt = exploration?.undercroft;
    if (crypt) {
      // Choose the authored chamber threshold, beyond the stair corridor.
      const threshold = crypt.route.find(p => p[1] === crypt.floorY && p[0] > crypt.bounds.minX && p[0] < crypt.bounds.maxX && p[2] > crypt.bounds.minZ && p[2] < crypt.bounds.maxZ);
      add('cathedral-undercroft', 'Vaelmark — undercroft', threshold, Math.PI);
    }
  }
  for (const landmark of world.landmarks || [])
    if (landmark.kind !== 'cathedral') add(landmark.id, landmark.name, landmark.entrance, landmark.yaw || 0);
  for (const destination of world.regionStructures?.destinations || [])
    if (destination.wallWalk) add(`${destination.id}-wall-walk`, `${destination.name || 'Eastwatch'} — wall walk`, destination.wallWalk.landing, destination.wallWalk.yaw);
  return destinations;
}

export function devDestinationURL(href, id) {
  // URLSearchParams preserves other game options and safely encodes identifiers.
  // https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams/set
  const url = new URL(href);
  url.searchParams.set('dev', '');
  url.searchParams.set('play', '');
  url.searchParams.set('at', id);
  return url.href;
}
