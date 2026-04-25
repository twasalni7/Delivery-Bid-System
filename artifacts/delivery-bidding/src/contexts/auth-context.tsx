import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { getSupabase } from "@/lib/supabase";

// نوع المستخدم المحلي بعد الربط بـ Supabase
export interface AppUser {
  id: string;
  name: string;
  role: "client" | "driver" | "admin";
  mobile?: string | null;
}

interface AuthContextType {
  user: AppUser | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Track the latest loadUser invocation to discard stale results
  const loadIdRef = useRef(0);

  const loadUser = useCallback(async () => {
    const currentId = ++loadIdRef.current;
    setIsLoading(true);
    try {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (currentId !== loadIdRef.current) return; // discard stale result
      if (!session) {
        setUser(null);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, role, phone")
        .eq("id", session.user.id)
        .single();

      if (currentId !== loadIdRef.current) return; // discard stale result
      if (profile) {
        // تحويل 'customer' → 'client' ليتوافق مع أسماء الأدوار في التطبيق
        const role =
          profile.role === "customer"
            ? "client"
            : (profile.role as "driver" | "admin");
        setUser({ id: profile.id, name: profile.full_name, role, mobile: profile.phone });
      } else {
        setUser(null);
      }
    } catch {
      if (currentId !== loadIdRef.current) return; // discard stale result
      setUser(null);
    } finally {
      if (currentId === loadIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadUser();
    let unsubscribe: (() => void) | undefined;
    try {
      const supabase = getSupabase();
      const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
        loadUser();
      });
      unsubscribe = () => subscription.unsubscribe();
    } catch {
      // Supabase not configured — skip realtime subscription
    }
    return () => unsubscribe?.();
  }, [loadUser]);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    await loadUser();
  }, [loadUser]);

  const logout = useCallback(async () => {
    try {
      const supabase = getSupabase();
      await supabase.auth.signOut();
    } catch {
      // Supabase not configured — skip remote sign-out
    }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, refetch, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
