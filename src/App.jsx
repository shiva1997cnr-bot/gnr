import React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./styles/app.css";

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

function ErrorPage() {
  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1 style={{ color: "red" }}>404 - Page Not Found</h1>
      <p>Oops! The page you're looking for doesn't exist.</p>
      <a href="/" style={{ color: "blue", textDecoration: "underline" }}>Go to Home</a>
    </div>
  );
}

const router = createBrowserRouter([
  { path: "/", element: <Login /> },
  { path: "/intro", element: <Intro /> },
  { path: "/region", element: <Region /> },
  { path: "/sa", element: <SA /> },
  { path: "/afr", element: <AFR /> },
  { path: "/latam", element: <LATAM /> },
  { path: "/uscan", element: <USCAN /> },
  { path: "/we", element: <WE /> },
  { path: "/esea", element: <ESEA /> },
  { path: "/register", element: <Register /> },
  { path: "/adminlogs", element: <AdminLogs /> },
  { path: "/scores", element: <Scores /> },
  { path: "/userid", element: <UserID /> },
  { path: "*", element: <ErrorPage /> }, // 👈 404 fallback route
]);

function App() {
  return <RouterProvider router={router} fallbackElement={<ErrorPage />} />;
}

export default App;
