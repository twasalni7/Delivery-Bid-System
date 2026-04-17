import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetRequest,
  useCreateOffer,
  useGetDriver,
  getGetRequestQueryKey,
  getGetDriverQueryKey,
  getListRequestsQueryKey,
} from "@workspace/api-client-react";
import { useDriverSession } from "@/hooks/use-driver-session";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, MapPin, Phone, AlertTriangle } from "lucide-react";

export default function SubmitOffer() {
  const { id } = useParams<{ id: string }>();
  const reqId = parseInt(id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { driverId } = useDriverSession();

  useEffect(() => {
    if (!driverId) {
      setLocation("/driver");
    }
  }, [driverId, setLocation]);

  const { data: request, isLoading: loadingRequest } = useGetRequest(reqId, {
    query: { enabled: !!reqId, queryKey: getGetRequestQueryKey(reqId) },
  });

  const { data: driver } = useGetDriver(driverId!, {
    query: { enabled: !!driverId, queryKey: getGetDriverQueryKey(driverId!) },
  });

  const createOffer = useCreateOffer();

  const [price, setPrice] = useState("");
  const [carType, setCarType] = useState("");
  const [nationality, setNationality] = useState("");

  const hasEnoughBalance = driver ? driver.balance >= 50 : false;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!price || !carType.trim() || !nationality.trim()) {
      toast({ title: "All fields are required", variant: "destructive" });
      return;
    }
    if (!driverId) {
      toast({ title: "Please log in first", variant: "destructive" });
      return;
    }
    if (!hasEnoughBalance) {
      toast({ title: "Insufficient balance", description: "You need at least $50 balance to bid", variant: "destructive" });
      return;
    }

    createOffer.mutate(
      {
        data: {
          driverId,
          requestId: reqId,
          price: parseFloat(price),
          carType: carType.trim(),
          nationality: nationality.trim(),
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListRequestsQueryKey({ status: "OPEN" }) });
          toast({ title: "Offer submitted!", description: "The client will review your offer." });
          setLocation("/driver/dashboard");
        },
        onError: (error: { data?: { error?: string } }) => {
          toast({
            title: "Failed to submit offer",
            description: error?.data?.error || "Something went wrong.",
            variant: "destructive",
          });
        },
      }
    );
  };

  if (!driverId) return null;

  return (
    <Layout role="driver">
      <div className="max-w-xl mx-auto">
        <Link href="/driver/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 font-mono">
          <ArrowLeft size={14} /> Back to dashboard
        </Link>

        {loadingRequest && (
          <div className="text-center py-16 font-mono text-muted-foreground">Loading request...</div>
        )}

        {request && (
          <>
            <Card className="border-2 mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-black uppercase tracking-tight flex items-center justify-between">
                  Request #{request.id}
                  <span className="text-xs bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-sm font-bold">OPEN</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground font-mono text-xs">From:</span>
                  <span className="font-medium">{request.pickup}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-primary shrink-0" />
                  <span className="text-muted-foreground font-mono text-xs">To:</span>
                  <span className="font-medium">{request.dropoff}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-muted-foreground shrink-0" />
                  <span className="font-mono">{request.phone}</span>
                </div>
              </CardContent>
            </Card>

            {!hasEnoughBalance && driver && (
              <div className="flex items-start gap-3 bg-red-50 border-2 border-red-300 rounded-sm px-4 py-3 mb-6">
                <AlertTriangle size={18} className="text-red-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold text-red-800 text-sm">Cannot Submit Offer</p>
                  <p className="text-red-700 font-mono text-xs mt-0.5">
                    Your balance (${driver.balance.toFixed(2)}) is below the required $50.00 minimum. Contact an admin to add funds.
                  </p>
                </div>
              </div>
            )}

            <Card className="border-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-black uppercase tracking-tight">Submit Your Offer</CardTitle>
                <CardDescription className="font-mono text-xs">
                  Logged in as <strong>{driver?.name}</strong> (Balance: ${driver?.balance.toFixed(2) ?? "0.00"})
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="price" className="font-bold uppercase text-xs tracking-wider">Your Price ($)</Label>
                    <Input
                      id="price"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="e.g. 25.00"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="carType" className="font-bold uppercase text-xs tracking-wider">Car Type</Label>
                    <Input
                      id="carType"
                      placeholder="e.g. Sedan, SUV, Truck, Motorcycle"
                      value={carType}
                      onChange={(e) => setCarType(e.target.value)}
                      className="font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="nationality" className="font-bold uppercase text-xs tracking-wider">Nationality</Label>
                    <Input
                      id="nationality"
                      placeholder="e.g. American, Egyptian, British"
                      value={nationality}
                      onChange={(e) => setNationality(e.target.value)}
                      className="font-mono"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full font-bold uppercase tracking-wide"
                    disabled={createOffer.isPending || !hasEnoughBalance}
                  >
                    {createOffer.isPending ? "Submitting..." : "Submit Offer"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
