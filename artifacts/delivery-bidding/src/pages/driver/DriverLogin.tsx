import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import DriverLoginPage from "@/pages/auth/DriverLoginPage";

export default function DriverLogin() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user?.role === "driver") {
      setLocation("/driver/dashboard");
    }
  }, [user, isLoading, setLocation]);

  return <DriverLoginPage />;
}
