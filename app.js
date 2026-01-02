const DB = { USERS: "mathio_u", SESSIONS: "mathio_s", NOW: "mathio_login" };
const ADMIN_ACC = { username: "skrody", password: "toor" };

let app = {
    user: null,
    grade: "1",
    topic: null,
    q: null,
    stats: { correct: 0, streak: 0 },
    chart: null
};

// --- AUTH LOGIC ---
function init() {
    const session = localStorage.getItem(DB.NOW);
    if (session) {
        app.user = JSON.parse(session);
        renderApp();
    }

    document.getElementById("loginBtn").onclick = () => {
        const u = document.getElementById("loginUsername").value.trim();
        const p = document.getElementById("loginPassword").value;
        const err = document.getElementById("loginError");

        // Admin Bypass
        if (u === ADMIN_ACC.username && p === ADMIN_ACC.password) {
            login({ username: u, role: "admin" });
            return;
        }

        // Student Check
        const users = JSON.parse(localStorage.getItem(DB.USERS) || "[]");
        const found = users.find(x => x.username === u && x.password === p);
        
        if (found) {
            login({ ...found, role: "student" });
        } else {
            err.textContent = "Account not found or invalid password.";
        }
    };

    document.getElementById("regBtn").onclick = () => {
        const u = document.getElementById("regUser").value.trim();
        const p = document.getElementById("regPass").value;
        const msg = document.getElementById("regMessage");
        
        if (!u || !p) return msg.textContent = "Please fill in all fields.";
        let users = JSON.parse(localStorage.getItem(DB.USERS) || "[]");
        if (users.find(x => x.username === u) || u === ADMIN_ACC.username) return msg.textContent = "Username taken.";

        users.push({ username: u, password: p });
        localStorage.setItem(DB.USERS, JSON.stringify(users));
        msg.className = "text-[11px] font-bold text-center text-emerald-600";
        msg.textContent = "Account created! You can now Sign In.";
    };

    document.getElementById("logoutBtn").onclick = () => {
        localStorage.removeItem(DB.NOW);
        location.reload();
    };

    document.getElementById("wipeBtn").onclick = () => {
        if(confirm("Permanently wipe all student data?")) {
            localStorage.removeItem(DB.USERS);
            localStorage.removeItem(DB.SESSIONS);
            location.reload();
        }
    };
}

function login(obj) {
    localStorage.setItem(DB.NOW, JSON.stringify(obj));
    location.reload();
}

// --- APP CONTROLLER ---
function renderApp() {
    document.getElementById("loginView").classList.add("hidden");
    document.getElementById("appView").classList.remove("hidden");
    document.getElementById("userDisplay").textContent = app.user.username;

    if (app.user.role === "admin") {
        renderAdminUI();
    } else {
        renderStudentUI();
    }
}

// --- STUDENT VIEW ---
function renderStudentUI() {
    document.getElementById("studentView").classList.remove("hidden");
    drawGradeSelectors();
    drawTopicSelectors();

    document.getElementById("checkBtn").onclick = verifyAnswer;
    document.getElementById("nextBtn").onclick = generateNewQuestion;
}

function drawGradeSelectors() {
    const box = document.getElementById("gradeArea");
    box.innerHTML = "";
    ["1", "2", "3", "4", "5", "6", "7", "8"].forEach(g => {
        const b = document.createElement("button");
        b.textContent = `Grade ${g}`;
        b.className = `px-5 py-2 rounded-2xl text-xs font-bold border transition-all shrink-0 ${app.grade === g ? 'active-selection shadow-lg' : 'bg-white text-slate-500 border-slate-100 hover:border-sky-300'}`;
        b.onclick = () => { app.grade = g; drawGradeSelectors(); if(app.topic) generateNewQuestion(); };
        box.appendChild(b);
    });
}

function drawTopicSelectors() {
    const box = document.getElementById("topicArea");
    box.innerHTML = "";
    ["Addition", "Subtraction", "Multiplication", "Division"].forEach(t => {
        const b = document.createElement("button");
        b.textContent = t;
        b.className = `px-8 py-3 rounded-2xl text-xs font-black border transition-all ${app.topic === t ? 'active-selection shadow-lg' : 'bg-white text-slate-400 border-slate-100 hover:border-sky-300'}`;
        b.onclick = () => { app.topic = t; drawTopicSelectors(); startPracticeFlow(); };
        box.appendChild(b);
    });
}

function startPracticeFlow() {
    document.getElementById("workArea").classList.remove("hidden");
    generateNewQuestion();
}

function generateNewQuestion() {
    const a = Math.floor(Math.random() * 12) + 1;
    const b = Math.floor(Math.random() * 12) + 1;
    
    // Simple math logic per subject
    let ans = a + b;
    let sym = "+";
    if (app.topic === "Subtraction") { ans = a + b - a; sym = "-"; app.q = { a: a+b, b: a, ans: b }; }
    else if (app.topic === "Multiplication") { ans = a * b; sym = "×"; }
    else if (app.topic === "Division") { ans = a; sym = "÷"; app.q = { a: a*b, b: b, ans: a }; }
    else { app.q = { a, b, ans, sym: "+" }; }

    if(app.topic !== "Subtraction" && app.topic !== "Division") {
        app.q = { a, b, ans, sym };
    }

    document.getElementById("qText").textContent = `${app.q.a} ${app.q.sym} ${app.q.b} = ?`;
    document.getElementById("ansIn").value = "";
    document.getElementById("ansIn").disabled = false;
    document.getElementById("ansIn").focus();
    document.getElementById("feedback").textContent = "";
    document.getElementById("checkBtn").classList.remove("hidden");
    document.getElementById("nextBtn").classList.add("hidden");
}

function verifyAnswer() {
    const input = parseInt(document.getElementById("ansIn").value);
    const correct = input === app.q.ans;
    const feedback = document.getElementById("feedback");

    document.getElementById("ansIn").disabled = true;
    document.getElementById("checkBtn").classList.add("hidden");
    document.getElementById("nextBtn").classList.remove("hidden");

    if (correct) {
        app.stats.correct++;
        app.stats.streak++;
        feedback.textContent = "✓ Perfect! Well done.";
        feedback.className = "text-emerald-500 font-bold animate-bounce";
        saveProgress(true);
    } else {
        app.stats.streak = 0;
        feedback.textContent = `✗ Not quite. The answer was ${app.q.ans}`;
        feedback.className = "text-rose-500 font-bold";
        saveProgress(false);
    }
    document.getElementById("sCorrect").textContent = app.stats.correct;
    document.getElementById("sStreak").textContent = app.stats.streak;
}

function saveProgress(isCorrect) {
    const data = JSON.parse(localStorage.getItem(DB.SESSIONS) || "[]");
    data.push({
        u: app.user.username,
        d: new Date().toISOString().split('T')[0],
        c: isCorrect ? 1 : 0,
        ts: Date.now()
    });
    localStorage.setItem(DB.SESSIONS, JSON.stringify(data));
}

// --- ADMIN VIEW ---
function renderAdminUI() {
    document.getElementById("adminView").classList.remove("hidden");
    const users = JSON.parse(localStorage.getItem(DB.USERS) || "[]");
    const list = document.getElementById("adminStudentList");
    list.innerHTML = "";

    users.forEach(u => {
        const b = document.createElement("button");
        b.innerHTML = `<span class="text-slate-800">${u.username}</span>`;
        b.className = "w-full text-left px-5 py-4 rounded-2xl bg-white border border-slate-100 hover:border-sky-400 hover:shadow-md font-bold text-sm transition-all";
        b.onclick = () => loadStudentChart(u.username);
        list.appendChild(b);
    });
}

function loadStudentChart(name) {
    document.getElementById("adminStudentName").textContent = name;
    const history = JSON.parse(localStorage.getItem(DB.SESSIONS) || "[]").filter(x => x.u === name);
    
    const days = Array.from({length: 10}, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (9 - i));
        return d.toISOString().split('T')[0];
    });

    const stats = days.map(day => {
        const sessions = history.filter(h => h.d === day);
        if(!sessions.length) return null;
        return (sessions.filter(s => s.c === 1).length / sessions.length) * 100;
    });

    const ctx = document.getElementById('adminChart').getContext('2d');
    if(app.chart) app.chart.destroy();
    app.chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: days.map(d => d.slice(5)),
            datasets: [{ 
                label: 'Avg Accuracy (%)', 
                data: stats, 
                borderColor: '#0ea5e9', 
                backgroundColor: 'rgba(14, 165, 233, 0.1)',
                tension: 0.4, 
                fill: true,
                spanGaps: true 
            }]
        },
        options: { 
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { min: 0, max: 100 } } 
        }
    });
}

init();
