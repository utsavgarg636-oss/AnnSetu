const express = require('express');
const router = express.Router();
const { dbAll, dbGet, dbRun } = require('../config/db');

// ─── GET /api/admin/stats ─────────────────────────────────
router.get('/stats', (req, res) => {
  const totalNgos = dbGet("SELECT COUNT(*) as count FROM ngos WHERE type = 'NGO'")?.count || 0;
  const approvedNgos = dbGet("SELECT COUNT(*) as count FROM ngos WHERE is_approved = 1 AND type = 'NGO'")?.count || 0;
  const pendingNgos = dbGet('SELECT COUNT(*) as count FROM ngos WHERE is_approved = 0')?.count || 0;
  const totalPosts = dbGet('SELECT COUNT(*) as count FROM surplus_posts')?.count || 0;
  const activePosts = dbGet("SELECT COUNT(*) as count FROM surplus_posts WHERE status IN ('OPEN','MATCHED','IN_PROGRESS')")?.count || 0;
  const completedRescues = dbGet("SELECT COUNT(*) as count FROM handovers WHERE status = 'VERIFIED'")?.count || 0;
  const totalPortionsRescued = dbGet("SELECT COALESCE(SUM(portions_assigned), 0) as total FROM handovers WHERE status = 'VERIFIED'")?.total || 0;

  const co2ePrevented = (totalPortionsRescued * 2.5).toFixed(1);
  const avgTrust = approvedNgos > 0
    ? (dbGet("SELECT AVG(trust_score) as avg FROM ngos WHERE is_approved = 1 AND type = 'NGO'")?.avg || 0).toFixed(1)
    : '0.0';

  res.json({
    totalNgos, approvedNgos, pendingNgos,
    totalPosts, activePosts, completedRescues,
    totalPortionsRescued, co2ePrevented,
    trustIndex: avgTrust
  });
});

// ─── GET /api/admin/ngos ──────────────────────────────────
router.get('/ngos', (req, res) => {
  const ngos = dbAll(
    `SELECT id, name, email, lat, lng, max_capacity, trust_score, completed_rescues,
            avg_response_mins, fssai_id, phone, is_approved, fssai_verified, type, created_at
     FROM ngos ORDER BY created_at DESC`
  );
  res.json(ngos);
});

// ─── GET /api/admin/ngos/pending ──────────────────────────
router.get('/ngos/pending', (req, res) => {
  const pending = dbAll(
    `SELECT id, name, email, fssai_id, phone, type, created_at
     FROM ngos WHERE is_approved = 0 ORDER BY created_at DESC`
  );
  res.json(pending);
});

// ─── POST /api/admin/ngos/:id/approve ─────────────────────
router.post('/ngos/:id/approve', (req, res) => {
  const { id } = req.params;
  const ngo = dbGet('SELECT * FROM ngos WHERE id = ?', [parseInt(id)]);
  if (!ngo) return res.status(404).json({ error: 'NGO not found' });

  dbRun('UPDATE ngos SET is_approved = 1, fssai_verified = 1 WHERE id = ?', [parseInt(id)]);
  dbRun(
    `INSERT INTO audit_logs (action, entity_type, entity_id, details) VALUES (?, ?, ?, ?)`,
    ['NGO_APPROVED', 'NGO', parseInt(id), JSON.stringify({ name: ngo.name, email: ngo.email })]
  );

  const io = req.app.get('io');
  if (io) io.emit('ngo:approved', { ngoId: parseInt(id), name: ngo.name });

  res.json({ success: true, message: `${ngo.name} approved and activated` });
});

// ─── GET /api/admin/posts ─────────────────────────────────
router.get('/posts', (req, res) => {
  const posts = dbAll('SELECT * FROM surplus_posts ORDER BY created_at DESC');
  res.json(posts);
});

// ─── GET /api/admin/audit-logs ────────────────────────────
router.get('/audit-logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const logs = dbAll('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?', [limit]);
  res.json(logs);
});

// ─── GET /api/admin/map-data ──────────────────────────────
router.get('/map-data', (req, res) => {
  const ngos = dbAll('SELECT id, name, lat, lng, trust_score, is_approved, fssai_verified, type FROM ngos');
  const posts = dbAll(
    `SELECT id, host_name, lat, lng, status, food_type, remaining_portions, escalation_tier
     FROM surplus_posts WHERE status IN ('OPEN','MATCHED','IN_PROGRESS','ADMIN_FALLBACK')`
  );
  res.json({ ngos, posts });
});

// ─── GET /api/admin/handovers ─────────────────────────────
router.get('/handovers', (req, res) => {
  const handovers = dbAll(`
    SELECT h.*, sp.host_name, sp.food_type, sp.event_name, n.name as ngo_name
    FROM handovers h
    JOIN surplus_posts sp ON h.post_id = sp.id
    JOIN ngos n ON h.ngo_id = n.id
    ORDER BY h.created_at DESC
  `);
  res.json(handovers);
});

module.exports = router;
