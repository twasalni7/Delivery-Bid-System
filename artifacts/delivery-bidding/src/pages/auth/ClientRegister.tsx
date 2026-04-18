import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useClientRegister } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Bus } from "lucide-react";

export default function ClientRegister() {
  const [, setLocation] = useLocation();
  const { refetch } = useAuth();
  const { toast } = useToast();
  const registerMutation = useClientRegister();

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !mobile.trim() || !password || !confirm) {
      toast({ title: "يرجى ملء جميع الحقول", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "كلمتا المرور غير متطابقتين", variant: "destructive" });
      return;
    }
    registerMutation.mutate(
      { data: { name: name.trim(), mobile: mobile.trim(), password } },
      {
        onSuccess: async () => {
          await refetch();
          setLocation("/client");
        },
        onError: (err: Error) => {
          toast({ title: err.message ?? "فشل إنشاء الحساب", variant: "destructive" });
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
        <p className="text-muted-foreground text-sm mt-1">تسجيل عميل جديد</p>
      </div>

      <Card className="w-full max-w-sm border-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-black">إنشاء حساب</CardTitle>
          <CardDescription>أدخل بياناتك لإنشاء حساب عميل</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="font-bold text-xs">الاسم الكامل</Label>
              <Input
                id="name"
                placeholder="مثال: محمد العتيبي"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mobile" className="font-bold text-xs">رقم الجوال</Label>
              <Input
                id="mobile"
                type="tel"
                placeholder="05xxxxxxxx"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                dir="ltr"
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
            <div className="space-y-1.5">
              <Label htmlFor="confirm" className="font-bold text-xs">تأكيد كلمة المرور</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                dir="ltr"
              />
            </div>
            <Button type="submit" className="w-full font-bold" disabled={registerMutation.isPending}>
              {registerMutation.isPending ? "جاري التسجيل..." : "إنشاء الحساب"}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-4">
            لديك حساب بالفعل؟{" "}
            <Link href="/client/login" className="text-primary font-bold hover:underline">
              سجّل دخولك
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
