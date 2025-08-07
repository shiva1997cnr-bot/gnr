// src/utils/firestoreUtils.js
import { doc, getDoc, updateDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import dayjs from "dayjs";

// ✅ Save quiz result with timestamp and time spent
export const saveQuizResult = async (username, regionKey, score, timeSpent) => {
  try {
    const userRef = doc(db, "users", username);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      console.error("User does not exist:", username);
      return;
    }

    const userData = userSnap.data();
    const currentScores = userData.scores || {};

    const timestamp = dayjs().format("YYYY-MM-DD HH:mm:ss");

    const newScore = {
      score,
      timeSpent,
      date: timestamp,
    };

    const updatedScores = {
      ...currentScores,
      [regionKey]: newScore,
    };

    await updateDoc(userRef, {
      scores: updatedScores,
    });

    console.log(`✅ Saved ${regionKey} score for ${username}`);
  } catch (error) {
    console.error("❌ Error saving quiz result:", error);
  }
};

// ✅ Admin-only: fetch all users and their scores in flattened format
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
