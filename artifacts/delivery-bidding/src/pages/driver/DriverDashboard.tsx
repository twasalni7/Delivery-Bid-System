import { useLocation, Link } from "wouter";
import { useEffect } from "react";
import { useListRequests, useGetDriver, getGetDriverQueryKey } from "@workspace/api-client-react";
import { useDriverSession } from "@/hooks/use-driver-session";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, DollarSign, MapPin, ArrowRight } from "lucide-react";

export default function DriverDashboard() {
  const [, setLocation] = useLocation();
  const { driverId } = useDriverSession();

  useEffect(() => {
    if (!driverId) {
      setLocation("/driver");
    }
  }, [driverId, setLocation]);

  const { data: driver } = useGetDriver(driverId!, {
    query: { enabled: !!driverId, queryKey: getGetDriverQueryKey(driverId!) },
  });

  const { data: requests, isLoading } = useListRequests({ status: "OPEN" });

  const hasEnoughBalance = driver ? driver.balance >= 50 : false;

  if (!driverId) return null;

  return (
    <Layout role="driver">
      <div className="mb-8">
        <h1 className="text-3xl font-black uppercase tracking-tight">Driver Dashboard</h1>
        <p className="text-muted-foreground font-mono text-sm mt-1">Open delivery requests — submit your best offer</p>
      </div>

      {driver && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="border-2">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Driver</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-black">{driver.name}</p>
            </CardContent>
          </Card>

          <Card className={`border-2 ${hasEnoughBalance ? "border-green-300 bg-green-50/30" : "border-red-300 bg-red-50/30"}`}>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <DollarSign size={12} /> Balance
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className={`text-2xl font-black font-mono ${hasEnoughBalance ? "text-green-700" : "text-red-600"}`}>
                ${driver.balance.toFixed(2)}
              </p>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Open Jobs</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-black">{requests?.length ?? "—"}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {!hasEnoughBalance && driver && (
        <div className="flex items-start gap-3 bg-amber-50 border-2 border-amber-300 rounded-sm px-4 py-3 mb-6">
          <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-amber-800 text-sm">Insufficient Balance</p>
            <p className="text-amber-700 font-mono text-xs mt-0.5">
              You need a minimum balance of $50.00 to submit an offer. Current balance: ${driver.balance.toFixed(2)}. Contact an admin to top up.
            </p>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="text-center py-16 font-mono text-muted-foreground">Loading open requests...</div>
      )}

      {!isLoading && (!requests || requests.length === 0) && (
        <div className="text-center py-20 border-2 border-dashed rounded-sm">
          <p className="text-xl font-bold uppercase">No open requests</p>
          <p className="text-muted-foreground font-mono text-sm mt-2">Check back later for new delivery jobs</p>
        </div>
      )}

      {requests && requests.length > 0 && (
        <div className="border rounded-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-bold uppercase text-xs tracking-wider">ID</TableHead>
                <TableHead className="font-bold uppercase text-xs tracking-wider">Pickup</TableHead>
                <TableHead className="font-bold uppercase text-xs tracking-wider">Dropoff</TableHead>
                <TableHead className="font-bold uppercase text-xs tracking-wider">Contact</TableHead>
                <TableHead className="font-bold uppercase text-xs tracking-wider">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((req) => (
                <TableRow key={req.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-mono text-xs text-muted-foreground">#{req.id}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <MapPin size={12} className="text-muted-foreground shrink-0" />
                      <span className="font-medium">{req.pickup}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <MapPin size={12} className="text-primary shrink-0" />
                      <span>{req.dropoff}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{req.phone}</TableCell>
                  <TableCell>
                    {hasEnoughBalance ? (
                      <Button asChild size="sm" className="font-bold text-xs uppercase">
                        <Link href={`/driver/request/${req.id}`}>
                          Bid <ArrowRight size={12} className="ml-1" />
                        </Link>
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled className="font-bold text-xs uppercase text-muted-foreground">
                        Bid
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Layout>
  );
}
