const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', '..', 'annsetu.db');

let db = null;
let dbReady = null; // Promise that resolves when db is initialized

/**
 * Initialize sql.js (async — WASM-based pure-JS SQLite)
 */
async function initDb() {
  const SQL = await initSqlJs();

  // Load existing database file if present
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  initializeTables();
  seedData();
  saveDb();

  return db;
}

// Single initialization promise
dbReady = initDb();

/**
 * Get the database instance (sync — call only after dbReady resolves)
 */
function getDb() {
  return db;
}

/**
 * Wait for DB readiness (call from server startup)
 */
async function waitForDb() {
  await dbReady;
  return db;
}

/**
 * Persist in-memory database to disk
 */
function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

/* ═══════════════════════════════════════════════
   Helper: run a query and return all rows
   ═══════════════════════════════════════════════ */
function dbAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function dbGet(sql, params = []) {
  const rows = dbAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function dbRun(sql, params = []) {
  db.run(sql, params);
  saveDb();
  return {
    lastInsertRowid: db.exec("SELECT last_insert_rowid()")[0]?.values[0][0] || 0,
    changes: db.getRowsModified()
  };
}

/* ═══════════════════════════════════════════════
   Schema creation
   ═══════════════════════════════════════════════ */
function initializeTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS ngos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      max_capacity INTEGER DEFAULT 100,
      trust_score REAL DEFAULT 4.0,
      completed_rescues INTEGER DEFAULT 0,
      avg_response_mins REAL DEFAULT 30,
      fssai_id TEXT,
      phone TEXT,
      is_approved INTEGER DEFAULT 0,
      fssai_verified INTEGER DEFAULT 0,
      type TEXT DEFAULT 'NGO',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS surplus_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      host_name TEXT NOT NULL,
      event_name TEXT,
      food_type TEXT NOT NULL,
      dietary_type TEXT DEFAULT 'Veg',
      total_portions INTEGER NOT NULL,
      remaining_portions INTEGER NOT NULL,
      cooked_at DATETIME NOT NULL,
      storage_temp_c REAL DEFAULT 25,
      ml_safe_until DATETIME,
      safety_status TEXT DEFAULT 'SAFE',
      remaining_safe_hours REAL,
      lat REAL DEFAULT 28.6139,
      lng REAL DEFAULT 77.2090,
      address TEXT,
      contact_phone TEXT,
      status TEXT DEFAULT 'OPEN',
      escalation_tier INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS handovers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      ngo_id INTEGER NOT NULL,
      portions_assigned INTEGER NOT NULL,
      otp_code TEXT NOT NULL,
      otp_verified INTEGER DEFAULT 0,
      photo_url TEXT,
      status TEXT DEFAULT 'PENDING',
      accepted_at DATETIME,
      verified_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES surplus_posts(id),
      FOREIGN KEY (ngo_id) REFERENCES ngos(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

/* ═══════════════════════════════════════════════
   Seed 5 pre-approved Delhi NCR NGOs
   ═══════════════════════════════════════════════ */
function seedData() {
  const countResult = dbGet('SELECT COUNT(*) as count FROM ngos');
  if (countResult && countResult.count > 0) return;

  const defaultPassword = bcrypt.hashSync('annsetu123', 10);

  // Pre-seeded NGOs centered around New Delhi (28.6139, 77.2090)
  const ngos = [
    { name: 'Robin Food Trust', email: 'robin@foodtrust.org', lat: 28.6274, lng: 77.2244, max_capacity: 250, trust_score: 4.9, completed_rescues: 142, avg_response_mins: 8, fssai_id: 'FSSAI-DL-10012024-001', phone: '+91-9811001100', type: 'NGO' },
    { name: 'Feeding Hope Foundation', email: 'hope@feedinghope.org', lat: 28.5959, lng: 77.2295, max_capacity: 500, trust_score: 4.8, completed_rescues: 287, avg_response_mins: 12, fssai_id: 'FSSAI-DL-10012024-002', phone: '+91-9811002200', type: 'NGO' },
    { name: 'Annapurna Seva Kendra', email: 'seva@annapurna.org', lat: 28.5779, lng: 77.2460, max_capacity: 250, trust_score: 4.7, completed_rescues: 95, avg_response_mins: 18, fssai_id: 'FSSAI-DL-10012024-003', phone: '+91-9811003300', type: 'NGO' },
    { name: 'Green Earth Hunger Relief', email: 'green@earthrelief.org', lat: 28.5689, lng: 77.2573, max_capacity: 200, trust_score: 4.5, completed_rescues: 63, avg_response_mins: 22, fssai_id: 'FSSAI-DL-10012024-004', phone: '+91-9811004400', type: 'NGO' },
    { name: 'ZeroWaste Biogas & Compost Unit', email: 'zero@wastebiogas.org', lat: 28.6409, lng: 77.2398, max_capacity: 1000, trust_score: 4.6, completed_rescues: 520, avg_response_mins: 15, fssai_id: 'FSSAI-DL-10012024-005', phone: '+91-9811005500', type: 'BIO_FALLBACK' }
  ];

  for (const ngo of ngos) {
    dbRun(
      `INSERT INTO ngos (name, email, password_hash, lat, lng, max_capacity, trust_score, completed_rescues, avg_response_mins, fssai_id, phone, is_approved, fssai_verified, type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?)`,
      [ngo.name, ngo.email, defaultPassword, ngo.lat, ngo.lng, ngo.max_capacity, ngo.trust_score, ngo.completed_rescues, ngo.avg_response_mins, ngo.fssai_id, ngo.phone, ngo.type]
    );
  }

  dbRun(
    `INSERT INTO audit_logs (action, entity_type, details) VALUES (?, ?, ?)`,
    ['SYSTEM_INIT', 'SYSTEM', '{"message":"AnnSetu initialized with 5 pre-seeded Delhi NCR NGOs","center":"28.6139,77.2090"}']
  );

  console.log('🌱 Database seeded with 5 Delhi NCR NGOs');
}

module.exports = { getDb, waitForDb, dbAll, dbGet, dbRun, saveDb };
