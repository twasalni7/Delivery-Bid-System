import { useParams, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetRequest,
  useGetRequestOffers,
  useSelectOffer,
  getGetRequestQueryKey,
  getGetRequestOffersQueryKey,
  getListRequestsQueryKey,
} from "@workspace/api-client-react";
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
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, MapPin, Phone, Check } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-800 border-blue-200",
  SELECTED: "bg-amber-100 text-amber-800 border-amber-200",
  ACTIVE: "bg-green-100 text-green-800 border-green-200",
  COMPLETED: "bg-gray-100 text-gray-700 border-gray-200",
};

export default function RequestDetails() {
  const { id } = useParams<{ id: string }>();
  const reqId = parseInt(id);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: request, isLoading: loadingRequest } = useGetRequest(reqId, {
    query: { enabled: !!reqId, queryKey: getGetRequestQueryKey(reqId) },
  });

  const { data: offers, isLoading: loadingOffers } = useGetRequestOffers(reqId, {
    query: { enabled: !!reqId, queryKey: getGetRequestOffersQueryKey(reqId) },
  });

  const selectOffer = useSelectOffer();

  const handleSelectOffer = (offerId: number) => {
    selectOffer.mutate(
      { id: reqId, data: { offerId } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetRequestQueryKey(reqId) });
          queryClient.invalidateQueries({ queryKey: getGetRequestOffersQueryKey(reqId) });
          queryClient.invalidateQueries({ queryKey: getListRequestsQueryKey() });
          toast({ title: "Driver selected!", description: "50 credits deducted from driver balance. Request is now SELECTED." });
        },
        onError: (error: { data?: { error?: string } }) => {
          toast({
            title: "Selection failed",
            description: error?.data?.error || "Could not select this offer.",
            variant: "destructive",
          });
        },
      }
    );
  };

  if (loadingRequest) {
    return (
      <Layout role="client">
        <div className="text-center py-20 font-mono text-muted-foreground">Loading...</div>
      </Layout>
    );
  }

  if (!request) {
    return (
      <Layout role="client">
        <div className="text-center py-20">
          <p className="font-bold text-xl uppercase">Request not found</p>
          <Link href="/client" className="text-primary font-mono text-sm mt-4 block hover:underline">Back to requests</Link>
        </div>
      </Layout>
    );
  }

  const isOpen = request.status === "OPEN";

  return (
    <Layout role="client">
      <div className="max-w-3xl mx-auto">
        <Link href="/client" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 font-mono">
          <ArrowLeft size={14} /> Back to requests
        </Link>

        <Card className="border-2 mb-8">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-black uppercase tracking-tight">Request #{request.id}</CardTitle>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-sm text-xs font-bold border ${STATUS_COLORS[request.status] || ""}`}>
                {request.status}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-2">
                <MapPin size={16} className="mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pickup</p>
                  <p className="font-medium">{request.pickup}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin size={16} className="mt-0.5 text-primary shrink-0" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dropoff</p>
                  <p className="font-medium">{request.dropoff}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t">
              <Phone size={14} className="text-muted-foreground" />
              <span className="font-mono text-sm">{request.phone}</span>
            </div>
            {request.selectedDriver && (
              <div className="flex items-center gap-2 pt-2 border-t bg-green-50 -mx-6 px-6 pb-2 rounded-b-sm">
                <Check size={14} className="text-green-700" />
                <span className="text-sm font-bold text-green-800">Driver: {request.selectedDriver.name}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black uppercase tracking-tight">
            Offers {offers ? `(${offers.length})` : ""}
          </h2>
          {!isOpen && (
            <span className="text-xs font-mono text-muted-foreground">This request is no longer accepting offers</span>
          )}
        </div>

        {loadingOffers && (
          <div className="text-center py-10 font-mono text-muted-foreground text-sm">Loading offers...</div>
        )}

        {!loadingOffers && (!offers || offers.length === 0) && (
          <div className="text-center py-14 border-2 border-dashed rounded-sm">
            <p className="font-bold uppercase">No offers yet</p>
            <p className="text-muted-foreground font-mono text-sm mt-1">Drivers will submit their offers here</p>
          </div>
        )}

        {offers && offers.length > 0 && (
          <div className="border rounded-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-bold uppercase text-xs tracking-wider">Driver</TableHead>
                  <TableHead className="font-bold uppercase text-xs tracking-wider">Price</TableHead>
                  <TableHead className="font-bold uppercase text-xs tracking-wider">Car Type</TableHead>
                  <TableHead className="font-bold uppercase text-xs tracking-wider">Nationality</TableHead>
                  {isOpen && <TableHead className="font-bold uppercase text-xs tracking-wider">Select</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {offers.map((offer) => (
                  <TableRow
                    key={offer.id}
                    className={`hover:bg-muted/30 transition-colors ${request.selectedDriverId === offer.driverId ? "bg-amber-50" : ""}`}
                  >
                    <TableCell className="font-medium">{offer.driver?.name ?? `Driver #${offer.driverId}`}</TableCell>
                    <TableCell className="font-mono font-bold text-primary">${offer.price.toFixed(2)}</TableCell>
                    <TableCell className="text-sm">{offer.carType}</TableCell>
                    <TableCell className="text-sm">{offer.nationality}</TableCell>
                    {isOpen && (
                      <TableCell>
                        <Button
                          size="sm"
                          className="font-bold text-xs uppercase"
                          onClick={() => handleSelectOffer(offer.id)}
                          disabled={selectOffer.isPending}
                        >
                          <Check size={12} className="mr-1" /> Select
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </Layout>
  );
}
