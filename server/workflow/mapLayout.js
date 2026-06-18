const LAYOUT_BOUNDS = {
  minX: 10,
  maxX: 90,
  minY: 12,
  maxY: 84,
};

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function visualLength(label) {
  return Array.from(String(label || '')).reduce((sum, ch) => {
    return sum + (/[\u4e00-\u9fff]/.test(ch) ? 1 : 0.58);
  }, 0);
}

function nodeSeparation(a, b) {
  const aw = visualLength(a && a.label);
  const bw = visualLength(b && b.label);
  return {
    x: Math.max(13, Math.min(23, 7 + (aw + bw) * 0.58)),
    y: Math.max(10, Math.min(16, 7 + Math.max(aw, bw) * 0.48)),
    center: 12,
  };
}

function spreadMapNodes(nodes) {
  const next = (Array.isArray(nodes) ? nodes : []).map((node) => ({
    ...node,
    x: clamp(node && node.x, LAYOUT_BOUNDS.minX, LAYOUT_BOUNDS.maxX),
    y: clamp(node && node.y, LAYOUT_BOUNDS.minY, LAYOUT_BOUNDS.maxY),
  }));

  for (let pass = 0; pass < 90; pass += 1) {
    let moved = 0;
    for (let i = 0; i < next.length; i += 1) {
      for (let j = i + 1; j < next.length; j += 1) {
        const a = next[i];
        const b = next[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);
        const dist = Math.sqrt(dx * dx + dy * dy);
        const sep = nodeSeparation(a, b);
        const labelOverlap = absX < sep.x && absY < sep.y;
        const dotOverlap = dist < sep.center;
        if (!labelOverlap && !dotOverlap) continue;

        const aMobility = a.hub ? 0.22 : 1;
        const bMobility = b.hub ? 0.22 : 1;
        const totalMobility = aMobility + bMobility;
        const moveA = aMobility / totalMobility;
        const moveB = bMobility / totalMobility;

        if (labelOverlap && (sep.x - absX <= sep.y - absY || dotOverlap)) {
          const sign = dx === 0 ? (j % 2 === 0 ? 1 : -1) : Math.sign(dx);
          const push = Math.min(7, Math.max(1.2, sep.x - absX + 0.8));
          a.x = clamp(a.x - sign * push * moveA, LAYOUT_BOUNDS.minX, LAYOUT_BOUNDS.maxX);
          b.x = clamp(b.x + sign * push * moveB, LAYOUT_BOUNDS.minX, LAYOUT_BOUNDS.maxX);
          moved += push;
        } else {
          const sign = dy === 0 ? (j % 2 === 0 ? 1 : -1) : Math.sign(dy);
          const push = Math.min(6, Math.max(1.2, (labelOverlap ? sep.y - absY : sep.center - dist) + 0.8));
          a.y = clamp(a.y - sign * push * moveA, LAYOUT_BOUNDS.minY, LAYOUT_BOUNDS.maxY);
          b.y = clamp(b.y + sign * push * moveB, LAYOUT_BOUNDS.minY, LAYOUT_BOUNDS.maxY);
          moved += push;
        }
      }
    }
    if (moved < 0.01) break;
  }

  return next.map((node) => ({
    ...node,
    x: Number(node.x.toFixed(2)),
    y: Number(node.y.toFixed(2)),
  }));
}

module.exports = {
  spreadMapNodes,
  LAYOUT_BOUNDS,
};
