 require("dotenv").config();
const mysql = require("mysql2/promise");

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function makeMCQ(correctText, wrongOptions) {
  const allOptions = shuffle([correctText, ...wrongOptions]);
  const correctIndex = allOptions.indexOf(correctText);
  const labels = ["A", "B", "C", "D"];

  return {
    option_a: allOptions[0],
    option_b: allOptions[1],
    option_c: allOptions[2],
    option_d: allOptions[3],
    correct_option: labels[correctIndex]
  };
}

function format2(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.00$/, "");
}

function buildUniqueQuestions(count, generator, difficulty) {
  const questions = [];
  const seen = new Set();

  while (questions.length < count) {
    const q = generator();
    const key = `${difficulty}|${q.question_text}`;
    if (!seen.has(key)) {
      seen.add(key);
      questions.push(q);
    }
  }

  return questions;
}

// ---------------------- SAMPLE GENERATORS ----------------------

function genNumbersEasy() {
  const a = randInt(2, 20);
  const b = randInt(2, 20);
  const gcd = (x, y) => y === 0 ? x : gcd(y, x % y);
  const lcm = (a * b) / gcd(a, b);

  return {
    question_text: `What is the LCM of ${a} and ${b}?`,
    explanation: `LCM of ${a} and ${b} is ${lcm}.`,
    ...makeMCQ(String(lcm), [
      String(lcm + randInt(1, 4)),
      String(lcm + randInt(5, 10)),
      String(Math.max(1, lcm - randInt(1, 4)))
    ])
  };
}

function genNumbersMedium() {
  const n = randInt(100, 500);
  const d = randInt(3, 12);
  const r = n % d;

  return {
    question_text: `What is the remainder when ${n} is divided by ${d}?`,
    explanation: `${n} = ${d} × ${Math.floor(n / d)} + ${r}.`,
    ...makeMCQ(String(r), [
      String((r + 1) % d),
      String((r + 2) % d),
      String((r + 3) % d)
    ])
  };
}

function genNumbersHard() {
  const hcf = randInt(2, 10);
  const x = randInt(2, 8);
  const y = randInt(x + 1, 10);
  const a = hcf * x;
  const b = hcf * y;
  const lcm = (a * b) / hcf;

  return {
    question_text: `If the HCF of two numbers is ${hcf} and their LCM is ${lcm}, and one number is ${a}, what is the other number?`,
    explanation: `Other number = (HCF × LCM) / given number = (${hcf} × ${lcm}) / ${a} = ${b}.`,
    ...makeMCQ(String(b), [
      String(b + randInt(2, 5)),
      String(Math.max(1, b - randInt(2, 5))),
      String(b + randInt(6, 10))
    ])
  };
}

function genPercentageEasy() {
  const base = randInt(50, 500);
  const pct = [5, 10, 15, 20, 25, 30, 40, 50][randInt(0, 7)];
  const ans = (base * pct) / 100;

  return {
    question_text: `What is ${pct}% of ${base}?`,
    explanation: `${pct}% of ${base} = ${ans}.`,
    ...makeMCQ(format2(ans), [
      format2(ans + randInt(2, 10)),
      format2(Math.max(1, ans - randInt(2, 10))),
      format2(ans + randInt(11, 20))
    ])
  };
}

function genPercentageMedium() {
  const original = randInt(100, 400);
  const pct = [10, 15, 20, 25][randInt(0, 3)];
  const finalVal = original * (1 + pct / 100);

  return {
    question_text: `A number is increased by ${pct}% and becomes ${format2(finalVal)}. What was the original number?`,
    explanation: `Original number = ${format2(finalVal)} / ${1 + pct / 100} = ${original}.`,
    ...makeMCQ(String(original), [
      String(original + randInt(5, 15)),
      String(Math.max(1, original - randInt(5, 15))),
      String(original + randInt(16, 30))
    ])
  };
}

function genPercentageHard() {
  const original = randInt(100, 500);
  const up = [10, 20, 25][randInt(0, 2)];
  const down = [10, 20, 25][randInt(0, 2)];
  const finalVal = original * (1 + up / 100) * (1 - down / 100);

  return {
    question_text: `A value is increased by ${up}% and then decreased by ${down}%. If the final value is ${format2(finalVal)}, what was the original value?`,
    explanation: `Original value = ${original}.`,
    ...makeMCQ(String(original), [
      String(original + randInt(5, 10)),
      String(Math.max(1, original - randInt(5, 10))),
      String(original + randInt(11, 20))
    ])
  };
}

function genProfitEasy() {
  const cp = randInt(100, 800);
  const profit = randInt(20, 200);
  const sp = cp + profit;

  return {
    question_text: `A shopkeeper buys an item for ${cp} and sells it for ${sp}. What is the profit?`,
    explanation: `Profit = ${sp} - ${cp} = ${profit}.`,
    ...makeMCQ(String(profit), [
      String(profit + randInt(5, 15)),
      String(Math.max(1, profit - randInt(5, 15))),
      String(profit + randInt(16, 30))
    ])
  };
}

function genProfitMedium() {
  const cp = randInt(100, 1000);
  const pct = [10, 15, 20, 25][randInt(0, 3)];
  const sp = cp * (1 + pct / 100);

  return {
    question_text: `An article is bought for ${cp} and sold at ${pct}% profit. What is the selling price?`,
    explanation: `Selling price = ${format2(sp)}.`,
    ...makeMCQ(format2(sp), [
      format2(sp + randInt(10, 30)),
      format2(Math.max(1, sp - randInt(10, 30))),
      format2(sp + randInt(31, 50))
    ])
  };
}

function genProfitHard() {
  const cp = randInt(200, 1000);
  const markedPct = [20, 25, 30, 40][randInt(0, 3)];
  const discountPct = [5, 10, 15, 20][randInt(0, 3)];
  const mp = cp * (1 + markedPct / 100);
  const sp = mp * (1 - discountPct / 100);

  return {
    question_text: `An article is marked ${markedPct}% above cost price and sold at a discount of ${discountPct}%. If the cost price is ${cp}, what is the selling price?`,
    explanation: `Marked price = ${format2(mp)}, selling price = ${format2(sp)}.`,
    ...makeMCQ(format2(sp), [
      format2(sp + randInt(10, 30)),
      format2(Math.max(1, sp - randInt(10, 30))),
      format2(sp + randInt(31, 60))
    ])
  };
}

// Basic reusable generator mapping for all topics
const topicGenerators = {
  "Numbers": { Easy: genNumbersEasy, Medium: genNumbersMedium, Hard: genNumbersHard },
  "Percentage": { Easy: genPercentageEasy, Medium: genPercentageMedium, Hard: genPercentageHard },
  "Profit and Loss": { Easy: genProfitEasy, Medium: genProfitMedium, Hard: genProfitHard }
};

// Fallback generators for remaining topics so seeding works
function genericEasy(topic) {
  const a = randInt(10, 50);
  const b = randInt(2, 10);
  const ans = a + b;
  return {
    question_text: `[${topic}] What is ${a} + ${b}?`,
    explanation: `${a} + ${b} = ${ans}.`,
    ...makeMCQ(String(ans), [String(ans + 1), String(ans + 2), String(ans - 1)])
  };
}

function genericMedium(topic) {
  const a = randInt(20, 80);
  const b = randInt(2, 12);
  const ans = a - b;
  return {
    question_text: `[${topic}] What is ${a} - ${b}?`,
    explanation: `${a} - ${b} = ${ans}.`,
    ...makeMCQ(String(ans), [String(ans + 2), String(ans - 2), String(ans + 4)])
  };
}

function genericHard(topic) {
  const a = randInt(5, 20);
  const b = randInt(5, 20);
  const ans = a * b;
  return {
    question_text: `[${topic}] What is ${a} × ${b}?`,
    explanation: `${a} × ${b} = ${ans}.`,
    ...makeMCQ(String(ans), [String(ans + 5), String(ans - 5), String(ans + 10)])
  };
}

async function getTopicMap(conn) {
  const [rows] = await conn.query("SELECT topic_id, topic_name FROM topics");
  const map = {};
  rows.forEach(r => {
    map[r.topic_name] = r.topic_id;
  });
  return map;
}

async function insertQuestions(conn, topicId, difficulty, questions) {
  const sql = `
    INSERT INTO questions
    (topic_id, difficulty, question_text, option_a, option_b, option_c, option_d, correct_option, explanation)
    VALUES ?
  `;

  const values = questions.map(q => [
    topicId,
    difficulty,
    q.question_text,
    q.option_a,
    q.option_b,
    q.option_c,
    q.option_d,
    q.correct_option,
    q.explanation
  ]);

  await conn.query(sql, [values]);
}

async function seedAll() {
  const conn = await mysql.createConnection(dbConfig);
  const topicMap = await getTopicMap(conn);

  for (const [topicName, topicId] of Object.entries(topicMap)) {
    console.log(`Seeding topic: ${topicName}`);

    const generatorSet = topicGenerators[topicName] || {
      Easy: () => genericEasy(topicName),
      Medium: () => genericMedium(topicName),
      Hard: () => genericHard(topicName)
    };

    for (const difficulty of ["Easy", "Medium", "Hard"]) {
      const questions = buildUniqueQuestions(75, generatorSet[difficulty], difficulty);
      await insertQuestions(conn, topicId, difficulty, questions);
      console.log(`  Inserted ${questions.length} ${difficulty} questions`);
    }
  }

  await conn.end();
  console.log("Seeding completed.");
}

seedAll().catch(err => {
  console.error(err);
});