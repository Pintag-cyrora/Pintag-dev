// rental-terms.js — the canonical Rental Terms domain module for
// Apartment/Condo listings. Same convention as terminology.js/amenities.js:
// plain global vars/functions, no build step, loaded via
// <script src="rental-terms.js"> — placed right after
// <script src="terminology.js"> on every page that uses it (admin.html,
// add-property.html, edit-listing.html, listing.html, listings.html,
// index.html).
//
// WHY THIS FILE EXISTS
// Rental Terms started as a handful of fields bolted onto
// PROPERTY_TYPE_FIELDS, but grew into its own structured pricing/
// utilities/services/pet-policy/fees schema with its own display rules,
// computed figures, and filters — enough surface area to be a real domain,
// not a scattering of helpers. This file is that domain's one home. Put
// ANY new Rental Terms logic here — a new field, a new computed figure, a
// new filter, future validation/formatting — rather than reimplementing it
// on a page or bolting it onto terminology.js.
//
// DEPENDENCIES
// - Depends on terminology.js's resolveFieldDisplayValue() (generic
//   select/plain-value formatter, reused by _rentalFactValue() below) and
//   resolveUnitType() (generic per-unit-type resolver, reused by
//   getResolvedRentalTermsRow() below). Load terminology.js first.
// - terminology.js's resolveUnitType() in turn calls this file's
//   pickRentalTermsColumns() to resolve a unit type's Rental Terms
//   overrides — the two files call into each other, which is fine for
//   plain globals (everything here is a lazy function/closure, nothing
//   executes at top level), but means BOTH scripts must be present on any
//   page that touches Unit Types or Rental Terms.
// - Requires the 20260720100000_rental_terms.sql (properties columns) and
//   20260720110000_rental_terms_unit_type_overrides.sql (unit_types
//   columns) migrations applied first, same rule as every other
//   type-specific field set in this codebase: PostgREST rejects
//   insert/update payloads that reference unknown columns, so shipping
//   this file ahead of those migrations would break saving every
//   Apartment/Condo listing.
//
// PUBLIC API
// Every existing global name below (RENTAL_TERMS_FIELDS,
// RENTAL_TERMS_SECTIONS, PROPERTY_TYPE_RENTAL_TERMS, RENTAL_TERMS_FILTERS,
// getRentalTermsFacts(), getRentalTermsSummary(), getEstimatedMoveInCost(),
// getResolvedRentalTermsRow(), MOVE_IN_COST_LABELS, and the *_OPTIONS
// arrays) stays exactly as it was for backward compatibility — every
// existing call site across the six pages above keeps working unchanged.
// NEW code should prefer the `RentalTerms` namespace object at the bottom
// of this file instead of the bare globals — it's the same functions,
// just organized and documented as one importable-feeling surface, and is
// where a future unit-type selector, availability model, API response
// shape, mobile app, or analytics pipeline should hang its Rental Terms
// logic. See the RentalTerms object's own comment below for the full
// method list.

// ── Field registry ──────────────────────────────────────────────────────
// Structured pricing/utilities/services/pet-policy fields, kept in their
// own registry rather than merged into terminology.js's PROPERTY_TYPE_FIELDS,
// because they render as a grouped "Rental Terms" section with subheadings
// (`section`) and a few conditional companion fields, neither of which the
// generic Property Details grid supports.
//
// `section` groups a field under one of RENTAL_TERMS_SECTIONS' subheadings.
// `showWhen: {parent: '<field id>', values: [...]}` means: only show this
// field (and only save it) when the named parent field's current value is
// one of `values` — used for the utility fixed-fee/extra-fee amounts and
// every dropdown's Custom note.
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

// affectsMoveInCost flags the handful of fields getEstimatedMoveInCost()
// actually sums — admin.html's live "Estimated Move-in Cost" preview hooks
// an oninput handler onto exactly these, instead of every Rental Terms
// field, by checking this flag in renderRentalTermField().
function _rtSecurityDeposit()      { return {id:'rt-security-deposit',       column:'security_deposit',      kind:'number', section:'pricing', label:{en:'Security Deposit ($)',lo:'ເງິນມັດຈຳ ($)',zh:'押金($)'}, min:0, placeholder:'300', affectsMoveInCost:true}; }
function _rtSecurityDepositNote()  { return {id:'rt-security-deposit-note',  column:'security_deposit_note', kind:'text',   section:'pricing', label:{en:'Deposit Note',lo:'ໝາຍເຫດເງິນມັດຈຳ',zh:'押金备注'}, placeholder:"e.g. 1 month's rent"}; }
function _rtAdvanceRent()          { return {id:'rt-advance-rent',           column:'advance_rent_months',   kind:'number', section:'pricing', label:{en:'Advance Rent (months)',lo:'ຄ່າເຊົ່າລ່ວງໜ້າ (ເດືອນ)',zh:'预付租金(月)'}, min:0, placeholder:'2', affectsMoveInCost:true}; }
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

function _rtKeyDeposit()  { return {id:'rt-key-deposit',  column:'key_deposit',        kind:'number', section:'additional_fees', label:{en:'Key Deposit ($)',lo:'ເງິນມັດຈຳກະແຈ ($)',zh:'钥匙押金($)'}, min:0, placeholder:'20', affectsMoveInCost:true}; }
function _rtCleaningFee() { return {id:'rt-cleaning-fee', column:'cleaning_fee',       kind:'number', section:'additional_fees', label:{en:'Cleaning Fee ($)',lo:'ຄ່າທຳຄວາມສະອາດ ($)',zh:'清洁费($)'}, min:0, placeholder:'30', affectsMoveInCost:true}; }
function _rtAdminFee()    { return {id:'rt-admin-fee',    column:'administration_fee', kind:'number', section:'additional_fees', label:{en:'Administration Fee ($)',lo:'ຄ່າທຳນຽມບໍລິຫານ ($)',zh:'管理费($)'}, min:0, placeholder:'25', affectsMoveInCost:true}; }

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
// Reuses terminology.js's resolveFieldDisplayValue() for the actual
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

// ── Display: full itemized card (listing detail page) ──────────────────
// The rent amount actually worth displaying/computing with. `rent_price` is
// only ever populated for sale_or_rent listings (admin.html's saveListing()
// writes it exclusively from f-rent-price, which is itself only shown for
// sale_or_rent) — a plain for_rent listing's rent amount lives in
// price_display instead (same source listing.html's own price block reads
// for non-sale_or_rent listings). Falling back to price_display here means
// the Rent line and Estimated Move-in Cost both work for ordinary For Rent
// listings, not just dual-price Sale-or-Rent ones.
function _resolveRentAmount(row) {
  if (!row) return null;
  if (row.rent_price) return row.rent_price;
  if (row.transaction_type === 'for_rent' && row.price_display) return row.price_display;
  return null;
}

// Rental Terms card facts for the listing detail page — a dedicated card
// (not folded into terminology.js's getDetailFacts()) because the product
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

  // Rent itself leads the card — deposit/lease-length/etc. read oddly
  // without the rent they relate to.
  var rentAmount = _resolveRentAmount(row);
  if (rentAmount) {
    addFact('💵', L('Rent','ຄ່າເຊົ່າ','租金'), rentAmount + (row.rent_period ? '/' + row.rent_period : ''));
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

// ── Computation: Estimated Move-in Cost ──────────────────────────────────
// Strips a free-text money field (e.g. "$450", "450,000 LAK") down to its
// leading numeric value. rent_price/price_display etc. are plain `text`
// columns, not numeric (see 20260720000000_unit_types.sql's note on why —
// staff type "$550,000" as-is, no numeric parsing on save), so anything
// that needs to compute with rent has to parse it defensively rather than
// assume a clean number.
function _parseMoneyText(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  var n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
  return isNaN(n) ? 0 : n;
}

// Trilingual labels for getEstimatedMoveInCost()'s breakdown line items —
// kept separate from RENTAL_TERMS_FIELDS since these aren't form fields,
// just display labels for a derived/computed figure.
var MOVE_IN_COST_LABELS = {
  first_month_rent:   {en:"First Month's Rent",  lo:'ຄ່າເຊົ່າເດືອນທຳອິດ',   zh:'首月租金'},
  advance_rent:        {en:'Advance Rent',         lo:'ຄ່າເຊົ່າລ່ວງໜ້າ',      zh:'预付租金'},
  security_deposit:    {en:'Security Deposit',     lo:'ເງິນມັດຈຳ',           zh:'押金'},
  key_deposit:         {en:'Key Deposit',          lo:'ເງິນມັດຈຳກະແຈ',       zh:'钥匙押金'},
  cleaning_fee:        {en:'Cleaning Fee',         lo:'ຄ່າທຳຄວາມສະອາດ',      zh:'清洁费'},
  administration_fee:  {en:'Administration Fee',   lo:'ຄ່າທຳນຽມບໍລິຫານ',      zh:'管理费'}
};

// Automatically calculated Estimated Move-in Cost: first month's rent +
// advance rent (assumed to be additional prepaid months on top of the
// move-in month, matching how landlords typically quote "1 month advance +
// 2 months deposit") + security deposit + the one-time fees. Returns null
// when there's nothing to estimate (no rent and no fees at all) rather than
// a misleading $0, and otherwise a breakdown array (for a transparent
// itemized display, not just an opaque total agents have to trust blindly)
// plus the summed total.
function getEstimatedMoveInCost(row) {
  if (!row) return null;
  var rent = _parseMoneyText(_resolveRentAmount(row));
  var advanceMonths = _parseMoneyText(row.advance_rent_months);
  var breakdown = [];

  if (rent) breakdown.push({key: 'first_month_rent', amount: rent});
  if (advanceMonths && rent) breakdown.push({key: 'advance_rent', amount: advanceMonths * rent});
  if (row.security_deposit !== null && row.security_deposit !== undefined && row.security_deposit !== '') {
    breakdown.push({key: 'security_deposit', amount: _parseMoneyText(row.security_deposit)});
  }
  if (row.key_deposit !== null && row.key_deposit !== undefined && row.key_deposit !== '') {
    breakdown.push({key: 'key_deposit', amount: _parseMoneyText(row.key_deposit)});
  }
  if (row.cleaning_fee !== null && row.cleaning_fee !== undefined && row.cleaning_fee !== '') {
    breakdown.push({key: 'cleaning_fee', amount: _parseMoneyText(row.cleaning_fee)});
  }
  if (row.administration_fee !== null && row.administration_fee !== undefined && row.administration_fee !== '') {
    breakdown.push({key: 'administration_fee', amount: _parseMoneyText(row.administration_fee)});
  }

  if (!breakdown.length) return null;
  var total = breakdown.reduce(function (sum, b) { return sum + b.amount; }, 0);
  return {breakdown: breakdown, total: total};
}

// ── Filtering ─────────────────────────────────────────────────────────
// Pure predicates over a properties (or resolved unit-type) row, one per
// filter named in the product spec. Client-side listings.html/index.html
// filtering works by fetching the full table and filtering in JS (no
// supabase-js `.eq()`/`.contains()` builder in this codebase — see
// listings.html's loadListings()/renderListings()), so these are plain
// boolean functions rather than query fragments; a future server-side
// search would translate each one to `column = 'included'` or
// `included_services @> '["parking"]'` against the indexes already added
// in 20260720100000_rental_terms.sql.
var RENTAL_TERMS_FILTERS = {
  electricityIncluded: function (row) { return !!row && row.electricity_terms === 'included'; },
  waterIncluded:       function (row) { return !!row && row.water_terms === 'included'; },
  internetIncluded:    function (row) { return !!row && row.internet_terms === 'included'; },
  trashIncluded:       function (row) { return !!row && row.trash_terms === 'included'; },
  parkingIncluded:          function (row) { return _hasIncludedService(row, 'parking'); },
  securityIncluded:         function (row) { return _hasIncludedService(row, 'security'); },
  receptionIncluded:        function (row) { return _hasIncludedService(row, 'reception'); },
  swimmingPoolIncluded:     function (row) { return _hasIncludedService(row, 'swimming_pool'); },
  gymIncluded:              function (row) { return _hasIncludedService(row, 'gym'); },
  gardenMaintenanceIncluded:function (row) { return _hasIncludedService(row, 'garden_maintenance'); },
  poolMaintenanceIncluded:  function (row) { return _hasIncludedService(row, 'pool_maintenance'); },
  // Any policy that permits at least some pet, as opposed to 'no_pets' /
  // blank (not specified) / 'custom' (ambiguous — could go either way, so
  // deliberately excluded from a simple yes/no filter).
  petsAllowed: function (row) {
    return !!row && ['pets_allowed', 'cats_only', 'small_pets_only'].indexOf(row.pet_policy) !== -1;
  },
  // Cleaning Service is a value filter, not a yes/no one — pass the exact
  // CLEANING_SERVICE_OPTIONS value to match (e.g. 'daily'), or omit `freq`
  // to ask "is any cleaning service provided at all" (anything but blank/
  // 'none').
  cleaningService: function (row, freq) {
    if (!row) return false;
    if (freq) return row.cleaning_service === freq;
    return !!row.cleaning_service && row.cleaning_service !== 'none';
  }
};
function _hasIncludedService(row, key) {
  return !!row && Array.isArray(row.included_services) && row.included_services.indexOf(key) !== -1;
}

// ── Display: compact one-line summary (cards/search results) ───────────
// A short "Deposit $300 · 12mo min · Pets OK" string, distinct from
// getRentalTermsFacts()'s full itemized card on the detail page. Builds the
// most decision-relevant facts in priority order (deposit, minimum lease,
// then whichever utilities/pets are set) and caps it at 4, joined with
// " · " — same separator convention as admin.html's _utUpdateSummary()
// (Unit Type card summary). Returns '' (not null) so callers can do a
// simple truthiness check before rendering a separator/bullet in front of
// it.
function getRentalTermsSummary(typeKey, row, lang) {
  if (!PROPERTY_TYPE_RENTAL_TERMS[typeKey] || !row) return '';
  var L = function (en, lo, zh) { return lang === 'lo' ? lo : (lang === 'zh' ? zh : en); };
  var parts = [];

  if (row.security_deposit !== null && row.security_deposit !== undefined && row.security_deposit !== '') {
    parts.push(L('Deposit', 'ມັດຈຳ', '押金') + ' $' + row.security_deposit);
  }
  var leaseVal = _rentalFactValue('rt-lease-term-min', null, row, lang);
  if (leaseVal) {
    parts.push(row.lease_term_min === 'month_to_month' ? leaseVal : (leaseVal + ' ' + L('min', 'ຂັ້ນຕ່ຳ', '起租')));
  }
  if (RENTAL_TERMS_FILTERS.electricityIncluded(row) && RENTAL_TERMS_FILTERS.waterIncluded(row)) {
    parts.push(L('Utilities Included', 'ລວມນ້ຳໄຟ', '水电全包'));
  } else if (RENTAL_TERMS_FILTERS.electricityIncluded(row)) {
    parts.push(L('Electricity Included', 'ລວມໄຟຟ້າ', '含电费'));
  } else if (RENTAL_TERMS_FILTERS.waterIncluded(row)) {
    parts.push(L('Water Included', 'ລວມນ້ຳປະປາ', '含水费'));
  }
  if (RENTAL_TERMS_FILTERS.internetIncluded(row)) parts.push(L('Internet Included', 'ລວມອິນເຕີເນັດ', '含网络'));
  if (RENTAL_TERMS_FILTERS.parkingIncluded(row)) parts.push(L('Parking', 'ບ່ອນຈອດລົດ', '停车位'));
  if (row.pet_policy === 'pets_allowed') parts.push(L('Pets OK', 'ຮັບສັດລ້ຽງ', '可养宠物'));
  else if (row.pet_policy === 'no_pets') parts.push(L('No Pets', 'ບໍ່ຮັບສັດລ້ຽງ', '不可养宠物'));

  return parts.slice(0, 4).join(' · ');
}

// ── Resolution: inherit/override (Unit Types) ───────────────────────────
// Walks RENTAL_TERMS_FIELDS and applies `pick` (a null-fallback function
// supplied by the caller) to every column, returning a flat
// {column: value} object. This is the one place "which columns make up a
// unit type's Rental Terms override" is enumerated — terminology.js's
// resolveUnitType() calls this (passing its own pick(col) closure, which
// already implements "unit_types value if non-null, else the building's
// own value") instead of re-deriving the column list itself, so this file
// stays the single source of truth for the Rental Terms schema even
// through the general Unit Type resolver.
function pickRentalTermsColumns(pick) {
  var out = {};
  RENTAL_TERMS_FIELDS.forEach(function (f) {
    if (f.column) out[f.column] = pick(f.column);
  });
  return out;
}

// Convenience for Rental Terms display consumers: terminology.js's
// resolveUnitType() returns camelCase fields (its existing shape, left
// unchanged so nothing that already calls it breaks), but
// getRentalTermsFacts()/getEstimatedMoveInCost()/getRentalTermsSummary()
// all expect a plain row-shaped object keyed by column name, same shape as
// a raw properties row. This layers a unit type's resolved Rental Terms
// overrides over the building's own rent_price/rent_period/price_display/
// transaction_type (the fields _resolveRentAmount() needs that live
// outside RENTAL_TERMS_FIELDS) so a caller can go straight to
// getRentalTermsFacts(typeKey, getResolvedRentalTermsRow(property, unitType), lang)
// instead of re-deriving this shape itself.
function getResolvedRentalTermsRow(property, unitType) {
  var resolved = resolveUnitType(property, unitType);
  var row = Object.assign({}, resolved.rentalTerms);
  row.rent_price = resolved.rentPrice;
  row.rent_period = resolved.rentPeriod;
  row.price_display = resolved.priceDisplay;
  row.transaction_type = property.transaction_type;
  return row;
}

// ── Canonical namespace ──────────────────────────────────────────────────
// The documented, organized entry point for anything new that needs
// Rental Terms logic — a future unit-type selector UI, an availability
// model, an API response builder, a mobile app, an analytics pipeline.
// Prefer these methods over the bare global names above in new code; the
// bare globals exist only for the pages that were already calling them
// before this module existed.
var RentalTerms = {
  // Schema — the field registry itself. FIELDS is every Rental Terms
  // field definition (id/column/kind/section/label/options/showWhen/
  // affectsMoveInCost); SECTIONS is the subheading grouping/order; TYPES
  // is which property types have a Rental Terms section at all (currently
  // apartment/condo — check with isSupportedType(typeKey)).
  FIELDS: RENTAL_TERMS_FIELDS,
  SECTIONS: RENTAL_TERMS_SECTIONS,
  TYPES: PROPERTY_TYPE_RENTAL_TERMS,
  isSupportedType: function (typeKey) { return !!PROPERTY_TYPE_RENTAL_TERMS[typeKey]; },

  // Option registries — the dropdown/checkbox choices each field draws
  // from, keyed the same way the fields reference them.
  OPTIONS: {
    minLeaseTerm: MIN_LEASE_TERM_OPTIONS,
    electricityTerms: ELECTRICITY_TERMS_OPTIONS,
    waterTerms: WATER_TERMS_OPTIONS,
    internetTerms: INTERNET_TERMS_OPTIONS,
    trashTerms: TRASH_TERMS_OPTIONS,
    cleaningService: CLEANING_SERVICE_OPTIONS,
    linenChange: LINEN_CHANGE_OPTIONS,
    includedServices: INCLUDED_SERVICES_OPTIONS,
    petPolicy: PET_POLICY_OPTIONS
  },

  // Resolution (inherit/override) — resolveForUnitType(pick) returns the
  // flat {column: value} object for one unit type given a pick(col)
  // fallback function; getResolvedRow(property, unitType) is the
  // higher-level convenience that also resolves rent_price/rent_period/
  // price_display/transaction_type, ready to hand straight to getFacts()/
  // estimateMoveInCost()/getSummary() below.
  resolveForUnitType: pickRentalTermsColumns,
  getResolvedRow: getResolvedRentalTermsRow,

  // Display — getFacts() is the full itemized list for a detail-page
  // card; getSummary() is the compact one-line version for list/search
  // cards. Both take (typeKey, row, lang) where `row` is a properties row
  // or a getResolvedRow() output, and `lang` is 'lo' | 'en' | 'zh'.
  getFacts: getRentalTermsFacts,
  getSummary: getRentalTermsSummary,

  // Computation — estimateMoveInCost(row) returns {breakdown, total} or
  // null when there's nothing to estimate. MOVE_IN_COST_LABELS is the
  // trilingual label for each breakdown[].key.
  estimateMoveInCost: getEstimatedMoveInCost,
  MOVE_IN_COST_LABELS: MOVE_IN_COST_LABELS,

  // Filtering — one boolean (or boolean+arg, for cleaningService) predicate
  // per filter named in the product spec's Future Filtering Support list.
  filters: RENTAL_TERMS_FILTERS,

  // Formatting utilities — exposed for future validation/formatting needs
  // (an API response builder, a mobile client) rather than re-implementing
  // this parsing/fallback logic a second time.
  resolveRentAmount: _resolveRentAmount,
  parseMoneyText: _parseMoneyText
};
