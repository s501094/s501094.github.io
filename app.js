// --- Data configuration -------------------------------------------------
const gradeConfig = {
    K: { label: "Kindergarten", topics: [{ id: "counting", label: "Counting & Next Number" }, { id: "addition", label: "Addition to 10" }, { id: "subtraction", label: "Subtraction to 10" }] },
    1: { label: "1st Grade", topics: [{ id: "addition", label: "Addition to 20" }, { id: "subtraction", label: "Subtraction to 20" }, { id: "mixed_operations", label: "Mixed Practice" }] },
    2: { label: "2nd Grade", topics: [{ id: "addition", label: "2-digit Addition" }, { id: "subtraction", label: "2-digit Subtraction" }, { id: "multiplication", label: "Intro Multiplication" }] },
    3: { label: "3rd Grade", topics: [{ id: "multiplication", label: "Times Tables" }, { id: "division", label: "Basic Division" }, { id: "mixed_operations", label: "Mix of 4 Ops" }] },
    4: { label: "4th Grade", topics: [{ id: "multiplication", label: "Multi-digit ×" }, { id: "division", label: "Multi-digit ÷" }, { id: "fractions", label: "Fractions" }] },
    5: { label: "5th Grade", topics: [{ id: "fractions", label: "Add/Sub Fractions" }, { id: "decimals", label: "Decimals" }, { id: "percentages", label: "Percents" }] },
    6: { label: "6th Grade", topics: [{ id: "integers", label: "Integers" }, { id: "fractions", label: "Fractions" }, { id: "ratios_proportions", label: "Ratios & Rates" }] },
    7: { label: "7th Grade", topics: [{ id: "integers", label: "Integers" }, { id: "equations_one_step", label: "1-Step Equations" }, { id: "geometry_area_perimeter", label: "Area & Perimeter" }] },
    8: { label: "8th Grade", topics: [{ id: "equations_two_step", label: "2-Step Equations" }, { id: "linear_functions", label: "Linear Functions" }, { id: "geometry_pythagorean", label: "Pythagorean" }] },
    9: { label: "9th Grade (Algebra I)", topics: [{ id: "equations_two_step", label: "Solve Equations" }, { id: "linear_functions", label: "Slope & Lines" }, { id: "exponents", label: "Exponents" }] },
    10: { label: "10th Grade (Geometry)", topics: [{ id: "geometry_area_perimeter", label: "Area & Perimeter" }, { id: "geometry_pythagorean", label: "Right Triangles" }, { id: "ratios_proportions", label: "Similarity & Scale" }] },
    11: { label: "11th Grade (Algebra II)", topics: [{ id: "quadratics", label: "Quadratics" }, { id: "exponents", label: "Exponential" }, { id: "linear_functions", label: "Functions" }] },
    12: { label: "12th Grade (Trig & Calc)", topics: [{ id: "trigonometry_basic_angles", label: "Trig Angles" }, { id: "calculus_derivatives_basic", label: "Derivatives" }, { id: "exponents", label: "Power Rules" }] },
};

const modeConfig = {
    practice: { label: "Practice", description: "Practice at your own pace", timed: false },
    timed: { label: "Timed", description: "Beat the clock in short sprints", timed: true, seconds: 60 },
    challenge: { label: "Challenge Mix", description: "Mixed questions with a 90s timer", timed: true, seconds: 90 },
};

// --- Question generators -----------------------------------------------
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function makeNumeric(answer, tolerance = 0) { return { answer, isNumeric: true, tolerance }; }
function makeText(answer) { return { answer: String(answer), isNumeric: false, tolerance: 0 }; }

function isYoungerGrade(grade) {
    if (grade === "K") return true;
    const n = parseInt(grade, 10);
    return !Number.isNaN(n) && n <= 3;
}

function createNumericChoices(answer, tolerance = 0) {
    const choices = new Set();
    choices.add(answer);
    while (choices.size < 4) {
        const delta = randInt(-3, 3) || 1;
        let option = answer + delta;
        choices.add(option);
    }
    return Array.from(choices).sort(() => Math.random() - 0.5);
}

function withMaybeMultipleChoiceNumeric(baseQuestion, grade) {
    if (!isYoungerGrade(grade)) return { ...baseQuestion, type: "input" };
    const choices = createNumericChoices(baseQuestion.answer);
    return { ...baseQuestion, type: "mc", choices, correctIndex: choices.indexOf(baseQuestion.answer) };
}

// Generators
function generateAdditionQuestion(grade) {
    let a = randInt(0, grade === "K" ? 5 : 20), b = randInt(0, grade === "K" ? 5 : 20);
    return withMaybeMultipleChoiceNumeric({ text: `${a} + ${b} = ?`, ...makeNumeric(a + b), explanation: `Sum of ${a} and ${b} is ${a + b}` }, grade);
}

function generateMultiplicationQuestion(grade) {
    let a = randInt(0, 12), b = randInt(0, 12);
    return withMaybeMultipleChoiceNumeric({ text: `${a} × ${b} = ?`, ...makeNumeric(a * b), explanation: `${a} times ${b} is ${a * b}` }, grade);
}

// Simplified topic map for brevity
const topicGenerators = {
    counting: (grade) => { const n = randInt(0, 9); return withMaybeMultipleChoiceNumeric({ text: `What is after ${n}?`, ...makeNumeric(n + 1) }, grade); },
    addition: generateAdditionQuestion,
    multiplication: generateMultiplicationQuestion,
    mixed_operations: (grade) => generateAdditionQuestion(grade) // Default fallback
};

// --- State and persistence ---------------------------------------------
const STORAGE_KEYS = { sessions: "math_journey_sessions_v2", users: "math_journey_users_v1", currentUser: "math_journey_current_user_v1" };

const appState = {
    grade: "3", topicId: null, mode: "practice", currentQuestion: null,
    stats: { correct: 0, total: 0, streak: 0 },
    timer: { remaining: null, intervalId: null },
    currentUser: null, allSessions: [], sessions: []
};

// --- Helpers & UI -------------------------------------------------------
const el = (id) => document.getElementById(id);

function updateStatsUI() {
    const { correct, total, streak } = appState.stats;
    const accuracy = total ? Math.round((correct / total) * 100) : 0;
    el("statCorrect").textContent = correct;
    el("statAccuracy").textContent = `${accuracy}%`;
    el("statStreak").textContent = `${streak}🔥`;
    el("masteryBar").style.width = `${accuracy}%`;
}

function generateQuestion() {
    if (!appState.topicId) return;
    const gen = topicGenerators[appState.topicId] || topicGenerators['addition'];
    const q = gen(appState.grade);
    appState.currentQuestion = q;
    el("questionText").textContent = q.text;
    el("answerInput").value = "";
    el("feedbackText").textContent = "";
    el("nextQuestionBtn").disabled = true;

    if (q.type === "mc") {
        el("inputModeContainer").classList.add("hidden");
        el("multipleChoiceContainer").innerHTML = "";
        q.choices.forEach((choice, i) => {
            const btn = document.createElement("button");
            btn.className = "w-full px-4 py-2 rounded-2xl border bg-white text-sm font-semibold";
            btn.textContent = choice;
            btn.onclick = () => handleAnswer(i);
            el("multipleChoiceContainer").appendChild(btn);
        });
    } else {
        el("inputModeContainer").classList.remove("hidden");
        el("answerInput").disabled = false;
        el("checkAnswerBtn").disabled = false;
    }
}

function handleAnswer(provided) {
    const q = appState.currentQuestion;
    let isCorrect = false;
    if (q.type === "mc") {
        isCorrect = provided === q.correctIndex;
    } else {
        isCorrect = parseInt(el("answerInput").value) === q.answer;
    }

    appState.stats.total++;
    if (isCorrect) {
        appState.stats.correct++;
        appState.stats.streak++;
        el("feedbackText").textContent = "Correct!";
        el("feedbackText").className = "text-emerald-600 font-bold";
        el("nextQuestionBtn").disabled = false;
    } else {
        appState.stats.streak = 0;
        el("feedbackText").textContent = `Wrong! Answer was ${q.answer}`;
        el("feedbackText").className = "text-rose-600 font-bold";
    }
    updateStatsUI();
}

// --- Initialization ----------------------------------------------------
function init() {
    // Grade buttons
    const grades = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
    grades.forEach(g => {
        const btn = document.createElement("button");
        btn.textContent = g;
        btn.className = "grade-btn px-3 py-1 bg-white/60 rounded-xl text-sm font-bold";
        btn.onclick = () => { appState.grade = g; generateQuestion(); };
        el("gradeButtons").appendChild(btn);
    });

    // Simple login toggle for demo
    el("loginBtn").onclick = () => {
        appState.currentUser = { username: el("loginUsername").value || "Student" };
        el("loginView").classList.add("hidden");
        el("appView").classList.remove("hidden");
        el("currentUserLabel").textContent = appState.currentUser.username;
    };

    el("logoutBtn").onclick = () => location.reload();

    // Topic Selection logic
    const topicList = gradeConfig["3"].topics; // Defaulting to grade 3 for demo buttons
    topicList.forEach(t => {
        const btn = document.createElement("button");
        btn.textContent = t.label;
        btn.className = "px-4 py-2 bg-sky-100 rounded-full text-xs font-bold";
        btn.onclick = () => { 
            appState.topicId = t.id; 
            el("resetSessionBtn").disabled = false;
            generateQuestion(); 
        };
        el("topicButtons").appendChild(btn);
    });

    el("checkAnswerBtn").onclick = () => handleAnswer();
    el("nextQuestionBtn").onclick = () => generateQuestion();
}

init();
