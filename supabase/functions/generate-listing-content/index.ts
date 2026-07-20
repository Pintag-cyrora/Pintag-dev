const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function requireAdmin(req: Request): Promise<string | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) return 'Server misconfigured';
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return 'Missing auth token';
  const token = auth.slice(7);
  const r = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { 'Authorization': `Bearer ${token}`, 'apikey': supabaseAnonKey },
  });
  if (!r.ok) return 'Invalid token';
  const user = await r.json();
  if (user?.email !== 'admin@pintag.io') return 'Admin only';
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authErr = await requireAdmin(req);
  if (authErr) {
    return new Response(JSON.stringify({ error: authErr }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const data = await req.json();

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY is not configured. Add it in Supabase Dashboard → Edge Functions → Manage secrets.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const nearbyNames = Array.isArray(data.nearby_places)
      ? data.nearby_places.map((p: { name_en?: string; name?: string }) => p.name_en || p.name || '').filter(Boolean)
      : [];

    const featuresList = Array.isArray(data.features) ? data.features.join(', ') : '';

    // Rental Terms (Apartment/Condo only) — data.rental_terms is the same
    // raw column-keyed object admin.html's buildRentalTermsPayload() writes
    // to the listing itself (terminology.js: RENTAL_TERMS_FIELDS), so this
    // interprets the exact same enum values the form saves, not a
    // re-derived copy. Empty/all-null for every other property type.
    const rt: Record<string, unknown> = (data.rental_terms && typeof data.rental_terms === 'object') ? data.rental_terms : {};
    const hasRentalTerms = Object.values(rt).some((v) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0));

    function fmtUtility(term: unknown, note: unknown, label: string): string {
      const t = typeof term === 'string' ? term : '';
      const n = typeof note === 'string' && note ? ` (${note})` : '';
      if (!t) return `${label}: not specified`;
      if (t === 'included') return `${label}: included in rent`;
      if (t === 'government_meter') return `${label}: government meter, tenant pays`;
      if (t === 'fixed_fee') return `${label}: fixed monthly fee${n}`;
      if (t === 'extra_fee') return `${label}: extra fee${n}`;
      if (t === 'not_available') return `${label}: not available`;
      if (t === 'not_included') return `${label}: not included`;
      if (t === 'available_tenant_pays') return `${label}: available, tenant pays`;
      if (t === 'custom') return `${label}: ${note || 'custom arrangement'}`;
      return `${label}: ${t}`;
    }

    const leaseTermMin = typeof rt.lease_term_min === 'string' ? rt.lease_term_min : '';
    const leaseTermText = !leaseTermMin ? 'not specified'
      : leaseTermMin === 'custom' ? (String(rt.lease_term_min_custom || 'custom'))
      : leaseTermMin === 'month_to_month' ? 'month-to-month'
      : leaseTermMin.replace(/_/g, ' ');

    const cleaningService = typeof rt.cleaning_service === 'string' ? rt.cleaning_service : '';
    const cleaningText = !cleaningService ? 'not specified'
      : cleaningService === 'custom' ? (String(rt.cleaning_service_note || 'custom'))
      : cleaningService.replace(/_/g, ' ');

    const petPolicy = typeof rt.pet_policy === 'string' ? rt.pet_policy : '';
    const petText = !petPolicy ? 'not specified'
      : petPolicy === 'custom' ? (String(rt.pet_policy_note || 'custom'))
      : petPolicy.replace(/_/g, ' ');

    const includedServicesList = Array.isArray(rt.included_services) && rt.included_services.length
      ? rt.included_services.map((s) => String(s).replace(/_/g, ' ')).join(', ')
      : 'none specified';

    const rentalTermsBlock = hasRentalTerms ? `

RENTAL TERMS:
- Security Deposit: ${rt.security_deposit ? '$' + rt.security_deposit + (rt.security_deposit_note ? ' (' + rt.security_deposit_note + ')' : '') : 'not specified'}
- Advance Rent: ${rt.advance_rent_months ? rt.advance_rent_months + ' months' : 'not specified'}
- Minimum Lease Term: ${leaseTermText}
- ${fmtUtility(rt.electricity_terms, rt.electricity_fee_note, 'Electricity')}
- ${fmtUtility(rt.water_terms, rt.water_fee_note, 'Water')}
- ${fmtUtility(rt.internet_terms, rt.internet_note, 'Internet')}
- ${fmtUtility(rt.trash_terms, rt.trash_note, 'Trash Collection')}
- Cleaning Service: ${cleaningText}
- Included Services: ${includedServicesList}
- Pet Policy: ${petText}` : '';

    const prompt = `You are a professional real estate copywriter for Pintag, a premium real estate platform in Vientiane, Laos.

Generate listing content in THREE languages: Lao (lo), English (en), and Chinese (zh).

PROPERTY DETAILS:
- Type: ${data.property_type || 'not specified'}
- Style: ${data.property_style || 'not specified'}
- Transaction: ${data.transaction_type === 'for_rent' ? 'For Rent' : 'For Sale'}
- Bedrooms: ${data.bedrooms || 'not specified'}
- Bathrooms: ${data.bathrooms || 'not specified'}
- Building Size: ${data.sqm ? data.sqm + ' sqm' : 'not specified'}
- Land Size: ${data.sqm_land ? data.sqm_land + ' sqm' : 'not specified'}
- Price: ${data.price_display || 'on request'}
- Village: ${data.village || 'not specified'}
- District: ${data.district || 'not specified'}, Vientiane, Laos
- Features: ${featuresList || 'not specified'}
- Furnished: ${data.furnished || 'not specified'}
- Nearby Landmarks: ${nearbyNames.join(', ') || 'not specified'}${rentalTermsBlock}

CONTENT RULES:

TITLES (max 80 characters each):
- Short and professional
- No excessive marketing language
- Mention the key selling point (location, style, or unique feature)

PROPERTY HIGHLIGHTS (exactly 1 sentence each):
- Emotional positioning
- Professional real estate tone
- No emojis, no exaggerated claims

NEIGHBORHOOD INSIGHTS (exactly 1 sentence each):
- Focus on: convenience, lifestyle, accessibility, schools, shopping, business districts, or transportation
- No marketing hype

DESCRIPTIONS (2–4 short paragraphs each):
- Professional real estate tone
- Natural flowing language
- No repetitive phrases
- Each paragraph separated by a newline
- If RENTAL TERMS are provided above, you may naturally mention 1–2 of the
  most attractive ones (e.g. "utilities included", "pet-friendly", "flexible
  month-to-month lease", "cleaning service included") in the highlight or
  description — only use what's explicitly given above, never invent or
  assume a rental term that wasn't provided

NEARBY LANDMARKS:
- Translate each landmark to official/common names in all 3 languages
- Use well-known local names for Lao, standard names for Chinese
- Return as separate arrays, one name per entry matching the input order

Return ONLY valid JSON in this exact format with no additional text:
{
  "title_lo": "",
  "title_en": "",
  "title_zh": "",
  "property_highlight_lo": "",
  "property_highlight_en": "",
  "property_highlight_zh": "",
  "neighborhood_insight_lo": "",
  "neighborhood_insight_en": "",
  "neighborhood_insight_zh": "",
  "description_lo": "",
  "description_en": "",
  "description_zh": "",
  "nearby_lo": [],
  "nearby_en": [],
  "nearby_zh": []
}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1500, temperature: 0.7, thinkingConfig: { thinkingBudget: 0 } },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API ${response.status}: ${errText.slice(0, 200)}`);
    }

    const geminiData = await response.json();
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('No text content in Gemini response');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Could not parse JSON from Gemini response');

    const result = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
