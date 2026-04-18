import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAdminLogin } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert } from "lucide-react";

export default function AdminLoginPage() {
  const [, setLocation] = useLocation();
  const { refetch } = useAuth();
  const { toast } = useToast();
  const loginMutation = useAdminLogin();
  const [loginCode, setLoginCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginCode.trim()) {
      toast({ title: "يرجى إدخال رمز الدخول", variant: "destructive" });
      return;
    }
    loginMutation.mutate(
      { data: { loginCode: loginCode.trim() } },
      {
        onSuccess: async () => {
          await refetch();
          setLocation("/admin");
        },
        onError: (err: Error) => {
          toast({ title: err.message ?? "رمز الدخول غير صحيح", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4" dir="rtl">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center bg-primary text-primary-foreground p-3 rounded-md mb-3 shadow">
          <ShieldAlert size={32} />
        </div>
        <h1 className="text-3xl font-black">توصّلني</h1>
        <p className="text-muted-foreground text-sm mt-1">لوحة الإدارة</p>
      </div>

      <Card className="w-full max-w-sm border-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-black">دخول الإدارة</CardTitle>
          <CardDescription>أدخل رمز دخول المدير للوصول</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="loginCode" className="font-bold text-xs">رمز الدخول</Label>
              <Input
                id="loginCode"
                placeholder="ADMIN2024"
                value={loginCode}
                onChange={(e) => setLoginCode(e.target.value)}
                dir="ltr"
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full font-bold" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? "جاري الدخول..." : "دخول"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Link href="/" className="mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors">
        ← العودة للرئيسية
      </Link>
    </div>
  );
}
