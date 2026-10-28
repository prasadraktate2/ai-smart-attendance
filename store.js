// ===== SWITCH: false = DEMO (saves in this browser only), true = Firebase =====
export const USE_FIREBASE = false;

// Firebase keys go here later (only needed when USE_FIREBASE = true)
const firebaseConfig = {
  apiKey: "PASTE_API_KEY",
  authDomain: "PASTE_PROJECT.firebaseapp.com",
  projectId: "PASTE_PROJECT_ID",
  appId: "PASTE_APP_ID"
};

let fb = null;
async function fbInit() {
  if (fb) return fb;
  const appMod = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
  const fs = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  fb = { fs, db: fs.getFirestore(appMod.initializeApp(firebaseConfig)) };
  return fb;
}

function read(key) {
  try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch (e) { return {}; }
}
function write(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

export async function saveSession(id, data) {
  if (USE_FIREBASE) {
    const { fs, db } = await fbInit();
    await fs.setDoc(fs.doc(db, "sessions", id), data, { merge: true });
    return;
  }
  const all = read("demo_sessions");
  all[id] = Object.assign({}, all[id] || {}, data);
  write("demo_sessions", all);
}

export async function getSession(id) {
  if (USE_FIREBASE) {
    const { fs, db } = await fbInit();
    const snap = await fs.getDoc(fs.doc(db, "sessions", id));
    return snap.exists() ? snap.data() : null;
  }
  return read("demo_sessions")[id] || null;
}

// Returns "ok" or "duplicate"
export async function markPresent(sessionId, student) {
  const key = sessionId + "_" + student.id;
  const record = {
    sessionId: sessionId,
    studentId: student.id,
    studentName: student.name,
    date: sessionId.slice(0, 10),
    time: Date.now()
  };
  if (USE_FIREBASE) {
    const { fs, db } = await fbInit();
    const ref = fs.doc(db, "attendance", key);
    if ((await fs.getDoc(ref)).exists()) return "duplicate";
    await fs.setDoc(ref, record);
    return "ok";
  }
  const all = read("demo_attendance");
  if (all[key]) return "duplicate";
  all[key] = record;
  write("demo_attendance", all);
  return "ok";
}

// Calls cb(count) live. Returns an unsubscribe function.
export function watchPresent(sessionId, cb) {
  if (USE_FIREBASE) {
    let unsub = null, cancelled = false;
    fbInit().then(({ fs, db }) => {
      if (cancelled) return;
      unsub = fs.onSnapshot(
        fs.query(fs.collection(db, "attendance"), fs.where("sessionId", "==", sessionId)),
        s => cb(s.size)
      );
    });
    return () => { cancelled = true; if (unsub) unsub(); };
  }
  const tick = () => {
    cb(Object.values(read("demo_attendance")).filter(x => x.sessionId === sessionId).length);
  };
  tick();
  const t = setInterval(tick, 1000);
  return () => clearInterval(t);
}

// Live count of attendance records for a date (optionally for one student).
export function watchToday(date, studentId, cb) {
  if (USE_FIREBASE) {
    let unsub = null, cancelled = false;
    fbInit().then(({ fs, db }) => {
      if (cancelled) return;
      const conds = [fs.where("date", "==", date)];
      if (studentId) conds.push(fs.where("studentId", "==", studentId));
      unsub = fs.onSnapshot(
        fs.query(fs.collection(db, "attendance"), ...conds),
        s => cb(s.size)
      );
    });
    return () => { cancelled = true; if (unsub) unsub(); };
  }
  const tick = () => {
    cb(Object.values(read("demo_attendance")).filter(x =>
      x.date === date && (!studentId || x.studentId === studentId)).length);
  };
  tick();
  const t = setInterval(tick, 2000);
  return () => clearInterval(t);
}
