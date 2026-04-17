import { Link } from "wouter";
import { Package, User, Truck, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center bg-primary text-primary-foreground p-3 rounded-md mb-4 shadow-sm">
          <Package size={48} />
        </div>
        <h1 className="text-5xl font-black tracking-tighter uppercase mb-2">SWIFTBID</h1>
        <p className="text-xl text-muted-foreground font-mono">LOGISTICS BIDDING PLATFORM</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full">
        <Card className="border-2 hover:border-primary transition-colors hover:shadow-md cursor-pointer group">
          <Link href="/client" className="block h-full">
            <CardHeader className="text-center pb-2">
              <User className="mx-auto h-12 w-12 text-muted-foreground group-hover:text-primary transition-colors" />
              <CardTitle className="text-2xl mt-4">Client Portal</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription className="text-base mb-6">
                Post delivery jobs, review bids, and select drivers.
              </CardDescription>
              <Button className="w-full font-bold group-hover:bg-primary group-hover:text-primary-foreground">Enter as Client</Button>
            </CardContent>
          </Link>
        </Card>

        <Card className="border-2 hover:border-primary transition-colors hover:shadow-md cursor-pointer group">
          <Link href="/driver" className="block h-full">
            <CardHeader className="text-center pb-2">
              <Truck className="mx-auto h-12 w-12 text-muted-foreground group-hover:text-primary transition-colors" />
              <CardTitle className="text-2xl mt-4">Driver Portal</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription className="text-base mb-6">
                Find available jobs, submit bids, and manage earnings.
              </CardDescription>
              <Button className="w-full font-bold group-hover:bg-primary group-hover:text-primary-foreground">Enter as Driver</Button>
            </CardContent>
          </Link>
        </Card>

        <Card className="border-2 hover:border-primary transition-colors hover:shadow-md cursor-pointer group">
          <Link href="/admin" className="block h-full">
            <CardHeader className="text-center pb-2">
              <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground group-hover:text-primary transition-colors" />
              <CardTitle className="text-2xl mt-4">Admin Console</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription className="text-base mb-6">
                Oversee platform activity, manage users and jobs.
              </CardDescription>
              <Button className="w-full font-bold group-hover:bg-primary group-hover:text-primary-foreground">Enter as Admin</Button>
            </CardContent>
          </Link>
        </Card>
      </div>
    </div>
  );
}
