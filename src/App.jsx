// src/App.jsx
import React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import './app.css';

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






// Import your pages



// Define routes
const router = createBrowserRouter([
  { path: "/", element: <Login/> },
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
  
 
  

  
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
