// firebase.js
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; // ✅ Add this

const firebaseConfig = {
  apiKey: "AIzaSyBqimiOH3KBud7bjAy1qfZ9im16hhdJYYs",
  authDomain: "gnr-quiz-a4355.firebaseapp.com",
  projectId: "gnr-quiz-a4355",
  storageBucket: "gnr-quiz-a4355.appspot.com",
  messagingSenderId: "38744340671",
  appId: "1:38744340671:web:3dea6127c2db03fe0c6e0a",
  measurementId: "G-KWM6HPRDD1"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app); // ✅ Initialize Firestore

export { app, auth, db }; // ✅ Export db
