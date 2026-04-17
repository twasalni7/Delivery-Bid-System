import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListRequests,
  useUpdateRequestStatus,
  getListRequestsQueryKey,
  getGetAdminStatsQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type Status = "OPEN" | "SELECTED" | "ACTIVE" | "COMPLETED";
const STATUSES: Status[] = ["OPEN", "SELECTED", "ACTIVE", "COMPLETED"];

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-800 border-blue-200",
  SELECTED: "bg-amber-100 text-amber-800 border-amber-200",
  ACTIVE: "bg-green-100 text-green-800 border-green-200",
  COMPLETED: "bg-gray-100 text-gray-700 border-gray-200",
};

export default function AdminRequests() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<Status | "ALL">("ALL");

  const params = filterStatus !== "ALL" ? { status: filterStatus } : undefined;
  const { data: requests, isLoading } = useListRequests(params);

  const updateStatus = useUpdateRequestStatus();

  const handleStatusChange = (requestId: number, status: Status) => {
    updateStatus.mutate(
      { id: requestId, data: { status } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListRequestsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
          toast({ title: "Status updated", description: `Request #${requestId} → ${status}` });
        },
        onError: () => {
          toast({ title: "Failed to update status", variant: "destructive" });
        },
      }
    );
  };

  return (
    <Layout role="admin">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">All Requests</h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">View and control delivery request statuses</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Filter:</span>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as Status | "ALL")}>
            <SelectTrigger className="w-36 font-mono text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-16 font-mono text-muted-foreground">Loading...</div>
      )}

      {!isLoading && (!requests || requests.length === 0) && (
        <div className="text-center py-20 border-2 border-dashed rounded-sm">
          <p className="font-bold uppercase">No requests found</p>
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
                <TableHead className="font-bold uppercase text-xs tracking-wider">Change Status</TableHead>
                <TableHead className="font-bold uppercase text-xs tracking-wider">Offers</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((req) => (
                <TableRow key={req.id} className="hover:bg-muted/30">
                  <TableCell className="font-mono text-xs text-muted-foreground">#{req.id}</TableCell>
                  <TableCell className="font-medium text-sm">{req.pickup}</TableCell>
                  <TableCell className="text-sm">{req.dropoff}</TableCell>
                  <TableCell className="font-mono text-xs">{req.phone}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-bold border ${STATUS_COLORS[req.status] || ""}`}>
                      {req.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {req.selectedDriver?.name ?? <span className="text-muted-foreground font-mono text-xs">—</span>}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={req.status}
                      onValueChange={(v) => handleStatusChange(req.id, v as Status)}
                    >
                      <SelectTrigger className="w-32 h-7 text-xs font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button asChild size="sm" variant="ghost" className="text-xs font-bold">
                      <Link href={`/client/request/${req.id}`}>View</Link>
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
