import { useListOffers } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "wouter";

export default function AdminOffers() {
  const { data: offers, isLoading } = useListOffers();

  return (
    <Layout role="admin">
      <div className="mb-8">
        <h1 className="text-3xl font-black uppercase tracking-tight">All Offers</h1>
        <p className="text-muted-foreground font-mono text-sm mt-1">Every offer submitted by drivers across all requests</p>
      </div>

      {isLoading && (
        <div className="text-center py-16 font-mono text-muted-foreground">Loading offers...</div>
      )}

      {!isLoading && (!offers || offers.length === 0) && (
        <div className="text-center py-20 border-2 border-dashed rounded-sm">
          <p className="font-bold uppercase">No offers yet</p>
          <p className="text-muted-foreground font-mono text-sm mt-1">Offers will appear here when drivers submit bids</p>
        </div>
      )}

      {offers && offers.length > 0 && (
        <div className="border rounded-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-bold uppercase text-xs tracking-wider">ID</TableHead>
                <TableHead className="font-bold uppercase text-xs tracking-wider">Driver</TableHead>
                <TableHead className="font-bold uppercase text-xs tracking-wider">Request</TableHead>
                <TableHead className="font-bold uppercase text-xs tracking-wider">Price</TableHead>
                <TableHead className="font-bold uppercase text-xs tracking-wider">Car Type</TableHead>
                <TableHead className="font-bold uppercase text-xs tracking-wider">Nationality</TableHead>
                <TableHead className="font-bold uppercase text-xs tracking-wider">Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offers.map((offer) => (
                <TableRow key={offer.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-mono text-xs text-muted-foreground">#{offer.id}</TableCell>
                  <TableCell className="font-bold">{offer.driver?.name ?? `#${offer.driverId}`}</TableCell>
                  <TableCell>
                    <Link href={`/client/request/${offer.requestId}`} className="text-primary hover:underline font-mono text-sm">
                      #{offer.requestId}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono font-bold text-primary">${offer.price.toFixed(2)}</TableCell>
                  <TableCell className="text-sm font-mono">{offer.carType}</TableCell>
                  <TableCell className="text-sm">{offer.nationality}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {offer.createdAt ? new Date(offer.createdAt).toLocaleDateString() : "—"}
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
