const DB = { USERS: "mathio_users", SESSIONS: "mathio_history", NOW: "mathio_active" };
const ADMIN = { user: "skrody", pass: "toor" };

let state = {
    user: null,
    grade: "1",
    topic: null,
    q: null,
    stats: { correct: 0, streak: 0 },
    chart: null
};

// --- AUTH & INITIALIZATION ---

function init() {
    const saved = localStorage.getItem(DB.NOW);
    if (saved) {
        state.user = JSON.parse(saved);
        renderApp();
    }

    // LOGIN BLOCK: Accounts MUST exist to sign in
    document.getElementById("loginBtn").onclick = () => {
        const u = document.getElementById("loginUsername").value.trim();
        const p = document.getElementById("loginPassword").value;
        const err = document.getElementById("loginError");

        if (u === ADMIN.user && p === ADMIN.pass) {
            doLogin({ username: u, role: "admin" });
        } else {
            const users = JSON.parse(localStorage.getItem(DB.USERS) || "[]");
            const found = users.find(x => x.username === u && x.password === p);
            
            if (found) {
                doLogin({ ...found, role: "student" });
            } else {
                err.textContent = "Invalid username or password.";
            }
        }
    };

    document.getElementById("regBtn").onclick = () => {
        const u = document.getElementById("regUser").value.trim();
        const p = document.getElementById("regPass").value;
        const msg = document.getElementById("regMessage");
        
        if (!u || !p) return msg.textContent = "Fill out all fields.";
        let users = JSON.parse(localStorage.getItem(DB.USERS) || "[]");
        if (users.find(x => x.username === u) || u === ADMIN.user) return msg.textContent = "Username taken.";

        users.push({ username: u, password: p });
        localStorage.setItem(DB.USERS, JSON.stringify(users));
        msg.className = "text-[11px] font-bold text-center text-emerald-600";
        msg.textContent = "Account created! You can now login.";
    };

    document.getElementById("logoutBtn").onclick = () => {
        localStorage.removeItem(DB.NOW);
        location.reload();
    };

    document.getElementById("wipeBtn").onclick = () => {
        if(confirm("Permanently wipe all student data?")) {
            localStorage.clear();
            location.reload();
        }
    };
}

function doLogin(obj) {
    localStorage.setItem(DB.NOW, JSON.stringify(obj));
    location.reload();
}

function renderApp() {
    document.getElementById("loginView").classList.add("hidden");
    document.getElementById("appView").classList.remove("hidden");
    document.getElementById("userDisplay").textContent = state.user.username;

    if (state.user.role === "admin") {
        renderAdmin();
    } else {
        renderStudent();
    }
}

// --- STUDENT LOGIC ---

function renderStudent() {
    document.getElementById("studentView").classList.remove("hidden");
    drawGrades();
    drawTopics();

    document.getElementById("checkBtn").onclick = checkAns;
    document.getElementById("nextBtn").onclick = genQ;
}

function drawGrades() {
    const area = document.getElementById("gradeArea");
    area.innerHTML = "";
    ["1", "2", "3", "4", "5", "6", "7", "8"].forEach(g => {
        const b = document.createElement("button");
        b.textContent = `Grade ${g}`;
        b.className = `px-6 py-2 rounded-2xl text-xs font-black border transition-all shrink-0 ${state.grade === g ? 'active-selection' : 'bg-white text-slate-400 border-slate-100'}`;
        b.onclick = () => { state.grade = g; drawGrades(); if(state.topic) genQ(); };
        area.appendChild(b);
    });
}

function drawTopics() {
    const area = document.getElementById("topicArea");
    area.innerHTML = "";
    ["Addition", "Subtraction", "Multiplication", "Division"].forEach(t => {
        const b = document.createElement("button");
        b.textContent = t;
        b.className = `px-10 py-4 rounded-2xl text-xs font-black border transition-all ${state.topic === t ? 'active-selection' : 'bg-white text-slate-400 border-slate-100'}`;
        b.onclick = () => { state.topic = t; drawTopics(); document.getElementById("workArea").classList.remove("hidden"); genQ(); };
        area.appendChild(b);
    });
}

function genQ() {
    const gNum = parseInt(state.grade);
    let a, b, ans, sym;

    // --- MATH LOGIC FIX: Generate based on state.topic ---
    if (state.topic === "Subtraction") {
        a = Math.floor(Math.random() * (gNum * 10)) + 5;
        b = Math.floor(Math.random() * a);
        ans = a - b; sym = "-";
    } else if (state.topic === "Multiplication") {
        a = Math.floor(Math.random() * 12) + 1;
        b = Math.floor(Math.random() * (gNum + 2)) + 1;
        ans = a * b; sym = "×";
    } else if (state.topic === "Division") {
        b = Math.floor(Math.random() * (gNum + 1)) + 1;
        ans = Math.floor(Math.random() * 12) + 1;
        a = b * ans; sym = "÷";
    } else { // Addition (Default)
        a = Math.floor(Math.random() * (gNum * 10)) + 1;
        b = Math.floor(Math.random() * (gNum * 10)) + 1;
        ans = a + b; sym = "+";
    }

    state.q = { a, b, ans, sym };
    document.getElementById("qText").textContent = `${a} ${sym} ${b} = ?`;
    document.getElementById("ansIn").value = "";
    document.getElementById("ansIn").disabled = false;
    document.getElementById("ansIn").focus();
    document.getElementById("feedback").textContent = "";
    document.getElementById("checkBtn").classList.remove("hidden");
    document.getElementById("nextBtn").classList.add("hidden");
}

function checkAns() {
    const userVal = parseInt(document.getElementById("ansIn").value);
    const correct = userVal === state.q.ans;
    const feed = document.getElementById("feedback");

    document.getElementById("ansIn").disabled = true;
    document.getElementById("checkBtn").classList.add("hidden");
    document.getElementById("nextBtn").classList.remove("hidden");

    if (correct) {
        state.stats.correct++;
        state.stats.streak++;
        feed.textContent = "✓ Correct! Great job.";
        feed.className = "text-emerald-500 font-black";
        log(true);
    } else {
        state.stats.streak = 0;
        feed.textContent = `✗ Not quite. The answer was ${state.q.ans}`;
        feed.className = "text-rose-500 font-black";
        log(false);
    }
    document.getElementById("sCorrect").textContent = state.stats.correct;
    document.getElementById("sStreak").textContent = state.stats.streak;
}

function log(isC) {
    const history = JSON.parse(localStorage.getItem(DB.SESSIONS) || "[]");
    history.push({
        u: state.user.username,
        d: new Date().toISOString().split('T')[0],
        c: isC ? 1 : 0,
        ts: Date.now()
    });
    localStorage.setItem(DB.SESSIONS, JSON.stringify(history));
}

// --- ADMIN LOGIC ---

function renderAdmin() {
    document.getElementById("adminView").classList.remove("hidden");
    const users = JSON.parse(localStorage.getItem(DB.USERS) || "[]");
    const container = document.getElementById("adminStudentList");
    container.innerHTML = "";

    users.forEach(u => {
        const b = document.createElement("button");
        b.textContent = u.username;
        b.className = "w-full text-left p-5 rounded-2xl bg-white border border-slate-100 hover:border-sky-500 font-black text-sm transition-all shadow-sm";
        b.onclick = () => showChart(u.username);
        container.appendChild(b);
    });
}

function showChart(name) {
    document.getElementById("adminStudentName").textContent = name;
    const all = JSON.parse(localStorage.getItem(DB.SESSIONS) || "[]");
    const mine = all.filter(x => x.u === name);
    
    const days = Array.from({length: 10}, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (9 - i));
        return d.toISOString().split('T')[0];
    });

    const dataPoints = days.map(day => {
        const sessions = mine.filter(m => m.d === day);
        if(!sessions.length) return null;
        return (sessions.filter(s => s.c === 1).length / sessions.length) * 100;
    });

    const ctx = document.getElementById('adminChart').getContext('2d');
    if(state.chart) state.chart.destroy();
    state.chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: days.map(d => d.slice(5)),
            datasets: [{ 
                label: 'Accuracy %', 
                data: dataPoints, 
                borderColor: '#0ea5e9', 
                backgroundColor: 'rgba(14, 165, 233, 0.1)',
                tension: 0.4, 
                fill: true,
                spanGaps: true 
            }]
        },
        options: { 
            plugins: { legend: { display: false } },
            scales: { y: { min: 0, max: 100 } } 
        }
    });
}

init();
