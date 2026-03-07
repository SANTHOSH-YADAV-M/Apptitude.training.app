 const authSection = document.getElementById("authSection");
const userSection = document.getElementById("userSection");
const welcomeText = document.getElementById("welcomeText");

const regName = document.getElementById("regName");
const regEmail = document.getElementById("regEmail");
const regPassword = document.getElementById("regPassword");
const registerBtn = document.getElementById("registerBtn");

const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");

const topicSelect = document.getElementById("topicSelect");
const difficultySelect = document.getElementById("difficultySelect");
const questionCount = document.getElementById("questionCount");
const timeSelect = document.getElementById("timeSelect");
const startBtn = document.getElementById("startBtn");

const quizContainer = document.getElementById("quizContainer");
const resultContainer = document.getElementById("resultContainer");
const myResults = document.getElementById("myResults");

const questionTracker = document.getElementById("questionTracker");
const timer = document.getElementById("timer");

const navButtons = document.getElementById("navButtons");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const submitBtn = document.getElementById("submitBtn");

let currentQuestions = [];
let currentIndex = 0;
let userAnswers = {};
let examActive = false;
let timerInterval = null;
let timeLeft = 0;
let submittedAlready = false;
let currentTopicId = null;
let currentDifficulty = "All";

registerBtn.addEventListener("click", registerUser);
loginBtn.addEventListener("click", loginUser);
logoutBtn.addEventListener("click", logoutUser);
startBtn.addEventListener("click", startExam);
prevBtn.addEventListener("click", prevQuestion);
nextBtn.addEventListener("click", nextQuestion);
submitBtn.addEventListener("click", () => submitExam(false, null));

async function registerUser() {
  const payload = {
    full_name: regName.value.trim(),
    email: regEmail.value.trim(),
    password: regPassword.value.trim()
  };

  const res = await fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  alert(data.message || data.error);
}

async function loginUser() {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: loginEmail.value.trim(),
      password: loginPassword.value.trim()
    })
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Login failed");
    return;
  }

  if (data.user.is_admin) {
    window.location.href = "/admin";
    return;
  }

  await loadSession();
}

async function logoutUser() {
  await fetch("/api/logout", { method: "POST" });
  location.reload();
}

async function loadSession() {
  const res = await fetch("/api/session");
  const data = await res.json();

  if (!data.loggedIn) {
    authSection.classList.remove("hidden");
    userSection.classList.add("hidden");
    return;
  }

  if (data.user.is_admin) {
    window.location.href = "/admin";
    return;
  }

  authSection.classList.add("hidden");
  userSection.classList.remove("hidden");
  welcomeText.textContent = `Welcome, ${data.user.full_name}`;
  await loadTopics();
  await loadMyResults();
}

async function loadTopics() {
  const res = await fetch("/api/topics");
  const data = await res.json();

  topicSelect.innerHTML = `<option value="">-- Select Topic --</option>`;

  data.forEach(topic => {
    const option = document.createElement("option");
    option.value = topic.topic_id;
    option.textContent = topic.topic_name;
    topicSelect.appendChild(option);
  });
}

async function loadMyResults() {
  const res = await fetch("/api/my-results");
  const rows = await res.json();

  if (!Array.isArray(rows) || rows.length === 0) {
    myResults.innerHTML = `<p>No results yet.</p>`;
    return;
  }

  let html = `<div class="table-wrap"><table>
    <thead>
      <tr>
        <th>Topic</th>
        <th>Difficulty</th>
        <th>Score</th>
        <th>Attempted</th>
        <th>Total</th>
        <th>Auto Terminated</th>
        <th>Date</th>
      </tr>
    </thead><tbody>`;

  rows.forEach(r => {
    html += `
      <tr>
        <td>${r.topic_name}</td>
        <td>${r.difficulty}</td>
        <td>${r.score}</td>
        <td>${r.attempted_questions}</td>
        <td>${r.total_questions}</td>
        <td>${r.auto_terminated ? "Yes" : "No"}</td>
        <td>${new Date(r.submitted_at).toLocaleString()}</td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  myResults.innerHTML = html;
}

async function startExam() {
  const topicId = topicSelect.value;
  const difficulty = difficultySelect.value;
  const limit = questionCount.value;
  const selectedTime = parseInt(timeSelect.value);

  if (!topicId) {
    alert("Select a topic first.");
    return;
  }

  const res = await fetch(`/api/questions?topicId=${topicId}&difficulty=${difficulty}&limit=${limit}`);
  const questions = await res.json();

  if (!Array.isArray(questions) || questions.length === 0) {
    alert("No questions found for this selection.");
    return;
  }

  currentQuestions = questions;
  currentIndex = 0;
  userAnswers = {};
  currentTopicId = topicId;
  currentDifficulty = difficulty;
  examActive = true;
  submittedAlready = false;
  timeLeft = selectedTime;

  resultContainer.innerHTML = "";
  navButtons.classList.remove("hidden");

  startTimer();
  showQuestion();
}

function showQuestion() {
  const q = currentQuestions[currentIndex];
  const saved = userAnswers[q.question_id] || "";

  questionTracker.textContent = `Question ${currentIndex + 1} of ${currentQuestions.length}`;

  quizContainer.innerHTML = `
    <div class="question-card">
      <h3>${q.question_text}</h3>

      <div class="option"><label><input type="radio" name="ans" value="A" ${saved === "A" ? "checked" : ""}> A. ${q.option_a}</label></div>
      <div class="option"><label><input type="radio" name="ans" value="B" ${saved === "B" ? "checked" : ""}> B. ${q.option_b}</label></div>
      <div class="option"><label><input type="radio" name="ans" value="C" ${saved === "C" ? "checked" : ""}> C. ${q.option_c}</label></div>
      <div class="option"><label><input type="radio" name="ans" value="D" ${saved === "D" ? "checked" : ""}> D. ${q.option_d}</label></div>
    </div>
  `;

  prevBtn.disabled = currentIndex === 0;
  nextBtn.disabled = currentIndex === currentQuestions.length - 1;
}

function saveCurrentAnswer() {
  const q = currentQuestions[currentIndex];
  if (!q) return;

  const selected = document.querySelector('input[name="ans"]:checked');
  userAnswers[q.question_id] = selected ? selected.value : "Not Answered";
}

function prevQuestion() {
  saveCurrentAnswer();
  if (currentIndex > 0) {
    currentIndex--;
    showQuestion();
  }
}

function nextQuestion() {
  saveCurrentAnswer();
  if (currentIndex < currentQuestions.length - 1) {
    currentIndex++;
    showQuestion();
  }
}

function startTimer() {
  clearInterval(timerInterval);
  updateTimer();

  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimer();

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      submitExam(true, "time_up");
    }
  }, 1000);
}

function updateTimer() {
  const m = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const s = String(timeLeft % 60).padStart(2, "0");
  timer.textContent = `Time Left: ${m}:${s}`;
}

async function submitExam(autoTerminated, terminationReason) {
  if (submittedAlready) return;
  submittedAlready = true;

  saveCurrentAnswer();
  clearInterval(timerInterval);

  const answersPayload = currentQuestions.map(q => ({
    question_id: q.question_id,
    selected_option: userAnswers[q.question_id] || "Not Answered"
  }));

  const res = await fetch("/api/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topicId: currentTopicId,
      difficulty: currentDifficulty,
      totalQuestions: currentQuestions.length,
      answers: answersPayload,
      autoTerminated,
      terminationReason
    })
  });

  const data = await res.json();

  examActive = false;
  navButtons.classList.add("hidden");
  quizContainer.innerHTML = "";
  questionTracker.textContent = autoTerminated ? "Exam Terminated" : "Exam Completed";
  timer.textContent = "Time Left: 00:00";

  let resultsHtml = "";

  data.results.forEach((r, idx) => {
    let cls = "wrong";
    if (r.status === "Correct") cls = "correct";
    if (r.status === "Not Answered") cls = "not-answered";

    resultsHtml += `
      <div class="question-card">
        <h3>Q${idx + 1}. ${r.question_text}</h3>
        <p><strong>Your Answer:</strong> ${r.selected_option}</p>
        <p><strong>Correct Answer:</strong> ${r.correct_option}. ${r.correct_option_text}</p>
        <p><strong>Status:</strong> <span class="${cls}">${r.status}</span></p>
        <p><strong>Explanation:</strong> ${r.explanation || "No explanation available."}</p>
      </div>
    `;
  });

  const extraMessage = autoTerminated
    ? `<p class="wrong"><strong>Exam auto-submitted because you left the test page.</strong></p>`
    : "";

  resultContainer.innerHTML = `
    <div class="result-summary">
      ${extraMessage}
      <h2>Your Score: ${data.score} / ${data.total}</h2>
      <p><strong>Attempted:</strong> ${data.attempted}</p>
      <p>${data.appreciation}</p>
    </div>
    ${resultsHtml}
  `;

  await loadMyResults();
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden && examActive && !submittedAlready) {
    submitExam(true, "left_test_page");
  }
});

window.addEventListener("beforeunload", () => {
  if (examActive && !submittedAlready) {
    saveCurrentAnswer();

    const answersPayload = currentQuestions.map(q => ({
      question_id: q.question_id,
      selected_option: userAnswers[q.question_id] || "Not Answered"
    }));

    const blob = new Blob(
      [JSON.stringify({
        topicId: currentTopicId,
        difficulty: currentDifficulty,
        totalQuestions: currentQuestions.length,
        answers: answersPayload,
        autoTerminated: true,
        terminationReason: "closed_or_reloaded_page"
      })],
      { type: "application/json" }
    );

    navigator.sendBeacon("/api/submit-beacon", blob);
  }
});

loadSession();