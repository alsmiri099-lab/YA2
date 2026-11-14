// تصفير بيانات منصة اقرأ وربطها بطلاب نقاطي
// 1) نسخة احتياطية كاملة في مجلد backups/
// 2) حذف الطلاب والأوراد والتسليمات والرسائل والاقتراحات (حسابات المعلمين تبقى)
// 3) استيراد طلاب نقاطي
// الاستخدام: node reset-link-naqati.js --yes
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./database');
const sb = db.supabase;

async function fetchAll(table) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select('*').range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

(async () => {
  if (!process.argv.includes('--yes')) {
    console.log('أضف --yes للتأكيد. هذا السكربت يحذف بيانات منصة اقرأ بعد أخذ نسخة احتياطية.');
    process.exit(1);
  }

  // 1) Backup
  const backup = {};
  for (const t of ['users', 'assignments', 'submissions', 'messages', 'feedbacks']) {
    backup[t] = await fetchAll(t);
    console.log(`📦 ${t}: ${backup[t].length}`);
  }
  const dir = path.join(__dirname, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `ya2-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify(backup, null, 2), 'utf8');
  console.log('✅ النسخة الاحتياطية:', file);

  // 2) Wipe (keep teacher accounts)
  const del = async (table, q) => {
    const { error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    console.log(`🗑️  ${table} حُذف`);
  };
  await del('submissions', sb.from('submissions').delete().not('id', 'is', null));
  await del('messages', sb.from('messages').delete().not('id', 'is', null));
  await del('feedbacks', sb.from('feedbacks').delete().not('id', 'is', null));
  await del('assignments', sb.from('assignments').delete().not('id', 'is', null));
  await del('users (students)', sb.from('users').delete().eq('role', 'student'));
  await sb.from('users').update({ points: 0 }).eq('role', 'teacher');
  try { fs.writeFileSync(path.join(__dirname, 'feedbacks.json'), '[]', 'utf8'); } catch (e) {}

  // 3) Import from Naqati
  const r = await db.syncStudentsFromNaqati({ force: true });
  console.log(`🔗 تم استيراد ${r.added} طالب من نقاطي (الإجمالي ${r.total})`);
  process.exit(0);
})().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
