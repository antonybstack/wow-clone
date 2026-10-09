/** Shared 2D chart primitives. Bounds belong to each view, never module state. */
export function createMapTransform(bounds, width, height, padding = 0) {
  const scale = Math.min((width - padding * 2) / (bounds.maxX - bounds.minX),
    (height - padding * 2) / (bounds.maxZ - bounds.minZ));
  const left = (width - (bounds.maxX - bounds.minX) * scale) / 2;
  const top = (height - (bounds.maxZ - bounds.minZ) * scale) / 2;
  return (x, z) => [left + (x - bounds.minX) * scale, top + (bounds.maxZ - z) * scale];
}

/** The central street skirts the actual well's west side, as walked in G03. */
export function streetMapX(z, pathX, well) {
  const west = well.x - 2.8;
  if (z >= well.z - 4 && z <= well.z + 4) return west;
  if (z > well.z - 8 && z < well.z - 4) {
    const t = (z - (well.z - 8)) / 4;
    return pathX(well.z - 8) * (1 - t) + west * t;
  }
  if (z > well.z + 4 && z < well.z + 6) {
    const t = (z - (well.z + 4)) / 2;
    return west * (1 - t) + pathX(well.z + 6) * t;
  }
  return pathX(z);
}

export function strokeMapRoute(ctx, transform, points) {
  if (!points?.length) return;
  ctx.beginPath();
  points.forEach(([x, , z], i) => {
    const [u, v] = transform(x, z);
    if (i) ctx.lineTo(u, v); else ctx.moveTo(u, v);
  });
  ctx.stroke();
}

export function paintMapStatic(ctx, {width, height, transform, pads, pathX, routes, landmarks, labels = false}) {
  ctx.fillStyle = '#10140f';
  ctx.fillRect(0, 0, width, height);
  for (const [z0, z1, color] of [[-93, 0, '#0c100c'], [0, 40, '#161a14'], [40, 75, '#141812'], [75, 143, '#1c2016']]) {
    const [, north] = transform(0, z1), [, south] = transform(0, z0);
    ctx.fillStyle = color; ctx.fillRect(0, north, width, Math.max(1, south - north));
  }
  ctx.fillStyle = '#5a5040';
  for (const pad of pads) {
    const [x0, north] = transform(pad.x - pad.w / 2, pad.z + pad.d / 2);
    const [x1, south] = transform(pad.x + pad.w / 2, pad.z - pad.d / 2);
    ctx.fillRect(x0, north, Math.max(labels ? 2 : 5, x1 - x0), Math.max(labels ? 2 : 5, south - north));
  }
  ctx.strokeStyle = '#6a6250'; ctx.lineWidth = labels ? 3 : 2;
  const well = pads[8], street = [];
  for (let z = -95; z <= 145; z += 2) street.push([streetMapX(z, pathX, well), 0, z]);
  // Include the well's exact turn anchors rather than cutting its ring.
  street.push(...[well.z - 8, well.z - 4, well.z + 4, well.z + 6].map(z => [streetMapX(z, pathX, well), 0, z]));
  street.sort((a, b) => a[2] - b[2]);
  strokeMapRoute(ctx, transform, street);
  ctx.strokeStyle = '#8a7a58'; ctx.lineWidth = 1;
  for (const [z, half] of [[44, 8], [75, 14]]) strokeMapRoute(ctx, transform, [[-half, 0, z], [half, 0, z]]);
  ctx.strokeStyle = '#8b8069'; ctx.lineWidth = labels ? 2 : 1;
  for (const route of routes) strokeMapRoute(ctx, transform, route.points);
  // The bridge/approach belongs to the cathedral's existing route registry.
  const cathedral = landmarks.find(site => site.kind === 'cathedral');
  strokeMapRoute(ctx, transform, cathedral?.route || [[0, 0, 145], [0, 0, 298]]);
  for (const site of landmarks) {
    const [x, y] = transform(site.x, site.z);
    ctx.fillStyle = site.kind === 'cathedral' ? '#eee0be' : '#c4ad7c';
    const half = labels ? 3 : 2;
    ctx.fillRect(x - half, y - half, half * 2, half * 2);
    if (labels) {
      ctx.font = '14px Georgia,serif';
      const dy = site.kind === 'tower' ? 19 : -10;
      const textWidth = ctx.measureText(site.name).width;
      const labelX = Math.max(8, Math.min(width - textWidth - 8, x + 9));
      ctx.fillText(site.name, labelX, y + dy);
    } else {
      ctx.font = '8px monospace';
      ctx.fillText(site.kind === 'keep' ? site.name[0] : site.kind === 'chapel' ? '+' : site.kind === 'cathedral' ? 'V' : 'T', x + 4, y + 3);
    }
  }
  const [sx, sy] = transform(0, 0);
  ctx.fillStyle = '#c4b48a'; ctx.fillRect(sx - 1, sy - 1, 3, 3);
  if (labels) {
    ctx.fillStyle = '#ead1b5'; ctx.font = '13px monospace'; ctx.fillText('N ↑', width - 48, 22);
    const [bx, by] = transform(0, 215); ctx.font = '12px Georgia,serif'; ctx.fillText('Cathedral bridge', bx + 10, by);
  }
}

/** Guidance is a blue diamond; the watchman retains its own gold chevron. */
export function paintDestinationPin(ctx, transform, site, width, height) {
  if (!site) return;
  const [x, y] = transform(site.entrance[0], site.entrance[2]);
  const u = Math.max(7, Math.min(width - 7, x)), v = Math.max(7, Math.min(height - 7, y));
  ctx.fillStyle = '#9bdddf'; ctx.strokeStyle = '#142c30'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(u, v - 6); ctx.lineTo(u + 5, v); ctx.lineTo(u, v + 6); ctx.lineTo(u - 5, v); ctx.closePath(); ctx.fill(); ctx.stroke();
}

export function paintPlayerPin(ctx, transform, player) {
  const pos = player.body.position, [u, v] = transform(pos.x, pos.z);
  // World forward is [sin(yaw), cos(yaw)]; north maps upward and positive
  // Canvas rotation is clockwise, so the same yaw points the arrow correctly.
  ctx.save(); ctx.translate(u, v); ctx.rotate(player.getFacing());
  ctx.fillStyle = '#ead1b5'; ctx.strokeStyle = '#100e0c'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(4.6, 5.5); ctx.lineTo(0, 2.4); ctx.lineTo(-4.6, 5.5); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}
