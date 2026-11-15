/**
 * منظومة إبداع | IBDA CREATIVE HUB JAVASCRIPT
 * وحدة تفاعلية متكاملة لواحة القارئ، كبسولة الصوت، خريطة العلماء، حائط الدرر، سباق المسجد، وملصقات QR
 */

window.IbdaHub = (function () {
  let mediaRecorder = null;
  let audioChunks = [];
  let recordTimerInterval = null;
  let recordSeconds = 0;
  let currentAudioBlob = null;
  let currentAudioDataUrl = null;

  // المحطات التاريخية لخريطة طريق العلماء
  const SCHOLARS_STATIONS = [
    {
      id: 1,
      name: "مكة المكرمة",
      landmark: "دار الأرقم — انطلاقة نور النبوة",
      pagesRequired: 0,
      icon: "🕋",
      desc: "هنا حيث أشرقت شمس الرسالة وبدأت أول آية: {اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ}. كل صفحة تقرؤها امتداد لتلك البداية العظيمة.",
      scholar: "عبدالله بن مسعود أول من جهر بالقرآن عند الكعبة بمكة المكرمة.",
      badge: "وسام البداية المباركة 🌟"
    },
    {
      id: 2,
      name: "المدينة المنورة",
      landmark: "المسجد النبوي — روضة العلم والموطأ",
      pagesRequired: 30,
      icon: "🕌",
      desc: "مدينة رسول الله ﷺ، حيث كُتبت صحائف الوحي، وجلس الإمام مالك يروي موطأه عند قبر المصطفى ﷺ وهو يقول: لن يصلح آخر هذه الأمة إلا بما صلح به أولها.",
      scholar: "الإمام مالك بن أنس — إمام دار الهجرة ومؤلف الموطأ.",
      badge: "وسام فارس طيبة 🌿"
    },
    {
      id: 3,
      name: "الكوفة",
      landmark: "محراب القرآن ورواية الترتيل",
      pagesRequired: 80,
      icon: "📜",
      desc: "مهبط كبار قراء الأمة؛ منها انتشرت قراءة عاصم برواية حفص التي يتلو بها العالم الإسلامي اليوم.",
      scholar: "الإمام عاصم بن أبي النجود وتلميذه حفص بن سليمان الكوفي.",
      badge: "وسام راوي الترتيل 📖"
    },
    {
      id: 4,
      name: "بغداد",
      landmark: "دار السلام — بيت الحكمة ومكتبات المجد",
      pagesRequired: 160,
      icon: "🏛️",
      desc: "عاصمة العلم الكبرى ومجمع العلماء؛ دار الحكمة التي ترجمت فيها العلوم وألفت فيها أمهات كتب الفقه واللغة والتفسير.",
      scholar: "الإمام أحمد بن حنبل صابر المحنة وإمام أهل السنة.",
      badge: "وسام حكيم المعرفة 👑"
    },
    {
      id: 5,
      name: "دمشق",
      landmark: "جامع بني أمية — منارة الحديث النبوي",
      pagesRequired: 260,
      icon: "🌸",
      desc: "شام العلم والبركة؛ شهدت أروقة الجامع الأموي مجالس دار الحديث الأشرفية وتصنيف أعظم شروح الحديث.",
      scholar: "الإمام يحيى بن شرف النووي — صاحب رياض الصالحين والأربعين النووية.",
      badge: "وسام محدّث الشام 💎"
    },
    {
      id: 6,
      name: "قرطبة",
      landmark: "منارة الأندلس — خزانة الحكم ودرة المغرب",
      pagesRequired: 400,
      icon: "🏰",
      desc: "مدينة النور التي أضاءت ظلمات القرون الوسطى بمكتبتها الكبرى وجامعها الفريد، وشهدت نهضة علمية لا نظير لها.",
      scholar: "الإمام ابن حزم الأندلسي وشمس الدين القرطبي صاحب التفسير الجامع.",
      badge: "وسام شمس الأندلس 🏆"
    }
  ];

  // توليد شجرة النخلة SVG حسب عدد الصفحات
  function generateOasisTreeSvg(totalPages) {
    let stage = 1;
    let height = 120;
    let trunkColor = "#854d0e";
    let datesHtml = "";

    if (totalPages >= 300) {
      stage = 5;
      height = 200;
      trunkColor = "#713f12";
      datesHtml = `
        <circle cx="85" cy="85" r="7" fill="#f59e0b" filter="drop-shadow(0 0 4px #fbbf24)"/>
        <circle cx="95" cy="90" r="7" fill="#d97706" />
        <circle cx="105" cy="85" r="7" fill="#f59e0b" />
        <circle cx="95" cy="100" r="8" fill="#b45309" filter="drop-shadow(0 0 6px #f59e0b)"/>
      `;
    } else if (totalPages >= 150) {
      stage = 4;
      height = 180;
      datesHtml = `
        <circle cx="90" cy="90" r="6" fill="#f59e0b" />
        <circle cx="100" cy="95" r="6" fill="#d97706" />
      `;
    } else if (totalPages >= 70) {
      stage = 3;
      height = 150;
    } else if (totalPages >= 25) {
      stage = 2;
      height = 120;
    } else {
      stage = 1;
      height = 90;
    }

    return `
      <svg class="oasis-tree-svg" width="190" height="${height}" viewBox="0 0 190 ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Trunk -->
        <path d="M95 ${height} C92 ${height*0.7} 90 ${height*0.4} 95 70 C98 70 102 70 95 70" stroke="${trunkColor}" stroke-width="${12 + stage*2}" stroke-linecap="round"/>
        <!-- Fronds (سعف النخل) -->
        <path d="M95 70 Q60 50 20 85" stroke="#16a34a" stroke-width="7" stroke-linecap="round" fill="none"/>
        <path d="M95 70 Q70 30 35 35" stroke="#22c55e" stroke-width="6" stroke-linecap="round" fill="none"/>
        <path d="M95 70 Q95 10 95 5" stroke="#4ade80" stroke-width="6" stroke-linecap="round" fill="none"/>
        <path d="M95 70 Q120 30 155 35" stroke="#22c55e" stroke-width="6" stroke-linecap="round" fill="none"/>
        <path d="M95 70 Q130 50 170 85" stroke="#16a34a" stroke-width="7" stroke-linecap="round" fill="none"/>
        ${datesHtml}
      </svg>
    `;
  }

  // حساب مرحلة الواحة
  function getOasisStageInfo(totalPages) {
    if (totalPages >= 300) return { title: "واحة الفرسان الكبرى 👑", desc: "نخلة يانعة مثمرة بقنوان الرطب الذهبي!", stage: 5 };
    if (totalPages >= 150) return { title: "نخلة باسقة ومثمرة 🌴✨", desc: "أثمرت قراءتك رطباً جنياً يبهج القلب!", stage: 4 };
    if (totalPages >= 70) return { title: "فسيلة نخل يافعة 🌴", desc: "اشتد ساق النخلة وعلا سعفها نحو النور!", stage: 3 };
    if (totalPages >= 25) return { title: "شتلة خضراء فتية 🌿", desc: "نبتت غرسة القراءة وبدأت تخضر أوراقها!", stage: 2 };
    return { title: "بذرة الغرس الأولى 🌱", desc: "بداية الرحلة في غرس حب القراءة والمعرفة!", stage: 1 };
  }

  // تبديل تبويبات قسم إبداع
  function switchIbdaTab(tabName) {
    document.querySelectorAll('.ibda-tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.subtab === tabName);
    });
    document.querySelectorAll('.ibda-section').forEach(s => {
      s.classList.toggle('active', s.id === `ibda-subtab-${tabName}`);
    });

    if (tabName === 'race') loadRaceData();
    if (tabName === 'gems') loadGems();
    if (tabName === 'capsules') loadCapsules();
  }

  // تحميل درر القراءة
  async function loadGems() {
    const grid = document.getElementById('ibdaGemsGrid');
    if (!grid) return;
    try {
      const res = await fetch('/api/ibda/gems');
      const data = await res.json();
      if (!data.success || !data.gems || data.gems.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; color:#94a3b8; padding:2rem;">كن أول من يشارك درّة وفائدة قرأها اليوم! 💎</div>';
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
              <button class="btn-react" onclick="IbdaHub.reactGem(${g.id}, 'like', this)">
                ❤️ <span class="react-cnt">${g.likes_count || 0}</span>
              </button>
              <button class="btn-react" onclick="IbdaHub.reactGem(${g.id}, 'gem', this)">
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

    const studentName = currentStudent?.name || (window.currentStudent?.name) || 'طالب متميز';
    const studentId = currentStudent?.id || (window.currentStudent?.id) || null;
    const classId = currentStudent?.classId || currentStudent?.class_id || (window.currentStudent?.class_id) || null;

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
      // بدء التسجيل
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
                      <span>إرسال الكبسولة للمعلم</span> 🚀
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
          if (recordSeconds >= 60) toggleRecording(student);
        }, 1000);

      } catch (err) {
        alert('يرجى السماح بالوصول إلى الميكروفون لتسجيل الكبسولة الصوتية.');
      }
    } else if (mediaRecorder.state === 'recording') {
      // إيقاف التسجيل
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
    const student = currentStudent || window.currentStudent || {};

    try {
      const res = await fetch('/api/ibda/capsules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.id || null,
          studentName: student.name || 'طالب متميز',
          classId: student.classId || student.class_id || null,
          bookTitle: bookTitle,
          audioData: currentAudioDataUrl,
          durationSec: recordSeconds,
          note: 'فائدة صوتية ملهمة'
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('رائع جداً! تم تسليم كبسولتك الصوتية لمعلمك بنجاح 🎙️✨');
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

  // تحميل بيانات السباق الحي للمسجد
  async function loadRaceData() {
    const container = document.getElementById('ibdaRaceLanesContainer');
    if (!container) return;
    try {
      const res = await fetch('/api/ibda/race-data');
      const data = await res.json();
      if (!data.success || !data.racers || data.racers.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:2rem;">جاري تهيئة مضمار السباق...</div>';
        return;
      }

      container.innerHTML = data.racers.map((r, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '🏇';
        return `
          <div class="race-lane" style="border-right: 4px solid ${r.color};">
            <div class="race-lane-info">
              <div class="race-lane-name">
                <span>${medal}</span>
                <span>${escapeHtml(r.name)}</span>
                <span style="font-size:0.8rem; color:#94a3b8;">(${r.studentsCount} طالب)</span>
              </div>
              <div class="race-lane-score">
                <span>${r.totalScore} نقطة تميز</span>
                <span style="font-size:0.8rem; color:#10b981; margin-right:8px;">(${r.readingPages} ص)</span>
              </div>
            </div>
            <div class="race-track-bar">
              <div class="race-track-progress" style="width: ${Math.max(8, r.progressPercent)}%; background: ${r.color};">
                <span class="race-horse-marker">${r.icon || '🏇'}</span>
              </div>
            </div>
          </div>
        `;
      }).join('');
    } catch (e) {
      console.warn('loadRaceData error:', e);
    }
  }

  // مولّد كود QR للكتب
  function generateBookQr() {
    const input = document.getElementById('ibdaBookQrInput');
    const title = input ? input.value.trim() : 'كتاب في مكتبة المسجد';
    const preview = document.getElementById('ibdaQrPreviewArea');
    if (!preview) return;

    const baseIqraUrl = window.location.origin.includes('ya2') ? window.location.origin : 'https://ya2-live.vercel.app';
    const targetUrl = `${baseIqraUrl}/#book=${encodeURIComponent(title)}`;
    const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(targetUrl)}&color=0f172a&bgcolor=ffffff`;

    preview.innerHTML = `
      <div class="qr-preview-card printable-area">
        <div style="font-size:0.75rem; color:#64748b; font-weight:700;">🕌 مجمع الحلقات القرآنية</div>
        <div class="qr-preview-title">${escapeHtml(title)}</div>
        <img src="${qrImgUrl}" alt="QR" class="qr-code-img">
        <div class="qr-preview-badge">امسح لتسجيل وردك فوراً 📲</div>
        <div style="font-size:0.7rem; color:#94a3b8; margin-top:0.35rem;">منصة اقرأ | متابعة القراءة اليومية</div>
      </div>
      <div class="no-print" style="margin-top:1rem; text-align:center;">
        <button type="button" class="ibda-btn-action" onclick="window.print()">
          <span>طباعة الملصق الآن</span> 🖨️
        </button>
      </div>
    `;
  }

  // توليد مجلة إبداع الأسبوعية
  async function generateMagazine() {
    const container = document.getElementById('ibdaMagazinePreviewArea');
    if (!container) return;

    let topGems = [];
    try {
      const res = await fetch('/api/ibda/gems');
      const data = await res.json();
      if (data.success && data.gems) topGems = data.gems.slice(0, 3);
    } catch (e) {}

    const todayDate = new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });

    container.innerHTML = `
      <div class="magazine-sheet printable-area">
        <div class="magazine-header">
          <div style="font-size:0.95rem; color:#b45309; font-weight:700; margin-bottom:4px;">مجمع الحلقات القرآنية — منبر التميز والعطاء</div>
          <h1>صحيفة إبداع الأسبوعية 📰</h1>
          <div style="font-size:0.88rem; color:#64748b;">تاريخ الإصدار: ${todayDate} | مجلة القراءة والتدبر</div>
        </div>

        <div class="magazine-grid">
          <div class="magazine-block">
            <h3>🌟 فارس القراءة للأسبوع</h3>
            <div style="text-align:center; padding:1rem 0;">
              <div style="font-size:3rem; margin-bottom:0.5rem;">👑</div>
              <div style="font-size:1.35rem; font-weight:900; color:#1e3a8a;">طالب متميز من حلقة القرآن</div>
              <div style="font-size:0.95rem; color:#15803d; font-weight:700; margin-top:4px;">أتم أكثر من 120 صفحة في ورده الأسبوعي</div>
              <p style="font-size:0.85rem; color:#64748b; margin-top:8px;">«خير جليس في الزمان كتاب، وبوركت همة ملأت أوقاتها بطلب العلم والهدى»</p>
            </div>
          </div>

          <div class="magazine-block">
            <h3>💎 أبهى درر الأسبوع المختارة</h3>
            ${topGems.length > 0 ? topGems.map(g => `
              <div style="margin-bottom:0.85rem; padding-bottom:0.65rem; border-bottom:1px dashed #e2e8f0;">
                <div style="font-size:0.95rem; font-weight:700; color:#1e293b;">«${escapeHtml(g.gem_text)}»</div>
                <div style="font-size:0.78rem; color:#92400e; margin-top:2px;">— ${escapeHtml(g.student_name)} (${escapeHtml(g.book_title || 'كتاب نافع')})</div>
              </div>
            `).join('') : '<p style="font-size:0.88rem; color:#94a3b8;">درر ملهمة يخطها طلابنا كل يوم بمداد الفهم والتدبر.</p>'}
          </div>
        </div>

        <div style="margin-top:1.5rem; background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:1rem; text-align:center;">
          <div style="font-weight:800; color:#b45309; font-size:1.05rem; margin-bottom:4px;">حديث الأسبوع 🌸</div>
          <div style="font-size:0.95rem; color:#451a03; font-style:italic;">«من سلك طريقاً يلتمس فيه علماً سهّل الله له به طريقاً إلى الجنة» [رواه مسلم]</div>
        </div>

        <div style="margin-top:1.25rem; text-align:center; font-size:0.8rem; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:0.75rem;">
          صدرت عن مجمع الحلقات ومنصة اقرأ | تصميم وإخراج آلي عبر منظومة إبداع
        </div>
      </div>

      <div class="no-print" style="margin-top:1.5rem; text-align:center;">
        <button type="button" class="ibda-btn-action" onclick="window.print()">
          <span>طباعة المجلة / حفظ PDF</span> 🖨️
        </button>
      </div>
    `;
  }

  // فتح نافذة تفاصيل محطة في خريطة العلماء
  function openStationModal(stationId) {
    const s = SCHOLARS_STATIONS.find(x => x.id === stationId);
    if (!s) return;
    alert(`🗺️ [${s.name} — ${s.landmark}]\n\n📖 الأثر التاريخي:\n${s.desc}\n\n🌟 من أعلامها:\n${s.scholar}\n\n🎖️ الشارة: ${s.badge}`);
  }

  // تفاعل سقيا الواحة
  function waterOasis() {
    const box = document.getElementById('oasisWaterSplash');
    if (box) {
      box.style.display = 'block';
      box.innerHTML = '💧💦🌿 ما شاء الله! سُقيت الواحة واخضوضرت أغصانها!';
      setTimeout(() => box.style.display = 'none', 3000);
    }
  }

  // جني الرطب
  function harvestDates() {
    const box = document.getElementById('oasisWaterSplash');
    if (box) {
      box.style.display = 'block';
      box.innerHTML = '🍯✨ هنيئاً لك! جنيت رطباً جنياً من ثمار قراءتك ومثابرتك!';
      setTimeout(() => box.style.display = 'none', 3000);
    }
  }

  // مساعدة لتفادي XSS
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // توليد HTML الكامل لواجهة إبداع
  function renderIbdaFullHtml(studentData = {}) {
    const totalPages = parseInt(studentData.totalPages || studentData.pages || 0, 10);
    const oasisInfo = getOasisStageInfo(totalPages);
    const treeSvg = generateOasisTreeSvg(totalPages);

    return `
      <div class="ibda-container">
        <!-- Banner -->
        <div class="ibda-hero-banner">
          <div class="ibda-hero-title-group">
            <h2><span class="sparkle">✨</span> واحة إبداع وتألق القراء</h2>
            <p>تجارب استثنائية، محطات تاريخية، درر مسطرة، وسباقات حماسية تليق بأهل القرآن</p>
          </div>
          <div class="ibda-hero-actions">
            <a href="race.html" target="_blank" class="ibda-btn-action">
              <span>شاشة سباق المسجد المباشر</span> 🏁
            </a>
          </div>
        </div>

        <!-- Sub Tabs Nav -->
        <div class="ibda-tabs-nav">
          <button type="button" class="ibda-tab-btn active" data-subtab="oasis" onclick="IbdaHub.switchIbdaTab('oasis')">
            <span>🌴</span> <span>واحة القارئ</span>
          </button>
          <button type="button" class="ibda-tab-btn" data-subtab="capsule" onclick="IbdaHub.switchIbdaTab('capsule')">
            <span>🎙️</span> <span>كبسولة الفائدة</span>
          </button>
          <button type="button" class="ibda-tab-btn" data-subtab="map" onclick="IbdaHub.switchIbdaTab('map')">
            <span>🗺️</span> <span>طريق العلماء</span>
          </button>
          <button type="button" class="ibda-tab-btn" data-subtab="gems" onclick="IbdaHub.switchIbdaTab('gems')">
            <span>💎</span> <span>حائط الدرر</span>
          </button>
          <button type="button" class="ibda-tab-btn" data-subtab="race" onclick="IbdaHub.switchIbdaTab('race')">
            <span>🏇</span> <span>سباق الحلقات</span>
          </button>
          <button type="button" class="ibda-tab-btn" data-subtab="qr" onclick="IbdaHub.switchIbdaTab('qr')">
            <span>🖨️</span> <span>ملصقات QR للكتب</span>
          </button>
          <button type="button" class="ibda-tab-btn" data-subtab="magazine" onclick="IbdaHub.switchIbdaTab('magazine')">
            <span>📰</span> <span>صحيفة الأسبوع</span>
          </button>
        </div>

        <!-- 1. واحة القارئ -->
        <div class="ibda-section active" id="ibda-subtab-oasis">
          <div class="oasis-stage-card">
            <div class="oasis-sky-stars"></div>
            <div style="font-size:1.35rem; font-weight:900; color:#fbbf24; margin-bottom:0.25rem;">
              ${oasisInfo.title}
            </div>
            <div style="font-size:0.92rem; color:#cbd5e1; margin-bottom:1.5rem;">
              ${oasisInfo.desc}
            </div>

            <div class="oasis-visual-wrap">
              ${treeSvg}
              <div class="oasis-ground"></div>
            </div>

            <div id="oasisWaterSplash" style="display:none; font-size:1.1rem; font-weight:800; color:#38bdf8; margin:1rem 0;" class="water-splash-anim"></div>

            <div class="oasis-stats-row">
              <div class="oasis-stat-box">
                <div class="icon">📄</div>
                <div>
                  <div class="val">${totalPages}</div>
                  <div class="lbl">صفحة مروية</div>
                </div>
              </div>
              <div class="oasis-stat-box">
                <div class="icon">🍯</div>
                <div>
                  <div class="val">${Math.floor(totalPages / 15)}</div>
                  <div class="lbl">رطبة ذهبية مجنية</div>
                </div>
              </div>
              <div class="oasis-stat-box">
                <div class="icon">⭐</div>
                <div>
                  <div class="val">المستوى ${oasisInfo.stage}</div>
                  <div class="lbl">رتبة الواحة</div>
                </div>
              </div>
            </div>

            <div class="oasis-interact-bar">
              <button type="button" class="ibda-btn-action" onclick="IbdaHub.waterOasis()">
                <span>سقيا الواحة</span> 💧
              </button>
              <button type="button" class="ibda-btn-secondary" onclick="IbdaHub.harvestDates()">
                <span>جني الرطب الذهبي</span> 🍯
              </button>
            </div>
          </div>
        </div>

        <!-- 2. كبسولة الفائدة الصوتية -->
        <div class="ibda-section" id="ibda-subtab-capsule">
          <div class="recorder-card">
            <h3 style="font-size:1.4rem; font-weight:900; color:#fff; margin-top:0;">🎙️ كبسولة الفائدة الصوتية السريعة</h3>
            <p style="color:#cbd5e1; font-size:0.92rem; max-width:600px; margin:0 auto 1.5rem auto;">
              سجّل فائدة صوتية ملهمة (30 إلى 60 ثانية) من قراءتك اليومية لتوثيق فهمك وتصل لمعلمك وزملائك بضغطة زر!
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
                🎧 كبسولات صوتية سابقة من الطلاب:
              </h4>
              <div class="capsules-list" id="ibdaCapsulesList">
                <div style="grid-column:1/-1; text-align:center; color:#94a3b8; padding:1.5rem;">جاري تحميل الكبسولات...</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. طريق العلماء -->
        <div class="ibda-section" id="ibda-subtab-map">
          <div class="scholars-map-container">
            <h3 style="font-size:1.4rem; font-weight:900; color:#fbbf24; margin-top:0;">🗺️ خريطة طريق العلماء — مسار القارئ التاريخي</h3>
            <p style="color:#cbd5e1; font-size:0.92rem; margin-bottom:2rem;">
              كلما قرأت صفحات أكثر، تقدمت قافلتك بين الحواضر العلمية التاريخية من مكة المكرمة إلى قرطبة، وفُتحت لك أسرار مكتباتها!
            </p>

            <div class="scholars-timeline">
              ${SCHOLARS_STATIONS.map((st, idx) => {
                const isUnlocked = totalPages >= st.pagesRequired;
                const isNext = !isUnlocked && (idx === 0 || totalPages >= SCHOLARS_STATIONS[idx - 1].pagesRequired);
                return `
                  <div class="station-node ${isUnlocked ? 'unlocked' : ''} ${isNext ? 'active-now' : ''}" onclick="IbdaHub.openStationModal(${st.id})">
                    <div class="station-icon-wrap">${isUnlocked ? st.icon : '🔒'}</div>
                    <div class="station-details">
                      <div class="station-name">
                        <span>${st.name}</span>
                        ${isUnlocked ? '<span style="color:#10b981; font-size:0.8rem;">(مفتوحة ✅)</span>' : `<span style="color:#f59e0b; font-size:0.75rem;">(تتطلب ${st.pagesRequired} ص)</span>`}
                      </div>
                      <div class="station-landmark">${st.landmark}</div>
                      <div class="station-desc">${st.desc}</div>
                      <div style="margin-top:0.4rem; font-size:0.8rem; font-weight:800; color:#38bdf8;">
                        🎖️ ${st.badge}
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- 4. حائط الدرر -->
        <div class="ibda-section" id="ibda-subtab-gems">
          <div class="ibda-card">
            <h3 style="font-size:1.4rem; font-weight:900; color:#fff; margin-top:0;">💎 حائط درر القراءة والفوائد</h3>
            <p style="color:#cbd5e1; font-size:0.92rem; margin-bottom:1.5rem;">
              اكتب سطرك الملهم من قراءتك اليوم لتلهم به زملاءك وتنافس على درّة الأسبوع!
            </p>

            <!-- Add Gem Form -->
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

        <!-- 5. سباق الحلقات التفاعلي للمسجد -->
        <div class="ibda-section" id="ibda-subtab-race">
          <div class="mosque-race-wrap">
            <div class="mosque-race-header">
              <h2>🏇 مضمار سباق الحلقات التفاعلي 🏁</h2>
              <p style="color:#94a3b8; margin-top:0.5rem;">
                السباق التنافسي المباشر لشاشات المسجد والبروجكتر — تقدم لحظي بنقاط وصفحات القراءة
              </p>
              <div style="margin-top:1rem; display:flex; gap:0.75rem; justify-content:center; flex-wrap:wrap;">
                <button type="button" class="ibda-btn-action" onclick="IbdaHub.loadRaceData()">
                  <span>تحديث السباق</span> 🔄
                </button>
                <a href="race.html" target="_blank" class="ibda-btn-secondary">
                  <span>فتح شاشة العرض المستقلة للمسجد (Fullscreen)</span> 📺
                </a>
              </div>
            </div>

            <div class="race-lanes-container" id="ibdaRaceLanesContainer">
              <div style="text-align:center; color:#94a3b8; padding:2rem;">جاري تحميل بيانات السباق...</div>
            </div>
          </div>
        </div>

        <!-- 6. مولّد ملصقات QR الذكية للكتب -->
        <div class="ibda-section" id="ibda-subtab-qr">
          <div class="ibda-card">
            <h3 style="font-size:1.4rem; font-weight:900; color:#fff; margin-top:0;">🖨️ مولّد ملصقات QR الذكية لكتب المكتبة</h3>
            <p style="color:#cbd5e1; font-size:0.92rem; margin-bottom:1.5rem;">
              اطبع ملصقات باركود أنيقة والصقها على أغلفة كتب المسجد؛ يمسحها الطالب بجواله ليفتح المنصة ويسجل ورده فوراً!
            </p>

            <div style="max-width:500px; margin:0 auto 1.5rem auto; display:flex; gap:0.5rem;">
              <input type="text" id="ibdaBookQrInput" class="form-control" placeholder="اكتب عنوان الكتاب من المكتبة..." style="flex:1; padding:0.65rem 1rem; border-radius:10px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); color:#fff;" value="رياض الصالحين">
              <button type="button" class="ibda-btn-action" onclick="IbdaHub.generateBookQr()">
                <span>توليد الملصق</span> ✨
              </button>
            </div>

            <div id="ibdaQrPreviewArea">
              <!-- Preview will appear here -->
            </div>
          </div>
        </div>

        <!-- 7. صحيفة إبداع الأسبوعية -->
        <div class="ibda-section" id="ibda-subtab-magazine">
          <div class="ibda-card">
            <h3 style="font-size:1.4rem; font-weight:900; color:#fff; margin-top:0;">📰 صحيفة إبداع الأسبوعية (نشرة الحلقات الحائطية)</h3>
            <p style="color:#cbd5e1; font-size:0.92rem; margin-bottom:1.5rem;">
              توليد آلي لنشرة حائطية وملف PDF أنيق يحوي فارس الأسبوع، أفضل الدرر، وحصاد القراءة لطباعته أو نشره في مجموعة أولياء الأمور.
            </p>

            <div style="text-align:center; margin-bottom:1.5rem;">
              <button type="button" class="ibda-btn-action" onclick="IbdaHub.generateMagazine()">
                <span>توليد صحيفة الأسبوع الحالية</span> 📰✨
              </button>
            </div>

            <div id="ibdaMagazinePreviewArea">
              <!-- Magazine preview will appear here -->
            </div>
          </div>
        </div>

      </div>
    `;
  }

  return {
    renderIbdaFullHtml,
    switchIbdaTab,
    loadGems,
    submitGem,
    reactGem,
    toggleRecording,
    resetRecorder,
    sendCapsule,
    loadCapsules,
    loadRaceData,
    generateBookQr,
    generateMagazine,
    openStationModal,
    waterOasis,
    harvestDates
  };
})();
