 const adminLoginSection = document.getElementById("adminLoginSection");
const adminPanel = document.getElementById("adminPanel");
const adminEmail = document.getElementById("adminEmail");
const adminPassword = document.getElementById("adminPassword");
const adminLoginBtn = document.getElementById("adminLoginBtn");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");
const adminWelcome = document.getElementById("adminWelcome");
const runSeedBtn = document.getElementById("runSeedBtn");
const seedOutput = document.getElementById("seedOutput");
const usersTable = document.getElementById("usersTable");
const resultsTable = document.getElementById("resultsTable");

adminLoginBtn.addEventListener("click", adminLogin);
adminLogoutBtn.addEventListener("click", adminLogout);
runSeedBtn.addEventListener("click", runSeed);

async function loadSession() {
  const res = await fetch("/api/session");
  const data = await res.json();

  if (!data.loggedIn || !data.user.is_admin) {
    adminLoginSection.classList.remove("hidden");
    adminPanel.classList.add("hidden");
    return;
  }

  adminLoginSection.classList.add("hidden");
  adminPanel.classList.remove("hidden");
  adminWelcome.textContent = `Welcome, ${data.user.full_name}`;

  await loadUsers();
  await loadResults();
}

async function adminLogin() {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: adminEmail.value.trim(),
      password: adminPassword.value.trim()
    })
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Login failed");
    return;
  }

  if (!data.user.is_admin) {
    alert("This login is not an admin account.");
    return;
  }

  await loadSession();
}

async function adminLogout() {
  await fetch("/api/logout", { method: "POST" });
  location.reload();
}

async function loadUsers() {
  const res = await fetch("/api/admin/users");
  const rows = await res.json();

  let html = `<div class="table-wrap"><table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Name</th>
        <th>Email</th>
        <th>Admin</th>
        <th>Created</th>
      </tr>
    </thead><tbody>`;

  rows.forEach(u => {
    html += `
      <tr>
        <td>${u.user_id}</td>
        <td>${u.full_name}</td>
        <td>${u.email}</td>
        <td>${u.is_admin ? "Yes" : "No"}</td>
        <td>${new Date(u.created_at).toLocaleString()}</td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  usersTable.innerHTML = html;
}

async function loadResults() {
  const res = await fetch("/api/admin/results");
  const rows = await res.json();

  let html = `<div class="table-wrap"><table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Email</th>
        <th>Topic</th>
        <th>Difficulty</th>
        <th>Score</th>
        <th>Attempted</th>
        <th>Total</th>
        <th>Terminated</th>
        <th>Reason</th>
        <th>Date</th>
      </tr>
    </thead><tbody>`;

  rows.forEach(r => {
    html += `
      <tr>
        <td>${r.full_name}</td>
        <td>${r.email}</td>
        <td>${r.topic_name}</td>
        <td>${r.difficulty}</td>
        <td>${r.score}</td>
        <td>${r.attempted_questions}</td>
        <td>${r.total_questions}</td>
        <td>${r.auto_terminated ? "Yes" : "No"}</td>
        <td>${r.termination_reason || "-"}</td>
        <td>${new Date(r.submitted_at).toLocaleString()}</td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  resultsTable.innerHTML = html;
}

async function runSeed() {
  seedOutput.textContent = "Running seed_questions.js ...";

  const res = await fetch("/api/admin/seed", {
    method: "POST"
  });

  const data = await res.json();

  if (!res.ok) {
    seedOutput.textContent = data.error || "Seeding failed";
    return;
  }

  seedOutput.textContent = `${data.message}\n\n${data.output || ""}`;
}

loadSession();