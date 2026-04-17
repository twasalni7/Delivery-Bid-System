import { Link } from "wouter";
import { useListRequests } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlusCircle } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-800 border-blue-200",
  SELECTED: "bg-amber-100 text-amber-800 border-amber-200",
  ACTIVE: "bg-green-100 text-green-800 border-green-200",
  COMPLETED: "bg-gray-100 text-gray-700 border-gray-200",
};

export default function ClientDashboard() {
  const { data: requests, isLoading } = useListRequests();

  return (
    <Layout role="client">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">Delivery Requests</h1>
          <p className="text-muted-foreground mt-1 font-mono text-sm">View all requests and their offers</p>
        </div>
        <Button asChild className="font-bold">
          <Link href="/client/request/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            New Request
          </Link>
        </Button>
      </div>

      {isLoading && (
        <div className="text-muted-foreground font-mono text-center py-16">Loading requests...</div>
      )}

      {!isLoading && (!requests || requests.length === 0) && (
        <div className="text-center py-20 border-2 border-dashed rounded-sm">
          <p className="text-xl font-bold uppercase">No requests yet</p>
          <p className="text-muted-foreground mt-2 font-mono text-sm">Create your first delivery request to get started</p>
          <Button asChild className="mt-6 font-bold">
            <Link href="/client/request/new">Create Request</Link>
          </Button>
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
                <TableHead className="font-bold uppercase text-xs tracking-wider">Phone</TableHead>
                <TableHead className="font-bold uppercase text-xs tracking-wider">Status</TableHead>
                <TableHead className="font-bold uppercase text-xs tracking-wider">Driver</TableHead>
                <TableHead className="font-bold uppercase text-xs tracking-wider">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((req) => (
                <TableRow key={req.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-mono text-xs text-muted-foreground">#{req.id}</TableCell>
                  <TableCell className="font-medium">{req.pickup}</TableCell>
                  <TableCell>{req.dropoff}</TableCell>
                  <TableCell className="font-mono text-sm">{req.phone}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-bold border ${STATUS_COLORS[req.status] || ""}`}>
                      {req.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {req.selectedDriver ? (
                      <span className="font-medium">{req.selectedDriver.name}</span>
                    ) : (
                      <span className="text-muted-foreground font-mono text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button asChild variant="outline" size="sm" className="font-bold text-xs">
                      <Link href={`/client/request/${req.id}`}>View Offers</Link>
                    </Button>
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
