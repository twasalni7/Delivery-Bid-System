import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Loader2, ArrowRight, Car, User, Phone, MapPin, Calendar, CreditCard, Hash } from "lucide-react";

interface DriverRegistrationData {
  name: string;
  mobile: string;
  city: string;
  carType: string;
  carYear: string;
  nationality: string;
  nationalId: string;
  age: number;
}

export default function DriverRegister() {
  const { toast } = useToast();
  const [formData, setFormData] = useState<DriverRegistrationData>({
    name: "",
    mobile: "",
    city: "",
    carType: "",
    carYear: "",
    nationality: "",
    nationalId: "",
    age: 0,
  });

  const registerMutation = useMutation({
    mutationFn: async (data: DriverRegistrationData) => {
      const res = await fetch("/api/driver-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "فشل تقديم الطلب");
      }

      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "تم تقديم الطلب بنجاح",
        description: "سيتم مراجعة طلبك من قبل الإدارة وإرسال بيانات الدخول إليك عبر رقم الجوال",
      });
      setFormData({
        name: "",
        mobile: "",
        city: "",
        carType: "",
        carYear: "",
        nationality: "",
        nationalId: "",
        age: 0,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.name.trim()) {
      toast({ title: "خطأ", description: "الرجاء إدخال الاسم", variant: "destructive" });
      return;
    }
    if (!formData.mobile.match(/^05\d{8}$/)) {
      toast({ title: "خطأ", description: "رقم الجوال يجب أن يبدأ بـ 05 ويتكون من 10 أرقام", variant: "destructive" });
      return;
    }
    if (!formData.city.trim()) {
      toast({ title: "خطأ", description: "الرجاء إدخال المدينة", variant: "destructive" });
      return;
    }
    if (!formData.carType.trim()) {
      toast({ title: "خطأ", description: "الرجاء إدخال نوع السيارة", variant: "destructive" });
      return;
    }
    if (!formData.carYear.trim()) {
      toast({ title: "خطأ", description: "الرجاء إدخال سنة الصنع", variant: "destructive" });
      return;
    }
    if (!formData.nationality.trim()) {
      toast({ title: "خطأ", description: "الرجاء إدخال الجنسية", variant: "destructive" });
      return;
    }
    if (!formData.nationalId.trim()) {
      toast({ title: "خطأ", description: "الرجاء إدخال رقم الهوية", variant: "destructive" });
      return;
    }
    if (formData.age < 18 || formData.age > 100) {
      toast({ title: "خطأ", description: "العمر يجب أن يكون بين 18 و 100", variant: "destructive" });
      return;
    }

    registerMutation.mutate(formData);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4" dir="rtl">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-600 text-white p-4 rounded-full">
              <Car size={32} />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold">تسجيل سائق جديد</CardTitle>
          <CardDescription className="text-lg">
            املأ البيانات أدناه لتقديم طلب الانضمام كسائق
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-2">
                  <User size={16} />
                  الاسم الكامل
                </Label>
                <Input
                  id="name"
                  placeholder="محمد أحمد"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mobile" className="flex items-center gap-2">
                  <Phone size={16} />
                  رقم الجوال
                </Label>
                <Input
                  id="mobile"
                  placeholder="05xxxxxxxx"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  pattern="05\d{8}"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city" className="flex items-center gap-2">
                  <MapPin size={16} />
                  المدينة
                </Label>
                <Input
                  id="city"
                  placeholder="الرياض"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nationality" className="flex items-center gap-2">
                  <User size={16} />
                  الجنسية
                </Label>
                <Input
                  id="nationality"
                  placeholder="سعودي"
                  value={formData.nationality}
                  onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nationalId" className="flex items-center gap-2">
                  <CreditCard size={16} />
                  رقم الهوية / الإقامة
                </Label>
                <Input
                  id="nationalId"
                  placeholder="1234567890"
                  value={formData.nationalId}
                  onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="age" className="flex items-center gap-2">
                  <Hash size={16} />
                  العمر
                </Label>
                <Input
                  id="age"
                  type="number"
                  placeholder="25"
                  min="18"
                  max="100"
                  value={formData.age || ""}
                  onChange={(e) => setFormData({ ...formData, age: parseInt(e.target.value) || 0 })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="carType" className="flex items-center gap-2">
                  <Car size={16} />
                  نوع السيارة
                </Label>
                <Input
                  id="carType"
                  placeholder="تويوتا كامري"
                  value={formData.carType}
                  onChange={(e) => setFormData({ ...formData, carType: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="carYear" className="flex items-center gap-2">
                  <Calendar size={16} />
                  سنة الصنع
                </Label>
                <Input
                  id="carYear"
                  placeholder="2020"
                  value={formData.carYear}
                  onChange={(e) => setFormData({ ...formData, carYear: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="pt-4 space-y-4">
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جاري التقديم...
                  </>
                ) : (
                  <>
                    تقديم الطلب
                    <ArrowRight className="mr-2 h-4 w-4" />
                  </>
                )}
              </Button>

              <div className="text-center text-sm text-gray-600">
                <p>هل لديك حساب بالفعل؟</p>
                <Link href="/driver/login">
                  <a className="text-blue-600 hover:underline font-medium">
                    تسجيل الدخول
                  </a>
                </Link>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
