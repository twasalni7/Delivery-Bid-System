import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import type { AuthUser } from "@workspace/api-client-react";
import { subscribeToPush, clearPushSubscriptionCache } from "@/lib/push-notifications";

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(true);
  const { data: user, isLoading, isFetching, refetch: refetchQuery } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false, enabled },
  });
  const logoutMutation = useLogout();

  const refetch = useCallback(async () => {
    setEnabled(true);
    await refetchQuery();
  }, [refetchQuery]);

  const logout = useCallback(() => {
    clearPushSubscriptionCache();
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        refetchQuery();
      },
    });
  }, [logoutMutation, refetchQuery]);

  // Subscribe to push notifications after a successful login (pass role for correct table routing)
  useEffect(() => {
    if (user) {
      void subscribeToPush(user.role);
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user: user ?? null, isLoading: isLoading || isFetching, refetch, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
