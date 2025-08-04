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
  { path: "/scores", element: <Scores /> },
]);

function App() {
  return <RouterProvider router={router} />;
}
<h1
  className="text-5xl font-extrabold bg-gradient-to-r from-purple-300 via-pink-400 to-red-400 bg-clip-text text-transparent animate-shimmer tracking-wider drop-shadow-md mb-2"
>
  Generalist
</h1>

export default App;
{
<div className="container mx-auto px-4">
  {/* content here */}
</div>
}

{<div className="w-full max-w-screen-xl px-4 sm:px-6 lg:px-8 mx-auto">
  {/* your main content here */}
</div>
}

