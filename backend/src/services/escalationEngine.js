const { dbAll, dbGet, dbRun } = require('../config/db');

/* ═══════════════════════════════════════════════════════════
   Haversine Distance (km) between two lat/lng coordinates
   ═══════════════════════════════════════════════════════════ */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const activeEscalations = new Map();

function generateOTP() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function getRadius(tier) {
  switch (tier) {
    case 0: return 3;
    case 1: return 8;
    case 2: return 8;
    case 3: return 'ADMIN';
    default: return 3;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   Find matching verified NGOs within radius, ranked by composite score
   ═══════════════════════════════════════════════════════════════════ */
function findMatchingNGOs(postLat, postLng, radiusKm, requiredPortions, excludeIds = []) {
  let sql = `SELECT * FROM ngos WHERE is_approved = 1 AND fssai_verified = 1 AND type = 'NGO'`;
  const params = [];
  if (excludeIds.length) {
    sql += ` AND id NOT IN (${excludeIds.map(() => '?').join(',')})`;
    params.push(...excludeIds);
  }
  const ngos = dbAll(sql, params);

  return ngos
    .map((ngo) => ({ ...ngo, distance: haversineDistance(postLat, postLng, ngo.lat, ngo.lng) }))
    .filter((ngo) => ngo.distance <= radiusKm && ngo.max_capacity >= requiredPortions)
    .sort((a, b) => {
      const scoreA = a.distance / radiusKm - a.trust_score / 5 + a.avg_response_mins / 60;
      const scoreB = b.distance / radiusKm - b.trust_score / 5 + b.avg_response_mins / 60;
      return scoreA - scoreB;
    });
}

function findSplitNGOs(postLat, postLng, radiusKm, totalPortions, excludeIds = []) {
  let sql = `SELECT * FROM ngos WHERE is_approved = 1 AND fssai_verified = 1 AND type = 'NGO'`;
  const params = [];
  if (excludeIds.length) {
    sql += ` AND id NOT IN (${excludeIds.map(() => '?').join(',')})`;
    params.push(...excludeIds);
  }
  const ngos = dbAll(sql, params);

  const candidates = ngos
    .map((ngo) => ({ ...ngo, distance: haversineDistance(postLat, postLng, ngo.lat, ngo.lng) }))
    .filter((ngo) => ngo.distance <= radiusKm)
    .sort((a, b) => b.max_capacity - a.max_capacity);

  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      if (candidates[i].max_capacity + candidates[j].max_capacity >= totalPortions) {
        return [candidates[i], candidates[j]];
      }
    }
  }
  return [];
}

function executeTier(escalation, post, io) {
  const { postId, tier, declinedNgoIds } = escalation;

  dbRun('UPDATE surplus_posts SET escalation_tier = ? WHERE id = ?', [tier, postId]);
  dbRun(
    `INSERT INTO audit_logs (action, entity_type, entity_id, details) VALUES (?, ?, ?, ?)`,
    [`ESCALATION_TIER_${tier}`, 'SURPLUS_POST', postId, JSON.stringify({ tier, radius: getRadius(tier) })]
  );

  if (tier === 0) {
    const matches = findMatchingNGOs(post.lat, post.lng, 3, post.remaining_portions, declinedNgoIds);
    io.emit('escalation:update', { postId, tier: 0, radius: 3, matches: matches.length, matchedNgos: matches.map(n => ({ id: n.id, name: n.name, distance: n.distance.toFixed(1) })) });
    if (matches.length > 0) io.emit('ngo:new-rescue', { post, matchedNgos: matches.map(n => n.id), tier: 0, radius: 3 });

    const t1 = setTimeout(() => {
      escalation.tier = 1;
      const freshPost = dbGet('SELECT * FROM surplus_posts WHERE id = ?', [postId]);
      if (freshPost && freshPost.status === 'OPEN') executeTier(escalation, freshPost, io);
    }, 10 * 60 * 1000);
    escalation.timers.push(t1);

  } else if (tier === 1) {
    const matches = findMatchingNGOs(post.lat, post.lng, 8, post.remaining_portions, declinedNgoIds);
    io.emit('escalation:update', { postId, tier: 1, radius: 8, matches: matches.length, matchedNgos: matches.map(n => ({ id: n.id, name: n.name, distance: n.distance.toFixed(1) })) });
    if (matches.length > 0) io.emit('ngo:new-rescue', { post, matchedNgos: matches.map(n => n.id), tier: 1, radius: 8 });

    const t2 = setTimeout(() => {
      escalation.tier = 2;
      const freshPost = dbGet('SELECT * FROM surplus_posts WHERE id = ?', [postId]);
      if (freshPost && freshPost.status === 'OPEN') executeTier(escalation, freshPost, io);
    }, 15 * 60 * 1000);
    escalation.timers.push(t2);

  } else if (tier === 2) {
    const splitNgos = findSplitNGOs(post.lat, post.lng, 8, post.remaining_portions, declinedNgoIds);
    io.emit('escalation:update', { postId, tier: 2, radius: 8, split: true, matches: splitNgos.length, splitNgos: splitNgos.map(n => ({ id: n.id, name: n.name, capacity: n.max_capacity, distance: n.distance.toFixed(1) })) });
    if (splitNgos.length >= 2) io.emit('ngo:split-rescue', { post, splitNgos: splitNgos.map(n => ({ id: n.id, name: n.name, capacity: n.max_capacity })), tier: 2 });

    const t3 = setTimeout(() => {
      escalation.tier = 3;
      const freshPost = dbGet('SELECT * FROM surplus_posts WHERE id = ?', [postId]);
      if (freshPost && (freshPost.status === 'OPEN' || freshPost.status === 'IN_PROGRESS')) executeTier(escalation, freshPost, io);
    }, 15 * 60 * 1000);
    escalation.timers.push(t3);

  } else if (tier === 3) {
    io.emit('escalation:update', { postId, tier: 3, radius: 'ADMIN_FALLBACK', matches: 0 });
    io.emit('admin:volunteer-fallback', { post, message: 'All escalation tiers exhausted. Admin volunteer dispatch required.' });
    dbRun('UPDATE surplus_posts SET status = ? WHERE id = ?', ['ADMIN_FALLBACK', postId]);
    dbRun(
      `INSERT INTO audit_logs (action, entity_type, entity_id, details) VALUES (?, ?, ?, ?)`,
      ['ADMIN_FALLBACK_TRIGGERED', 'SURPLUS_POST', postId, JSON.stringify({ message: 'All escalation tiers exhausted' })]
    );
  }
}

function startEscalation(postId, io) {
  const post = dbGet('SELECT * FROM surplus_posts WHERE id = ?', [postId]);
  if (!post) return;
  const escalation = { postId, tier: 0, declinedNgoIds: [], timers: [] };
  activeEscalations.set(postId, escalation);
  executeTier(escalation, post, io);
}

function jumpToTier(postId, targetTier, io) {
  const post = dbGet('SELECT * FROM surplus_posts WHERE id = ?', [postId]);
  if (!post) return { error: 'Post not found' };

  const existing = activeEscalations.get(postId);
  if (existing) existing.timers.forEach(t => clearTimeout(t));

  const escalation = { postId, tier: targetTier, declinedNgoIds: existing?.declinedNgoIds || [], timers: [] };
  activeEscalations.set(postId, escalation);
  executeTier(escalation, post, io);
  return { success: true, tier: targetTier, radius: getRadius(targetTier) };
}

function cancelEscalation(postId) {
  const existing = activeEscalations.get(postId);
  if (existing) {
    existing.timers.forEach(t => clearTimeout(t));
    activeEscalations.delete(postId);
  }
}

module.exports = { startEscalation, jumpToTier, cancelEscalation, findMatchingNGOs, findSplitNGOs, generateOTP, haversineDistance, activeEscalations };
