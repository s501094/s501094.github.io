const STORAGE_KEYS = {
    USERS: "mathio_users",
    SESSIONS: "mathio_sessions",
    LOGGED_IN_USER: "mathio_current_user"
};

const ADMIN_CREDS = { username: "skrody", pass: "toor" };

const appState = {
    currentUser: null,
    grade: "1",
    topicId: null,
    stats: { correct: 0, total: 0, streak: 0 },
    currentQuestion: null,
    chart: null
};

// --- Authentication ---

function initAuth() {
    const saved = localStorage.getItem(STORAGE_KEYS.LOGGED_IN_USER);
    if (saved) {
        appState.currentUser = JSON.parse(saved);
        showApp();
    }

    document.getElementById("loginBtn").onclick = () => {
        const u = document.getElementById("loginUsername").value.trim();
        const p = document.getElementById("loginPassword").value;
        const msg = document.getElementById("loginMessage");

        if (u === ADMIN_CREDS.username && p === ADMIN_CREDS.pass) {
            login({ username: u, role: "admin" });
        } else {
            const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || "[]");
            const found = users.find(user => user.username === u && user.password === p);
            if (found) login({ ...found, role: "student" });
            else msg.textContent = "Invalid credentials.";
        }
    };

    document.getElementById("registerBtn").onclick = () => {
        const u = document.getElementById("registerUsername").value.trim();
        const p = document.getElementById("registerPassword").value;
        const c = document.getElementById("registerPasswordConfirm").value;
        const msg = document.getElementById("registerMessage");

        if (!u || !p) return msg.textContent = "Fill all fields.";
        if (p !== c) return msg.textContent = "Passwords mismatch.";
        
        let users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || "[]");
        if (users.find(user => user.username === u) || u === ADMIN_CREDS.username) return msg.textContent = "Username taken.";

        users.push({ username: u, password: p });
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        msg.className = "text-emerald-600";
        msg.textContent = "Account created! Now sign in.";
    };

    document.getElementById("logoutBtn").onclick = () => {
        localStorage.removeItem(STORAGE_KEYS.LOGGED_IN_USER);
        location.reload();
    };
}

function login(user) {
    localStorage.setItem(STORAGE_KEYS.LOGGED_IN_USER, JSON.stringify(user));
    location.reload();
}

function showApp() {
    document.getElementById("loginView").classList.add("hidden");
    document.getElementById("appView").classList.remove("hidden");
    document.getElementById("currentUserLabel").textContent = appState.currentUser.username === ADMIN_CREDS.username ? "ADMIN: SKRODY" : `STUDENT: ${appState.currentUser.username}`;

    if (appState.currentUser.role === "admin") {
        document.getElementById("studentWorkspace").classList.add("hidden");
        document.getElementById("studentStats").classList.add("hidden");
        document.getElementById("sidebar").classList.replace("lg:col-span-1", "lg:col-span-3");
        initAdminDashboard();
    } else {
        initStudentUI();
        renderStudentHistory();
    }
}

// --- Admin Dashboard Logic ---

function initAdminDashboard() {
    const adminPanel = document.getElementById("adminPanel");
    adminPanel.classList.remove("hidden");

    const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || "[]");
    const sessions = JSON.parse(localStorage.getItem(STORAGE_KEYS.SESSIONS) || "[]");
    const list = document.getElementById("adminStudentsList");

    users.forEach(student => {
        const studentSessions = sessions.filter(s => s.username === student.username);
        const card = document.createElement("div");
        card.className = "p-4 bg-indigo-50 rounded-2xl border border-indigo-100 cursor-pointer hover:bg-indigo-100 transition";
        card.innerHTML = `
            <p class="font-bold text-indigo-900">${student.username}</p>
            <p class="text-xs text-slate-500">${studentSessions.length} total sessions</p>
        `;
        card.onclick = () => updateProgressChart(student.username, studentSessions);
        list.appendChild(card);
    });

    if (users.length > 0) updateProgressChart(users[0].username, sessions.filter(s => s.username === users[0].username));
}

function updateProgressChart(username, studentSessions) {
    const ctx = document.getElementById('adminProgressChart').getContext('2d');
    
    // Generate last 10 days
    const days = Array.from({length: 10}, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (9 - i));
        return d.toISOString().split('T')[0];
    });

    const accuracyData = days.map(day => {
        const daySessions = studentSessions.filter(s => new Date(s.timestamp).toISOString().split('T')[0] === day);
        if (!daySessions.length) return null;
        // Average the accuracy of all sessions on that day
        return daySessions.reduce((acc, s) => acc + (s.correct / s.total), 0) / daySessions.length * 100;
    });

    if (appState.chart) appState.chart.destroy();

    appState.chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: days.map(d => d.slice(5)), // MM-DD
            datasets: [{
                label: `${username}'s Accuracy (%)`,
                data: accuracyData,
                borderColor: '#6366f1',
                tension: 0.3,
                fill: true,
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                spanGaps: true
            }]
        },
        options: {
            scales: { y: { min: 0, max: 100 } }
        }
    });
}

// --- Student Practice Logic ---

function initStudentUI() {
    const gradeContainer = document.getElementById("gradeButtons");
    ["1", "2", "3", "4", "5", "6", "7", "8"].forEach(g => {
        const btn = document.createElement("button");
        btn.textContent = `Grade ${g}`;
        btn.className = "px-4 py-1 bg-white border border-slate-200 rounded-full text-xs font-bold shrink-0";
        btn.onclick = () => { appState.grade = g; };
        gradeContainer.appendChild(btn);
    });

    const topicContainer = document.getElementById("topicButtons");
    ["Addition", "Subtraction", "Multiplication", "Division"].forEach(t => {
        const btn = document.createElement("button");
        btn.textContent = t;
        btn.className = "px-4 py-2 bg-sky-100 rounded-xl text-xs font-bold";
        btn.onclick = () => startSession(t);
        topicContainer.appendChild(btn);
    });

    document.getElementById("checkAnswerBtn").onclick = checkAnswer;
}

function startSession(topic) {
    appState.topicId = topic;
    appState.stats = { correct: 0, total: 0, streak: 0 };
    document.getElementById("inputModeContainer").classList.remove("hidden");
    generateQuestion();
}

function generateQuestion() {
    const a = Math.floor(Math.random() * 10), b = Math.floor(Math.random() * 10);
    appState.currentQuestion = { text: `${a} + ${b} = ?`, answer: a + b };
    document.getElementById("questionText").textContent = appState.currentQuestion.text;
    document.getElementById("answerInput").value = "";
    document.getElementById("feedbackText").textContent = "";
}

function checkAnswer() {
    const val = parseInt(document.getElementById("answerInput").value);
    const correct = val === appState.currentQuestion.answer;
    
    appState.stats.total++;
    if (correct) {
        appState.stats.correct++;
        appState.stats.streak++;
        document.getElementById("feedbackText").className = "text-emerald-600";
        document.getElementById("feedbackText").textContent = "Correct!";
        saveSession();
        generateQuestion();
    } else {
        appState.stats.streak = 0;
        document.getElementById("feedbackText").className = "text-rose-600";
        document.getElementById("feedbackText").textContent = "Try again!";
    }
    updateStatsUI();
}

function updateStatsUI() {
    document.getElementById("statCorrect").textContent = appState.stats.correct;
    document.getElementById("statStreak").textContent = appState.stats.streak;
}

function saveSession() {
    const sessions = JSON.parse(localStorage.getItem(STORAGE_KEYS.SESSIONS) || "[]");
    sessions.push({
        username: appState.currentUser.username,
        grade: appState.grade,
        topic: appState.topicId,
        correct: appState.stats.correct,
        total: appState.stats.total,
        timestamp: Date.now()
    });
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    renderStudentHistory();
}

function renderStudentHistory() {
    const sessions = JSON.parse(localStorage.getItem(STORAGE_KEYS.SESSIONS) || "[]");
    const mine = sessions.filter(s => s.username === appState.currentUser.username).reverse().slice(0, 5);
    const list = document.getElementById("sessionsList");
    list.innerHTML = mine.map(s => `
        <div class="text-[10px] p-2 bg-white/50 rounded-lg border border-slate-100 flex justify-between">
            <span>${s.topic} (G${s.grade})</span>
            <span class="font-bold">${s.correct}/${s.total}</span>
        </div>
    `).join('');
}

initAuth();
