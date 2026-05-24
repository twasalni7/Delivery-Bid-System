/**
 * use-request-passengers.ts — Hook لجلب بيانات الركاب لطلب معين
 */

import { useQuery } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/authed-fetch";
import { API_ORIGIN as API } from "@/lib/api-config";

interface RequestPassenger {
  id: number;
  requestId: number;
  passengerIndex: number;
  pickupLat: number | null;
  pickupLng: number | null;
  destinationLat: number | null;
  destinationLng: number | null;
  pickupAddress: string | null;
  destinationAddress: string | null;
  workTime: string | null;
  daysPerWeek: number | null;
  distanceKm: number | null;
  createdAt: string;
}

export function useRequestPassengers(requestId: number | undefined, enabled = true) {
  return useQuery<RequestPassenger[]>({
    queryKey: ["request-passengers", requestId],
    queryFn: async () => {
      if (!requestId) return [];
      const res = await fetch(`${API}/api/requests/${requestId}/passengers`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        if (res.status === 404) return []; // No passengers found
        throw new Error("فشل جلب بيانات الركاب");
      }
      return res.json();
    },
    enabled: enabled && !!requestId,
    staleTime: 30_000, // Cache for 30 seconds
  });
}
