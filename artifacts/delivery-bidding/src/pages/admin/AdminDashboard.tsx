import { Link } from "wouter";
import { useGetAdminStats } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Users, FileText, TrendingUp } from "lucide-react";

export default function AdminDashboard() {
  const { data: stats, isLoading } = useGetAdminStats();

  return (
    <Layout role="admin">
      <div className="mb-8">
        <h1 className="text-3xl font-black uppercase tracking-tight">Admin Console</h1>
        <p className="text-muted-foreground font-mono text-sm mt-1">Platform overview and controls</p>
      </div>

      {isLoading && (
        <div className="text-center py-16 font-mono text-muted-foreground">Loading stats...</div>
      )}

      {stats && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <Card className="border-2">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Requests</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-3xl font-black">{stats.totalRequests}</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-blue-200 bg-blue-50/30">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-blue-600">Open</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-3xl font-black text-blue-700">{stats.openRequests}</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-amber-200 bg-amber-50/30">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-amber-600">Selected</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-3xl font-black text-amber-700">{stats.selectedRequests}</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-green-200 bg-green-50/30">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-green-600">Active</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-3xl font-black text-green-700">{stats.activeRequests}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <Card className="border-2 bg-muted/20">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Completed</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-3xl font-black text-muted-foreground">{stats.completedRequests}</p>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Users size={12} /> Total Drivers
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-3xl font-black">{stats.totalDrivers}</p>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <TrendingUp size={12} /> Total Offers
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-3xl font-black">{stats.totalOffers}</p>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Button asChild variant="outline" className="h-20 font-bold uppercase flex-col gap-1 border-2 hover:border-primary transition-colors">
          <Link href="/admin/requests">
            <Package size={20} className="mb-1" />
            Manage Requests
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-20 font-bold uppercase flex-col gap-1 border-2 hover:border-primary transition-colors">
          <Link href="/admin/drivers">
            <Users size={20} className="mb-1" />
            Manage Drivers
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-20 font-bold uppercase flex-col gap-1 border-2 hover:border-primary transition-colors">
          <Link href="/admin/offers">
            <FileText size={20} className="mb-1" />
            View All Offers
          </Link>
        </Button>
      </div>
    </Layout>
  );
}
