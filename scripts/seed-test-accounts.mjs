// Seed test accounts for end-to-end testing:
//   • an educator (coordinator) that logs in with email + password
//   • a demo student that logs in with an access code
// Uses the Supabase Auth + REST APIs directly over HTTPS (no SDK — avoids the
// Node-20 WebSocket requirement, and creates auth identities correctly so login
// works). Run: npm run db:seed:accounts
// Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY (read from env or .env).

import { readFileSync } from "node:fs";

function fromEnvOrDotenv(key) {
  if (process.env[key]) return process.env[key];
  try {
    const line = readFileSync(".env", "utf8").split("\n").find((l) => l.startsWith(`${key}=`));
    if (!line) return undefined;
    let v = line.slice(key.length + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    return v;
  } catch {
    return undefined;
  }
}

const url = fromEnvOrDotenv("NEXT_PUBLIC_SUPABASE_URL");
const key = fromEnvOrDotenv("SUPABASE_SECRET_KEY");
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY (env or .env).");
  process.exit(1);
}
const edition = Number(fromEnvOrDotenv("ASC_EDITION_YEAR")) || 2026;

// Demo login credentials are read from env (kept out of this public repo).
const demoEducatorPassword = fromEnvOrDotenv("DEMO_EDUCATOR_PASSWORD");
const demoStudentCode = fromEnvOrDotenv("DEMO_STUDENT_CODE");
if (!demoEducatorPassword || !demoStudentCode) {
  console.error("Missing DEMO_EDUCATOR_PASSWORD or DEMO_STUDENT_CODE (env or .env).");
  process.exit(1);
}
const H = { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json" };

async function auth(path, { method = "GET", body } = {}) {
  const res = await fetch(`${url}/auth/v1/${path}`, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`auth ${path}: ${res.status} ${JSON.stringify(json)}`);
  return json;
}
async function rest(path, { method = "GET", body, prefer } = {}) {
  const headers = prefer ? { ...H, Prefer: prefer } : H;
  const res = await fetch(`${url}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`rest ${path}: ${res.status} ${JSON.stringify(json)}`);
  return json;
}

const EDUCATOR = { email: "educator@demo.test", password: demoEducatorPassword, name: "Demo Educator" };
const STUDENT = { code: demoStudentCode, name: "Demo Student", level: "SS2", email: "student.demo123@students.adewaleconference.local" };
const SCHOOL = "[DEMO] Mayflower Secondary School";

async function findUser(email) {
  for (let page = 1; page <= 20; page++) {
    const data = await auth(`admin/users?page=${page}&per_page=200`);
    const users = data.users ?? data ?? [];
    const hit = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (users.length < 200) break;
  }
  return null;
}
async function ensureUser({ email, password, name }) {
  const found = await findUser(email);
  if (found) return found;
  return auth("admin/users", { method: "POST", body: { email, password, email_confirm: true, user_metadata: { full_name: name } } });
}

async function main() {
  // 1. Demo school
  let rows = await rest(`schools?select=id&name=eq.${encodeURIComponent(SCHOOL)}`);
  let schoolId = rows[0]?.id;
  if (!schoolId) {
    const ins = await rest("schools", { method: "POST", body: { name: SCHOOL, lga: "Ikenne", category: "Private" }, prefer: "return=representation" });
    schoolId = ins[0].id;
  }

  // 2. Educator (coordinator) + approved membership
  const edu = await ensureUser(EDUCATOR);
  await rest(`profiles?id=eq.${edu.id}`, { method: "PATCH", body: { role: "coordinator", full_name: EDUCATOR.name }, prefer: "return=minimal" });
  await rest("school_members?on_conflict=school_id,email", {
    method: "POST",
    body: { school_id: schoolId, email: EDUCATOR.email, profile_id: edu.id, status: "approved" },
    prefer: "resolution=merge-duplicates,return=minimal",
  });

  // 3. Student (code login)
  const stu = await ensureUser({ email: STUDENT.email, password: STUDENT.code, name: STUDENT.name });
  const existing = await rest(`students?select=id&access_code=eq.${STUDENT.code}`);
  if (existing[0]?.id) {
    await rest(`students?id=eq.${existing[0].id}`, { method: "PATCH", body: { auth_user_id: stu.id }, prefer: "return=minimal" });
  } else {
    await rest("students", {
      method: "POST",
      body: { school_id: schoolId, name: STUDENT.name, level: STUDENT.level, access_code: STUDENT.code, auth_email: STUDENT.email, auth_user_id: stu.id, edition_year: edition },
      prefer: "return=minimal",
    });
  }

  console.log(`\n✅ Test accounts ready (edition ${edition})\n`);
  console.log("  Educator (coordinator) — /portal/login");
  console.log(`    email:    ${EDUCATOR.email}`);
  console.log(`    password: ${EDUCATOR.password}`);
  console.log(`    school:   ${SCHOOL} (approved member)\n`);
  console.log("  Student — /portal/student-login");
  console.log(`    access code: ${STUDENT.code}\n`);
}

main().catch((e) => {
  console.error("Seed failed:", e.message ?? e);
  process.exit(1);
});
