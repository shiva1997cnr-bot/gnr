import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import dayjs from "dayjs";

// ✅ Supported emojis for reactions
export const EMOJIS = ["❤️", "🔥", "👏", "🌟", "😍"];

// ✅ Save quiz result, one attempt per month per region (admin exempt)
export const saveQuizResult = async (username, regionKey, score, timeSpent) => {
  try {
    const userRef = doc(db, "users", username);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      console.error("❌ User does not exist:", username);
      return;
    }

    const userData = userSnap.data();
    const currentScores = userData.scores || {};
    const isAdmin = userData.role === "admin";

    const today = dayjs();
    const currentMonth = today.format("YYYY-MM");

    const previousAttempt = currentScores[regionKey];
    if (
      previousAttempt &&
      !isAdmin &&
      dayjs(previousAttempt.date).format("YYYY-MM") === currentMonth
    ) {
      console.warn(`⛔ Quiz for '${regionKey}' already taken in ${currentMonth} by ${username}`);
      return;
    }

    const timestamp = today.format("YYYY-MM-DD HH:mm:ss");

    const newScore = { score, timeSpent, date: timestamp };
    const updatedScores = {
      ...currentScores,
      [regionKey]: newScore,
    };

    await updateDoc(userRef, { scores: updatedScores });

    console.log(`✅ Saved ${regionKey} score for ${username}`);
  } catch (error) {
    console.error("❌ Error saving quiz result:", error);
  }
};

// ✅ Get all users’ quiz scores (flattened for export)
export const getAllUserScores = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "users"));
    const allScores = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const username = docSnap.id;
      const fullName = `${data.firstName || ""} ${data.lastName || ""}`.trim();
      const scores = data.scores || {};

      Object.entries(scores).forEach(([region, scoreData]) => {
        allScores.push({
          username,
          fullName,
          region,
          score: scoreData?.score ?? "",
          date: scoreData?.date ?? "",
          timeSpent: scoreData?.timeSpent ?? "",
        });
      });
    });

    return allScores;
  } catch (error) {
    console.error("❌ Error fetching all user scores:", error);
    return [];
  }
};

// ✅ Listen to emoji reactions in real time
export const listenToReactions = (setReactions) => {
  const reactionsRef = collection(db, "reactions");

  return onSnapshot(reactionsRef, (snapshot) => {
    const allReactions = {};
    snapshot.forEach((docSnap) => {
      const data = docSnap.data(); // e.g., { "🔥": ["shiv", "ravi"] }
      allReactions[docSnap.id] = data; // doc.id is the username who received the reactions
    });
    setReactions(allReactions);
  });
};

// ✅ Add or replace emoji reaction (1 per user per leaderboard user)
export const addReaction = async (targetUsername, emoji, reactingUsername) => {
  try {
    const reactionRef = doc(db, "reactions", targetUsername);
    const reactionSnap = await getDoc(reactionRef);

    let existingData = reactionSnap.exists() ? reactionSnap.data() : {};

    // ❌ Remove this user's old reaction from all emojis
    Object.keys(existingData).forEach((em) => {
      existingData[em] = existingData[em].filter((user) => user !== reactingUsername);
    });

    // ✅ Add the new reaction
    if (!existingData[emoji]) existingData[emoji] = [];
    existingData[emoji].push(reactingUsername);

    await setDoc(reactionRef, existingData);
    console.log(`✅ ${reactingUsername} reacted to ${targetUsername} with ${emoji}`);
  } catch (error) {
    console.error("❌ Error adding reaction:", error);
  }
};

// ✅ Get "🔥💯 18+ · Reacted by: Alice, Bob, Shiv" style summary
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
      const firstName = full.split(" ")[0]; // show only first name
      reactedByNames.add(firstName);
    });
  });

  return {
    summaryText: summary.join(" "),
    reactedBy: Array.from(reactedByNames),
  };
};
