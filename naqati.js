// ==========================================
// الربط مع منظومة نقاطي (YA3)
// - جلب الطلاب ورموز الدخول من قاعدة بيانات نقاطي
// - إرسال نقاط القراءة إلى سجل نقاط الطالب في نقاطي
// - إعدادات الربط محفوظة في قاعدة نقاطي ليقرأها الموقعان
// ==========================================
const { Pool } = require('pg');

const NAQATI_DB_URL = process.env.NAQATI_DATABASE_URL ||
  'postgresql://postgres.dzecnvnycoujizqooebd:Yaousef.009@aws-0-eu-west-1.pooler.supabase.com:6543/postgres';

const pool = new Pool({
  connectionString: NAQATI_DB_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
  idleTimeoutMillis: 20000
});
pool.on('error', err => console.warn('Naqati pool error:', err.message));

// أسماء تجريبية قديمة يستبعدها نقاطي نفسه
const DUMMY_NAMES = ['محمد عبد الله القحطاني', 'عبد الرحمن خالد الدوسري', 'عمر فهد العتيبي', 'فيصل سعود الشمري', 'سلطان ماجد المطيري', 'ريان أحمد الغامدي', 'خالد إبراهيم الزهراني', 'يوسف عادل السبيعي'];

const DEFAULT_SETTINGS = {
  enabled: true,
  onTimePoints: 10,
  latePoints: 5,
  overduePoints: 0,
  criteriaName: '📖 ورد القراءة (اقرأ)',
  syncManualPoints: true,
  iqraUrl: '',
  naqatiUrl: ''
};

let schemaReady = null;
function ensureSchema() {
  if (!schemaReady) {
    schemaReady = pool.query(`
      CREATE TABLE IF NOT EXISTS reading_link_settings (
        id VARCHAR(32) PRIMARY KEY DEFAULT 'global',
        enabled BOOLEAN DEFAULT TRUE,
        on_time_points INT DEFAULT 10,
        late_points INT DEFAULT 5,
        overdue_points INT DEFAULT 0,
        criteria_name VARCHAR(255) DEFAULT '📖 ورد القراءة (اقرأ)',
        sync_manual_points BOOLEAN DEFAULT TRUE,
        iqra_url TEXT DEFAULT '',
        naqati_url TEXT DEFAULT '',
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      INSERT INTO reading_link_settings (id) VALUES ('global') ON CONFLICT (id) DO NOTHING;
    `).catch(err => { schemaReady = null; throw err; });
  }
  return schemaReady;
}

function riyadhDate(ms = Date.now()) {
  return new Date(ms + 3 * 3600 * 1000).toISOString().split('T')[0];
}

// --- الإعدادات ---
let settingsCache = null;
let settingsCacheAt = 0;

async function getSettings(force = false) {
  if (!force && settingsCache && Date.now() - settingsCacheAt < 30000) return settingsCache;
  await ensureSchema();
  const r = await pool.query("SELECT * FROM reading_link_settings WHERE id = 'global'");
  const row = r.rows[0] || {};
  settingsCache = {
    enabled: row.enabled !== false,
    onTimePoints: row.on_time_points ?? DEFAULT_SETTINGS.onTimePoints,
    latePoints: row.late_points ?? DEFAULT_SETTINGS.latePoints,
    overduePoints: row.overdue_points ?? DEFAULT_SETTINGS.overduePoints,
    criteriaName: row.criteria_name || DEFAULT_SETTINGS.criteriaName,
    syncManualPoints: row.sync_manual_points !== false,
    iqraUrl: row.iqra_url || '',
    naqatiUrl: row.naqati_url || ''
  };
  settingsCacheAt = Date.now();
  return settingsCache;
}

function toInt(v, fallback) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

async function saveSettings(input = {}) {
  const cur = await getSettings(true);
  const next = {
    enabled: input.enabled !== undefined ? !!input.enabled : cur.enabled,
    onTimePoints: toInt(input.onTimePoints, cur.onTimePoints),
    latePoints: toInt(input.latePoints, cur.latePoints),
    overduePoints: toInt(input.overduePoints, cur.overduePoints),
    criteriaName: (input.criteriaName || '').trim() || cur.criteriaName,
    syncManualPoints: input.syncManualPoints !== undefined ? !!input.syncManualPoints : cur.syncManualPoints,
    iqraUrl: input.iqraUrl !== undefined ? cleanUrl(input.iqraUrl) : cur.iqraUrl,
    naqatiUrl: input.naqatiUrl !== undefined ? cleanUrl(input.naqatiUrl) : cur.naqatiUrl
  };
  await pool.query(`
    UPDATE reading_link_settings SET
      enabled = $1, on_time_points = $2, late_points = $3, overdue_points = $4,
      criteria_name = $5, sync_manual_points = $6, iqra_url = $7, naqati_url = $8, updated_at = NOW()
    WHERE id = 'global'
  `, [next.enabled, next.onTimePoints, next.latePoints, next.overduePoints, next.criteriaName, next.syncManualPoints, next.iqraUrl, next.naqatiUrl]);
  settingsCache = next;
  settingsCacheAt = Date.now();
  return next;
}

function cleanUrl(u) {
  u = String(u || '').trim().replace(/\/+$/, '');
  if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u;
  return u;
}

// تسجيل رابط موقع اقرأ تلقائياً من أول زيارة على الاستضافة (ليظهر زر اقرأ داخل نقاطي)
let iqraUrlRegistered = false;
async function registerIqraUrl(origin) {
  if (iqraUrlRegistered || !origin || /localhost|127\.0\.0\.1/.test(origin)) return;
  iqraUrlRegistered = true;
  try {
    await ensureSchema();
    await pool.query("UPDATE reading_link_settings SET iqra_url = $1 WHERE id = 'global' AND (iqra_url IS NULL OR iqra_url = '')", [cleanUrl(origin)]);
    settingsCache = null;
  } catch (e) {
    iqraUrlRegistered = false;
  }
}

// --- الطلاب ---
async function listStudents() {
  const r = await pool.query(`
    SELECT s.id, s.name, s.passcode, s.class_id, s.avatar, c.name AS class_name
    FROM students s LEFT JOIN classes c ON c.id = s.class_id
    WHERE s.name <> ALL($1::text[])
    ORDER BY c.name NULLS LAST, s.name
  `, [DUMMY_NAMES]);
  return r.rows.map(s => ({
    id: s.id,
    name: s.name,
    passcode: String(s.passcode || '').trim(),
    classId: s.class_id,
    className: s.class_name || '',
    avatar: s.avatar || '👨‍🎓'
  }));
}

async function verifyStudent(studentId, passcode) {
  const r = await pool.query('SELECT id, name, passcode, class_id FROM students WHERE id = $1', [String(studentId || '')]);
  const st = r.rows[0];
  if (!st) return null;
  const correct = String(st.passcode || '').trim();
  if (!correct || correct !== String(passcode || '').trim()) return null;
  return { id: st.id, name: st.name, classId: st.class_id };
}

// --- النقاط ---
async function addPoints(naqatiStudentId, points, criteriaName, note = '') {
  const num = parseInt(points, 10);
  if (!naqatiStudentId || !Number.isFinite(num) || num === 0) return false;
  const st = await pool.query('SELECT name, class_id FROM students WHERE id = $1', [naqatiStudentId]);
  if (!st.rows[0]) return false;
  const now = Date.now();
  const logId = 'iqra_' + now + '_' + Math.random().toString(36).substr(2, 5);
  await pool.query(`
    INSERT INTO history_logs (id, class_id, target_type, target_id, target_name, criteria_name, points, log_date, created_at, note)
    VALUES ($1, $2, 'student', $3, $4, $5, $6, $7, $8, $9)
  `, [logId, st.rows[0].class_id, naqatiStudentId, st.rows[0].name, criteriaName, num, riyadhDate(now), now, note || '']);
  return true;
}

async function ping() {
  const r = await pool.query('SELECT COUNT(*)::int AS n FROM students');
  return r.rows[0].n;
}

module.exports = {
  getSettings,
  saveSettings,
  registerIqraUrl,
  listStudents,
  verifyStudent,
  addPoints,
  ping,
  DEFAULT_SETTINGS
};
