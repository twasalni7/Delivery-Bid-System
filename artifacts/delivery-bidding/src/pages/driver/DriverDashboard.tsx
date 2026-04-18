import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useListRequests, useGetDriverMe, getGetDriverMeQueryKey, useListMyOffers, useUpdateOfferPrice, useWithdrawOffer } from "@workspace/api-client-react";
import type { DriverOffer } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import { Layout } from "@/components/layout";
import { AlertTriangle, MapPin, Clock, Users, CheckCircle, Phone, FileText, Pencil, Trash2, X, Check, MessageCircle } from "lucide-react";
import { getStatusLabel } from "@/lib/status-utils";
import { formatTime12h } from "@/lib/time-utils";

type TabId = "available" | "my-offers" | "earnings";

const DAYS_AR = ["الأح", "الإث", "الثل", "الأر", "الخم", "الج", "الس"];

export default function DriverDashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { data: driver } = useGetDriverMe({ query: { queryKey: getGetDriverMeQueryKey(), enabled: !!user } });
  const { data: allRequests, isLoading } = useListRequests(undefined, {});
  const { data: selectedRequests } = useListRequests({ status: "SELECTED" });
  const { data: myOffers, isLoading: offersLoading } = useListMyOffers({ query: { enabled: !!user } });
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

  const totalEarnings = closedOffers.reduce((sum, o) => {
    if (o.request?.status === "SELECTED" || o.request?.status === "ACTIVE" || o.request?.status === "COMPLETED") {
      return sum + (o.price ?? 0);
    }
    return sum;
  }, 0);

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

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: "available", label: "طلبات جديدة", icon: "📋" },
    { id: "my-offers", label: "عروضي", icon: "📄" },
    { id: "earnings", label: "أرباحي", icon: "💰" },
  ];

  return (
    <Layout role="driver">
      <div dir="rtl">
        <div className="mb-5">
          <h1 className="text-2xl font-black text-gray-900">لوحة السائق</h1>
          <p className="text-gray-400 text-xs mt-0.5">إدارة الاشتراكات والعروض</p>
        </div>

        {driver && (
          <div className="rounded-2xl p-4 mb-5 shadow-md" style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)" }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-white font-black text-lg">{driver.name}</p>
                <p className="text-white/70 text-xs">سائق توصّلني</p>
              </div>
              <div className={`text-right px-3 py-1.5 rounded-xl ${hasEnoughBalance ? "bg-white/20" : "bg-red-400/30"}`}>
                <p className="text-white/70 text-xs">الرصيد</p>
                <p className="text-white font-black" dir="ltr">{driver.balance.toFixed(0)} ر.س</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "أرباح", value: `${totalEarnings.toFixed(0)}`, unit: "ر.س" },
                { label: "نسبة القبول", value: myOffers && myOffers.length > 0 ? `${Math.round((closedOffers.length / myOffers.length) * 100)}%` : "—" },
                { label: "عروض نشطة", value: String(pendingOffers.length) },
                { label: "طلبات مفتوحة", value: String(openRequests?.length ?? 0) },
              ].map((stat) => (
                <div key={stat.label} className="bg-white/10 rounded-xl p-2 text-center">
                  <p className="text-white font-black text-base leading-tight">{stat.value}</p>
                  <p className="text-white/70 text-[10px] mt-0.5 leading-tight">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {!hasEnoughBalance && driver && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-5">
            <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold text-amber-800 text-sm">رصيد غير كافٍ</p>
              <p className="text-amber-700 text-xs mt-0.5">
                تحتاج 50 ريال كحد أدنى لتقديم عروض. رصيدك: {driver.balance.toFixed(2)} ر.س
              </p>
            </div>
          </div>
        )}

        {mySelectedJobs.length > 0 && (
          <div className="mb-5">
            <p className="text-sm font-black text-gray-600 mb-2">🎉 تم اختيارك!</p>
            <div className="space-y-3">
              {mySelectedJobs.map((req) => (
                <div key={req.id} className="rounded-2xl overflow-hidden shadow-md">
                  <div className="p-4 text-white" style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)" }}>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle size={16} className="text-white" />
                      <span className="text-white font-bold text-sm">تم اختيارك لطلب #{req.id}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-white/80 text-xs">
                      <MapPin size={11} /> {req.homeLocation} ← {req.workLocation}
                    </div>
                    <div className="flex items-center gap-1.5 text-white/80 text-xs mt-1" dir="ltr">
                      <Clock size={11} /> {formatTime12h(req.morningTime)}
                    </div>
                  </div>
                  {req.phone && (
                    <div className="bg-white px-4 py-3 flex items-center gap-3">
                      <Phone size={14} className="text-green-600" />
                      <a href={`tel:${req.phone}`} className="text-sm font-bold text-gray-800" dir="ltr">{req.phone}</a>
                      <a
                        href={`https://wa.me/${req.phone.replace(/\D/g, "").replace(/^0/, "966")}`}
                        target="_blank" rel="noopener noreferrer"
                        className="mr-auto bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1"
                      >
                        <MessageCircle size={11} /> واتساب
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "text-white shadow-md"
                  : "bg-white text-gray-500 border border-gray-200"
              }`}
              style={activeTab === tab.id ? { background: "linear-gradient(135deg, #10B981 0%, #059669 100%)" } : {}}
            >
              <span>{tab.icon}</span>
              {tab.label}
              {tab.id === "my-offers" && myOffers && myOffers.length > 0 && (
                <span className={`text-xs rounded-full px-1.5 py-0.5 font-black leading-none ${activeTab === "my-offers" ? "bg-white/25 text-white" : "bg-gray-100 text-gray-600"}`}>
                  {myOffers.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab === "available" && (
          <>
            {isLoading && <div className="text-center py-16 text-gray-400 text-sm">جاري تحميل الطلبات...</div>}

            {!isLoading && (!openRequests || openRequests.length === 0) && (
              <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl bg-white">
                <p className="text-3xl mb-2">📋</p>
                <p className="text-lg font-bold text-gray-700">لا توجد طلبات مفتوحة</p>
                <p className="text-gray-400 text-sm mt-1">تحقق لاحقاً لعروض دوام جديدة</p>
              </div>
            )}

            {openRequests && openRequests.length > 0 && (
              <div className="space-y-4">
                {openRequests.map((req) => (
                  <div key={req.id} className="rounded-2xl overflow-hidden shadow-md bg-white">
                    <div className="p-4" style={{ background: req.status === "BIDDING" ? "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)" : "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)" }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold bg-white/20 text-white px-2.5 py-1 rounded-full">
                          {getStatusLabel(req.status)}
                        </span>
                        <span className="text-white/70 text-xs">طلب #{req.id}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{(req as any).clientType === "موظفات" ? "👩‍💼" : (req as any).clientType === "طلاب" ? "🎓" : (req as any).clientType === "مدارس" ? "🏫" : "📦"}</span>
                        <div>
                          <p className="text-white font-bold">{(req as any).clientType || "طلب توصيل"}</p>
                          <p className="text-white/70 text-xs">REQ-{String(req.id).padStart(3, "0")}</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 space-y-2.5">
                      <div className="flex items-start gap-2">
                        <span className="text-blue-500 text-sm mt-0.5">📍</span>
                        <p className="text-sm text-gray-700 flex-1">{req.homeLocation} ← {req.workLocation}</p>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <span>⏰</span>
                          <span dir="ltr">{formatTime12h(req.morningTime)}</span>
                          {req.eveningTime && <span dir="ltr"> – {formatTime12h(req.eveningTime)}</span>}
                        </div>
                        <div className="flex items-center gap-1">
                          <Users size={12} />
                          <span>{req.numberOfPeople}</span>
                        </div>
                      </div>

                      <div className="flex gap-1 flex-wrap">
                        {DAYS_AR.map((d, i) => {
                          const active = i < (req.workingDaysPerWeek ?? 5);
                          return (
                            <span key={i} className={`text-xs px-2 py-0.5 rounded-full font-medium ${active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                              {d}
                            </span>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                        <div>
                          <p className="text-xs text-gray-400">عدد المنافسين</p>
                          <p className="text-lg font-black text-gray-800">{req.offerCount ?? 0}</p>
                        </div>
                        {hasEnoughBalance ? (
                          <Link href={`/driver/request/${req.id}`}>
                            <div className="px-5 py-2.5 rounded-xl text-white font-bold text-sm shadow-md active:scale-95 transition-transform"
                              style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)" }}>
                              قدّم عرضك الشهري
                            </div>
                          </Link>
                        ) : (
                          <span className="text-xs text-red-500 font-medium">رصيد غير كافٍ</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "my-offers" && (
          <div className="space-y-4">
            {offersLoading && <div className="text-center py-16 text-gray-400 text-sm">جاري تحميل عروضك...</div>}

            {!offersLoading && (!myOffers || myOffers.length === 0) && (
              <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl bg-white">
                <FileText size={32} className="mx-auto text-gray-300 mb-3" />
                <p className="text-lg font-bold text-gray-700">لم تقدّم أي عروض بعد</p>
                <p className="text-gray-400 text-sm mt-1">تصفّح الطلبات المتاحة وقدّم عرضك</p>
                <button
                  onClick={() => setActiveTab("available")}
                  className="mt-4 px-5 py-2 rounded-full text-sm font-bold border border-gray-300 text-gray-600 hover:bg-gray-50"
                >
                  عرض الطلبات المتاحة
                </button>
              </div>
            )}

            {pendingOffers.length > 0 && (
              <div>
                <p className="text-xs font-black text-gray-400 mb-2 uppercase tracking-wide">عروض قيد الانتظار</p>
                <div className="space-y-3">
                  {pendingOffers.map((offer) => (
                    <div key={offer.id} className="rounded-2xl overflow-hidden shadow-sm bg-white border border-blue-100">
                      <div className="p-3 bg-blue-50 border-b border-blue-100">
                        <p className="text-xs text-blue-600 font-bold">طلب #{offer.requestId}</p>
                      </div>
                      <div className="p-4">
                        {offer.request && (
                          <div className="space-y-1.5 mb-3">
                            <div className="flex items-center gap-1.5 text-sm text-gray-700">
                              <MapPin size={12} className="shrink-0 text-blue-500" />
                              <span className="truncate font-medium">{offer.request.homeLocation} ← {offer.request.workLocation}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-gray-500" dir="ltr">
                              <Clock size={11} className="shrink-0" />
                              <span>{formatTime12h(offer.request.morningTime)}{offer.request.eveningTime ? ` – ${formatTime12h(offer.request.eveningTime)}` : ""}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              <Users size={11} className="shrink-0" />
                              <span>{offer.request.numberOfPeople} أشخاص · {offer.request.workingDaysPerWeek} أيام</span>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          {editingOffer?.id === offer.id ? (
                            <div className="flex flex-col gap-1 flex-1">
                              <div className="flex items-center gap-2">
                                <input
                                  type="number" min="1" step="1"
                                  value={editingOffer.price}
                                  onChange={(e) => setEditingOffer({ ...editingOffer, price: e.target.value })}
                                  className="w-28 border-2 border-green-400 rounded-lg px-2 py-1 text-sm font-bold focus:outline-none"
                                  dir="ltr" autoFocus
                                />
                                <span className="text-xs text-gray-400">ر.س</span>
                                <button onClick={submitEdit} disabled={updatePrice.isPending} className="text-green-600 hover:text-green-700 disabled:opacity-50">
                                  <Check size={18} />
                                </button>
                                <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600">
                                  <X size={18} />
                                </button>
                              </div>
                              {editError && <p className="text-xs text-red-600">{editError}</p>}
                            </div>
                          ) : (
                            <p className="text-xl font-black text-green-600" dir="ltr">{offer.price.toFixed(0)} ر.س<span className="text-xs font-normal text-gray-400">/شهر</span></p>
                          )}

                          {editingOffer?.id !== offer.id && (
                            <div className="flex gap-2">
                              <button onClick={() => startEdit(offer)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50">
                                <Pencil size={11} /> تعديل
                              </button>
                              <button
                                onClick={() => handleWithdraw(offer.id)}
                                disabled={withdrawOffer.isPending}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 text-xs font-bold text-red-500 hover:bg-red-50"
                              >
                                <Trash2 size={11} /> سحب
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {closedOffers.length > 0 && (
              <div>
                <p className="text-xs font-black text-gray-400 mb-2 uppercase tracking-wide">عروض سابقة</p>
                <div className="space-y-3">
                  {closedOffers.map((offer) => (
                    <div key={offer.id} className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 opacity-80">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-xs text-gray-400">طلب #{offer.requestId}</p>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              offer.request?.status === "SELECTED" ? "bg-green-100 text-green-700" :
                              offer.request?.status === "ACTIVE" ? "bg-blue-100 text-blue-700" :
                              "bg-gray-100 text-gray-500"
                            }`}>
                              {offer.request?.status === "SELECTED" ? "تم الاختيار" :
                               offer.request?.status === "ACTIVE" ? "نشط" :
                               offer.request?.status === "COMPLETED" ? "مكتمل" : offer.request?.status}
                            </span>
                          </div>
                          {offer.request && (
                            <p className="text-sm text-gray-600 truncate">{offer.request.homeLocation} ← {offer.request.workLocation}</p>
                          )}
                          <p className="text-sm font-bold text-gray-800 mt-1" dir="ltr">{offer.price.toFixed(0)} ر.س/شهر</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "earnings" && (
          <div className="space-y-4">
            <div className="rounded-2xl p-5 shadow-md" style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)" }}>
              <p className="text-white/70 text-xs mb-1">إجمالي الدخل المتوقع</p>
              <p className="text-white text-4xl font-black" dir="ltr">{totalEarnings.toFixed(0)} <span className="text-xl">ريال</span></p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {[
                { label: "اشتراكات نشطة", value: mySelectedJobs.length },
                { label: "عروض قيد الانتظار", value: pendingOffers.length },
                { label: "عروض سابقة", value: closedOffers.length },
                { label: "إجمالي العروض", value: myOffers?.length ?? 0 },
              ].map((item, i) => (
                <div key={item.label} className={`flex items-center justify-between px-4 py-3 ${i > 0 ? "border-t border-gray-100" : ""}`}>
                  <p className="text-sm text-gray-700">{item.label}</p>
                  <p className="text-lg font-black text-gray-900">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
