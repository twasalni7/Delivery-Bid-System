import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useListRequests, useGetDriverMe, getGetDriverMeQueryKey, useListMyOffers, useUpdateOfferPrice, useWithdrawOffer } from "@workspace/api-client-react";
import type { DriverOffer } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Banknote, MapPin, Clock, Users, ChevronLeft, CheckCircle, Phone, FileText, Pencil, Trash2, X, Check } from "lucide-react";
import { getStatusColor, getStatusLabel } from "@/lib/status-utils";
import { formatTime12h } from "@/lib/time-utils";

type TabId = "available" | "my-offers";

export default function DriverDashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { data: driver } = useGetDriverMe({ query: { queryKey: getGetDriverMeQueryKey(), enabled: !!user } });
  const { data: allRequests, isLoading } = useListRequests(undefined, { query: { refetchInterval: 30_000 } });
  const { data: selectedRequests } = useListRequests({ status: "SELECTED" });
  const { data: myOffers, isLoading: offersLoading } = useListMyOffers({ query: { enabled: !!user, refetchInterval: 30_000 } });
  const openRequests = allRequests?.filter((r) => r.status === "OPEN" || r.status === "BIDDING");

  const [activeTab, setActiveTab] = useState<TabId>("available");
  const [editingOffer, setEditingOffer] = useState<{ id: number; price: string } | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const updatePrice = useUpdateOfferPrice();
  const withdrawOffer = useWithdrawOffer();

  useEffect(() => {
    if (!user) setLocation("/driver/login");
  }, [user, setLocation]);

  if (!user) return null;

  const hasEnoughBalance = driver ? driver.balance >= 50 : false;
  const mySelectedJobs = selectedRequests?.filter((r) => r.selectedDriverId === user.id) ?? [];
  const pendingOffers = myOffers?.filter((o) => o.request?.status === "OPEN" || o.request?.status === "BIDDING") ?? [];
  const closedOffers = myOffers?.filter((o) => o.request?.status !== "OPEN" && o.request?.status !== "BIDDING") ?? [];

  function startEdit(offer: DriverOffer) {
    setEditingOffer({ id: offer.id, price: String(offer.price) });
    setEditError(null);
  }

  function cancelEdit() {
    setEditingOffer(null);
    setEditError(null);
  }

  async function submitEdit() {
    if (!editingOffer) return;
    const price = parseFloat(editingOffer.price);
    if (isNaN(price) || price <= 0) {
      setEditError("أدخل سعراً صحيحاً");
      return;
    }
    try {
      await updatePrice.mutateAsync({ offerId: editingOffer.id, price });
      setEditingOffer(null);
      setEditError(null);
    } catch (err: unknown) {
      const apiErr = err as { data?: { error?: string } };
      setEditError(apiErr?.data?.error ?? "حدث خطأ أثناء التعديل");
    }
  }

  async function handleWithdraw(offerId: number) {
    if (!confirm("هل أنت متأكد من سحب هذا العرض؟")) return;
    try {
      await withdrawOffer.mutateAsync({ offerId });
    } catch (err: unknown) {
      const apiErr = err as { data?: { error?: string } };
      alert(apiErr?.data?.error ?? "حدث خطأ أثناء سحب العرض");
    }
  }

  return (
    <Layout role="driver">
      <div dir="rtl">
        <div className="mb-6">
          <h1 className="text-2xl font-black">لوحة السائق</h1>
          <p className="text-muted-foreground text-sm mt-0.5">طلبات الدوام المفتوحة — قدّم أفضل عرضك</p>
        </div>

        {driver && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            <Card className="border-2">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs font-bold text-muted-foreground">اسم السائق</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-lg font-black">{driver.name}</p>
              </CardContent>
            </Card>

            <Card className={`border-2 ${hasEnoughBalance ? "border-green-300 bg-green-50/30" : "border-red-300 bg-red-50/30"}`}>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                  <Banknote size={12} /> الرصيد
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className={`text-lg font-black ${hasEnoughBalance ? "text-green-700" : "text-red-600"}`} dir="ltr">
                  {driver.balance.toFixed(2)} ر.س
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 col-span-2 sm:col-span-1">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs font-bold text-muted-foreground">طلبات مفتوحة</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-lg font-black">{openRequests?.length ?? "—"}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {mySelectedJobs.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-black mb-3 text-green-700">🎉 تم اختيارك!</h2>
            <div className="space-y-3">
              {mySelectedJobs.map((req) => (
                <div key={req.id} className="flex items-start gap-3 bg-green-50 border-2 border-green-300 rounded-md px-4 py-4">
                  <CheckCircle size={20} className="text-green-600 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-green-800 text-sm mb-1">تم اختيارك لطلب #{req.id}</p>
                    <div className="flex items-center gap-1.5 text-green-700 text-xs mb-1">
                      <MapPin size={11} className="shrink-0" />
                      <span className="truncate">{req.homeLocation} → {req.workLocation}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-green-700 text-xs" dir="ltr">
                      <Clock size={11} className="shrink-0" />
                      <span>{formatTime12h(req.morningTime)}{req.eveningTime ? ` – ${formatTime12h(req.eveningTime)}` : ""}</span>
                    </div>
                    {req.phone && (
                      <div className="flex items-center gap-1.5 text-green-800 text-sm font-bold mt-2">
                        <Phone size={13} className="shrink-0" />
                        <span dir="ltr">{req.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!hasEnoughBalance && driver && (
          <div className="flex items-start gap-3 bg-amber-50 border-2 border-amber-300 rounded-md px-4 py-3 mb-6">
            <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold text-amber-800 text-sm">رصيد غير كافٍ</p>
              <p className="text-amber-700 text-xs mt-0.5">
                تحتاج إلى رصيد بحد أدنى 50 ريال لتقديم عروض. رصيدك الحالي: {driver.balance.toFixed(2)} ر.س. تواصل مع الإدارة لشحن الرصيد.
              </p>
            </div>
          </div>
        )}

        <div className="flex border-b-2 border-muted mb-5 gap-1">
          <button
            onClick={() => setActiveTab("available")}
            className={`px-4 py-2 text-sm font-bold rounded-t-md transition-colors ${
              activeTab === "available"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            الطلبات المتاحة
          </button>
          <button
            onClick={() => setActiveTab("my-offers")}
            className={`px-4 py-2 text-sm font-bold rounded-t-md transition-colors flex items-center gap-1.5 ${
              activeTab === "my-offers"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText size={13} />
            عروضي
            {myOffers && myOffers.length > 0 && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-black leading-none ${activeTab === "my-offers" ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {myOffers.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === "available" && (
          <>
            {isLoading && <div className="text-center py-16 text-muted-foreground">جاري تحميل الطلبات...</div>}

            {!isLoading && (!openRequests || openRequests.length === 0) && (
              <div className="text-center py-16 border-2 border-dashed rounded-md">
                <p className="text-xl font-bold">لا توجد طلبات مفتوحة</p>
                <p className="text-muted-foreground text-sm mt-2">تحقق لاحقاً لعروض دوام جديدة</p>
              </div>
            )}

            {openRequests && openRequests.length > 0 && (
              <div className="grid grid-cols-1 gap-4">
                {openRequests.map((req) => (
                  <Card key={req.id} className="border-2 hover:border-primary/50 transition-colors">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground font-mono mb-2">طلب #{req.id}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-sm">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <MapPin size={13} className="shrink-0 text-primary" />
                              <span className="truncate">{req.homeLocation} → {req.workLocation}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Clock size={13} className="shrink-0 text-primary" />
                              <span dir="ltr">{formatTime12h(req.morningTime)}{req.eveningTime ? ` – ${formatTime12h(req.eveningTime)}` : ""}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Users size={13} className="shrink-0 text-primary" />
                              <span>{req.numberOfPeople} أشخاص • {req.workingDaysPerWeek} أيام</span>
                            </div>
                          </div>
                        </div>
                        {hasEnoughBalance && (
                          <Button asChild size="sm" className="font-bold shrink-0 gap-1">
                            <Link href={`/driver/request/${req.id}`}>
                              عرض <ChevronLeft size={14} />
                            </Link>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "my-offers" && (
          <div className="space-y-4">
            {offersLoading && <div className="text-center py-16 text-muted-foreground">جاري تحميل عروضك...</div>}

            {!offersLoading && (!myOffers || myOffers.length === 0) && (
              <div className="text-center py-16 border-2 border-dashed rounded-md">
                <FileText size={32} className="mx-auto text-muted-foreground mb-3" />
                <p className="text-xl font-bold">لم تقدّم أي عروض بعد</p>
                <p className="text-muted-foreground text-sm mt-2">تصفّح الطلبات المتاحة وقدّم عرضك</p>
                <Button variant="outline" size="sm" className="mt-4 font-bold" onClick={() => setActiveTab("available")}>
                  عرض الطلبات المتاحة
                </Button>
              </div>
            )}

            {pendingOffers.length > 0 && (
              <div>
                <h3 className="text-sm font-black text-muted-foreground mb-2 uppercase tracking-wide">عروض قيد الانتظار</h3>
                <div className="space-y-3">
                  {pendingOffers.map((offer) => (
                    <Card key={offer.id} className="border-2 border-blue-200 bg-blue-50/20">
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground font-mono mb-1">طلب #{offer.requestId}</p>
                            {offer.request && (
                              <div className="space-y-1 mb-3">
                                <div className="flex items-center gap-1.5 text-sm text-foreground">
                                  <MapPin size={12} className="shrink-0 text-primary" />
                                  <span className="truncate font-medium">{offer.request.homeLocation} → {offer.request.workLocation}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground" dir="ltr">
                                  <Clock size={11} className="shrink-0" />
                                  <span>{formatTime12h(offer.request.morningTime)}{offer.request.eveningTime ? ` – ${formatTime12h(offer.request.eveningTime)}` : ""}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <Users size={11} className="shrink-0" />
                                  <span>{offer.request.numberOfPeople} أشخاص • {offer.request.workingDaysPerWeek} أيام/أسبوع</span>
                                </div>
                              </div>
                            )}

                            {editingOffer?.id === offer.id ? (
                              <div className="flex items-center gap-2 mt-1">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      min="1"
                                      step="1"
                                      value={editingOffer.price}
                                      onChange={(e) => setEditingOffer({ ...editingOffer, price: e.target.value })}
                                      className="w-28 border-2 border-primary rounded px-2 py-1 text-sm font-bold focus:outline-none"
                                      dir="ltr"
                                      autoFocus
                                    />
                                    <span className="text-xs text-muted-foreground">ر.س/شهر</span>
                                    <button
                                      onClick={submitEdit}
                                      disabled={updatePrice.isPending}
                                      className="text-green-600 hover:text-green-800 disabled:opacity-50"
                                      title="حفظ"
                                    >
                                      <Check size={18} />
                                    </button>
                                    <button
                                      onClick={cancelEdit}
                                      className="text-muted-foreground hover:text-foreground"
                                      title="إلغاء"
                                    >
                                      <X size={18} />
                                    </button>
                                  </div>
                                  {editError && <p className="text-xs text-red-600">{editError}</p>}
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <p className="text-base font-black text-primary" dir="ltr">{offer.price.toFixed(0)} ر.س</p>
                                <span className="text-xs text-muted-foreground">/شهر</span>
                              </div>
                            )}
                          </div>

                          {editingOffer?.id !== offer.id && (
                            <div className="flex flex-col gap-2 shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 font-bold text-xs h-8"
                                onClick={() => startEdit(offer)}
                              >
                                <Pencil size={12} /> تعديل
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 font-bold text-xs h-8 text-red-600 hover:text-red-700 hover:border-red-300"
                                onClick={() => handleWithdraw(offer.id)}
                                disabled={withdrawOffer.isPending}
                              >
                                <Trash2 size={12} /> سحب
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {closedOffers.length > 0 && (
              <div>
                <h3 className="text-sm font-black text-muted-foreground mb-2 uppercase tracking-wide">عروض سابقة</h3>
                <div className="space-y-3">
                  {closedOffers.map((offer) => (
                    <Card key={offer.id} className="border-2 opacity-70">
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-xs text-muted-foreground font-mono">طلب #{offer.requestId}</p>
                              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                                offer.request?.status === "SELECTED" ? "bg-green-100 text-green-700" :
                                offer.request?.status === "ACTIVE" ? "bg-blue-100 text-blue-700" :
                                "bg-muted text-muted-foreground"
                              }`}>
                                {offer.request?.status === "SELECTED" ? "تم الاختيار" :
                                 offer.request?.status === "ACTIVE" ? "نشط" :
                                 offer.request?.status === "COMPLETED" ? "مكتمل" : offer.request?.status}
                              </span>
                            </div>
                            {offer.request && (
                              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <MapPin size={12} className="shrink-0" />
                                <span className="truncate">{offer.request.homeLocation} → {offer.request.workLocation}</span>
                              </div>
                            )}
                            <p className="text-sm font-bold mt-1" dir="ltr">{offer.price.toFixed(0)} ر.س/شهر</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
