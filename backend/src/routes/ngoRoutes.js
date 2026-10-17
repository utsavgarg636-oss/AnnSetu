const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { dbAll, dbGet, dbRun } = require('../config/db');
const { generateOTP, haversineDistance, cancelEscalation } = require('../services/escalationEngine');

// ─── POST /api/ngo/auth/register ──────────────────────────
router.post('/auth/register', (req, res) => {
  const { name, email, password, phone, fssai_id } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password are required' });

  const existing = dbGet('SELECT id FROM ngos WHERE email = ?', [email]);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const password_hash = bcrypt.hashSync(password, 10);
  const result = dbRun(
    `INSERT INTO ngos (name, email, password_hash, lat, lng, phone, fssai_id, is_approved, fssai_verified)
     VALUES (?, ?, ?, 28.6139, 77.2090, ?, ?, 0, 0)`,
    [name, email, password_hash, phone || '', fssai_id || '']
  );

  dbRun(
    `INSERT INTO audit_logs (action, entity_type, entity_id, details) VALUES (?, ?, ?, ?)`,
    ['NGO_REGISTERED', 'NGO', result.lastInsertRowid, JSON.stringify({ name, email })]
  );

  const io = req.app.get('io');
  if (io) io.emit('admin:new-registration', { id: result.lastInsertRowid, name, email, fssai_id });

  res.json({ id: result.lastInsertRowid, name, email, is_approved: false, message: 'Registration submitted. Pending admin approval.' });
});

// ─── POST /api/ngo/auth/login ─────────────────────────────
router.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const ngo = dbGet('SELECT * FROM ngos WHERE email = ?', [email]);
  if (!ngo) return res.status(401).json({ error: 'Invalid credentials' });
  if (!bcrypt.compareSync(password, ngo.password_hash)) return res.status(401).json({ error: 'Invalid credentials' });

  const { password_hash, ...ngoData } = ngo;
  res.json({ ...ngoData, is_approved: !!ngo.is_approved, fssai_verified: !!ngo.fssai_verified });
});

// ─── GET /api/ngo/profile/:id ─────────────────────────────
router.get('/profile/:id', (req, res) => {
  const ngo = dbGet(
    `SELECT id, name, email, lat, lng, max_capacity, trust_score, completed_rescues,
            avg_response_mins, fssai_id, phone, is_approved, fssai_verified, type, created_at
     FROM ngos WHERE id = ?`,
    [parseInt(req.params.id)]
  );
  if (!ngo) return res.status(404).json({ error: 'NGO not found' });
  res.json({ ...ngo, is_approved: !!ngo.is_approved, fssai_verified: !!ngo.fssai_verified });
});

// ─── GET /api/ngo/verified-list — for identity switcher ───
router.get('/verified-list', (req, res) => {
  const ngos = dbAll(
    `SELECT id, name, trust_score, completed_rescues, fssai_id
     FROM ngos WHERE is_approved = 1 AND fssai_verified = 1 AND type = 'NGO'`
  );
  res.json(ngos);
});

// ─── GET /api/ngo/feed/:ngoId — Geofenced food radar ──────
router.get('/feed/:ngoId', (req, res) => {
  const ngo = dbGet('SELECT * FROM ngos WHERE id = ? AND is_approved = 1 AND fssai_verified = 1', [parseInt(req.params.ngoId)]);
  if (!ngo) return res.status(403).json({ error: 'NGO not approved or not found' });

  const posts = dbAll(
    `SELECT * FROM surplus_posts
     WHERE status IN ('OPEN','MATCHED','IN_PROGRESS') AND safety_status != 'BLOCKED'
     ORDER BY created_at DESC`
  );

  const feed = posts.map(post => ({
    ...post,
    distance_km: parseFloat(haversineDistance(ngo.lat, ngo.lng, post.lat, post.lng).toFixed(2))
  }));

  res.json(feed);
});

// ─── POST /api/ngo/accept/:postId ─────────────────────────
router.post('/accept/:postId', (req, res) => {
  const io = req.app.get('io');
  const { ngoId, portions } = req.body;
  const { postId } = req.params;

  const ngo = dbGet('SELECT * FROM ngos WHERE id = ? AND is_approved = 1 AND fssai_verified = 1', [ngoId]);
  if (!ngo) return res.status(403).json({ error: 'NGO not approved' });

  const post = dbGet('SELECT * FROM surplus_posts WHERE id = ?', [parseInt(postId)]);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.status === 'COMPLETED' || post.status === 'BLOCKED') return res.status(400).json({ error: 'Post no longer available' });

  const portionsToAssign = parseInt(portions) || post.remaining_portions;
  const otpCode = generateOTP();

  const result = dbRun(
    `INSERT INTO handovers (post_id, ngo_id, portions_assigned, otp_code, status, accepted_at)
     VALUES (?, ?, ?, ?, 'ACCEPTED', datetime('now'))`,
    [parseInt(postId), ngoId, portionsToAssign, otpCode]
  );

  const newRemaining = post.remaining_portions - portionsToAssign;
  const newStatus = newRemaining <= 0 ? 'MATCHED' : 'IN_PROGRESS';
  dbRun('UPDATE surplus_posts SET remaining_portions = ?, status = ? WHERE id = ?',
    [Math.max(0, newRemaining), newStatus, parseInt(postId)]);

  if (newRemaining <= 0) cancelEscalation(parseInt(postId));

  dbRun(
    `INSERT INTO audit_logs (action, entity_type, entity_id, details) VALUES (?, ?, ?, ?)`,
    ['RESCUE_ACCEPTED', 'HANDOVER', result.lastInsertRowid, JSON.stringify({ ngoId, ngoName: ngo.name, postId: parseInt(postId), portions: portionsToAssign })]
  );

  if (io) {
    io.emit('handover:created', { handoverId: result.lastInsertRowid, postId: parseInt(postId), ngoId, ngoName: ngo.name, portions: portionsToAssign, status: 'ACCEPTED' });
    io.emit('host:otp', { postId: parseInt(postId), handoverId: result.lastInsertRowid, otpCode, ngoName: ngo.name });
  }

  res.json({ handoverId: result.lastInsertRowid, postId: parseInt(postId), portions: portionsToAssign, message: 'Rescue accepted! OTP sent to event host.' });
});

// ─── POST /api/ngo/decline/:postId ────────────────────────
router.post('/decline/:postId', (req, res) => {
  const io = req.app.get('io');
  const { ngoId } = req.body;

  dbRun(
    `INSERT INTO audit_logs (action, entity_type, entity_id, details) VALUES (?, ?, ?, ?)`,
    ['RESCUE_DECLINED', 'SURPLUS_POST', parseInt(req.params.postId), JSON.stringify({ ngoId })]
  );

  if (io) io.emit('ngo:declined', { postId: parseInt(req.params.postId), ngoId });
  res.json({ success: true, message: 'Rescue declined' });
});

// ─── POST /api/ngo/verify/:handoverId — OTP + Photo ──────
router.post('/verify/:handoverId', (req, res) => {
  const io = req.app.get('io');
  const { otp, photoUrl } = req.body;
  const { handoverId } = req.params;

  const handover = dbGet('SELECT * FROM handovers WHERE id = ?', [parseInt(handoverId)]);
  if (!handover) return res.status(404).json({ error: 'Handover not found' });
  if (handover.otp_code !== otp) return res.status(400).json({ error: 'Invalid OTP code' });

  dbRun(
    `UPDATE handovers SET otp_verified = 1, status = 'VERIFIED', photo_url = ?, verified_at = datetime('now') WHERE id = ?`,
    [photoUrl || '', parseInt(handoverId)]
  );

  const ngo = dbGet('SELECT * FROM ngos WHERE id = ?', [handover.ngo_id]);
  dbRun('UPDATE ngos SET completed_rescues = completed_rescues + 1, trust_score = MIN(5.0, trust_score + 0.01) WHERE id = ?', [handover.ngo_id]);

  const allHandovers = dbAll('SELECT * FROM handovers WHERE post_id = ?', [handover.post_id]);
  const allVerified = allHandovers.every(h => h.id === parseInt(handoverId) ? true : !!h.otp_verified);
  if (allVerified) dbRun("UPDATE surplus_posts SET status = 'COMPLETED' WHERE id = ?", [handover.post_id]);

  const co2ePrevented = (handover.portions_assigned * 2.5).toFixed(1);
  const methanePrevented = (handover.portions_assigned * 0.8).toFixed(1);

  dbRun(
    `INSERT INTO audit_logs (action, entity_type, entity_id, details) VALUES (?, ?, ?, ?)`,
    ['HANDOVER_VERIFIED', 'HANDOVER', parseInt(handoverId), JSON.stringify({ ngoId: handover.ngo_id, ngoName: ngo?.name, portions: handover.portions_assigned, co2ePrevented, methanePrevented })]
  );

  if (io) {
    io.emit('handover:verified', { handoverId: parseInt(handoverId), postId: handover.post_id, ngoId: handover.ngo_id, ngoName: ngo?.name, portions: handover.portions_assigned, co2ePrevented, methanePrevented, allComplete: allVerified });
  }

  res.json({ success: true, message: 'Handover verified successfully!', co2ePrevented, methanePrevented, allComplete: allVerified });
});

module.exports = router;
