import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BellRing, Filter, Send, Users } from "lucide-react";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AdminPageTabs } from "@/components/admin-page-tabs";
import { useToast } from "@/hooks/use-toast";
import { API_ORIGIN as API } from "@/lib/api-config";
import { getAuthHeaders } from "@/lib/authed-fetch";

type RoleOption = { value: "client" | "driver" | "admin"; label: string; count: number };
type FieldOption = {
  key: string;
  label: string;
  type: "string" | "number" | "date" | "enum";
  operators: string[];
  options?: string[];
};
type TargetUser = { id: number; role: "client" | "driver" | "admin"; name: string; subtitle: string | null };
type MetadataResponse = {
  roles: RoleOption[];
  fieldsByRole: Record<string, FieldOption[]>;
  users: TargetUser[];
};
type AnalyticsResponse = {
  total: number;
  delivered: number;
  failed: number;
  clicked: number;
  deliveryRate: string;
  clickRate: string;
};
type FilterRow = { id: string; field: string; operator: string; value: string };
type SendResponse = {
  message: string;
  recipientCount: number;
  recipientsByRole: Record<string, number>;
  sampleRecipients: TargetUser[];
};

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "تعذر تنفيذ الطلب");
  return body as T;
}

export default function AdminNotificationComposer() {
  const { toast } = useToast();
  const [mode, setMode] = useState<"all" | "roles" | "user" | "filters">("all");
  const [selectedRoles, setSelectedRoles] = useState<Array<"client" | "driver" | "admin">>(["client", "driver", "admin"]);
  const [selectedUserRole, setSelectedUserRole] = useState<"client" | "driver" | "admin">("client");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [searchUser, setSearchUser] = useState("");
  const [filterRole, setFilterRole] = useState<"client" | "driver" | "admin">("driver");
  const [filters, setFilters] = useState<FilterRow[]>([{ id: crypto.randomUUID(), field: "", operator: "eq", value: "" }]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [url, setUrl] = useState("");
  const [actionType, setActionType] = useState<"open_url" | "emit_event">("open_url");
  const [actionLabel, setActionLabel] = useState("");
  const [eventName, setEventName] = useState("");
  const [payloadJson, setPayloadJson] = useState("");
  const [lastResult, setLastResult] = useState<SendResponse | null>(null);

  const { data: metadata } = useQuery<MetadataResponse>({
    queryKey: ["push-targeting-metadata"],
    queryFn: () => apiFetch<MetadataResponse>("/api/push/targeting-metadata"),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes - rarely changes
  });

  const { data: analytics } = useQuery<AnalyticsResponse>({
    queryKey: ["push-analytics"],
    queryFn: () => apiFetch<AnalyticsResponse>("/api/push/analytics"),
    refetchInterval: 30_000,
    staleTime: 20_000, // Cache for 20 seconds
  });

  const availableFields = metadata?.fieldsByRole[filterRole] ?? [];
  const availableUsers = useMemo(() => {
    return (metadata?.users ?? []).filter((user) => {
      if (mode === "user" && user.role !== selectedUserRole) return false;
      if (!searchUser.trim()) return true;
      const haystack = `${user.name} ${user.subtitle ?? ""} ${user.id}`.toLowerCase();
      return haystack.includes(searchUser.trim().toLowerCase());
    });
  }, [metadata?.users, mode, searchUser, selectedUserRole]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      let actionPayload: Record<string, unknown> | undefined;
      if (actionType === "emit_event") {
        let parsedPayload: unknown = {};
        try {
          parsedPayload = payloadJson.trim() ? JSON.parse(payloadJson) : {};
        } catch (err) {
          throw new Error("صيغة JSON غير صحيحة في بيانات الحدث");
        }
        actionPayload = {
          ...(typeof parsedPayload === "object" && parsedPayload ? parsedPayload as Record<string, unknown> : {}),
          eventName,
        };
      }

      const audience =
        mode === "all"
          ? { mode: "all" as const }
          : mode === "roles"
            ? { mode: "roles" as const, roles: selectedRoles }
            : mode === "user"
              ? {
                  mode: "user" as const,
                  userId: Number(selectedUserId),
                  userRole: selectedUserRole,
                }
              : {
                  mode: "filters" as const,
                  segments: [
                    {
                      role: filterRole,
                      filters: filters.map((filter) => ({
                        field: filter.field,
                        operator: filter.operator,
                        value: filter.value.includes(",")
                          ? filter.value.split(",").map((item) => item.trim()).filter(Boolean)
                          : filter.value,
                      })),
                    },
                  ],
                };

      return apiFetch<SendResponse>("/api/push/send", {
        method: "POST",
        body: JSON.stringify({
          title,
          message,
          type: "system",
          url: url || undefined,
          actionType,
          actionLabel: actionLabel || undefined,
          actionPayload,
          audience,
        }),
      });
    },
    onSuccess: (result) => {
      setLastResult(result);
      toast({ title: `تم إرسال الإشعار إلى ${result.recipientCount} مستخدم` });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  function toggleRole(role: "client" | "driver" | "admin") {
    setSelectedRoles((current) =>
      current.includes(role) ? current.filter((item) => item !== role) : [...current, role]
    );
  }

  function updateFilter(index: number, patch: Partial<FilterRow>) {
    setFilters((current) => current.map((filter, idx) => (idx === index ? { ...filter, ...patch } : filter)));
  }

  return (
    <Layout role="admin">
      <div dir="rtl" className="max-w-5xl mx-auto space-y-6">
        <AdminPageTabs
          tabs={[
            { href: "/admin/notifications", label: "إرسال الإشعارات" },
            { href: "/admin/notifications-monitor", label: "مراقبة الإشعارات" },
            { href: "/admin/push-debug", label: "تشخيص Push" },
          ]}
        />
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-black" style={{ color: "var(--text)" }}>إرسال الإشعارات</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              إرسال إشعارات داخل التطبيق وخارجه مع الاستهداف والتفاعل
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "إجمالي الإشعارات", value: analytics?.total ?? 0 },
              { label: "معدل الوصول", value: analytics?.deliveryRate ?? "0%" },
              { label: "النقرات", value: analytics?.clicked ?? 0 },
              { label: "معدل التفاعل", value: analytics?.clickRate ?? "0%" },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl px-4 py-3 text-center" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                <p className="font-black text-lg" style={{ color: "var(--brand)" }}>{item.value}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
          <div className="rounded-3xl p-5 space-y-5" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="space-y-2">
              <Label style={{ color: "var(--text-muted)" }}>عنوان الإشعار</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: تحديث مهم" style={{ color: "var(--text)" }} />
            </div>
            <div className="space-y-2">
              <Label style={{ color: "var(--text-muted)" }}>رسالة الإشعار</Label>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="اكتب نص الإشعار هنا..." style={{ color: "var(--text)" }} />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label style={{ color: "var(--text-muted)" }}>الرابط داخل التطبيق</Label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/admin/support?ticket=12" dir="ltr" style={{ color: "var(--text)" }} />
              </div>
              <div className="space-y-2">
                <Label style={{ color: "var(--text-muted)" }}>عنوان الإجراء</Label>
                <Input value={actionLabel} onChange={(e) => setActionLabel(e.target.value)} placeholder="فتح التفاصيل" style={{ color: "var(--text)" }} />
              </div>
            </div>

            <div className="rounded-2xl p-4 space-y-4" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 font-bold" style={{ color: "var(--text)" }}>
                <BellRing size={16} />
                نوع التفاعل
              </div>
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: "open_url" as const, label: "فتح صفحة" },
                  { value: "emit_event" as const, label: "تنفيذ حدث" },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setActionType(option.value)}
                    className="px-4 py-2 rounded-full text-sm font-bold"
                    style={actionType === option.value ? { backgroundColor: "var(--brand)", color: "var(--brand-fg)" } : { backgroundColor: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {actionType === "emit_event" && (
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label style={{ color: "var(--text-muted)" }}>اسم الحدث</Label>
                    <Input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="notification:refresh" dir="ltr" style={{ color: "var(--text)" }} />
                  </div>
                  <div className="space-y-2">
                    <Label style={{ color: "var(--text-muted)" }}>بيانات الحدث (JSON اختياري، حد أقصى 10KB)</Label>
                    <Textarea
                      value={payloadJson}
                      onChange={(e) => {
                        const text = e.target.value;
                        // Check size limit (10KB)
                        const sizeInBytes = new Blob([text]).size;
                        if (sizeInBytes > 10240) {
                          toast({ title: "حجم البيانات كبير جداً (الحد الأقصى 10KB)", variant: "destructive" });
                          return;
                        }
                        setPayloadJson(text);
                      }}
                      placeholder='{"requestId": 12}'
                      dir="ltr"
                      style={{ color: "var(--text)" }}
                    />
                    <p className="text-xs" style={{ color: "var(--text-hint)" }}>
                      الحجم: {(new Blob([payloadJson]).size / 1024).toFixed(2)} KB / 10 KB
                    </p>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending || !title.trim() || !message.trim()}
              className="w-full py-3 rounded-2xl font-black text-base disabled:opacity-60"
              style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}
            >
              <Send size={16} className="inline ml-2" />
              {sendMutation.isPending ? "جاري الإرسال..." : "إرسال الإشعار الآن"}
            </button>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl p-5 space-y-4" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 font-bold" style={{ color: "var(--text)" }}>
                <Users size={16} />
                الاستهداف
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "all" as const, label: "جميع المستخدمين" },
                  { value: "roles" as const, label: "حسب الدور" },
                  { value: "user" as const, label: "مستخدم محدد" },
                  { value: "filters" as const, label: "مجموعة مخصصة" },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setMode(option.value)}
                    className="px-3 py-2 rounded-xl text-sm font-bold"
                    style={mode === option.value ? { backgroundColor: "var(--brand-subtle)", color: "var(--brand)", border: "1px solid var(--brand-border)" } : { backgroundColor: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {mode === "roles" && (
                <div className="space-y-2">
                  {(metadata?.roles ?? []).map((role) => (
                    <button
                      key={role.value}
                      onClick={() => toggleRole(role.value)}
                      className="w-full px-3 py-2 rounded-xl text-sm font-bold flex items-center justify-between"
                      style={selectedRoles.includes(role.value) ? { backgroundColor: "var(--brand-subtle)", color: "var(--brand)", border: "1px solid var(--brand-border)" } : { backgroundColor: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                    >
                      <span>{role.label}</span>
                      <span>{role.count}</span>
                    </button>
                  ))}
                </div>
              )}

              {mode === "user" && (
                <div className="space-y-3">
                  <select value={selectedUserRole} onChange={(e) => setSelectedUserRole(e.target.value as "client" | "driver" | "admin")} className="w-full px-3 py-2 rounded-xl" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}>
                    {(metadata?.roles ?? []).map((role) => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                  <Input value={searchUser} onChange={(e) => setSearchUser(e.target.value)} placeholder="ابحث بالاسم أو الرقم..." style={{ color: "var(--text)" }} />
                  <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="w-full px-3 py-2 rounded-xl" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}>
                    <option value="">اختر مستخدمًا</option>
                    {availableUsers.map((user) => (
                      <option key={`${user.role}-${user.id}`} value={user.id}>
                        {user.name} #{user.id} {user.subtitle ? `- ${user.subtitle}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {mode === "filters" && (
                <div className="space-y-3">
                  <select value={filterRole} onChange={(e) => { setFilterRole(e.target.value as "client" | "driver" | "admin"); setFilters([{ id: crypto.randomUUID(), field: "", operator: "eq", value: "" }]); }} className="w-full px-3 py-2 rounded-xl" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}>
                    {(metadata?.roles ?? []).map((role) => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                  {filters.map((filter, index) => {
                    const fieldOptions = availableFields;
                    const selectedField = fieldOptions.find((field) => field.key === filter.field);
                    return (
                      <div key={filter.id} className="rounded-2xl p-3 space-y-2" style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm font-bold" style={{ color: "var(--text)" }}>
                            <Filter size={14} />
                            فلتر #{index + 1}
                          </div>
                          {filters.length > 1 && (
                            <button onClick={() => setFilters((current) => current.filter((_, idx) => idx !== index))} className="text-xs font-bold" style={{ color: "var(--status-cancelled-text)" }}>
                              حذف
                            </button>
                          )}
                        </div>
                        <select value={filter.field} onChange={(e) => updateFilter(index, { field: e.target.value, operator: "eq", value: "" })} className="w-full px-3 py-2 rounded-xl" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>
                          <option value="">اختر الحقل</option>
                          {fieldOptions.map((field) => (
                            <option key={field.key} value={field.key}>{field.label}</option>
                          ))}
                        </select>
                        <select value={filter.operator} onChange={(e) => updateFilter(index, { operator: e.target.value })} className="w-full px-3 py-2 rounded-xl" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>
                          {(selectedField?.operators ?? ["eq"]).map((operator) => (
                            <option key={operator} value={operator}>{operator}</option>
                          ))}
                        </select>
                        {selectedField?.options?.length ? (
                          <select value={filter.value} onChange={(e) => updateFilter(index, { value: e.target.value })} className="w-full px-3 py-2 rounded-xl" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>
                            <option value="">اختر القيمة</option>
                            {selectedField.options.map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        ) : (
                          <Input value={filter.value} onChange={(e) => updateFilter(index, { value: e.target.value })} placeholder="القيمة (استخدم فاصلة للقيم المتعددة)" style={{ color: "var(--text)" }} />
                        )}
                      </div>
                    );
                  })}
                  <button onClick={() => setFilters((current) => [...current, { id: crypto.randomUUID(), field: "", operator: "eq", value: "" }])} className="w-full py-2 rounded-xl text-sm font-bold" style={{ backgroundColor: "var(--surface-2)", color: "var(--brand)", border: "1px dashed var(--brand-border)" }}>
                    إضافة فلتر
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-3xl p-5 space-y-3" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
              <h2 className="font-black" style={{ color: "var(--text)" }}>آخر نتيجة إرسال</h2>
              {!lastResult ? (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>لم يتم إرسال إشعار بعد.</p>
              ) : (
                <>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    تم استهداف <strong style={{ color: "var(--text)" }}>{lastResult.recipientCount}</strong> مستخدم.
                  </p>
                  <div className="space-y-2">
                    {Object.entries(lastResult.recipientsByRole).map(([role, count]) => (
                      <div key={role} className="flex items-center justify-between text-sm" style={{ color: "var(--text-muted)" }}>
                        <span>{role}</span>
                        <strong style={{ color: "var(--text)" }}>{count}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {lastResult.sampleRecipients.map((user) => (
                      <div key={`${user.role}-${user.id}`} className="rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: "var(--surface-2)", color: "var(--text-muted)" }}>
                        <strong style={{ color: "var(--text)" }}>{user.name}</strong> #{user.id}
                        {user.subtitle ? ` — ${user.subtitle}` : ""}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
