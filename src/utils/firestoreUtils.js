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
  where,
  deleteDoc,
  deleteField,
  limit,
} from "firebase/firestore";
import { db } from "../firebase";
import dayjs from "dayjs";

// ✅ Supported emojis for reactions
export const EMOJIS = ["❤️", "🔥", "👏", "🌟", "😍"];

// ✅ Map region keys to human-readable names
export const REGION_MAP = {
  we: "Western Europe",
  uscan: "US & Canada",
  latam: "Latin America",
  afr: "Africa",
  esea: "Eastern Europe & South East Asia",
  sa: "South Asia",
};

/* ---------------- QUIZ RESULTS ---------------- */

// ✅ Save quiz result (1 attempt per quiz unless admin)
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
    const isAdmin = (userData.role || "").toLowerCase() === "admin";

    // ✅ Restrict if quiz already attempted (non-admin)
    if (currentScores[quizId] && !isAdmin) {
      console.warn(`⛔ Quiz '${quizId}' already taken by ${username}`);
      return;
    }

    const timestamp = dayjs().format("YYYY-MM-DD HH:mm:ss");
    const dateOfAttempt = dayjs().format("YYYY-MM-DD");
    const timeOfAttempt = dayjs().format("HH:mm:ss");

    const regionCode = regionKey;
    const regionName = REGION_MAP[regionKey] || regionKey;

    // what we store in the user's scores map
    const newScore = {
      regionCode,
      regionName,
      score,
      timeSpent: typeof timeSpent === "number" ? timeSpent : null,
      date: timestamp,          // legacy field you already used
      dateOfAttempt,
      timeOfAttempt,
    };

    // ✅ Update user's scores map
    await updateDoc(userRef, {
      scores: {
        ...currentScores,
        [quizId]: newScore,
      },
    });

    // ✅ Also store under quizScores_<quizId> with a predictable doc id (username)
    //    AND include userId so your fallback query also works.
    const quizUserDocRef = doc(db, `quizScores_${quizId}`, username);
    const firstName =
      userData.firstname ||
      userData.firstName ||
      (userData.fullName ? String(userData.fullName).split(" ")[0] : username);

    await setDoc(quizUserDocRef, {
      userId: username,         // 👈 required for Profile.jsx fallback
      firstName,
      regionCode,
      regionName,
      score,
      timeSpent: typeof timeSpent === "number" ? timeSpent : null,
      dateOfAttempt,
      timeOfAttempt,
      savedAt: timestamp,
      // Optionally keep any other fields you want here
    });

    console.log(`✅ Saved quiz '${quizId}' score for ${username}`);
  } catch (error) {
    console.error("❌ Error saving quiz result:", error);
  }
};

// ✅ Check if user already attempted a quiz
export const hasUserAttemptedQuiz = async (username, quizId) => {
  try {
    // 1) Fast check: user doc map
    const userRef = doc(db, "users", username);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return false;

    const scores = userSnap.data().scores || {};
    if (scores[quizId]) return true;

    // 2) Direct check: quizScores_<quizId>/<username>
    const directRef = doc(db, `quizScores_${quizId}`, username);
    const directSnap = await getDoc(directRef);
    if (directSnap.exists()) return true;

    // 3) Fallback query by userId
    const qs = await getDocs(
      query(collection(db, `quizScores_${quizId}`), where("userId", "==", username), limit(1))
    );
    return qs.size > 0;
  } catch (error) {
    console.error("❌ Error checking quiz attempt:", error);
    return false;
  }
};

// ✅ Get all users’ quiz scores
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

// ✅ Get scores for each published quiz
export const getQuizScores = async (quizId) => {
  try {
    // If you actually store quizzes by region collections, adjust this part.
    // Keeping your existing logic as-is.
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

// ✅ Delete all users' quiz scores (admin action)
export const deleteAllUserScores = async () => {
  try {
    const usersRef = collection(db, "users");
    const snapshot = await getDocs(usersRef);

    const ops = [];

    snapshot.forEach((docSnap) => {
      const userRef = doc(db, "users", docSnap.id);
      // Option 1: Reset to empty object
      ops.push(updateDoc(userRef, { scores: {} }));
      // Option 2 (uncomment to completely remove the field):
      // ops.push(updateDoc(userRef, { scores: deleteField() }));
    });

    await Promise.all(ops);
    console.log("✅ All user scores have been deleted.");
  } catch (error) {
    console.error("❌ Error deleting all user scores:", error);
  }
};

/* ---------------- EMOJI REACTIONS ---------------- */

// ✅ Listen to emoji reactions in real time
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

// ✅ Add or replace emoji reaction
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

// ✅ Get summary like "🔥💯 18+ · Reacted by: Alice, Bob, Shiv"
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

/* ---------------- ADMIN QUIZ MANAGEMENT ---------------- */

// ✅ Add new quiz question
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

// ✅ Get upcoming quiz questions
export const getUpcomingQuizQuestions = async (region) => {
  try {
    const now = dayjs().toISOString();
    const q = query(collection(db, "quizQuestions"), where("region", "==", region));
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      .filter((q) => q.launchDateTime >= now);
  } catch (error) {
    console.error("❌ Error fetching upcoming quiz questions:", error);
    return [];
  }
};

// ✅ Delete quiz question
export const deleteQuizQuestion = async (questionId) => {
  try {
    await deleteDoc(doc(db, "quizQuestions", questionId));
    console.log("✅ Quiz question deleted");
  } catch (error) {
    console.error("❌ Error deleting quiz question:", error);
  }
};

// ✅ Edit quiz question
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
