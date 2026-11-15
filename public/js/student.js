// Student Dashboard Logic — Per-Book Pages

// بيانات مخزنة مؤقتاً
let allAssignmentsData = [];
let allHistoryData = [];
let currentBookName = null;

// Protect Route
window.addEventListener('DOMContentLoaded', () => {
  const user = getUser();
  if (!isLoggedIn() || !user || user.role !== 'student') {
    logout();
    return;
  }

  // Set name
  document.getElementById('studentName').textContent = `الطالب: ${user.fullName}`;

  // Set dynamic greeting
  setGreeting(user.fullName);

  // Load dashboard
  loadStudentDashboard();
});

// --- التحية الديناميكية ---
function setGreeting(name) {
  const hour = new Date().getHours();
  const emojiEl = document.getElementById('greetingEmoji');
  const mainEl = document.getElementById('greetingMain');
  const subEl = document.getElementById('greetingSub');

  let emoji, greeting, sub;
  if (hour >= 5 && hour < 12) {
    emoji = '🌅';
    greeting = `صباح الخير يا ${name}!`;
    sub = 'هيا نبدأ يومنا بالقراءة والعلم';
  } else if (hour >= 12 && hour < 17) {
    emoji = '☀️';
    greeting = `مساء النور يا ${name}!`;
    sub = 'وقت مثالي لإكمال أوراد القراءة';
  } else if (hour >= 17 && hour < 21) {
    emoji = '🌆';
    greeting = `مساء الخير يا ${name}!`;
    sub = 'اختم يومك بقراءة ممتعة ومفيدة';
  } else {
    emoji = '🌙';
    greeting = `أهلاً يا ${name}!`;
    sub = 'القراءة قبل النوم تثبت المعلومات';
  }

  if (emojiEl) emojiEl.textContent = emoji;
  if (mainEl) mainEl.textContent = greeting;
  if (subEl) subEl.textContent = sub;
}

// --- الرسائل التشجيعية اليومية ---
const dailyQuotes = [
  // --- المجموعة الأولى (آيات وأحاديث وأقوال أساسية) ---
  '﴿اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ﴾ أول أمر نزل من السماء: اقرأ! فاجعل القراءة بداية كل يوم.',
  'قال ﷺ: «من سلك طريقًا يلتمس فيه علمًا سهّل الله له به طريقًا إلى الجنة» — فكل صفحة تقرؤها خطوة نحو الجنة!',
  '﴿هَلْ يَسْتَوِي الَّذِينَ يَعْلَمُونَ وَالَّذِينَ لَا يَعْلَمُونَ﴾ — لا يستوي العالم والجاهل عند الله، فاجتهد في القراءة لترتقي!',
  '﴿وَقُل رَّبِّ زِدْنِي عِلْمًا﴾ الله أمر نبيه أن يطلب الزيادة من العلم، فلا تتوقف عن القراءة أبدًا!',
  'قال ﷺ: «خيركم من تعلّم القرآن وعلّمه» — اجعل همتك عالية وكن من خير الناس بالعلم والقراءة.',
  'قال الشافعي: «من لم يذق ذلّ التعلّم ساعة، بقي في ذلّ الجهل أبدًا» — اصبر على القراءة فثمارها عظيمة.',
  'قال ﷺ: «إن الملائكة لتضع أجنحتها لطالب العلم رضًا بما يصنع» — حتى الملائكة تفرح بقراءتك وطلبك للعلم!',

  // --- المجموعة الثانية (آيات وأحاديث إضافية) ---
  '﴿يَرْفَعِ اللَّهُ الَّذِينَ آمَنُوا مِنكُمْ وَالَّذِينَ أُوتُوا الْعِلْمَ دَرَجَاتٍ﴾ — العلم رفعة في الدنيا والآخرة، فاقرأ وارتقِ!',
  'قال ﷺ: «إذا مات ابن آدم انقطع عمله إلا من ثلاث: علم يُنتفع به» — اجعل قراءتك علمًا ينفعك وينفع غيرك.',
  '﴿وَتِلْكَ الْأَمْثَالُ نَضْرِبُهَا لِلنَّاسِ وَمَا يَعْقِلُهَا إِلَّا الْعَالِمُونَ﴾ — القراءة تفتح لك أبواب الفهم والتدبر، فلا تحرم نفسك منها!',
  '﴿إِنَّمَا يَخْشَى اللَّهَ مِنْ عِبَادِهِ الْعُلَمَاءُ﴾ — كلما ازددت علمًا ازددت خشية لله، فلا تبخل على نفسك بالقراءة.',
  'قال ﷺ: «من يرد الله به خيرًا يفقّهه في الدين» — فطلبك للعلم دليل على أن الله يريد بك خيرًا!',
  'قال عمر بن عبد العزيز: «من عمل بغير علم كان ما يُفسد أكثر مما يُصلح» — فالعلم نور يهدي صاحبه.',
  'قال الإمام أحمد: «الناس إلى العلم أحوج منهم إلى الطعام والشراب، لأن الطعام يحتاج إليه في اليوم مرتين، والعلم يحتاج إليه بعدد الأنفاس» — فلا تتوقف عن القراءة!',

  // --- المجموعة الثالثة (أقوال ملهمة وحكم) ---
  '﴿فَاسْأَلُوا أَهْلَ الذِّكْرِ إِن كُنتُمْ لَا تَعْلَمُونَ﴾ — القراءة باب السؤال والمعرفة، فافتح هذا الباب كل يوم!',
  'قال ﷺ: «لا حسد إلا في اثنتين: رجل آتاه الله مالًا فسلطه على هلكته في الحق، ورجل آتاه الله الحكمة فهو يقضي بها ويعلمها» — فاسعَ للحكمة بالقراءة.',
  'قال الزهري: «ما عُبد الله بشيء أفضل من العلم» — فقراءتك عبادة عظيمة عند الله.',
  'قال ابن حزم: «لو لم يكن من فائدة العلم إلا أنه يُقرّبك من رب العالمين لكفى» — فاقرأ تقترب من الله.',
  'قال ﷺ: «من خرج في طلب العلم فهو في سبيل الله حتى يرجع» — فطلبك للعلم والقراءة جهاد في سبيل الله!',
  'قال علي بن أبي طالب رضي الله عنه: «العلم خير من المال، العلم يحرسك وأنت تحرس المال» — فاستثمر في نفسك بالقراءة والتعلم.',
  '﴿وَمَا أُوتِيتُم مِّنَ الْعِلْمِ إِلَّا قَلِيلًا﴾ — مهما قرأت فالعلم بحر لا ينضب، فلا تتوقف عن الاستزادة!'
];

function setDailyQuote() {
  // حساب رقم اليوم في السنة للتنويع بين الـ 21 عبارة
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now - startOfYear) / (1000 * 60 * 60 * 24));
  const quoteIndex = dayOfYear % dailyQuotes.length;
  const quoteEl = document.getElementById('dailyQuoteText');
  if (quoteEl) {
    quoteEl.textContent = dailyQuotes[quoteIndex];
  }
}

// --- نظام الإنجازات ---
const ACHIEVEMENTS = [
  { id: 'first_ord', emoji: '🌱', name: 'بداية الرحلة', desc: 'أكمل أول ورد', check: (h) => h.filter(x => x.isCompleted).length >= 1 },
  { id: 'reader_10', emoji: '📖', name: 'قارئ نشط', desc: 'أكمل 10 أوراد', check: (h) => h.filter(x => x.isCompleted).length >= 10 },
  { id: 'streak_7', emoji: '⭐', name: 'نجم الأسبوع', desc: '7 أيام متواصلة', check: (h, s) => s >= 7 },
  { id: 'streak_14', emoji: '🔥', name: 'لا يُوقف', desc: '14 يوم متواصل', check: (h, s) => s >= 14 },
  { id: 'no_late_10', emoji: '💯', name: 'بلا تأخير', desc: '10 أوراد في وقتها', check: (h) => h.filter(x => x.isCompleted && !x.isLate).length >= 10 },
  { id: 'multi_books', emoji: '📚', name: 'محب الكتب', desc: 'قرأ في 3 كتب', check: (h) => new Set(h.filter(x => x.isCompleted).map(x => x.bookName)).size >= 3 },
  { id: 'points_100', emoji: '👑', name: '100 نقطة', desc: 'وصل 100 نقطة', check: (h) => h.reduce((s, x) => s + (x.pointsAwarded || 0), 0) >= 100 },
];

function updateAchievements(history, streak) {
  const grid = document.getElementById('achievementsGrid');
  if (!grid) return;

  grid.innerHTML = ACHIEVEMENTS.map(ach => {
    const unlocked = ach.check(history, streak);
    return `
      <div class="achievement-card ${unlocked ? 'unlocked' : 'locked'}">
        <div class="achievement-emoji">${ach.emoji}</div>
        <div class="achievement-name">${ach.name}</div>
        <div class="achievement-desc">${ach.desc}</div>
      </div>`;
  }).join('');
}

// --- حساب سلسلة القراءة المتواصلة ---
function calculateStreak(history) {
  const completedDates = new Set();
  history.forEach(h => {
    if (h.isCompleted && h.submittedAt) {
      const d = new Date(h.submittedAt).toLocaleDateString('sv');
      completedDates.add(d);
    }
  });

  if (completedDates.size === 0) return 0;

  let streak = 0;
  const today = new Date();

  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString('sv');
    if (completedDates.has(dateStr)) {
      streak++;
    } else {
      // إذا كان اليوم الحالي ولم ينجز بعد، نتخطاه
      if (i === 0) continue;
      break;
    }
  }

  return streak;
}

function updateStreakDisplay(streak) {
  const countEl = document.getElementById('streakCount');
  const streakEl = document.getElementById('greetingStreak');
  if (countEl) countEl.textContent = streak;
  if (streakEl) {
    if (streak === 0) {
      streakEl.querySelector('.streak-fire').textContent = '❄️';
    }
  }
}

// --- تأثير الكونفيتي ---
function launchConfetti() {
  const container = document.getElementById('confettiContainer');
  if (!container) return;

  const colors = ['#FBBF24', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6', '#F59E0B', '#EC4899'];

  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + '%';
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.width = (Math.random() * 8 + 5) + 'px';
    piece.style.height = (Math.random() * 8 + 5) + 'px';
    piece.style.animationDuration = (Math.random() * 2 + 2) + 's';
    piece.style.animationDelay = (Math.random() * 0.5) + 's';
    container.appendChild(piece);
  }

  setTimeout(() => {
    container.innerHTML = '';
  }, 4000);
}

function loadStudentDashboard() {
  setDailyQuote();
  loadStudentPoints();
  loadBooksOverview();
  loadStudentUnreadCount();
  loadStudentGems();
  fetchLinkInfoSetting();

  // Polling unread messages count every 15s
  setInterval(() => {
    loadStudentUnreadCount();
    if (isStudentChatModalOpen) {
      const recSelect = document.getElementById('studentRecipientSelect');
      const isDirector = recSelect && recSelect.value === 'director';
      if (isDirector) {
        loadStudentDirectorMessages();
      } else if (studentActiveTeacherId) {
        loadStudentChatMessages(studentActiveTeacherId, true);
      }
    }
  }, 15000);
}

async function fetchLinkInfoSetting() {
  try {
    const res = await fetch(`${API_BASE}/link-info`);
    if (res.ok) {
      const data = await res.json();
      window.cachedVoiceCapsuleRequired = !!data.voiceCapsuleRequired;
    }
  } catch (e) {}
}

// --- تحميل نقاط الطالب الإجمالية ---
async function loadStudentPoints() {
  try {
    const response = await fetch(`${API_BASE}/student/points`, {
      headers: getAuthHeaders()
    });
    const data = await response.json();

    if (response.ok) {
      const rankBadgeEl = document.getElementById('studentRankBadge');
      const rankTextEl = document.getElementById('studentRankText');
      const motivationEl = document.getElementById('pointsMotivation');

      if (data.rank && data.totalStudents) {
        let rankEmoji = '';
        if (data.rank === 1) rankEmoji = '🥇';
        else if (data.rank === 2) rankEmoji = '🥈';
        else if (data.rank === 3) rankEmoji = '🥉';
        else rankEmoji = `#${data.rank}`;

        rankBadgeEl.textContent = rankEmoji;
        rankTextEl.textContent = `ترتيبك ${data.rank} من ${data.totalStudents} طالب`;
      }

      const points = data.points || 0;
      if (points === 0) {
        motivationEl.textContent = 'ابدأ رحلتك في القراءة واكسب أولى نقاطك! 🚀';
      } else if (points < 30) {
        motivationEl.textContent = 'بداية ممتازة! واصل القراءة واكسب المزيد! 💪';
      } else if (points < 70) {
        motivationEl.textContent = 'أحسنت! أنت في تقدم مستمر، واصل الهمة! 🌟';
      } else if (points < 150) {
        motivationEl.textContent = 'ما شاء الله! أنت من المتميزين في القراءة! 🏆';
      } else {
        motivationEl.textContent = 'بارك الله فيك! أنت قدوة في المثابرة والقراءة! 👑';
      }
    }
  } catch (error) {
    console.error('Error loading student points:', error);
  }
}

// --- أيقونات الكتب ---
function getBookIcon(index) {
  const icons = ['📗', '📘', '📕', '📙', '📓', '📔', '📒', '📚'];
  return icons[index % icons.length];
}

// --- جلب صورة الكتاب ---
function getBookImage(bookName) {
  // البحث عن صورة من الأوراد الحالية
  const assignWithImage = allAssignmentsData.find(a => a.assignment.bookName === bookName && a.assignment.bookImage);
  if (assignWithImage) return assignWithImage.assignment.bookImage;
  // البحث من السجل
  const histWithImage = allHistoryData.find(h => h.bookName === bookName && h.bookImage);
  if (histWithImage) return histWithImage.bookImage;
  return null;
}

// --- تحديث بطاقة آخر كتاب ---
function updateLastBookCard() {
  const labelEl = document.getElementById('lastBookLabel');
  const nameEl = document.getElementById('lastBookName');
  const pointsEl = document.getElementById('studentPointsValue');
  const iconEl = document.getElementById('lastBookIcon');
  const progressContainer = document.getElementById('bookProgressContainer');

  // إيجاد آخر كتاب (من السجل أو من الأوراد الحالية)
  let lastBookName = null;

  // أولاً من الأوراد الحالية (الأحدث)
  if (allAssignmentsData.length > 0) {
    lastBookName = allAssignmentsData[0].assignment.bookName;
  }
  // ثانياً من السجل
  if (!lastBookName && allHistoryData.length > 0) {
    lastBookName = allHistoryData[0].bookName;
  }

  if (!lastBookName) {
    nameEl.textContent = 'لا يوجد كتب بعد';
    pointsEl.textContent = '0';
    labelEl.textContent = 'ابدأ رحلتك';
    return;
  }

  // نقاط هذا الكتاب
  const bookHistory = allHistoryData.filter(h => h.bookName === lastBookName);
  const bookPoints = bookHistory.reduce((sum, h) => sum + (h.pointsAwarded || 0), 0);

  // تحديث العناصر
  labelEl.textContent = 'آخر كتاب تقرأه';
  nameEl.textContent = lastBookName;
  pointsEl.textContent = bookPoints;

  // أيقونة/صورة الكتاب
  const bookImage = getBookImage(lastBookName);
  const bookNames = [...new Set([
    ...allAssignmentsData.map(a => a.assignment.bookName),
    ...allHistoryData.map(h => h.bookName)
  ])];
  const bookIndex = bookNames.indexOf(lastBookName);
  if (bookImage) {
    iconEl.innerHTML = `<img src="${escapeHtml(bookImage)}" alt="${escapeHtml(lastBookName)}" style="width:55px;height:70px;object-fit:cover;border-radius:10px;box-shadow:0 4px 15px rgba(0,0,0,0.2);">`;
  } else {
    iconEl.textContent = getBookIcon(bookIndex >= 0 ? bookIndex : 0);
  }

  // شريط تقدم الكتاب
  const allBookAssignments = [...allAssignmentsData.filter(a => a.assignment.bookName === lastBookName).map(a => a.assignment), ...allHistoryData.filter(h => h.bookName === lastBookName)];

  if (allBookAssignments.length > 0) {
    const minPage = Math.min(...allBookAssignments.map(a => a.startPage));
    const maxPage = Math.max(...allBookAssignments.map(a => a.endPage));
    const totalPages = maxPage - minPage + 1;
    const completedPages = bookHistory.filter(h => h.isCompleted).reduce((sum, h) => sum + Math.max(0, (h.endPage || 0) - (h.startPage || 0) + 1), 0);
    const percent = totalPages > 0 ? Math.min(100, Math.round((completedPages / totalPages) * 100)) : 0;

    progressContainer.style.display = 'block';
    document.getElementById('bookProgressPercent').textContent = percent + '%';
    document.getElementById('bookProgressPages').textContent = `${completedPages} / ${totalPages} صفحة`;
    setTimeout(() => {
      document.getElementById('bookProgressFill').style.width = percent + '%';
    }, 300);
  }
}

// --- تحديث قسم ثماري (الآن يتضمن النقاط الإجمالية) ---
function updateThamari() {
  const history = allHistoryData;

  // الأوراد المنجزة (اللي فيها تسليم و isCompleted)
  const completedOrds = history.filter(h => h.isCompleted);

  // عدد الصفحات المقروءة (من الأوراد المنجزة فقط)
  const totalPages = completedOrds.reduce((sum, h) => {
    const pages = Math.max(0, (h.endPage || 0) - (h.startPage || 0) + 1);
    return sum + pages;
  }, 0);

  // مجموع النقاط الإجمالية
  const totalPoints = history.reduce((sum, h) => sum + (h.pointsAwarded || 0), 0);

  // عدد الكتب الفريدة
  const uniqueBooks = new Set(history.map(h => h.bookName));

  // نسبة الإنجاز
  const totalOrds = history.length;
  const completedCount = completedOrds.length;
  const rate = totalOrds > 0 ? Math.round((completedCount / totalOrds) * 100) : 0;

  // تحديث العناصر
  document.getElementById('thamariPoints').textContent = totalPoints;
  document.getElementById('thamariPages').textContent = totalPages;
  document.getElementById('thamariCompleted').textContent = completedCount;
  document.getElementById('thamariTotal').textContent = totalOrds;
  document.getElementById('thamariBooks').textContent = uniqueBooks.size;
  document.getElementById('thamariRate').textContent = rate + '%';

  // حساب السلسلة والإنجازات
  const streak = calculateStreak(history);
  updateStreakDisplay(streak);
  updateAchievements(history, streak);
}

// --- تحميل بطاقات الكتب (الشاشة الرئيسية) ---
async function loadBooksOverview() {
  const grid = document.getElementById('booksGrid');

  try {
    // جلب الأوراد الحالية
    const assignRes = await fetch(`${API_BASE}/student/assignments/today`, {
      headers: getAuthHeaders()
    });
    const assignData = await assignRes.json();

    // جلب السجل الكامل
    const histRes = await fetch(`${API_BASE}/student/assignments/history`, {
      headers: getAuthHeaders()
    });
    const histData = await histRes.json();

    if (!assignRes.ok || !histRes.ok) {
      grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div>حدث خطأ في تحميل البيانات.</div>`;
      return;
    }

    // حفظ البيانات
    allAssignmentsData = assignData.assignments || [];
    allHistoryData = histData.history || [];

    // تحديث ثماري (يتضمن الآن النقاط الإجمالية والسلسلة والإنجازات)
    updateThamari();

    // تحديث بطاقة آخر كتاب
    updateLastBookCard();

    // استخراج أسماء الكتب الفريدة من الأوراد والسجل
    const bookNamesSet = new Set();
    allAssignmentsData.forEach(item => bookNamesSet.add(item.assignment.bookName));
    allHistoryData.forEach(item => bookNamesSet.add(item.bookName));

    const bookNames = Array.from(bookNamesSet);

    if (bookNames.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🌸</div>
          <p style="font-weight: 700; font-size: 1.1rem; color: var(--primary);">لا توجد كتب منزلة لك حالياً.</p>
          <p style="color: var(--text-muted); font-size: 0.95rem; margin-top: 5px;">انتظر حتى يضيف المعلم أوراد القراءة.</p>
        </div>`;
      return;
    }

    // بناء بطاقات الكتب
    grid.innerHTML = bookNames.map((bookName, index) => {
      const icon = getBookIcon(index);

      // عدد الأوراد النشطة لهذا الكتاب
      const activeAssignments = allAssignmentsData.filter(a => a.assignment.bookName === bookName);
      const pendingCount = activeAssignments.filter(a => !a.submission).length;
      const completedCount = activeAssignments.filter(a => a.submission).length;

      // نقاط هذا الكتاب (من السجل)
      const bookHistory = allHistoryData.filter(h => h.bookName === bookName);
      const bookPoints = bookHistory.reduce((sum, h) => sum + (h.pointsAwarded || 0), 0);

      // إجمالي الأوراد
      const totalOrds = bookHistory.length;

      // آخر نشاط
      const lastActivity = bookHistory.find(h => h.submittedAt);
      let lastActivityText = 'لم يبدأ بعد';
      if (lastActivity && lastActivity.submittedAt) {
        const d = new Date(lastActivity.submittedAt);
        lastActivityText = d.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' });
      }

      // شارة التنبيه (أوراد متبقية)
      let urgencyBadge = '';
      if (pendingCount > 0) {
        urgencyBadge = `<div class="book-select-badge book-select-badge-pending">${pendingCount} ورد متبقي</div>`;
      } else if (activeAssignments.length > 0) {
        urgencyBadge = `<div class="book-select-badge book-select-badge-done">✓ مكتمل</div>`;
      }

      // صورة الكتاب
      const bookImage = getBookImage(bookName);
      const imageHtml = bookImage
        ? `<img src="${escapeHtml(bookImage)}" alt="${escapeHtml(bookName)}" class="book-select-cover">`
        : `<div class="book-select-icon">${icon}</div>`;

      return `
        <div class="book-select-card" onclick="openBook('${escapeHtml(bookName).replace(/'/g, "\\'")}')" >
          ${urgencyBadge}
          ${imageHtml}
          <h3 class="book-select-name">${escapeHtml(bookName)}</h3>
          <div class="book-select-stats">
            <div class="book-select-stat">
              <span class="book-select-stat-value">${bookPoints}</span>
              <span class="book-select-stat-label">⭐ نقطة</span>
            </div>
            <div class="book-select-stat">
              <span class="book-select-stat-value">${totalOrds}</span>
              <span class="book-select-stat-label">📖 ورد</span>
            </div>
          </div>
          <div class="book-select-footer">
            <span class="book-select-activity">آخر نشاط: ${lastActivityText}</span>
          </div>
          <div class="book-select-enter">الدخول للكتاب ←</div>
        </div>`;
    }).join('');

  } catch (error) {
    console.error('Error loading books overview:', error);
    grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div>حدث خطأ أثناء تحميل الكتب.</div>`;
  }
}

// --- فتح صفحة كتاب محدد ---
function openBook(bookName) {
  currentBookName = bookName;

  // إخفاء شاشة الكتب وإظهار شاشة التفاصيل
  document.getElementById('booksView').style.display = 'none';
  const detailView = document.getElementById('bookDetailView');
  detailView.style.display = 'block';

  // أنيميشن دخول
  detailView.classList.remove('view-enter');
  void detailView.offsetWidth; // force reflow
  detailView.classList.add('view-enter');

  // تحديد أيقونة/صورة الكتاب
  const bookNames = [...new Set([
    ...allAssignmentsData.map(a => a.assignment.bookName),
    ...allHistoryData.map(h => h.bookName)
  ])];
  const bookIndex = bookNames.indexOf(bookName);
  const icon = getBookIcon(bookIndex >= 0 ? bookIndex : 0);
  const bookImage = getBookImage(bookName);

  // تحديث هيدر الكتاب
  const iconEl = document.getElementById('bookDetailIcon');
  if (bookImage) {
    iconEl.innerHTML = `<img src="${escapeHtml(bookImage)}" alt="${escapeHtml(bookName)}" class="book-detail-cover">`;
  } else {
    iconEl.textContent = icon;
  }
  document.getElementById('bookDetailName').textContent = bookName;

  // تحميل بيانات الكتاب
  loadBookAssignments(bookName);
  loadBookHistory(bookName);
  updateBookStats(bookName);

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- الرجوع لشاشة الكتب ---
function goBackToBooks() {
  currentBookName = null;
  document.getElementById('bookDetailView').style.display = 'none';
  const booksView = document.getElementById('booksView');
  booksView.style.display = 'block';

  // تحديث البيانات
  loadBooksOverview();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- تحديث إحصائيات الكتاب ---
function updateBookStats(bookName) {
  // نقاط من السجل
  const bookHistory = allHistoryData.filter(h => h.bookName === bookName);
  const bookPoints = bookHistory.reduce((sum, h) => sum + (h.pointsAwarded || 0), 0);
  const totalOrds = bookHistory.length;

  document.getElementById('bookDetailPoints').textContent = bookPoints;
  document.getElementById('bookDetailOrdsCount').textContent = totalOrds;
}

// --- تحميل أوراد كتاب محدد ---
function loadBookAssignments(bookName) {
  const container = document.getElementById('bookAssignmentsContainer');

  // فلترة الأوراد لهذا الكتاب
  const bookAssignments = allAssignmentsData.filter(a => a.assignment.bookName === bookName);

  if (bookAssignments.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🌸</div>
        <p style="font-weight: 700; font-size: 1.1rem; color: var(--primary);">لا يوجد ورد قراءة مجدول لك اليوم في هذا الكتاب.</p>
        <p style="color: var(--text-muted); font-size: 0.95rem; margin-top: 5px;">استرح أو اقرأ قراءة حرة!</p>
      </div>`;
    return;
  }

  let globalIndex = 0;
  container.innerHTML = bookAssignments.map((item, itemIndex) => {
    const assign = item.assignment;
    const sub = item.submission;
    const currentIndex = globalIndex++;

    // حساب الفرق بالأيام
    const todayStr = new Date().toLocaleDateString('sv');
    const today = new Date(todayStr);
    const target = new Date(assign.targetDate);
    const diffDays = Math.floor((today - target) / (1000 * 60 * 60 * 24));

    // تحديد نوع الورد
    let assignType = 'today';
    let typeClass = '';
    let pointsBadge = '<span class="badge badge-success">✨ 10 نقاط عند الإنجاز</span>';

    if (diffDays === 1) {
      assignType = 'late';
      typeClass = 'assignment-type-late';
      pointsBadge = '<span class="badge badge-warning">⏰ تسليم متأخر (5 نقاط بدلاً من 10)</span>';
    } else if (diffDays >= 2) {
      assignType = 'missed';
      typeClass = 'assignment-type-missed';
      pointsBadge = '<span class="badge badge-missed">📛 ورد سابق — بدون نقاط لكن يُسجّل إنجازك</span>';
    }

    let html = `<div class="book-assignment-item ${typeClass}">`;

    // تنبيه الورد السابق
    if (assignType === 'missed' && !sub) {
      html += `
        <div class="missed-alert">
          <div class="missed-alert-icon">📛</div>
          <div class="missed-alert-text">
            <strong>ورد سابق</strong> - يمكنك إنجازه وسيُسجّل لك لكن بدون نقاط
          </div>
        </div>`;
    }

    // معلومات الورد
    html += `
      <div class="book-assignment-meta">
        <div class="book-assignment-pages">
          📄 صفحات الورد: من ${assign.startPage} إلى ${assign.endPage}
        </div>
        <div class="book-assignment-date">
          مجدول لتاريخ: ${assign.targetDate}
        </div>
        ${pointsBadge}
      </div>`;

    if (sub) {
      // تم التسليم
      let subDetails = '';
      if (sub.questions) {
        subDetails += `
          <div class="detail-box">
            <div class="detail-box-title">❓ سؤالك المرسل:</div>
            <div>${escapeHtml(sub.questions)}</div>
          </div>`;
      }
      if (sub.freeSpace) {
        subDetails += `
          <div class="detail-box">
            <div class="detail-box-title">📝 مساحتك الحرة / تلخيصك:</div>
            <div>${escapeHtml(sub.freeSpace)}</div>
          </div>`;
      }
      if (sub.audioData) {
        subDetails += `
          <div class="detail-box" style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.3);">
            <div class="detail-box-title" style="color: #d97706;">🎙️ كبسولتك الصوتية المسجلة:</div>
            <audio controls src="${sub.audioData}" style="width: 100%; height: 36px; margin-top: 4px;"></audio>
          </div>`;
      }

      html += `
        <div class="book-submission-success">
          <h4>✓ تم إرسال إنجاز هذا الورد بنجاح!</h4>
          <p style="font-size: 0.9rem; color: var(--text-main);">
            لقد أرسلت إنجازك للمعلم، بارك الله في همتك.
            ${sub.pointsAwarded > 0 ? `<span class="points-badge" style="margin-right: 8px;">+${sub.pointsAwarded} ⭐</span>` : '<span class="badge badge-missed" style="margin-right: 8px;">بدون نقاط</span>'}
            ${sub.isLate ? '<span class="badge badge-warning" style="margin-right: 4px;">متأخر</span>' : ''}
          </p>
          ${subDetails}
        </div>`;
    } else {
      // فورم التسليم
      const submitBtnText = assignType === 'missed'
        ? 'إرسال الإنجاز (يُسجّل بدون نقاط)'
        : 'إرسال الإنجاز للمعلم';
      const submitBtnStyle = assignType === 'missed'
        ? 'style="background: linear-gradient(135deg, #6B7280, #9CA3AF);"'
        : '';

      const isVoiceRequired = window.cachedVoiceCapsuleRequired === true;

      html += `
        <div class="book-form-section">
          <h4>✍️ تسجيل إنجازك</h4>
          <form onsubmit="handleSubmitProgress(event, '${assign.id}', ${currentIndex})">
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" id="isCompleted_${currentIndex}">
                <span>أؤكد أنني قرأت هذا الورد كاملاً وبتركيز.</span>
              </label>
            </div>
            <div class="form-group">
              <label>❓ هل لديك أسئلة حول ما قرأت؟ (اختياري)</label>
              <textarea id="questions_${currentIndex}" class="form-control" placeholder="اكتب سؤالك هنا..."></textarea>
            </div>
            <div class="form-group">
              <label>📝 مساحة حرة (تلخيص، خواطر) (اختياري)</label>
              <textarea id="freeSpace_${currentIndex}" class="form-control" placeholder="اكتب ما يجول في خاطرك..."></textarea>
            </div>

            <!-- كبسولة الفائدة الصوتية المرافقة للورد -->
            <div class="form-group" style="background: rgba(245, 158, 11, 0.08); border: 1px dashed rgba(245, 158, 11, 0.4); border-radius: 12px; padding: 12px 14px; margin-top: 10px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label style="font-weight: 800; font-size: 0.9rem; color: #b45309; margin: 0; display: flex; align-items: center; gap: 6px;">
                  <span>🎙️ كبسولة الفائدة الصوتية</span>
                </label>
                <span class="badge ${isVoiceRequired ? 'badge-warning' : 'badge-secondary'}" style="font-size: 0.78rem;">
                  ${isVoiceRequired ? '⚠️ إلزامي بتوجيه المعلم' : 'اختياري'}
                </span>
              </div>
              <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0 0 10px 0;">
                سجل صوتك بفوائد أو تلخيص هذا الورد (من 15 إلى 90 ثانية):
              </p>
              <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <button type="button" class="btn btn-secondary" id="btnRecord_${currentIndex}" onclick="handleToggleAssignmentRecord(${currentIndex})" style="padding: 5px 12px; font-size: 0.82rem; font-weight: 700;">
                  🔴 بدء التسجيل
                </button>
                <span id="recordTimer_${currentIndex}" style="font-family: monospace; font-weight: 700; font-size: 0.95rem; color: var(--text-main);">00:00</span>
                <span id="recordWave_${currentIndex}" style="display:none; color:#ef4444; font-size:0.8rem; font-weight:700;">● جاري التسجيل...</span>
              </div>
              <div id="audioPreviewWrap_${currentIndex}" style="display: none; margin-top: 10px;">
                <audio id="audioPreview_${currentIndex}" controls style="width: 100%; height: 36px;"></audio>
                <div style="margin-top: 4px; text-align: left;">
                  <button type="button" onclick="handleDiscardAssignmentAudio(${currentIndex})" style="font-size: 0.75rem; color: #ef4444; border:none; background:none; cursor:pointer;">
                    🗑️ حذف وإعادة التسجيل
                  </button>
                </div>
              </div>
            </div>

            <button type="submit" class="btn btn-primary" ${submitBtnStyle}>${submitBtnText}</button>
          </form>
        </div>`;
    }

    html += '</div>';

    // فاصل بين الأوراد
    if (itemIndex < bookAssignments.length - 1) {
      html += '<div class="book-assignment-divider"></div>';
    }

    return html;
  }).join('');
}

// --- تسجيل الكبسولة الصوتية للورد ---
let assignmentRecordedAudio = {};
let assignmentRecordedDurations = {};
let assignmentMediaRecorders = {};
let assignmentRecordIntervals = {};
let assignmentRecordSeconds = {};

async function handleToggleAssignmentRecord(index) {
  const btn = document.getElementById(`btnRecord_${index}`);
  const timer = document.getElementById(`recordTimer_${index}`);
  const wave = document.getElementById(`recordWave_${index}`);
  const previewWrap = document.getElementById(`audioPreviewWrap_${index}`);
  const audioPreview = document.getElementById(`audioPreview_${index}`);

  let rec = assignmentMediaRecorders[index];

  if (!rec || rec.state === 'inactive') {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      rec = new MediaRecorder(stream);
      assignmentMediaRecorders[index] = rec;
      let chunks = [];
      assignmentRecordSeconds[index] = 0;

      rec.ondataavailable = e => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: 'audio/webm;codecs=opus' });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          assignmentRecordedAudio[index] = reader.result;
          assignmentRecordedDurations[index] = assignmentRecordSeconds[index] || 15;
          if (audioPreview) audioPreview.src = reader.result;
          if (previewWrap) previewWrap.style.display = 'block';
        };
      };

      rec.start(200);
      if (btn) {
        btn.innerHTML = '⏹️ إيقاف التسجيل';
        btn.classList.add('btn-danger');
      }
      if (wave) wave.style.display = 'inline';

      assignmentRecordIntervals[index] = setInterval(() => {
        assignmentRecordSeconds[index]++;
        const s = assignmentRecordSeconds[index];
        const mins = String(Math.floor(s / 60)).padStart(2, '0');
        const secs = String(s % 60).padStart(2, '0');
        if (timer) timer.textContent = `${mins}:${secs}`;
        if (s >= 90) handleToggleAssignmentRecord(index);
      }, 1000);

    } catch (err) {
      alert('يرجى السماح بالوصول إلى الميكروفون لتسجيل الكبسولة الصوتية.');
    }
  } else if (rec.state === 'recording') {
    rec.stop();
    clearInterval(assignmentRecordIntervals[index]);
    if (btn) {
      btn.innerHTML = '🔴 إعادة التسجيل';
      btn.classList.remove('btn-danger');
    }
    if (wave) wave.style.display = 'none';
  }
}

function handleDiscardAssignmentAudio(index) {
  assignmentRecordedAudio[index] = null;
  assignmentRecordedDurations[index] = 0;
  const previewWrap = document.getElementById(`audioPreviewWrap_${index}`);
  if (previewWrap) previewWrap.style.display = 'none';
  const audioPreview = document.getElementById(`audioPreview_${index}`);
  if (audioPreview) audioPreview.src = '';
  const timer = document.getElementById(`recordTimer_${index}`);
  if (timer) timer.textContent = '00:00';
  const btn = document.getElementById(`btnRecord_${index}`);
  if (btn) {
    btn.innerHTML = '🔴 بدء التسجيل';
    btn.classList.remove('btn-danger');
  }
}

// --- إرسال الإنجاز ---
async function handleSubmitProgress(e, assignmentId, index) {
  e.preventDefault();
  const isCompleted = document.getElementById(`isCompleted_${index}`).checked;
  const questions = document.getElementById(`questions_${index}`).value;
  const freeSpace = document.getElementById(`freeSpace_${index}`).value;

  if (!isCompleted) {
    showAlert('studentAlert', 'يرجى تأكيد أنك قرأت الورد أولاً بوضع علامة ✓', 'danger');
    return;
  }

  const isVoiceMandatory = window.cachedVoiceCapsuleRequired === true;
  const audioData = assignmentRecordedAudio[index] || null;
  const durationSec = assignmentRecordedDurations[index] || 0;

  if (isVoiceMandatory && !audioData) {
    showAlert('studentAlert', '⚠️ تسجيل كبسولة الفائدة الصوتية إلزامي لهذا الورد بتوجيه من المعلم. يرجى تسجيل صوتك أولاً.', 'danger');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/student/submit`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        assignmentId,
        isCompleted,
        questions,
        freeSpace,
        audioData,
        durationSec
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    // تصفير التسجيل الصوتي
    assignmentRecordedAudio[index] = null;
    assignmentRecordedDurations[index] = 0;

    showAlert('studentAlert', data.message, 'success');

    // 🎉 تأثير الكونفيتي عند النجاح!
    launchConfetti();

    // إعادة تحميل النقاط الإجمالية
    loadStudentPoints();

    // إعادة تحميل البيانات وتحديث صفحة الكتاب
    await reloadDataAndRefreshBook();
  } catch (error) {
    showAlert('studentAlert', error.message, 'danger');
  }
}

// --- إعادة تحميل البيانات وتحديث العرض ---
async function reloadDataAndRefreshBook() {
  try {
    const assignRes = await fetch(`${API_BASE}/student/assignments/today`, {
      headers: getAuthHeaders()
    });
    const assignData = await assignRes.json();

    const histRes = await fetch(`${API_BASE}/student/assignments/history`, {
      headers: getAuthHeaders()
    });
    const histData = await histRes.json();

    allAssignmentsData = assignData.assignments || [];
    allHistoryData = histData.history || [];

    // تحديث ثماري (والإنجازات والسلسلة)
    updateThamari();

    // إذا كنا في صفحة كتاب، نحدّثها
    if (currentBookName) {
      loadBookAssignments(currentBookName);
      loadBookHistory(currentBookName);
      updateBookStats(currentBookName);
    }
  } catch (error) {
    console.error('Error reloading data:', error);
  }
}

// --- تحميل سجل كتاب محدد ---
function loadBookHistory(bookName) {
  const container = document.getElementById('bookHistoryContainer');

  const bookHistory = allHistoryData.filter(h => h.bookName === bookName);

  if (bookHistory.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📚</div>
        لا توجد أوراد سابقة لهذا الكتاب.
      </div>`;
    return;
  }

  let html = `
    <div class="table-responsive">
      <table style="font-size: 0.9rem;">
        <thead>
          <tr>
            <th>الصفحات</th>
            <th>التاريخ</th>
            <th>الحالة</th>
            <th>النقاط</th>
          </tr>
        </thead>
        <tbody>`;

  bookHistory.forEach(item => {
    let statusBadge = '';
    if (item.submittedAt) {
      statusBadge = item.isCompleted
        ? '<span class="badge badge-success">تم الإنجاز ✓</span>'
        : '<span class="badge badge-danger">لم ينجز ✗</span>';
      if (item.isLate && item.isCompleted) {
        statusBadge += ' <span class="badge badge-warning">متأخر</span>';
      }
    } else {
      statusBadge = '<span class="badge badge-danger" style="background-color: #F3F4F6; color: #9CA3AF;">لم يسجل</span>';
    }

    let pointsDisplay = '';
    if (item.pointsAwarded > 0) {
      pointsDisplay = `<span class="points-badge-sm">+${item.pointsAwarded} ⭐</span>`;
    } else {
      pointsDisplay = '<span style="color: var(--text-muted);">-</span>';
    }

    html += `
      <tr>
        <td>${item.startPage} - ${item.endPage}</td>
        <td style="font-size: 0.8rem; color: var(--text-muted);">${item.targetDate}</td>
        <td>${statusBadge}</td>
        <td>${pointsDisplay}</td>
      </tr>`;
  });

  html += `
        </tbody>
      </table>
    </div>`;

  container.innerHTML = html;
}

// --- HTML Escape ---
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==========================================
// --- نظام تواصل ومحادثة الطالب مع المعلم ---
// ==========================================

let studentActiveTeacherId = null;
let studentTeachersList = [];
let isStudentChatModalOpen = false;
let studentActiveMessages = [];

// جلب عدد الرسائل غير المقروءة للطالب
async function loadStudentUnreadCount() {
  try {
    const res = await fetch(`${API_BASE}/messages/unread-count`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) return;
    const data = await res.json();
    const count = data.unreadCount || 0;

    const badgeEl = document.getElementById('studentUnreadBadge');
    if (badgeEl) {
      if (count > 0) {
        badgeEl.textContent = count;
        badgeEl.style.display = 'inline-block';
      } else {
        badgeEl.style.display = 'none';
      }
    }
  } catch (e) {
    console.error('Error fetching student unread count:', e);
  }
}

// فتح نافذة المحادثة مع المعلم
async function openStudentChatModal() {
  const modal = document.getElementById('studentChatModal');
  if (!modal) return;

  isStudentChatModalOpen = true;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  const bodyEl = document.getElementById('studentChatMessagesBody');
  if (bodyEl) bodyEl.innerHTML = '<div class="empty-state">جاري تحميل المحادثة...</div>';

  try {
    // جلب قائمة المحادثات/المعلمين
    const res = await fetch(`${API_BASE}/messages/conversations`, {
      headers: getAuthHeaders()
    });

    if (res.ok) {
      const data = await res.json();
      const convos = data.conversations || [];
      studentTeachersList = convos.map(c => c.user);
    } else {
      studentTeachersList = [];
    }

    const recipientSelect = document.getElementById('studentRecipientSelect');
    const currentRecipient = recipientSelect ? recipientSelect.value : 'iqra_teacher';

    if (currentRecipient === 'director') {
      await handleStudentRecipientChange('director');
    } else {
      await setupTeacherChatView();
    }

    setTimeout(() => {
      const input = document.getElementById('studentChatMessageInput');
      if (input) input.focus();
    }, 200);

  } catch (err) {
    console.error('Error opening chat modal:', err);
    if (bodyEl) bodyEl.innerHTML = '<div class="empty-state">حدث خطأ في تحميل المحادثة.</div>';
  }
}

// إعداد واجهة مراسلة المعلم
async function setupTeacherChatView() {
  const bodyEl = document.getElementById('studentChatMessagesBody');
  const selectorRow = document.getElementById('studentTeacherSelectorRow');
  const selectEl = document.getElementById('studentTeacherSelect');
  const nameEl = document.getElementById('studentTeacherName');
  const avatarEl = document.getElementById('studentTeacherAvatar');
  const clearBtn = document.querySelector('.btn-chat-clear');

  if (clearBtn) clearBtn.style.display = 'inline-block';

  if (studentTeachersList.length === 0) {
    if (selectorRow) selectorRow.style.display = 'none';
    if (nameEl) nameEl.textContent = 'معلم منصة اقرأ';
    if (avatarEl) {
      avatarEl.textContent = '👨‍🏫';
      avatarEl.style.background = '';
    }
    if (bodyEl) {
      bodyEl.innerHTML = `
        <div class="empty-state" style="padding: 40px 20px;">
          <div style="font-size: 2.5rem; margin-bottom: 8px;">👨‍🏫</div>
          <div style="font-weight: 700; color: var(--text-main);">لم يتم العثور على معلم مسجل</div>
          <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">يمكنك مراسلة مدير منظومة نقاطي من قائمة المُوجّه إليه في الأعلى.</div>
        </div>
      `;
    }
    return;
  }

  if (studentTeachersList.length > 1 && selectorRow && selectEl) {
    selectorRow.style.display = 'flex';
    selectEl.innerHTML = studentTeachersList.map(t => `<option value="${t.id}">${escapeHtml(t.fullName)}</option>`).join('');
  } else if (selectorRow) {
    selectorRow.style.display = 'none';
  }

  if (!studentActiveTeacherId || !studentTeachersList.some(t => t.id.toString() === studentActiveTeacherId.toString())) {
    studentActiveTeacherId = studentTeachersList[0].id.toString();
  }

  const currentTeacher = studentTeachersList.find(t => t.id.toString() === studentActiveTeacherId.toString()) || studentTeachersList[0];

  if (nameEl) nameEl.textContent = `المعلم: ${currentTeacher.fullName}`;
  if (avatarEl) {
    avatarEl.textContent = (currentTeacher.fullName || 'م').trim().charAt(0);
    avatarEl.style.background = '';
  }

  await loadStudentChatMessages(studentActiveTeacherId);
  markStudentChatRead(studentActiveTeacherId);
}

// التبديل بين مراسلة معلم اقرأ ومدير نقاطي
async function handleStudentRecipientChange(val) {
  const selectorRow = document.getElementById('studentTeacherSelectorRow');
  const nameEl = document.getElementById('studentTeacherName');
  const avatarEl = document.getElementById('studentTeacherAvatar');
  const input = document.getElementById('studentChatMessageInput');
  const clearBtn = document.querySelector('.btn-chat-clear');

  if (val === 'director') {
    if (selectorRow) selectorRow.style.display = 'none';
    if (nameEl) nameEl.textContent = '👑 مدير منظومة نقاطي العام';
    if (avatarEl) {
      avatarEl.textContent = '👑';
      avatarEl.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
    }
    if (input) input.placeholder = 'اكتب رسالتك أو استفسارك لمدير منظومة نقاطي...';
    if (clearBtn) clearBtn.style.display = 'none';
    await loadStudentDirectorMessages();
  } else {
    if (input) input.placeholder = 'اكتب رسالتك أو استفسارك لمعلم القراءة...';
    await setupTeacherChatView();
  }
}

// جلب رسائل الطالب الموجهة لمدير المنظومة
async function loadStudentDirectorMessages() {
  const bodyEl = document.getElementById('studentChatMessagesBody');
  if (!bodyEl) return;
  bodyEl.innerHTML = '<div class="empty-state">جاري تحميل رسائل الإدارة...</div>';

  try {
    const user = getUser();
    const studentId = user ? user.id : '';
    const res = await fetch(`${API_BASE}/student-messages?studentId=${studentId}&recipient=director`);
    if (!res.ok) throw new Error('فشل جلب الرسائل');
    const data = await res.json();
    const msgs = data.messages || [];
    renderStudentDirectorChat(msgs);
  } catch (err) {
    console.error('Error loading director messages:', err);
    bodyEl.innerHTML = '<div class="empty-state">حدث خطأ في جلب الرسائل من الإدارة.</div>';
  }
}

// عرض رسائل الطالب وردود المدير العام
function renderStudentDirectorChat(messages) {
  const bodyEl = document.getElementById('studentChatMessagesBody');
  if (!bodyEl) return;

  if (messages.length === 0) {
    bodyEl.innerHTML = `
      <div class="empty-state" style="padding: 40px 20px;">
        <div style="font-size: 2.5rem; margin-bottom: 8px;">👑</div>
        <div style="font-weight: 700; color: var(--text-main); margin-bottom: 4px;">التواصل مع مدير منظومة نقاطي</div>
        <div style="font-size: 0.85rem; color: var(--text-muted);">اكتب رسالتك، اقتراحك، أو استفسارك العام للإدارة وسيرد عليك المدير بإذن الله.</div>
      </div>
    `;
    return;
  }

  bodyEl.innerHTML = messages.map(msg => {
    let timeFormatted = '';
    const dateVal = msg.created_at || msg.createdAt;
    if (dateVal) {
      try {
        const d = new Date(dateVal);
        timeFormatted = d.toLocaleDateString('ar-EG') + ' ' + d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
      } catch (e) {}
    }

    const replyHtml = msg.reply ? `
      <div class="chat-msg-row incoming" style="margin-top: 6px;">
        <div class="chat-msg-bubble" style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); color: var(--text-main);">
          <div style="font-size: 0.75rem; font-weight: 800; color: #10b981; margin-bottom: 4px; display:flex; align-items:center; gap:4px;">
            <span>👑 رد المدير العام:</span>
          </div>
          <div>${escapeHtml(msg.reply)}</div>
        </div>
      </div>
    ` : `
      <div style="font-size: 0.72rem; color: var(--text-muted); text-align: left; padding: 2px 8px;">⏳ بانتظار رد المدير...</div>
    `;

    return `
      <div class="chat-msg-row outgoing" style="margin-bottom: 12px;">
        <div class="chat-msg-bubble">
          <div style="font-size: 0.72rem; opacity: 0.85; margin-bottom: 3px; font-weight: 700;">إلى مدير نقاطي 👑</div>
          <div>${escapeHtml(msg.message)}</div>
        </div>
        <div class="chat-msg-meta">
          <span>${timeFormatted}</span>
        </div>
        ${replyHtml}
      </div>
    `;
  }).join('');

  bodyEl.scrollTop = bodyEl.scrollHeight;
}

// إغلاق نافذة المحادثة
function closeStudentChatModal() {
  const modal = document.getElementById('studentChatModal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
  isStudentChatModalOpen = false;
  loadStudentUnreadCount();
}

function handleStudentChatOverlayClick(e) {
  if (e.target && e.target.id === 'studentChatModal') {
    closeStudentChatModal();
  }
}

// تغيير المعلم في حال وجود أكثر من معلم
function handleStudentTeacherChange(teacherId) {
  studentActiveTeacherId = teacherId.toString();
  const teacher = studentTeachersList.find(t => t.id.toString() === studentActiveTeacherId);
  if (teacher) {
    const nameEl = document.getElementById('studentTeacherName');
    const avatarEl = document.getElementById('studentTeacherAvatar');
    if (nameEl) nameEl.textContent = `المعلم: ${teacher.fullName}`;
    if (avatarEl) avatarEl.textContent = (teacher.fullName || 'م').trim().charAt(0);
  }
  loadStudentChatMessages(studentActiveTeacherId);
  markStudentChatRead(studentActiveTeacherId);
}

// تحديث المحادثة
function refreshStudentActiveChat() {
  const recipientSelect = document.getElementById('studentRecipientSelect');
  const recipient = recipientSelect ? recipientSelect.value : 'iqra_teacher';
  if (recipient === 'director') {
    loadStudentDirectorMessages();
  } else if (studentActiveTeacherId) {
    loadStudentChatMessages(studentActiveTeacherId);
  }
}

// جلب سجل رسائل الطالب مع المعلم
async function loadStudentChatMessages(teacherId, isBackgroundRefresh = false) {
  if (!teacherId) return;

  const bodyEl = document.getElementById('studentChatMessagesBody');
  if (!bodyEl) return;

  try {
    const res = await fetch(`${API_BASE}/messages/chat/${teacherId}`, {
      headers: getAuthHeaders()
    });

    if (!res.ok) throw new Error('فشل جلب الرسائل');

    const data = await res.json();
    studentActiveMessages = data.messages || [];
    renderStudentMessages(studentActiveMessages);
  } catch (err) {
    console.error('Error loading chat messages:', err);
    if (!isBackgroundRefresh && bodyEl) {
      bodyEl.innerHTML = '<div class="empty-state">حدث خطأ في جلب الرسائل.</div>';
    }
  }
}

// عرض رسائل الطالب والمعلم
function renderStudentMessages(messages) {
  const bodyEl = document.getElementById('studentChatMessagesBody');
  if (!bodyEl) return;

  const currentUser = getUser();
  const currentUserId = currentUser ? currentUser.id.toString() : '';

  if (messages.length === 0) {
    bodyEl.innerHTML = `
      <div class="empty-state" style="padding: 40px 20px;">
        <div style="font-size: 2.5rem; margin-bottom: 8px;">💬</div>
        <div style="font-weight: 700; color: var(--text-main); margin-bottom: 4px;">مرحباً بك!</div>
        <div style="font-size: 0.85rem; color: var(--text-muted);">اكتب رسالتك أو استفسارك لمعلمك هنا وسيرد عليك بإذن الله.</div>
      </div>
    `;
    return;
  }

  bodyEl.innerHTML = messages.map(msg => {
    const isOutgoing = msg.senderId.toString() === currentUserId;
    const rowClass = isOutgoing ? 'outgoing' : 'incoming';

    let timeFormatted = '';
    if (msg.createdAt) {
      try {
        const d = new Date(msg.createdAt);
        timeFormatted = d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
      } catch (e) {}
    }

    const deleteBtnHtml = isOutgoing
      ? `<button type="button" class="btn-msg-delete" onclick="handleDeleteStudentMessage('${msg.id}')" title="حذف الرسالة">🗑️</button>`
      : '';

    return `
      <div class="chat-msg-row ${rowClass}" id="student-msg-${msg.id}">
        <div class="chat-msg-bubble">${escapeHtml(msg.content)}</div>
        <div class="chat-msg-meta">
          <span>${timeFormatted}</span>
          ${readStatusHtml}
          ${deleteBtnHtml}
        </div>
      </div>
    `;
  }).join('');

  bodyEl.scrollTop = bodyEl.scrollHeight;
}

// حذف رسالة أرسلها الطالب
async function handleDeleteStudentMessage(messageId) {
  if (!confirm('هل أنت متأكد من رغبتك في حذف هذه الرسالة؟')) return;

  try {
    const res = await fetch(`${API_BASE}/messages/${messageId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل حذف الرسالة');

    studentActiveMessages = studentActiveMessages.filter(m => m.id.toString() !== messageId.toString());
    renderStudentMessages(studentActiveMessages);
  } catch (err) {
    alert(err.message || 'حدث خطأ في حذف الرسالة');
  }
}

// مسح كامل المحادثة مع المعلم
async function handleClearStudentChat() {
  if (!studentActiveTeacherId) return;
  if (!confirm('هل أنت متأكد من رغبتك في مسح جميع رسائل هذه المحادثة؟')) return;

  try {
    const res = await fetch(`${API_BASE}/messages/clear/${studentActiveTeacherId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل مسح المحادثة');

    studentActiveMessages = [];
    renderStudentMessages(studentActiveMessages);
  } catch (err) {
    alert(err.message || 'حدث خطأ في مسح المحادثة');
  }
}

// تحديد رسائل المحادثة كمقروءة للطالب
async function markStudentChatRead(teacherId) {
  try {
    await fetch(`${API_BASE}/messages/mark-read/${teacherId}`, {
      method: 'PUT',
      headers: getAuthHeaders()
    });
    loadStudentUnreadCount();
  } catch (e) {}
}

// إدخال رد جاهز وسريع للطالب
function insertStudentQuickReply(text) {
  const input = document.getElementById('studentChatMessageInput');
  if (!input) return;
  input.value = text;
  input.focus();
}

// ضغط Enter للإرسال
function handleStudentChatInputKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    handleSendStudentMessage(event);
  }
}

// إرسال رسالة من الطالب (للمعلم أو للمدير)
async function handleSendStudentMessage(event) {
  if (event) event.preventDefault();

  const recipientSelect = document.getElementById('studentRecipientSelect');
  const recipient = recipientSelect ? recipientSelect.value : 'iqra_teacher';

  const input = document.getElementById('studentChatMessageInput');
  if (!input) return;

  const content = input.value.trim();
  if (!content) return;

  const sendBtn = document.getElementById('btnStudentSendChat');
  if (sendBtn) sendBtn.disabled = true;

  try {
    if (recipient === 'director') {
      const user = getUser();
      const res = await fetch(`${API_BASE}/student-messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          studentId: user ? user.id : 'unknown',
          studentName: user ? user.fullName : 'طالب',
          classId: user ? user.classId : null,
          category: 'general',
          message: content,
          recipient: 'director'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل إرسال الرسالة إلى المدير');

      input.value = '';
      input.style.height = 'auto';
      await loadStudentDirectorMessages();
    } else {
      if (!studentActiveTeacherId) {
        alert('يرجى اختيار معلم أولاً');
        return;
      }

      const res = await fetch(`${API_BASE}/messages/send`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          receiverId: studentActiveTeacherId,
          content: content
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل إرسال الرسالة');

      input.value = '';
      input.style.height = 'auto';

      if (data.data) {
        studentActiveMessages.push(data.data);
        renderStudentMessages(studentActiveMessages);
      }
    }
  } catch (err) {
    alert(err.message || 'حدث خطأ أثناء إرسال الرسالة');
  } finally {
    if (sendBtn) sendBtn.disabled = false;
    input.focus();
  }
}

// ==========================================
// --- حائط درر القراءة في صفحة الطالب ---
// ==========================================

function scrollToGemsWall() {
  const el = document.getElementById('studentGemsSection');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.style.transition = 'box-shadow 0.3s ease';
    el.style.boxShadow = '0 0 0 3px rgba(245, 158, 11, 0.4)';
    setTimeout(() => {
      el.style.boxShadow = '';
    }, 1500);
  }
}

async function loadStudentGems() {
  const container = document.getElementById('studentGemsList');
  if (!container) return;
  try {
    const res = await fetch('/api/ibda/gems');
    if (!res.ok) throw new Error('فشل جلب الدرر');
    const data = await res.json();
    const gems = data.gems || [];

    if (gems.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding: 30px 15px; color: var(--text-muted); background: var(--surface); border-radius: 12px; border: 1px dashed var(--border);">
          <div style="font-size: 2.2rem; margin-bottom: 6px;">💎</div>
          <div style="font-weight: 700; color: var(--text-main);">لا توجد درر مسجلة بعد</div>
          <div style="font-size: 0.85rem; margin-top: 4px;">كن أول من يشارك درة وفائدة استوقفته في قراءته اليوم!</div>
        </div>
      `;
      return;
    }

    container.innerHTML = gems.map(g => `
      <div class="gem-card" style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--border-radius-md); padding: 16px; display: flex; flex-direction: column; justify-content: space-between; position: relative; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
        <div style="font-size: 0.8rem; color: #f59e0b; font-weight: 800; margin-bottom: 6px;">
          📖 ${escapeHtml(g.book_title || 'ورد القراءة')}
        </div>
        <div style="font-size: 0.92rem; color: var(--text-main); font-weight: 600; line-height: 1.5; margin-bottom: 14px;">
          «${escapeHtml(g.gem_text)}»
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 10px; font-size: 0.82rem;">
          <div style="display: flex; align-items: center; gap: 6px; font-weight: 700; color: var(--text-muted);">
            <div style="width: 26px; height: 26px; border-radius: 50%; background: #f59e0b; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 900;">
              ${(g.student_name || 'ط')[0]}
            </div>
            <span>${escapeHtml(g.student_name)}</span>
          </div>
          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn-react" onclick="handleStudentReactGem(${g.id}, 'like', this)" style="border: 1px solid var(--border); background: var(--background); border-radius: 20px; padding: 2px 8px; font-size: 0.78rem; cursor: pointer;">
              ❤️ <span class="react-cnt">${g.likes_count || 0}</span>
            </button>
            <button type="button" class="btn-react" onclick="handleStudentReactGem(${g.id}, 'gem', this)" style="border: 1px solid var(--border); background: var(--background); border-radius: 20px; padding: 2px 8px; font-size: 0.78rem; cursor: pointer;">
              💎 <span class="react-cnt">${g.gems_count || 0}</span>
            </button>
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading student gems:', err);
    if (container) container.innerHTML = '<div style="grid-column: 1/-1; text-align:center; color: var(--text-muted);">تعذر تحميل الدرر حالياً.</div>';
  }
}

async function handleStudentReactGem(id, type, btn) {
  try {
    const cntEl = btn.querySelector('.react-cnt');
    if (cntEl) cntEl.textContent = parseInt(cntEl.textContent || '0', 10) + 1;
    btn.style.transform = 'scale(1.2)';
    setTimeout(() => btn.style.transform = 'none', 200);

    await fetch(`/api/ibda/gems/${id}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type })
    });
  } catch (e) {}
}

function openStudentAddGemModal() {
  const modal = document.getElementById('studentAddGemModal');
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    const input = document.getElementById('studentGemBookInput');
    if (input) input.focus();
  }
}

function closeStudentAddGemModal() {
  const modal = document.getElementById('studentAddGemModal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

function handleStudentAddGemOverlayClick(e) {
  if (e.target && e.target.id === 'studentAddGemModal') {
    closeStudentAddGemModal();
  }
}

async function handleStudentSubmitGem(e) {
  e.preventDefault();
  const bookEl = document.getElementById('studentGemBookInput');
  const textEl = document.getElementById('studentGemTextInput');
  const submitBtn = document.getElementById('btnStudentSubmitGem');

  const bookTitle = bookEl ? bookEl.value.trim() : '';
  const gemText = textEl ? textEl.value.trim() : '';

  if (!gemText) {
    alert('الرجاء كتابة الفائدة أو الاقتباس أولاً!');
    return;
  }

  const user = getUser();
  const studentName = user ? (user.fullName || user.username) : 'طالب';
  const studentId = user ? user.id : null;
  const classId = user ? user.classId : null;

  if (submitBtn) submitBtn.disabled = true;

  try {
    const res = await fetch('/api/ibda/gems', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId,
        studentName,
        classId,
        bookTitle: bookTitle || 'ورد القراءة',
        gemText
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل نشر الدرة');

    closeStudentAddGemModal();
    if (textEl) textEl.value = '';
    if (bookEl) bookEl.value = '';
    showAlert('studentAlert', 'بارك الله فيك! تم نشر درتك في حائط درر القراءة بنجاح ✨💎', 'success');
    loadStudentGems();
  } catch (err) {
    alert(err.message || 'حدث خطأ أثناء نشر الدرة');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

