// --- Imports ---
import React, { useState, useEffect, createContext } from 'react';
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./styles/app.css";
import "./styles/loading.css";

// Pages
import Login from "./pages/Login";
import Intro from "./pages/Intro";
import Region from "./pages/Region";
import SA from "./pages/SA";
import AFR from "./pages/AFR";
import LATAM from "./pages/LATAM";
import USCAN from "./pages/USCAN";
import WE from "./pages/WE";
import ESEA from "./pages/ESEA";
import AdminLogs from "./pages/AdminLogs";
import Scores from "./pages/Scores";
import UserID from "./pages/UserId";
import Register from './pages/Register';
import Profile from './pages/Profile';
import Leaderboard from './pages/Leaderboard';
import LoadingScreen from "./components/LoadingScreen";

// ✅ Admin quiz pages
import AdminAddQuiz from "./pages/AdminAddQuiz";
import AdminQuizView from "./pages/AdminQuizView";
import AdminQuizEdit from "./pages/AdminQuizEdit";

// Firebase
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import Live from './pages/Live';
import AllScores from './pages/AllScores';
import About from './pages/About';
import FAQ from './pages/FAQ';

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
const db = getFirestore(app);

// --- Auth Context ---
export const AuthContext = createContext(null);

const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("currentUser"));
    setCurrentUser(storedUser);
    setUserId(storedUser?.uid || crypto.randomUUID());
    setTimeout(() => setLoading(false), 1500);
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <AuthContext.Provider value={{ currentUser, setUser: setCurrentUser, userId, loading, db }}>
      {children}
    </AuthContext.Provider>
  );
};

// --- LoginLayout ---
const LoginLayout = ({ children }) => {
  return (
    <div className="login-container">
      <div className="org-name">Generalist</div>
      <div className="welcome-note">Glad you're here</div>
      <div className="sub-note">We're excited to help you learn and grow.</div>
      {children}
    </div>
  );
};

// --- Error Page ---
function ErrorPage() {
  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1 style={{ color: "red" }}>404 - Page Not Found</h1>
      <p>Oops! The page you're looking for doesn't exist.</p>
      <a href="/" style={{ color: "blue", textDecoration: "underline" }}>Go to Home</a>
    </div>
  );
}

// --- Routes ---
const router = createBrowserRouter([
  { path: "/", element: <LoginLayout><Login /></LoginLayout> },
  { path: "/intro", element: <Intro /> },
  { path: "/region", element: <Region /> },
  { path: "/sa", element: <SA /> },
  { path: "/afr", element: <AFR /> },
  { path: "/latam", element: <LATAM /> },
  { path: "/uscan", element: <USCAN /> },
  { path: "/we", element: <WE /> },
  { path: "/esea", element: <ESEA /> },
  { path: "/register", element: <LoginLayout><Register /></LoginLayout> },
  { path: "/adminlogs", element: <AdminLogs /> },
  { path: "/scores", element: <Scores /> },
  { path: "/userid", element: <UserID /> },
  { path: "/profile", element: <Profile /> },
  { path: "/leaderboard", element: <Leaderboard /> },
  { path: "/live", element: <Live /> },
  { path: "/about", element: <About /> },
  { path: "/faq", element: <FAQ /> },
  // ✅ Admin quiz routes
  { path: "/admin-add-quiz", element: <AdminAddQuiz /> },
  { path: "/admin/quizzes/:region/:quizId", element: <AdminQuizView /> },
  { path: "/admin/quizzes/:region/:quizId/edit", element: <AdminQuizEdit /> },

  // ✅ AllScores (register BOTH paths so Region.jsx → /allscores works)
  { path: "/allscores", element: <AllScores /> },
  { path: "/admin/allscores", element: <AllScores /> },

  { path: "*", element: <ErrorPage /> },
]);

// --- App ---
function App() {
  return <RouterProvider router={router} fallbackElement={<ErrorPage />} />;
}

// --- Wrapped App ---
export default function WrappedApp() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}
