import { useEffect, useRef } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";

type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE";

type TableSubscription = {
  table: string;
  events: RealtimeEvent[];
};

/**
 * useRealtimeRefresh
 *
 * Subscribes to Supabase Realtime postgres_changes events for the given tables
 * and invalidates the specified React Query cache keys whenever any matching
 * database change fires.
 *
 * Falls back gracefully to no-op if Supabase is not configured — polling via
 * each query's `refetchInterval` will handle updates in that case.
 *
 * @param channelName  Unique name for the Supabase channel (must be stable).
 * @param subscriptions  Array of { table, events } pairs to listen to.
 * @param queryKeys  React Query keys to invalidate on any change event.
 * @param enabled  Whether to activate the subscription (default: true).
 */
export function useRealtimeRefresh(
  channelName: string,
  subscriptions: TableSubscription[],
  queryKeys: QueryKey[],
  enabled = true
): void {
  const queryClient = useQueryClient();
  // Use a ref so the effect doesn't re-run when queryKeys identity changes.
  const queryKeysRef = useRef(queryKeys);
  queryKeysRef.current = queryKeys;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let realtimeChannel: any = null;

    import("@/lib/supabase").then(({ getSupabase }) => {
      if (cancelled) return;
      try {
        const supabase = getSupabase();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let channel: any = supabase.channel(channelName);

        for (const { table, events } of subscriptions) {
          for (const event of events) {
            channel = channel.on(
              "postgres_changes",
              { event, schema: "public", table },
              () => {
                for (const key of queryKeysRef.current) {
                  queryClient.invalidateQueries({ queryKey: key as QueryKey });
                }
              }
            );
          }
        }

        realtimeChannel = channel.subscribe();
      } catch {
        // Supabase is not configured — polling via refetchInterval is used as fallback.
      }
    });

    return () => {
      cancelled = true;
      if (realtimeChannel) {
        import("@/lib/supabase")
          .then(({ getSupabase }) => {
            try {
              getSupabase().removeChannel(realtimeChannel);
            } catch {
              /* ignore cleanup errors */
            }
          })
          .catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, enabled, queryClient]);
}
