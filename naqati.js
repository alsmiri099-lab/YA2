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
  iqraUrl: 'https://ya2-live.vercel.app',
  naqatiUrl: 'https://ya4.vercel.app',
  iqraPointsEnabled: true,
  showStudentReadingRecords: true
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
    iqraUrl: (row.iqra_url && !/-projects\.vercel\.app/.test(row.iqra_url)) ? row.iqra_url : 'https://ya2-live.vercel.app',
    naqatiUrl: row.naqati_url || '',
    iqraPointsEnabled: row.iqra_points_enabled !== false,
    showStudentReadingRecords: row.show_student_reading_records !== false
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
  if (iqraUrlRegistered || !origin || /localhost|127\.0\.0\.1|-projects\.vercel\.app/.test(origin)) return;
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

// تسجيل ورد القراءة في سجل أوراد اقرأ داخل نقاطي
async function recordReadingSubmission(naqatiStudentId, readingData = {}) {
  try {
    const st = await pool.query('SELECT name, class_id FROM students WHERE id = $1', [String(naqatiStudentId)]);
    if (!st.rows[0]) return false;

    const {
      id = 'sub_' + Date.now(),
      bookName = 'ورد القراءة',
      startPage = null,
      endPage = null,
      questions = '',
      freeSpace = '',
      points = 0,
      isLate = false
    } = readingData;

    const now = Date.now();
    await pool.query(`
      INSERT INTO iqra_reading_records (
        id, student_id, student_name, class_id, book_name,
        start_page, end_page, questions, free_space, points, is_late,
        submitted_at, record_date, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), CURRENT_DATE, $12)
      ON CONFLICT (id) DO UPDATE SET
        questions = EXCLUDED.questions,
        free_space = EXCLUDED.free_space,
        points = EXCLUDED.points,
        is_late = EXCLUDED.is_late
    `, [
      String(id), String(naqatiStudentId), st.rows[0].name, st.rows[0].class_id,
      bookName, parseInt(startPage, 10) || null, parseInt(endPage, 10) || null,
      questions || '', freeSpace || '', parseInt(points, 10) || 0,
      !!isLate, now
    ]);
    return true;
  } catch (e) {
    console.error('recordReadingSubmission error:', e.message);
    return false;
  }
}

async function ping() {
  const r = await pool.query('SELECT COUNT(*)::int AS n FROM students');
  return r.rows[0].n;
}

// --- قسم إبداع (IBDA HUB) ---
async function getIbdaGems(classId) {
  let q = 'SELECT * FROM ibda_gems ORDER BY created_at DESC LIMIT 60';
  let params = [];
  if (classId) {
    q = 'SELECT * FROM ibda_gems WHERE class_id = $1 ORDER BY created_at DESC LIMIT 60';
    params = [classId];
  }
  const r = await pool.query(q, params);
  return r.rows;
}

async function addIbdaGem({ studentId, studentName, classId, bookTitle, gemText }) {
  const r = await pool.query(`
    INSERT INTO ibda_gems (student_id, student_name, class_id, book_title, gem_text)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [studentId || null, studentName, classId || null, bookTitle || 'ورد القراءة', gemText.trim()]);
  return r.rows[0];
}

async function reactIbdaGem(gemId, type) {
  const col = type === 'like' ? 'likes_count' : 'gems_count';
  const r = await pool.query(`
    UPDATE ibda_gems
    SET ${col} = COALESCE(${col}, 0) + 1
    WHERE id = $1
    RETURNING id, likes_count, gems_count
  `, [parseInt(gemId, 10)]);
  return r.rows[0];
}

async function getIbdaCapsules({ classId, studentId } = {}) {
  let q = 'SELECT id, student_id, student_name, class_id, book_title, duration_sec, note, created_at, audio_data FROM ibda_capsules';
  let where = [];
  let params = [];
  if (classId) {
    params.push(classId);
    where.push(`class_id = $${params.length}`);
  }
  if (studentId) {
    params.push(studentId);
    where.push(`student_id = $${params.length}`);
  }
  if (where.length > 0) {
    q += ' WHERE ' + where.join(' AND ');
  }
  q += ' ORDER BY created_at DESC LIMIT 30';
  const r = await pool.query(q, params);
  return r.rows;
}

async function addIbdaCapsule({ studentId, studentName, classId, bookTitle, audioData, durationSec, note }) {
  const r = await pool.query(`
    INSERT INTO ibda_capsules (student_id, student_name, class_id, book_title, audio_data, duration_sec, note)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, student_id, student_name, class_id, book_title, duration_sec, note, created_at
  `, [studentId || null, studentName, classId || null, bookTitle || 'ورد القراءة', audioData, parseInt(durationSec, 10) || 0, note || '']);
  return r.rows[0];
}

async function getRaceData() {
  const classesRes = await pool.query('SELECT id, name FROM classes ORDER BY id');
  const groupsRes = await pool.query('SELECT id, class_id, name, color, icon FROM groups ORDER BY id');
  const pointsRes = await pool.query(`
    SELECT class_id, SUM(points) as total_points
    FROM history_logs
    GROUP BY class_id
  `);
  const readingRes = await pool.query(`
    SELECT class_id, SUM(COALESCE(end_page - start_page + 1, 0)) as total_pages
    FROM iqra_reading_records
    GROUP BY class_id
  `);
  const studentsCountRes = await pool.query(`
    SELECT class_id, COUNT(*) as count
    FROM students
    GROUP BY class_id
  `);

  const pointsMap = {};
  pointsRes.rows.forEach(r => { pointsMap[r.class_id] = parseInt(r.total_points, 10) || 0; });
  const readingMap = {};
  readingRes.rows.forEach(r => { readingMap[r.class_id] = parseInt(r.total_pages, 10) || 0; });
  const countMap = {};
  studentsCountRes.rows.forEach(r => { countMap[r.class_id] = parseInt(r.count, 10) || 0; });

  const racers = classesRes.rows.map((c, idx) => {
    const pts = pointsMap[c.id] || 0;
    const pages = readingMap[c.id] || 0;
    const totalScore = pts + (pages * 2);
    const matchingGroup = groupsRes.rows.find(g => g.name === c.name || g.class_id === c.id);
    return {
      id: c.id,
      name: c.name,
      icon: matchingGroup?.icon || (idx % 2 === 0 ? '🏇' : '🏹'),
      color: matchingGroup?.color || (idx === 0 ? '#3b82f6' : idx === 1 ? '#10b981' : '#f59e0b'),
      points: pts,
      readingPages: pages,
      studentsCount: countMap[c.id] || 0,
      totalScore: totalScore
    };
  });

  const maxScore = Math.max(...racers.map(r => r.totalScore), 100);
  racers.forEach(r => {
    r.progressPercent = Math.min(100, Math.round((r.totalScore / maxScore) * 100));
  });
  racers.sort((a, b) => b.totalScore - a.totalScore);

  return { racers, maxScore, updatedAt: new Date().toISOString() };
}

module.exports = {
  getSettings,
  saveSettings,
  registerIqraUrl,
  listStudents,
  verifyStudent,
  addPoints,
  recordReadingSubmission,
  ping,
  getIbdaGems,
  addIbdaGem,
  reactIbdaGem,
  getIbdaCapsules,
  addIbdaCapsule,
  getRaceData,
  DEFAULT_SETTINGS
};
