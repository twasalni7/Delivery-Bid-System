import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { EnablePushButton } from "@/components/enable-push-button";
import { Bell, MessageCircle, ShieldCheck, Wallet, CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";

const STORAGE_KEY = "client_onboarding_done";

type Slide = {
  title: string;
  subtitle: string;
  bullets: string[];
  icon: React.ComponentType<{ size?: number }>;
  accent?: "brand" | "safe" | "chat";
  footer?: React.ReactNode;
};

function getAccentStyle(accent: Slide["accent"]) {
  if (accent === "safe") {
    return {
      chipBg: "rgba(0,230,118,0.12)",
      chipBorder: "var(--brand-border)",
      chipText: "var(--brand)",
    };
  }
  if (accent === "chat") {
    return {
      chipBg: "rgba(176,190,197,0.10)",
      chipBorder: "var(--border-subtle)",
      chipText: "var(--text-sub)",
    };
  }
  return {
    chipBg: "var(--brand-subtle)",
    chipBorder: "var(--brand-border)",
    chipText: "var(--brand)",
  };
}

export default function ClientOnboarding() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(0);

  const slides: Slide[] = useMemo(() => ([
    {
      title: "مرحباً بك في توصّلني",
      subtitle: "اشتراك توصيل شهري واضح… بدون تعقيد",
      bullets: [
        "أنشئ طلبك خلال دقائق",
        "السعر يُحسب تلقائياً قبل الإرسال",
        "اختر السائق الأنسب لك",
      ],
      icon: CheckCircle2,
      accent: "brand",
    },
    {
      title: "لا يوجد دفع مقدم",
      subtitle: "اطلب الآن وادفع لاحقاً — بكل شفافية",
      bullets: [
        "الدفع آخر الشهر للسائق مباشرة",
        "أسعار واضحة ونهائية قبل نشر الطلب",
        "لا توجد رسوم خفية أو مفاجآت",
      ],
      icon: Wallet,
      accent: "safe",
    },
    {
      title: "سائقون موثوقون",
      subtitle: "نساعدك تختار بثقة ووضوح",
      bullets: [
        "يعرض التطبيق معلومات السائق والعروض المتاحة",
        "يمكنك تأكيد سائق واحد وإغلاق الطلب",
        "تجربة مناسبة للمبتدئين",
      ],
      icon: ShieldCheck,
      accent: "safe",
    },
    {
      title: "محادثة داخل التطبيق",
      subtitle: "تواصل مباشر… بدون مشاركة بياناتك",
      bullets: [
        "مراسلة داخل التطبيق بعد اختيار السائق",
        "بيانات العميل محمية",
        "تحديثات فورية لحالة الطلب",
      ],
      icon: MessageCircle,
      accent: "chat",
    },
    {
      title: "فعّل الإشعارات",
      subtitle: "لتصلك تنبيهات عند وصول عروض جديدة",
      bullets: [
        "تلقى إشعار فور وصول سائق جديد",
        "لا تفوّت أي تحديث على طلبك",
      ],
      icon: Bell,
      accent: "brand",
      footer: (
        <div className="rounded-3xl p-4" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}>
          <EnablePushButton />
        </div>
      ),
    },
  ]), []);

  const current = slides[step]!;
  const Icon = current.icon;
  const accent = getAccentStyle(current.accent);

  const markDone = () => {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
  };

  const goNext = () => setStep((s) => Math.min(slides.length - 1, s + 1));
  const goPrev = () => setStep((s) => Math.max(0, s - 1));

  return (
    <Layout role="client">
      <div dir="rtl" className="space-y-5">
        <div className="flex items-center justify-between">
          <Link href="/client" className="inline-flex items-center gap-1.5 text-sm font-bold transition-colors px-3 py-2 rounded-xl" style={{ color: "var(--text-muted)", backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
            <ArrowRight size={15} /> الرجوع
          </Link>
          <button
            onClick={() => { markDone(); setLocation("/client"); }}
            className="text-sm font-black px-4 py-2 rounded-xl"
            style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--text-hint)" }}
          >
            تخطي
          </button>
        </div>

        <div className="rounded-[2rem] overflow-hidden" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-xl)" }}>
          <div className="p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-3xl flex items-center justify-center shrink-0" style={{ backgroundColor: accent.chipBg, border: `1px solid ${accent.chipBorder}`, color: accent.chipText }}>
                <Icon size={26} />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-black leading-tight" style={{ color: "var(--text)" }}>{current.title}</h1>
                <p className="text-sm font-bold mt-1" style={{ color: "var(--text-muted)" }}>{current.subtitle}</p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3">
              {current.bullets.map((b) => (
                <div key={b} className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}>
                  <p className="text-sm font-black" style={{ color: "var(--text-sub)" }}>{b}</p>
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black" style={{ backgroundColor: accent.chipBg, border: `1px solid ${accent.chipBorder}`, color: accent.chipText }}>
                    ✓
                  </span>
                </div>
              ))}
            </div>

            {current.footer && <div className="mt-6">{current.footer}</div>}
          </div>

          <div className="px-6 sm:px-8 pb-6">
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={goPrev}
                disabled={step === 0}
                className="px-5 py-4 rounded-[1.5rem] font-black transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border-subtle)", color: "var(--text-sub)" }}
              >
                <ArrowLeft size={18} /> السابق
              </button>

              <div className="flex items-center gap-2">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setStep(i)}
                    aria-label={`الانتقال للشاشة ${i + 1}`}
                    className="w-2.5 h-2.5 rounded-full transition-all"
                    style={i === step ? { backgroundColor: "var(--brand)", boxShadow: "0 0 0 4px var(--brand-subtle)" } : { backgroundColor: "rgba(176,190,197,0.28)" }}
                  />
                ))}
              </div>

              <button
                onClick={() => {
                  if (step === slides.length - 1) {
                    markDone();
                    setLocation("/client");
                    return;
                  }
                  goNext();
                }}
                className="px-6 py-4 rounded-[1.5rem] font-black transition-transform active:scale-95 inline-flex items-center gap-2"
                style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)", boxShadow: "var(--brand-shadow)" }}
              >
                {step === slides.length - 1 ? "ابدأ الآن" : "التالي"}
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl p-4" style={{ backgroundColor: "rgba(0,230,118,0.10)", border: "1px solid var(--brand-border)" }}>
          <p className="text-xs font-black" style={{ color: "var(--text-sub)" }}>
            تذكير: لا يوجد دفع مقدم — الدفع آخر الشهر للسائق مباشرة — بيانات العميل محمية.
          </p>
        </div>
      </div>
    </Layout>
  );
}
