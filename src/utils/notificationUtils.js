// utils/notificationUtils.js

import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import { listenToReactions } from "./firestoreUtils";
// utils/useNotifications.js

import { useEffect } from "react";
import { monitorNotifications } from "./notificationUtils";

/**
 * Custom hook to start monitoring leaderboard and reaction notifications.
 * Automatically cleans up listeners on unmount.
 */
export function useNotifications(currentUser, setToasts) {
  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = monitorNotifications(currentUser, setToasts);

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentUser]);
}

/**
 * Monitors Firestore for:
 *  - Rank changes (based on total quiz scores)
 *  - Emoji reactions to the user's leaderboard entry
 * Triggers toast messages when there's a new rank or reaction.
 */
export const monitorNotifications = (currentUser, setToasts) => {
  const username = currentUser?.username;
  if (!username) return;

  const userDocRef = doc(db, "notifications", username);

  const showToast = (msg) => {
    setToasts((prev) => [...prev, msg]);
    setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 4000);
  };

  // 🔔 RANK MONITORING
  const unsubscribeRank = onSnapshot(doc(db, "users", username), async (snapshot) => {
    const scores = snapshot.data()?.scores || {};
    let totalScore = 0;
    let totalTime = 0;

    Object.values(scores).forEach((entry) => {
      totalScore += Number(entry.score) || 0;
      totalTime += Number(entry.timeSpent) || 0;
    });

    const allUsersSnap = await getDocs(collection(db, "users"));
    const allUsers = [];

    allUsersSnap.forEach((docSnap) => {
      const data = docSnap.data();
      const userScores = data.scores || {};
      let userTotal = 0;
      let userTime = 0;

      Object.values(userScores).forEach((entry) => {
        userTotal += Number(entry.score) || 0;
        userTime += Number(entry.timeSpent) || 0;
      });

      allUsers.push({
        username: docSnap.id,
        total: userTotal,
        time: userTime,
      });
    });

    // Sort users by score, then by time
    allUsers.sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return a.time - b.time;
    });

    const newRank = allUsers.findIndex((u) => u.username === username) + 1;

    const userNotifSnap = await getDoc(userDocRef);
    const existingData = userNotifSnap.exists() ? userNotifSnap.data() : {};
    const lastRank = existingData.lastRank || Infinity;

    if (newRank < lastRank) {
      showToast(`🥇 Congrats! Your rank improved to #${newRank}`);
    }

    await setDoc(userDocRef, { ...existingData, lastRank: newRank }, { merge: true });
  });

  // 🔔 REACTION MONITORING
  const unsubscribeReactions = listenToReactions(async (reactionData) => {
    const userReactions = reactionData[username] || {};

    const docSnap = await getDoc(userDocRef);
    const lastData = docSnap.exists() ? docSnap.data() : {};
    const lastReactions = lastData.lastReactions || {};

    Object.entries(userReactions).forEach(([emoji, users]) => {
      const prevUsers = lastReactions[emoji] || [];
      const newUsers = users.filter((u) => !prevUsers.includes(u));

      if (newUsers.length > 0) {
        const sender = newUsers[0].split("@")[0];
        showToast(`💬 ${sender} reacted with ${emoji} to your score!`);
      }
    });

    await setDoc(
      userDocRef,
      { ...lastData, lastReactions: userReactions },
      { merge: true }
    );
  });

  // Cleanup subscriptions when component unmounts
  return () => {
    unsubscribeRank();
    unsubscribeReactions();
  };
};
