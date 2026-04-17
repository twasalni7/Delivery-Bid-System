import { useState } from "react";
import { useLocation } from "wouter";
import { useDriverLogin } from "@workspace/api-client-react";
import { useDriverSession } from "@/hooks/use-driver-session";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Truck } from "lucide-react";

export default function DriverLogin() {
  const [, setLocation] = useLocation();
  const { setDriverId } = useDriverSession();
  const { toast } = useToast();
  const driverLogin = useDriverLogin();

  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: "Please enter your name", variant: "destructive" });
      return;
    }

    driverLogin.mutate(
      { data: { name: name.trim() } },
      {
        onSuccess: (driver) => {
          setDriverId(driver.id);
          toast({ title: `Welcome, ${driver.name}!`, description: `Balance: $${driver.balance.toFixed(2)}` });
          setLocation("/driver/dashboard");
        },
        onError: () => {
          toast({ title: "Login failed", variant: "destructive" });
        },
      }
    );
  };

  return (
    <Layout role="driver">
      <div className="max-w-sm mx-auto mt-16">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center bg-primary text-primary-foreground p-3 rounded-sm mb-4">
            <Truck size={32} />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight">Driver Login</h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">Enter your name to access the driver portal</p>
        </div>

        <Card className="border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">Sign in</CardTitle>
            <CardDescription className="font-mono text-xs">New drivers are automatically registered</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="font-bold uppercase text-xs tracking-wider">Your Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. Ahmed Al-Rashid"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="font-mono"
                  autoFocus
                />
              </div>

              <Button
                type="submit"
                className="w-full font-bold uppercase tracking-wide"
                disabled={driverLogin.isPending}
              >
                {driverLogin.isPending ? "Signing in..." : "Enter Driver Portal"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
