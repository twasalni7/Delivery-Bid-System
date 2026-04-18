import { Link } from "wouter";
import { Bus, User, Truck, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4" dir="rtl">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center bg-primary text-primary-foreground p-3 rounded-md mb-4 shadow">
          <Bus size={48} />
        </div>
        <h1 className="text-5xl font-black tracking-tight mb-2">توصّلني</h1>
        <p className="text-xl text-muted-foreground">اشتراكات التوصيل الشهري</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-3xl w-full">
        <Card className="border-2 hover:border-primary transition-colors hover:shadow-md cursor-pointer group">
          <Link href="/client/login" className="block h-full">
            <CardHeader className="text-center pb-2">
              <User className="mx-auto h-10 w-10 text-muted-foreground group-hover:text-primary transition-colors" />
              <CardTitle className="text-xl mt-3">بوابة العميل</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription className="text-sm mb-5">
                أضف طلب دوام شهري واستعرض عروض السائقين واختر الأنسب.
              </CardDescription>
              <Button className="w-full font-bold">دخول كعميل</Button>
            </CardContent>
          </Link>
        </Card>

        <Card className="border-2 hover:border-primary transition-colors hover:shadow-md cursor-pointer group">
          <Link href="/driver/login" className="block h-full">
            <CardHeader className="text-center pb-2">
              <Truck className="mx-auto h-10 w-10 text-muted-foreground group-hover:text-primary transition-colors" />
              <CardTitle className="text-xl mt-3">بوابة السائق</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription className="text-sm mb-5">
                استعرض طلبات الدوام المتاحة وقدّم أفضل عرض لك.
              </CardDescription>
              <Button className="w-full font-bold">دخول كسائق</Button>
            </CardContent>
          </Link>
        </Card>

        <Card className="border-2 hover:border-primary transition-colors hover:shadow-md cursor-pointer group">
          <Link href="/admin/login" className="block h-full">
            <CardHeader className="text-center pb-2">
              <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground group-hover:text-primary transition-colors" />
              <CardTitle className="text-xl mt-3">لوحة الإدارة</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription className="text-sm mb-5">
                إدارة الطلبات والسائقين والعروض والإشراف على المنصة.
              </CardDescription>
              <Button className="w-full font-bold">دخول كمدير</Button>
            </CardContent>
          </Link>
        </Card>
      </div>
    </div>
  );
}
