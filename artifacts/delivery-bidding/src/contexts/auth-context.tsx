import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import type { AuthUser } from "@workspace/api-client-react";

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
    query: { retry: false, enabled },
  });
  const logoutMutation = useLogout();

  const refetch = useCallback(async () => {
    setEnabled(true);
    await refetchQuery();
  }, [refetchQuery]);

  const logout = useCallback(() => {
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        refetchQuery();
      },
    });
  }, [logoutMutation, refetchQuery]);

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
