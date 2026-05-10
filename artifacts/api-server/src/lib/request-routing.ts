import { calculateRoutePlan, type RoutePoint } from "./maps";
import { calculatePriceForRequest } from "../routes/pricing";

export interface PassengerRoutingInput {
  passengerIndex: number;
  pickupLat?: number | null;
  pickupLng?: number | null;
  destinationLat?: number | null;
  destinationLng?: number | null;
  pickupAddress?: string | null;
  destinationAddress?: string | null;
  workTime?: string | null;
  daysPerWeek?: number | null;
}

export interface StopRoutingInput {
  stopOrder: number;
  lat: number;
  lng: number;
  address: string;
  stopType?: string | null;
}

function hasCoords(
  lat?: number | null,
  lng?: number | null
): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng);
}

export async function resolveRequestRoutingAndPricing(params: {
  homeLat?: number | null;
  homeLng?: number | null;
  homeLocation?: string | null;
  destLat?: number | null;
  destLng?: number | null;
  workLocation?: string | null;
  stops?: StopRoutingInput[] | null;
  passengers?: PassengerRoutingInput[] | null;
  additionalLocations?: Array<{ type: "pickup" | "dropoff"; address: string }> | null;
  numberOfPeople: number;
  workingDaysPerWeek: number;
  numberOfShifts: number;
  eveningTime?: string | null;
  shifts?: { label?: string; goTime: string; returnTime?: string }[] | null;
}) {
  const passengerInputs = params.passengers?.filter((passenger) =>
    hasCoords(passenger.pickupLat, passenger.pickupLng) &&
    hasCoords(passenger.destinationLat, passenger.destinationLng)
  ) ?? [];

  const primaryPoints: RoutePoint[] =
    hasCoords(params.homeLat, params.homeLng) && hasCoords(params.destLat, params.destLng)
      ? [
          { lat: params.homeLat, lng: params.homeLng!, address: params.homeLocation ?? null, type: "pickup" },
          ...((params.stops ?? [])
            .sort((a, b) => a.stopOrder - b.stopOrder)
            .map((stop) => ({
              lat: stop.lat,
              lng: stop.lng,
              address: stop.address,
              type: stop.stopType ?? "waypoint",
            })) satisfies RoutePoint[]),
          { lat: params.destLat, lng: params.destLng!, address: params.workLocation ?? null, type: "dropoff" },
        ]
      : [];

  const primaryRoute =
    primaryPoints.length >= 2 ? await calculateRoutePlan(primaryPoints) : null;

  const passengerRoutes = await Promise.all(
    passengerInputs.map(async (passenger) => ({
      passengerIndex: passenger.passengerIndex,
      route: await calculateRoutePlan([
        {
          lat: passenger.pickupLat!,
          lng: passenger.pickupLng!,
          address: passenger.pickupAddress ?? null,
          type: "pickup",
        },
        {
          lat: passenger.destinationLat!,
          lng: passenger.destinationLng!,
          address: passenger.destinationAddress ?? null,
          type: "dropoff",
        },
      ]),
    }))
  );

  const distanceCandidates = [
    primaryRoute?.distanceKm ?? null,
    ...passengerRoutes.map((item) => item.route.distanceKm),
  ].filter((value): value is number => value !== null);

  const durationCandidates = [
    primaryRoute?.durationMinutes ?? null,
    ...passengerRoutes.map((item) => item.route.durationMinutes),
  ].filter((value): value is number => value !== null);

  const distanceKm =
    distanceCandidates.length > 0
      ? Math.max(...distanceCandidates)
      : null;
  const durationMinutes =
    durationCandidates.length > 0
      ? Math.max(...durationCandidates)
      : null;

  const pricing =
    distanceKm == null
      ? null
      : await calculatePriceForRequest({
          distanceKm,
          numberOfPeople: params.numberOfPeople,
          workingDaysPerWeek: params.workingDaysPerWeek,
          numberOfShifts: params.numberOfShifts,
          eveningTime: params.eveningTime ?? null,
          shifts: params.shifts ?? null,
          additionalLocations: params.additionalLocations ?? null,
        });

  return {
    distanceKm,
    durationMinutes,
    routePolyline: primaryRoute?.routePolyline ?? null,
    coordinates:
      primaryRoute?.coordinates ?? {
        pickup:
          hasCoords(params.homeLat, params.homeLng)
            ? { lat: params.homeLat!, lng: params.homeLng!, address: params.homeLocation ?? null }
            : null,
        dropoff:
          hasCoords(params.destLat, params.destLng)
            ? { lat: params.destLat!, lng: params.destLng!, address: params.workLocation ?? null }
            : null,
        waypoints: (params.stops ?? []).map((stop) => ({
          lat: stop.lat,
          lng: stop.lng,
          address: stop.address,
          type: stop.stopType ?? "waypoint",
        })),
      },
    pricingSnapshot: pricing
      ? {
          engine: pricing.engine,
          distanceKm,
          durationMinutes,
          price: pricing.price,
          pricePerPerson: pricing.pricePerPerson,
          numberOfPeople: params.numberOfPeople,
          workingDaysPerWeek: params.workingDaysPerWeek,
          numberOfShifts: params.numberOfShifts,
          additionalLocationsCount: params.additionalLocations?.length ?? 0,
          calculatedAt: new Date().toISOString(),
          passengerRoutes: passengerRoutes.map((item) => ({
            passengerIndex: item.passengerIndex,
            distanceKm: item.route.distanceKm,
            durationMinutes: item.route.durationMinutes,
          })),
        }
      : null,
    pricing,
    passengerRoutes,
  };
}
