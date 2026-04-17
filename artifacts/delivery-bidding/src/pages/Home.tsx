import { Link } from "wouter";
import { Bus, User, Truck, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center bg-primary text-primary-foreground p-3 rounded-md mb-4 shadow-sm">
          <Bus size={48} />
        </div>
        <h1 className="text-5xl font-black tracking-tight mb-2">دوامات شهرية</h1>
        <p className="text-xl text-muted-foreground">نظام مزايدة توصيل الدوام الشهري</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full">
        <Card className="border-2 hover:border-primary transition-colors hover:shadow-md cursor-pointer group">
          <Link href="/client" className="block h-full">
            <CardHeader className="text-center pb-2">
              <User className="mx-auto h-12 w-12 text-muted-foreground group-hover:text-primary transition-colors" />
              <CardTitle className="text-2xl mt-4">بوابة العميل</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription className="text-base mb-6">
                أضف طلب دوام شهري واستعرض عروض السائقين واختر الأنسب.
              </CardDescription>
              <Button className="w-full font-bold">دخول كعميل</Button>
            </CardContent>
          </Link>
        </Card>

        <Card className="border-2 hover:border-primary transition-colors hover:shadow-md cursor-pointer group">
          <Link href="/driver" className="block h-full">
            <CardHeader className="text-center pb-2">
              <Truck className="mx-auto h-12 w-12 text-muted-foreground group-hover:text-primary transition-colors" />
              <CardTitle className="text-2xl mt-4">بوابة السائق</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription className="text-base mb-6">
                استعرض طلبات الدوام المتاحة وقدّم أفضل عرض لك.
              </CardDescription>
              <Button className="w-full font-bold">دخول كسائق</Button>
            </CardContent>
          </Link>
        </Card>

        <Card className="border-2 hover:border-primary transition-colors hover:shadow-md cursor-pointer group">
          <Link href="/admin" className="block h-full">
            <CardHeader className="text-center pb-2">
              <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground group-hover:text-primary transition-colors" />
              <CardTitle className="text-2xl mt-4">لوحة الإدارة</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription className="text-base mb-6">
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
