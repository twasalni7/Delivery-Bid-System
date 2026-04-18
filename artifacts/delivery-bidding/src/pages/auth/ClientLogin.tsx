import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useClientLogin } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Bus } from "lucide-react";

export default function ClientLogin() {
  const [, setLocation] = useLocation();
  const { refetch } = useAuth();
  const { toast } = useToast();
  const loginMutation = useClientLogin();

  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobile.trim() || !password.trim()) {
      toast({ title: "يرجى ملء جميع الحقول", variant: "destructive" });
      return;
    }
    loginMutation.mutate(
      { data: { mobile: mobile.trim(), password } },
      {
        onSuccess: async () => {
          await refetch();
          setLocation("/client");
        },
        onError: (err: Error) => {
          toast({ title: err.message ?? "بيانات الدخول غير صحيحة", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4" dir="rtl">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center bg-primary text-primary-foreground p-3 rounded-md mb-3 shadow">
          <Bus size={32} />
        </div>
        <h1 className="text-3xl font-black">توصّلني</h1>
        <p className="text-muted-foreground text-sm mt-1">بوابة العميل</p>
      </div>

      <Card className="w-full max-w-sm border-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-black">تسجيل الدخول</CardTitle>
          <CardDescription>أدخل رقم جوالك وكلمة المرور</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="mobile" className="font-bold text-xs">رقم الجوال</Label>
              <Input
                id="mobile"
                type="tel"
                placeholder="05xxxxxxxx"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                dir="ltr"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="font-bold text-xs">كلمة المرور</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                dir="ltr"
              />
            </div>
            <Button type="submit" className="w-full font-bold" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? "جاري الدخول..." : "دخول"}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-4">
            ليس لديك حساب؟{" "}
            <Link href="/client/register" className="text-primary font-bold hover:underline">
              سجّل الآن
            </Link>
          </p>
        </CardContent>
      </Card>

      <Link href="/" className="mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors">
        ← العودة للرئيسية
      </Link>
    </div>
  );
}
