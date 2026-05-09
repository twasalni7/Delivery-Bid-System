import { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react";
import { logout as callLogoutApi } from "@workspace/api-client-react";
import type { AuthUser } from "@workspace/api-client-react";
import { clearPushSubscriptionCache } from "@/lib/push-notifications";

const LS_USER_KEY = "auth_user";
const LS_TOKEN_KEY = "auth_token";
const LS_PUSH_KEY = "push_subscribed";

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

/**
 * AuthProvider
 *
 * الإصلاحات (PR #134):
 * - تمت إزالة استدعاء subscribeToPush من هنا تجنباً للتكرار مع FlowOrchestrator في App.tsx
 * - FlowOrchestrator هو المسؤول الوحيد عن loginOneSignal/logoutOneSignal
 * - AuthProvider يكتفي بحفظ بيانات المستخدم وتنظيف localStorage عند الخروج
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readStoredUser);
  const prevUserIdRef = useRef<number | string | null>(null);

  const login = useCallback((data: AuthUser) => {
    const { token, ...userData } = data;
    if (token) {
      try { localStorage.setItem(LS_TOKEN_KEY, token); } catch { /* ignore */ }
    }
    try { localStorage.setItem(LS_USER_KEY, JSON.stringify(userData)); } catch { /* ignore */ }
    setUser(userData);
    prevUserIdRef.current = userData.id;
  }, []);

  const refetch = useCallback(() => {
    setUser(readStoredUser());
  }, []);

  const logout = useCallback(() => {
    clearPushSubscriptionCache();

    // Capture the token BEFORE clearing localStorage so the server can invalidate it.
    let currentToken: string | null = null;
    try { currentToken = localStorage.getItem(LS_TOKEN_KEY); } catch { /* ignore */ }
    try { localStorage.removeItem(LS_TOKEN_KEY); } catch { /* ignore */ }
    try { localStorage.removeItem(LS_USER_KEY); } catch { /* ignore */ }
    try { localStorage.removeItem(LS_PUSH_KEY); } catch { /* ignore */ }
    setUser(null);
    prevUserIdRef.current = null;

    // Fire server-side logout with the captured token so the DB record is deleted.
    void callLogoutApi(
      currentToken ? { headers: { Authorization: `Bearer ${currentToken}` } } : undefined
    ).catch(() => { /* non-critical */ });
  }, []);

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
