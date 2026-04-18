import { useQuery } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export interface DriverBalanceSummary {
  id: number;
  name: string;
  balance: number;
}

export interface AdminFinancial {
  totalFeesCollected: number;
  totalTransactionsAmount: number;
  totalDriversBalance: number;
  acceptedContractsCount: number;
  driverBalances: DriverBalanceSummary[];
}

export const getAdminFinancialQueryKey = () => ["/api/admin/financial"] as const;

export const getAdminFinancial = async (options?: RequestInit): Promise<AdminFinancial> => {
  return customFetch<AdminFinancial>("/api/admin/financial", {
    ...options,
    method: "GET",
  });
};

export function useGetAdminFinancial(options?: {
  query?: { enabled?: boolean };
}) {
  return useQuery({
    queryKey: getAdminFinancialQueryKey(),
    queryFn: ({ signal }) => getAdminFinancial({ signal }),
    ...options?.query,
  });
}
