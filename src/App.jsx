// src/App.jsx
import React from "react";
import './App.css';
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import Intro from "./pages/Intro";
import Region from "./pages/Region";
import SA from "./pages/SA";
import AFR from "./pages/AFR";
import LATAM from "./pages/LATAM";
import USCAN from "./pages/USCAN";
import WE from "./pages/WE";
import ESEA from "./pages/ESEA"; // ✅ Added this
import UserId from "./pages/UserId";
import Login from "./pages/Login"; // 👈 Import
import Register from "./pages/Register";
import Scores from "./pages/Scores";

// Inside createBrowserRouter([...])



const router = createBrowserRouter([
  { path: "/", element: <Login /> },
  { path: "/region", element: <Region /> },
  { path: "/sa", element: <SA /> },
  { path: "/afr", element: <AFR /> },
  { path: "/latam", element: <LATAM /> },
  { path: "/uscan", element: <USCAN /> },
  { path: "/we", element: <WE /> },
  { path: "/esea", element: <ESEA /> }, // ✅ New ESEA route
  { path: "/userid", element: <UserId /> },
  { path: "/intro", element: <Intro /> },
  { path: "/Register", element: <Register /> },
  { path: "/scores", element: <Scores/> },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
