const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const morgan = require('morgan');
const db = require('./database');
const naqati = require('./naqati');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'ya2_reading_tracker_super_secret_key_12345';

// Middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// تسجيل رابط موقع اقرأ تلقائياً لتظهر أزرار الانتقال داخل نقاطي
app.use((req, res, next) => {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (host) naqati.registerIqraUrl(`${req.headers['x-forwarded-proto'] || 'https'}://${host}`);
  next();
});

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'الرجاء تسجيل الدخول أولاً' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'جلسة العمل منتهية أو غير صالحة' });
    }
    req.user = user;
    next();
  });
}

// Teacher Role Authorization Middleware
function requireTeacher(req, res, next) {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'غير مصرح بالدخول، هذه الصفحة مخصصة للمعلم فقط' });
  }
  next();
}

// Student Role Authorization Middleware
function requireStudent(req, res, next) {
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'غير مصرح بالدخول، هذه الصفحة مخصصة للطالب فقط' });
  }
  next();
}

// --- AUTHENTICATION APIS ---

// تسجيل الطلاب الذاتي متوقف: الطلاب يُدارون من منظومة نقاطي
app.post('/api/auth/register-student', (req, res) => {
  res.status(410).json({ error: 'التسجيل يتم من منظومة نقاطي. ادخل باسمك ورمز الدخول الظاهر عند القائد.' });
});

// قائمة الطلاب من نقاطي لشاشة دخول الطالب (بدون رموز الدخول)
app.get('/api/auth/naqati-students', async (req, res) => {
  try {
    const unit = req.query.u || req.query.unit || req.headers['x-unit-id'];
    const students = await naqati.listStudents(unit);
    res.json({ students: students.map(s => ({ id: s.id, name: s.name, className: s.className, classId: s.classId, avatar: s.avatar })) });
  } catch (error) {
    console.error('naqati-students error:', error.message);
    res.status(503).json({ error: 'تعذر الاتصال بمنظومة نقاطي حالياً' });
  }
});

// دخول الطالب بالاسم + رمز الدخول من نقاطي
app.post('/api/auth/student-login', async (req, res) => {
  const { studentId, passcode } = req.body || {};
  if (!studentId || !passcode) {
    return res.status(400).json({ error: 'اختر اسمك وأدخل رمز الدخول' });
  }
  try {
    const nq = await naqati.verifyStudent(studentId, passcode);
    if (!nq) return res.status(401).json({ error: 'رمز الدخول غير صحيح' });

    const user = await db.ensureNaqatiUser(nq);
    const token = jwt.sign(
      { id: user.id, username: user.username, role: 'student', fullName: user.fullName, naqatiId: nq.id },
      JWT_SECRET,
      { expiresIn: '365d' }
    );
    res.json({ message: 'تم تسجيل الدخول بنجاح', token, user });
  } catch (error) {
    console.error('student-login error:', error.message);
    res.status(503).json({ error: 'تعذر التحقق من الرمز حالياً، حاول مرة أخرى' });
  }
});

// روابط الموقعين (للأزرار المتبادلة) وإعدادات الكبسولة
app.get('/api/link-info', async (req, res) => {
  try {
    const s = await naqati.getSettings();
    res.json({
      naqatiUrl: s.naqatiUrl,
      iqraUrl: s.iqraUrl,
      voiceCapsuleRequired: !!s.voiceCapsuleRequired
    });
  } catch (e) {
    res.json({ naqatiUrl: '', iqraUrl: '', voiceCapsuleRequired: false });
  }
});

// إعداد كبسولة الفائدة الصوتية (إلزامية / اختيارية) للمعلم
app.get('/api/teacher/voice-capsule-setting', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const s = await naqati.getSettings();
    res.json({ success: true, voiceCapsuleRequired: !!s.voiceCapsuleRequired });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/teacher/voice-capsule-setting', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const { voiceCapsuleRequired } = req.body || {};
    const s = await naqati.saveSettings({ voiceCapsuleRequired: !!voiceCapsuleRequired });
    res.json({ success: true, voiceCapsuleRequired: !!s.voiceCapsuleRequired });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login (Teacher accounts — students log in via /api/auth/student-login)
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبة' });
  }

  try {
    const user = await db.authenticateUser(username, password);
    if (!user) {
      return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }

    // Create JWT Token (Valid for 1 year so teachers/students stay logged in)
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, fullName: user.fullName },
      JWT_SECRET,
      { expiresIn: '365d' }
    );

    res.json({
      message: 'تم تسجيل الدخول بنجاح',
      token,
      user
    });
  } catch (error) {
    // رسالة خاصة للطلاب غير المعتمدين
    res.status(403).json({ error: error.message });
  }
});

// Get Current User (Me)
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// --- TEACHER APIS ---

// إنشاء حساب معلم جديد بواسطة معلم حالي
app.post('/api/teacher/create-teacher', authenticateToken, requireTeacher, async (req, res) => {
  const { fullName, username, password } = req.body;

  if (!fullName || !username || !password) {
    return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
  }

  try {
    const teacher = await db.createTeacher(fullName, username, password);
    res.status(201).json({ message: 'تم إنشاء حساب المعلم بنجاح', teacher });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// جلب الطلاب المعلقين بانتظار الموافقة
app.get('/api/teacher/pending-students', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const students = await db.getPendingStudents();
    res.json({ students });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في جلب بيانات الطلاب المعلقين' });
  }
});

// الموافقة على طالب
app.post('/api/teacher/approve-student', authenticateToken, requireTeacher, async (req, res) => {
  const { studentId } = req.body;

  if (!studentId) {
    return res.status(400).json({ error: 'معرف الطالب مطلوب' });
  }

  try {
    const student = await db.approveStudent(studentId, req.user.id);
    res.json({ message: `تمت الموافقة على الطالب "${student.fullName}" بنجاح!`, student });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// رفض طالب
app.post('/api/teacher/reject-student', authenticateToken, requireTeacher, async (req, res) => {
  const { studentId } = req.body;

  if (!studentId) {
    return res.status(400).json({ error: 'معرف الطالب مطلوب' });
  }

  try {
    await db.rejectStudent(studentId);
    res.json({ message: 'تم رفض الطالب وحذف حسابه.' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get Students of Teacher (synced from Naqati)
app.get('/api/teacher/students', authenticateToken, requireTeacher, async (req, res) => {
  try {
    try { await db.syncStudentsFromNaqati(); } catch (e) { console.warn('Naqati sync skipped:', e.message); }
    const students = await db.getStudentsForTeacher(req.user.id);
    res.json({ students });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في جلب بيانات الطلاب' });
  }
});

// إنشاء الطلاب يتم من نقاطي
app.post('/api/teacher/students', authenticateToken, requireTeacher, (req, res) => {
  res.status(410).json({ error: 'إضافة الطلاب تتم من منظومة نقاطي، وتظهر هنا تلقائياً.' });
});

// --- إعدادات الربط مع نقاطي ---
app.get('/api/teacher/integration', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const settings = await naqati.getSettings(true);
    let studentsCount = null, connected = true;
    try { studentsCount = await naqati.ping(); } catch (e) { connected = false; }
    res.json({ settings, connected, studentsCount });
  } catch (error) {
    res.status(503).json({ error: 'تعذر الاتصال بمنظومة نقاطي: ' + error.message });
  }
});

app.put('/api/teacher/integration', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const settings = await naqati.saveSettings(req.body || {});
    res.json({ message: 'تم حفظ إعدادات الربط بنجاح ✅', settings });
  } catch (error) {
    res.status(400).json({ error: 'تعذر حفظ الإعدادات: ' + error.message });
  }
});

app.post('/api/teacher/integration/sync', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const r = await db.syncStudentsFromNaqati({ force: true });
    res.json({ message: `تمت المزامنة: ${r.total} طالب في نقاطي (جديد ${r.added}، محدّث ${r.updated}، محذوف ${r.removed})`, result: r });
  } catch (error) {
    res.status(503).json({ error: 'فشلت المزامنة: ' + error.message });
  }
});

// قائمة الطلاب مع رموز الدخول (للمعلم فقط)
app.get('/api/teacher/naqati-codes', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const unit = req.query.u || req.query.unit || req.headers['x-unit-id'];
    res.json({ students: await naqati.listStudents(unit) });
  } catch (error) {
    res.status(503).json({ error: 'تعذر الاتصال بمنظومة نقاطي' });
  }
});

// Create Daily Reading Assignment
app.post('/api/teacher/assignments', authenticateToken, requireTeacher, async (req, res) => {
  const { bookName, startPage, endPage, targetDate } = req.body;

  if (!bookName || !startPage || !endPage || !targetDate) {
    return res.status(400).json({ error: 'جميع حقول التكليف مطلوبة' });
  }

  try {
    const assignment = await db.createAssignment(req.user.id, bookName, startPage, endPage, targetDate);
    res.status(201).json({ message: 'تمت إضافة الورد اليومي بنجاح', assignment });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get Assignments Created by Teacher (now shows ALL assignments)
app.get('/api/teacher/assignments', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const assignments = await db.getAssignmentsForTeacher(req.user.id);
    res.json({ assignments });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في جلب بيانات الأوراد' });
  }
});

// Get Student Submissions (dashboard data - now shows ALL submissions)
app.get('/api/teacher/submissions', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const submissions = await db.getSubmissionsForTeacherDashboard(req.user.id);
    res.json({ submissions });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في جلب بيانات الإنجازات' });
  }
});

// إضافة نقاط يدوياً للطالب
app.post('/api/teacher/add-points', authenticateToken, requireTeacher, async (req, res) => {
  const { studentId, points, reason } = req.body;

  if (!studentId || points === undefined || points === null) {
    return res.status(400).json({ error: 'معرف الطالب وعدد النقاط مطلوبة' });
  }

  const pointsNum = parseInt(points);
  if (isNaN(pointsNum) || pointsNum === 0) {
    return res.status(400).json({ error: 'يرجى إدخال عدد نقاط صحيح (غير صفري)' });
  }

  try {
    const result = await db.addBonusPoints(studentId, pointsNum, (reason || '').trim());
    const action = pointsNum > 0 ? 'إضافة' : 'خصم';
    res.json({
      message: `تم ${action} ${Math.abs(pointsNum)} نقطة ${pointsNum > 0 ? 'إلى' : 'من'} "${result.fullName}". الرصيد الجديد: ${result.newPoints} نقطة${result.syncedToNaqati ? ' — وتم تسجيلها في نقاطي ✅' : ''}`,
      result
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// جلب الإحصائيات
app.get('/api/teacher/statistics', authenticateToken, requireTeacher, async (req, res) => {
  const filter = req.query.filter || 'all';
  try {
    const statistics = await db.getStatistics(filter);
    res.json({ statistics });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في جلب الإحصائيات' });
  }
});

// حذف مستخدم (طالب أو معلم)
app.delete('/api/teacher/delete-user/:userId', authenticateToken, requireTeacher, async (req, res) => {
  try {
    // منع المعلم من حذف نفسه
    if (req.params.userId === req.user.id) {
      return res.status(400).json({ error: 'لا يمكنك حذف حسابك الخاص!' });
    }
    await db.deleteUser(req.params.userId);
    res.json({ message: 'تم حذف المستخدم وجميع بياناته بنجاح.' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// حذف ورد
app.delete('/api/teacher/delete-assignment/:assignmentId', authenticateToken, requireTeacher, async (req, res) => {
  try {
    await db.deleteAssignment(req.params.assignmentId);
    res.json({ message: 'تم حذف الورد بنجاح.' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// جلب جميع المعلمين
app.get('/api/teacher/all-teachers', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const teachers = await db.getAllTeachers();
    res.json({ teachers });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في جلب بيانات المعلمين' });
  }
});

// جلب أسماء الكتب الفريدة
app.get('/api/teacher/book-names', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const bookNames = await db.getUniqueBookNames();
    res.json({ bookNames });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في جلب أسماء الكتب' });
  }
});

// تعديل اسم كتاب
app.put('/api/teacher/rename-book', authenticateToken, requireTeacher, async (req, res) => {
  const { oldName, newName } = req.body;

  if (!oldName || !newName) {
    return res.status(400).json({ error: 'اسم الكتاب القديم والجديد مطلوبان' });
  }

  try {
    const result = await db.renameBook(oldName, newName);
    res.json({
      message: `تم تغيير اسم الكتاب من "${result.oldName}" إلى "${result.newName}" بنجاح (${result.updatedCount} ورد تم تحديثه)`,
      result
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// تعيين صورة لكتاب
app.put('/api/teacher/set-book-image', authenticateToken, requireTeacher, async (req, res) => {
  const { bookName, imageUrl } = req.body;

  if (!bookName || !imageUrl) {
    return res.status(400).json({ error: 'اسم الكتاب ورابط الصورة مطلوبان' });
  }

  try {
    const result = await db.setBookImage(bookName, imageUrl);
    res.json({
      message: `تم تعيين صورة للكتاب "${bookName}" بنجاح`,
      result
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// --- STUDENT APIS ---

// Get Today's Assignments for Student (supports multiple + 2-day deadline)
app.get('/api/student/assignments/today', authenticateToken, requireStudent, async (req, res) => {
  try {
    const assignments = await db.getAssignmentsForStudentToday(req.user.id);

    if (!assignments || assignments.length === 0) {
      return res.json({ assignments: [] });
    }

    const submissions = await db.getSubmissionsForStudent(req.user.id);

    // Map each assignment with its submission
    const result = assignments.map(a => {
      const sub = submissions.find(s => s.assignmentId === a.id) || null;
      return { assignment: a, submission: sub };
    });

    res.json({ assignments: result });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في جلب أوراد اليوم' });
  }
});

// Get Student Assignments History
app.get('/api/student/assignments/history', authenticateToken, requireStudent, async (req, res) => {
  try {
    const assignments = await db.getAssignmentsHistoryForStudent(req.user.id);
    const submissions = await db.getSubmissionsForStudent(req.user.id);

    const history = assignments.map(a => {
      const sub = submissions.find(s => s.assignmentId === a.id);
      return {
        id: a.id,
        bookName: a.bookName,
        bookImage: a.bookImage || null,
        startPage: a.startPage,
        endPage: a.endPage,
        targetDate: a.targetDate,
        isCompleted: sub ? sub.isCompleted : false,
        questions: sub ? sub.questions : '',
        freeSpace: sub ? sub.freeSpace : '',
        pointsAwarded: sub ? sub.pointsAwarded : 0,
        isLate: sub ? sub.isLate : false,
        submittedAt: sub ? sub.submittedAt : null
      };
    });

    res.json({ history });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في جلب السجل' });
  }
});

// Submit Reading Progress
app.post('/api/student/submit', authenticateToken, requireStudent, async (req, res) => {
  const { assignmentId, isCompleted, questions, freeSpace, audioData, durationSec } = req.body;

  if (!assignmentId) {
    return res.status(400).json({ error: 'معرف الورد اليومي مطلوب' });
  }

  try {
    const submission = await db.submitProgress(req.user.id, assignmentId, isCompleted, questions, freeSpace, audioData, durationSec);
    let message = 'تم إرسال إنجازك بنجاح.';
    if (submission.pointsAwarded > 0) {
      message += ` حصلت على ${submission.pointsAwarded} نقطة!`;
      if (submission.isLate) {
        message += ' (تسليم متأخر)';
      }
    }
    if (audioData) {
      message += ' وتم حفظ كبسولتك الصوتية بنجاح 🎙️';
    }
    message += ' بارك الله في همتك!';
    res.json({ message, submission });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// جلب نقاط الطالب
app.get('/api/student/points', authenticateToken, requireStudent, async (req, res) => {
  try {
    const pointsData = await db.getStudentPoints(req.user.id);
    // جلب ترتيب الطالب
    const allStudents = await db.getAllStudentsWithPoints();
    const rank = allStudents.findIndex(s => s.id === req.user.id) + 1;
    const totalStudents = allStudents.length;

    res.json({
      points: pointsData.points,
      fullName: pointsData.fullName,
      rank,
      totalStudents
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في جلب النقاط' });
  }
});

// Feedback & Developer Suggestions API
app.post('/api/feedback', async (req, res) => {
  const { senderName, senderRole, type, subject, message } = req.body;

  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'نص الرسالة أو الاقتراح مطلوب' });
  }

  try {
    const saved = await db.saveFeedback({
      senderName,
      senderRole,
      type,
      subject,
      message
    });
    res.json({ success: true, message: 'تم استلام الاقتراح والملاحظة بنجاح، شكراً لمساهمتك!', data: saved });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ أثناء حفظ الملاحظة' });
  }
});

// جلب قائمة الملاحظات للمطور/المعلم
app.get('/api/feedback', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const list = await db.getFeedbacks();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ في جلب الملاحظات' });
  }
});

// حذف ملاحظة
app.delete('/api/feedback/:id', authenticateToken, requireTeacher, async (req, res) => {
  try {
    await db.deleteFeedback(req.params.id);
    res.json({ success: true, message: 'تم حذف الملاحظة بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ في حذف الملاحظة' });
  }
});

// ==========================================
// --- مسارات المراسلة والمحادثات المباشرة ---
// ==========================================

// إرسال رسالة جديدة
app.post('/api/messages/send', authenticateToken, async (req, res) => {
  const { receiverId, content } = req.body;
  if (!receiverId || !content || !content.trim()) {
    return res.status(400).json({ error: 'المستلم ونص الرسالة مطلوبان' });
  }

  try {
    const msg = await db.sendMessage(req.user.id, receiverId, content);
    res.json({ success: true, message: 'تم إرسال الرسالة بنجاح', data: msg });
  } catch (err) {
    res.status(400).json({ error: err.message || 'فشل إرسال الرسالة' });
  }
});

// جلب قائمة المحادثات
app.get('/api/messages/conversations', authenticateToken, async (req, res) => {
  try {
    const convos = await db.getConversationsList(req.user.id, req.user.role);
    res.json({ conversations: convos });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ في جلب المحادثات' });
  }
});

// جلب سجل المحادثة مع مستخدم معين
app.get('/api/messages/chat/:userId', authenticateToken, async (req, res) => {
  try {
    const messages = await db.getChatMessages(req.user.id, req.params.userId);
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ في جلب سجل المحادثة' });
  }
});

// تحديد محادثة كمقروءة
app.put('/api/messages/mark-read/:userId', authenticateToken, async (req, res) => {
  try {
    await db.markChatAsRead(req.user.id, req.params.userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ في تحديث حالة القراءة' });
  }
});

// جلب إجمالي عدد الرسائل غير المقروءة
app.get('/api/messages/unread-count', authenticateToken, async (req, res) => {
  try {
    const count = await db.getUnreadMessagesCount(req.user.id);
    res.json({ unreadCount: count });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ في جلب عدد الرسائل' });
  }
});

// حذف رسالة فردية
app.delete('/api/messages/:id', authenticateToken, async (req, res) => {
  try {
    await db.deleteMessage(req.params.id, req.user.id, req.user.role);
    res.json({ success: true, message: 'تم حذف الرسالة بنجاح' });
  } catch (err) {
    res.status(400).json({ error: err.message || 'حدث خطأ في حذف الرسالة' });
  }
});

// مسح كامل سجل المحادثة مع مستخدم
app.delete('/api/messages/clear/:otherUserId', authenticateToken, async (req, res) => {
  try {
    await db.clearChatHistory(req.user.id, req.params.otherUserId);
    res.json({ success: true, message: 'تم مسح المحادثة بنجاح' });
  } catch (err) {
    res.status(400).json({ error: err.message || 'حدث خطأ في مسح المحادثة' });
  }
});

// ==========================================
// قسم إبداع (IBDA HUB APIS FOR YA2)
// ==========================================

// 1. جلب درر القراءة
app.get('/api/ibda/gems', async (req, res) => {
  try {
    const gems = await naqati.getIbdaGems(req.query.classId);
    res.json({ success: true, gems });
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
    const gem = await naqati.addIbdaGem({ studentId, studentName, classId, bookTitle, gemText });
    res.json({ success: true, gem });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. التفاعل مع درة
app.post('/api/ibda/gems/:id/react', async (req, res) => {
  const { type } = req.body || {};
  try {
    const gem = await naqati.reactIbdaGem(req.params.id, type);
    res.json({ success: true, gem });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. جلب الكبسولات الصوتية
app.get('/api/ibda/capsules', async (req, res) => {
  try {
    const capsules = await naqati.getIbdaCapsules({
      classId: req.query.classId,
      studentId: req.query.studentId
    });
    res.json({ success: true, capsules });
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
    const capsule = await naqati.addIbdaCapsule({
      studentId, studentName, classId, bookTitle, audioData, durationSec, note
    });
    res.json({ success: true, capsule });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. بيانات سباق الحلقات التفاعلي للمسجد (Live Mosque TV Clash)
app.get('/api/ibda/race-data', async (req, res) => {
  try {
    const data = await naqati.getRaceData();
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. رسائل وإشعارات الطلاب الموجهة للمدير أو المعلم
app.get('/api/student-messages', async (req, res) => {
  try {
    const rows = await naqati.getStudentMessages({
      studentId: req.query.studentId,
      recipient: req.query.recipient
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/student-messages', async (req, res) => {
  const { studentId, studentName, classId, message, category, surahName, pagesCount, recipient } = req.body || {};
  if (!studentId || !message) {
    return res.status(400).json({ error: 'studentId and message are required' });
  }
  try {
    const r = await naqati.sendStudentMessage({
      studentId, studentName, classId, message, category, surahName, pagesCount, recipient
    });
    res.json({ success: true, ...r });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback to serving main html for client routing
app.get('*', (req, res) => {



  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});

module.exports = app;
