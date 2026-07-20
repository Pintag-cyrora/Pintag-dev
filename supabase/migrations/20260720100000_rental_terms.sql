-- Rental Terms: structured pricing/utilities/services/pet-policy fields for
-- Apartment and Condo listings (terminology.js: RENTAL_TERMS_FIELDS /
-- PROPERTY_TYPE_RENTAL_TERMS). Additive only, same convention as
-- 20260709000000_land_specific_fields.sql -- every column is nullable, so
-- every existing row and every non-apartment/condo listing is completely
-- unaffected.
--
-- Do NOT wire these columns into terminology.js's PROPERTY_TYPE_RENTAL_TERMS
-- until this migration has actually been applied to whichever database the
-- running code talks to -- PostgREST rejects insert/update payloads that
-- reference unknown columns, so shipping code that references e.g.
-- security_deposit before the column exists would break saving every
-- Apartment/Condo listing.
--
-- Each dropdown field pairs with a "<field>_note" free-text column that
-- only applies for that dropdown's Custom (and, where offered, Fixed
-- Monthly Fee / Extra Fee) option -- see terminology.js's `showWhen` on the
-- matching field def, which both shows and hides that input in the form
-- and blanks it in the save payload when the parent dropdown isn't set to
-- one of those values. A stored note therefore always has a dropdown value
-- that explains it.
--
-- included_services is a jsonb array of registry keys (parking, security,
-- reception, swimming_pool, gym, garden_maintenance, pool_maintenance),
-- same convention as properties.land_best_use -- a multi-select rendered as
-- a checkbox group via optionsToRegistry(), not a set of individual boolean
-- columns, so adding/removing an option later is a terminology.js-only
-- change.
--
-- Indexes below anticipate the "Future Filtering Support" fields called out
-- in the Rental Terms product spec (Electricity/Water/Internet Included,
-- Cleaning Service, Parking Included, Gym, Swimming Pool, Pets Allowed,
-- Deposit Amount, Minimum Lease Length) -- filters can query these columns
-- directly without a further migration.

ALTER TABLE properties
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

-- Enum-style guardrails, matching the CHECK-constraint convention already
-- used for road_surface/land_category/etc. A plain `CHECK (col IN (...))`
-- already permits NULL, so these don't block the "field not applicable"
-- case. DROP-then-ADD makes this safe to re-run.
ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_lease_term_min_check;
ALTER TABLE properties ADD CONSTRAINT properties_lease_term_min_check
  CHECK (lease_term_min IN ('month_to_month','3_months','6_months','12_months','24_months','custom'));

ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_electricity_terms_check;
ALTER TABLE properties ADD CONSTRAINT properties_electricity_terms_check
  CHECK (electricity_terms IN ('included','government_meter','fixed_fee','custom'));

ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_water_terms_check;
ALTER TABLE properties ADD CONSTRAINT properties_water_terms_check
  CHECK (water_terms IN ('included','government_meter','fixed_fee','custom'));

ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_internet_terms_check;
ALTER TABLE properties ADD CONSTRAINT properties_internet_terms_check
  CHECK (internet_terms IN ('included','available_tenant_pays','not_available','custom'));

ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_trash_terms_check;
ALTER TABLE properties ADD CONSTRAINT properties_trash_terms_check
  CHECK (trash_terms IN ('included','extra_fee','not_included','custom'));

ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_cleaning_service_check;
ALTER TABLE properties ADD CONSTRAINT properties_cleaning_service_check
  CHECK (cleaning_service IN ('none','1x_week','2x_week','3x_week','daily','custom'));

ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_linen_change_check;
ALTER TABLE properties ADD CONSTRAINT properties_linen_change_check
  CHECK (linen_change IN ('none','weekly','twice_weekly','daily','custom'));

ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_pet_policy_check;
ALTER TABLE properties ADD CONSTRAINT properties_pet_policy_check
  CHECK (pet_policy IN ('pets_allowed','cats_only','small_pets_only','no_pets','custom'));

COMMENT ON COLUMN properties.security_deposit     IS 'Security deposit amount in USD (Apartment/Condo rentals). Future filter: Deposit Amount.';
COMMENT ON COLUMN properties.security_deposit_note IS 'Optional free-text helper, e.g. "1 month''s rent", shown alongside the amount.';
COMMENT ON COLUMN properties.advance_rent_months   IS 'Number of months of rent required in advance.';
COMMENT ON COLUMN properties.lease_term_min        IS 'month_to_month | 3_months | 6_months | 12_months | 24_months | custom. Future filter: Minimum Lease Length.';
COMMENT ON COLUMN properties.lease_term_min_custom IS 'Free-text lease term, only applies when lease_term_min = ''custom''.';

COMMENT ON COLUMN properties.electricity_terms    IS 'included | government_meter | fixed_fee | custom. Future filter: Electricity Included.';
COMMENT ON COLUMN properties.electricity_fee_note  IS 'Fee amount/description, only applies when electricity_terms is fixed_fee or custom.';
COMMENT ON COLUMN properties.water_terms           IS 'included | government_meter | fixed_fee | custom. Future filter: Water Included.';
COMMENT ON COLUMN properties.water_fee_note        IS 'Fee amount/description, only applies when water_terms is fixed_fee or custom.';
COMMENT ON COLUMN properties.internet_terms        IS 'included | available_tenant_pays | not_available | custom. Future filter: Internet Included.';
COMMENT ON COLUMN properties.internet_note         IS 'Free-text description, only applies when internet_terms = ''custom''.';
COMMENT ON COLUMN properties.trash_terms           IS 'included | extra_fee | not_included | custom.';
COMMENT ON COLUMN properties.trash_note            IS 'Fee amount/description, only applies when trash_terms is extra_fee or custom.';

COMMENT ON COLUMN properties.cleaning_service      IS 'none | 1x_week | 2x_week | 3x_week | daily | custom. Future filter: Cleaning Service.';
COMMENT ON COLUMN properties.cleaning_service_note IS 'Free-text description, only applies when cleaning_service = ''custom''.';
COMMENT ON COLUMN properties.linen_change          IS 'none | weekly | twice_weekly | daily | custom.';
COMMENT ON COLUMN properties.linen_change_note     IS 'Free-text description, only applies when linen_change = ''custom''.';
COMMENT ON COLUMN properties.included_services     IS 'Multi-select JSON array of included-service keys: parking, security, reception, swimming_pool, gym, garden_maintenance, pool_maintenance. Future filters: Parking Included, Gym, Swimming Pool.';

COMMENT ON COLUMN properties.pet_policy            IS 'pets_allowed | cats_only | small_pets_only | no_pets | custom. Future filter: Pets Allowed.';
COMMENT ON COLUMN properties.pet_policy_note        IS 'Free-text description, only applies when pet_policy = ''custom''.';

COMMENT ON COLUMN properties.key_deposit           IS 'Optional one-time key deposit amount in USD.';
COMMENT ON COLUMN properties.cleaning_fee          IS 'Optional one-time or recurring cleaning fee amount in USD.';
COMMENT ON COLUMN properties.administration_fee    IS 'Optional administration/processing fee amount in USD.';

-- Future Filtering Support: btree indexes on the enum/numeric columns most
-- likely to become search filters, GIN on the jsonb multi-select. Cheap to
-- carry now (all nullable, low cardinality) and means adding those filters
-- later is a query-only change, no further migration.
CREATE INDEX IF NOT EXISTS idx_properties_electricity_terms ON properties(electricity_terms) WHERE electricity_terms IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_water_terms       ON properties(water_terms)       WHERE water_terms IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_internet_terms    ON properties(internet_terms)    WHERE internet_terms IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_cleaning_service  ON properties(cleaning_service)  WHERE cleaning_service IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_pet_policy        ON properties(pet_policy)        WHERE pet_policy IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_lease_term_min    ON properties(lease_term_min)    WHERE lease_term_min IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_security_deposit  ON properties(security_deposit)  WHERE security_deposit IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_included_services ON properties USING gin(included_services);
