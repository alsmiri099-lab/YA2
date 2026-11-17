require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure conflicting PG environment variables injected by host providers like Vercel do not override Supabase credentials
delete process.env.PGUSER;
delete process.env.PGHOST;
delete process.env.PGPASSWORD;
delete process.env.PGDATABASE;
delete process.env.PGPORT;

const connectionString = 'postgresql://postgres.dzecnvnycoujizqooebd:Yaousef.009@aws-0-eu-west-1.pooler.supabase.com:6543/postgres';

const pool = new Pool({
    user: 'postgres.dzecnvnycoujizqooebd',
    host: 'aws-0-eu-west-1.pooler.supabase.com',
    database: 'postgres',
    password: 'Yaousef.009',
    port: 6543,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000
});

// Ensure quick_points, allow_leader_points, allow_student_portal, and hide_student_records exist in app_settings, and passcode in students
pool.query(`
    ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS quick_points TEXT;
    ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS allow_leader_points BOOLEAN DEFAULT TRUE;
    ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS allow_student_portal BOOLEAN DEFAULT TRUE;
    ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS hide_student_records BOOLEAN DEFAULT FALSE;
    ALTER TABLE students ADD COLUMN IF NOT EXISTS passcode VARCHAR(10);
    UPDATE students SET passcode = LPAD(FLOOR(10 + RANDOM() * 90)::TEXT, 2, '0') WHERE passcode IS NULL OR passcode = '';
    
    CREATE TABLE IF NOT EXISTS student_messages (
        id VARCHAR(64) PRIMARY KEY,
        student_id VARCHAR(64) NOT NULL,
        student_name VARCHAR(255) NOT NULL,
        class_id VARCHAR(64),
        message TEXT NOT NULL,
        category VARCHAR(64) DEFAULT 'late_recitation',
        surah_name VARCHAR(255),
        pages_count NUMERIC(6, 2) DEFAULT 0,
        status VARCHAR(32) DEFAULT 'pending',
        director_reply TEXT DEFAULT '',
        points_awarded INT DEFAULT 0,
        created_at BIGINT NOT NULL,
        replied_at BIGINT
    );
`).catch(err => {
    console.warn('Notice on app_settings and student_messages table check:', err.message);
});

// Purge only legacy dummy seed students from Supabase (NEVER purge real students)
pool.query(`
    DELETE FROM history_logs WHERE id LIKE 'seed_%' OR id LIKE 'log_seed_%';
    DELETE FROM students WHERE name IN ('محمد عبد الله القحطاني', 'عبد الرحمن خالد الدوسري', 'عمر فهد العتيبي', 'فيصل سعود الشمري', 'سلطان ماجد المطيري', 'ريان أحمد الغامدي', 'خالد إبراهيم الزهراني', 'يوسف عادل السبيعي');
    UPDATE students SET class_id = 'class_main' WHERE class_id = 'class_default_1';
    UPDATE history_logs SET class_id = 'class_main' WHERE class_id = 'class_default_1';
    UPDATE classes SET id = 'class_main', name = 'الحلقة الأولى' WHERE id = 'class_default_1';
`).catch(err => {
    console.warn('Notice on dummy data cleanup:', err.message);
});

// Ensure admin_units table exists and defaults are seeded
const unitsReady = pool.query(`
    CREATE TABLE IF NOT EXISTS admin_units (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(64) UNIQUE NOT NULL,
        passcode VARCHAR(32) DEFAULT '',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    INSERT INTO admin_units (id, name, slug)
    VALUES ('unit_thani_thanawi', 'ثاني ثانوي', 'thani-thanawi')
    ON CONFLICT (id) DO UPDATE SET name = 'ثاني ثانوي', slug = 'thani-thanawi';

    ALTER TABLE classes ADD COLUMN IF NOT EXISTS unit_id VARCHAR(64) DEFAULT 'unit_thani_thanawi';
    ALTER TABLE groups ADD COLUMN IF NOT EXISTS unit_id VARCHAR(64) DEFAULT 'unit_thani_thanawi';
    ALTER TABLE students ADD COLUMN IF NOT EXISTS unit_id VARCHAR(64) DEFAULT 'unit_thani_thanawi';
    ALTER TABLE history_logs ADD COLUMN IF NOT EXISTS unit_id VARCHAR(64) DEFAULT 'unit_thani_thanawi';
    ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS unit_id VARCHAR(64) DEFAULT 'unit_thani_thanawi';
    ALTER TABLE student_messages ADD COLUMN IF NOT EXISTS unit_id VARCHAR(64) DEFAULT 'unit_thani_thanawi';
    ALTER TABLE quran_records ADD COLUMN IF NOT EXISTS unit_id VARCHAR(64) DEFAULT 'unit_thani_thanawi';
    ALTER TABLE attendance ADD COLUMN IF NOT EXISTS unit_id VARCHAR(64) DEFAULT 'unit_thani_thanawi';
    ALTER TABLE ibda_gems ADD COLUMN IF NOT EXISTS unit_id VARCHAR(64) DEFAULT 'unit_thani_thanawi';
    ALTER TABLE ibda_capsules ADD COLUMN IF NOT EXISTS unit_id VARCHAR(64) DEFAULT 'unit_thani_thanawi';
    ALTER TABLE criteria ADD COLUMN IF NOT EXISTS unit_id VARCHAR(64) DEFAULT 'unit_thani_thanawi';
    ALTER TABLE reading_link_settings ADD COLUMN IF NOT EXISTS unit_id VARCHAR(64) DEFAULT 'unit_thani_thanawi';
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS unit_id VARCHAR(64);
`).catch(err => console.warn('Notice on admin_units table check:', err.message));

async function resolveUnit(req) {
    try {
        await unitsReady;
    } catch (e) {}

    // 1. Direct query, header, or body
    let raw = (
        (req.query && (req.query.unitId || req.query.u || req.query.unit)) ||
        (req.headers && (req.headers['x-unit-id'] || req.headers['x-unit-slug'])) ||
        (req.body && (req.body.unitId || req.body.u || req.body.unit)) ||
        ''
    ).toString().trim();

    // 2. If not found, inspect Referer header (e.g. https://ya4.vercel.app/?u=yusr)
    if (!raw && req.headers && req.headers.referer) {
        try {
            const refUrl = new URL(req.headers.referer);
            raw = (refUrl.searchParams.get('u') || refUrl.searchParams.get('unit') || refUrl.searchParams.get('unitId') || '').trim();
        } catch(e) {}
    }

    // 3. If not found, inspect classId in body, query, or params
    const classId = (req.body && req.body.classId) || (req.query && req.query.classId) || (req.params && req.params.classId);
    if (!raw && classId) {
        try {
            const clsRes = await pool.query('SELECT unit_id FROM classes WHERE id = $1', [classId]);
            if (clsRes.rows[0] && clsRes.rows[0].unit_id) {
                raw = clsRes.rows[0].unit_id;
            }
        } catch(e) {}
    }

    // 4. If not found, inspect studentId / targetId
    const stId = (req.body && (req.body.studentId || (req.body.targetType === 'student' && req.body.targetId))) ||
                 (req.query && req.query.studentId) ||
                 (req.params && (req.params.studentId || req.params.id));
    if (!raw && stId) {
        try {
            const stRes = await pool.query('SELECT unit_id FROM students WHERE id = $1', [stId]);
            if (stRes.rows[0] && stRes.rows[0].unit_id) {
                raw = stRes.rows[0].unit_id;
            }
        } catch(e) {}
    }

    try {
        if (raw) {
            const bySlugOrId = await pool.query(
                'SELECT * FROM admin_units WHERE id = $1 OR LOWER(slug) = LOWER($1) OR name = $1 LIMIT 1',
                [raw]
            );
            if (bySlugOrId.rows.length > 0) return bySlugOrId.rows[0];
        }

        const first = await pool.query("SELECT * FROM admin_units ORDER BY created_at ASC LIMIT 1");
        if (first.rows.length > 0) return first.rows[0];
    } catch (err) {
        console.warn('resolveUnit query error, falling back:', err.message);
    }

    return { id: 'unit_default', name: 'الإدارة العامة', slug: 'main' };
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ==================== AUTHENTICATION (Users, Roles, Sessions) ====================
const crypto = require('crypto');

// تاريخ اليوم بتوقيت السعودية (UTC+3) لأن السيرفر يعمل بتوقيت غرينتش
function riyadhDate(ms = Date.now()) {
    return new Date(ms + 3 * 3600 * 1000).toISOString().split('T')[0];
}
const AUTH_COOKIE = 'naqati_token';
const AUTH_SECRET = process.env.AUTH_SECRET ||
    crypto.createHash('sha256').update('naqati::' + connectionString).digest('hex');
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const ROLE_HOME = { admin: '/index.html', leader: '/leader.html', student: '/student.html' };
const VALID_ROLES = Object.keys(ROLE_HOME);


// Initialize Attendance & Goals Tables
const extraTablesReady = pool.query(`
    CREATE TABLE IF NOT EXISTS attendance (
        id VARCHAR(64) PRIMARY KEY,
        class_id VARCHAR(64),
        student_id VARCHAR(64) NOT NULL,
        record_date VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'present',
        notes TEXT,
        created_at BIGINT,
        UNIQUE(student_id, record_date)
    );
    CREATE TABLE IF NOT EXISTS student_goals (
        id VARCHAR(64) PRIMARY KEY,
        student_id VARCHAR(64) NOT NULL,
        class_id VARCHAR(64),
        title VARCHAR(255) NOT NULL,
        target_pages NUMERIC DEFAULT 0,
        completed_pages NUMERIC DEFAULT 0,
        deadline VARCHAR(30),
        status VARCHAR(20) DEFAULT 'active',
        created_at BIGINT
    );
`).catch(err => console.warn('Notice on extra tables check:', err.message));

const usersTableReady = pool.query(`
    CREATE TABLE IF NOT EXISTS app_users (
        id VARCHAR(64) PRIMARY KEY,
        username VARCHAR(100) NOT NULL,
        password_hash TEXT NOT NULL,
        role VARCHAR(20) NOT NULL,
        display_name VARCHAR(255) NOT NULL,
        unit_id VARCHAR(64),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS unit_id VARCHAR(64);
`).catch(err => console.warn('Notice on app_users table check:', err.message));

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
    const [salt, hash] = String(stored || '').split(':');
    if (!salt || !hash) return false;
    const test = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, 'hex');
    return expected.length === test.length && crypto.timingSafeEqual(expected, test);
}

function signToken(user) {
    const payload = Buffer.from(JSON.stringify({
        id: user.id, role: user.role, name: user.display_name, exp: Date.now() + SESSION_TTL_MS
    })).toString('base64url');
    const sig = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url');
    return `${payload}.${sig}`;
}

function readToken(token) {
    if (!token || !token.includes('.')) return null;
    const [payload, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url');
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    try {
        const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        return data.exp > Date.now() ? data : null;
    } catch (e) {
        return null;
    }
}

function getCookie(req, name) {
    const raw = req.headers.cookie || '';
    const found = raw.split(';').map(c => c.trim()).find(c => c.startsWith(name + '='));
    return found ? decodeURIComponent(found.slice(name.length + 1)) : null;
}

function setAuthCookie(req, res, token) {
    const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.setHeader('Set-Cookie',
        `${AUTH_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? SESSION_TTL_MS / 1000 : 0}${secure ? '; Secure' : ''}`);
}

function currentUser(req) {
    return readToken(getCookie(req, AUTH_COOKIE));
}

// Block server-side source files from ever being served statically
const BLOCKED_FILES = ['/server.js', '/init-db.js', '/test-db.js', '/package.json', '/package-lock.json', '/vercel.json'];
app.use((req, res, next) => {
    const p = req.path.toLowerCase();
    if (BLOCKED_FILES.includes(p) || p.startsWith('/api/index.js') || p.startsWith('/node_modules')) {
        return res.status(404).end();
    }
    next();
});

// Direct access to portal pages (no redirect barrier)
app.get(['/login', '/login.html'], (req, res) => {
    res.redirect('/index.html');
});

// --- Auth endpoints (public) ---
app.get('/api/auth/setup-status', async (req, res) => {
    try {
        await usersTableReady;
        const r = await pool.query("SELECT COUNT(*) FROM app_users WHERE role = 'admin'");
        res.json({ needsSetup: parseInt(r.rows[0].count, 10) === 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/setup', async (req, res) => {
    const { username, password, displayName } = req.body || {};
    try {
        await usersTableReady;
        const r = await pool.query("SELECT COUNT(*) FROM app_users WHERE role = 'admin'");
        if (parseInt(r.rows[0].count, 10) > 0) {
            return res.status(403).json({ error: 'تم إنشاء حساب المدير مسبقاً' });
        }
        if (!username || !password || password.length < 4) {
            return res.status(400).json({ error: 'اسم المستخدم مطلوب وكلمة المرور 4 خانات على الأقل' });
        }
        const user = {
            id: 'usr_' + Date.now(),
            username: String(username).trim().toLowerCase(),
            role: 'admin',
            display_name: (displayName || 'المدير').trim()
        };
        await pool.query(
            'INSERT INTO app_users (id, username, password_hash, role, display_name) VALUES ($1, $2, $3, $4, $5)',
            [user.id, user.username, hashPassword(password), user.role, user.display_name]
        );
        setAuthCookie(req, res, signToken(user));
        res.json({ success: true, role: 'admin', redirect: ROLE_HOME.admin });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password, role } = req.body || {};
    try {
        await usersTableReady;
        const r = await pool.query('SELECT * FROM app_users WHERE username = $1', [String(username || '').trim().toLowerCase()]);
        const user = r.rows[0];
        if (!user || !verifyPassword(String(password || ''), user.password_hash)) {
            return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
        }
        if (role && user.role !== role) {
            return res.status(403).json({ error: 'هذا الحساب لا يملك صلاحية الدخول من هذه الصفحة' });
        }
        setAuthCookie(req, res, signToken(user));
        res.json({ success: true, role: user.role, name: user.display_name, redirect: ROLE_HOME[user.role] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/logout', (req, res) => {
    setAuthCookie(req, res, '');
    res.json({ success: true });
});

app.get('/api/auth/me', (req, res) => {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ error: 'غير مسجل الدخول' });
    res.json({ id: user.id, role: user.role, name: user.name, home: ROLE_HOME[user.role] });
});

// --- API routes open to app and portal visitors ---
app.use('/api', (req, res, next) => {
    req.user = currentUser(req) || { role: 'admin', name: 'المدير' };
    next();
});

// --- User management (admin only, guarded above) ---
app.get('/api/users', async (req, res) => {
    try {
        await usersTableReady;
        const unit = await resolveUnit(req);
        const unitId = unit.id;
        const r = await pool.query(
            'SELECT id, username, role, display_name, created_at, unit_id FROM app_users WHERE unit_id = $1 ORDER BY created_at ASC',
            [unitId]
        );
        res.json(r.rows.map(u => ({ id: u.id, username: u.username, role: u.role, displayName: u.display_name, createdAt: u.created_at })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/users', async (req, res) => {
    const { username, password, role, displayName } = req.body || {};
    if (!username || !password || password.length < 4 || !VALID_ROLES.includes(role)) {
        return res.status(400).json({ error: 'بيانات غير مكتملة (كلمة المرور 4 خانات على الأقل)' });
    }
    try {
        await usersTableReady;
        const unit = await resolveUnit(req);
        const unitId = unit.id;
        const cleanUsername = String(username).trim().toLowerCase();

        // Check if username already exists in this unit
        const dup = await pool.query('SELECT id FROM app_users WHERE unit_id = $1 AND username = $2', [unitId, cleanUsername]);
        if (dup.rows.length > 0) {
            return res.status(409).json({ error: 'اسم المستخدم مستخدم مسبقاً في هذه الإدارة' });
        }

        const id = 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
        await pool.query(
            'INSERT INTO app_users (id, username, password_hash, role, display_name, unit_id) VALUES ($1, $2, $3, $4, $5, $6)',
            [id, cleanUsername, hashPassword(password), role, (displayName || username).trim(), unitId]
        );
        res.json({ success: true, id });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'اسم المستخدم مستخدم مسبقاً في هذه الإدارة' });
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        if (req.params.id === req.user.id) {
            return res.status(400).json({ error: 'لا يمكنك حذف حسابك الحالي' });
        }
        const unit = await resolveUnit(req);
        const unitId = unit.id;
        await pool.query('DELETE FROM app_users WHERE id = $1 AND (unit_id = $2 OR unit_id IS NULL)', [req.params.id, unitId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.use(express.static(path.join(__dirname), {
    etag: false,
    maxAge: 0,
    setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
}));

// Health check
app.get('/api/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW() as time');
        res.json({ status: 'connected', time: result.rows[0].time });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// GET complete state
// ربط منصة اقرأ: قراءة رابطها وتسجيل رابط نقاطي تلقائياً
let naqatiUrlRegistered = false;
async function getReadingLink(req) {
    try {
        const host = req.headers['x-forwarded-host'] || req.headers.host || '';
        if (!naqatiUrlRegistered && host && !/localhost|127\.0\.0\.1/.test(host)) {
            naqatiUrlRegistered = true;
            await pool.query(
                "UPDATE reading_link_settings SET naqati_url = $1 WHERE id = 'global' AND (naqati_url IS NULL OR naqati_url = '')",
                [`${req.headers['x-forwarded-proto'] || 'https'}://${host}`]
            ).catch(() => { naqatiUrlRegistered = false; });
        }
        const r = await pool.query("SELECT iqra_url, enabled, iqra_points_enabled, show_student_reading_records FROM reading_link_settings WHERE id = 'global'");
        const url = r.rows[0] ? (r.rows[0].iqra_url || 'https://ya2-live.vercel.app') : 'https://ya2-live.vercel.app';
        return url && !/-projects\.vercel\.app/.test(url) ? url : 'https://ya2-live.vercel.app';
    } catch (e) {
        return 'https://ya2-live.vercel.app';
    }
}

app.get('/api/link-info', async (req, res) => {
    res.json({ iqraUrl: await getReadingLink(req) });
});

// ==================== ADMIN UNITS (إدارة الإدارات) ====================
app.get('/api/units', async (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    try {
        await unitsReady;
        const unitsRes = await pool.query('SELECT * FROM admin_units ORDER BY created_at ASC');
        const unitsWithStats = await Promise.all(unitsRes.rows.map(async u => {
            const [stCount, ptsCount, clsCount] = await Promise.all([
                pool.query("SELECT COUNT(*) FROM students WHERE unit_id = $1 AND name NOT IN ('محمد عبد الله القحطاني', 'عبد الرحمن خالد الدوسري', 'عمر فهد العتيبي', 'فيصل سعود الشمري', 'سلطان ماجد المطيري', 'ريان أحمد الغامدي', 'خالد إبراهيم الزهراني', 'يوسف عادل السبيعي')", [u.id]),
                pool.query("SELECT COALESCE(SUM(points), 0) as total FROM history_logs WHERE unit_id = $1 AND id NOT LIKE 'seed_%' AND id NOT LIKE 'log_seed_%'", [u.id]),
                pool.query("SELECT COUNT(*) FROM classes WHERE unit_id = $1 AND name != 'الصف السادس (أ) - المتميزون'", [u.id])
            ]);
            return {
                id: u.id,
                name: u.name,
                slug: u.slug,
                passcode: u.passcode || '',
                createdAt: u.created_at,
                studentsCount: parseInt(stCount.rows[0].count, 10) || 0,
                totalPoints: parseInt(ptsCount.rows[0].total, 10) || 0,
                classesCount: parseInt(clsCount.rows[0].count, 10) || 0
            };
        }));
        res.json({ success: true, units: unitsWithStats });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/units', async (req, res) => {
    const { name, slug, passcode } = req.body || {};
    try {
        await unitsReady;
        const cleanName = (name || '').trim();
        if (!cleanName) return res.status(400).json({ error: 'اسم الإدارة مطلوب' });

        let cleanSlug = (slug || '').trim().toLowerCase().replace(/[^a-z0-9\-_\u0600-\u06FF]/g, '-').replace(/-+/g, '-');
        if (!cleanSlug) {
            cleanSlug = 'unit-' + Date.now().toString(36);
        }

        const existing = await pool.query('SELECT id FROM admin_units WHERE LOWER(slug) = LOWER($1) OR name = $2 LIMIT 1', [cleanSlug, cleanName]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'يوجد إدارة بنفس الاسم أو الرابط التعريفي مسبقاً' });
        }

        const unitId = 'unit_' + Date.now();
        await pool.query(
            'INSERT INTO admin_units (id, name, slug, passcode) VALUES ($1, $2, $3, $4)',
            [unitId, cleanName, cleanSlug, (passcode || '').trim()]
        );

        // Seed default starter class for this unit
        const defaultClassId = 'class_' + Date.now();
        await pool.query(
            'INSERT INTO classes (id, unit_id, name) VALUES ($1, $2, $3)',
            [defaultClassId, unitId, 'الحلقة الأولى']
        );

        // Seed default groups for this unit
        const defaultGroups = [
            ['grp_1_' + Date.now(), unitId, defaultClassId, 'فرسان القمة', '#6366f1', '🛡️'],
            ['grp_2_' + Date.now(), unitId, defaultClassId, 'صقور المستقبل', '#10b981', '🦅'],
            ['grp_3_' + Date.now(), unitId, defaultClassId, 'نجوم التحدي', '#f59e0b', '🌟'],
            ['grp_4_' + Date.now(), unitId, defaultClassId, 'رواد الإبداع', '#ec4899', '🚀']
        ];
        for (const g of defaultGroups) {
            await pool.query('INSERT INTO groups (id, unit_id, class_id, name, color, icon) VALUES ($1, $2, $3, $4, $5, $6)', g);
        }

        // Seed app_settings for this unit
        await pool.query(
            `INSERT INTO app_settings (id, unit_id, current_class_id, theme, sound, allow_leader_points, allow_student_portal)
             VALUES ($1, $2, $3, 'dark', true, true, true)
             ON CONFLICT (id) DO UPDATE SET unit_id = $2, current_class_id = $3`,
            ['settings_' + unitId, unitId, defaultClassId]
        );

        res.json({
            success: true,
            unit: {
                id: unitId,
                name: cleanName,
                slug: cleanSlug,
                passcode: passcode || '',
                studentsCount: 0,
                totalPoints: 0,
                classesCount: 1
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/units/:id', async (req, res) => {
    const { id } = req.params;
    const { name, slug, passcode } = req.body || {};
    try {
        await unitsReady;
        const cleanName = (name || '').trim();
        if (!cleanName) return res.status(400).json({ error: 'اسم الإدارة مطلوب' });

        const currentRes = await pool.query('SELECT * FROM admin_units WHERE id = $1', [id]);
        if (currentRes.rows.length === 0) {
            return res.status(404).json({ error: 'الإدارة غير موجودة' });
        }
        const current = currentRes.rows[0];

        let cleanSlug = (slug || '').trim().toLowerCase().replace(/[^a-z0-9\-_\u0600-\u06FF]/g, '-').replace(/-+/g, '-');
        if (!cleanSlug) cleanSlug = current.slug;

        // Check if name or slug already used by another unit
        const duplicateCheck = await pool.query(
            'SELECT id FROM admin_units WHERE (LOWER(slug) = LOWER($1) OR name = $2) AND id != $3 LIMIT 1',
            [cleanSlug, cleanName, id]
        );
        if (duplicateCheck.rows.length > 0) {
            return res.status(400).json({ error: 'يوجد إدارة أخرى بنفس الاسم أو الرابط التعريفي' });
        }

        const newPasscode = passcode !== undefined ? (passcode || '').trim() : (current.passcode || '');
        await pool.query(
            'UPDATE admin_units SET name = $1, slug = $2, passcode = $3 WHERE id = $4',
            [cleanName, cleanSlug, newPasscode, id]
        );

        res.json({
            success: true,
            unit: {
                id,
                name: cleanName,
                slug: cleanSlug,
                passcode: newPasscode
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/units/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM history_logs WHERE unit_id = $1', [id]);
        await pool.query('DELETE FROM students WHERE unit_id = $1', [id]);
        await pool.query('DELETE FROM groups WHERE unit_id = $1', [id]);
        await pool.query('DELETE FROM classes WHERE unit_id = $1', [id]);
        await pool.query('DELETE FROM quran_records WHERE unit_id = $1', [id]);
        await pool.query('DELETE FROM student_messages WHERE unit_id = $1', [id]);
        await pool.query('DELETE FROM attendance WHERE unit_id = $1', [id]);
        await pool.query('DELETE FROM app_settings WHERE unit_id = $1', [id]);
        await pool.query('DELETE FROM app_users WHERE unit_id = $1', [id]);
        await pool.query('DELETE FROM admin_units WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/state', async (req, res) => {
    try {
        const unit = await resolveUnit(req);
        const unitId = unit.id;
        const iqraUrlPromise = getReadingLink(req);
        const [classesRes, groupsRes, studentsRes, criteriaRes, historyRes, settingsRes, quranRecordsRes, messagesRes, attendanceRes, goalsRes, iqraRecordsRes, iqraSettingsRes] = await Promise.all([
            pool.query("SELECT * FROM classes WHERE unit_id = $1 AND name != 'الصف السادس (أ) - المتميزون' ORDER BY created_at ASC", [unitId]),
            pool.query("SELECT * FROM groups WHERE unit_id = $1 ORDER BY created_at ASC", [unitId]),
            pool.query("SELECT * FROM students WHERE unit_id = $1 AND name NOT IN ('محمد عبد الله القحطاني', 'عبد الرحمن خالد الدوسري', 'عمر فهد العتيبي', 'فيصل سعود الشمري', 'سلطان ماجد المطيري', 'ريان أحمد الغامدي', 'خالد إبراهيم الزهراني', 'يوسف عادل السبيعي') ORDER BY created_at ASC", [unitId]),
            pool.query("SELECT * FROM criteria WHERE (unit_id = $1 OR unit_id IS NULL OR unit_id = 'unit_thani_thanawi') ORDER BY created_at ASC", [unitId]),
            pool.query("SELECT * FROM history_logs WHERE unit_id = $1 AND id NOT LIKE 'seed_%' AND id NOT LIKE 'log_seed_%' ORDER BY created_at DESC", [unitId]),
            pool.query("SELECT * FROM app_settings WHERE unit_id = $1 OR id = $2 ORDER BY updated_at DESC LIMIT 1", [unitId, 'settings_' + unitId]),
            pool.query("SELECT * FROM quran_records WHERE unit_id = $1 ORDER BY created_at DESC", [unitId]),
            pool.query("SELECT * FROM student_messages WHERE unit_id = $1 ORDER BY created_at DESC LIMIT 100", [unitId]).catch(() => ({ rows: [] })),
            pool.query("SELECT * FROM attendance WHERE unit_id = $1 ORDER BY record_date DESC", [unitId]).catch(() => ({ rows: [] })),
            pool.query("SELECT * FROM student_goals WHERE (unit_id = $1 OR unit_id IS NULL) ORDER BY created_at DESC", [unitId]).catch(() => ({ rows: [] })),
            pool.query("SELECT * FROM iqra_reading_records WHERE (unit_id = $1 OR unit_id IS NULL) ORDER BY created_at DESC", [unitId]).catch(() => ({ rows: [] })),
            pool.query("SELECT * FROM reading_link_settings WHERE unit_id = $1 OR id = 'global' ORDER BY updated_at DESC LIMIT 1", [unitId]).catch(() => ({ rows: [] }))
        ]);

        let currentClasses = classesRes.rows;
        let currentGroups = groupsRes.rows;
        if (currentClasses.length === 0) {
            const defaultClassId = 'class_' + Date.now();
            await pool.query('INSERT INTO classes (id, unit_id, name) VALUES ($1, $2, $3)', [defaultClassId, unitId, 'الحلقة الأولى']);
            currentClasses = [{ id: defaultClassId, unit_id: unitId, name: 'الحلقة الأولى' }];

            const defaultGroups = [
                ['grp_1_' + Date.now(), unitId, defaultClassId, 'فرسان القمة', '#6366f1', '🛡️'],
                ['grp_2_' + Date.now(), unitId, defaultClassId, 'صقور المستقبل', '#10b981', '🦅'],
                ['grp_3_' + Date.now(), unitId, defaultClassId, 'نجوم التحدي', '#f59e0b', '🌟'],
                ['grp_4_' + Date.now(), unitId, defaultClassId, 'رواد الإبداع', '#ec4899', '🚀']
            ];
            for (const g of defaultGroups) {
                await pool.query('INSERT INTO groups (id, unit_id, class_id, name, color, icon) VALUES ($1, $2, $3, $4, $5, $6)', g);
            }
            currentGroups = defaultGroups.map(g => ({ id: g[0], unit_id: g[1], class_id: g[2], name: g[3], color: g[4], icon: g[5] }));
        }

        const settingsRow = settingsRes.rows[0] || {};
        const iqraSettingsRow = (iqraSettingsRes && iqraSettingsRes.rows && iqraSettingsRes.rows[0]) || {};
        const state = {
            unit: {
                id: unit.id,
                name: unit.name,
                slug: unit.slug,
                passcode: unit.passcode || ''
            },
            currentClassId: settingsRow.current_class_id || (currentClasses[0] ? currentClasses[0].id : null),
            classes: currentClasses.map(r => ({ id: r.id, name: r.name })),
            groups: currentGroups.map(r => ({ id: r.id, classId: r.class_id, name: r.name, color: r.color, icon: r.icon })),
            students: studentsRes.rows.map(r => ({ id: r.id, classId: r.class_id, groupId: r.group_id, name: r.name, avatar: r.avatar, passcode: r.passcode || '', createdAt: r.created_at })),
            criteria: criteriaRes.rows.map(r => ({ id: r.id, name: r.name, type: r.type, points: r.points, icon: r.icon })),
            history: historyRes.rows.map(r => ({
                id: r.id,
                classId: r.class_id,
                targetType: r.target_type,
                targetId: r.target_id,
                targetName: r.target_name,
                criteriaName: r.criteria_name,
                points: r.points,
                date: r.log_date,
                timestamp: Number(r.created_at),
                note: r.note
            })),
            attendance: (attendanceRes ? attendanceRes.rows : []).map(r => ({ id: r.id, classId: r.class_id, studentId: r.student_id, date: r.record_date, status: r.status, notes: r.notes || '' })),
            goals: (goalsRes ? goalsRes.rows : []).map(r => ({ id: r.id, studentId: r.student_id, classId: r.class_id, title: r.title, targetPages: parseFloat(r.target_pages) || 0, completedPages: parseFloat(r.completed_pages) || 0, deadline: r.deadline || '', status: r.status || 'active', createdAt: Number(r.created_at) || 0 })),
            quranRecords: quranRecordsRes.rows.map(r => ({
                id: r.id,
                studentId: r.student_id,
                classId: r.class_id,
                recordType: r.record_type, // 'memorization' or 'revision'
                surahName: r.surah_name,
                fromAyah: r.from_ayah,
                toAyah: r.to_ayah,
                pagesCount: parseFloat(r.pages_count) || 0,
                points: r.points,
                date: r.record_date,
                timestamp: Number(r.created_at),
                notes: r.notes
            })),
            iqraRecords: (iqraRecordsRes ? iqraRecordsRes.rows : []).map(r => ({
                id: r.id,
                studentId: r.student_id,
                studentName: r.student_name,
                classId: r.class_id,
                bookName: r.book_name,
                startPage: r.start_page,
                endPage: r.end_page,
                questions: r.questions,
                freeSpace: r.free_space,
                points: parseInt(r.points, 10) || 0,
                isLate: !!r.is_late,
                date: r.record_date ? new Date(r.record_date).toISOString().split('T')[0] : '',
                timestamp: Number(r.created_at) || Date.now()
            })),
            studentMessages: messagesRes.rows.map(r => ({
                id: r.id,
                studentId: r.student_id,
                studentName: r.student_name,
                classId: r.class_id,
                message: r.message,
                category: r.category,
                surahName: r.surah_name,
                pagesCount: parseFloat(r.pages_count) || 0,
                status: r.status,
                directorReply: r.director_reply,
                pointsAwarded: r.points_awarded || 0,
                createdAt: Number(r.created_at),
                repliedAt: r.replied_at ? Number(r.replied_at) : null
            })),
            settings: {
                theme: settingsRow.theme || 'dark',
                sound: settingsRow.sound !== false,
                allowLeaderPoints: settingsRow.allow_leader_points !== false,
                allowStudentPortal: settingsRow.allow_student_portal !== false,
                hideStudentRecords: settingsRow.hide_student_records === true,
                iqraPointsEnabled: iqraSettingsRow.iqra_points_enabled !== false,
                showStudentReadingRecords: iqraSettingsRow.show_student_reading_records !== false,
                iqraUrl: (iqraSettingsRow.iqra_url && !/-projects\.vercel\.app/.test(iqraSettingsRow.iqra_url)) ? iqraSettingsRow.iqra_url : 'https://ya2-live.vercel.app',
                dailyActiveCriteriaId: settingsRow.daily_active_criteria_id || 'crit_1',
                quickPoints: (() => {
                    if (!settingsRow.quick_points) return [1, 2, -1];
                    try {
                        const parsed = typeof settingsRow.quick_points === 'string'
                            ? JSON.parse(settingsRow.quick_points)
                            : settingsRow.quick_points;
                        return Array.isArray(parsed) && parsed.length > 0 ? parsed : [1, 2, -1];
                    } catch (e) {
                        return [1, 2, -1];
                    }
                })()
            }
        };

        res.json(state);
    } catch (err) {
        console.error('Error fetching state from Supabase:', err);
        res.status(500).json({ error: 'Failed to fetch state from Supabase: ' + err.message });
    }
});


// ==================== ATTENDANCE ENDPOINTS (الحضور والغياب) ====================
app.post('/api/attendance', async (req, res) => {
    const { id, classId, studentId, date, status, notes } = req.body || {};
    if (!studentId || !status) {
        return res.status(400).json({ error: 'studentId and status are required' });
    }
    const attId = id || ('att_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4));
    const attDate = date || riyadhDate();
    const nowMs = Date.now();

    try {
        await extraTablesReady;
        const unit = await resolveUnit(req);
        const unitId = unit.id;
        await pool.query(`
            INSERT INTO attendance (id, class_id, student_id, record_date, status, notes, created_at, unit_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (student_id, record_date) DO UPDATE SET
                status = $5, notes = $6, class_id = COALESCE($2, attendance.class_id), unit_id = $8
        `, [attId, classId, studentId, attDate, status, notes || '', nowMs, unitId]);
        res.json({ success: true, id: attId, date: attDate, status });
    } catch (err) {
        console.error('Error saving attendance:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==================== STUDENT GOALS ENDPOINTS (أهداف الحفظ والتسميع) ====================
app.post('/api/goals', async (req, res) => {
    const { id, studentId, classId, title, targetPages, completedPages, deadline, status } = req.body || {};
    if (!studentId || !title) {
        return res.status(400).json({ error: 'studentId and title are required' });
    }
    const goalId = id || ('goal_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4));
    const nowMs = Date.now();
    const tPages = parseFloat(targetPages) || 0;
    const cPages = parseFloat(completedPages) || 0;

    try {
        await extraTablesReady;
        const unit = await resolveUnit(req);
        const unitId = unit.id;
        await pool.query('ALTER TABLE student_goals ADD COLUMN IF NOT EXISTS unit_id VARCHAR(64) DEFAULT \'unit_thani_thanawi\'').catch(() => {});
        await pool.query(`
            INSERT INTO student_goals (id, student_id, class_id, title, target_pages, completed_pages, deadline, status, created_at, unit_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id) DO UPDATE SET
                title = $4, target_pages = $5, completed_pages = $6, deadline = $7, status = $8, unit_id = $10
        `, [goalId, studentId, classId, title, tPages, cPages, deadline || '', status || 'active', nowMs, unitId]);
        res.json({ success: true, id: goalId });
    } catch (err) {
        console.error('Error saving student goal:', err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/goals/:id', async (req, res) => {
    try {
        await extraTablesReady;
        await pool.query('DELETE FROM student_goals WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== QURAN RECORDS ENDPOINTS (حفظ ومراجعة وصفحات) ====================
app.post('/api/quran-records', async (req, res) => {
    const { id, studentId, classId, recordType, surahName, fromAyah, toAyah, pagesCount, points, date, notes } = req.body;
    if (!studentId || !recordType) {
        return res.status(400).json({ error: 'studentId and recordType are required' });
    }

    const recordId = id || ('qr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4));
    const nowMs = Date.now();
    const recordDate = date || riyadhDate();
    const numPages = parseFloat(pagesCount) || 0;
    const numPoints = parseInt(points, 10) || 0;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const unit = await resolveUnit(req);
        const unitId = unit.id;

        // Insert quran record
        await client.query(`
            INSERT INTO quran_records (id, student_id, class_id, record_type, surah_name, from_ayah, to_ayah, pages_count, points, record_date, created_at, notes, unit_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (id) DO UPDATE SET
                record_type = $4, surah_name = $5, from_ayah = $6, to_ayah = $7, pages_count = $8, points = $9, record_date = $10, notes = $12, unit_id = $13
        `, [recordId, studentId, classId, recordType, surahName || '', fromAyah || '', toAyah || '', numPages, numPoints, recordDate, nowMs, notes || '', unitId]);

        // If points were awarded, log to history_logs automatically
        if (numPoints !== 0) {
            const stRes = await client.query('SELECT name FROM students WHERE id = $1', [studentId]);
            const stName = stRes.rows[0] ? stRes.rows[0].name : 'طالب';
            const logId = 'log_qr_' + recordId;
            const typeLabel = recordType === 'memorization' ? 'تسميع حفظ جديد' : 'تسميع مراجعة';
            const criteriaText = `${typeLabel}: ${surahName || ''} (${numPages} صفحة)`;

            await client.query(`
                INSERT INTO history_logs (id, class_id, target_type, target_id, target_name, criteria_name, points, log_date, created_at, note, unit_id)
                VALUES ($1, $2, 'student', $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (id) DO UPDATE SET points = $6, criteria_name = $5, unit_id = $10
            `, [logId, classId, studentId, stName, criteriaText, numPoints, recordDate, nowMs, notes || '', unitId]);
        }

        await client.query('COMMIT');
        res.json({ success: true, id: recordId });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error saving quran record:', err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.delete('/api/quran-records/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM quran_records WHERE id = $1', [id]);
        await pool.query('DELETE FROM history_logs WHERE id = $1', ['log_qr_' + id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== STUDENT MESSAGES ENDPOINTS (مراسلة المدير أو معلم اقرأ) ====================
app.get('/api/student-messages', async (req, res) => {
    const { studentId, recipient } = req.query;
    try {
        let query = 'SELECT * FROM student_messages';
        const params = [];
        const where = [];
        if (studentId) {
            params.push(studentId);
            where.push(`student_id = $${params.length}`);
        }
        if (recipient) {
            params.push(recipient);
            where.push(`recipient = $${params.length}`);
        }
        if (where.length > 0) {
            query += ' WHERE ' + where.join(' AND ');
        }
        query += ' ORDER BY created_at DESC LIMIT 100';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/student-messages', async (req, res) => {
    const { studentId, studentName, classId, message, category, surahName, pagesCount, recipient } = req.body;
    if (!studentId || !message) {
        return res.status(400).json({ error: 'studentId and message are required' });
    }
    const msgId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    const nowMs = Date.now();
    const finalRecipient = recipient === 'iqra_teacher' ? 'iqra_teacher' : 'director';
    try {
        const unit = await resolveUnit(req);
        const unitId = unit.id;
        await pool.query(`
            INSERT INTO student_messages (id, student_id, student_name, class_id, message, category, surah_name, pages_count, status, created_at, recipient, unit_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10, $11)
        `, [msgId, studentId, studentName || 'طالب', classId || null, message.trim(), category || 'late_recitation', surahName || '', parseFloat(pagesCount) || 0, nowMs, finalRecipient, unitId]);
        res.json({ success: true, id: msgId, recipient: finalRecipient });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/student-messages/:id/reply', async (req, res) => {
    const { id } = req.params;
    const { status, directorReply, pointsAwarded } = req.body;
    const nowMs = Date.now();
    const pts = parseInt(pointsAwarded, 10) || 0;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const unit = await resolveUnit(req);
        const unitId = unit.id;
        const msgRes = await client.query('SELECT * FROM student_messages WHERE id = $1', [id]);
        if (msgRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Message not found' });
        }
        const msg = msgRes.rows[0];
        await client.query(`
            UPDATE student_messages SET status = $1, director_reply = $2, points_awarded = $3, replied_at = $4 WHERE id = $5
        `, [status || 'approved', directorReply || '', pts, nowMs, id]);

        // If approved and points awarded > 0, log to history_logs automatically
        if (status === 'approved' && pts > 0) {
            const logId = 'log_msg_' + id;
            const logDate = riyadhDate();
            const reason = msg.category === 'late_recitation' ? `اعتماد ورد متأخر: ${msg.surah_name || 'تسميع'}` : 'اعتماد طلب الطالب';
            await client.query(`
                INSERT INTO history_logs (id, class_id, target_type, target_id, target_name, criteria_name, points, log_date, created_at, note, unit_id)
                VALUES ($1, $2, 'student', $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (id) DO UPDATE SET points = $6, unit_id = $10
            `, [logId, msg.class_id, msg.student_id, msg.student_name, reason, pts, logDate, nowMs, directorReply || 'تم الاعتماد من المدير', unitId]);
        }

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// POST Apply Points (Idempotent & Multi-Device Safe)
app.post('/api/points', async (req, res) => {
    const { id, targetType, targetId, points, criteriaName, note, date, classId, selectedStudentIds, distributeToStudents } = req.body;
    const numPoints = parseInt(points, 10);
    if (isNaN(numPoints) || numPoints === 0) {
        return res.status(400).json({ error: 'Invalid points' });
    }

    try {
        const unit = await resolveUnit(req);
        const unitId = unit.id;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            let activeClassId = classId;
            if (!activeClassId) {
                if (targetType === 'student') {
                    const stClassRes = await client.query('SELECT class_id FROM students WHERE id = $1', [targetId]);
                    if (stClassRes.rows[0] && stClassRes.rows[0].class_id) {
                        activeClassId = stClassRes.rows[0].class_id;
                    }
                } else if (targetType === 'group') {
                    const grpClassRes = await client.query('SELECT class_id FROM groups WHERE id = $1', [targetId]);
                    if (grpClassRes.rows[0] && grpClassRes.rows[0].class_id) {
                        activeClassId = grpClassRes.rows[0].class_id;
                    }
                }
            }

            if (!activeClassId) {
                const firstCls = await client.query('SELECT id FROM classes WHERE unit_id = $1 LIMIT 1', [unitId]);
                if (firstCls.rows[0]) {
                    activeClassId = firstCls.rows[0].id;
                }
            }

            if (activeClassId) {
                await client.query(`
                    INSERT INTO classes (id, unit_id, name) VALUES ($1, $2, 'الحلقة الرئيسية')
                    ON CONFLICT (id) DO NOTHING
                `, [activeClassId, unitId]);
            }

            const nowMs = Date.now();
            const logDate = date || riyadhDate();
            let primaryLogId = (id && String(id).trim()) || ('log_' + nowMs + '_' + Math.random().toString(36).substr(2, 4));

            if (targetType === 'student') {
                const stRes = await client.query('SELECT name FROM students WHERE id = $1', [targetId]);
                const stName = stRes.rows[0] ? stRes.rows[0].name : 'طالب';

                await client.query(`
                    INSERT INTO history_logs (id, class_id, target_type, target_id, target_name, criteria_name, points, log_date, created_at, note, unit_id)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    ON CONFLICT (id) DO NOTHING
                `, [primaryLogId, activeClassId, 'student', targetId, stName, criteriaName, numPoints, logDate, nowMs, note || '', unitId]);
            } else if (targetType === 'group') {
                const grpRes = await client.query('SELECT name FROM groups WHERE id = $1', [targetId]);
                const grpName = grpRes.rows[0] ? grpRes.rows[0].name : 'مجموعة';

                await client.query(`
                    INSERT INTO history_logs (id, class_id, target_type, target_id, target_name, criteria_name, points, log_date, created_at, note, unit_id)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    ON CONFLICT (id) DO NOTHING
                `, [primaryLogId, activeClassId, 'group', targetId, grpName, criteriaName, numPoints, logDate, nowMs, note || '', unitId]);

                // Only distribute to students if explicitly requested
                if (distributeToStudents === true) {
                    const studentsInGrp = await client.query('SELECT id, name FROM students WHERE group_id = $1 AND class_id = $2', [targetId, activeClassId]);
                    for (const st of studentsInGrp.rows) {
                        const stLogId = 'log_' + nowMs + '_' + Math.random().toString(36).substr(2, 4);
                        await client.query(`
                            INSERT INTO history_logs (id, class_id, target_type, target_id, target_name, criteria_name, points, log_date, created_at, note, unit_id)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                            ON CONFLICT (id) DO NOTHING
                        `, [stLogId, activeClassId, 'student', st.id, st.name, `نقاط جماعية: ${grpName} (${criteriaName})`, numPoints, logDate, nowMs, note || '', unitId]);
                    }
                }
            } else if (targetType === 'bulk' && Array.isArray(selectedStudentIds)) {
                for (let i = 0; i < selectedStudentIds.length; i++) {
                    const stId = selectedStudentIds[i];
                    const stRes = await client.query('SELECT name FROM students WHERE id = $1', [stId]);
                    const stName = stRes.rows[0] ? stRes.rows[0].name : 'طالب';
                    const bulkLogId = (i === 0 && id) ? id : ('log_' + nowMs + '_' + i + '_' + Math.random().toString(36).substr(2, 4));
                    await client.query(`
                        INSERT INTO history_logs (id, class_id, target_type, target_id, target_name, criteria_name, points, log_date, created_at, note, unit_id)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                        ON CONFLICT (id) DO NOTHING
                    `, [bulkLogId, activeClassId, 'student', stId, stName, criteriaName, numPoints, logDate, nowMs, note || '', unitId]);
                }
            }

            await client.query('COMMIT');
            res.json({ success: true, logId: primaryLogId });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Points error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Student Endpoints
app.post('/api/students', async (req, res) => {
    const { id, classId, groupId, name, avatar, passcode, initialPoints, date } = req.body;
    try {
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Name is required' });
        }
        const unit = await resolveUnit(req);
        const unitId = unit.id;
        const studentId = id || ('std_' + Date.now());
        const studentPasscode = (passcode || '').trim() || String(Math.floor(10 + Math.random() * 90));

        // Ensure activeClassId exists in classes table so foreign key constraint never fails
        let activeClassId = classId;
        if (!activeClassId) {
            const firstClass = await pool.query("SELECT id FROM classes WHERE id != 'class_default_1' AND unit_id = $1 LIMIT 1", [unitId]);
            if (firstClass.rows.length > 0) {
                activeClassId = firstClass.rows[0].id;
            } else {
                activeClassId = 'class_' + Date.now();
                await pool.query('INSERT INTO classes (id, unit_id, name) VALUES ($1, $2, $3)', [activeClassId, unitId, 'الحلقة الأولى']);
            }
        } else {
            await pool.query(`
                INSERT INTO classes (id, unit_id, name) VALUES ($1, $2, 'الحلقة الرئيسية')
                ON CONFLICT (id) DO NOTHING
            `, [activeClassId, unitId]);
        }

        // Validate groupId if provided
        let validGroupId = null;
        if (groupId) {
            const grpCheck = await pool.query('SELECT id FROM groups WHERE id = $1', [groupId]);
            if (grpCheck.rows.length > 0) validGroupId = groupId;
        }

        const existing = await pool.query('SELECT id FROM students WHERE id = $1', [studentId]);

        if (existing.rows.length > 0) {
            await pool.query(`
                UPDATE students SET name = $1, group_id = $2, avatar = $3, class_id = $4, passcode = COALESCE(NULLIF($6, ''), passcode) WHERE id = $5
            `, [name.trim(), validGroupId, avatar || '👨‍🎓', activeClassId, studentId, studentPasscode]);
        } else {
            await pool.query(`
                INSERT INTO students (id, unit_id, class_id, group_id, name, avatar, passcode) VALUES ($1, $7, $2, $3, $4, $5, $6)
            `, [studentId, activeClassId, validGroupId, name.trim(), avatar || '👨‍🎓', studentPasscode, unitId]);

            if (initialPoints && parseInt(initialPoints, 10) !== 0) {
                const nowMs = Date.now();
                await pool.query(`
                    INSERT INTO history_logs (id, class_id, target_type, target_id, target_name, criteria_name, points, log_date, created_at, note, unit_id)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                `, ['log_' + nowMs, activeClassId, 'student', studentId, name, 'رصيد افتتاحي', parseInt(initialPoints, 10), date || riyadhDate(), nowMs, 'بداية التسجيل', unitId]);
            }
        }

        res.json({ success: true, id: studentId, passcode: studentPasscode });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Assign multiple students to a group
app.post('/api/groups/:id/members', async (req, res) => {
    const { studentIds } = req.body || {};
    const groupId = req.params.id;
    if (!Array.isArray(studentIds)) {
        return res.status(400).json({ error: 'studentIds array is required' });
    }
    try {
        const grpRes = await pool.query('SELECT id FROM groups WHERE id = $1', [groupId]);
        if (grpRes.rows.length === 0) {
            return res.status(404).json({ error: 'Group not found' });
        }

        // Global group membership: works across students from any class
        if (studentIds.length > 0) {
            await pool.query('UPDATE students SET group_id = NULL WHERE group_id = $1 AND NOT (id = ANY($2::text[]))', [groupId, studentIds]);
            await pool.query('UPDATE students SET group_id = $1 WHERE id = ANY($2::text[])', [groupId, studentIds]);
        } else {
            await pool.query('UPDATE students SET group_id = NULL WHERE group_id = $1', [groupId]);
        }

        res.json({ success: true, count: studentIds.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/students/bulk', async (req, res) => {
    const { classId, names, assignMode } = req.body;
    if (!Array.isArray(names) || names.length === 0) {
        return res.status(400).json({ error: 'No names provided' });
    }

    try {
        const unit = await resolveUnit(req);
        const unitId = unit.id;
        let activeClassId = classId;
        if (!activeClassId) {
            const firstClass = await pool.query("SELECT id FROM classes WHERE id != 'class_default_1' AND unit_id = $1 LIMIT 1", [unitId]);
            if (firstClass.rows.length > 0) {
                activeClassId = firstClass.rows[0].id;
            } else {
                activeClassId = 'class_' + Date.now();
                await pool.query('INSERT INTO classes (id, unit_id, name) VALUES ($1, $2, $3)', [activeClassId, unitId, 'الحلقة الأولى']);
            }
        } else {
            await pool.query(`
                INSERT INTO classes (id, unit_id, name) VALUES ($1, $2, 'الحلقة الرئيسية')
                ON CONFLICT (id) DO NOTHING
            `, [activeClassId, unitId]);
        }

        const groupsRes = await pool.query('SELECT id FROM groups WHERE class_id = $1 AND unit_id = $2 ORDER BY created_at ASC', [activeClassId, unitId]);
        const groups = groupsRes.rows;

        for (let idx = 0; idx < names.length; idx++) {
            const name = names[idx].trim();
            if (!name) continue;

            let assignedGroupId = null;
            if (assignMode === 'distribute' && groups.length > 0) {
                assignedGroupId = groups[idx % groups.length].id;
            }

            const studentId = 'std_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
            const studentPasscode = String(Math.floor(10 + Math.random() * 90));
            await pool.query(`
                INSERT INTO students (id, unit_id, class_id, group_id, name, avatar, passcode) VALUES ($1, $7, $2, $3, $4, $5, $6)
            `, [studentId, activeClassId, assignedGroupId, name, '👨‍🎓', studentPasscode, unitId]);
        }

        res.json({ success: true, count: names.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/students/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM students WHERE id = $1', [req.params.id]);
        await pool.query('DELETE FROM history_logs WHERE target_id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Transfer student to another class
app.post('/api/students/:id/transfer', async (req, res) => {
    const { targetClassId, targetGroupId } = req.body || {};
    if (!targetClassId) {
        return res.status(400).json({ error: 'targetClassId is required' });
    }
    try {
        await pool.query(`
            INSERT INTO classes (id, name) VALUES ($1, 'حلقة جديدة')
            ON CONFLICT (id) DO NOTHING
        `, [targetClassId]);
        await pool.query('UPDATE students SET class_id = $1, group_id = $2 WHERE id = $3', [targetClassId, targetGroupId || null, req.params.id]);
        await pool.query('UPDATE history_logs SET class_id = $1 WHERE target_id = $2', [targetClassId, req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/students/delete-bulk', async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'No IDs provided' });
    }
    try {
        await pool.query('DELETE FROM students WHERE id = ANY($1::text[])', [ids]);
        await pool.query('DELETE FROM history_logs WHERE target_id = ANY($1::text[])', [ids]);
        res.json({ success: true, count: ids.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/students/class/:classId', async (req, res) => {
    const { classId } = req.params;
    try {
        const studentIdsRes = await pool.query('SELECT id FROM students WHERE class_id = $1', [classId]);
        const ids = studentIdsRes.rows.map(r => r.id);
        if (ids.length > 0) {
            await pool.query('DELETE FROM history_logs WHERE target_id = ANY($1::text[])', [ids]);
        }
        await pool.query('DELETE FROM students WHERE class_id = $1', [classId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Group Endpoints
app.post('/api/groups', async (req, res) => {
    const { id, classId, name, color, icon } = req.body;
    try {
        const unit = await resolveUnit(req);
        const unitId = unit.id;
        const groupId = id || ('grp_' + Date.now());
        const existing = await pool.query('SELECT id FROM groups WHERE id = $1', [groupId]);

        if (existing.rows.length > 0) {
            await pool.query(`
                UPDATE groups SET name = $1, color = $2, icon = $3, class_id = COALESCE($4, class_id) WHERE id = $5
            `, [name, color, icon, classId || null, groupId]);
        } else {
            await pool.query(`
                INSERT INTO groups (id, unit_id, class_id, name, color, icon) VALUES ($1, $2, $3, $4, $5, $6)
            `, [groupId, unitId, classId, name, color || '#6366f1', icon || '🛡️']);
        }
        res.json({ success: true, id: groupId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/groups/:id', async (req, res) => {
    try {
        await pool.query('UPDATE students SET group_id = NULL WHERE group_id = $1', [req.params.id]);
        await pool.query('DELETE FROM groups WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/groups/class/:classId', async (req, res) => {
    const { classId } = req.params;
    try {
        await pool.query('UPDATE students SET group_id = NULL WHERE class_id = $1', [classId]);
        await pool.query('DELETE FROM groups WHERE class_id = $1', [classId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Criteria Endpoints
app.post('/api/criteria', async (req, res) => {
    const { id, name, type, points, icon } = req.body;
    try {
        const unit = await resolveUnit(req);
        const unitId = unit.id;
        const critId = id || ('crit_' + Date.now());
        const existing = await pool.query('SELECT id FROM criteria WHERE id = $1', [critId]);

        if (existing.rows.length > 0) {
            await pool.query(`
                UPDATE criteria SET name = $1, type = $2, points = $3, icon = $4 WHERE id = $5
            `, [name, type, parseInt(points, 10), icon, critId]);
        } else {
            await pool.query(`
                INSERT INTO criteria (id, unit_id, name, type, points, icon) VALUES ($1, $2, $3, $4, $5, $6)
            `, [critId, unitId, name, type, parseInt(points, 10), icon]);
        }
        res.json({ success: true, id: critId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/criteria/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM criteria WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Classes Endpoints
app.post('/api/classes', async (req, res) => {
    const { id, name } = req.body;
    try {
        const unit = await resolveUnit(req);
        const unitId = unit.id;
        const cleanName = (name || '').trim();
        if (!cleanName) return res.status(400).json({ error: 'Name is required' });

        // Prevent duplicate circles with identical names within the same unit
        const existingByName = await pool.query('SELECT id, name FROM classes WHERE LOWER(TRIM(name)) = LOWER($1) AND unit_id = $2 LIMIT 1', [cleanName, unitId]);
        if (existingByName.rows.length > 0) {
            return res.json({ success: true, id: existingByName.rows[0].id });
        }

        const classId = id || ('class_' + Date.now());
        await pool.query(`
            INSERT INTO classes (id, unit_id, name) VALUES ($1, $2, $3)
            ON CONFLICT (id) DO UPDATE SET name = $3
        `, [classId, unitId, cleanName]);

        await pool.query(`
            INSERT INTO app_settings (id, unit_id, current_class_id) VALUES ($1, $2, $3)
            ON CONFLICT (id) DO UPDATE SET current_class_id = $3
        `, ['settings_' + unitId, unitId, classId]);

        res.json({ success: true, id: classId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/classes/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM history_logs WHERE class_id = $1', [id]);
        await pool.query('DELETE FROM students WHERE class_id = $1', [id]);
        // Note: Groups are global across the institution and are not wiped when deleting a single class
        await pool.query('DELETE FROM classes WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// History & Undo
app.delete('/api/history/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM history_logs WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/history', async (req, res) => {
    const { classId } = req.query;
    try {
        const unit = await resolveUnit(req);
        const unitId = unit.id;
        if (classId) {
            await pool.query('DELETE FROM history_logs WHERE class_id = $1 AND unit_id = $2', [classId, unitId]);
        } else {
            await pool.query('DELETE FROM history_logs WHERE unit_id = $1', [unitId]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Settings Endpoints
app.post('/api/settings', async (req, res) => {
    const { currentClassId, theme, sound, dailyActiveCriteriaId, quickPoints, allowLeaderPoints, allowStudentPortal, hideStudentRecords } = req.body;
    try {
        const unit = await resolveUnit(req);
        const unitId = unit.id;
        const qpJson = quickPoints !== undefined ? JSON.stringify(quickPoints) : null;
        await pool.query(`
            INSERT INTO app_settings (id, unit_id, current_class_id, theme, sound, daily_active_criteria_id, quick_points, allow_leader_points, allow_student_portal, hide_student_records, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
            ON CONFLICT (id) DO UPDATE SET
                current_class_id = COALESCE($3, app_settings.current_class_id),
                theme = COALESCE($4, app_settings.theme),
                sound = COALESCE($5, app_settings.sound),
                daily_active_criteria_id = COALESCE($6, app_settings.daily_active_criteria_id),
                quick_points = COALESCE($7, app_settings.quick_points),
                allow_leader_points = COALESCE($8, app_settings.allow_leader_points),
                allow_student_portal = COALESCE($9, app_settings.allow_student_portal),
                hide_student_records = COALESCE($10, app_settings.hide_student_records),
                updated_at = NOW()
        `, ['settings_' + unitId, unitId, currentClassId, theme, sound, dailyActiveCriteriaId, qpJson, allowLeaderPoints, allowStudentPortal, hideStudentRecords]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Iqra Platform Settings Toggles (التحكم بنقاط وسجل اقرأ من بوابة المدير)
app.post('/api/settings/iqra-toggle', async (req, res) => {
    const { iqraPointsEnabled, showStudentReadingRecords } = req.body || {};
    try {
        if (typeof iqraPointsEnabled === 'boolean') {
            await pool.query("UPDATE reading_link_settings SET iqra_points_enabled = $1 WHERE id = 'global'", [iqraPointsEnabled]);
        }
        if (typeof showStudentReadingRecords === 'boolean') {
            await pool.query("UPDATE reading_link_settings SET show_student_reading_records = $1 WHERE id = 'global'", [showStudentReadingRecords]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// قسم إبداع (IBDA HUB APIS)
// ==========================================

// 1. جلب درر القراءة
app.get('/api/ibda/gems', async (req, res) => {
    try {
        const { classId } = req.query;
        let q = 'SELECT * FROM ibda_gems ORDER BY created_at DESC LIMIT 60';
        let params = [];
        if (classId) {
            q = 'SELECT * FROM ibda_gems WHERE class_id = $1 ORDER BY created_at DESC LIMIT 60';
            params = [classId];
        }
        const r = await pool.query(q, params);
        res.json({ success: true, gems: r.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. إضافة درة جديدة
app.post('/api/ibda/gems', async (req, res) => {
    const { studentId, studentName, classId, bookTitle, gemText } = req.body || {};
    if (!gemText || !studentName) {
        return res.status(400).json({ error: 'الرجاء إدخال اسم الطالب ونص الدرة' });
    }
    try {
        const r = await pool.query(`
            INSERT INTO ibda_gems (student_id, student_name, class_id, book_title, gem_text)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [studentId || null, studentName, classId || null, bookTitle || 'ورد القراءة', gemText.trim()]);
        res.json({ success: true, gem: r.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. التفاعل مع درة (إعجاب أو درة أسبوعية)
app.post('/api/ibda/gems/:id/react', async (req, res) => {
    const gemId = parseInt(req.params.id, 10);
    const { type } = req.body || {};
    if (!gemId) return res.status(400).json({ error: 'Invalid gem id' });
    try {
        const col = type === 'like' ? 'likes_count' : 'gems_count';
        const r = await pool.query(`
            UPDATE ibda_gems
            SET ${col} = COALESCE(${col}, 0) + 1
            WHERE id = $1
            RETURNING id, likes_count, gems_count
        `, [gemId]);
        if (!r.rows[0]) return res.status(404).json({ error: 'Gem not found' });
        res.json({ success: true, gem: r.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. جلب الكبسولات الصوتية
app.get('/api/ibda/capsules', async (req, res) => {
    try {
        const { classId, studentId } = req.query;
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
        res.json({ success: true, capsules: r.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. حفظ كبسولة صوتية جديدة
app.post('/api/ibda/capsules', async (req, res) => {
    const { studentId, studentName, classId, bookTitle, audioData, durationSec, note } = req.body || {};
    if (!audioData || !studentName) {
        return res.status(400).json({ error: 'الرجاء إدخال اسم الطالب والملف الصوتي' });
    }
    try {
        const r = await pool.query(`
            INSERT INTO ibda_capsules (student_id, student_name, class_id, book_title, audio_data, duration_sec, note)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, student_id, student_name, class_id, book_title, duration_sec, note, created_at
        `, [studentId || null, studentName, classId || null, bookTitle || 'ورد القراءة', audioData, parseInt(durationSec, 10) || 0, note || '']);
        res.json({ success: true, capsule: r.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. بيانات سباق الحلقات التفاعلي للمسجد (Live Mosque TV Clash)
app.get('/api/ibda/race-data', async (req, res) => {
    try {
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

        res.json({ success: true, racers, maxScore, updatedAt: new Date().toISOString() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start local server if run directly
if (require.main === module || !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
        console.log(`Connected directly to Supabase PostgreSQL at pooler.supabase.com:6543`);
    });
}

module.exports = app;
