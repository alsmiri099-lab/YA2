/**
 * منظومة نقاطي - بوابة الطالب (Student Portal)
 * متوافقة 100% مع واجهة وسيرفر منظومة نقاطي وقاعدة بيانات Supabase
 */
class StudentPortal {
    constructor() {
        // Auto-attach active unit to ALL /api/ requests so no endpoint can ever leak between units
        const originalFetch = window.fetch;
        const self = this;
        window.fetch = function(resource, init = {}) {
            let url = typeof resource === 'string' ? resource : (resource.url || '');
            if (url.includes('/api/') && !url.includes('/api/units')) {
                const uSlug = self.getUnitSlug();
                if (uSlug) {
                    const uParam = `u=${encodeURIComponent(uSlug)}`;
                    if (!url.includes('u=') && !url.includes('unit=') && !url.includes('unitId=')) {
                        const sep = url.includes('?') ? '&' : '?';
                        url = `${url}${sep}${uParam}`;
                    }
                    const headers = new Headers(init.headers || {});
                    if (!headers.has('x-unit-slug')) {
                        headers.set('x-unit-slug', uSlug);
                    }
                    init.headers = headers;
                }
            }
            return originalFetch.call(this, typeof resource === 'string' ? url : new Request(url, resource), init);
        };

        this.classes = [];
        this.currentClassId = null;
        this.allStudents = [];
        this.students = [];
        this.history = [];
        this.quranRecords = [];
        this.goals = [];
        this.attendance = [];
        this.studentMessages = [];
        this.settings = {};
        this.selectedStudentId = null;
        this.activeTab = 'profile';

        this.init();
    }

    async init() {
        this.initIntroSplashScreen();
        this.bindEvents();
        await this.loadState();
        this.startRealtimeSync();
    }

    // ==================== ULTRA-SMOOTH MOBILE-OPTIMIZED INTRO ====================
    initIntroSplashScreen() {
        const splash = document.getElementById('introSplashScreen');
        if (!splash) return;

        const isMobile = window.innerWidth <= 768;
        const canvas = document.getElementById('introParticlesCanvas');
        let animId = null;
        let dismissed = false;

        const dismiss = () => {
            if (dismissed) return;
            dismissed = true;
            if (animId) cancelAnimationFrame(animId);
            splash.classList.add('fade-out');
            splash.style.pointerEvents = 'none';
            setTimeout(() => {
                splash.remove();
            }, 350);
        };

        if (isMobile) {
            // On mobile: immediately prevent scroll blocking, quick gentle fade
            splash.style.pointerEvents = 'none';
            setTimeout(dismiss, 700);
            return;
        }

        // On mobile, keep it extremely lightweight: no heavy blur, only 14 tiny dots
        if (canvas) {
            const ctx = canvas.getContext('2d');
            let w = canvas.width = window.innerWidth;
            let h = canvas.height = window.innerHeight;

            const onResize = () => {
                if (dismissed) return;
                w = canvas.width = window.innerWidth;
                h = canvas.height = window.innerHeight;
            };
            window.addEventListener('resize', onResize);

            const count = isMobile ? 14 : 65;
            const particles = [];
            const colors = ['#fbbf24', '#60a5fa', '#93c5fd', '#ffffff'];

            for (let i = 0; i < count; i++) {
                particles.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    r: Math.random() * 2 + 0.8,
                    color: colors[i % colors.length],
                    vx: (Math.random() - 0.5) * 0.35,
                    vy: -(Math.random() * 0.6 + 0.2),
                    alpha: Math.random() * 0.7 + 0.3
                });
            }

            const draw = () => {
                if (dismissed) return;
                ctx.clearRect(0, 0, w, h);

                for (let i = 0; i < particles.length; i++) {
                    const p = particles[i];
                    p.y += p.vy;
                    p.x += p.vx;

                    if (p.y < -5) { p.y = h + 5; p.x = Math.random() * w; }
                    if (p.x < -5) p.x = w + 5;
                    if (p.x > w + 5) p.x = -5;

                    ctx.save();
                    ctx.globalAlpha = p.alpha;
                    ctx.fillStyle = p.color;
                    // Do NOT use shadowBlur on mobile to prevent GPU/CPU stalls!
                    if (!isMobile) {
                        ctx.shadowBlur = 6;
                        ctx.shadowColor = p.color;
                    }
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }

                animId = requestAnimationFrame(draw);
            };
            draw();
        }

        const skipBtn = document.getElementById('introSkipBtn');
        if (skipBtn) {
            skipBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                dismiss();
            });
        }
        splash.addEventListener('click', dismiss);
        splash.addEventListener('touchstart', dismiss, { passive: true });

        // Auto-dismiss smoothly
        setTimeout(dismiss, isMobile ? 600 : 1000);
        setTimeout(() => { if (splash && splash.parentNode) splash.remove(); }, 1500);
    }

    // ==================== REALTIME SYNC (4s) ====================
    startRealtimeSync() {
        if (this._syncTimer) clearInterval(this._syncTimer);
        this._syncTimer = setInterval(async () => {
            if (!document.hidden) {
                await this.loadState(true);
            }
        }, 4000);

        const onWake = () => {
            if (!document.hidden) {
                this.loadState(true);
            }
        };

        window.addEventListener('visibilitychange', onWake);
        window.addEventListener('focus', onWake);
        window.addEventListener('pageshow', onWake);
        window.addEventListener('online', onWake);
    }

    // ==================== EVENT LISTENERS ====================
    bindEvents() {
        // Tab switching
        document.querySelectorAll('.portal-nav-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.portal-nav-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.activeTab = btn.dataset.tab;
                document.querySelectorAll('.portal-view').forEach(v => v.classList.remove('active'));
                document.getElementById(`view-${this.activeTab}`)?.classList.add('active');
                if (this.activeTab === 'reading') {
                    const currentStudent = this.allStudents.find(s => s.id === this.selectedStudentId);
                    if (currentStudent) this.renderReadingRecords(currentStudent);
                }
            });
        });

        // Circle change in login screen
        document.getElementById('loginClassSelect')?.addEventListener('change', (e) => {
            this.populateLoginStudents(e.target.value);
        });

        // Logout button
        document.getElementById('btnLogoutStudent')?.addEventListener('click', () => {
            this.handleLogout();
        });
    }

    toggleMsgCategory(val) {
        const qRow = document.getElementById('msgQuranFieldsRow');
        if (qRow) {
            qRow.style.display = val === 'late_recitation' ? 'grid' : 'none';
        }
    }

    getUnitSlug() {
        const urlParams = new URLSearchParams(window.location.search);
        const u = urlParams.get('u') || urlParams.get('unit') || localStorage.getItem('naqati_student_unit') || sessionStorage.getItem('naqati_student_unit');
        if (u) {
            localStorage.setItem('naqati_student_unit', u);
            sessionStorage.setItem('naqati_student_unit', u);
        }
        return u || 'thani-thanawi';
    }

    getUnitParam() {
        const u = this.getUnitSlug();
        return u ? `u=${encodeURIComponent(u)}` : '';
    }

    // ==================== STATE MANAGEMENT ====================
    async loadState(silent = false) {
        if (!silent && (!this.allStudents || this.allStudents.length === 0)) this.showLoading(true);
        try {
            const uParam = this.getUnitParam();
            const res = await fetch(`/api/state${uParam ? '?' + uParam : ''}`).catch(() => null);
            if (res && res.ok) {
                const state = await res.json();
                if (state.unit) {
                    this.unit = state.unit;
                    const loginTitle = document.querySelector('.login-header h2');
                    if (loginTitle && !loginTitle.dataset.unitSet) {
                        loginTitle.innerHTML = `<span>دخول الطالب</span> <span style="font-size: 13px; font-weight: 800; background: rgba(99,102,241,0.25); border: 1px solid rgba(99,102,241,0.4); color: #818cf8; padding: 2px 10px; border-radius: 12px; margin-right: 8px;">${state.unit.name}</span>`;
                        loginTitle.dataset.unitSet = 'true';
                    }
                }

                const rawHistory = state.history || [];
                const historySum = rawHistory.reduce((sum, h) => sum + (Number(h.points) || 0), 0);
                const latestHistoryTime = rawHistory[0] ? (rawHistory[0].timestamp || 0) : 0;
                const quranCount = (state.quranRecords || []).length;
                const msgCount = (state.studentMessages || []).length;
                const attCount = (state.attendance || []).length;
                const goalsCount = (state.goals || []).length;
                const iqraCount = (state.iqraRecords || []).length;
                const settingsHash = `${state.settings?.hideStudentRecords}_${state.settings?.allowStudentPortal}_${state.settings?.showStudentReadingRecords}`;
                const newFingerprint = `${(state.students || []).length}##${(state.classes || []).length}##${rawHistory.length}_${historySum}_${latestHistoryTime}##${quranCount}##${msgCount}##${attCount}##${goalsCount}##${iqraCount}##${settingsHash}`;

                if (silent && this._lastFingerprint === newFingerprint) {
                    // Unchanged state - do NOT destroy and rebuild DOM!
                    return;
                }
                this._lastFingerprint = newFingerprint;

                this.classes = state.classes || [];
                this.allStudents = state.students || [];
                this.history = rawHistory;
                this.quranRecords = state.quranRecords || [];
                this.goals = state.goals || [];
                this.attendance = state.attendance || [];
                this.studentMessages = state.studentMessages || [];
                this.iqraRecords = state.iqraRecords || [];
                this.iqraSettings = state.iqraSettings || {};
                this.settings = state.settings || {};
            }
            this.applyState();
        } catch (e) {
            console.error('Error loading state:', e);
        } finally {
            this.showLoading(false);
        }
    }

    applyState() {
        // 1. Check if Director disabled the Student Portal entirely
        const isAllowed = this.settings.allowStudentPortal !== false;
        const closedBox = document.getElementById('view-closed');
        const loginCard = document.getElementById('view-login');
        const dashWrap = document.getElementById('dashboardWrap');
        const navBar = document.getElementById('portalNavBar');
        const userWrap = document.getElementById('headerUserWrap');

        if (!isAllowed) {
            if (closedBox) closedBox.style.display = 'block';
            if (loginCard) loginCard.style.display = 'none';
            if (dashWrap) dashWrap.style.display = 'none';
            if (navBar) navBar.style.display = 'none';
            if (userWrap) userWrap.style.display = 'none';
            return;
        }

        if (closedBox) closedBox.style.display = 'none';

        // 2. Check if student is authenticated with 2-digit PIN
        const uSlug = this.getUnitSlug();
        const savedAuthId = localStorage.getItem(`naqati_student_auth_id_${uSlug}`) || localStorage.getItem('naqati_student_auth_id');
        const savedAuthPin = localStorage.getItem(`naqati_student_auth_pin_${uSlug}`) || localStorage.getItem('naqati_student_auth_pin');

        let authedStudent = null;
        if (savedAuthId && savedAuthPin) {
            authedStudent = this.allStudents.find(s => s.id === savedAuthId && String(s.passcode || '').trim() === String(savedAuthPin).trim());
        }

        if (!authedStudent) {
            // Show Login Card
            if (loginCard) loginCard.style.display = 'block';
            if (dashWrap) dashWrap.style.display = 'none';
            if (navBar) navBar.style.display = 'none';
            if (userWrap) userWrap.style.display = 'none';
            this.setupLoginForm();
            return;
        }

        // Student is authenticated!
        this.selectedStudentId = authedStudent.id;
        this.currentClassId = authedStudent.classId;

        if (loginCard) loginCard.style.display = 'none';
        if (dashWrap) dashWrap.style.display = 'block';
        if (navBar) navBar.style.display = 'flex';
        if (userWrap) userWrap.style.display = 'flex';

        // Update top user badge
        const avatarEl = document.getElementById('headerUserAvatar');
        const nameEl = document.getElementById('headerUserName');
        if (avatarEl) avatarEl.textContent = (authedStudent.name || 'ط').trim().charAt(0);
        if (nameEl) nameEl.textContent = authedStudent.name;

        // Update points
        this.updateClassStudents();

        // 3. Check if Director hid the records
        const isHidden = this.settings.hideStudentRecords === true;
        this.applyRecordsVisibility(isHidden);

        // Update Iqra direct link button with student hash
        const btnGoIqra = document.getElementById('btnGoToIqraFromView');
        if (btnGoIqra) {
            const base = (this.settings.iqraUrl || 'https://ya2-live.vercel.app').replace(/\/+$/, '');
            const pin = localStorage.getItem('naqati_student_auth_pin') || authedStudent.passcode || '';
            btnGoIqra.href = `${base}/index.html#nq=${encodeURIComponent(authedStudent.id)}&pin=${encodeURIComponent(pin)}`;
        }

        // Render sections
        this.renderStudentProfile(authedStudent);
        this.renderQuranRecords(authedStudent);
        this.renderPointsHistory(authedStudent);
        this.renderReadingRecords(authedStudent);
        this.renderLeaderboard();
        this.renderMyMessages(authedStudent);
    }

    applyRecordsVisibility(isHidden) {
        // Hide Points and Honor Board navigation tabs when points/ranks are hidden
        const pointsTabBtn = document.querySelector('.portal-nav-tab[data-tab="points"]');
        const honorTabBtn = document.querySelector('.portal-nav-tab[data-tab="honor"]');
        if (pointsTabBtn) pointsTabBtn.style.display = isHidden ? 'none' : 'flex';
        if (honorTabBtn) honorTabBtn.style.display = isHidden ? 'none' : 'flex';

        // Iqra reading records visibility (متحكم بها من بوابة المدير)
        const hideIqra = this.settings.showStudentReadingRecords === false;
        const iqraTabBtn = document.getElementById('navTabIqraReading');
        if (iqraTabBtn) iqraTabBtn.style.display = hideIqra ? 'none' : 'flex';
        if (hideIqra && this.activeTab === 'reading') {
            document.querySelector('.portal-nav-tab[data-tab="profile"]')?.click();
        }

        const rNotice = document.getElementById('readingRecordsHiddenNotice');
        const rContent = document.getElementById('readingRecordsActiveContent');
        if (rNotice) rNotice.style.display = hideIqra ? 'block' : 'none';
        if (rContent) rContent.style.display = hideIqra ? 'none' : 'block';

        // Quran records are ALWAYS visible (never hidden)
        const qNotice = document.getElementById('quranRecordsHiddenNotice');
        const qContent = document.getElementById('quranRecordsActiveContent');
        if (qNotice) qNotice.style.display = 'none';
        if (qContent) qContent.style.display = 'block';

        // If currently on a hidden tab, switch back to profile
        if (isHidden && (this.activeTab === 'points' || this.activeTab === 'honor')) {
            document.querySelector('.portal-nav-tab[data-tab="profile"]')?.click();
        }

        const pNotice = document.getElementById('pointsRecordsHiddenNotice');
        const pContent = document.getElementById('pointsRecordsActiveContent');
        const hNotice = document.getElementById('honorHiddenNotice');
        const hContent = document.getElementById('honorActiveContent');

        if (pNotice) pNotice.style.display = isHidden ? 'block' : 'none';
        if (pContent) pContent.style.display = isHidden ? 'none' : 'block';
        if (hNotice) hNotice.style.display = isHidden ? 'block' : 'none';
        if (hContent) hContent.style.display = isHidden ? 'none' : 'block';
    }

    // ==================== LOGIN HANDLING ====================
    setupLoginForm() {
        const classSelect = document.getElementById('loginClassSelect');
        if (!classSelect) return;

        classSelect.innerHTML = '';
        if (this.classes.length === 0) {
            classSelect.innerHTML = '<option value="">لا توجد حلقات حالياً</option>';
            return;
        }

        const savedClassId = localStorage.getItem('naqati_student_class_id');
        let matched = false;

        this.classes.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name;
            if (savedClassId && c.id === savedClassId) {
                opt.selected = true;
                matched = true;
            }
            classSelect.appendChild(opt);
        });

        const activeClass = matched ? savedClassId : this.classes[0].id;
        classSelect.value = activeClass;
        this.populateLoginStudents(activeClass);
    }

    populateLoginStudents(classId) {
        const studentSelect = document.getElementById('loginStudentSelect');
        if (!studentSelect) return;
        studentSelect.innerHTML = '';

        const circleStudents = this.allStudents
            .filter(s => s.classId === classId)
            .sort((a, b) => a.name.localeCompare(b.name, 'ar'));

        if (circleStudents.length === 0) {
            studentSelect.innerHTML = '<option value="">لا يوجد طلاب في هذه الحلقة</option>';
            return;
        }

        circleStudents.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.name;
            studentSelect.appendChild(opt);
        });
    }

    handleLogin() {
        const errorBox = document.getElementById('loginErrorMsg');
        const errorText = document.getElementById('loginErrorText');
        const studentSelect = document.getElementById('loginStudentSelect');
        const pinInput = document.getElementById('loginPinInput');

        if (!studentSelect || !pinInput) return;

        const studentId = studentSelect.value;
        const enteredPin = (pinInput.value || '').trim();

        if (!studentId) {
            if (errorBox) {
                errorText.textContent = 'يرجى اختيار اسم الطالب';
                errorBox.style.display = 'flex';
            }
            return;
        }

        if (enteredPin.length < 2) {
            if (errorBox) {
                errorText.textContent = 'يرجى إدخال رمز الدخول المكون من رقمين';
                errorBox.style.display = 'flex';
            }
            pinInput.focus();
            return;
        }

        const student = this.allStudents.find(s => s.id === studentId);
        if (!student) {
            if (errorBox) {
                errorText.textContent = 'لم يتم العثور على بيانات الطالب';
                errorBox.style.display = 'flex';
            }
            return;
        }

        const correctPasscode = String(student.passcode || '').trim();
        if (correctPasscode && enteredPin !== correctPasscode) {
            if (errorBox) {
                errorText.textContent = 'رمز الدخول غير صحيح، يرجى التأكد من معلم الحلقة';
                errorBox.style.display = 'flex';
            }
            pinInput.value = '';
            pinInput.focus();
            return;
        }

        // Login success!
        if (errorBox) errorBox.style.display = 'none';
        const uSlug = this.getUnitSlug();
        localStorage.setItem(`naqati_student_auth_id_${uSlug}`, student.id);
        localStorage.setItem(`naqati_student_auth_pin_${uSlug}`, enteredPin);
        localStorage.setItem(`naqati_student_class_id_${uSlug}`, student.classId);

        pinInput.value = '';
        this.applyState();
    }

    handleLogout() {
        const uSlug = this.getUnitSlug();
        localStorage.removeItem(`naqati_student_auth_id_${uSlug}`);
        localStorage.removeItem(`naqati_student_auth_pin_${uSlug}`);
        localStorage.removeItem('naqati_student_auth_id');
        localStorage.removeItem('naqati_student_auth_pin');
        this.selectedStudentId = null;
        this.applyState();
    }

    // ==================== STUDENTS & RANKS CALC ====================
    updateClassStudents() {
        const pointsMap = {};
        (this.history || [])
            .filter(h => h.targetType === 'student')
            .forEach(h => {
                pointsMap[h.targetId] = (pointsMap[h.targetId] || 0) + (parseInt(h.points, 10) || 0);
            });

        // All students with calculated points
        this.allStudentsWithPoints = this.allStudents.map(s => ({
            ...s,
            points: pointsMap[s.id] || 0
        }));

        // Current circle students
        this.students = this.allStudentsWithPoints.filter(s => s.classId === this.currentClassId);
    }

    // ==================== VIEW 1: STUDENT PROFILE & HERO ====================
    renderStudentProfile(student) {
        const box = document.getElementById('studentProfileBox');
        if (!box || !student) return;

        const pts = parseInt(student.points || 0, 10);

        // 1. Circle Rank
        const circleSorted = [...this.students].sort((a, b) => (b.points || 0) - (a.points || 0));
        const circleRank = circleSorted.findIndex(s => s.id === student.id) + 1;
        const circleTotal = this.students.length;

        // 2. Overall Rank across ALL students in the school
        const allSorted = [...(this.allStudentsWithPoints || this.allStudents)].sort((a, b) => (b.points || 0) - (a.points || 0));
        const overallRank = allSorted.findIndex(s => s.id === student.id) + 1;
        const overallTotal = allSorted.length;

        // Calculate Quran pages
        const stRecords = (this.quranRecords || []).filter(r => r.studentId === student.id);
        let totalPages = 0;
        stRecords.forEach(r => totalPages += (parseFloat(r.pagesCount) || 0));

        // Calculate Iqra Reading stats (منصة اقرأ)
        const stIqraRecords = (this.iqraRecords || []).filter(r => r.studentId === student.id);
        const stIqraLogs = (this.history || []).filter(h => h.targetType === 'student' && h.targetId === student.id && (String(h.id || '').startsWith('iqra_') || (h.criteriaName && h.criteriaName.includes('اقرأ'))));
        const iqraPoints = stIqraLogs.reduce((acc, cur) => acc + (parseInt(cur.points, 10) || 0), 0);
        const iqraCount = Math.max(stIqraRecords.length, stIqraLogs.length);

        let level = { title: 'فارس المبتدئين', icon: 'fa-shield-halved', color: '#94a3b8' };
        if (pts >= 200) level = { title: 'تاج الوقار الذهبي 👑', icon: 'fa-crown', color: '#fbbf24' };
        else if (pts >= 120) level = { title: 'أمير التلاوة والتميز 🌟', icon: 'fa-award', color: '#60a5fa' };
        else if (pts >= 70) level = { title: 'نجم التحفيظ البارع ⚡', icon: 'fa-star', color: '#34d399' };
        else if (pts >= 30) level = { title: 'بطل الحفظ المتقن 📖', icon: 'fa-book-open', color: '#a78bfa' };

        const currentClassObj = this.classes.find(c => c.id === this.currentClassId);
        const className = currentClassObj ? currentClassObj.name : 'الحلقة القرآنية';

        const hidePoints = this.settings.hideStudentRecords === true;
        let statsRowHtml = '';

        if (hidePoints) {
            // When points & ranks are hidden: show completed Quran pages, recitation sessions count, and Iqra readings count
            statsRowHtml = `
                <div class="hero-stats-row" style="grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));">
                    <div class="stat-card stat-quran">
                        <i class="fa-solid fa-book-quran"></i>
                        <span class="stat-val">${totalPages}</span>
                        <span class="stat-lbl">إجمالي الصفحات المنجزة</span>
                    </div>
                    <div class="stat-card stat-quran">
                        <i class="fa-solid fa-file-circle-check"></i>
                        <span class="stat-val">${stRecords.length}</span>
                        <span class="stat-lbl">جلسات التسميع المعتمدة</span>
                    </div>
                    <div class="stat-card stat-iqra" style="border: 1px solid rgba(99, 102, 241, 0.35); background: linear-gradient(135deg, rgba(14, 165, 233, 0.1), rgba(99, 102, 241, 0.12));">
                        <i class="fa-solid fa-book-open-reader" style="color: #818cf8;"></i>
                        <span class="stat-val">${iqraCount}</span>
                        <span class="stat-lbl">أوراد منصة اقرأ</span>
                    </div>
                </div>
            `;
        } else {
            // Normal: show points, Iqra points, circle rank, overall rank, and Quran pages
            statsRowHtml = `
                <div class="hero-stats-row" style="grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));">
                    <div class="stat-card stat-points">
                        <i class="fa-solid fa-star"></i>
                        <span class="stat-val">${pts}</span>
                        <span class="stat-lbl">رصيد النقاط الكلي</span>
                    </div>
                    <div class="stat-card stat-iqra" style="border: 1px solid rgba(99, 102, 241, 0.35); background: linear-gradient(135deg, rgba(14, 165, 233, 0.1), rgba(99, 102, 241, 0.12));">
                        <i class="fa-solid fa-book-open-reader" style="color: #818cf8;"></i>
                        <span class="stat-val">${iqraPoints}</span>
                        <span class="stat-sub">${iqraCount} أوراد</span>
                        <span class="stat-lbl">نقاط ورد اقرأ</span>
                    </div>
                    <div class="stat-card stat-circle-rank">
                        <i class="fa-solid fa-trophy"></i>
                        <span class="stat-val">#${circleRank}</span>
                        <span class="stat-sub">من أصل ${circleTotal} بالحلقة</span>
                        <span class="stat-lbl">الترتيب في الحلقة</span>
                    </div>
                    <div class="stat-card stat-overall-rank">
                        <i class="fa-solid fa-award"></i>
                        <span class="stat-val">#${overallRank}</span>
                        <span class="stat-sub">من أصل ${overallTotal} طالباً</span>
                        <span class="stat-lbl">الترتيب العام بالمجمع</span>
                    </div>
                    <div class="stat-card stat-quran">
                        <i class="fa-solid fa-book-quran"></i>
                        <span class="stat-val">${totalPages}</span>
                        <span class="stat-lbl">الصفحات المنجزة</span>
                    </div>
                </div>
            `;
        }

        box.innerHTML = `
            <div class="student-hero-card">
                <div class="hero-avatar">
                    <span>${this.escapeHtml((student.name || 'ط').trim().charAt(0))}</span>
                </div>
                <h2 class="hero-name">${this.escapeHtml(student.name)}</h2>
                <div class="hero-class-tag">
                    <i class="fa-solid fa-mosque"></i>
                    <span>${this.escapeHtml(className)}</span>
                </div>
                <div class="hero-title-badge" style="border-color: ${level.color}; color: ${level.color};">
                    <i class="fa-solid ${level.icon}"></i>
                    <span>${level.title}</span>
                </div>

                ${statsRowHtml}

                ${(() => {
                    const myGoals = (this.goals || []).filter(g => g.studentId === student.id && g.status === 'active');
                    const activeGoal = myGoals[0];
                    if (!activeGoal) return '';

                    const stRecords = (this.quranRecords || []).filter(r => r.studentId === student.id && r.recordType === 'memorization');
                    let memoPages = 0;
                    stRecords.forEach(r => memoPages += (parseFloat(r.pagesCount) || 0));

                    const target = activeGoal.targetPages || 1;
                    const pct = Math.min(100, Math.round((memoPages / target) * 100));
                    const isDone = pct >= 100;

                    return `
                        <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: var(--radius-md); padding: 1rem; margin-top: 1rem; text-align: right;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                <strong style="font-size: 0.95rem; color: #fff; display: flex; align-items: center; gap: 6px;">
                                    <i class="fa-solid fa-bullseye" style="color: var(--gold);"></i>
                                    <span>هدف الحفظ: ${this.escapeHtml(activeGoal.title)}</span>
                                </strong>
                                <span style="font-weight: 900; color: ${isDone ? 'var(--emerald)' : 'var(--gold)'}; font-size: 1rem;">${pct}%</span>
                            </div>
                            <div style="background: rgba(255,255,255,0.08); border-radius: 8px; height: 10px; overflow: hidden; margin: 8px 0;">
                                <div style="background: ${isDone ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #f59e0b, #d97706)'}; height: 100%; width: ${pct}%; transition: width 0.4s ease;"></div>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 0.78rem; color: var(--text-secondary);">
                                <span>أنجزت: ${memoPages} صفحة</span>
                                <span>المطلوب: ${target} صفحة</span>
                            </div>
                        </div>
                    `;
                })()}

                <!-- Attendance Strip for Student -->
                ${(() => {
                    const myAtt = (this.attendance || []).filter(a => a.studentId === student.id);
                    if (myAtt.length === 0) return '';
                    const presents = myAtt.filter(a => a.status === 'present').length;
                    const lates = myAtt.filter(a => a.status === 'late').length;
                    const absents = myAtt.filter(a => a.status === 'absent').length;

                    return `
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 0.75rem;">
                            <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: var(--radius-sm); padding: 0.5rem; text-align: center;">
                                <strong style="color: #34d399; font-size: 1.1rem; display: block;">${presents}</strong>
                                <span style="font-size: 0.72rem; color: var(--text-secondary);">أيام الحضور</span>
                            </div>
                            <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: var(--radius-sm); padding: 0.5rem; text-align: center;">
                                <strong style="color: #fbbf24; font-size: 1.1rem; display: block;">${lates}</strong>
                                <span style="font-size: 0.72rem; color: var(--text-secondary);">مرات التأخر</span>
                            </div>
                            <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: var(--radius-sm); padding: 0.5rem; text-align: center;">
                                <strong style="color: #f87171; font-size: 1.1rem; display: block;">${absents}</strong>
                                <span style="font-size: 0.72rem; color: var(--text-secondary);">أيام الغياب</span>
                            </div>
                        </div>
                    `;
                })()}

                <div class="badges-row">
                    <div class="badge-pill" title="حفظ متقن"><i class="fa-solid fa-book-quran"></i> حفظ متقن</div>
                    <div class="badge-pill" title="مراجعة مستمرة"><i class="fa-solid fa-repeat"></i> مراجعة مستمرة</div>
                    <div class="badge-pill" title="أدب وسلوك"><i class="fa-solid fa-heart"></i> أدب وسلوك</div>
                    <div class="badge-pill" title="حضور مبكر"><i class="fa-solid fa-clock"></i> انضباط وحضور</div>
                </div>
            </div>
        `;
    }

    // ==================== VIEW: SEND MESSAGE & LATE RECITATION ====================
    toggleMsgRecipient(val) {
        const catSelect = document.getElementById('msgCategorySelect');
        const btn = document.getElementById('btnSubmitStudentMsg');
        const surahLabel = document.querySelector('#msgQuranFieldsRow label');
        const surahInput = document.getElementById('msgSurahInput');

        if (val === 'iqra_teacher') {
            if (catSelect) {
                catSelect.innerHTML = `
                    <option value="reading_ord">📖 إشعار إنجاز ورد قراءة أو فائدة</option>
                    <option value="iqra_question">💬 استفسار عن كتاب أو ورد القراءة</option>
                    <option value="general">✉️ رسالة خاصة لمعلم اقرأ</option>
                `;
            }
            if (surahLabel) surahLabel.textContent = 'اسم الكتاب:';
            if (surahInput) surahInput.placeholder = 'مثال: حلية طالب العلم أو رياض الصالحين';
            if (btn) btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> <span>إرسال الرسالة لمعلم اقرأ فوراً</span>';
        } else {
            if (catSelect) {
                catSelect.innerHTML = `
                    <option value="late_recitation">📖 إشعار إنجاز ورد حفظ أو مراجعة متأخر</option>
                    <option value="general">💬 رسالة واستفسار عام للمدير</option>
                `;
            }
            if (surahLabel) surahLabel.textContent = 'اسم السورة:';
            if (surahInput) surahInput.placeholder = 'مثال: سورة البقرة';
            if (btn) btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> <span>إرسال الإشعار لمدير نقاطي فوراً</span>';
        }
    }

    async submitMessage() {
        const catSelect = document.getElementById('msgCategorySelect');
        const recipientSelect = document.getElementById('msgRecipientSelect');
        const surahInput = document.getElementById('msgSurahInput');
        const pagesInput = document.getElementById('msgPagesInput');
        const bodyInput = document.getElementById('msgBodyInput');
        const btn = document.getElementById('btnSubmitStudentMsg');

        if (!bodyInput || !bodyInput.value.trim()) {
            alert('يرجى كتابة نص الرسالة أو تفاصيل الإنجاز');
            return;
        }

        const student = this.allStudents.find(s => s.id === this.selectedStudentId);
        if (!student) return;

        const recipient = recipientSelect ? recipientSelect.value : 'director';
        const isIqra = recipient === 'iqra_teacher';

        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> جاري الإرسال لـ ${isIqra ? 'معلم اقرأ' : 'المدير'}...`;

        try {
            const res = await fetch('/api/student-messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    studentId: student.id,
                    studentName: student.name,
                    classId: student.classId,
                    recipient: recipient,
                    category: catSelect ? catSelect.value : 'late_recitation',
                    surahName: surahInput ? surahInput.value.trim() : '',
                    pagesCount: pagesInput ? parseFloat(pagesInput.value) || 0 : 0,
                    message: bodyInput.value.trim()
                })
            });

            if (res.ok) {
                if (isIqra) {
                    alert('تم إرسال رسالتك لمعلم منصة اقرأ بنجاح! سيطلع عليها قريباً إن شاء الله.');
                } else {
                    alert('تم إرسال إشعارك لمدير منظومة نقاطي بنجاح! سيتم مراجعته واعتماده قريباً إن شاء الله.');
                }
                bodyInput.value = '';
                if (surahInput) surahInput.value = '';
                if (pagesInput) pagesInput.value = '';
                await this.loadState(true);
            } else {
                alert('تعذر إرسال الرسالة، يرجى المحاولة مرة أخرى');
            }
        } catch (e) {
            console.error('Submit error:', e);
            alert('حدث خطأ في الاتصال، تأكد من الإنترنت');
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> <span>إرسال ${isIqra ? 'الرسالة لمعلم اقرأ' : 'الإشعار لمدير نقاطي'} فوراً</span>`;
        }
    }

    renderMyMessages(student) {
        const list = document.getElementById('studentMyMessagesList');
        if (!list || !student) return;

        const msgs = (this.studentMessages || [])
            .filter(m => m.studentId === student.id)
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        if (msgs.length === 0) {
            list.innerHTML = `
                <div class="empty-state" style="padding: 1.5rem 1rem;">
                    <i class="fa-regular fa-paper-plane" style="font-size: 2rem;"></i>
                    <p style="font-size: 0.88rem;">لم ترسل أي إشعارات أو رسائل سابقة.<br>يمكنك إرسال رسالة للمدير أو معلم اقرأ في أي وقت أعلاه.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = msgs.map(m => {
            const isPending = m.status === 'pending';
            const isApproved = m.status === 'approved';
            const isIqra = m.recipient === 'iqra_teacher';
            let badge = '';

            const recipientBadge = isIqra
                ? `<span style="background: rgba(16, 185, 129, 0.15); color: #34d399; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 800; border: 1px solid rgba(16, 185, 129, 0.3);"><i class="fa-solid fa-chalkboard-user"></i> إلى: معلم اقرأ</span>`
                : `<span style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 800; border: 1px solid rgba(59, 130, 246, 0.3);"><i class="fa-solid fa-crown"></i> إلى: مدير نقاطي</span>`;

            if (isPending) badge = `<span style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 800; border: 1px solid rgba(245, 158, 11, 0.3);"><i class="fa-solid fa-clock"></i> قيد المراجعة</span>`;
            else if (isApproved) badge = `<span style="background: rgba(16, 185, 129, 0.15); color: #10b981; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 800; border: 1px solid rgba(16, 185, 129, 0.3);"><i class="fa-solid fa-circle-check"></i> تم الاعتماد (+${m.pointsAwarded || 0} نقطة)</span>`;
            else badge = `<span style="background: rgba(239, 68, 68, 0.15); color: #f87171; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 800; border: 1px solid rgba(239, 68, 68, 0.3);"><i class="fa-solid fa-circle-xmark"></i> تمت القراءة</span>`;

            const dateStr = m.createdAt ? new Date(m.createdAt).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

            return `
                <div class="msg-item">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 6px;">
                        <div style="display:flex; gap:6px; align-items:center;">
                            ${recipientBadge}
                            ${badge}
                        </div>
                        <small style="color: var(--text-muted); font-size: 11px;">${dateStr}</small>
                    </div>

                    ${(m.surahName || m.pagesCount) ? `
                        <div style="font-size: 12px; color: #60a5fa; font-weight: 700; margin-bottom: 4px;">
                            <i class="fa-solid fa-book-bookmark"></i> ${this.escapeHtml(m.surahName || '')} ${m.pagesCount ? `(${m.pagesCount} صفحة)` : ''}
                        </div>
                    ` : ''}

                    <div style="font-size: 13px; color: var(--text-primary); line-height: 1.4; margin-bottom: 4px;">
                        ${this.escapeHtml(m.message)}
                    </div>

                    ${m.directorReply ? `
                        <div style="font-size: 12px; color: #10b981; background: rgba(16, 185, 129, 0.08); padding: 6px 10px; border-radius: 6px; margin-top: 6px; border-right: 3px solid #10b981;">
                            <strong>${isIqra ? 'رد معلم اقرأ:' : 'رد المدير العام:'}</strong> ${this.escapeHtml(m.directorReply)}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    // ==================== VIEW 2: QURAN RECORDS ====================
    renderQuranRecords(student) {
        const list = document.getElementById('studentQuranRecordsList');
        const memoStat = document.getElementById('statMemoPages');
        const revStat = document.getElementById('statRevPages');
        const totalStat = document.getElementById('statTotalRecitations');

        if (!list || !student) return;

        const records = (this.quranRecords || [])
            .filter(r => r.studentId === student.id)
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        let memoPages = 0;
        let revPages = 0;

        records.forEach(r => {
            const p = parseFloat(r.pagesCount) || 0;
            if (r.recordType === 'memorization') memoPages += p;
            else if (r.recordType === 'revision') revPages += p;
        });

        if (memoStat) memoStat.textContent = memoPages;
        if (revStat) revStat.textContent = revPages;
        if (totalStat) totalStat.textContent = records.length;

        if (records.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-book-quran"></i>
                    <p>لم يتم تسجيل ورد حفظ أو مراجعة بعد.<br>سيظهر سجلك فور رصده من قِبل معلم الحلقة.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = records.map(r => {
            const isMemo = r.recordType === 'memorization';
            const badgeClass = isMemo ? 'memo' : 'rev';
            const badgeIcon = isMemo ? 'fa-book-open' : 'fa-repeat';
            const badgeText = isMemo ? 'حفظ جديد' : 'مراجعة وتثبيت';

            let ayahText = '';
            if (r.fromAyah && r.toAyah) {
                ayahText = ` (الآيات: ${r.fromAyah} - ${r.toAyah})`;
            }

            return `
                <div class="quran-record-item">
                    <div class="quran-record-top">
                        <span class="quran-badge ${badgeClass}">
                            <i class="fa-solid ${badgeIcon}"></i>
                            <span>${badgeText}</span>
                        </span>
                        <span class="quran-record-date">
                            <i class="fa-regular fa-calendar-days"></i> ${r.date || ''}
                        </span>
                    </div>

                    <div class="quran-record-surah">
                        <i class="fa-solid fa-bookmark" style="color: ${isMemo ? 'var(--emerald)' : '#60a5fa'}; font-size: 0.95rem;"></i>
                        <span>${this.escapeHtml(r.surahName || 'تسميع قرآني')}${ayahText}</span>
                    </div>

                    <div class="quran-record-pages">
                        <i class="fa-solid fa-file-lines"></i>
                        <span>عدد الصفحات: <strong>${r.pagesCount || 0}</strong> صفحة</span>
                    </div>

                    ${r.notes ? `
                        <div class="quran-record-notes">
                            <i class="fa-solid fa-comment-dots" style="color: #60a5fa;"></i>
                            <span>${this.escapeHtml(r.notes)}</span>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    // ==================== VIEW 3: POINTS HISTORY ====================
    renderPointsHistory(student) {
        const list = document.getElementById('studentPointsHistoryList');
        const badge = document.getElementById('pointsTotalBadge');
        if (!list || !student) return;

        const studentLogs = (this.history || [])
            .filter(h => h.targetType === 'student' && h.targetId === student.id)
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        const total = studentLogs.reduce((acc, cur) => acc + (parseInt(cur.points, 10) || 0), 0);
        if (badge) badge.textContent = `${total} نقطة`;

        if (studentLogs.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-star"></i>
                    <p>لا توجد نقاط مسجلة حالياً</p>
                </div>
            `;
            return;
        }

        list.innerHTML = studentLogs.map(item => {
            const pts = parseInt(item.points, 10) || 0;
            const isPos = pts > 0;
            const sign = isPos ? `+${pts}` : `${pts}`;
            const cls = isPos ? 'pos' : 'neg';

            const isIqra = String(item.id || '').startsWith('iqra_') || (item.criteriaName && item.criteriaName.includes('اقرأ'));
            const iqraBadge = isIqra ? `<span class="badge-iqra-tag" style="background: linear-gradient(135deg, #0ea5e9, #6366f1); color: #fff; padding: 2px 7px; border-radius: 6px; font-size: 11px; font-weight: 800; display: inline-flex; align-items: center; gap: 4px; margin-right: 6px;"><i class="fa-solid fa-book-open"></i> منصة اقرأ</span>` : '';

            return `
                <div class="history-item" style="${isIqra ? 'border-right: 4px solid #6366f1; background: rgba(99, 102, 241, 0.05);' : ''}">
                    <div class="history-item-info">
                        <strong>${this.escapeHtml(item.criteriaName || 'تقييم')} ${iqraBadge}</strong>
                        <small>
                            <i class="fa-regular fa-clock"></i> ${item.date || ''}
                            ${item.note ? ` • ${this.escapeHtml(item.note)}` : ''}
                        </small>
                    </div>
                    <div class="history-pts ${cls}">
                        ${sign}
                    </div>
                </div>
            `;
        }).join('');
    }

    // ==================== VIEW: IQRA READING RECORDS ====================
    renderReadingRecords(student) {
        const list = document.getElementById('studentReadingRecordsList');
        const booksCountEl = document.getElementById('iqraTotalBooksCount');
        const pointsEarnedEl = document.getElementById('iqraTotalPointsEarned');
        const onTimePercentEl = document.getElementById('iqraOnTimePercent');
        const noticeEl = document.getElementById('readingRecordsHiddenNotice');
        const activeContentEl = document.getElementById('readingRecordsActiveContent');

        if (!list || !student) return;

        const isHidden = this.settings.showStudentReadingRecords === false;
        if (noticeEl) noticeEl.style.display = isHidden ? 'block' : 'none';
        if (activeContentEl) activeContentEl.style.display = isHidden ? 'none' : 'block';
        if (isHidden) return;

        const stRecords = (this.iqraRecords || []).filter(r => r.studentId === student.id);
        const stLogs = (this.history || []).filter(h => h.targetType === 'student' && h.targetId === student.id && (String(h.id || '').startsWith('iqra_') || (h.criteriaName && h.criteriaName.includes('اقرأ'))));

        const totalPoints = stLogs.reduce((acc, cur) => acc + (parseInt(cur.points, 10) || 0), 0);
        if (pointsEarnedEl) pointsEarnedEl.textContent = `${totalPoints} نقطة`;

        const totalCount = Math.max(stRecords.length, stLogs.length);
        if (booksCountEl) booksCountEl.textContent = `${totalCount} ورد`;

        const lateCount = stRecords.filter(r => r.isLate).length + stLogs.filter(h => (h.note && h.note.includes('متأخر'))).length;
        const onTimeRate = totalCount > 0 ? Math.round(((totalCount - lateCount) / totalCount) * 100) : 100;
        if (onTimePercentEl) onTimePercentEl.textContent = `${Math.max(0, onTimeRate)}%`;

        if (totalCount === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-book-open-reader"></i>
                    <p>لا توجد أوراد قراءة مسجلة حتى الآن</p>
                    <small style="color: var(--text-muted); display:block; margin-top: 6px;">ادخل لمنصة اقرأ لتسجيل ورد قراءتك اليومي وتلخيص الفوائد وكسب النقاط</small>
                </div>
            `;
            return;
        }

        if (stRecords.length > 0) {
            list.innerHTML = stRecords.map(rec => {
                const isLate = rec.isLate;
                const statusBadge = isLate
                    ? `<span style="background: rgba(239, 68, 68, 0.15); color: #f87171; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700;"><i class="fa-regular fa-clock"></i> تسليم متأخر</span>`
                    : `<span style="background: rgba(16, 185, 129, 0.15); color: #34d399; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700;"><i class="fa-solid fa-check"></i> في وقته</span>`;

                const pagesText = (rec.startPage && rec.endPage) ? `ص ${rec.startPage} إلى ${rec.endPage}` : '';

                return `
                    <div class="history-item" style="border-right: 4px solid ${isLate ? '#f87171' : '#34d399'}; flex-direction: column; align-items: flex-start; gap: 6px; margin-bottom: 10px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <strong style="font-size: 1rem; color: #fff;"><i class="fa-solid fa-book" style="color: var(--gold);"></i> ${this.escapeHtml(rec.bookName || 'ورد القراءة')}</strong>
                                ${statusBadge}
                            </div>
                            <div class="history-pts pos" style="font-size: 1.05rem;">
                                +${rec.points || 0}
                            </div>
                        </div>
                        <small style="color: var(--text-muted); display:flex; gap:14px; flex-wrap:wrap; font-size: 0.8rem;">
                            ${pagesText ? `<span><i class="fa-solid fa-bookmark" style="color: #60a5fa;"></i> ${pagesText}</span>` : ''}
                            <span><i class="fa-regular fa-calendar"></i> ${rec.date || ''}</span>
                        </small>
                        ${rec.questions ? `<div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.06); padding: 8px 12px; border-radius: 6px; width: 100%; font-size: 0.86rem; color: var(--text-secondary); margin-top: 4px;"><strong>💡 الفوائد والملخص:</strong> ${this.escapeHtml(rec.questions)}</div>` : ''}
                    </div>
                `;
            }).join('');
        } else {
            list.innerHTML = stLogs.map(log => {
                const isLate = log.note && log.note.includes('متأخر');
                return `
                    <div class="history-item" style="border-right: 4px solid ${isLate ? '#f87171' : '#34d399'}; margin-bottom: 10px;">
                        <div class="history-item-info">
                            <strong style="color: #fff;"><i class="fa-solid fa-book" style="color: var(--gold);"></i> ${this.escapeHtml(log.note || 'ورد القراءة')}</strong>
                            <small>
                                <i class="fa-regular fa-calendar"></i> ${log.date || ''}
                                <span style="margin-right: 6px; background: linear-gradient(135deg, #0ea5e9, #6366f1); color: #fff; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 700;">منصة اقرأ</span>
                            </small>
                        </div>
                        <div class="history-pts pos">
                            +${log.points || 0}
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // ==================== VIEW: IBDA CREATIVE HUB ====================
    renderIbdaHub(student) {
        const container = document.getElementById('view-ibda');
        if (!container || !window.IbdaHub) return;
        const stRecords = (this.iqraRecords || []).filter(r => r.studentId === student?.id);
        let totalPages = 0;
        stRecords.forEach(r => {
            if (r.startPage && r.endPage) {
                totalPages += Math.max(0, parseInt(r.endPage, 10) - parseInt(r.startPage, 10) + 1);
            } else if (r.pagesCount) {
                totalPages += parseInt(r.pagesCount, 10) || 0;
            }
        });
        if (totalPages === 0 && student?.points) {
            // تقدير إذا لم تسجل أرقام صفحات بعد
            totalPages = Math.floor((student.points || 0) / 2);
        }

        window.currentStudent = student;
        container.innerHTML = window.IbdaHub.renderIbdaFullHtml({
            name: student?.name,
            id: student?.id,
            classId: student?.class_id,
            totalPages: totalPages
        });
        window.IbdaHub.loadGems();
    }

    // ==================== VIEW 4: LEADERBOARD ====================
    renderLeaderboard() {
        const list = document.getElementById('studentLeaderboardList');
        const countBadge = document.getElementById('circleStudentsCountBadge');
        if (!list) return;

        const sorted = [...this.students].sort((a, b) => (b.points || 0) - (a.points || 0));
        if (countBadge) countBadge.textContent = `${sorted.length} نجوم بالحلقة`;

        if (sorted.length === 0) {
            list.innerHTML = '<p class="text-center" style="color:var(--text-muted); padding:2rem;">لا يوجد طلاب حالياً بالحلقة</p>';
            return;
        }

        // Group rankings
        const groupPointsMap = {};
        this.students.forEach(st => {
            if (st.groupId) {
                groupPointsMap[st.groupId] = (groupPointsMap[st.groupId] || 0) + (st.points || 0);
            }
        });

        const sortedGroups = (this.groups || [])
            .filter(g => g.classId === this.currentClassId)
            .map(g => ({ ...g, totalPoints: groupPointsMap[g.id] || 0 }))
            .sort((a, b) => b.totalPoints - a.totalPoints);

        let groupLeaderboardHtml = '';
        if (sortedGroups.length > 0) {
            groupLeaderboardHtml = `
                <div style="margin-bottom: 1.5rem; background: rgba(99, 102, 241, 0.06); border: 1px solid rgba(99, 102, 241, 0.25); border-radius: var(--radius-md); padding: 1rem;">
                    <h3 style="font-size: 0.95rem; margin: 0 0 0.75rem 0; color: #a5b4fc; display: flex; align-items: center; gap: 6px;">
                        <i class="fa-solid fa-people-group"></i>
                        <span>ترتيب الفرق والمجموعات بالحلقة:</span>
                    </h3>
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        ${sortedGroups.map((g, idx) => `
                            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.25); padding: 8px 12px; border-radius: 8px; font-size: 0.88rem;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span style="font-weight: 900; color: ${idx === 0 ? '#fbbf24' : '#94a3b8'};">#${idx + 1}</span>
                                    <span>${g.icon || '🛡️'} <strong>${this.escapeHtml(g.name)}</strong></span>
                                </div>
                                <span style="font-weight: 800; color: #818cf8;">${g.totalPoints} نقطة</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <h3 style="font-size: 0.95rem; margin: 0 0 0.75rem 0; color: var(--gold); display: flex; align-items: center; gap: 6px;">
                    <i class="fa-solid fa-trophy"></i>
                    <span>ترتيب نجوم الحلقة الفردي:</span>
                </h3>
            `;
        }

        list.innerHTML = groupLeaderboardHtml + sorted.map((s, idx) => {
            const rank = idx + 1;
            const isMe = s.id === this.selectedStudentId;
            let rankBadge = `<span class="rank-circle">${rank}</span>`;
            if (rank === 1) rankBadge = `<span class="rank-badge gold"><i class="fa-solid fa-crown"></i> 1</span>`;
            else if (rank === 2) rankBadge = `<span class="rank-badge silver"><i class="fa-solid fa-medal"></i> 2</span>`;
            else if (rank === 3) rankBadge = `<span class="rank-badge bronze"><i class="fa-solid fa-award"></i> 3</span>`;

            return `
                <div class="lb-item ${rank <= 3 ? 'top-three' : ''} ${isMe ? 'is-current-student' : ''}">
                    <div class="lb-rank">${rankBadge}</div>
                    <div class="lb-name">
                        <strong>${this.escapeHtml(s.name)}</strong>
                        ${isMe ? '<span class="you-tag">أنت 🌟</span>' : ''}
                    </div>
                    <div class="lb-score">
                        <i class="fa-solid fa-star"></i>
                        <span>${s.points || 0}</span> نقطة
                    </div>
                </div>
            `;
        }).join('');
    }

    // ==================== UTILS ====================
    showLoading(show) {
        const el = document.getElementById('studentLoading');
        if (el) el.style.display = show ? 'flex' : 'none';
    }

    escapeHtml(str) {
        return String(str || '').replace(/[&<>"']/g, m => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[m]);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.studentPortal = new StudentPortal();
});
