# Distance-Based Pricing System

This module provides utilities for calculating monthly subscription prices based on distance, trip type, working days, and number of passengers.

## Overview

The pricing system uses the Haversine formula to calculate straight-line distances between coordinates and applies tiered pricing with multipliers based on various factors. All configuration can be overridden via the database (`app_config` table) and managed through the admin panel.

## Usage

### Import

```typescript
import {
  haversineKm,
  calculateMonthlyPrice,
  getDefaultPricingConfig,
  getSharingFactor,
  type TripType,
  type PricingResult,
  type PricingConfig,
} from "@workspace/db";
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
  25,            // Distance in km
  "round_trip",  // Trip type: "one_way" | "round_trip"
  6,             // Working days per week
  2              // Number of people sharing
);

console.log(result);
// {
//   price: 3460,                 // Total monthly price for 2 people (SAR)
//   pricePerPerson: 1730,        // Per-person monthly price (SAR)
//   needsAdminReview: false,
//   baseTier: 1400,              // Base price for 20-25 km tier
//   tripMultiplier: 1.7,
//   daysMultiplier: 1.15,
//   shareDiscountFactor: 0.72,   // 2-person sharing discount
//   numberOfPeople: 2
// }
```

## Pricing Tiers

Distance-based base prices (monthly, SAR) — configurable via admin panel:

| Distance Range | Base Price (default) |
|----------------|----------------------|
| 0–5 km         | 500 SAR              |
| 5–10 km        | 800 SAR              |
| 10–15 km       | 1,000 SAR            |
| 15–20 km       | 1,200 SAR            |
| 20–25 km       | 1,400 SAR            |
| 25–30 km       | 1,700 SAR            |
| 30–40 km       | 2,200 SAR            |
| > 40 km        | Requires admin review |

## Multipliers

### Trip Type
- **One-way**: ×1.0
- **Round trip**: ×1.7

### Working Days per Week
- **1–5 days**: ×1.0
- **6 days**: ×1.15
- **7 days**: ×1.25

### Sharing Discount (per person) — configurable via admin panel
| People sharing | Discount factor | Price vs. solo |
|---------------|-----------------|----------------|
| 1 person       | 100% (×1.00)   | full price     |
| 2 people       | 72%  (×0.72)   | −28%           |
| 3 people       | 60%  (×0.60)   | −40%           |
| 4 people       | 52%  (×0.52)   | −48%           |

**Price formula:**
```
pricePerPerson = baseTier × tripMultiplier × daysMultiplier × shareDiscountFactor
price (total)  = pricePerPerson × numberOfPeople
```

## Examples

### Example 1: Solo Subscription
```typescript
// 4km, one-way, 5 days/week, 1 person
const result = calculateMonthlyPrice(4, "one_way", 5, 1);
// pricePerPerson: 500 SAR (500 × 1.0 × 1.0 × 1.0)
// price: 500 SAR
```

### Example 2: Shared Subscription (2 people)
```typescript
// 25km, round-trip, 5 days/week, 2 people sharing
const result = calculateMonthlyPrice(25, "round_trip", 5, 2);
// pricePerPerson: 1,008 SAR (1,400 × 1.7 × 1.0 × 0.72)
// price: 2,016 SAR total
```

### Example 3: Admin Review Required
```typescript
// 45km (exceeds 40km limit)
const result = calculateMonthlyPrice(45, "one_way", 5, 1);
// { needsAdminReview: true, price: 0, pricePerPerson: 0 }
```

### Example 4: Custom Config (DB-driven)
```typescript
const config = await fetchPricingConfigFromDb();
const result = calculateMonthlyPrice(12, "one_way", 5, 1, config);
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
