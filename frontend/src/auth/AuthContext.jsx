import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  api,
  readCachedUser,
  readToken,
  saveCachedUser,
  saveToken,
  setUnauthorizedHandler,
} from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => readToken());
  const [user, setUser] = useState(() => (readToken() ? readCachedUser() : null));
  const [validating, setValidating] = useState(() => Boolean(readToken()));
  const [expired, setExpired] = useState(false);

  const logout = useCallback(() => {
    saveToken(null);
    saveCachedUser(null);
    setToken(null);
    setUser(null);
    setValidating(false);
  }, []);

  // A 401 anywhere clears the session; the router then sends the user to /login.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      // Only an API-driven 401 sets this; a manual logout does not.
      setExpired(true);
      logout();
    });
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  // Validate the stored token in the background. The cached profile renders the
  // shell immediately, so a hard refresh never bounces through a login screen.
  useEffect(() => {
    if (!token) {
      setValidating(false);
      return undefined;
    }
    let cancelled = false;
    setValidating(true);
    api
      .me()
      .then((profile) => {
        if (cancelled) return;
        setUser(profile);
        saveCachedUser(profile);
      })
      .catch((error) => {
        if (cancelled) return;
        if (error.status === 401 || error.status === 403) logout();
      })
      .finally(() => {
        if (!cancelled) setValidating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, logout]);

  const login = useCallback(async (email, password) => {
    const result = await api.login(email, password);
    saveToken(result.access_token);
    saveCachedUser(result.user);
    setToken(result.access_token);
    setUser(result.user);
    setValidating(false);
    setExpired(false);
    return result.user;
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      validating,
      expired,
      isAuthenticated: Boolean(token && user),
      isManager: user?.role === "manager",
      login,
      logout,
    }),
    [user, token, validating, expired, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
