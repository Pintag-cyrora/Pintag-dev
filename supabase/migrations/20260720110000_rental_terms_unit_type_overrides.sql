-- Extends unit_types with the same Rental Terms columns added to
-- properties in 20260720100000_rental_terms.sql, so a multi-unit building's
-- per-variant listings (Studio/1BR/2BR/...) can override the building's own
-- Rental Terms exactly the way they already override price/bedrooms/
-- bathrooms/sqm/etc. -- see resolveUnitType() in terminology.js, the ONE
-- resolver every consumer must call, extended in this same change to pick()
-- each of these columns.
--
-- Every column is nullable, and null means "inherit the building's own
-- value" -- identical convention to every other unit_types column (see the
-- comment on the unit_types table itself in 20260720000000_unit_types.sql).
-- A unit type therefore only needs to set the fields that genuinely differ
-- from the building (e.g. a larger unit with a higher deposit, or the one
-- ground-floor unit where pets aren't allowed) -- everything else falls
-- back to the building's own Rental Terms automatically.
--
-- Do NOT wire these into admin.html's per-unit-type override UI until this
-- migration has actually been applied -- same PostgREST unknown-column
-- rule as every other migration in this set.

ALTER TABLE unit_types
  -- Pricing
  ADD COLUMN IF NOT EXISTS security_deposit      numeric,
  ADD COLUMN IF NOT EXISTS security_deposit_note  text,
  ADD COLUMN IF NOT EXISTS advance_rent_months    integer,
  ADD COLUMN IF NOT EXISTS lease_term_min         text,
  ADD COLUMN IF NOT EXISTS lease_term_min_custom  text,

  -- Utilities
  ADD COLUMN IF NOT EXISTS electricity_terms      text,
  ADD COLUMN IF NOT EXISTS electricity_fee_note   text,
  ADD COLUMN IF NOT EXISTS water_terms            text,
  ADD COLUMN IF NOT EXISTS water_fee_note         text,
  ADD COLUMN IF NOT EXISTS internet_terms         text,
  ADD COLUMN IF NOT EXISTS internet_note          text,
  ADD COLUMN IF NOT EXISTS trash_terms            text,
  ADD COLUMN IF NOT EXISTS trash_note             text,

  -- Included Services
  ADD COLUMN IF NOT EXISTS cleaning_service       text,
  ADD COLUMN IF NOT EXISTS cleaning_service_note  text,
  ADD COLUMN IF NOT EXISTS linen_change           text,
  ADD COLUMN IF NOT EXISTS linen_change_note      text,
  ADD COLUMN IF NOT EXISTS included_services      jsonb,

  -- Pet Policy
  ADD COLUMN IF NOT EXISTS pet_policy             text,
  ADD COLUMN IF NOT EXISTS pet_policy_note        text,

  -- Additional Fees
  ADD COLUMN IF NOT EXISTS key_deposit            numeric,
  ADD COLUMN IF NOT EXISTS cleaning_fee           numeric,
  ADD COLUMN IF NOT EXISTS administration_fee     numeric;

-- Same enum guardrails as properties' own Rental Terms columns (NULL always
-- satisfies a CHECK, so "inherit" is unaffected). DROP-then-ADD is safe to
-- re-run.
ALTER TABLE unit_types DROP CONSTRAINT IF EXISTS unit_types_lease_term_min_check;
ALTER TABLE unit_types ADD CONSTRAINT unit_types_lease_term_min_check
  CHECK (lease_term_min IN ('month_to_month','3_months','6_months','12_months','24_months','custom'));

ALTER TABLE unit_types DROP CONSTRAINT IF EXISTS unit_types_electricity_terms_check;
ALTER TABLE unit_types ADD CONSTRAINT unit_types_electricity_terms_check
  CHECK (electricity_terms IN ('included','government_meter','fixed_fee','custom'));

ALTER TABLE unit_types DROP CONSTRAINT IF EXISTS unit_types_water_terms_check;
ALTER TABLE unit_types ADD CONSTRAINT unit_types_water_terms_check
  CHECK (water_terms IN ('included','government_meter','fixed_fee','custom'));

ALTER TABLE unit_types DROP CONSTRAINT IF EXISTS unit_types_internet_terms_check;
ALTER TABLE unit_types ADD CONSTRAINT unit_types_internet_terms_check
  CHECK (internet_terms IN ('included','available_tenant_pays','not_available','custom'));

ALTER TABLE unit_types DROP CONSTRAINT IF EXISTS unit_types_trash_terms_check;
ALTER TABLE unit_types ADD CONSTRAINT unit_types_trash_terms_check
  CHECK (trash_terms IN ('included','extra_fee','not_included','custom'));

ALTER TABLE unit_types DROP CONSTRAINT IF EXISTS unit_types_cleaning_service_check;
ALTER TABLE unit_types ADD CONSTRAINT unit_types_cleaning_service_check
  CHECK (cleaning_service IN ('none','1x_week','2x_week','3x_week','daily','custom'));

ALTER TABLE unit_types DROP CONSTRAINT IF EXISTS unit_types_linen_change_check;
ALTER TABLE unit_types ADD CONSTRAINT unit_types_linen_change_check
  CHECK (linen_change IN ('none','weekly','twice_weekly','daily','custom'));

ALTER TABLE unit_types DROP CONSTRAINT IF EXISTS unit_types_pet_policy_check;
ALTER TABLE unit_types ADD CONSTRAINT unit_types_pet_policy_check
  CHECK (pet_policy IN ('pets_allowed','cats_only','small_pets_only','no_pets','custom'));

COMMENT ON COLUMN unit_types.security_deposit      IS 'Per-unit-type override of properties.security_deposit; NULL inherits the building value.';
COMMENT ON COLUMN unit_types.security_deposit_note  IS 'Per-unit-type override of properties.security_deposit_note; NULL inherits the building value.';
COMMENT ON COLUMN unit_types.advance_rent_months    IS 'Per-unit-type override of properties.advance_rent_months; NULL inherits the building value.';
COMMENT ON COLUMN unit_types.lease_term_min         IS 'Per-unit-type override of properties.lease_term_min; NULL inherits the building value.';
COMMENT ON COLUMN unit_types.lease_term_min_custom  IS 'Per-unit-type override of properties.lease_term_min_custom; NULL inherits the building value.';
COMMENT ON COLUMN unit_types.electricity_terms      IS 'Per-unit-type override of properties.electricity_terms; NULL inherits the building value.';
COMMENT ON COLUMN unit_types.electricity_fee_note   IS 'Per-unit-type override of properties.electricity_fee_note; NULL inherits the building value.';
COMMENT ON COLUMN unit_types.water_terms            IS 'Per-unit-type override of properties.water_terms; NULL inherits the building value.';
COMMENT ON COLUMN unit_types.water_fee_note         IS 'Per-unit-type override of properties.water_fee_note; NULL inherits the building value.';
COMMENT ON COLUMN unit_types.internet_terms         IS 'Per-unit-type override of properties.internet_terms; NULL inherits the building value.';
COMMENT ON COLUMN unit_types.internet_note          IS 'Per-unit-type override of properties.internet_note; NULL inherits the building value.';
COMMENT ON COLUMN unit_types.trash_terms            IS 'Per-unit-type override of properties.trash_terms; NULL inherits the building value.';
COMMENT ON COLUMN unit_types.trash_note             IS 'Per-unit-type override of properties.trash_note; NULL inherits the building value.';
COMMENT ON COLUMN unit_types.cleaning_service       IS 'Per-unit-type override of properties.cleaning_service; NULL inherits the building value.';
COMMENT ON COLUMN unit_types.cleaning_service_note  IS 'Per-unit-type override of properties.cleaning_service_note; NULL inherits the building value.';
COMMENT ON COLUMN unit_types.linen_change           IS 'Per-unit-type override of properties.linen_change; NULL inherits the building value.';
COMMENT ON COLUMN unit_types.linen_change_note      IS 'Per-unit-type override of properties.linen_change_note; NULL inherits the building value.';
COMMENT ON COLUMN unit_types.included_services      IS 'Per-unit-type override of properties.included_services; NULL inherits the building value (not merged -- a non-null override fully replaces the building''s list for this unit type).';
COMMENT ON COLUMN unit_types.pet_policy             IS 'Per-unit-type override of properties.pet_policy; NULL inherits the building value.';
COMMENT ON COLUMN unit_types.pet_policy_note        IS 'Per-unit-type override of properties.pet_policy_note; NULL inherits the building value.';
COMMENT ON COLUMN unit_types.key_deposit            IS 'Per-unit-type override of properties.key_deposit; NULL inherits the building value.';
COMMENT ON COLUMN unit_types.cleaning_fee           IS 'Per-unit-type override of properties.cleaning_fee; NULL inherits the building value.';
COMMENT ON COLUMN unit_types.administration_fee     IS 'Per-unit-type override of properties.administration_fee; NULL inherits the building value.';
