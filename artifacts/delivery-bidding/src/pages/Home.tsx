import { Link } from "wouter";
import { Navigation, Route, CreditCard, ShieldCheck, CheckCircle2 } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen p-5 md:p-8" dir="rtl" style={{ fontFamily: "var(--font-arabic)", backgroundColor: "var(--bg-page)" }}>
      <div className="max-w-5xl mx-auto space-y-6">
        <section className="rounded-3xl p-6 md:p-8" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-md)" }}>
          <div className="flex items-center gap-4 mb-4">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl" style={{ background: "linear-gradient(135deg, var(--brand-hover) 0%, var(--brand) 100%)" }}>
              <Navigation size={26} strokeWidth={2.7} style={{ color: "var(--brand-fg)" }} />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight" style={{ color: "var(--brand)" }}>توصّلني</h1>
              <p className="font-bold text-sm" style={{ color: "var(--text-muted)" }}>منصة إدارة اشتراكات النقل الشهري بثقة ووضوح</p>
            </div>
          </div>
          <p className="text-base leading-7 font-semibold" style={{ color: "var(--text-sub)" }}>
            ننظم رحلة العميل من إنشاء الطلب حتى الإغلاق والفوترة الشهرية، مع متابعة واضحة للحالة وسجل محفوظ لكل طلب.
          </p>
        </section>

        <section className="grid md:grid-cols-2 gap-4">
          <div className="rounded-3xl p-5" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 mb-3"><Route size={18} style={{ color: "var(--brand)" }} /><h2 className="text-lg font-black">رحلة الطلب</h2></div>
            <div className="space-y-2 text-sm font-bold" style={{ color: "var(--text-sub)" }}>
              {["1) إنشاء الطلب", "2) استقبال عروض السائقين", "3) اختيار السائق وتثبيت المسار", "4) تنفيذ المشاوير اليومية", "5) الإغلاق والمتابعة الشهرية"].map((step) => (
                <div key={step} className="flex items-center gap-2"><CheckCircle2 size={14} style={{ color: "var(--status-active-text)" }} />{step}</div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl p-5" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="space-y-4">
              <div className="flex items-center gap-2"><CreditCard size={18} style={{ color: "var(--brand)" }} /><h2 className="text-lg font-black">نظام الدفع</h2></div>
              <p className="text-sm font-bold leading-7" style={{ color: "var(--text-sub)" }}>الدفع يكون بنظام شهري مجمّع في نهاية كل شهر، مع وضوح كامل لحالة الطلب وقيمته.</p>
              <div className="flex items-center gap-2"><ShieldCheck size={18} style={{ color: "var(--status-active-text)" }} /><h2 className="text-lg font-black">الثقة والاطمئنان</h2></div>
              <p className="text-sm font-bold leading-7" style={{ color: "var(--text-sub)" }}>كل خطوة موثقة داخل النظام: الحالة، الأرشفة، وسجل الطلب، لضمان تجربة مستقرة ومفهومة للعميل.</p>
            </div>
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-3">
          <Link href="/client/login"><div className="rounded-2xl p-4 cursor-pointer text-center font-black" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--brand-border)", color: "var(--text)" }}>دخول العميل</div></Link>
          <Link href="/driver/login"><div className="rounded-2xl p-4 cursor-pointer text-center font-black" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--status-active-border)", color: "var(--text)" }}>دخول السائق</div></Link>
          <Link href="/admin/login"><div className="rounded-2xl p-4 cursor-pointer text-center font-black" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>دخول الإدارة</div></Link>
        </section>
      </div>
    </div>
  );
}
