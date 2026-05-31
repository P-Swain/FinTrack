/**
 * main.jsx
 *
 * Application entry point.
 *
 * Wrapping order (outermost → innermost):
 *   <React.StrictMode>      — double-invokes lifecycle hooks in dev to catch bugs
 *     <BrowserRouter>       — provides routing context for all <Route> / <Link>
 *       <AuthProvider>      — provides auth state & actions to all components
 *         <App />           — renders the route tree
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
