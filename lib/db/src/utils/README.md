# Distance-Based Pricing System

This module provides utilities for calculating monthly subscription prices based on distance, trip type, working days, and number of passengers.

## Overview

The pricing system uses the Haversine formula to calculate straight-line distances between coordinates and applies tiered pricing with multipliers based on various factors.

## Usage

### Import

```typescript
import { haversineKm, calculateMonthlyPrice, type TripType, type PricingResult } from "@workspace/db";
```

### Calculate Distance

```typescript
const distanceKm = haversineKm(
  24.7136, 46.6753,  // Home coordinates (Riyadh)
  24.7500, 46.7000   // Work coordinates
);
// Returns: 4.75 km
```

### Calculate Price

```typescript
const result = calculateMonthlyPrice(
  15,            // Distance in km
  "round_trip",  // Trip type: "one_way" | "round_trip"
  6,             // Working days per week
  2              // Number of people
);

console.log(result);
// {
//   price: 2972,              // Monthly price in SAR
//   needsAdminReview: false,  // true if distance > 40km
//   baseTier: 950,            // Base price for distance tier
//   tripMultiplier: 1.7,      // Applied multiplier (round trip)
//   daysMultiplier: 1.15,     // Applied multiplier (6 days)
//   peopleMultiplier: 1.6     // Applied multiplier (2 people)
// }
```

## Pricing Tiers

Distance-based base prices (monthly, SAR):

| Distance Range | Base Price |
|----------------|------------|
| 0-5 km         | 400 SAR    |
| 5-10 km        | 650 SAR    |
| 10-20 km       | 950 SAR    |
| 20-30 km       | 1,300 SAR  |
| 30-40 km       | 1,700 SAR  |
| > 40 km        | Requires admin review |

## Multipliers

### Trip Type
- **One-way**: 1.0x
- **Round trip**: 1.7x

### Working Days per Week
- **1-5 days**: 1.0x
- **6 days**: 1.15x
- **7 days**: 1.25x

### Number of People
- **1 person**: 1.0x
- **2 people**: 1.6x
- **3+ people**: 2.1x

## Examples

### Example 1: Basic Calculation
```typescript
// 4km, one-way, 5 days/week, 1 person
const result = calculateMonthlyPrice(4, "one_way", 5, 1);
// Price: 400 SAR (400 × 1.0 × 1.0 × 1.0)
```

### Example 2: Round Trip with Multiple Passengers
```typescript
// 15km, round-trip, 6 days/week, 2 people
const result = calculateMonthlyPrice(15, "round_trip", 6, 2);
// Price: 2,972 SAR (950 × 1.7 × 1.15 × 1.6)
```

### Example 3: Admin Review Required
```typescript
// 45km (exceeds 40km limit)
const result = calculateMonthlyPrice(45, "one_way", 5, 1);
// {
//   price: 0,
//   needsAdminReview: true,
//   baseTier: null,
//   tripMultiplier: 0,
//   daysMultiplier: 0,
//   peopleMultiplier: 0
// }
```

## Database Schema

The requests table now includes coordinate and distance fields:

```sql
ALTER TABLE requests
  ADD COLUMN home_lat           DOUBLE PRECISION,  -- Home latitude (WGS84)
  ADD COLUMN home_lng           DOUBLE PRECISION,  -- Home longitude (WGS84)
  ADD COLUMN dest_lat           DOUBLE PRECISION,  -- Destination latitude (WGS84)
  ADD COLUMN dest_lng           DOUBLE PRECISION,  -- Destination longitude (WGS84)
  ADD COLUMN distance_km        REAL,              -- Haversine distance in km
  ADD COLUMN needs_admin_review BOOLEAN NOT NULL DEFAULT FALSE;  -- true if > 40km
```

## Integration

### In Backend API

```typescript
import { haversineKm, calculateMonthlyPrice } from "@workspace/db";

// When creating a request with coordinates
const distanceKm = haversineKm(homeLat, homeLng, destLat, destLng);

// Determine trip type: if eveningTime is provided, it's a round trip
// (client needs transportation both to work in morning and back home in evening)
const tripType = eveningTime ? "round_trip" : "one_way";

const pricing = calculateMonthlyPrice(
  distanceKm,
  tripType,
  workingDaysPerWeek,
  numberOfPeople
);

await db.insert(requestsTable).values({
  // ... other fields
  homeLat,
  homeLng,
  destLat,
  destLng,
  distanceKm,
  needsAdminReview: pricing.needsAdminReview,
  monthlyPrice: pricing.price,
});
```

### In Frontend

```typescript
import { useQuery } from "@tanstack/react-query";

// Fetch calculated price from API endpoint
const { data: pricing } = useQuery({
  queryKey: ["pricing", homeLat, homeLng, destLat, destLng],
  queryFn: async () => {
    const response = await fetch("/api/calculate-price", {
      method: "POST",
      body: JSON.stringify({ homeLat, homeLng, destLat, destLng, /* ... */ })
    });
    return response.json();
  }
});
```

## Admin Review Workflow

When `needsAdminReview` is true (distance > 40km):

1. The request is created with `monthlyPrice: 0`
2. The admin must manually review and set a price
3. Use the admin dashboard to filter requests where `needs_admin_review = true`
4. Index `idx_requests_needs_review` speeds up these queries

## Notes

- The Haversine formula calculates **straight-line** distance, not actual driving routes
- For production, consider integrating a routing API (e.g., Google Maps, Mapbox) for accurate distances
- All prices are in Saudi Riyals (SAR)
- The 40km threshold can be adjusted in the `calculateMonthlyPrice` function if needed
