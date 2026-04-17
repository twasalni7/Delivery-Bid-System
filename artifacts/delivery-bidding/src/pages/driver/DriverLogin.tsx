import { useState } from "react";
import { useLocation } from "wouter";
import { useDriverLogin } from "@workspace/api-client-react";
import { useDriverSession } from "@/hooks/use-driver-session";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Truck } from "lucide-react";

export default function DriverLogin() {
  const [, setLocation] = useLocation();
  const { setDriverId } = useDriverSession();
  const { toast } = useToast();
  const driverLogin = useDriverLogin();

  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: "يرجى إدخال اسمك", variant: "destructive" });
      return;
    }

    driverLogin.mutate(
      { data: { name: name.trim() } },
      {
        onSuccess: (driver) => {
          setDriverId(driver.id);
          toast({ title: `مرحباً ${driver.name}!`, description: `رصيدك الحالي: ${driver.balance.toFixed(2)} ر.س` });
          setLocation("/driver/dashboard");
        },
        onError: () => {
          toast({ title: "فشل تسجيل الدخول", variant: "destructive" });
        },
      }
    );
  };

  return (
    <Layout role="driver">
      <div className="max-w-sm mx-auto mt-16">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center bg-primary text-primary-foreground p-3 rounded-sm mb-4">
            <Truck size={32} />
          </div>
          <h1 className="text-2xl font-black">دخول السائق</h1>
          <p className="text-muted-foreground text-sm mt-1">أدخل اسمك للوصول إلى بوابة السائق</p>
        </div>

        <Card className="border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">تسجيل الدخول</CardTitle>
            <CardDescription className="text-xs">السائقون الجدد يُسجَّلون تلقائياً عند أول دخول</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="font-bold text-xs">الاسم الكامل</Label>
                <Input
                  id="name"
                  placeholder="مثال: أحمد الرشيد"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>

              <Button
                type="submit"
                className="w-full font-bold"
                disabled={driverLogin.isPending}
              >
                {driverLogin.isPending ? "جاري الدخول..." : "دخول بوابة السائق"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
