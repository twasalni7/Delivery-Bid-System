import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListDrivers,
  useAddDriverBalance,
  getListDriversQueryKey,
  getGetDriverQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Banknote, PlusCircle } from "lucide-react";

export default function AdminDrivers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: drivers, isLoading } = useListDrivers();
  const addBalance = useAddDriverBalance();

  const [selectedDriver, setSelectedDriver] = useState<{ id: number; name: string } | null>(null);
  const [amount, setAmount] = useState("");

  const handleAddBalance = () => {
    if (!selectedDriver || !amount) return;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast({ title: "مبلغ غير صحيح", variant: "destructive" });
      return;
    }

    addBalance.mutate(
      { id: selectedDriver.id, data: { amount: numAmount } },
      {
        onSuccess: (driver) => {
          queryClient.invalidateQueries({ queryKey: getListDriversQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDriverQueryKey(selectedDriver.id) });
          toast({ title: "تم شحن الرصيد!", description: `رصيد ${selectedDriver.name} الآن: ${driver.balance.toFixed(2)} ر.س` });
          setSelectedDriver(null);
          setAmount("");
        },
        onError: () => {
          toast({ title: "فشل شحن الرصيد", variant: "destructive" });
        },
      }
    );
  };

  return (
    <Layout role="admin">
      <div className="mb-8">
        <h1 className="text-3xl font-black">السائقون</h1>
        <p className="text-muted-foreground text-sm mt-1">إدارة حسابات السائقين وأرصدتهم</p>
      </div>

      {isLoading && (
        <div className="text-center py-16 text-muted-foreground">جاري تحميل السائقين...</div>
      )}

      {!isLoading && (!drivers || drivers.length === 0) && (
        <div className="text-center py-20 border-2 border-dashed rounded-sm">
          <p className="font-bold">لا يوجد سائقون مسجّلون</p>
          <p className="text-muted-foreground text-sm mt-1">يسجّل السائقون عبر بوابة السائق بإدخال أسمائهم</p>
        </div>
      )}

      {drivers && drivers.length > 0 && (
        <div className="border rounded-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-bold text-xs">رقم</TableHead>
                <TableHead className="font-bold text-xs">الاسم</TableHead>
                <TableHead className="font-bold text-xs">الرصيد</TableHead>
                <TableHead className="font-bold text-xs">نوع السيارة</TableHead>
                <TableHead className="font-bold text-xs">الجنسية</TableHead>
                <TableHead className="font-bold text-xs">إجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drivers.map((driver) => (
                <TableRow key={driver.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="text-xs text-muted-foreground">#{driver.id}</TableCell>
                  <TableCell className="font-bold">{driver.name}</TableCell>
                  <TableCell>
                    <span className={`font-bold ${driver.balance >= 50 ? "text-green-700" : "text-red-600"}`} dir="ltr">
                      {driver.balance.toFixed(2)} ر.س
                    </span>
                    {driver.balance < 50 && (
                      <span className="mr-2 text-xs text-red-500">(أقل من الحد)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{driver.carType ?? "—"}</TableCell>
                  <TableCell className="text-sm">{driver.nationality ?? "—"}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      className="font-bold text-xs border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                      onClick={() => {
                        setSelectedDriver({ id: driver.id, name: driver.name });
                        setAmount("");
                      }}
                    >
                      <PlusCircle size={12} className="ml-1" /> شحن رصيد
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!selectedDriver} onOpenChange={(open) => { if (!open) setSelectedDriver(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-black">شحن الرصيد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              إضافة رصيد إلى حساب <strong className="text-foreground">{selectedDriver?.name}</strong>
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="amount" className="font-bold text-xs">المبلغ (ر.س)</Label>
              <div className="relative">
                <Banknote size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="amount"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="100"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pr-8"
                  dir="ltr"
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddBalance(); }}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedDriver(null)}>إلغاء</Button>
            <Button
              onClick={handleAddBalance}
              disabled={addBalance.isPending}
              className="font-bold"
            >
              {addBalance.isPending ? "جاري الشحن..." : "شحن الرصيد"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
