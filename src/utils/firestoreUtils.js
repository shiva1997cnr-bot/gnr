// src/utils/firestoreUtils.js
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  onSnapshot,
  addDoc,
  query,
  where as fbWhere,
  deleteDoc,
  deleteField,
  limit as fbLimit,
  arrayUnion,
  arrayRemove,
  orderBy as fbOrderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import dayjs from "dayjs";

/* ---------------- ADMIN / ROLE CONFIG ---------------- */

export const ROLE_OPTIONS = [
  "admin.tl1","admin.tl2","admin.tl3","admin.tl4","admin.tl5","admin.tl6","admin.tl7","admin.tl8","admin.tl9","admin.tl10",
  "admin.mgr1","admin.mgr2","admin.mgr3","admin.mgr4","admin.mgr5",
  "admin.tr1","admin.tr2","admin.tr3","admin.tr4","admin.tr5",
  "admin",
];

// Expanded fallback allowlist (used if admin/{email} not present)
export const ADMIN_EMAILS = [
  // existing three
  "admin.reeves@gmail.com",
  "admin.sonal@gmail.com",
  "admin.shiva@gmail.com",

  // TLs: tl1 and tl3..tl20 (no tl2 per your instruction)
  "admin.tl1@gmail.com",
  "admin.tl3@gmail.com",
  "admin.tl4@gmail.com",
  "admin.tl5@gmail.com",
  "admin.tl6@gmail.com",
  "admin.tl7@gmail.com",
  "admin.tl8@gmail.com",
  "admin.tl9@gmail.com",
  "admin.tl10@gmail.com",
  "admin.tl11@gmail.com",
  "admin.tl12@gmail.com",
  "admin.tl13@gmail.com",
  "admin.tl14@gmail.com",
  "admin.tl15@gmail.com",
  "admin.tl16@gmail.com",
  "admin.tl17@gmail.com",
  "admin.tl18@gmail.com",
  "admin.tl19@gmail.com",
  "admin.tl20@gmail.com",

  // Managers (as you wrote: mrg1..mrg5)
  "admin.mrg1@gmail.com",
  "admin.mrg2@gmail.com",
  "admin.mrg3@gmail.com",
  "admin.mrg4@gmail.com",
  "admin.mrg5@gmail.com",

  // Trainers tr1..tr10
  "admin.tr1@gmail.com",
  "admin.tr2@gmail.com",
  "admin.tr3@gmail.com",
  "admin.tr4@gmail.com",
  "admin.tr5@gmail.com",
  "admin.tr6@gmail.com",
  "admin.tr7@gmail.com",
  "admin.tr8@gmail.com",
  "admin.tr9@gmail.com",
  "admin.tr10@gmail.com",

  // Dev
  "admin.dev@gmail.com",
];

const normalizeEmail = (e) => (e || "").toString().trim().toLowerCase();
export const getCanonicalUserId = (u = {}) =>
  u?.username || u?.uid || (u?.email ? u.email.toLowerCase() : "");

// small helpers for improved admin resolution
const isProbablyEmail = (s = "") => typeof s === "string" && s.includes("@");
const uniq = (arr = []) => {
  const seen = new Set();
  const out = [];
  for (const v of arr) {
    const k = String(v);
    if (!seen.has(k)) { seen.add(k); out.push(v); }
  }
  return out;
};

/* Make region keys exportable for reuse */
export const REGION_KEYS = ["uscan", "we", "afr", "sa", "esea", "latam"];

/**
 * Allowlist helpers: admin/{email}
 */
export async function addAdminEmail(emailRaw, addedByEmail) {
  const email = normalizeEmail(emailRaw);
  if (!email) throw new Error("Email required");
  await setDoc(
    doc(db, "admin", email),
    {
      addedBy: normalizeEmail(addedByEmail) || "system",
      addedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

export async function removeAdminEmail(emailRaw) {
  const email = normalizeEmail(emailRaw);
  if (!email) throw new Error("Email required");
  await deleteDoc(doc(db, "admin", email));
}

export async function isEmailAdmin(emailRaw) {
  const email = normalizeEmail(emailRaw);
  if (!email) return false;

  try {
    const snap = await getDoc(doc(db, "admin", email));
    if (snap.exists()) return true;
    return ADMIN_EMAILS.map(normalizeEmail).includes(email);
  } catch (e) {
    console.error("Admin check failed, fallback list used:", e);
    return ADMIN_EMAILS.map(normalizeEmail).includes(email);
  }
}

/* ---------------- ROLE HELPERS ---------------- */

export function looksLikeAdminRole(r = "") {
  const v = String(r).trim().toLowerCase();
  return v === "admin" || v.startsWith("admin.");
}

export function hasAdminLikeRole(userData = {}) {
  const roleRaw = (userData.role || "").toString().trim().toLowerCase();
  if (roleRaw === "admin" || roleRaw.startsWith("admin.")) return true;

  const rolesArr = Array.isArray(userData.roles) ? userData.roles : [];
  return rolesArr.some((r) => looksLikeAdminRole(r));
}

/**
 * Main admin checker for a user.
 * Robust resolution:
 * - Tries /users/{id} with multiple candidates: raw id, lowercased, uid, username, email.
 * - Merges any docs found.
 * - Checks email allowlist (admin/{email}) and role/roles fields.
 */
export async function isAdminUserDoc(usernameOrEmailOrUid, userData = null) {
  let merged = userData ? { ...userData } : {};

  const rawId = usernameOrEmailOrUid ? String(usernameOrEmailOrUid) : "";
  const lcId = rawId.toLowerCase();

  const candidates = uniq([
    rawId,
    lcId,
    merged.uid,
    merged.username,
    merged.username ? String(merged.username).toLowerCase() : null,
    merged.email,
    merged.email ? String(merged.email).toLowerCase() : null,
  ].filter(Boolean));

  // Try to load & merge any user docs we find
  for (const id of candidates) {
    try {
      const ref = doc(db, "users", String(id));
      const snap = await getDoc(ref);
      if (snap.exists()) {
        merged = { ...merged, ...snap.data() };
      }
    } catch {
      // ignore
    }
  }

  // Collect all possible emails (from merged + the identifier if it looks like an email)
  const emailCandidates = uniq([
    merged.email,
    merged.mail,
    merged.userEmail,
    isProbablyEmail(rawId) ? rawId : null,
    isProbablyEmail(lcId) ? lcId : null,
  ].filter(Boolean).map((e) => String(e).trim()));

  // Allowlist check (admin/{email})
  for (const e of emailCandidates) {
    if (await isEmailAdmin(e)) return true;
  }

  // Roles check on merged user view
  if (hasAdminLikeRole(merged)) return true;

  return false;
}

/* ---------------- USERS / ROLES MUTATION ---------------- */

export async function ensureUserDoc(userId, payload = {}) {
  const ref = doc(db, "users", userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { roles: [], ...payload });
  }
  return ref;
}

export async function addUserRole(userId, role) {
  if (!looksLikeAdminRole(role)) throw new Error("Invalid role");
  const ref = await ensureUserDoc(userId);
  await updateDoc(ref, { roles: arrayUnion(role) });
}

export async function removeUserRole(userId, role) {
  const ref = doc(db, "users", userId);
  await updateDoc(ref, { roles: arrayRemove(role) });
}

export async function setUserRoles(userId, roles = []) {
  const valid = roles.filter(looksLikeAdminRole);
  const ref = await ensureUserDoc(userId);
  await updateDoc(ref, { roles: valid });
}

/* ---------------- CONSTANTS ---------------- */

export const EMOJIS = ["❤️", "🔥", "👏", "🌟", "😍"];

export const REGION_MAP = {
  we: "Western Europe",
  uscan: "US & Canada",
  latam: "Latin America",
  afr: "Africa",
  esea: "Eastern Europe & South East Asia",
  sa: "South Asia",
};

export const TIME_LIMIT_DEFAULT = 30;

/* ---------------- STANDARD QUIZ RESULTS (non-live) ---------------- */

/**
 * Save quiz result (enforces one attempt per user unless admin).
 */
export const saveQuizResult = async (username, quizId, regionKey, score, timeSpent) => {
  try {
    const userRef = doc(db, "users", username);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      console.error("❌ User does not exist:", username);
      return;
    }

    const userData = userSnap.data();
    const currentScores = userData.scores || {};
    const isAdmin = await isAdminUserDoc(username, userData);

    if (currentScores[quizId] && !isAdmin) {
      console.warn(`⛔ Quiz '${quizId}' already taken by ${username}`);
      return;
    }

    const timestamp = dayjs().format("YYYY-MM-DD HH:mm:ss");
    const dateOfAttempt = dayjs().format("YYYY-MM-DD");
    const timeOfAttempt = dayjs().format("HH:mm:ss");

    const regionCode = regionKey;
    const regionName = REGION_MAP[regionKey] || regionKey;

    const newScore = {
      regionCode,
      regionName,
      score,
      timeSpent: typeof timeSpent === "number" ? timeSpent : null,
      date: timestamp,
      dateOfAttempt,
      timeOfAttempt,
    };

    await updateDoc(userRef, {
      scores: {
        ...currentScores,
        [quizId]: newScore,
      },
    });

    const quizUserDocRef = doc(db, `quizScores_${quizId}`, username);
    const firstName =
      userData.firstname ||
      userData.firstName ||
      (userData.fullName ? String(userData.fullName).split(" ")[0] : username);

    await setDoc(quizUserDocRef, {
      userId: username,
      firstName,
      regionCode,
      regionName,
      score,
      timeSpent: typeof timeSpent === "number" ? timeSpent : null,
      dateOfAttempt,
      timeOfAttempt,
      savedAt: timestamp,
    });

    console.log(`✅ Saved quiz '${quizId}' score for ${username}`);
  } catch (error) {
    console.error("❌ Error saving quiz result:", error);
  }
};

export const hasUserAttemptedQuiz = async (username, quizId) => {
  try {
    const userRef = doc(db, "users", username);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return false;

    const scores = userSnap.data().scores || {};
    if (scores[quizId]) return true;

    const directRef = doc(db, `quizScores_${quizId}`, username);
    const directSnap = await getDoc(directRef);
    if (directSnap.exists()) return true;

    const qs = await getDocs(
      query(collection(db, `quizScores_${quizId}`), fbWhere("userId", "==", username), fbLimit(1))
    );
    return qs.size > 0;
  } catch (error) {
    console.error("❌ Error checking quiz attempt:", error);
    return false;
  }
};

export const getAllUserScores = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "users"));
    const allScores = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const username = docSnap.id;
      const fullName = `${data.firstName || data.firstname || ""} ${data.lastName || ""}`.trim();
      const scores = data.scores || {};

      Object.entries(scores).forEach(([quizId, scoreData]) => {
        allScores.push({
          username,
          fullName,
          quizId,
          region: scoreData?.regionName ?? scoreData?.region ?? "",
          regionCode: scoreData?.regionCode ?? "",
          score: scoreData?.score ?? "",
          date: scoreData?.date ?? "",
          timeSpent: scoreData?.timeSpent ?? "",
          dateOfAttempt: scoreData?.dateOfAttempt ?? "",
          timeOfAttempt: scoreData?.timeOfAttempt ?? "",
        });
      });
    });

    return allScores;
  } catch (error) {
    console.error("❌ Error fetching all user scores:", error);
    return [];
  }
};

/**
 * getQuizScores compatibility:
 * - getQuizScores(quizId)
 * - getQuizScores(regionKey, quizId)  // regionKey ignored, kept for older callers
 */
export const getQuizScores = async (...args) => {
  try {
    const quizId = args.length === 1 ? args[0] : args[1];
    if (!quizId) return [];

    // Prefer /quizzes for standard mode
    const quizRef = doc(db, "quizzes", quizId);
    const quizSnap = await getDoc(quizRef);
    const quizData = quizSnap.data();
    if (!quizData) {
      console.error("❌ Quiz not found:", quizId);
      return [];
    }

    const scoresRef = collection(db, `quizScores_${quizId}`);
    const scoresSnap = await getDocs(scoresRef);
    const scores = scoresSnap.docs.map((docSnap) => docSnap.data());

    const formattedScores = scores.map((score) => ({
      firstName: score.firstName,
      region: score.regionName || score.region || "",
      score: score.score,
      timeSpent: score.timeSpent,
      dateOfAttempt: score.dateOfAttempt,
      timeOfAttempt: score.timeOfAttempt,
      totalQuestions: Array.isArray(quizData.questions) ? quizData.questions.length : undefined,
    }));

    return formattedScores;
  } catch (error) {
    console.error("❌ Error fetching quiz scores:", error);
    return [];
  }
};

/**
 * WARNING / Legacy utility:
 * This removed *all* user scores. Keep exported for legacy callers,
 * but avoid using it in the app (new reset uses lastResetAt only).
 */
export const deleteAllUserScores = async () => {
  try {
    const usersRef = collection(db, "users");
    const snapshot = await getDocs(usersRef);
    const ops = [];

    snapshot.forEach((docSnap) => {
      const userRef = doc(db, "users", docSnap.id);
      ops.push(updateDoc(userRef, { scores: {} }));
      // or: ops.push(updateDoc(userRef, { scores: deleteField() }));
    });

    await Promise.all(ops);
    console.log("✅ All user scores have been deleted.");
  } catch (error) {
    console.error("❌ Error deleting all user scores:", error);
  }
};

/* ---------------- EMOJI REACTIONS ---------------- */

export const listenToReactions = (setReactions) => {
  const reactionsRef = collection(db, "reactions");
  return onSnapshot(reactionsRef, (snapshot) => {
    const allReactions = {};
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      allReactions[docSnap.id] = data;
    });
    setReactions(allReactions);
  });
};

export const addReaction = async (targetUsername, emoji, reactingUsername) => {
  try {
    const reactionRef = doc(db, "reactions", targetUsername);
    const reactionSnap = await getDoc(reactionRef);

    let existingData = reactionSnap.exists() ? reactionSnap.data() : {};

    // Remove old reaction from same user
    Object.keys(existingData).forEach((em) => {
      existingData[em] = existingData[em].filter((user) => user !== reactingUsername);
    });

    // Add new reaction
    if (!existingData[emoji]) existingData[emoji] = [];
    existingData[emoji].push(reactingUsername);

    await setDoc(reactionRef, existingData);
    console.log(`✅ ${reactingUsername} reacted to ${targetUsername} with ${emoji}`);
  } catch (error) {
    console.error("❌ Error adding reaction:", error);
  }
};

export const getReactionSummary = (reactionData, usersMap) => {
  if (!reactionData) return null;

  const summary = [];
  const reactedByNames = new Set();

  Object.entries(reactionData).forEach(([emoji, userList]) => {
    if (!userList.length) return;
    const visible = `${emoji}${userList.length > 1 ? " " + userList.length + "+" : ""}`;
    summary.push(visible);

    userList.forEach((u) => {
      const full = usersMap[u] || u;
      const firstName = full.split(" ")[0];
      reactedByNames.add(firstName);
    });
  });

  return {
    summaryText: summary.join(" "),
    reactedBy: Array.from(reactedByNames),
  };
};

/* ---------------- ADMIN QUIZ MGMT (legacy helpers) ---------------- */

export const addQuizQuestion = async ({
  region,
  question,
  options,
  correctAnswerIndex,
  launchDateTime,
  createdByFirstName,
}) => {
  try {
    const newQuestion = {
      region: REGION_MAP[region] || region,
      question,
      options,
      correctAnswerIndex,
      launchDateTime: dayjs(launchDateTime).toISOString(),
      createdAt: dayjs().toISOString(),
      createdBy: createdByFirstName || "Unknown",
    };
    await addDoc(collection(db, "quizQuestions"), newQuestion);
    console.log(`✅ Quiz question added by ${createdByFirstName}`);
  } catch (error) {
    console.error("❌ Error adding quiz question:", error);
  }
};

export const getUpcomingQuizQuestions = async (region) => {
  try {
    const now = dayjs().toISOString();
    const q = query(collection(db, "quizQuestions"), fbWhere("region", "==", region));
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      .filter((q) => q.launchDateTime >= now);
  } catch (error) {
    console.error("❌ Error fetching upcoming quiz questions:", error);
    return [];
  }
};

export const deleteQuizQuestion = async (questionId) => {
  try {
    await deleteDoc(doc(db, "quizQuestions", questionId));
    console.log("✅ Quiz question deleted");
  } catch (error) {
    console.error("❌ Error deleting quiz question:", error);
  }
};

export const updateQuizQuestion = async (questionId, updatedData) => {
  try {
    const questionRef = doc(db, "quizQuestions", questionId);
    await updateDoc(questionRef, {
      ...updatedData,
      updatedAt: dayjs().toISOString(),
    });
    console.log("✅ Quiz question updated");
  } catch (error) {
    console.error("❌ Error updating quiz question:", error);
  }
};

/* ===================== LIVE QUIZ HELPERS ===================== */

/** Resolve quiz id from a session object or id */
export const resolveQuizId = (s) => (typeof s === "string" ? s : s?.quizId || s?.id || null);

/** Fetch a quiz doc by id. Tries /live first, falls back to /quizzes. */
export async function fetchQuizDoc(quizId) {
  if (!quizId) return null;
  const tryPaths = [
    ["live", quizId],
    ["quizzes", quizId],
  ];
  for (const [col, id] of tryPaths) {
    const ref = doc(db, col, id);
    const snap = await getDoc(ref);
    if (snap.exists()) return { id: snap.id, ...snap.data(), __col: col };
  }
  return null;
}

/**
 * Ensure a session stub exists for a live quiz.
 * Stored under: live_sessions/{quizId}
 */
export async function ensureLiveSessionStub(quizId, launchAt = null, host = {}) {
  const ref = doc(db, "live_sessions", quizId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      quizId,
      status: "scheduled",          // "scheduled" | "live" | "ended"
      isLive: true,
      launchAt: launchAt || null,   // JS Date or Firestore Timestamp acceptable
      currentQuestionIndex: 0,
      currentQuestionStartAt: null, // serverTimestamp when started
      createdAt: serverTimestamp(),
      hostUid: host?.uid || null,
      hostEmail: host?.email || null,
    });
  } else if (launchAt) {
    await updateDoc(ref, { launchAt });
  }
  return ref;
}

/**
 * Listen for the single current live session (status == "live").
 * Calls cb(sessionOrNull). Returns unsubscribe.
 */
export function watchActiveLiveSession(cb) {
  const q = query(
    collection(db, "live_sessions"),
    fbWhere("status", "==", "live"),
    fbLimit(1)
  );
  return onSnapshot(q, (snap) => {
    if (snap.empty) return cb(null);
    const d = snap.docs[0];
    cb({ id: d.id, ...d.data() });
  });
}

/**
 * Same as watchActiveLiveSession, but also resolves the quiz doc.
 * cb({ session, quiz }) or cb(null) when none.
 */
export function watchActiveLiveSessionWithQuiz(cb) {
  return watchActiveLiveSession(async (session) => {
    if (!session) return cb(null);
    const qid = resolveQuizId(session);
    const quiz = await fetchQuizDoc(qid);
    cb({ session, quiz });
  });
}

/**
 * Listen to the next scheduled (soonest) session.
 * Calls cb(sessionOrNull). Returns unsubscribe.
 */
export function watchNextScheduledLive(cb) {
  const q = query(
    collection(db, "live_sessions"),
    fbWhere("status", "==", "scheduled"),
    fbOrderBy("launchAt", "asc"),
    fbLimit(1)
  );
  return onSnapshot(q, (snap) => {
    if (snap.empty) return cb(null);
    const d = snap.docs[0];
    cb({ id: d.id, ...d.data() });
  });
}

/**
 * Same as watchNextScheduledLive, but also resolves the quiz doc.
 * cb({ session, quiz }) or cb(null)
 */
export function watchNextScheduledLiveWithQuiz(cb) {
  return watchNextScheduledLive(async (session) => {
    if (!session) return cb(null);
    const qid = resolveQuizId(session);
    const quiz = await fetchQuizDoc(qid);
    cb({ session, quiz });
  });
}

/**
 * Listen to a specific live session doc by quizId/sessionId.
 */
export function watchLiveSession(quizIdOrSessionId, cb) {
  const realId = resolveQuizId(quizIdOrSessionId);
  const ref = doc(db, "live_sessions", realId);
  return onSnapshot(ref, (snap) => {
    cb(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

/**
 * Start the live session (host).
 */
export async function startLiveSession(quizId, host = {}) {
  const realId = resolveQuizId(quizId);
  const ref = doc(db, "live_sessions", realId);
  await updateDoc(ref, {
    status: "live",
    currentQuestionIndex: 0,
    currentQuestionStartAt: serverTimestamp(),
    hostUid: host?.uid || null,
    hostEmail: host?.email || null,
    startedAt: serverTimestamp(),
  });
}

/**
 * Move to next question (host). Optionally guard by quiz length.
 */
export async function advanceLiveQuestion(quizId, nextIndex, quizLength = null) {
  if (quizLength != null && nextIndex >= quizLength) return;
  const realId = resolveQuizId(quizId);
  const ref = doc(db, "live_sessions", realId);
  await updateDoc(ref, {
    currentQuestionIndex: nextIndex,
    currentQuestionStartAt: serverTimestamp(),
  });
}

/**
 * End session (host).
 */
export async function endLiveSession(quizId) {
  const realId = resolveQuizId(quizId);
  const ref = doc(db, "live_sessions", realId);
  await updateDoc(ref, {
    status: "ended",
    endedAt: serverTimestamp(),
  });
}

/**
 * Submit a live answer one time per user per question.
 * Protected by doc id: {uid}_q{qIndex}
 */
export async function submitLiveAnswer({
  quizId,
  uid,
  displayName,
  qIndex,
  answerIndex,
  correct,
  sessionStartMs, // ms since epoch of currentQuestionStartAt (optional)
}) {
  const realId = resolveQuizId(quizId);
  const docId = `${uid}_q${qIndex}`;
  const ansRef = doc(db, "live_sessions", realId, "answers", docId);
  const exists = await getDoc(ansRef);
  if (exists.exists()) return false;

  const timeMsSinceStart = Math.max(0, Date.now() - Number(sessionStartMs || Date.now()));

  await setDoc(ansRef, {
    uid,
    displayName,
    qIndex: Number(qIndex),
    answerIndex: Number(answerIndex),
    correct: !!correct,
    timeMsSinceStart,
    submittedAt: serverTimestamp(),
  });
  return true;
}

/**
 * Check if user already answered current question.
 */
export async function hasAnsweredLiveQuestion(quizId, uid, qIndex) {
  const realId = resolveQuizId(quizId);
  const docId = `${uid}_q${qIndex}`;
  const ansRef = doc(db, "live_sessions", realId, "answers", docId);
  const snap = await getDoc(ansRef);
  return snap.exists();
}

/**
 * Stream answers for a given question index (for live leaderboard).
 * cb receives array of answer docs.
 */
export function watchLiveAnswersForQuestion(quizId, qIndex, cb) {
  const realId = resolveQuizId(quizId);
  const q = query(
    collection(db, "live_sessions", realId, "answers"),
    fbWhere("qIndex", "==", Number(qIndex))
  );
  return onSnapshot(q, (snap) => {
    const arr = [];
    snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
    cb(arr);
  });
}

/**
 * Compute a leaderboard array from raw answer docs.
 * Sort: more correct > less time, then earlier submit.
 */
export function computeLiveLeaderboard(allAnswers = []) {
  const byUser = new Map();
  allAnswers.forEach((a) => {
    const uid = a.uid || "anon";
    const name = a.displayName || uid;
    const correct = !!a.correct;
    const timeMs = Number(a.timeMsSinceStart || 0);
    const submittedAtMs =
      a.submittedAt?.toMillis ? a.submittedAt.toMillis() : 0;

    if (!byUser.has(uid)) {
      byUser.set(uid, { uid, name, correct: 0, totalTimeMs: 0, lastAt: 0 });
    }
    const agg = byUser.get(uid);
    if (correct) {
      agg.correct += 1;
      agg.totalTimeMs += timeMs;
    }
    if (submittedAtMs > agg.lastAt) agg.lastAt = submittedAtMs;
  });

  return Array.from(byUser.values()).sort((a, b) => {
    if (b.correct !== a.correct) return b.correct - a.correct;
    if (a.totalTimeMs !== b.totalTimeMs) return a.totalTimeMs - b.totalTimeMs;
    return a.lastAt - b.lastAt;
  });
}

/**
 * Aggregate results across all questions (for export / final board).
 */
export async function aggregateLiveResults(quizId) {
  const realId = resolveQuizId(quizId);
  const answersSnap = await getDocs(collection(db, "live_sessions", realId, "answers"));
  const answers = answersSnap.docs.map((d) => d.data());
  return computeLiveLeaderboard(answers);
}

/**
 * Convenience: find active live session (at most one).
 */
export async function getActiveLiveSession() {
  const qSnap = await getDocs(
    query(collection(db, "live_sessions"), fbWhere("status", "==", "live"), fbLimit(1))
  );
  if (qSnap.empty) return null;
  const d = qSnap.docs[0];
  return { id: d.id, ...d.data() };
}

/**
 * Convenience: find next scheduled session (soonest by launchAt).
 */
export async function getNextScheduledLive() {
  const qSnap = await getDocs(
    query(
      collection(db, "live_sessions"),
      fbWhere("status", "==", "scheduled"),
      fbOrderBy("launchAt", "asc"),
      fbLimit(1)
    )
  );
  if (qSnap.empty) return null;
  const d = qSnap.docs[0];
  return { id: d.id, ...d.data() };
}

/* =======================================================================
   ADDITIONS for AllScores.jsx + Leaderboard reset utilities
   ======================================================================= */

/** Build a friendly display name from a /users doc */
export function buildFullName(u = {}) {
  const first =
    u.firstName ||
    u.firstname ||
    (u.fullName ? String(u.fullName).split(" ")[0] : "");
  const last = u.lastName || "";
  const combined = `${first || ""} ${last || ""}`.trim();
  return combined || u.fullName || "";
}

/** Fetch all users basic: id, fullName, full doc data */
export async function fetchAllUsersBasic() {
  const snap = await getDocs(collection(db, "users"));
  const rows = [];
  snap.forEach((d) => {
    const data = d.data() || {};
    rows.push({
      id: d.id,
      fullName: buildFullName(data),
      ...data,
    });
  });
  return rows;
}

/** Build quiz meta map:
 *  - Prefer /quizzes (title, region, launchAt, status)
 *  - Fallback to region collections (uscan, we, afr, sa, esea, latam)
 */
export async function buildQuizMetaMap() {
  const meta = {};

  // Prefer /quizzes
  try {
    const qSnap = await getDocs(collection(db, "quizzes"));
    qSnap.forEach((d) => {
      const qd = d.data() || {};
      meta[d.id] = {
        id: d.id,
        title: qd.title || "Untitled",
        region: qd.region || qd.regionKey || "",
        launchAt: qd.launchAt || null,
        status: qd.status || "",
      };
    });
  } catch (e) {
    console.warn("No /quizzes collection found or failed to read:", e);
  }

  // Region fallbacks
  try {
    const fetches = REGION_KEYS.map(async (rk) => {
      const rs = await getDocs(query(collection(db, rk), fbOrderBy("launchAt", "desc")));
      rs.docs.forEach((docSnap) => {
        const d = docSnap.data() || {};
        if (!meta[docSnap.id]) {
          meta[docSnap.id] = {
            id: docSnap.id,
            title: d.title || "Untitled",
            region: rk,
            launchAt: d.launchAt || null,
            status: d.status || "",
          };
        }
      });
    });
    await Promise.all(fetches);
  } catch (e) {
    console.warn("Region fallback failed:", e);
  }

  return meta;
}

/* ---------------- Leaderboard Reset (non-destructive) ---------------- */

/** Get the current "since" label for leaderboard (e.g., "Aug 11"). */
export async function getLeaderboardSinceLabel(defaultLabel = "Aug 1") {
  try {
    const sref = doc(db, "settings", "leaderboard");
    const snap = await getDoc(sref);
    if (snap.exists()) {
      const ts = snap.data().lastResetAt;
      const dt = ts?.toDate ? ts.toDate() : null;
      if (dt) return dayjs(dt).format("MMM D");
    }
  } catch (e) {
    console.warn("getLeaderboardSinceLabel failed:", e);
  }
  return defaultLabel;
}

/** Watch the leaderboard "since" label in real-time. Returns unsubscribe. */
export function watchLeaderboardSince(cb) {
  const sref = doc(db, "settings", "leaderboard");
  return onSnapshot(sref, (snap) => {
    if (!snap.exists()) return cb(null);
    const ts = snap.data().lastResetAt;
    const dt = ts?.toDate ? ts.toDate() : null;
    cb(dt ? dayjs(dt).format("MMM D") : null);
  });
}

/**
 * Reset leaderboard *view* by setting settings/leaderboard.lastResetAt to now.
 * Does NOT delete any scores or reactions.
 * Returns the Timestamp used.
 */
export async function resetLeaderboardNow(meta = {}) {
  const when = Timestamp.now(); // immediate value you can show in UI
  try {
    await setDoc(
      doc(db, "settings", "leaderboard"),
      {
        lastResetAt: when,
        lastResetBy: normalizeEmail(meta.by) || "system",
      },
      { merge: true }
    );
    return when;
  } catch (e) {
    console.error("resetLeaderboardNow failed:", e);
    throw e;
  }
}

/* ---------------- Presence (Participants on Live page) ---------------- */

export const PRESENCE_COLLECTION = "presence_live";
export const PRESENCE_STALE_MS = 60_000;

/** Create a stable presence id: `${uid}_${tabId}` */
export function makePresenceId(uid, tabId) {
  const t =
    tabId ||
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `tab_${Math.random().toString(36).slice(2)}`);
  const u = uid || "anon";
  return `${u}_${t}`;
}

/**
 * Join presence: writes/merges a presence doc and starts a heartbeat.
 * Returns an object with `stop()` to clear the interval and delete the doc.
 */
export function joinLivePresence({ uid, firstName, isAdmin = false, tabId, sessionId = null }) {
  const id = makePresenceId(uid, tabId);
  const ref = doc(db, PRESENCE_COLLECTION, id);

  let stopped = false;
  let timer = null;

  const upsert = async () => {
    try {
      await setDoc(
        ref,
        {
          uid: uid || "anon",
          firstName: firstName || "User",
          isAdmin: !!isAdmin,
          sessionId: sessionId || null,
          joinedAt: serverTimestamp(),
          lastSeen: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (e) {
      console.error("joinLivePresence upsert failed:", e);
    }
  };

  upsert();
  timer = setInterval(async () => {
    if (stopped) return;
    try {
      await updateDoc(ref, { lastSeen: serverTimestamp(), isAdmin: !!isAdmin });
    } catch {}
  }, 25_000);

  const stop = async () => {
    if (stopped) return;
    stopped = true;
    if (timer) clearInterval(timer);
    try {
      await deleteDoc(ref);
    } catch {}
  };

  return { presenceId: id, stop };
}

/** Manual heartbeat if you manage intervals elsewhere. */
export async function touchLivePresence(presenceId, isAdmin = undefined) {
  try {
    const patch = { lastSeen: serverTimestamp() };
    if (typeof isAdmin === "boolean") patch.isAdmin = isAdmin;
    await updateDoc(doc(db, PRESENCE_COLLECTION, presenceId), patch);
  } catch {}
}

/** Explicit leave (deletes the presence doc). */
export async function leaveLivePresence(presenceId) {
  try {
    await deleteDoc(doc(db, PRESENCE_COLLECTION, presenceId));
  } catch {}
}

/**
 * Watch presence list. Dedupe by uid, filter stale entries (< staleMs),
 * admins first, then by firstName. Optionally filter by sessionId.
 * Calls cb(array).
 */
export function watchLivePresence({ sessionId = null, staleMs = PRESENCE_STALE_MS } = {}, cb) {
  const colRef = collection(db, PRESENCE_COLLECTION);
  return onSnapshot(colRef, (snap) => {
    const NOW = Date.now();
    const safeMs = (ts) =>
      ts?.toMillis ? ts.toMillis() : (typeof ts === "number" ? ts : 0);

    const raw = [];
    snap.forEach((d) => raw.push({ id: d.id, ...d.data() }));

    const filtered = raw.filter((r) => {
      if (sessionId && r.sessionId && r.sessionId !== sessionId) return false;
      return NOW - safeMs(r.lastSeen) < staleMs;
    });

    // dedupe by uid -> pick most recent lastSeen
    const byUid = new Map();
    filtered.forEach((p) => {
      const ex = byUid.get(p.uid);
      if (!ex || safeMs(p.lastSeen) > safeMs(ex.lastSeen)) byUid.set(p.uid, p);
    });
    const unique = Array.from(byUid.values());

    unique.sort((a, b) =>
      a.isAdmin === b.isAdmin
        ? String(a.firstName || "").localeCompare(String(b.firstName || ""))
        : a.isAdmin
        ? -1
        : 1
    );

    cb(unique);
  });
}
