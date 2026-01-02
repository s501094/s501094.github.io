const DB_KEYS = { USERS: "mathio_users", SESSIONS: "mathio_sessions", CURRENT: "mathio_now" };
const ADMIN = { user: "skrody", pass: "toor" };

let state = {
    user: null,
    grade: "1",
    topic: null,
    q: null,
    stats: { correct: 0, streak: 0 },
    chart: null
};

// --- AUTHENTICATION ---

function init() {
    const saved = localStorage.getItem(DB_KEYS.CURRENT);
    if (saved) {
        state.user = JSON.parse(saved);
        renderApp();
    }

    // Login logic - SECURITY BLOCK ADDED
    document.getElementById("loginBtn").onclick = () => {
        const u = document.getElementById("loginUsername").value.trim();
        const p = document.getElementById("loginPassword").value;
        const err = document.getElementById("loginError");

        if (u === ADMIN.user && p === ADMIN.pass) {
            doLogin({ username: u, role: "admin" });
        } else {
            const users = JSON.parse(localStorage.getItem(DB_KEYS.USERS) || "[]");
            const found = users.find(x => x.username === u && x.password === p);
            
            if (found) {
                doLogin({ ...found, role: "student" });
            } else {
                err.textContent = "Account not found or wrong password.";
            }
        }
    };

    document.getElementById("regBtn").onclick = () => {
        const u = document.getElementById("regUser").value.trim();
        const p = document.getElementById("regPass").value;
        const msg = document.getElementById("regMessage");
        
        if (!u || !p) return msg.textContent = "Fill all fields.";
        let users = JSON.parse(localStorage.getItem(DB_KEYS.USERS) || "[]");
        if (users.find(x => x.username === u) || u === ADMIN.user) return msg.textContent = "Username taken.";

        users.push({ username: u, password: p });
        localStorage.setItem(DB_KEYS.USERS, JSON.stringify(users));
        msg.className = "text-[11px] font-bold text-center text-emerald-600";
        msg.textContent = "Registered! Now login above.";
    };

    document.getElementById("logoutBtn").onclick = () => {
        localStorage.removeItem(DB_KEYS.CURRENT);
        location.reload();
    };

    document.getElementById("wipeBtn").onclick = () => {
        if(confirm("Wipe all student data?")) {
            localStorage.removeItem(DB_KEYS.USERS);
            localStorage.removeItem(DB_KEYS.SESSIONS);
            location.reload();
        }
    };
}

function doLogin(userObj) {
    localStorage.setItem(DB_KEYS.CURRENT, JSON.stringify(userObj));
    location.reload();
}

// --- VIEW CONTROLLER ---

function renderApp() {
    document.getElementById("loginView").classList.add("hidden");
    document.getElementById("appView").classList.remove("hidden");
    document.getElementById("userDisplay").textContent = state.user.username.toUpperCase();

    if (state.user.role === "admin") {
        renderAdmin();
    } else {
        renderStudent();
    }
}

// --- STUDENT LOGIC ---

function renderStudent() {
    document.getElementById("studentView").classList.remove("hidden");
    renderGradeButtons();
    renderTopicButtons();

    document.getElementById("checkBtn").onclick = checkAnswer;
    document.getElementById("nextBtn").onclick = nextQuestion;
}

function renderGradeButtons() {
    const area = document.getElementById("gradeArea");
    area.innerHTML = "";
    ["1", "2", "3", "4", "5", "6", "7", "8"].forEach(g => {
        const b = document.createElement("button");
        b.textContent = `Grade ${g}`;
        b.className = `px-4 py-1 rounded-full text-xs font-bold border border-slate-200 transition shrink-0 ${state.grade === g ? 'active-btn' : 'bg-white'}`;
        b.onclick = () => { state.grade = g; renderGradeButtons(); };
        area.appendChild(b);
    });
}

function renderTopicButtons() {
    const area = document.getElementById("topicArea");
    area.innerHTML = "";
    ["Addition", "Subtraction", "Multiplication", "Division"].forEach(t => {
        const b = document.createElement("button");
        b.textContent = t;
        b.className = `px-6 py-2 rounded-xl text-xs font-bold border transition ${state.topic === t ? 'active-btn' : 'bg-sky-50 text-sky-700 border-sky-100'}`;
        b.onclick = () => { state.topic = t; renderTopicButtons(); startPractice(); };
        area.appendChild(b);
    });
}

function startPractice() {
    document.getElementById("workArea").classList.remove("hidden");
    nextQuestion();
}

function nextQuestion() {
    const a = Math.floor(Math.random() * 12), b = Math.floor(Math.random() * 12);
    state.q = { a, b, ans: a + b }; // Example logic, extend based on topic
    document.getElementById("qText").textContent = `${a} + ${b} = ?`;
    document.getElementById("ansIn").value = "";
    document.getElementById("ansIn").disabled = false;
    document.getElementById("feedback").textContent = "";
    document.getElementById("checkBtn").classList.remove("hidden");
    document.getElementById("nextBtn").classList.add("hidden");
}

function checkAnswer() {
    const userVal = parseInt(document.getElementById("ansIn").value);
    const correct = userVal === state.q.ans;
    const feed = document.getElementById("feedback");

    document.getElementById("ansIn").disabled = true;
    document.getElementById("checkBtn").classList.add("hidden");
    document.getElementById("nextBtn").classList.remove("hidden");

    if (correct) {
        state.stats.correct++;
        state.stats.streak++;
        feed.textContent = "✓ Excellent!";
        feed.className = "text-emerald-500 font-bold";
        logSession(true);
    } else {
        state.stats.streak = 0;
        feed.textContent = `✗ Not quite. Correct answer: ${state.q.ans}`;
        feed.className = "text-rose-500 font-bold";
        logSession(false);
    }
    document.getElementById("sCorrect").textContent = state.stats.correct;
    document.getElementById("sStreak").textContent = state.stats.streak;
}

function logSession(isCorrect) {
    const sessions = JSON.parse(localStorage.getItem(DB_KEYS.SESSIONS) || "[]");
    sessions.push({
        user: state.user.username,
        date: new Date().toISOString().split('T')[0],
        correct: isCorrect ? 1 : 0,
        total: 1,
        timestamp: Date.now()
    });
    localStorage.setItem(DB_KEYS.SESSIONS, JSON.stringify(sessions));
}

// --- ADMIN LOGIC ---

function renderAdmin() {
    document.getElementById("adminView").classList.remove("hidden");
    const users = JSON.parse(localStorage.getItem(DB_KEYS.USERS) || "[]");
    const list = document.getElementById("adminStudentList");
    list.innerHTML = "";

    users.forEach(u => {
        const b = document.createElement("button");
        b.textContent = u.username;
        b.className = "w-full text-left p-3 rounded-xl bg-white border border-slate-200 hover:border-sky-500 font-bold text-sm transition";
        b.onclick = () => showStudentDetail(u.username);
        list.appendChild(b);
    });
}

function showStudentDetail(name) {
    document.getElementById("adminStudentName").textContent = `Progress: ${name}`;
    const all = JSON.parse(localStorage.getItem(DB_KEYS.SESSIONS) || "[]");
    const mine = all.filter(x => x.user === name);
    
    // Graph Logic (Last 10 days)
    const days = Array.from({length: 10}, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (9 - i));
        return d.toISOString().split('T')[0];
    });

    const data = days.map(day => {
        const hits = mine.filter(m => m.date === day);
        if(!hits.length) return null;
        return (hits.filter(h => h.correct === 1).length / hits.length) * 100;
    });

    const ctx = document.getElementById('adminChart').getContext('2d');
    if(state.chart) state.chart.destroy();
    state.chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: days.map(d => d.slice(5)),
            datasets: [{ label: 'Accuracy %', data: data, borderColor: '#0ea5e9', tension: 0.3, spanGaps: true }]
        },
        options: { scales: { y: { min: 0, max: 100 } } }
    });
}

init();
