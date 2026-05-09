/**
 * use-push-notifications.ts — OneSignal Hook
 */
import { useEffect, useCallback } from "react";
import { initOneSignal, loginOneSignal, logoutOneSignal, requestPushPermission } from "@/lib/push-notifications";

interface UsePushNotificationsOptions {
  userId?: number;
  role?: string;
  autoInit?: boolean;
}

export function usePushNotifications({ userId, role, autoInit = true }: UsePushNotificationsOptions = {}) {
  useEffect(() => {
    if (autoInit) {
      initOneSignal().catch(console.warn);
    }
  }, [autoInit]);

  useEffect(() => {
    if (userId && role) {
      loginOneSignal(userId, role).catch(console.warn);
    }
  }, [userId, role]);

  const requestPermission = useCallback(async () => {
    return requestPushPermission();
  }, []);

  const logout = useCallback(async () => {
    return logoutOneSignal();
  }, []);

  return { requestPermission, logout };
}
