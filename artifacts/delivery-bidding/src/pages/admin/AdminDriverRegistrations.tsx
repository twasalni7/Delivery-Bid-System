import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, User, Phone, MapPin, Car, Calendar, CreditCard, Hash, Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

interface DriverRegistrationRequest {
  id: number;
  name: string;
  mobile: string;
  city: string;
  carType: string;
  carYear: string;
  nationality: string;
  nationalId: string;
  age: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  approvedBy?: number;
  approvedAt?: string;
  rejectionReason?: string;
  createdDriverId?: number;
  createdAt: string;
}

interface ApprovalResponse {
  message: string;
  driver: {
    id: number;
    name: string;
    mobile: string;
    loginCode: string;
    temporaryPassword: string;
  };
}

export default function AdminDriverRegistrations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<DriverRegistrationRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [approvalResult, setApprovalResult] = useState<ApprovalResponse | null>(null);

  const { data: requests, isLoading } = useQuery<DriverRegistrationRequest[]>({
    queryKey: ["/api/admin/driver-registration"],
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/driver-registration/${id}/approve`, {
        method: "PATCH",
        credentials: "include",
      });

      if (!res.ok) {
        let errorMessage = "فشل قبول الطلب";
        try {
          const error = await res.json();
          errorMessage = error.error || errorMessage;
        } catch {
          // Response body is empty or not JSON
        }
        throw new Error(errorMessage);
      }

      return res.json() as Promise<ApprovalResponse>;
    },
    onSuccess: (data) => {
      setApprovalResult(data);
      setShowApproveDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/driver-registration"] });
      toast({
        title: "تم قبول الطلب",
        description: "تم إنشاء حساب السائق بنجاح",
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

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const res = await fetch(`/api/admin/driver-registration/${id}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rejectionReason: reason }),
      });

      if (!res.ok) {
        let errorMessage = "فشل رفض الطلب";
        try {
          const error = await res.json();
          errorMessage = error.error || errorMessage;
        } catch {
          // Response body is empty or not JSON
        }
        throw new Error(errorMessage);
      }

      return res.json();
    },
    onSuccess: () => {
      setShowRejectDialog(false);
      setRejectionReason("");
      setSelectedRequest(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/driver-registration"] });
      toast({
        title: "تم رفض الطلب",
        description: "تم رفض طلب التسجيل",
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

  const handleApprove = (request: DriverRegistrationRequest) => {
    setSelectedRequest(request);
    setShowApproveDialog(true);
  };

  const handleReject = (request: DriverRegistrationRequest) => {
    setSelectedRequest(request);
    setShowRejectDialog(true);
  };

  const confirmApprove = () => {
    if (selectedRequest) {
      approveMutation.mutate(selectedRequest.id);
    }
  };

  const confirmReject = () => {
    if (selectedRequest && rejectionReason.trim()) {
      rejectMutation.mutate({ id: selectedRequest.id, reason: rejectionReason });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "تم النسخ",
      description: "تم نسخ النص إلى الحافظة",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">معلق</Badge>;
      case "APPROVED":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">مقبول</Badge>;
      case "REJECTED":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">مرفوض</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingRequests = requests?.filter(r => r.status === "PENDING") || [];
  const processedRequests = requests?.filter(r => r.status !== "PENDING") || [];

  return (
    <div className="container mx-auto p-6 max-w-7xl" dir="rtl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">طلبات تسجيل السائقين</h1>
        <p className="text-gray-600">
          إدارة طلبات انضمام السائقين الجدد
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Pending Requests */}
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm">
                {pendingRequests.length}
              </span>
              طلبات معلقة
            </h2>
            {pendingRequests.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  لا توجد طلبات معلقة
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pendingRequests.map((request) => (
                  <Card key={request.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg">{request.name}</CardTitle>
                        {getStatusBadge(request.status)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Phone size={14} />
                          <span>{request.mobile}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <MapPin size={14} />
                          <span>{request.city}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Car size={14} />
                          <span>{request.carType} ({request.carYear})</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <User size={14} />
                          <span>{request.nationality}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <CreditCard size={14} />
                          <span>{request.nationalId}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Hash size={14} />
                          <span>{request.age} سنة</span>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-3 border-t">
                        <Button
                          size="sm"
                          className="flex-1 bg-green-600 hover:bg-green-700"
                          onClick={() => handleApprove(request)}
                          disabled={approveMutation.isPending || rejectMutation.isPending}
                        >
                          <CheckCircle size={14} className="ml-1" />
                          قبول
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex-1"
                          onClick={() => handleReject(request)}
                          disabled={approveMutation.isPending || rejectMutation.isPending}
                        >
                          <XCircle size={14} className="ml-1" />
                          رفض
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Processed Requests */}
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm">
                {processedRequests.length}
              </span>
              الطلبات المعالجة
            </h2>
            {processedRequests.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  لا توجد طلبات معالجة
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {processedRequests.map((request) => (
                  <Card key={request.id}>
                    <CardContent className="py-4">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div>
                            <div className="font-semibold">{request.name}</div>
                            <div className="text-sm text-gray-600">{request.mobile}</div>
                          </div>
                          {getStatusBadge(request.status)}
                        </div>
                        <div className="text-sm text-gray-500">
                          <div>{new Date(request.createdAt).toLocaleDateString("ar-SA")}</div>
                          {request.rejectionReason && (
                            <div className="text-red-600 mt-1">
                              السبب: {request.rejectionReason}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Approve Confirmation Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تأكيد قبول الطلب</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من قبول طلب التسجيل لـ {selectedRequest?.name}؟
              <br />
              سيتم إنشاء حساب جديد وإصدار بيانات الدخول.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowApproveDialog(false)}
              disabled={approveMutation.isPending}
            >
              إلغاء
            </Button>
            <Button
              onClick={confirmApprove}
              disabled={approveMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {approveMutation.isPending ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري القبول...
                </>
              ) : (
                "تأكيد القبول"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>رفض طلب التسجيل</DialogTitle>
            <DialogDescription>
              الرجاء إدخال سبب رفض طلب التسجيل لـ {selectedRequest?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">سبب الرفض</Label>
              <Textarea
                id="rejection-reason"
                placeholder="اذكر سبب رفض الطلب..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectDialog(false);
                setRejectionReason("");
              }}
              disabled={rejectMutation.isPending}
            >
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={rejectMutation.isPending || !rejectionReason.trim()}
            >
              {rejectMutation.isPending ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري الرفض...
                </>
              ) : (
                "تأكيد الرفض"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval Result Dialog */}
      <Dialog open={!!approvalResult} onOpenChange={() => setApprovalResult(null)}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle size={24} />
              تم إنشاء الحساب بنجاح
            </DialogTitle>
            <DialogDescription>
              تم قبول الطلب وإنشاء حساب السائق. الرجاء نسخ بيانات الدخول وإرسالها للسائق.
            </DialogDescription>
          </DialogHeader>
          {approvalResult && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>اسم السائق</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 p-2 bg-gray-100 rounded text-sm font-mono">
                    {approvalResult.driver.name}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>رقم الجوال</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 p-2 bg-gray-100 rounded text-sm font-mono">
                    {approvalResult.driver.mobile}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(approvalResult.driver.mobile)}
                  >
                    <Copy size={14} />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>كود الدخول</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 p-2 bg-blue-50 rounded text-sm font-mono font-bold text-blue-700">
                    {approvalResult.driver.loginCode}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(approvalResult.driver.loginCode)}
                  >
                    <Copy size={14} />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>كلمة المرور المؤقتة</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 p-2 bg-amber-50 rounded text-sm font-mono font-bold text-amber-700">
                    {approvalResult.driver.temporaryPassword}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(approvalResult.driver.temporaryPassword)}
                  >
                    <Copy size={14} />
                  </Button>
                </div>
              </div>

              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                ⚠️ سيُطلب من السائق تغيير كلمة المرور عند تسجيل الدخول لأول مرة
              </div>

              <Button
                className="w-full"
                onClick={() => {
                  const text = `بيانات تسجيل الدخول:\nرقم الجوال: ${approvalResult.driver.mobile}\nكود الدخول: ${approvalResult.driver.loginCode}\nكلمة المرور المؤقتة: ${approvalResult.driver.temporaryPassword}`;
                  copyToClipboard(text);
                }}
              >
                <Copy size={16} className="ml-2" />
                نسخ جميع البيانات
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setApprovalResult(null)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
