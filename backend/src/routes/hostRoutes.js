const express = require('express');
const router = express.Router();
const { dbAll, dbGet, dbRun } = require('../config/db');
const { predictSpoilage } = require('../services/mlSpoilageService');
const { startEscalation, jumpToTier } = require('../services/escalationEngine');

// ─── POST /api/host/post — Create a surplus food post ─────
router.post('/post', async (req, res) => {
  try {
    const io = req.app.get('io');
    const {
      host_name, event_name, food_type, dietary_type,
      total_portions, cooked_at, storage_temp_c,
      lat, lng, address, contact_phone
    } = req.body;

    if (!host_name || !food_type || !total_portions || !cooked_at) {
      return res.status(400).json({ error: 'host_name, food_type, total_portions, and cooked_at are required' });
    }

    const cookedTime = new Date(cooked_at);
    const hoursSinceCooked = (Date.now() - cookedTime.getTime()) / (1000 * 60 * 60);

    const mlResult = await predictSpoilage({
      food_type,
      dietary_type: dietary_type || 'Veg',
      quantity_portions: parseInt(total_portions),
      hours_since_cooked: Math.max(0, hoursSinceCooked),
      storage_temp_c: parseFloat(storage_temp_c) || 25
    });

    const postStatus = mlResult.safety_status === 'BLOCKED' ? 'BLOCKED' : 'OPEN';

    const result = dbRun(
      `INSERT INTO surplus_posts
        (host_name, event_name, food_type, dietary_type, total_portions, remaining_portions,
         cooked_at, storage_temp_c, ml_safe_until, safety_status, remaining_safe_hours,
         lat, lng, address, contact_phone, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        host_name, event_name || 'Food Donation', food_type, dietary_type || 'Veg',
        parseInt(total_portions), parseInt(total_portions), cooked_at,
        parseFloat(storage_temp_c) || 25, mlResult.safe_until_timestamp,
        mlResult.safety_status, mlResult.remaining_safe_hours,
        parseFloat(lat) || 28.6139, parseFloat(lng) || 77.2090,
        address || 'New Delhi', contact_phone || '', postStatus
      ]
    );

    const postId = result.lastInsertRowid;

    dbRun(
      `INSERT INTO audit_logs (action, entity_type, entity_id, details) VALUES (?, ?, ?, ?)`,
      ['FOOD_POSTED', 'SURPLUS_POST', postId, JSON.stringify({ host_name, food_type, portions: total_portions, safety_status: mlResult.safety_status })]
    );

    const post = dbGet('SELECT * FROM surplus_posts WHERE id = ?', [postId]);

    if (io) io.emit('post:created', post);

    if (mlResult.safety_status !== 'BLOCKED') {
      startEscalation(postId, io);
    } else if (io) {
      io.emit('post:diverted', { postId, reason: 'Food safety window expired. Diverted to ZeroWaste Biogas & Compost Unit.' });
    }

    res.json({
      post, mlPrediction: mlResult,
      message: mlResult.safety_status === 'BLOCKED'
        ? 'Food safety window expired. Diverted to biogas/compost.'
        : 'Food posted successfully. Matching with nearby NGOs...'
    });
  } catch (err) {
    console.error('Error creating post:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// ─── GET /api/host/posts ──────────────────────────────────
router.get('/posts', (req, res) => {
  const posts = dbAll('SELECT * FROM surplus_posts ORDER BY created_at DESC');
  res.json(posts);
});

// ─── GET /api/host/posts/:id ──────────────────────────────
router.get('/posts/:id', (req, res) => {
  const post = dbGet('SELECT * FROM surplus_posts WHERE id = ?', [parseInt(req.params.id)]);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const handovers = dbAll(
    `SELECT h.id, h.portions_assigned, h.status, h.otp_verified, h.accepted_at, h.verified_at,
            h.created_at, n.name as ngo_name
     FROM handovers h JOIN ngos n ON h.ngo_id = n.id
     WHERE h.post_id = ?`,
    [parseInt(req.params.id)]
  );

  res.json({ post, handovers });
});

// ─── GET /api/host/posts/:id/otp — HOST-ONLY OTP Vault ───
router.get('/posts/:id/otp', (req, res) => {
  const handovers = dbAll(
    `SELECT h.id, h.otp_code, h.portions_assigned, h.status, n.name as ngo_name
     FROM handovers h JOIN ngos n ON h.ngo_id = n.id
     WHERE h.post_id = ? AND h.status IN ('ACCEPTED','PENDING')`,
    [parseInt(req.params.id)]
  );

  if (handovers.length === 0) return res.status(404).json({ error: 'No active handovers' });
  res.json(handovers);
});

// ─── POST /api/host/time-warp — Demo escalation jump ──────
router.post('/time-warp', (req, res) => {
  const io = req.app.get('io');
  const { postId, targetTier } = req.body;
  if (!postId || targetTier === undefined) return res.status(400).json({ error: 'postId and targetTier required' });
  const result = jumpToTier(parseInt(postId), parseInt(targetTier), io);
  res.json(result);
});

// ─── POST /api/host/predict — ML preview (no post created)
router.post('/predict', async (req, res) => {
  const { food_type, dietary_type, quantity_portions, hours_since_cooked, storage_temp_c } = req.body;
  const result = await predictSpoilage({
    food_type: food_type || 'Cooked Rice & Curry',
    dietary_type: dietary_type || 'Veg',
    quantity_portions: parseInt(quantity_portions) || 100,
    hours_since_cooked: parseFloat(hours_since_cooked) || 0,
    storage_temp_c: parseFloat(storage_temp_c) || 25
  });
  res.json(result);
});

module.exports = router;
