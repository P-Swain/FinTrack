/**
 * context/AuthContext.jsx
 *
 * Provides authentication state to the entire app via React Context.
 *
 * Design decisions:
 *  - Token is stored in React state (memory) only — NOT in localStorage or
 *    sessionStorage.  This means a page refresh logs the user out, which is
 *    intentional for this learning project (avoids XSS token-theft risks).
 *  - setAuthToken() from api/axios.js is called whenever the token changes so
 *    that every subsequent Axios request automatically includes the header.
 *  - AuthContext never imports React Router hooks; navigation is the caller's
 *    responsibility (Login/Register pages call navigate() after login/register).
 */

import { createContext, useContext, useState, useCallback } from "react";
import { loginUser, registerUser } from "../api/auth.api";
import { setAuthToken } from "../api/axios";

// ── Create the context ────────────────────────────────────────────────────────
const AuthContext = createContext(null);

// ── Provider component ────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  // user: the decoded user object from the backend { id, full_name, email, role, created_at }
  // token: the raw JWT string — kept in memory only
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  // isAuthenticated: true if we have both a token and a user object in memory
  const isAuthenticated = Boolean(token && user);

  /**
   * login — calls POST /api/auth/login, stores user + token in memory,
   * and updates the Axios default Authorization header.
   *
   * @param {{ email: string, password: string }} credentials
   * @throws {Error} Re-throws Axios errors so the Login page can display them.
   */
  const login = useCallback(async (credentials) => {
    // loginUser returns { message, token, user } on success
    const data = await loginUser(credentials);

    // Store token in React state (memory only — no localStorage)
    setToken(data.token);
    setUser(data.user);

    // Tell the Axios instance to include Authorization on all future requests
    setAuthToken(data.token);

    return data;
  }, []);

  /**
   * register — calls POST /api/auth/register.
   * Does NOT log the user in automatically; the caller should redirect to /login.
   *
   * @param {{ full_name: string, email: string, password: string }} userData
   * @throws {Error} Re-throws Axios errors so the Register page can display them.
   */
  const register = useCallback(async (userData) => {
    const data = await registerUser(userData);
    return data; // { message, user }
  }, []);

  /**
   * logout — clears user + token from memory and removes the Authorization header.
   * The user will be redirected by ProtectedRoute on the next render.
   */
  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setAuthToken(null); // removes Authorization header from Axios
  }, []);

  const value = {
    user,
    token,
    isAuthenticated,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Custom hook ───────────────────────────────────────────────────────────────
/**
 * useAuth — convenience hook to consume AuthContext.
 * Throws a helpful error if used outside of <AuthProvider>.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside an <AuthProvider>");
  }
  return context;
}
