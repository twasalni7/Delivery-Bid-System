import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useDriverLogin } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Truck } from "lucide-react";

export default function DriverLoginPage() {
  const [, setLocation] = useLocation();
  const { refetch } = useAuth();
  const { toast } = useToast();
  const loginMutation = useDriverLogin();

  const [mobile, setMobile] = useState("");
  const [loginCode, setLoginCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobile.trim() || !loginCode.trim()) {
      toast({ title: "يرجى إدخال رقم الجوال ورمز الدخول", variant: "destructive" });
      return;
    }
    loginMutation.mutate(
      { data: { mobile: mobile.trim(), loginCode: loginCode.trim() } },
      {
        onSuccess: async () => {
          await refetch();
          setLocation("/driver/dashboard");
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
          <Truck size={32} />
        </div>
        <h1 className="text-3xl font-black">توصّلني</h1>
        <p className="text-muted-foreground text-sm mt-1">بوابة السائق</p>
      </div>

      <Card className="w-full max-w-sm border-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-black">دخول السائق</CardTitle>
          <CardDescription>يُسجَّل السائقون عبر الإدارة ويحصلون على رمز دخول</CardDescription>
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
              <Label htmlFor="loginCode" className="font-bold text-xs">رمز الدخول</Label>
              <Input
                id="loginCode"
                placeholder="الرمز المعطى من الإدارة"
                value={loginCode}
                onChange={(e) => setLoginCode(e.target.value)}
                dir="ltr"
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
