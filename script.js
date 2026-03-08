 const topicSelect = document.getElementById("topicSelect");
const difficultySelect = document.getElementById("difficultySelect");
const questionCount = document.getElementById("questionCount");
const timeSelect = document.getElementById("timeSelect");

const startBtn = document.getElementById("startBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const submitBtn = document.getElementById("submitBtn");

const quizContainer = document.getElementById("quizContainer");
const resultContainer = document.getElementById("resultContainer");
const navigationButtons = document.getElementById("navigationButtons");
const questionTracker = document.getElementById("questionTracker");
const timerDisplay = document.getElementById("timer");

let currentQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = {};
let timerInterval = null;
let timeLeft = 0;

// Load topics
async function loadTopics() {
  try {
    const response = await fetch("http://localhost:3000/topics");
    const topics = await response.json();

    topicSelect.innerHTML = '<option value="">-- Select Topic --</option>';

    topics.forEach((topic) => {
      const option = document.createElement("option");
      option.value = topic.topic_id;
      option.textContent = topic.topic_name;
      topicSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading topics:", error);
  }
}

// Start quiz
async function loadQuestions() {
  const topicId = topicSelect.value;
  const difficulty = difficultySelect.value;
  const limit = questionCount.value;
  const selectedTime = parseInt(timeSelect.value);

  if (!topicId) {
    alert("Please select a topic first.");
    return;
  }

  try {
    const response = await fetch(
      `http://localhost:3000/questions?topicId=${topicId}&difficulty=${difficulty}&limit=${limit}`
    );

    const questions = await response.json();

    currentQuestions = questions;
    currentQuestionIndex = 0;
    userAnswers = {};
    resultContainer.innerHTML = "";

    if (questions.length === 0) {
      quizContainer.innerHTML = "<p>No questions found for this selection.</p>";
      navigationButtons.style.display = "none";
      questionTracker.textContent = "Question 0 of 0";
      timerDisplay.textContent = "Time Left: 00:00";
      return;
    }

    navigationButtons.style.display = "flex";
    timeLeft = selectedTime;
    startTimer();
    showQuestion();
  } catch (error) {
    console.error("Error loading questions:", error);
  }
}

// Show one question
function showQuestion() {
  const question = currentQuestions[currentQuestionIndex];
  const savedAnswer = userAnswers[question.question_id] || "";

  questionTracker.textContent = `Question ${currentQuestionIndex + 1} of ${currentQuestions.length}`;

  quizContainer.innerHTML = `
    <div class="question-card">
      <div class="question-meta">Difficulty: ${question.difficulty}</div>
      <h3>${question.question_text}</h3>

      <div class="option">
        <label>
          <input type="radio" name="questionOption" value="A" ${savedAnswer === "A" ? "checked" : ""}>
          A. ${question.option_a}
        </label>
      </div>

      <div class="option">
        <label>
          <input type="radio" name="questionOption" value="B" ${savedAnswer === "B" ? "checked" : ""}>
          B. ${question.option_b}
        </label>
      </div>

      <div class="option">
        <label>
          <input type="radio" name="questionOption" value="C" ${savedAnswer === "C" ? "checked" : ""}>
          C. ${question.option_c}
        </label>
      </div>

      <div class="option">
        <label>
          <input type="radio" name="questionOption" value="D" ${savedAnswer === "D" ? "checked" : ""}>
          D. ${question.option_d}
        </label>
      </div>
    </div>
  `;

  prevBtn.disabled = currentQuestionIndex === 0;
  nextBtn.disabled = currentQuestionIndex === currentQuestions.length - 1;
}

// Save current answer
function saveCurrentAnswer() {
  const selectedOption = document.querySelector('input[name="questionOption"]:checked');
  const question = currentQuestions[currentQuestionIndex];

  if (selectedOption) {
    userAnswers[question.question_id] = selectedOption.value;
  } else {
    delete userAnswers[question.question_id];
  }
}

// Previous question
function goToPreviousQuestion() {
  saveCurrentAnswer();
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    showQuestion();
  }
}

// Next question
function goToNextQuestion() {
  saveCurrentAnswer();
  if (currentQuestionIndex < currentQuestions.length - 1) {
    currentQuestionIndex++;
    showQuestion();
  }
}

// Timer
function startTimer() {
  clearInterval(timerInterval);
  updateTimerDisplay();

  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      alert("Time is up! Quiz will be submitted automatically.");
      submitQuiz();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const minutes = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const seconds = String(timeLeft % 60).padStart(2, "0");
  timerDisplay.textContent = `Time Left: ${minutes}:${seconds}`;
}

// Submit quiz
function submitQuiz() {
  saveCurrentAnswer();
  clearInterval(timerInterval);

  let score = 0;
  let attempted = 0;
  let resultHTML = "";

  currentQuestions.forEach((question, index) => {
    const userAnswer = userAnswers[question.question_id] || "Not Answered";
    const correctAnswer = question.correct_option;

    if (userAnswer !== "Not Answered") {
      attempted++;
    }

    if (userAnswer === correctAnswer) {
      score++;
    }

    let correctAnswerText = "";
    if (correctAnswer === "A") correctAnswerText = question.option_a;
    if (correctAnswer === "B") correctAnswerText = question.option_b;
    if (correctAnswer === "C") correctAnswerText = question.option_c;
    if (correctAnswer === "D") correctAnswerText = question.option_d;

    let statusClass = "wrong";
    let statusText = "Wrong";

    if (userAnswer === "Not Answered") {
      statusClass = "not-answered";
      statusText = "Not Answered";
    } else if (userAnswer === correctAnswer) {
      statusClass = "correct";
      statusText = "Correct";
    }

    resultHTML += `
      <div class="question-card">
        <h3>Q${index + 1}. ${question.question_text}</h3>
        <p><strong>Your Answer:</strong> ${userAnswer}</p>
        <p><strong>Correct Answer:</strong> ${correctAnswer}. ${correctAnswerText}</p>
        <p><strong>Status:</strong> <span class="${statusClass}">${statusText}</span></p>
        <p><strong>Explanation:</strong> ${question.explanation || "No explanation available."}</p>
      </div>
    `;
  });

  resultContainer.innerHTML = `
    <div class="result-summary">
      <h2>Your Score: ${score} / ${currentQuestions.length}</h2>
      <p><strong>Attempted:</strong> ${attempted}</p>
      <p><strong>Unanswered:</strong> ${currentQuestions.length - attempted}</p>
    </div>
    ${resultHTML}
  `;

  quizContainer.innerHTML = "";
  navigationButtons.style.display = "none";
  questionTracker.textContent = "Quiz Completed";
  timerDisplay.textContent = "Time Left: 00:00";
}

startBtn.addEventListener("click", loadQuestions);
prevBtn.addEventListener("click", goToPreviousQuestion);
nextBtn.addEventListener("click", goToNextQuestion);
submitBtn.addEventListener("click", submitQuiz);

loadTopics();