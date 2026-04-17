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
import { DollarSign, PlusCircle } from "lucide-react";

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
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }

    addBalance.mutate(
      { id: selectedDriver.id, data: { amount: numAmount } },
      {
        onSuccess: (driver) => {
          queryClient.invalidateQueries({ queryKey: getListDriversQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDriverQueryKey(selectedDriver.id) });
          toast({ title: "Balance added!", description: `${selectedDriver.name} now has $${driver.balance.toFixed(2)}` });
          setSelectedDriver(null);
          setAmount("");
        },
        onError: () => {
          toast({ title: "Failed to add balance", variant: "destructive" });
        },
      }
    );
  };

  return (
    <Layout role="admin">
      <div className="mb-8">
        <h1 className="text-3xl font-black uppercase tracking-tight">Drivers</h1>
        <p className="text-muted-foreground font-mono text-sm mt-1">Manage driver accounts and balances</p>
      </div>

      {isLoading && (
        <div className="text-center py-16 font-mono text-muted-foreground">Loading drivers...</div>
      )}

      {!isLoading && (!drivers || drivers.length === 0) && (
        <div className="text-center py-20 border-2 border-dashed rounded-sm">
          <p className="font-bold uppercase">No drivers registered</p>
          <p className="text-muted-foreground font-mono text-sm mt-1">Drivers register by entering their name in the Driver Portal</p>
        </div>
      )}

      {drivers && drivers.length > 0 && (
        <div className="border rounded-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-bold uppercase text-xs tracking-wider">ID</TableHead>
                <TableHead className="font-bold uppercase text-xs tracking-wider">Name</TableHead>
                <TableHead className="font-bold uppercase text-xs tracking-wider">Balance</TableHead>
                <TableHead className="font-bold uppercase text-xs tracking-wider">Car Type</TableHead>
                <TableHead className="font-bold uppercase text-xs tracking-wider">Nationality</TableHead>
                <TableHead className="font-bold uppercase text-xs tracking-wider">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drivers.map((driver) => (
                <TableRow key={driver.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-mono text-xs text-muted-foreground">#{driver.id}</TableCell>
                  <TableCell className="font-bold">{driver.name}</TableCell>
                  <TableCell>
                    <span className={`font-mono font-bold ${driver.balance >= 50 ? "text-green-700" : "text-red-600"}`}>
                      ${driver.balance.toFixed(2)}
                    </span>
                    {driver.balance < 50 && (
                      <span className="ml-2 text-xs text-red-500 font-mono">(below minimum)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm font-mono">{driver.carType ?? "—"}</TableCell>
                  <TableCell className="text-sm">{driver.nationality ?? "—"}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      className="font-bold text-xs uppercase border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                      onClick={() => {
                        setSelectedDriver({ id: driver.id, name: driver.name });
                        setAmount("");
                      }}
                    >
                      <PlusCircle size={12} className="mr-1" /> Add Balance
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
            <DialogTitle className="font-black uppercase tracking-tight">Add Balance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground font-mono">
              Adding balance to <strong className="text-foreground">{selectedDriver?.name}</strong>
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="amount" className="font-bold uppercase text-xs tracking-wider">Amount ($)</Label>
              <div className="relative">
                <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="amount"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="100"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-8 font-mono"
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddBalance(); }}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedDriver(null)}>Cancel</Button>
            <Button
              onClick={handleAddBalance}
              disabled={addBalance.isPending}
              className="font-bold uppercase"
            >
              {addBalance.isPending ? "Adding..." : "Add Balance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
