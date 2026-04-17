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
        <h1 className="text-3xl font-black">جميع العروض</h1>
        <p className="text-muted-foreground text-sm mt-1">كل العروض المقدّمة من السائقين على جميع الطلبات</p>
      </div>

      {isLoading && (
        <div className="text-center py-16 text-muted-foreground">جاري تحميل العروض...</div>
      )}

      {!isLoading && (!offers || offers.length === 0) && (
        <div className="text-center py-20 border-2 border-dashed rounded-sm">
          <p className="font-bold">لا توجد عروض بعد</p>
          <p className="text-muted-foreground text-sm mt-1">ستظهر العروض هنا عندما يقدّم السائقون عطاءاتهم</p>
        </div>
      )}

      {offers && offers.length > 0 && (
        <div className="border rounded-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-bold text-xs">رقم</TableHead>
                <TableHead className="font-bold text-xs">السائق</TableHead>
                <TableHead className="font-bold text-xs">الطلب</TableHead>
                <TableHead className="font-bold text-xs">السعر الشهري</TableHead>
                <TableHead className="font-bold text-xs">نوع السيارة</TableHead>
                <TableHead className="font-bold text-xs">الجنسية</TableHead>
                <TableHead className="font-bold text-xs">تاريخ التقديم</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offers.map((offer) => (
                <TableRow key={offer.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="text-xs text-muted-foreground">#{offer.id}</TableCell>
                  <TableCell className="font-bold">{offer.driver?.name ?? `#${offer.driverId}`}</TableCell>
                  <TableCell>
                    <Link href={`/client/request/${offer.requestId}`} className="text-primary hover:underline text-sm">
                      #{offer.requestId}
                    </Link>
                  </TableCell>
                  <TableCell className="font-bold text-primary" dir="ltr">{offer.price.toFixed(2)} ر.س</TableCell>
                  <TableCell className="text-sm">{offer.carType}</TableCell>
                  <TableCell className="text-sm">{offer.nationality}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {offer.createdAt ? new Date(offer.createdAt).toLocaleDateString("ar-SA") : "—"}
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
