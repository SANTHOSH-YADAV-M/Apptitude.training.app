 require("dotenv").config();

console.log("RAW PASSWORD VALUE:", process.env.DB_PASSWORD);
console.log("PASSWORD LENGTH:", process.env.DB_PASSWORD ? process.env.DB_PASSWORD.length : 0);

const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const session = require("express-session");
const bcrypt = require("bcrypt");
const path = require("path");
const { exec } = require("child_process");

const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_NAME = process.env.ADMIN_NAME;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

 const dbConfig = {
  host: "localhost",
  user: "root",
  password: "MySql@2026#",
  database: "aptitude_quiz"
};

let db;

 console.log("Loaded DB config:", {
  host: dbConfig.host,
  user: dbConfig.user,
  database: dbConfig.database,
  passwordLoaded: !!dbConfig.password,
  passwordLength: dbConfig.password ? dbConfig.password.length : 0
});

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "default-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
  })
);

app.use(express.static("public"));

async function initDb() {
  db = await mysql.createPool({
    ...dbConfig,
    connectionLimit: 10
  });

  console.log("Connected to MySQL database");
  await ensureAdminUser();
}

async function ensureAdminUser() {
  const [rows] = await db.query("SELECT user_id FROM users WHERE email = ?", [ADMIN_EMAIL]);

  if (rows.length === 0) {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await db.query(
      "INSERT INTO users (full_name, email, password_hash, is_admin) VALUES (?, ?, ?, TRUE)",
      [ADMIN_NAME, ADMIN_EMAIL, hash]
    );
    console.log("Default admin created");
    console.log(`Admin email: ${ADMIN_EMAIL}`);
  }
}

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Login required" });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || !req.session.user.is_admin) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.post("/api/register", async (req, res) => {
  try {
    const { full_name, email, password } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const [existing] = await db.query("SELECT user_id FROM users WHERE email = ?", [email]);

    if (existing.length > 0) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const hash = await bcrypt.hash(password, 10);

    await db.query(
      "INSERT INTO users (full_name, email, password_hash, is_admin) VALUES (?, ?, ?, FALSE)",
      [full_name, email, hash]
    );

    res.json({ message: "Registration successful" });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);

    if (rows.length === 0) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);

    if (!ok) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    req.session.user = {
      user_id: user.user_id,
      full_name: user.full_name,
      email: user.email,
      is_admin: !!user.is_admin
    };

    res.json({
      message: "Login successful",
      user: req.session.user
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "Logged out" });
  });
});

app.get("/api/session", (req, res) => {
  if (!req.session.user) {
    return res.json({ loggedIn: false });
  }

  res.json({
    loggedIn: true,
    user: req.session.user
  });
});

app.get("/api/topics", requireLogin, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM topics ORDER BY topic_name");
    res.json(rows);
  } catch (error) {
    console.error("Topics error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/questions", requireLogin, async (req, res) => {
  try {
    const topicId = req.query.topicId;
    const difficulty = req.query.difficulty || "All";
    const limit = parseInt(req.query.limit) || 5;

    let sql = `
      SELECT
        question_id,
        question_text,
        option_a,
        option_b,
        option_c,
        option_d,
        difficulty
      FROM questions
      WHERE topic_id = ?
    `;

    const params = [topicId];

    if (difficulty !== "All") {
      sql += " AND difficulty = ?";
      params.push(difficulty);
    }

    sql += " ORDER BY RAND() LIMIT ?";
    params.push(limit);

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error("Questions error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

async function scoreQuizSubmission(payload, userId) {
  const {
    topicId,
    difficulty,
    answers = [],
    totalQuestions = 0,
    autoTerminated = false,
    terminationReason = null
  } = payload;

  const questionIds = answers.map(a => a.question_id);

  if (questionIds.length === 0) {
    await db.query(
      `INSERT INTO quiz_attempts
      (user_id, topic_id, difficulty, total_questions, attempted_questions, score, auto_terminated, termination_reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, topicId, difficulty || "All", totalQuestions, 0, 0, autoTerminated, terminationReason]
    );

    return {
      score: 0,
      attempted: 0,
      total: totalQuestions,
      results: []
    };
  }

  const [questionRows] = await db.query(
    `SELECT question_id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation
     FROM questions
     WHERE question_id IN (?)`,
    [questionIds]
  );

  const qMap = new Map();
  questionRows.forEach(q => qMap.set(q.question_id, q));

  let score = 0;
  let attempted = 0;
  const results = [];

  for (const ans of answers) {
    const q = qMap.get(ans.question_id);
    if (!q) continue;

    const selected = ans.selected_option || "Not Answered";

    if (selected !== "Not Answered") attempted++;
    if (selected === q.correct_option) score++;

    let correctText = "";
    if (q.correct_option === "A") correctText = q.option_a;
    if (q.correct_option === "B") correctText = q.option_b;
    if (q.correct_option === "C") correctText = q.option_c;
    if (q.correct_option === "D") correctText = q.option_d;

    results.push({
      question_id: q.question_id,
      question_text: q.question_text,
      selected_option: selected,
      correct_option: q.correct_option,
      correct_option_text: correctText,
      explanation: q.explanation,
      status:
        selected === "Not Answered"
          ? "Not Answered"
          : selected === q.correct_option
          ? "Correct"
          : "Wrong"
    });
  }

  await db.query(
    `INSERT INTO quiz_attempts
    (user_id, topic_id, difficulty, total_questions, attempted_questions, score, auto_terminated, termination_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, topicId, difficulty || "All", totalQuestions, attempted, score, autoTerminated, terminationReason]
  );

  return {
    score,
    attempted,
    total: totalQuestions,
    results
  };
}

app.post("/api/submit", requireLogin, async (req, res) => {
  try {
    const result = await scoreQuizSubmission(req.body, req.session.user.user_id);

    let appreciation = `You have scored ${result.score} out of ${result.total}. Try well next time.`;

    if (result.total > 0) {
      const pct = (result.score / result.total) * 100;

      if (pct >= 80) appreciation = `You have scored ${result.score} out of ${result.total}. Excellent work.`;
      else if (pct >= 60) appreciation = `You have scored ${result.score} out of ${result.total}. Good job, keep improving.`;
    }

    res.json({
      ...result,
      appreciation
    });
  } catch (error) {
    console.error("Submit error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/submit-beacon", requireLogin, async (req, res) => {
  try {
    const result = await scoreQuizSubmission(req.body, req.session.user.user_id);
    res.json({ ok: true, score: result.score });
  } catch (error) {
    console.error("Submit beacon error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/my-results", requireLogin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT qa.*, t.topic_name
       FROM quiz_attempts qa
       JOIN topics t ON qa.topic_id = t.topic_id
       WHERE qa.user_id = ?
       ORDER BY qa.submitted_at DESC`,
      [req.session.user.user_id]
    );

    res.json(rows);
  } catch (error) {
    console.error("My results error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/admin/users", requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT user_id, full_name, email, is_admin, created_at
       FROM users
       ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (error) {
    console.error("Admin users error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/admin/results", requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
          qa.attempt_id,
          u.full_name,
          u.email,
          t.topic_name,
          qa.difficulty,
          qa.total_questions,
          qa.attempted_questions,
          qa.score,
          qa.auto_terminated,
          qa.termination_reason,
          qa.submitted_at
       FROM quiz_attempts qa
       JOIN users u ON qa.user_id = u.user_id
       JOIN topics t ON qa.topic_id = t.topic_id
       ORDER BY qa.submitted_at DESC`
    );
    res.json(rows);
  } catch (error) {
    console.error("Admin results error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/admin/seed", requireAdmin, (req, res) => {
  exec("node seed_questions.js", { cwd: __dirname, env: process.env }, (error, stdout, stderr) => {
    if (error) {
      console.error("Seed error:", error);
      return res.status(500).json({
        error: "Seeding failed",
        details: stderr || error.message
      });
    }

    res.json({
      message: "Seeding completed successfully",
      output: stdout
    });
  });
});

initDb()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error("Startup error:", err);
  });