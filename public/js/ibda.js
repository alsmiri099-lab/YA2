/**
 * منظومة إبداع | IBDA CREATIVE HUB JAVASCRIPT
 * تضم:
 * 1. 🎙️ كبسولة الفائدة الصوتية (مع إمكانية جعلها إلزامية أو اختيارية)
 * 2. 💎 حائط درر القراءة (نقي وبدون بيانات وهمية)
 * 3. 📰 صحيفة الأسبوع الحائطية (مع تحكم سهل وسلس في التصميم والألوان وتعديل النص مباشرة)
 */

window.IbdaHub = (function () {
  let mediaRecorder = null;
  let audioChunks = [];
  let recordTimerInterval = null;
  let recordSeconds = 0;
  let currentAudioBlob = null;
  let currentAudioDataUrl = null;

  // إعدادات تصميم الصحيفة الحالية
  let magazineState = {
    theme: 'gold', // gold, emerald, sapphire, parchment, midnight
    fontSize: 'medium', // small, medium, large
    title: 'صحيفة إبداع الأسبوعية 📰',
    subtitle: 'مجمع الحلقات القرآنية — منبر التميز والعطاء',
    knightName: 'طالب متميز من حلقة القرآن',
    knightAchievement: 'أتم أكثر من 120 صفحة في ورده الأسبوعي',
    hadithTitle: 'حديث الأسبوع 🌸',
    hadithText: '«من سلك طريقاً يلتمس فيه علماً سهّل الله له به طريقاً إلى الجنة» [رواه مسلم]',
    footerText: 'صدرت عن مجمع الحلقات ومنصة اقرأ | تصميم وإخراج آلي عبر منظومة إبداع'
  };

  // تبديل تبويبات قسم إبداع
  function switchIbdaTab(tabName) {
    document.querySelectorAll('.ibda-tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.subtab === tabName);
    });
    document.querySelectorAll('.ibda-section').forEach(s => {
      s.classList.toggle('active', s.id === `ibda-subtab-${tabName}`);
    });

    if (tabName === 'gems') loadGems();
    if (tabName === 'capsule') {
      loadCapsules();
      checkVoiceSetting();
    }
    if (tabName === 'magazine') {
      const container = document.getElementById('ibdaMagazinePreviewArea');
      if (container && (!container.children || container.children.length === 0)) {
        generateMagazine();
      }
    }
  }

  // فحص إعداد إلزامية الكبسولة
  async function checkVoiceSetting() {
    const toggle = document.getElementById('ibdaVoiceRequiredToggle');
    if (!toggle) return;
    try {
      const res = await fetch('/api/teacher/voice-capsule-setting', {
        headers: (typeof getAuthHeaders === 'function') ? getAuthHeaders() : {}
      });
      if (res.ok) {
        const data = await res.json();
        toggle.checked = !!data.voiceCapsuleRequired;
        const statusEl = document.getElementById('ibdaVoiceSettingStatus');
        if (statusEl) {
          statusEl.textContent = data.voiceCapsuleRequired ? '✅ تم تفعيل الإلزام مع إرسال الورد' : 'ℹ️ الكبسولة الصوتية اختيارية حالياً';
          statusEl.style.color = data.voiceCapsuleRequired ? '#10b981' : '#cbd5e1';
        }
      }
    } catch (e) {}
  }

  // تبديل إعداد إلزامية الكبسولة للمعلم
  async function toggleVoiceRequiredSetting(isRequired) {
    try {
      const res = await fetch('/api/teacher/voice-capsule-setting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...((typeof getAuthHeaders === 'function') ? getAuthHeaders() : {})
        },
        body: JSON.stringify({ voiceCapsuleRequired: !!isRequired })
      });
      const data = await res.json();
      const statusEl = document.getElementById('ibdaVoiceSettingStatus');
      if (statusEl) {
        statusEl.textContent = isRequired ? '✅ تم تفعيل الإلزام مع إرسال الورد' : 'ℹ️ الكبسولة الصوتية اختيارية حالياً';
        statusEl.style.color = isRequired ? '#10b981' : '#cbd5e1';
      }
    } catch (e) {
      alert('تعذر حفظ الإعداد، تأكد من الاتصال.');
    }
  }

  // تحميل درر القراءة
  async function loadGems() {
    const grid = document.getElementById('ibdaGemsGrid');
    if (!grid) return;
    try {
      const res = await fetch('/api/ibda/gems');
      const data = await res.json();
      if (!data.success || !data.gems || data.gems.length === 0) {
        grid.innerHTML = `
          <div style="grid-column: 1/-1; text-align:center; color:#94a3b8; padding:3rem 1.5rem; background:rgba(0,0,0,0.2); border-radius:16px;">
            <div style="font-size:2.5rem; margin-bottom:0.75rem;">💎</div>
            <div style="font-weight:700; font-size:1.1rem; color:#f1f5f9; margin-bottom:0.25rem;">لا توجد درر مسجلة بعد</div>
            <div style="font-size:0.85rem; color:#94a3b8;">كن أول من يشارك درة وفائدة ملهمة استوقفته اليوم في قراءته!</div>
          </div>`;
        return;
      }
      grid.innerHTML = data.gems.map(g => `
        <div class="gem-card">
          <div class="gem-quote-mark">“</div>
          <div style="font-size:0.8rem; color:#f59e0b; font-weight:700; margin-bottom:0.4rem;">
            📖 ${escapeHtml(g.book_title || 'ورد القراءة')}
          </div>
          <div class="gem-text">${escapeHtml(g.gem_text)}</div>
          <div class="gem-footer">
            <div class="gem-student-info">
              <div class="gem-avatar">${(g.student_name || 'ط')[0]}</div>
              <span style="font-weight:700; font-size:0.88rem; color:#e2e8f0;">${escapeHtml(g.student_name)}</span>
            </div>
            <div class="gem-reactions">
              <button type="button" class="btn-react" onclick="IbdaHub.reactGem(${g.id}, 'like', this)">
                ❤️ <span class="react-cnt">${g.likes_count || 0}</span>
              </button>
              <button type="button" class="btn-react" onclick="IbdaHub.reactGem(${g.id}, 'gem', this)">
                💎 <span class="react-cnt">${g.gems_count || 0}</span>
              </button>
            </div>
          </div>
        </div>
      `).join('');
    } catch (e) {
      console.warn('loadGems error:', e);
    }
  }

  // تفاعل مع درة
  async function reactGem(id, type, btn) {
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
    } catch (e) {
      console.warn('reactGem error:', e);
    }
  }

  // نشر درة جديدة
  async function submitGem(e, currentStudent) {
    if (e) e.preventDefault();
    const txtInput = document.getElementById('ibdaGemInput');
    const bookInput = document.getElementById('ibdaGemBook');
    const text = txtInput ? txtInput.value.trim() : '';
    const book = bookInput ? bookInput.value.trim() : 'ورد القراءة';

    if (!text) {
      alert('الرجاء كتابة الفائدة أو الاقتباس أولاً!');
      return;
    }

    let studentName = 'طالب متميز';
    let studentId = null;
    let classId = null;

    if (typeof getUser === 'function') {
      const u = getUser();
      if (u) {
        studentName = u.fullName || u.username || studentName;
        studentId = u.id || null;
        classId = u.classId || null;
      }
    } else if (currentStudent) {
      studentName = currentStudent.name || studentName;
      studentId = currentStudent.id || null;
      classId = currentStudent.classId || null;
    }

    try {
      const res = await fetch('/api/ibda/gems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          studentName,
          classId,
          bookTitle: book,
          gemText: text
        })
      });
      const data = await res.json();
      if (data.success) {
        if (txtInput) txtInput.value = '';
        loadGems();
        alert('بارك الله فيك! تم نشر درتك في حائط درر الحلقات ✨');
      }
    } catch (err) {
      alert('تعذر نشر الدرة، تأكد من الاتصال');
    }
  }

  // مسجل الكبسولة الصوتية
  async function toggleRecording(student) {
    const btn = document.getElementById('ibdaBtnRecord');
    const timer = document.getElementById('ibdaRecordTimer');
    const wave = document.getElementById('ibdaWaveform');
    const previewWrap = document.getElementById('ibdaAudioPreviewWrap');

    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        recordSeconds = 0;

        mediaRecorder.ondataavailable = e => {
          if (e.data.size > 0) audioChunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
          stream.getTracks().forEach(t => t.stop());
          currentAudioBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });
          const reader = new FileReader();
          reader.readAsDataURL(currentAudioBlob);
          reader.onloadend = () => {
            currentAudioDataUrl = reader.result;
            if (previewWrap) {
              previewWrap.style.display = 'block';
              previewWrap.innerHTML = `
                <div style="margin-top:1rem; padding:1rem; background:rgba(0,0,0,0.3); border-radius:12px;">
                  <div style="font-size:0.85rem; color:#94a3b8; margin-bottom:0.5rem;">استمع لتسجيلك قبل الإرسال:</div>
                  <audio controls src="${currentAudioDataUrl}" style="width:100%; height:40px;"></audio>
                  <div style="margin-top:0.75rem; display:flex; gap:0.5rem; justify-content:center;">
                    <button type="button" class="ibda-btn-action" onclick="IbdaHub.sendCapsule()">
                      <span>إرسال الكبسولة</span> 🚀
                    </button>
                    <button type="button" class="ibda-btn-secondary" onclick="IbdaHub.resetRecorder()">
                      <span>إعادة التسجيل</span> 🔄
                    </button>
                  </div>
                </div>
              `;
            }
          };
        };

        mediaRecorder.start(200);
        if (btn) {
          btn.classList.add('recording');
          btn.innerHTML = '⏹️';
          btn.title = 'إيقاف التسجيل';
        }
        if (wave) wave.classList.add('active');

        recordTimerInterval = setInterval(() => {
          recordSeconds++;
          const mins = String(Math.floor(recordSeconds / 60)).padStart(2, '0');
          const secs = String(recordSeconds % 60).padStart(2, '0');
          if (timer) timer.textContent = `${mins}:${secs}`;
          if (recordSeconds >= 90) toggleRecording(student);
        }, 1000);

      } catch (err) {
        alert('يرجى السماح بالوصول إلى الميكروفون لتسجيل الكبسولة الصوتية.');
      }
    } else if (mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      clearInterval(recordTimerInterval);
      if (btn) {
        btn.classList.remove('recording');
        btn.innerHTML = '🎙️';
        btn.title = 'بدء التسجيل';
      }
      if (wave) wave.classList.remove('active');
    }
  }

  function resetRecorder() {
    currentAudioBlob = null;
    currentAudioDataUrl = null;
    const previewWrap = document.getElementById('ibdaAudioPreviewWrap');
    if (previewWrap) previewWrap.style.display = 'none';
    const timer = document.getElementById('ibdaRecordTimer');
    if (timer) timer.textContent = '00:00';
  }

  async function sendCapsule(currentStudent) {
    if (!currentAudioDataUrl) {
      alert('لم يتم تسجيل أي مقطع صوتي بعد!');
      return;
    }
    const bookInput = document.getElementById('ibdaCapsuleBook');
    const bookTitle = bookInput ? bookInput.value.trim() : 'ورد القراءة';
    
    let studentName = 'معلم / طالب';
    let studentId = null;
    let classId = null;

    if (typeof getUser === 'function') {
      const u = getUser();
      if (u) {
        studentName = u.fullName || studentName;
        studentId = u.id || null;
        classId = u.classId || null;
      }
    }

    try {
      const res = await fetch('/api/ibda/capsules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: studentId,
          studentName: studentName,
          classId: classId,
          bookTitle: bookTitle,
          audioData: currentAudioDataUrl,
          durationSec: recordSeconds,
          note: 'فائدة صوتية ملهمة'
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('رائع جداً! تم حفظ وإرسال كبسولتك الصوتية بنجاح 🎙️✨');
        resetRecorder();
        loadCapsules();
      }
    } catch (e) {
      alert('حدث خطأ أثناء إرسال الكبسولة، حاول مجدداً.');
    }
  }

  // تحميل الكبسولات الصوتية
  async function loadCapsules() {
    const list = document.getElementById('ibdaCapsulesList');
    if (!list) return;
    try {
      const res = await fetch('/api/ibda/capsules');
      const data = await res.json();
      if (!data.success || !data.capsules || data.capsules.length === 0) {
        list.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:#94a3b8; padding:2rem;">لا توجد كبسولات صوتية مسجلة بعد. كن أول المبادرين! 🎙️</div>';
        return;
      }
      list.innerHTML = data.capsules.map(c => `
        <div class="capsule-item">
          <div class="capsule-meta">
            <span>👤 ${escapeHtml(c.student_name)}</span>
            <span>⏱️ ${c.duration_sec || 0} ثانية</span>
          </div>
          <div class="capsule-title">📖 ${escapeHtml(c.book_title || 'ورد اليوم')}</div>
          <audio controls src="${c.audio_data}" style="width:100%; height:36px; margin-top:0.4rem;"></audio>
        </div>
      `).join('');
    } catch (e) {
      console.warn('loadCapsules error:', e);
    }
  }

  // --- صحيفة الأسبوع الحائطية السلسة ---
  const THEME_STYLES = {
    gold: {
      primary: '#b45309',
      primaryDark: '#78350f',
      accentBg: '#fffbeb',
      accentBorder: '#fde68a',
      bannerBg: 'linear-gradient(135deg, #fef3c7, #fef08a)',
      titleColor: '#78350f'
    },
    emerald: {
      primary: '#15803d',
      primaryDark: '#14532d',
      accentBg: '#f0fdf4',
      accentBorder: '#bbf7d0',
      bannerBg: 'linear-gradient(135deg, #dcfce7, #bbf7d0)',
      titleColor: '#14532d'
    },
    sapphire: {
      primary: '#1d4ed8',
      primaryDark: '#1e3a8a',
      accentBg: '#eff6ff',
      accentBorder: '#bfdbfe',
      bannerBg: 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
      titleColor: '#1e3a8a'
    },
    parchment: {
      primary: '#854d0e',
      primaryDark: '#543109',
      accentBg: '#faf8f2',
      accentBorder: '#e6ded1',
      bannerBg: 'linear-gradient(135deg, #f7f3ea, #ede5d8)',
      titleColor: '#543109'
    },
    midnight: {
      primary: '#4338ca',
      primaryDark: '#312e81',
      accentBg: '#eef2ff',
      accentBorder: '#c7d2fe',
      bannerBg: 'linear-gradient(135deg, #e0e7ff, #c7d2fe)',
      titleColor: '#312e81'
    }
  };

  function setMagazineTheme(themeKey) {
    if (THEME_STYLES[themeKey]) {
      magazineState.theme = themeKey;
      generateMagazine();
    }
  }

  function setMagazineFontSize(sizeKey) {
    magazineState.fontSize = sizeKey;
    const sheet = document.querySelector('.magazine-sheet');
    if (!sheet) return;
    if (sizeKey === 'small') sheet.style.fontSize = '13px';
    else if (sizeKey === 'large') sheet.style.fontSize = '16px';
    else sheet.style.fontSize = '14.5px';
  }

  function toggleQuickEditor() {
    const drawer = document.getElementById('ibdaMagazineQuickDrawer');
    if (!drawer) return;
    drawer.style.display = drawer.style.display === 'none' ? 'block' : 'none';
  }

  function applyQuickEditorData() {
    const t = document.getElementById('mqeTitle');
    const s = document.getElementById('mqeSubtitle');
    const kn = document.getElementById('mqeKnightName');
    const ka = document.getElementById('mqeKnightAch');
    const ht = document.getElementById('mqeHadithTitle');
    const hx = document.getElementById('mqeHadithText');
    const ft = document.getElementById('mqeFooter');

    if (t) magazineState.title = t.value.trim() || magazineState.title;
    if (s) magazineState.subtitle = s.value.trim() || magazineState.subtitle;
    if (kn) magazineState.knightName = kn.value.trim() || magazineState.knightName;
    if (ka) magazineState.knightAchievement = ka.value.trim() || magazineState.knightAchievement;
    if (ht) magazineState.hadithTitle = ht.value.trim() || magazineState.hadithTitle;
    if (hx) magazineState.hadithText = hx.value.trim() || magazineState.hadithText;
    if (ft) magazineState.footerText = ft.value.trim() || magazineState.footerText;

    generateMagazine();
    toggleQuickEditor();
  }

  async function generateMagazine() {
    const container = document.getElementById('ibdaMagazinePreviewArea');
    if (!container) return;

    let topGems = [];
    try {
      const res = await fetch('/api/ibda/gems');
      const data = await res.json();
      if (data.success && data.gems && data.gems.length > 0) {
        topGems = data.gems.slice(0, 3);
      }
    } catch (e) {}

    const todayDate = new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
    const theme = THEME_STYLES[magazineState.theme] || THEME_STYLES.gold;

    container.innerHTML = `
      <!-- شريط أدوات التصميم والتعديل السهل -->
      <div class="no-print" style="margin-bottom:1.5rem; background:rgba(15,23,42,0.75); border:1px solid rgba(255,255,255,0.12); padding:1rem 1.25rem; border-radius:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
          <div style="display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap;">
            <span style="font-size:0.85rem; font-weight:700; color:#cbd5e1;">🎨 مظهر الصحيفة:</span>
            <button type="button" class="theme-pill ${magazineState.theme === 'gold' ? 'active' : ''}" onclick="IbdaHub.setMagazineTheme('gold')" style="background:#b45309; color:#fff; border:none; padding:4px 10px; border-radius:20px; font-size:0.8rem; cursor:pointer;">ذهب ملكي</button>
            <button type="button" class="theme-pill ${magazineState.theme === 'emerald' ? 'active' : ''}" onclick="IbdaHub.setMagazineTheme('emerald')" style="background:#15803d; color:#fff; border:none; padding:4px 10px; border-radius:20px; font-size:0.8rem; cursor:pointer;">زمرد ربيعي</button>
            <button type="button" class="theme-pill ${magazineState.theme === 'sapphire' ? 'active' : ''}" onclick="IbdaHub.setMagazineTheme('sapphire')" style="background:#1d4ed8; color:#fff; border:none; padding:4px 10px; border-radius:20px; font-size:0.8rem; cursor:pointer;">أزرق ياقوتي</button>
            <button type="button" class="theme-pill ${magazineState.theme === 'parchment' ? 'active' : ''}" onclick="IbdaHub.setMagazineTheme('parchment')" style="background:#854d0e; color:#fff; border:none; padding:4px 10px; border-radius:20px; font-size:0.8rem; cursor:pointer;">تراثي كلاسيكي</button>
            <button type="button" class="theme-pill ${magazineState.theme === 'midnight' ? 'active' : ''}" onclick="IbdaHub.setMagazineTheme('midnight')" style="background:#4338ca; color:#fff; border:none; padding:4px 10px; border-radius:20px; font-size:0.8rem; cursor:pointer;">كحلي فاخر</button>
          </div>

          <div style="display:flex; gap:0.5rem; align-items:center;">
            <button type="button" class="ibda-btn-secondary" onclick="IbdaHub.toggleQuickEditor()" style="padding:6px 14px; font-size:0.85rem;">
              ✏️ تعديل محتوى الصحيفة
            </button>
            <button type="button" class="ibda-btn-action" onclick="window.print()" style="padding:6px 16px; font-size:0.85rem;">
              🖨️ طباعة / PDF
            </button>
          </div>
        </div>

        <div style="margin-top:0.6rem; font-size:0.8rem; color:#94a3b8; display:flex; align-items:center; gap:0.4rem;">
          <span>💡</span> <span>ملاحظة: يمكنك النقر مباشرة على أي نص داخل الصحيفة لتعديله قبل الطباعة فوراً!</span>
        </div>

        <!-- لوحة التحرير السريع المنبثقة -->
        <div id="ibdaMagazineQuickDrawer" style="display:none; margin-top:1rem; padding:1.25rem; background:rgba(0,0,0,0.5); border-radius:12px; border:1px solid rgba(255,255,255,0.15);">
          <div style="font-weight:700; color:#fff; margin-bottom:0.75rem; font-size:1rem;">📝 لوحة التحرير السريع لنصوص الصحيفة:</div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-bottom:0.75rem;">
            <div>
              <label style="font-size:0.78rem; color:#cbd5e1;">عنوان الصحيفة:</label>
              <input type="text" id="mqeTitle" value="${escapeHtml(magazineState.title)}" class="form-control" style="width:100%; padding:5px 8px; font-size:0.85rem; border-radius:6px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.2); color:#fff;">
            </div>
            <div>
              <label style="font-size:0.78rem; color:#cbd5e1;">الترويسة العلوية:</label>
              <input type="text" id="mqeSubtitle" value="${escapeHtml(magazineState.subtitle)}" class="form-control" style="width:100%; padding:5px 8px; font-size:0.85rem; border-radius:6px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.2); color:#fff;">
            </div>
            <div>
              <label style="font-size:0.78rem; color:#cbd5e1;">فارس القراءة (الاسم):</label>
              <input type="text" id="mqeKnightName" value="${escapeHtml(magazineState.knightName)}" class="form-control" style="width:100%; padding:5px 8px; font-size:0.85rem; border-radius:6px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.2); color:#fff;">
            </div>
            <div>
              <label style="font-size:0.78rem; color:#cbd5e1;">إنجاز الفارس:</label>
              <input type="text" id="mqeKnightAch" value="${escapeHtml(magazineState.knightAchievement)}" class="form-control" style="width:100%; padding:5px 8px; font-size:0.85rem; border-radius:6px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.2); color:#fff;">
            </div>
            <div>
              <label style="font-size:0.78rem; color:#cbd5e1;">عنوان الفائدة/الحديث:</label>
              <input type="text" id="mqeHadithTitle" value="${escapeHtml(magazineState.hadithTitle)}" class="form-control" style="width:100%; padding:5px 8px; font-size:0.85rem; border-radius:6px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.2); color:#fff;">
            </div>
            <div>
              <label style="font-size:0.78rem; color:#cbd5e1;">نص الحديث أو الحكمة:</label>
              <input type="text" id="mqeHadithText" value="${escapeHtml(magazineState.hadithText)}" class="form-control" style="width:100%; padding:5px 8px; font-size:0.85rem; border-radius:6px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.2); color:#fff;">
            </div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
            <button type="button" class="btn btn-secondary" onclick="IbdaHub.toggleQuickEditor()" style="padding:4px 12px; font-size:0.82rem;">إلغاء</button>
            <button type="button" class="ibda-btn-action" onclick="IbdaHub.applyQuickEditorData()" style="padding:4px 16px; font-size:0.82rem;">تطبيق التغييرات فوراً ✨</button>
          </div>
        </div>
      </div>

      <!-- صحيفة الأسبوع القابلة للطباعة والتعديل المباشر -->
      <div class="magazine-sheet printable-area" style="background:#ffffff; color:#0f172a; border: 4px double ${theme.primary}; border-radius: 12px; padding: 2.2rem; box-shadow: 0 10px 30px rgba(0,0,0,0.15); max-width: 860px; margin: 0 auto; direction: rtl; position:relative; font-family: inherit;">
        
        <!-- رأس الصحيفة -->
        <div class="magazine-header" style="text-align:center; border-bottom: 2px solid ${theme.primary}; padding-bottom: 1.25rem; margin-bottom: 1.5rem; background: ${theme.bannerBg}; padding: 1.5rem 1rem; border-radius: 8px;">
          <div contenteditable="true" style="font-size:1rem; color:${theme.primary}; font-weight:800; margin-bottom:4px; outline:none;" title="انقر لتعديل الترويسة">
            ${escapeHtml(magazineState.subtitle)}
          </div>
          <h1 contenteditable="true" style="font-size:2.2rem; font-weight:900; margin:0.3rem 0; color:${theme.titleColor}; outline:none;" title="انقر لتعديل عنوان الصحيفة">
            ${escapeHtml(magazineState.title)}
          </h1>
          <div style="font-size:0.9rem; color:#475569; font-weight:600;">
            تاريخ الإصدار: ${todayDate} | نشرة القراءة والتدبر الأسبوعية
          </div>
        </div>

        <!-- شبكة الأعمدة -->
        <div class="magazine-grid" style="display:grid; grid-template-columns: 1fr 1.35fr; gap:1.5rem; margin-bottom:1.5rem;">
          
          <!-- العمود الأول: فارس الأسبوع -->
          <div class="magazine-block" style="border: 1px solid ${theme.accentBorder}; background: ${theme.accentBg}; border-radius: 10px; padding: 1.25rem; text-align: center;">
            <h3 contenteditable="true" style="font-size:1.15rem; font-weight:900; color:${theme.primaryDark}; margin-top:0; margin-bottom:0.75rem; border-bottom:1px solid ${theme.accentBorder}; padding-bottom:0.5rem; outline:none;">
              🌟 فارس القراءة للأسبوع
            </h3>
            <div style="padding:0.75rem 0;">
              <div style="font-size:3.5rem; line-height:1; margin-bottom:0.6rem;">👑</div>
              <div contenteditable="true" style="font-size:1.35rem; font-weight:900; color:${theme.titleColor}; outline:none;" title="انقر لتعديل اسم الفارس">
                ${escapeHtml(magazineState.knightName)}
              </div>
              <div contenteditable="true" style="font-size:0.95rem; color:#15803d; font-weight:800; margin-top:6px; outline:none;" title="انقر لتعديل الإنجاز">
                ${escapeHtml(magazineState.knightAchievement)}
              </div>
              <p contenteditable="true" style="font-size:0.85rem; color:#475569; margin-top:10px; line-height:1.5; outline:none;">
                «خير جليس في الزمان كتاب، وبوركت همة ملأت أوقاتها بطلب العلم والهدى وسير الصالحين»
              </p>
            </div>
          </div>

          <!-- العمود الثاني: درر الأسبوع المختارة -->
          <div class="magazine-block" style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 1.25rem; background: #fafafa;">
            <h3 contenteditable="true" style="font-size:1.15rem; font-weight:900; color:${theme.primaryDark}; margin-top:0; margin-bottom:0.75rem; border-bottom:1px solid #e2e8f0; padding-bottom:0.5rem; outline:none;">
              💎 أبهى درر الأسبوع المختارة
            </h3>
            ${topGems.length > 0 ? topGems.map(g => `
              <div style="margin-bottom:0.85rem; padding-bottom:0.65rem; border-bottom:1px dashed #cbd5e1;">
                <div contenteditable="true" style="font-size:0.92rem; font-weight:700; color:#1e293b; line-height:1.45; outline:none;">
                  «${escapeHtml(g.gem_text)}»
                </div>
                <div contenteditable="true" style="font-size:0.8rem; color:${theme.primary}; font-weight:700; margin-top:3px; outline:none;">
                  — ${escapeHtml(g.student_name)} (${escapeHtml(g.book_title || 'كتاب نافع')})
                </div>
              </div>
            `).join('') : `
              <div style="margin-bottom:0.85rem; padding-bottom:0.65rem; border-bottom:1px dashed #cbd5e1;">
                <div contenteditable="true" style="font-size:0.92rem; font-weight:700; color:#1e293b; line-height:1.45; outline:none;">
                  «العلم شجرة، والعمل ثمرتها، وليس يُعد عالماً من لم يكن بعلمه عاملاً»
                </div>
                <div contenteditable="true" style="font-size:0.8rem; color:${theme.primary}; font-weight:700; margin-top:3px; outline:none;">
                  — من درر السلف الصالح (جامع بيان العلم وفضله)
                </div>
              </div>
              <div style="margin-bottom:0.85rem; padding-bottom:0.65rem;">
                <div contenteditable="true" style="font-size:0.92rem; font-weight:700; color:#1e293b; line-height:1.45; outline:none;">
                  «من أمضى يوماً من عمره في غير حق قضاه أو فرض أداه أو علم اقتبسه فقد عقّ يومه»
                </div>
                <div contenteditable="true" style="font-size:0.8rem; color:${theme.primary}; font-weight:700; margin-top:3px; outline:none;">
                  — حكمة مختارة لرواد القراءة
                </div>
              </div>
            `}
          </div>
        </div>

        <!-- صندوق الحديث أو الحكمة -->
        <div style="background:${theme.accentBg}; border:1px solid ${theme.accentBorder}; border-radius:10px; padding:1.1rem; text-align:center; margin-bottom:1.5rem;">
          <div contenteditable="true" style="font-weight:900; color:${theme.primaryDark}; font-size:1.1rem; margin-bottom:4px; outline:none;">
            ${escapeHtml(magazineState.hadithTitle)}
          </div>
          <div contenteditable="true" style="font-size:0.98rem; color:#1e293b; font-style:italic; line-height:1.5; outline:none;">
            ${escapeHtml(magazineState.hadithText)}
          </div>
        </div>

        <!-- فوتر الصحيفة -->
        <div contenteditable="true" style="text-align:center; font-size:0.82rem; color:#64748b; border-top:1px solid #e2e8f0; padding-top:0.85rem; outline:none;">
          ${escapeHtml(magazineState.footerText)}
        </div>
      </div>
    `;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderIbdaFullHtml(userData = {}) {
    const isTeacher = userData.role === 'teacher' || userData.isTeacher;

    const teacherSettingHtml = isTeacher ? `
      <div style="background:rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.3); border-radius:12px; padding:1rem 1.25rem; margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
        <div>
          <div style="font-weight:800; font-size:0.98rem; color:#f59e0b; display:flex; align-items:center; gap:6px;">
            <span>⚙️ تحكم المعلم في كبسولة الفائدة:</span>
          </div>
          <div style="font-size:0.82rem; color:#cbd5e1; margin-top:2px;" id="ibdaVoiceSettingStatus">
            إلزام الطلاب بتسجيل صوتي للورد عند إرسال الإنجاز
          </div>
        </div>
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-weight:700; color:#fff; font-size:0.88rem;">
          <input type="checkbox" id="ibdaVoiceRequiredToggle" onchange="IbdaHub.toggleVoiceRequiredSetting(this.checked)" style="width:18px; height:18px; accent-color:#f59e0b;">
          <span>إلزامية مع إرسال الورد</span>
        </label>
      </div>
    ` : '';

    return `
      <div class="ibda-container">
        <!-- Banner -->
        <div class="ibda-hero-banner">
          <div class="ibda-hero-title-group">
            <h2><span class="sparkle">✨</span> واحة إبداع وتألق القراء</h2>
            <p>كبسولات الفائدة الصوتية، حائط درر القراءة، وصحيفة الأسبوع الحائطية السلسة</p>
          </div>
        </div>

        <!-- Sub Tabs Nav (3 Items Only) -->
        <div class="ibda-tabs-nav">
          <button type="button" class="ibda-tab-btn active" data-subtab="capsule" onclick="IbdaHub.switchIbdaTab('capsule')">
            <span>🎙️</span> <span>كبسولة الفائدة</span>
          </button>
          <button type="button" class="ibda-tab-btn" data-subtab="gems" onclick="IbdaHub.switchIbdaTab('gems')">
            <span>💎</span> <span>حائط الدرر</span>
          </button>
          <button type="button" class="ibda-tab-btn" data-subtab="magazine" onclick="IbdaHub.switchIbdaTab('magazine')">
            <span>📰</span> <span>صحيفة الأسبوع</span>
          </button>
        </div>

        <!-- 1. كبسولة الفائدة الصوتية -->
        <div class="ibda-section active" id="ibda-subtab-capsule">
          <div class="recorder-card">
            ${teacherSettingHtml}

            <h3 style="font-size:1.4rem; font-weight:900; color:#fff; margin-top:0;">🎙️ كبسولة الفائدة الصوتية السريعة</h3>
            <p style="color:#cbd5e1; font-size:0.92rem; max-width:600px; margin:0 auto 1.5rem auto;">
              تسجيل فوائد صوتية ملهمة (30 إلى 60 ثانية) من قراءات الكتب لتوثيق الفهم والاستماع إليها في أي وقت!
            </p>

            <div style="max-width:400px; margin:0 auto 1.5rem auto; text-align:right;">
              <label style="font-size:0.85rem; color:#cbd5e1; font-weight:700;">اسم الكتاب أو الموضوع:</label>
              <input type="text" id="ibdaCapsuleBook" class="form-control" placeholder="مثلاً: حلية طالب العلم، الأربعون النووية..." style="width:100%; padding:0.65rem 1rem; border-radius:10px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); color:#fff; margin-top:0.35rem;">
            </div>

            <div class="recorder-btn-wrap">
              <button type="button" class="btn-record-main" id="ibdaBtnRecord" onclick="IbdaHub.toggleRecording()">
                🎙️
              </button>
            </div>

            <div class="recorder-timer" id="ibdaRecordTimer">00:00</div>

            <div class="audio-waveform-bars" id="ibdaWaveform">
              <span></span><span></span><span></span><span></span><span></span><span></span>
            </div>

            <div id="ibdaAudioPreviewWrap" style="display:none; max-width:450px; margin:0 auto;"></div>

            <div style="margin-top:2.5rem; text-align:right;">
              <h4 style="color:#f8fafc; font-size:1.1rem; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:0.5rem;">
                🎧 كبسولات صوتية مسجلة من الطلاب:
              </h4>
              <div class="capsules-list" id="ibdaCapsulesList">
                <div style="grid-column:1/-1; text-align:center; color:#94a3b8; padding:1.5rem;">جاري تحميل الكبسولات...</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. حائط الدرر -->
        <div class="ibda-section" id="ibda-subtab-gems">
          <div class="ibda-card">
            <h3 style="font-size:1.4rem; font-weight:900; color:#fff; margin-top:0;">💎 حائط درر القراءة والفوائد</h3>
            <p style="color:#cbd5e1; font-size:0.92rem; margin-bottom:1.5rem;">
              الفوائد والاقتباسات المسطرة من قراءات الطلاب مع إمكانية التفاعل بالدرر والإعجاب!
            </p>

            <form onsubmit="IbdaHub.submitGem(event)" style="background:rgba(15,23,42,0.6); padding:1.25rem; border-radius:14px; border:1px solid rgba(245,158,11,0.2); margin-bottom:2rem;">
              <div style="display:grid; grid-template-columns:1fr 2fr; gap:0.75rem; margin-bottom:0.75rem;">
                <input type="text" id="ibdaGemBook" placeholder="اسم الكتاب..." style="padding:0.65rem 1rem; border-radius:10px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); color:#fff;">
                <input type="text" id="ibdaGemInput" placeholder="اكتب الفائدة أو الدرة التي استوقفتك..." style="padding:0.65rem 1rem; border-radius:10px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); color:#fff;" required>
              </div>
              <button type="submit" class="ibda-btn-action" style="width:100%; justify-content:center;">
                <span>نشر الدرة في الحائط</span> 💎
              </button>
            </form>

            <div class="gems-wall-grid" id="ibdaGemsGrid">
              <div style="grid-column:1/-1; text-align:center; color:#94a3b8; padding:2rem;">جاري تحميل الدرر...</div>
            </div>
          </div>
        </div>

        <!-- 3. صحيفة إبداع الأسبوعية -->
        <div class="ibda-section" id="ibda-subtab-magazine">
          <div class="ibda-card">
            <h3 style="font-size:1.4rem; font-weight:900; color:#fff; margin-top:0;">📰 صحيفة إبداع الأسبوعية (نشرة الحلقات الحائطية)</h3>
            <p style="color:#cbd5e1; font-size:0.92rem; margin-bottom:1.5rem;">
              نشرة حائطية أنيقة قابلة للطباعة والتصدير كـ PDF، مع إمكانية تعديل الألوان والنصوص بنقرة واحدة!
            </p>

            <div id="ibdaMagazinePreviewArea">
              <!-- Magazine preview will appear here -->
            </div>
          </div>
        </div>

      </div>
    `;
  }

  function init(containerId, options = {}) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = renderIbdaFullHtml(options);
    loadCapsules();
    checkVoiceSetting();
  }

  return {
    init,
    renderIbdaFullHtml,
    switchIbdaTab,
    loadGems,
    submitGem,
    reactGem,
    toggleRecording,
    resetRecorder,
    sendCapsule,
    loadCapsules,
    generateMagazine,
    setMagazineTheme,
    setMagazineFontSize,
    toggleQuickEditor,
    applyQuickEditorData,
    checkVoiceSetting,
    toggleVoiceRequiredSetting
  };
})();
