import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { logout as callLogoutApi } from "@workspace/api-client-react";
import type { AuthUser } from "@workspace/api-client-react";
import { subscribeToPush, clearPushSubscriptionCache } from "@/lib/push-notifications";

const LS_USER_KEY = "auth_user";
const LS_TOKEN_KEY = "auth_token";
const LS_PUSH_KEY = "push_subscribed"; // ← المفتاح اللي يسبب المشكلة

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
  // نحتاج ref عشان نعرف إذا الـ user تغير من null إلى قيمة (تسجيل دخول جديد)
  const prevUserIdRef = useRef<number | string | null>(null);

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
    // Unlink the device from this user in OneSignal
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try { await OneSignal.logout(); } catch { /* non-critical */ }
    });
    // Capture the token BEFORE clearing localStorage so the server can invalidate it.
    let currentToken: string | null = null;
    try { currentToken = localStorage.getItem(LS_TOKEN_KEY); } catch { /* ignore */ }
    try { localStorage.removeItem(LS_TOKEN_KEY); } catch { /* ignore */ }
    try { localStorage.removeItem(LS_USER_KEY); } catch { /* ignore */ }
    // ✅ الإصلاح: امسح push_subscribed عند تسجيل الخروج
    // بهذا لما يسجل المستخدم دخول من جديد، يُعاد تسجيل الـ push token
    try { localStorage.removeItem(LS_PUSH_KEY); } catch { /* ignore */ }
    setUser(null);
    prevUserIdRef.current = null;
    // Fire server-side logout with the captured token so the DB record is deleted.
    void callLogoutApi(
      currentToken ? { headers: { Authorization: `Bearer ${currentToken}` } } : undefined
    ).catch(() => { /* non-critical */ });
  }, []);

  // ✅ الإصلاح: عند تسجيل الدخول، تحقق من الـ push subscription وأعد تسجيلها إذا لزم
  // هذا يحل مشكلة "يظهر الزر مرة واحدة فقط" لأننا نعيد التسجيل تلقائياً عند كل دخول
  useEffect(() => {
    if (!user) {
      prevUserIdRef.current = null;
      return;
    }

    const isNewLogin = prevUserIdRef.current !== user.id;
    prevUserIdRef.current = user.id;

    if (!("Notification" in window)) return;

    if (Notification.permission === "granted") {
      // إذا الإذن ممنوح، اعد التسجيل دائماً عند تغيير المستخدم
      // subscribeToPush ذكية: لو الـ subscription موجودة وصالحة، تعمل sync مع السيرفر فقط
      void subscribeToPush(user.role);
    } else if (isNewLogin && Notification.permission === "default") {
      // المستخدم جديد أو لم يمنح الإذن بعد — امسح الكاش عشان يظهر الزر من جديد
      try { localStorage.removeItem(LS_PUSH_KEY); } catch { /* ignore */ }
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
