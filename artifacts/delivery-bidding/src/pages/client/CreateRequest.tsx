import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateRequest, getListRequestsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function CreateRequest() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createRequest = useCreateRequest();

  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [phone, setPhone] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickup.trim() || !dropoff.trim() || !phone.trim()) {
      toast({ title: "All fields are required", variant: "destructive" });
      return;
    }

    createRequest.mutate(
      { data: { pickup: pickup.trim(), dropoff: dropoff.trim(), phone: phone.trim() } },
      {
        onSuccess: (req) => {
          queryClient.invalidateQueries({ queryKey: getListRequestsQueryKey() });
          toast({ title: "Request created!", description: `Your delivery request #${req.id} is now open for bids.` });
          setLocation(`/client/request/${req.id}`);
        },
        onError: () => {
          toast({ title: "Failed to create request", variant: "destructive" });
        },
      }
    );
  };

  return (
    <Layout role="client">
      <div className="max-w-xl mx-auto">
        <Link href="/client" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 font-mono">
          <ArrowLeft size={14} /> Back to requests
        </Link>

        <Card className="border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl font-black uppercase tracking-tight">New Delivery Request</CardTitle>
            <CardDescription className="font-mono text-xs">Fill in the details and drivers will submit their offers</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="pickup" className="font-bold uppercase text-xs tracking-wider">Pickup Location</Label>
                <Input
                  id="pickup"
                  placeholder="e.g. 123 Main St, New York"
                  value={pickup}
                  onChange={(e) => setPickup(e.target.value)}
                  className="font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dropoff" className="font-bold uppercase text-xs tracking-wider">Dropoff Location</Label>
                <Input
                  id="dropoff"
                  placeholder="e.g. 456 Park Ave, Brooklyn"
                  value={dropoff}
                  onChange={(e) => setDropoff(e.target.value)}
                  className="font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone" className="font-bold uppercase text-xs tracking-wider">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="e.g. +1 555 000 1234"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="font-mono"
                />
              </div>

              <Button
                type="submit"
                className="w-full font-bold uppercase tracking-wide"
                disabled={createRequest.isPending}
              >
                {createRequest.isPending ? "Submitting..." : "Post Delivery Request"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
