// src/App.jsx
import React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Login from "./pages/Login";
import Region from "./pages/Region";
import Intro from "./pages/Intro";
import SA from "./pages/SA";
import AFR from "./pages/AFR";
import LATAM from "./pages/LATAM";
import USCAN from "./pages/USCAN";
import WE from "./pages/WE";
import ESEA from "./pages/ESEA";
import UserID from "./pages/UserId";
import Register from "./pages/Register";
import Scores from "./pages/Scores";
import AdminLogs from "./pages/AdminLogs";



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
  { path: "/userid", element: <UserID /> },
  { path: "/register", element: <Register /> },
  { path: "/scores", element: <Scores /> },
  { path: "/adminlogs", element: <AdminLogs /> },
  

  
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
