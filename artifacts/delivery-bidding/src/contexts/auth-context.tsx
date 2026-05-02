import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { useLogout } from "@workspace/api-client-react";
import type { AuthUser } from "@workspace/api-client-react";
import { subscribeToPush, clearPushSubscriptionCache } from "@/lib/push-notifications";

const LS_USER_KEY = "auth_user";
const LS_TOKEN_KEY = "auth_token";

function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(LS_USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (data: AuthUser) => void;
  refetch: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readStoredUser);
  const logoutMutation = useLogout();

  const login = useCallback((data: AuthUser) => {
    const { token, ...userData } = data;
    if (token) {
      try { localStorage.setItem(LS_TOKEN_KEY, token); } catch { /* ignore */ }
    }
    try { localStorage.setItem(LS_USER_KEY, JSON.stringify(userData)); } catch { /* ignore */ }
    setUser(userData);
  }, []);

  const refetch = useCallback(() => {
    setUser(readStoredUser());
  }, []);

  const logout = useCallback(() => {
    clearPushSubscriptionCache();
    try { localStorage.removeItem(LS_TOKEN_KEY); } catch { /* ignore */ }
    try { localStorage.removeItem(LS_USER_KEY); } catch { /* ignore */ }
    setUser(null);
    logoutMutation.mutate(undefined);
  }, [logoutMutation]);

  // Subscribe to push notifications when the user is set
  useEffect(() => {
    if (user) {
      void subscribeToPush(user.role);
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, isLoading: false, login, refetch, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
