-- =====================================================================
-- Migration 031 — Fix pricing_matrix monetary columns: real → numeric
--
-- Context: pricePerPerson and price_sar were stored as REAL (float4),
-- which causes floating-point rounding errors on financial values.
-- This migration converts them to NUMERIC(10,2) for exact precision.
-- Distance columns (distance_min_km, distance_max_km) are also
-- converted to NUMERIC(8,2) for consistency.
-- =====================================================================

-- Distance columns
ALTER TABLE public.pricing_matrix
  ALTER COLUMN distance_min_km TYPE NUMERIC(8,2)
    USING distance_min_km::NUMERIC(8,2);

ALTER TABLE public.pricing_matrix
  ALTER COLUMN distance_max_km TYPE NUMERIC(8,2)
    USING distance_max_km::NUMERIC(8,2);

-- Price columns
ALTER TABLE public.pricing_matrix
  ALTER COLUMN price_per_person TYPE NUMERIC(10,2)
    USING price_per_person::NUMERIC(10,2);

ALTER TABLE public.pricing_matrix
  ALTER COLUMN price_sar TYPE NUMERIC(10,2)
    USING price_sar::NUMERIC(10,2);
