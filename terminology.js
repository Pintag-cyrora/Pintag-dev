// terminology.js — shared terminology registry, used by admin.html,
// add-property.html, edit-listing.html, and (via PROPERTY_TYPE_DISPLAY
// below) listing.html, listings.html, and index.html. Same convention as
// amenities.js: plain global vars, no build step, loaded via
// <script src="terminology.js"> before each page's own inline <script>.
//
// isMultiUnitBuilding()/resolveUnitType() near the bottom of this file are
// the Multi-Unit Buildings (Phase 1) resolver — see
// supabase/migrations/20260720000000_unit_types.sql.
//
// PROPERTY_TYPES is the single source of truth for property-type labels
// (English/Lao/Chinese) — do not hardcode these strings elsewhere.
//
// PROPERTY_TYPE_FIELDS drives the "Property Details" section of the
// listing form: which fields are relevant for a given property type, so
// the form can be rendered from this schema instead of showing every
// field for every type (e.g. Land never shows Bedrooms/Bathrooms).
//
// PHASE 1 SCOPE (house/townhouse/villa/apartment/condo/commercial): every
// field maps to a column that already exists and is already wired
// end-to-end (bedrooms, bathrooms, sqm, sqm_land, floors, year_built,
// parking_spaces, furnished), or references a filtered subset of the
// existing FEATURES/AMENITIES registries via kind:'checkbox_ref'
// (pool/garden/balcony/elevator etc. stay as checkboxes there — they are
// NOT duplicated as new columns here).
//
// PHASE 2 (land — wired in below as of the
// 20260709000000_land_specific_fields.sql migration): land_width_m,
// land_length_m, road_frontage_m, road_width_m, road_surface,
// land_category, land_shape, land_terrain, existing_structure, and
// land_best_use. IMPORTANT: this migration must actually be applied to
// whichever database the running code talks to (pintag-dev, then
// production, each its own explicit step) BEFORE this file is deployed
// there — PostgREST rejects save payloads that reference unknown columns,
// so deploying this code ahead of the migration would break saving every
// Land listing.
//
// Still not yet implemented: apartment/condo floor_number + maintenance_fee
// + building_facilities, commercial main_road_access. Same rule applies —
// don't add fields referencing these until their own migration has been
// applied where the code will run.
//
// Two of Land's fields deliberately answer different questions:
//   land_category — the land's current legal/primary categorization
//                    (residential/commercial/agricultural/industrial/
//                    mixed_use). What it legally/primarily IS today.
//   land_best_use  — buyer-facing development potential, multi-select
//                    (apartment_development/villa/warehouse/retail/resort/
//                    investment). What a buyer COULD do with it. A lot
//                    categorized "residential" today can still be an
//                    excellent Apartment Development opportunity.
//
// Adding a future property type (Warehouse, Hotel, Office, Factory) means
// adding one new entry to each of these two objects — no changes to any
// form's HTML or to the render/save/load functions that consume them.

var PROPERTY_TYPES = {
  house:      {en:'House',      lo:'ເຮືອນ',        zh:'独栋别墅'},
  townhouse:  {en:'Townhouse',  lo:'ທາວເຮົາສ໌',    zh:'联排别墅'},
  villa:      {en:'Villa',      lo:'ວິນລ່າ',        zh:'别墅'},
  apartment:  {en:'Apartment',  lo:'ອາພາດເມັນ',    zh:'公寓'},
  condo:      {en:'Condo',      lo:'ຄອນໂດ',        zh:'公寓楼'},
  commercial: {en:'Commercial', lo:'ອາຄານພານິດ',   zh:'商业地产'},
  land:       {en:'Land',       lo:'ທີ່ດິນ',        zh:'土地'}
};

// Shared option lists reused by multiple types' `furnished` field.
var FURNISHED_OPTIONS = [
  {value:'',            label:{en:'Not specified',       lo:'ບໍ່ໄດ້ລະບຸ',            zh:'未指定'}},
  {value:'fully',       label:{en:'Fully Furnished',      lo:'ມີເຄື່ອງເຟີນີເຈີຄົບ',   zh:'全套家具'}},
  {value:'partially',   label:{en:'Partially Furnished',  lo:'ມີເຄື່ອງເຟີນີເຈີບາງສ່ວນ', zh:'部分家具'}},
  {value:'unfurnished', label:{en:'Unfurnished',          lo:'ບໍ່ມີເຄື່ອງເຟີນີເຈີ',    zh:'无家具'}}
];

function _bedrooms(placeholder)  { return {id:'f-bedrooms',       column:'bedrooms',       kind:'number', label:{en:'Bedrooms',lo:'ຫ້ອງນອນ',zh:'卧室'},       min:0, placeholder:placeholder||'4'}; }
function _bathrooms(placeholder) { return {id:'f-bathrooms',      column:'bathrooms',      kind:'number', label:{en:'Bathrooms',lo:'ຫ້ອງນ້ຳ',zh:'浴室'},      min:0, placeholder:placeholder||'4'}; }
function _sqm(label, placeholder){ return {id:'f-sqm',            column:'sqm',            kind:'number', label:label,                                       min:0, placeholder:placeholder||'420'}; }
function _sqmLand(placeholder)   { return {id:'f-sqm-land',       column:'sqm_land',       kind:'number', label:{en:'Land Size (sqm)',lo:'ເນື້ອທີ່ດິນ (ຕາລາງແມັດ)',zh:'土地面积(平方米)'}, min:0, placeholder:placeholder||'720'}; }
function _floors(placeholder)    { return {id:'f-floors',         column:'floors',         kind:'number', label:{en:'Floors',lo:'ຊັ້ນ',zh:'楼层数'},           min:1, placeholder:placeholder||'2'}; }
function _yearBuilt()            { return {id:'f-year-built',     column:'year_built',     kind:'number', label:{en:'Year Built',lo:'ປີກໍ່ສ້າງ',zh:'建成年份'}, min:1950, max:2035, placeholder:'2022'}; }
function _parkingSpaces()        { return {id:'f-parking-spaces', column:'parking_spaces', kind:'number', label:{en:'Parking Spaces',lo:'ບ່ອນຈອດລົດ',zh:'停车位'}, min:0, placeholder:'2'}; }
function _furnished()            { return {id:'f-furnished',      column:'furnished',      kind:'select', label:{en:'Furnished',lo:'ເຄື່ອງເຟີນີເຈີ',zh:'装修情况'}, options:FURNISHED_OPTIONS}; }
function _featuresRef(keys)      { return {id:'f-features-check',  kind:'checkbox_ref', registry:'FEATURES',  keys:keys}; }
function _amenitiesRef(keys)     { return {id:'f-amenities-check', kind:'checkbox_ref', registry:'AMENITIES', keys:keys}; }

// ── Land-specific fields (Phase 2) ─────────────────────────────────────
// Lao translations below are a best-effort first pass, not sourced from an
// existing glossary — worth a native-speaker review pass before this goes
// live, same caveat noted for "Commercial" in PROPERTY_TYPES above.
function _landWidth()    { return {id:'f-land-width',    column:'land_width_m',    kind:'number', label:{en:'Width (m)',  lo:'ຄວາມກວ້າງ (ແມັດ)', zh:'宽度(米)'}, min:0, placeholder:'20'}; }
function _landLength()   { return {id:'f-land-length',   column:'land_length_m',   kind:'number', label:{en:'Length (m)', lo:'ຄວາມຍາວ (ແມັດ)',   zh:'长度(米)'}, min:0, placeholder:'30'}; }
function _roadFrontage() { return {id:'f-road-frontage', column:'road_frontage_m', kind:'number', label:{en:'Road Frontage (m)', lo:'ໜ້າຕິດຖະໜົນ (ແມັດ)', zh:'临路面宽(米)'}, min:0, placeholder:'12'}; }
function _roadWidth()    { return {id:'f-road-width',    column:'road_width_m',    kind:'number', label:{en:'Road Width (m)',    lo:'ຄວາມກວ້າງຖະໜົນ (ແມັດ)', zh:'道路宽度(米)'}, min:0, placeholder:'6'}; }

var ROAD_SURFACE_OPTIONS = [
  {value:'',         label:{en:'Not specified', lo:'ບໍ່ໄດ້ລະບຸ',   zh:'未指定'}},
  {value:'asphalt',  label:{en:'Asphalt',       lo:'ຢາງມະຕອຍ',    zh:'沥青'}},
  {value:'concrete', label:{en:'Concrete',      lo:'ຄອນກຣີດ',     zh:'混凝土'}},
  {value:'gravel',   label:{en:'Gravel',        lo:'ຫີນກ້ອນ',     zh:'碎石'}},
  {value:'dirt',     label:{en:'Dirt',          lo:'ດິນ',         zh:'土路'}}
];
function _roadSurface() { return {id:'f-road-surface', column:'road_surface', kind:'select', label:{en:'Road Surface', lo:'ຜິວໜ້າຖະໜົນ', zh:'路面材质'}, options:ROAD_SURFACE_OPTIONS}; }

// Land Category: the land's current legal/primary categorization —
// distinct from Best Use (below), which is buyer-facing development
// potential. See the file-level comment above for why both exist.
var LAND_CATEGORY_OPTIONS = [
  {value:'',             label:{en:'Not specified', lo:'ບໍ່ໄດ້ລະບຸ',       zh:'未指定'}},
  {value:'residential',  label:{en:'Residential',   lo:'ທີ່ດິນທີ່ຢູ່ອາໄສ',  zh:'住宅用地'}},
  {value:'commercial',   label:{en:'Commercial',    lo:'ທີ່ດິນທຸລະກິດ',    zh:'商业用地'}},
  {value:'agricultural', label:{en:'Agricultural',  lo:'ທີ່ດິນກະສິກຳ',     zh:'农业用地'}},
  {value:'industrial',   label:{en:'Industrial',    lo:'ທີ່ດິນອຸດສາຫະກຳ',  zh:'工业用地'}},
  {value:'mixed_use',    label:{en:'Mixed Use',     lo:'ທີ່ດິນປະສົມປະສານ', zh:'综合用地'}}
];
function _landCategory() { return {id:'f-land-category', column:'land_category', kind:'select', label:{en:'Land Category', lo:'ໝວດໝູ່ທີ່ດິນ', zh:'土地类别'}, options:LAND_CATEGORY_OPTIONS}; }

var LAND_SHAPE_OPTIONS = [
  {value:'',           label:{en:'Not specified', lo:'ບໍ່ໄດ້ລະບຸ',           zh:'未指定'}},
  {value:'rectangle',  label:{en:'Rectangle',     lo:'ສີ່ຫລ່ຽມຜືນຜ້າ',       zh:'长方形'}},
  {value:'square',     label:{en:'Square',        lo:'ສີ່ຫລ່ຽມຈັດຕຸລັດ',     zh:'正方形'}},
  {value:'corner_lot', label:{en:'Corner Lot',    lo:'ທີ່ດິນມູມ',           zh:'转角地块'}},
  {value:'triangle',   label:{en:'Triangle',      lo:'ສາມຫລ່ຽມ',           zh:'三角形'}},
  {value:'irregular',  label:{en:'Irregular',     lo:'ບໍ່ເປັນຮູບຊົງແນ່ນອນ',  zh:'不规则形'}}
];
function _landShape() { return {id:'f-land-shape', column:'land_shape', kind:'select', label:{en:'Shape', lo:'ຮູບຊົງ', zh:'形状'}, options:LAND_SHAPE_OPTIONS}; }

var LAND_TERRAIN_OPTIONS = [
  {value:'',              label:{en:'Not specified', lo:'ບໍ່ໄດ້ລະບຸ',              zh:'未指定'}},
  {value:'flat',          label:{en:'Flat',          lo:'ພື້ນທີ່ພຽງ',              zh:'平坦'}},
  {value:'slight_slope',  label:{en:'Slight Slope',  lo:'ພື້ນທີ່ມີຄວາມຊັນເລັກນ້ອຍ', zh:'轻微坡度'}},
  {value:'hillside',      label:{en:'Hillside',      lo:'ພື້ນທີ່ເນີນພູ',           zh:'山坡地'}},
  {value:'filled',        label:{en:'Filled',        lo:'ດິນຖົມແລ້ວ',             zh:'已填土'}},
  {value:'needs_filling', label:{en:'Needs Filling', lo:'ຕ້ອງການຖົມດິນ',          zh:'需要填土'}}
];
function _landTerrain() { return {id:'f-land-terrain', column:'land_terrain', kind:'select', label:{en:'Terrain', lo:'ສະພາບພື້ນທີ່', zh:'地形'}, options:LAND_TERRAIN_OPTIONS}; }

var EXISTING_STRUCTURE_OPTIONS = [
  {value:'',                    label:{en:'Not specified',       lo:'ບໍ່ໄດ້ລະບຸ',    zh:'未指定'}},
  {value:'vacant_land',         label:{en:'Vacant Land',         lo:'ທີ່ດິນຫວ່າງ',   zh:'空地'}},
  {value:'old_house',          label:{en:'Old House',           lo:'ເຮືອນເກົ່າ',    zh:'旧房屋'}},
  {value:'warehouse',           label:{en:'Warehouse',           lo:'ໂກດັງ',        zh:'仓库'}},
  {value:'commercial_building', label:{en:'Commercial Building', lo:'ອາຄານພານິດ',   zh:'商业建筑'}},
  {value:'farm_building',       label:{en:'Farm Building',       lo:'ອາຄານກະສິກຳ',  zh:'农场建筑'}}
];
function _existingStructure() { return {id:'f-existing-structure', column:'existing_structure', kind:'select', label:{en:'Existing Structure', lo:'ສິ່ງກໍ່ສ້າງທີ່ມີຢູ່', zh:'现有建筑物'}, options:EXISTING_STRUCTURE_OPTIONS}; }

// Best Use: buyer-facing development potential, multi-select — deliberately
// separate from land_category above (see file-level comment). Rendered as
// a checkbox group (kind:'multi_checkbox'), not a native <select multiple>,
// for the same mobile-friendliness reason FEATURES/AMENITIES use checkboxes.
var BEST_USE_OPTIONS = [
  {value:'apartment_development', label:{en:'Apartment Development', lo:'ພັດທະນາອາພາດເມັນ',   zh:'公寓开发'}},
  {value:'villa',                 label:{en:'Villa',                 lo:'ວິນລ່າ',              zh:'别墅'}},
  {value:'warehouse',             label:{en:'Warehouse',             lo:'ໂກດັງ',               zh:'仓库'}},
  {value:'retail',                label:{en:'Retail',                lo:'ຮ້ານຄ້າຍ່ອຍ',          zh:'零售'}},
  {value:'resort',                label:{en:'Resort',                lo:'ຣີສອດ',               zh:'度假村'}},
  {value:'investment',            label:{en:'Investment',            lo:'ການລົງທຶນ',            zh:'投资'}}
];
function _bestUse() { return {id:'f-best-use', column:'land_best_use', kind:'multi_checkbox', label:{en:'Best Use', lo:'ການນຳໃຊ້ທີ່ດີທີ່ສຸດ', zh:'最佳用途'}, options:BEST_USE_OPTIONS}; }

// ── Rental Terms (Phase 3 — apartment/condo) ───────────────────────────
// Structured pricing/utilities/services/pet-policy fields, kept in their
// own registry rather than merged into PROPERTY_TYPE_FIELDS above, because
// they render as a grouped "Rental Terms" section with subheadings
// (`section`) and a few conditional companion fields, neither of which the
// generic Property Details grid supports.
//
// `section` groups a field under one of RENTAL_TERMS_SECTIONS' subheadings.
// `showWhen: {parent: '<field id>', values: [...]}` means: only show this
// field (and only save it) when the named parent field's current value is
// one of `values` — used for the utility fixed-fee/extra-fee amounts and
// every dropdown's Custom note.
//
// Requires the 20260720100000_rental_terms.sql migration applied first —
// same rule as Land's Phase 2 fields above: don't wire a field here before
// its column exists, PostgREST rejects unknown-column payloads outright.
var MIN_LEASE_TERM_OPTIONS = [
  {value:'',              label:{en:'Not specified',  lo:'ບໍ່ໄດ້ລະບຸ',      zh:'未指定'}},
  {value:'month_to_month',label:{en:'Month-to-month', lo:'ເດືອນຕໍ່ເດືອນ',   zh:'按月'}},
  {value:'3_months',      label:{en:'3 months',       lo:'3 ເດືອນ',        zh:'3个月'}},
  {value:'6_months',      label:{en:'6 months',       lo:'6 ເດືອນ',        zh:'6个月'}},
  {value:'12_months',     label:{en:'12 months',      lo:'12 ເດືອນ',       zh:'12个月'}},
  {value:'24_months',     label:{en:'24 months',      lo:'24 ເດືອນ',       zh:'24个月'}},
  {value:'custom',        label:{en:'Custom',         lo:'ກຳນົດເອງ',       zh:'自定义'}}
];

var ELECTRICITY_TERMS_OPTIONS = [
  {value:'',                label:{en:'Not specified',    lo:'ບໍ່ໄດ້ລະບຸ',            zh:'未指定'}},
  {value:'included',        label:{en:'Included',         lo:'ລວມຢູ່ໃນຄ່າເຊົ່າ',      zh:'包含在租金内'}},
  {value:'government_meter',label:{en:'Government Meter', lo:'ມິເຕີລັດ',              zh:'政府电表'}},
  {value:'fixed_fee',       label:{en:'Fixed Monthly Fee',lo:'ຄ່າທຳນຽມຄົງທີ່ລາຍເດືອນ', zh:'固定月费'}},
  {value:'custom',          label:{en:'Custom',           lo:'ກຳນົດເອງ',              zh:'自定义'}}
];
// Water uses the exact same option set as Electricity — same real-world
// billing arrangements (included / government meter / fixed fee / custom).
var WATER_TERMS_OPTIONS = ELECTRICITY_TERMS_OPTIONS;

var INTERNET_TERMS_OPTIONS = [
  {value:'',                      label:{en:'Not specified',          lo:'ບໍ່ໄດ້ລະບຸ',              zh:'未指定'}},
  {value:'included',              label:{en:'Included',               lo:'ລວມຢູ່ໃນຄ່າເຊົ່າ',        zh:'包含在租金内'}},
  {value:'available_tenant_pays', label:{en:'Available (Tenant Pays)',lo:'ມີໃຫ້ (ຜູ້ເຊົ່າຈ່າຍເອງ)', zh:'可安装(租户自付)'}},
  {value:'not_available',        label:{en:'Not Available',          lo:'ບໍ່ມີ',                  zh:'不可用'}},
  {value:'custom',                label:{en:'Custom',                 lo:'ກຳນົດເອງ',               zh:'自定义'}}
];

var TRASH_TERMS_OPTIONS = [
  {value:'',             label:{en:'Not specified', lo:'ບໍ່ໄດ້ລະບຸ',       zh:'未指定'}},
  {value:'included',     label:{en:'Included',      lo:'ລວມຢູ່ໃນຄ່າເຊົ່າ', zh:'包含在租金内'}},
  {value:'extra_fee',    label:{en:'Extra Fee',     lo:'ຄ່າທຳນຽມເພີ່ມ',   zh:'额外收费'}},
  {value:'not_included', label:{en:'Not Included',  lo:'ບໍ່ລວມ',          zh:'不包含'}},
  {value:'custom',       label:{en:'Custom',        lo:'ກຳນົດເອງ',        zh:'自定义'}}
];

// Leading blank option is "not specified" (agent hasn't filled this in —
// stays hidden on the display card), distinct from the real 'none' value
// (agent explicitly recorded that no cleaning/linen service is provided —
// shown on the card, same convention as pet_policy's 'no_pets').
var CLEANING_SERVICE_OPTIONS = [
  {value:'',        label:{en:'Not specified', lo:'ບໍ່ໄດ້ລະບຸ',    zh:'未指定'}},
  {value:'none',    label:{en:'None',        lo:'ບໍ່ມີ',        zh:'无'}},
  {value:'1x_week', label:{en:'1x per week', lo:'1 ຄັ້ງ/ອາທິດ', zh:'每周1次'}},
  {value:'2x_week', label:{en:'2x per week', lo:'2 ຄັ້ງ/ອາທິດ', zh:'每周2次'}},
  {value:'3x_week', label:{en:'3x per week', lo:'3 ຄັ້ງ/ອາທິດ', zh:'每周3次'}},
  {value:'daily',   label:{en:'Daily',       lo:'ທຸກໆມື້',      zh:'每天'}},
  {value:'custom',  label:{en:'Custom',      lo:'ກຳນົດເອງ',     zh:'自定义'}}
];

var LINEN_CHANGE_OPTIONS = [
  {value:'',             label:{en:'Not specified', lo:'ບໍ່ໄດ້ລະບຸ',      zh:'未指定'}},
  {value:'none',         label:{en:'None',         lo:'ບໍ່ມີ',           zh:'无'}},
  {value:'weekly',       label:{en:'Weekly',       lo:'ລາຍອາທິດ',       zh:'每周'}},
  {value:'twice_weekly', label:{en:'Twice Weekly', lo:'ອາທິດລະ 2 ຄັ້ງ', zh:'每周两次'}},
  {value:'daily',        label:{en:'Daily',        lo:'ທຸກໆມື້',        zh:'每天'}},
  {value:'custom',       label:{en:'Custom',       lo:'ກຳນົດເອງ',       zh:'自定义'}}
];

var INCLUDED_SERVICES_OPTIONS = [
  {value:'parking',            label:{en:'Parking Included',   lo:'ລວມບ່ອນຈອດລົດ',      zh:'含停车位'}},
  {value:'security',           label:{en:'Security',           lo:'ຄວາມປອດໄພ',          zh:'安保'}},
  {value:'reception',          label:{en:'Reception',          lo:'ພະນັກງານຕ້ອນຮັບ',    zh:'前台服务'}},
  {value:'swimming_pool',      label:{en:'Swimming Pool',      lo:'ສະລອຍນ້ຳ',           zh:'游泳池'}},
  {value:'gym',                label:{en:'Gym',                lo:'ຫ້ອງອອກກຳລັງກາຍ',    zh:'健身房'}},
  {value:'garden_maintenance', label:{en:'Garden Maintenance', lo:'ບຳລຸງຮັກສາສວນ',      zh:'花园维护'}},
  {value:'pool_maintenance',   label:{en:'Pool Maintenance',   lo:'ບຳລຸງຮັກສາສະລອຍນ້ຳ', zh:'泳池维护'}}
];

var PET_POLICY_OPTIONS = [
  {value:'',               label:{en:'Not specified',   lo:'ບໍ່ໄດ້ລະບຸ',                zh:'未指定'}},
  {value:'pets_allowed',   label:{en:'Pets Allowed',    lo:'ອະນຸຍາດສັດລ້ຽງ',            zh:'允许宠物'}},
  {value:'cats_only',      label:{en:'Cats Only',       lo:'ອະນຸຍາດສະເພາະແມວ',          zh:'仅限猫咪'}},
  {value:'small_pets_only',label:{en:'Small Pets Only', lo:'ອະນຸຍາດສະເພາະສັດລ້ຽງນ້ອຍ',  zh:'仅限小型宠物'}},
  {value:'no_pets',        label:{en:'No Pets',         lo:'ບໍ່ອະນຸຍາດສັດລ້ຽງ',         zh:'不允许宠物'}},
  {value:'custom',         label:{en:'Custom',          lo:'ກຳນົດເອງ',                 zh:'自定义'}}
];

function _rtSecurityDeposit()      { return {id:'rt-security-deposit',       column:'security_deposit',      kind:'number', section:'pricing', label:{en:'Security Deposit ($)',lo:'ເງິນມັດຈຳ ($)',zh:'押金($)'}, min:0, placeholder:'300'}; }
function _rtSecurityDepositNote()  { return {id:'rt-security-deposit-note',  column:'security_deposit_note', kind:'text',   section:'pricing', label:{en:'Deposit Note',lo:'ໝາຍເຫດເງິນມັດຈຳ',zh:'押金备注'}, placeholder:"e.g. 1 month's rent"}; }
function _rtAdvanceRent()          { return {id:'rt-advance-rent',           column:'advance_rent_months',   kind:'number', section:'pricing', label:{en:'Advance Rent (months)',lo:'ຄ່າເຊົ່າລ່ວງໜ້າ (ເດືອນ)',zh:'预付租金(月)'}, min:0, placeholder:'2'}; }
function _rtMinLeaseTerm()         { return {id:'rt-lease-term-min',         column:'lease_term_min',        kind:'select', section:'pricing', label:{en:'Minimum Lease Term',lo:'ໄລຍະເຊົ່າຂັ້ນຕ່ຳ',zh:'最短租期'}, options:MIN_LEASE_TERM_OPTIONS}; }
function _rtMinLeaseTermCustom()   { return {id:'rt-lease-term-min-custom',  column:'lease_term_min_custom', kind:'text',   section:'pricing', label:{en:'Custom Lease Term',lo:'ໄລຍະເຊົ່າກຳນົດເອງ',zh:'自定义租期'}, placeholder:'e.g. 18 months', showWhen:{parent:'rt-lease-term-min', values:['custom']}}; }

function _rtElectricity()          { return {id:'rt-electricity',      column:'electricity_terms',    kind:'select', section:'utilities', label:{en:'Electricity',lo:'ໄຟຟ້າ',zh:'电费'}, options:ELECTRICITY_TERMS_OPTIONS}; }
function _rtElectricityNote()      { return {id:'rt-electricity-note', column:'electricity_fee_note', kind:'text',   section:'utilities', label:{en:'Electricity Fee / Notes',lo:'ຄ່າໄຟຟ້າ / ໝາຍເຫດ',zh:'电费/备注'}, placeholder:'e.g. $50/month', showWhen:{parent:'rt-electricity', values:['fixed_fee','custom']}}; }
function _rtWater()                { return {id:'rt-water',      column:'water_terms',    kind:'select', section:'utilities', label:{en:'Water',lo:'ນ້ຳປະປາ',zh:'水费'}, options:WATER_TERMS_OPTIONS}; }
function _rtWaterNote()            { return {id:'rt-water-note', column:'water_fee_note', kind:'text',   section:'utilities', label:{en:'Water Fee / Notes',lo:'ຄ່ານ້ຳ / ໝາຍເຫດ',zh:'水费/备注'}, placeholder:'e.g. $10/month', showWhen:{parent:'rt-water', values:['fixed_fee','custom']}}; }
function _rtInternet()             { return {id:'rt-internet',      column:'internet_terms', kind:'select', section:'utilities', label:{en:'Internet',lo:'ອິນເຕີເນັດ',zh:'网络'}, options:INTERNET_TERMS_OPTIONS}; }
function _rtInternetNote()         { return {id:'rt-internet-note', column:'internet_note',  kind:'text',   section:'utilities', label:{en:'Internet Notes',lo:'ໝາຍເຫດອິນເຕີເນັດ',zh:'网络备注'}, placeholder:'e.g. Fiber, tenant sets up own plan', showWhen:{parent:'rt-internet', values:['custom']}}; }
function _rtTrash()                { return {id:'rt-trash',      column:'trash_terms', kind:'select', section:'utilities', label:{en:'Trash Collection',lo:'ການເກັບຂີ້ເຫຍື້ອ',zh:'垃圾清运'}, options:TRASH_TERMS_OPTIONS}; }
function _rtTrashNote()            { return {id:'rt-trash-note', column:'trash_note',  kind:'text',   section:'utilities', label:{en:'Trash Fee / Notes',lo:'ຄ່າຂີ້ເຫຍື້ອ / ໝາຍເຫດ',zh:'垃圾费/备注'}, placeholder:'e.g. $5/month', showWhen:{parent:'rt-trash', values:['extra_fee','custom']}}; }

function _rtCleaningService()      { return {id:'rt-cleaning-service',       column:'cleaning_service',      kind:'select', section:'included_services', label:{en:'Cleaning Service',lo:'ບໍລິການທຳຄວາມສະອາດ',zh:'保洁服务'}, options:CLEANING_SERVICE_OPTIONS}; }
function _rtCleaningServiceNote()  { return {id:'rt-cleaning-service-note',  column:'cleaning_service_note', kind:'text',   section:'included_services', label:{en:'Cleaning Notes',lo:'ໝາຍເຫດການທຳຄວາມສະອາດ',zh:'保洁备注'}, placeholder:'e.g. every other day', showWhen:{parent:'rt-cleaning-service', values:['custom']}}; }
function _rtLinenChange()          { return {id:'rt-linen-change',           column:'linen_change',          kind:'select', section:'included_services', label:{en:'Linen Change',lo:'ການປ່ຽນຜ້າປູ',zh:'更换床单'}, options:LINEN_CHANGE_OPTIONS}; }
function _rtLinenChangeNote()      { return {id:'rt-linen-change-note',      column:'linen_change_note',     kind:'text',   section:'included_services', label:{en:'Linen Notes',lo:'ໝາຍເຫດຜ້າປູ',zh:'床单备注'}, placeholder:'e.g. bi-weekly', showWhen:{parent:'rt-linen-change', values:['custom']}}; }
function _rtIncludedServices()     { return {id:'rt-included-services', column:'included_services', kind:'multi_checkbox', section:'included_services', label:{en:'Included Services',lo:'ບໍລິການທີ່ລວມ',zh:'包含服务'}, options:INCLUDED_SERVICES_OPTIONS}; }

function _rtPetPolicy()            { return {id:'rt-pet-policy',      column:'pet_policy',      kind:'select', section:'pet_policy', label:{en:'Pet Policy',lo:'ນະໂຍບາຍສັດລ້ຽງ',zh:'宠物政策'}, options:PET_POLICY_OPTIONS}; }
function _rtPetPolicyNote()        { return {id:'rt-pet-policy-note', column:'pet_policy_note', kind:'text',   section:'pet_policy', label:{en:'Pet Policy Notes',lo:'ໝາຍເຫດນະໂຍບາຍສັດລ້ຽງ',zh:'宠物政策备注'}, placeholder:'e.g. max 1 cat under 5kg', showWhen:{parent:'rt-pet-policy', values:['custom']}}; }

function _rtKeyDeposit()  { return {id:'rt-key-deposit',  column:'key_deposit',        kind:'number', section:'additional_fees', label:{en:'Key Deposit ($)',lo:'ເງິນມັດຈຳກະແຈ ($)',zh:'钥匙押金($)'}, min:0, placeholder:'20'}; }
function _rtCleaningFee() { return {id:'rt-cleaning-fee', column:'cleaning_fee',       kind:'number', section:'additional_fees', label:{en:'Cleaning Fee ($)',lo:'ຄ່າທຳຄວາມສະອາດ ($)',zh:'清洁费($)'}, min:0, placeholder:'30'}; }
function _rtAdminFee()    { return {id:'rt-admin-fee',    column:'administration_fee', kind:'number', section:'additional_fees', label:{en:'Administration Fee ($)',lo:'ຄ່າທຳນຽມບໍລິຫານ ($)',zh:'管理费($)'}, min:0, placeholder:'25'}; }

// Subheadings the Rental Terms section is grouped into, in display order.
var RENTAL_TERMS_SECTIONS = [
  {key:'pricing',           label:{en:'Pricing',           lo:'ລາຄາ',              zh:'价格'}},
  {key:'utilities',         label:{en:'Utilities',         lo:'ສາທາລະນູປະໂພກ',      zh:'水电网'}},
  {key:'included_services', label:{en:'Included Services', lo:'ບໍລິການທີ່ລວມ',      zh:'包含服务'}},
  {key:'pet_policy',        label:{en:'Pet Policy',        lo:'ນະໂຍບາຍສັດລ້ຽງ',     zh:'宠物政策'}},
  {key:'additional_fees',   label:{en:'Additional Fees',   lo:'ຄ່າທຳນຽມເພີ່ມເຕີມ',  zh:'额外费用'}}
];

var RENTAL_TERMS_FIELDS = [
  _rtSecurityDeposit(), _rtSecurityDepositNote(), _rtAdvanceRent(), _rtMinLeaseTerm(), _rtMinLeaseTermCustom(),
  _rtElectricity(), _rtElectricityNote(), _rtWater(), _rtWaterNote(), _rtInternet(), _rtInternetNote(), _rtTrash(), _rtTrashNote(),
  _rtCleaningService(), _rtCleaningServiceNote(), _rtLinenChange(), _rtLinenChangeNote(), _rtIncludedServices(),
  _rtPetPolicy(), _rtPetPolicyNote(),
  _rtKeyDeposit(), _rtCleaningFee(), _rtAdminFee()
];

// Which property types show the Rental Terms section — apartment/condo
// only, per product scope. Extending coverage to another type later is a
// one-line addition here (the render/populate/save functions are generic
// over whatever this map contains).
var PROPERTY_TYPE_RENTAL_TERMS = {
  apartment: RENTAL_TERMS_FIELDS,
  condo:     RENTAL_TERMS_FIELDS
};

function _findRentalFieldDef(fieldId) {
  for (var i = 0; i < RENTAL_TERMS_FIELDS.length; i++) {
    if (RENTAL_TERMS_FIELDS[i].id === fieldId) return RENTAL_TERMS_FIELDS[i];
  }
  return null;
}

// Resolves one Rental Terms field, plus its optional showWhen-linked note
// field, into a single display string, e.g. "Fixed Monthly Fee — $50/month".
// Reuses resolveFieldDisplayValue() (defined below) for the actual
// select/plain-value formatting so this stays a thin combinator, not a
// second value-formatting implementation.
function _rentalFactValue(fieldId, noteFieldId, row, lang) {
  var def = _findRentalFieldDef(fieldId);
  if (!def) return null;
  var val = resolveFieldDisplayValue(def, row, lang);
  if (val === null) return null;
  if (noteFieldId) {
    var noteDef = _findRentalFieldDef(noteFieldId);
    var noteVal = noteDef ? resolveFieldDisplayValue(noteDef, row, lang) : null;
    if (noteVal) val = val + ' — ' + noteVal;
  }
  return val;
}

// Rental Terms card facts for the listing detail page — a dedicated card
// (not folded into getDetailFacts()'s generic list) because the product
// spec calls for a specific fact order and a few combined lines (dropdown
// + its note, included-service checkboxes shown individually). Hides any
// field with no value, per spec ("Hide any empty fields automatically").
function getRentalTermsFacts(typeKey, row, lang) {
  if (!PROPERTY_TYPE_RENTAL_TERMS[typeKey] || !row) return [];
  var L = function(en, lo, zh) { return lang === 'lo' ? lo : (lang === 'zh' ? zh : en); };
  var out = [];
  function addFact(icon, label, value) {
    if (value === null || value === undefined || value === '') return;
    out.push({icon: icon, label: label, value: value});
  }

  // Rent itself (existing rent_price/rent_period columns) leads the card —
  // deposit/lease-length/etc. read oddly without the rent they relate to.
  if (row.rent_price) {
    addFact('💵', L('Rent','ຄ່າເຊົ່າ','租金'), row.rent_price + (row.rent_period ? '/' + row.rent_period : ''));
  }

  addFact('🔒', L('Deposit','ເງິນມັດຈຳ','押金'),
    (row.security_deposit !== null && row.security_deposit !== undefined && row.security_deposit !== '')
      ? ('$' + row.security_deposit + (row.security_deposit_note ? ' (' + row.security_deposit_note + ')' : ''))
      : null);

  addFact('📆', L('Advance Rent','ຄ່າເຊົ່າລ່ວງໜ້າ','预付租金'),
    (row.advance_rent_months !== null && row.advance_rent_months !== undefined && row.advance_rent_months !== '')
      ? (row.advance_rent_months + ' ' + L('months','ເດືອນ','个月'))
      : null);

  addFact('📋', L('Minimum Lease','ໄລຍະເຊົ່າຂັ້ນຕ່ຳ','最短租期'), _rentalFactValue('rt-lease-term-min', 'rt-lease-term-min-custom', row, lang));
  addFact('⚡', L('Electricity','ໄຟຟ້າ','电费'), _rentalFactValue('rt-electricity', 'rt-electricity-note', row, lang));
  addFact('🚰', L('Water','ນ້ຳປະປາ','水费'), _rentalFactValue('rt-water', 'rt-water-note', row, lang));
  addFact('📶', L('Internet','ອິນເຕີເນັດ','网络'), _rentalFactValue('rt-internet', 'rt-internet-note', row, lang));
  addFact('🗑️', L('Trash Collection','ການເກັບຂີ້ເຫຍື້ອ','垃圾清运'), _rentalFactValue('rt-trash', 'rt-trash-note', row, lang));
  addFact('🧹', L('Cleaning','ທຳຄວາມສະອາດ','保洁'), _rentalFactValue('rt-cleaning-service', 'rt-cleaning-service-note', row, lang));
  addFact('🛏️', L('Linen Change','ການປ່ຽນຜ້າປູ','更换床单'), _rentalFactValue('rt-linen-change', 'rt-linen-change-note', row, lang));

  var included = Array.isArray(row.included_services) ? row.included_services : [];
  INCLUDED_SERVICES_OPTIONS.forEach(function(opt) {
    if (included.indexOf(opt.value) === -1) return;
    if (opt.value === 'parking') {
      addFact('🚗', L('Parking','ບ່ອນຈອດລົດ','停车位'), L('Included','ລວມຢູ່','已包含'));
    } else {
      addFact('✅', opt.label[lang] || opt.label.en, L('Yes','ແມ່ນ','是'));
    }
  });

  addFact('🐾', L('Pets','ສັດລ້ຽງ','宠物'), _rentalFactValue('rt-pet-policy', 'rt-pet-policy-note', row, lang));

  addFact('🔑', L('Key Deposit','ເງິນມັດຈຳກະແຈ','钥匙押金'), (row.key_deposit !== null && row.key_deposit !== undefined && row.key_deposit !== '') ? ('$' + row.key_deposit) : null);
  addFact('🧽', L('Cleaning Fee','ຄ່າທຳຄວາມສະອາດ','清洁费'), (row.cleaning_fee !== null && row.cleaning_fee !== undefined && row.cleaning_fee !== '') ? ('$' + row.cleaning_fee) : null);
  addFact('📝', L('Administration Fee','ຄ່າທຳນຽມບໍລິຫານ','管理费'), (row.administration_fee !== null && row.administration_fee !== undefined && row.administration_fee !== '') ? ('$' + row.administration_fee) : null);

  return out;
}

var PROPERTY_TYPE_FIELDS = {

  house: [
    _bedrooms(), _bathrooms(), _sqm({en:'Building Size (sqm)',lo:'ຂະໜາດອາຄານ (ຕາລາງແມັດ)',zh:'建筑面积(平方米)'}),
    _sqmLand(), _floors(), _yearBuilt(), _parkingSpaces(), _furnished(),
    _featuresRef(['pool','garden','balcony','security','smart_home','pet_friendly','gym','office_room','maid_room','jacuzzi','ac','river_view','mountain_view','european_kitchen','living_room','walk_in_closet','storage_room','water_pump','covered_parking']),
    _amenitiesRef(['ac','fan','water_heater','furnished','bed','wardrobe','kitchen','fridge','stove','dining_table','washing_machine','parking','pool','gym','security','cctv','pets_allowed','balcony','rooftop','smart','solar','generator','bbq','garden'])
  ],

  townhouse: [
    _bedrooms(), _bathrooms(), _sqm({en:'Building Size (sqm)',lo:'ຂະໜາດອາຄານ (ຕາລາງແມັດ)',zh:'建筑面积(平方米)'}),
    _sqmLand(), _floors(), _yearBuilt(), _parkingSpaces(), _furnished(),
    _featuresRef(['garden','balcony','security','smart_home','pet_friendly','ac','european_kitchen','living_room','walk_in_closet','storage_room','water_pump','covered_parking']),
    _amenitiesRef(['ac','fan','water_heater','furnished','bed','wardrobe','kitchen','fridge','stove','dining_table','washing_machine','parking','security','cctv','pets_allowed','balcony','generator'])
  ],

  villa: [
    _bedrooms(), _bathrooms(), _sqm({en:'Building Size (sqm)',lo:'ຂະໜາດອາຄານ (ຕາລາງແມັດ)',zh:'建筑面积(平方米)'}),
    _sqmLand(), _floors(), _yearBuilt(), _parkingSpaces(), _furnished(),
    _featuresRef(['pool','garden','balcony','security','smart_home','pet_friendly','gym','office_room','maid_room','jacuzzi','ac','river_view','mountain_view','european_kitchen','living_room','walk_in_closet','storage_room','water_pump','covered_parking']),
    _amenitiesRef(['ac','fan','water_heater','furnished','bed','wardrobe','kitchen','fridge','stove','dining_table','washing_machine','parking','pool','gym','security','cctv','pets_allowed','balcony','rooftop','solar','generator','bbq','garden'])
  ],

  apartment: [
    _bedrooms(), _bathrooms(), _sqm({en:'Unit Size (sqm)',lo:'ຂະໜາດຫ້ອງ (ຕາລາງແມັດ)',zh:'单元面积(平方米)'}),
    _yearBuilt(), _parkingSpaces(), _furnished(),
    _featuresRef(['pool','security','smart_home','gym','ac','walk_in_closet','storage_room','covered_parking']),
    _amenitiesRef(['ac','fan','water_heater','furnished','elevator','pool','gym','security','cctv','parking','washing_machine'])
  ],

  condo: [
    _bedrooms(), _bathrooms(), _sqm({en:'Unit Size (sqm)',lo:'ຂະໜາດຫ້ອງ (ຕາລາງແມັດ)',zh:'单元面积(平方米)'}),
    _yearBuilt(), _parkingSpaces(), _furnished(),
    _featuresRef(['pool','security','smart_home','gym','ac','walk_in_closet','storage_room','covered_parking']),
    _amenitiesRef(['ac','fan','water_heater','furnished','elevator','pool','gym','security','cctv','parking','washing_machine'])
  ],

  commercial: [
    _sqm({en:'Floor Area (sqm)',lo:'ເນື້ອທີ່ (ຕາລາງແມັດ)',zh:'建筑面积(平方米)'}),
    _floors(), _parkingSpaces(), _yearBuilt(),
    _featuresRef(['security','office_room','covered_parking','storage_room']),
    _amenitiesRef(['parking','security','cctv','elevator'])
  ],

  // Land: deliberately no bedrooms/bathrooms/floors/furnished/year_built
  // and no features/amenities checkboxes — a land listing has no
  // building to describe. Requires the Phase 2 migration
  // (20260709000000_land_specific_fields.sql) applied first — see the
  // file-level comment above.
  land: [
    _sqmLand(), _landWidth(), _landLength(), _roadFrontage(), _roadWidth(),
    _roadSurface(), _landCategory(), _landShape(), _landTerrain(),
    _existingStructure(), _bestUse()
  ]
};

// ── Customer-facing presentation schema ─────────────────────────────────
// PROPERTY_TYPE_DISPLAY drives what buyers see on the listing card and the
// listing detail page — reusing PROPERTY_TYPE_FIELDS above as the single
// source of truth for column/kind/label/options. Each entry only adds
// presentation metadata:
//   field:    id of an entry in this type's PROPERTY_TYPE_FIELDS array
//   icon:     emoji icon, same convention as AMENITIES in amenities.js
//   card:     shown on compact cards (search results, homepage, similar
//             listings) — array order is display order
//   priority: shown in the detail page's main spec grid; non-priority
//             fields still appear, lower down, in a secondary details list
//   pairWith/pairTemplate: combines this field with another into one
//             display item (e.g. Land's Width × Length)
//
// A field with no PROPERTY_TYPE_FIELDS entry for a type (e.g. Land has no
// "bedrooms") is already omitted structurally — nothing needed here for
// that. A field that exists in PROPERTY_TYPE_FIELDS but isn't listed here
// simply isn't customer-facing yet.
var PROPERTY_TYPE_DISPLAY = {

  house: [
    {field:'f-bedrooms',       icon:'🛏️', card:true,  priority:true},
    {field:'f-bathrooms',      icon:'🛁', card:true,  priority:true},
    {field:'f-sqm',            icon:'📐', card:true,  priority:true},
    {field:'f-sqm-land',       icon:'⬛', card:false, priority:true},
    {field:'f-parking-spaces', icon:'🚗', card:false, priority:true},
    {field:'f-furnished',      icon:'🛋️', card:false, priority:true},
    {field:'f-floors',         icon:'🏢', card:false, priority:false},
    {field:'f-year-built',     icon:'📅', card:false, priority:false}
  ],

  townhouse: [
    {field:'f-bedrooms',       icon:'🛏️', card:true,  priority:true},
    {field:'f-bathrooms',      icon:'🛁', card:true,  priority:true},
    {field:'f-sqm',            icon:'📐', card:true,  priority:true},
    {field:'f-sqm-land',       icon:'⬛', card:false, priority:true},
    {field:'f-parking-spaces', icon:'🚗', card:false, priority:true},
    {field:'f-furnished',      icon:'🛋️', card:false, priority:true},
    {field:'f-floors',         icon:'🏢', card:false, priority:false},
    {field:'f-year-built',     icon:'📅', card:false, priority:false}
  ],

  villa: [
    {field:'f-bedrooms',       icon:'🛏️', card:true,  priority:true},
    {field:'f-bathrooms',      icon:'🛁', card:true,  priority:true},
    {field:'f-sqm',            icon:'📐', card:true,  priority:true},
    {field:'f-sqm-land',       icon:'⬛', card:false, priority:true},
    {field:'f-parking-spaces', icon:'🚗', card:false, priority:true},
    {field:'f-furnished',      icon:'🛋️', card:false, priority:true},
    {field:'f-floors',         icon:'🏢', card:false, priority:false},
    {field:'f-year-built',     icon:'📅', card:false, priority:false}
  ],

  // Floor Number / Maintenance Fee / Building Amenities intentionally not
  // listed — no floor_number/maintenance_fee/building_facilities columns
  // exist yet (see file-level comment). Add entries here once that
  // migration ships.
  apartment: [
    {field:'f-bedrooms',       icon:'🛏️', card:true,  priority:true},
    {field:'f-bathrooms',      icon:'🛁', card:true,  priority:true},
    {field:'f-sqm',            icon:'📐', card:true,  priority:true},
    {field:'f-furnished',      icon:'🛋️', card:false, priority:true},
    {field:'f-parking-spaces', icon:'🚗', card:false, priority:false},
    {field:'f-year-built',     icon:'📅', card:false, priority:false}
  ],

  condo: [
    {field:'f-bedrooms',       icon:'🛏️', card:true,  priority:true},
    {field:'f-bathrooms',      icon:'🛁', card:true,  priority:true},
    {field:'f-sqm',            icon:'📐', card:true,  priority:true},
    {field:'f-furnished',      icon:'🛋️', card:false, priority:true},
    {field:'f-parking-spaces', icon:'🚗', card:false, priority:false},
    {field:'f-year-built',     icon:'📅', card:false, priority:false}
  ],

  // Shopfront Width / Suitable For intentionally not listed — no matching
  // columns exist yet (see file-level comment).
  commercial: [
    {field:'f-sqm',            icon:'📐', card:true,  priority:true},
    {field:'f-floors',         icon:'🏢', card:true,  priority:true},
    {field:'f-parking-spaces', icon:'🚗', card:false, priority:true},
    {field:'f-year-built',     icon:'📅', card:false, priority:false}
  ],

  land: [
    {field:'f-land-width',         icon:'📐', card:true,  priority:true, pairWith:'f-land-length', pairTemplate:'{a} × {b} m'},
    {field:'f-sqm-land',           icon:'⬛', card:true,  priority:true},
    {field:'f-road-frontage',      icon:'🛣️', card:true,  priority:true},
    {field:'f-road-surface',       icon:'🧱', card:false, priority:true},
    {field:'f-land-category',      icon:'🏷️', card:false, priority:true},
    {field:'f-land-terrain',       icon:'⛰️', card:false, priority:true},
    {field:'f-existing-structure', icon:'🏚️', card:false, priority:true},
    {field:'f-best-use',           icon:'🎯', card:false, priority:true},
    {field:'f-road-width',         icon:'↔️', card:false, priority:false},
    {field:'f-land-shape',         icon:'◻️', card:false, priority:false}
  ]
};

function _findFieldDef(typeKey, fieldId) {
  var fields = PROPERTY_TYPE_FIELDS[typeKey] || [];
  for (var i = 0; i < fields.length; i++) {
    if (fields[i].id === fieldId) return fields[i];
  }
  return null;
}

// Formats one field's current value per its kind. Returns null for
// empty/missing values so callers can drop the fact entirely, matching
// today's "just don't show it" behavior for absent data.
function resolveFieldDisplayValue(fieldDef, row, lang) {
  if (!fieldDef || !fieldDef.column) return null;
  var raw = row ? row[fieldDef.column] : null;
  if (raw === null || raw === undefined || raw === '') return null;

  if (fieldDef.kind === 'select') {
    var opts = fieldDef.options || [];
    for (var i = 0; i < opts.length; i++) {
      if (opts[i].value === raw) return opts[i].label[lang] || opts[i].label.en;
    }
    return raw;
  }

  if (fieldDef.kind === 'multi_checkbox') {
    if (!Array.isArray(raw) || !raw.length) return null;
    var opts2 = fieldDef.options || [];
    return raw.map(function(v){
      for (var j = 0; j < opts2.length; j++) {
        if (opts2[j].value === v) return opts2[j].label[lang] || opts2[j].label.en;
      }
      return v;
    }).join(', ');
  }

  return raw;
}

function _buildFactItem(typeKey, entry, row, lang) {
  var fieldDef = _findFieldDef(typeKey, entry.field);
  if (!fieldDef) return null;
  var value = resolveFieldDisplayValue(fieldDef, row, lang);
  if (value === null) return null;

  if (entry.pairWith) {
    var pairDef = _findFieldDef(typeKey, entry.pairWith);
    var pairValue = pairDef ? resolveFieldDisplayValue(pairDef, row, lang) : null;
    if (pairValue !== null) {
      value = (entry.pairTemplate || '{a} × {b}').replace('{a}', value).replace('{b}', pairValue);
    }
  }

  return {icon: entry.icon, label: fieldDef.label[lang] || fieldDef.label.en, value: value};
}

// Compact facts for cards (search results, homepage, similar listings).
function getCardFacts(typeKey, row, lang) {
  var entries = PROPERTY_TYPE_DISPLAY[typeKey] || [];
  var out = [];
  for (var i = 0; i < entries.length; i++) {
    if (!entries[i].card) continue;
    var item = _buildFactItem(typeKey, entries[i], row, lang);
    if (item) out.push(item);
  }
  return out;
}

// Detail-page facts, split into the prominent main spec grid and a
// secondary "Property Details" list for everything else that's still
// relevant to this type.
function getDetailFacts(typeKey, row, lang) {
  var entries = PROPERTY_TYPE_DISPLAY[typeKey] || [];
  var priority = [], secondary = [];
  for (var i = 0; i < entries.length; i++) {
    var item = _buildFactItem(typeKey, entries[i], row, lang);
    if (!item) continue;
    (entries[i].priority ? priority : secondary).push(item);
  }
  return {priority: priority, secondary: secondary};
}

// ── Multi-Unit Buildings (Phase 1) ───────────────────────────────────────
// A `properties` row is a multi-unit building purely by having 1+
// `unit_types` rows -- no is_multi_unit flag anywhere in this schema. See
// supabase/migrations/20260720000000_unit_types.sql.
function isMultiUnitBuilding(unitTypes) {
  return Array.isArray(unitTypes) && unitTypes.length > 0;
}

// resolveUnitType(property, unitType) is the ONE resolver every consumer of
// unit-type data must call -- admin preview, the Phase 2 listing-page
// variant switcher, Phase 2 search, future APIs, a future mobile app. Never
// re-derive this fallback logic anywhere else; if inheritance rules ever
// change, this is the one place to update.
//
// Every unit_types column is nullable, and null means "use the building's
// own value" -- that's what `pick()` implements uniformly below. The one
// field with genuinely different logic is `images`, which follows the
// specific fallback hierarchy asked for: unit photos if the unit type has
// any, otherwise the building's own photos -- a visitor should never
// encounter an empty gallery just because a unit type doesn't yet have
// dedicated photos of its own.
//
// `is_available`/`available_count`/`sort_order` are NOT NULL on unit_types
// (every unit type always has its own value for these), so they're read
// directly rather than through `pick()`.
function resolveUnitType(property, unitType) {
  function pick(col) {
    var v = unitType[col];
    return (v !== null && v !== undefined) ? v : property[col];
  }
  return {
    id: unitType.id,
    name: {en: unitType.name_en, lo: unitType.name_lo, zh: unitType.name_zh},
    priceDisplay: pick('price_display'),
    salePrice:    pick('sale_price'),
    rentPrice:    pick('rent_price'),
    rentPeriod:   pick('rent_period'),
    bedrooms:  pick('bedrooms'),
    bathrooms: pick('bathrooms'),
    sqm:       pick('sqm'),
    floors:    pick('floors'),
    descriptionEn: pick('description_en'), descriptionLo: pick('description_lo'), descriptionZh: pick('description_zh'),
    highlightEn:   pick('property_highlight_en'), highlightLo: pick('property_highlight_lo'), highlightZh: pick('property_highlight_zh'),
    features:  pick('features'),
    amenities: pick('amenities'),
    images: (Array.isArray(unitType.images) && unitType.images.length) ? unitType.images : (property.images || []),
    isAvailable:    unitType.is_available,
    availableCount: unitType.available_count,
    sortOrder:      unitType.sort_order
  };
}
