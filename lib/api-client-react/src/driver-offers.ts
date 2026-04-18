import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export interface DriverOfferRequest {
  id: number;
  homeLocation: string;
  workLocation: string;
  morningTime: string;
  eveningTime: string;
  numberOfPeople: number;
  workingDaysPerWeek: number;
  status: string;
}

export interface DriverOffer {
  id: number;
  driverId: number;
  requestId: number;
  price: number;
  carType: string;
  nationality: string;
  request: DriverOfferRequest | null;
  createdAt?: string;
}

export const getListMyOffersQueryKey = () => ["/api/offers/my"] as const;

export const listMyOffers = async (options?: RequestInit): Promise<DriverOffer[]> => {
  return customFetch<DriverOffer[]>("/api/offers/my", {
    ...options,
    method: "GET",
  });
};

export function useListMyOffers(options?: {
  query?: { enabled?: boolean; refetchInterval?: number | false };
}) {
  return useQuery({
    queryKey: getListMyOffersQueryKey(),
    queryFn: ({ signal }) => listMyOffers({ signal }),
    ...options?.query,
  });
}

export function useUpdateOffer(options?: {
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ offerId, price, carType, nationality }: { offerId: number; price: number; carType?: string; nationality?: string }) => {
      return customFetch<DriverOffer>(`/api/offers/${offerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price, carType, nationality }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListMyOffersQueryKey() });
      options?.onSuccess?.();
    },
    onError: options?.onError,
  });
}

export const useUpdateOfferPrice = useUpdateOffer;

export function useWithdrawOffer(options?: {
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ offerId }: { offerId: number }) => {
      return customFetch<{ message: string }>(`/api/offers/${offerId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListMyOffersQueryKey() });
      options?.onSuccess?.();
    },
    onError: options?.onError,
  });
}
