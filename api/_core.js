const fs = require('node:fs');
const path = require('node:path');

const zlib = require('node:zlib');
const packed = fs.readFileSync(path.join(process.cwd(), 'data', 'catalog.json.gz.b64'), 'utf8');
const catalog = JSON.parse(zlib.gunzipSync(Buffer.from(packed, 'base64')).toString('utf8'));
const offers = catalog.offers || [];
const byId = new Map(offers.map((offer) => [offer.offer_id, offer]));

const useCases = {
  'ai-engineering': { label: 'AI engineering', terms: ['AI tools','Developer tools','Cloud & infrastructure','Databases','Monitoring & observability'], keywords: ['ai','coding','cloud','database','api','gpu','deployment','monitoring'] },
  'web-development': { label: 'Web development', terms: ['Developer tools','Domains & web hosting','Cloud & infrastructure','Databases','Testing & QA','CI/CD & DevOps'], keywords: ['hosting','domain','developer','database','deployment','testing','ci/cd'] },
  design: { label: 'Design and prototyping', terms: ['Design & creative','Collaboration & productivity','CAD, 3D & engineering','Game development & 3D'], keywords: ['design','prototype','creative','graphics','3d','asset'] },
  'data-science': { label: 'Data science', terms: ['Data & analytics','Math, science & engineering','Cloud & infrastructure','Developer tools','Databases','Data & APIs'], keywords: ['data','analytics','python','notebook','science','math','database','api'] },
  cybersecurity: { label: 'Cybersecurity', terms: ['Authentication & security','Developer tools','Cloud & infrastructure','Learning & courses','Monitoring & observability'], keywords: ['security','authentication','monitoring','developer','learning','cloud'] },
  research: { label: 'Academic research', terms: ['Writing & research','Learning & courses','Data & analytics','Math, science & engineering','Collaboration & productivity','Cloud storage'], keywords: ['research','writing','reference','learning','storage','math','data'] },
  'content-creation': { label: 'Content creation', terms: ['Design & creative','Audio & music','Media & subscriptions','Writing & research','Collaboration & productivity'], keywords: ['creative','video','audio','music','design','writing','media'] },
  'student-startup': { label: 'Student startup', terms: ['Developer tools','Cloud & infrastructure','Domains & web hosting','Design & creative','Collaboration & productivity','Payments & commerce','AI tools'], keywords: ['startup','commercial','domain','hosting','cloud','design','payment','productivity','ai'] }
};

const countryNames = { US:'United States', CA:'Canada', GB:'United Kingdom', UK:'United Kingdom', SE:'Sweden', DE:'Germany', FR:'France', NL:'Netherlands', IE:'Ireland', ES:'Spain', IT:'Italy', PL:'Poland', DK:'Denmark', NO:'Norway', FI:'Finland', BE:'Belgium', AT:'Austria', CH:'Switzerland', PT:'Portugal', CZ:'Czechia', AU:'Australia', NZ:'New Zealand', IN:'India', SG:'Singapore' };
const european = new Set(['SE','DE','FR','NL','IE','ES','IT','PL','DK','NO','FI','BE','AT','CH','PT','CZ']);
const reviewStatuses = new Set(['marketplace_snapshot','paused','expiring_soon','needs_live_verification']);

const clean = (value) => String(value ?? '').trim();
const csvValues = (value) => new Set(clean(value).split(',').map((part) => part.trim().toUpperCase()).filter(Boolean));

function regionAssessment(offer, country) {
  const code = clean(country).toUpperCase();
  if (!code) return ['unknown', 'Country not supplied'];
  const codes = csvValues(offer.region_codes);
  const scope = clean(offer.region_scope).toLowerCase();
  const name = (countryNames[code] || code).toLowerCase();
  if (codes.has(code) || (code === 'GB' && codes.has('UK')) || (code === 'UK' && codes.has('GB'))) return ['exact', `Explicitly lists ${countryNames[code] || code}`];
  if (codes.size && !codes.has(code)) return ['mismatch', "Country is not in the offer's explicit region list"];
  if (['global','worldwide','many countries','100+ countries','supported markets','supported regions'].some((term) => scope.includes(term))) return ['possible', 'Broad availability; source verification still required'];
  if (scope.includes(name) || ((code === 'GB' || code === 'UK') && scope.includes('united kingdom'))) return ['exact', `Region text names ${countryNames[code] || code}`];
  if (scope.includes('europe') && european.has(code)) return ['possible', 'Offer indicates European availability'];
  if (!scope) return ['unknown', 'No structured region information'];
  return ['unknown', 'Availability must be checked at the source'];
}

function commercialAssessment(offer, required) {
  const text = clean(offer.commercial_use).toLowerCase();
  if (!required) return [true, 'Commercial use not required'];
  if (['non-commercial','educational use only','education use only','personal use'].some((term) => text.includes(term))) return [false, 'Terms appear incompatible with commercial work'];
  if (['commercial','business','development use','subject to terms','depends on vendor'].some((term) => text.includes(term))) return [true, 'May support commercial work; check current license terms'];
  return [true, 'Commercial-use status is unclear; check the source'];
}

const statusWeight = (status) => ({ active:25, general_free:18, institution_access:15, marketplace_snapshot:3, needs_live_verification:0, expiring_soon:-10, paused:-45 }[status] || 0);
const routeWeight = (route) => ({ 'Direct vendor':20, 'Institution-mediated':15, 'GitHub Student Developer Pack':12, 'Student Beans':3, UNiDAYS:3 }[route] || 0);

function eligibilityScore(offer, profile = {}, useCase = '') {
  let score = 25;
  const reasons = [];
  const cautions = [];
  score += clean(offer.confidence) === 'High' ? 12 : 3;
  score += statusWeight(clean(offer.status));
  score += routeWeight(clean(offer.access_route));
  const priority = Number(offer.agent_priority || 9);
  score += Math.max(0, 8 - priority);

  const [regionLevel, regionReason] = regionAssessment(offer, profile.country);
  if (regionLevel === 'exact') { score += 25; reasons.push(regionReason); }
  else if (regionLevel === 'possible') { score += 10; reasons.push(regionReason); }
  else if (regionLevel === 'mismatch') { score -= 100; cautions.push(regionReason); }
  else cautions.push(regionReason);

  const route = clean(offer.access_route);
  const verification = clean(offer.verification).toLowerCase();
  if (route === 'GitHub Student Developer Pack') {
    if (profile.github_verified) { score += 18; reasons.push('GitHub Student verification is available'); }
    else { score -= 12; cautions.push('Requires a verified GitHub Education student account'); }
  }
  if (['school email','institutional email','university email'].some((term) => verification.includes(term))) {
    if (profile.school_email) { score += 8; reasons.push('School email is available'); }
    else { score -= 5; cautions.push('A school or institutional email may be required'); }
  }

  const [commercialOk, commercialReason] = commercialAssessment(offer, Boolean(profile.commercial_required));
  if (commercialOk && profile.commercial_required) reasons.push(commercialReason);
  if (!commercialOk) { score -= 55; cautions.push(commercialReason); }

  const spec = useCases[useCase];
  if (spec) {
    const haystack = ['category','subcategories','program','benefit_summary','keywords'].map((key) => clean(offer[key])).join(' ').toLowerCase();
    if (spec.terms.includes(clean(offer.category))) { score += 28; reasons.push(`Strong fit for ${spec.label}`); }
    const hits = spec.keywords.filter((term) => haystack.includes(term.toLowerCase())).length;
    score += Math.min(18, hits * 3);
  }
  if (reviewStatuses.has(clean(offer.status))) cautions.push('Live verification required before relying on this offer');
  const verdict = score >= 85 ? 'strong_match' : score >= 60 ? 'likely_match' : score >= 30 ? 'verify' : 'not_recommended';
  return { score, verdict, reasons: reasons.slice(0,4), cautions: cautions.slice(0,4), region_match: regionLevel };
}

function explicitValueUsd(offer) {
  if (!['Credit','Free license','Free period'].includes(clean(offer.benefit_type))) return null;
  const values = [...clean(offer.price_or_value).matchAll(/\$\s*([0-9][0-9,]*(?:\.\d+)?)/g)].map((match) => Number(match[1].replaceAll(',','')));
  return values.length ? Math.max(...values) : null;
}

function serializeOffer(offer, profile, useCase = '') {
  const output = { ...offer, explicit_value_usd: explicitValueUsd(offer) };
  if (profile) output.match = eligibilityScore(offer, profile, useCase);
  return output;
}

function filterOffers(query = {}) {
  const q = clean(query.q).toLowerCase();
  const country = clean(query.country);
  const result = offers.filter((offer) => {
    const haystack = Object.values(offer).map(clean).join(' ').toLowerCase();
    if (q && !haystack.includes(q)) return false;
    if (query.category && clean(offer.category) !== clean(query.category)) return false;
    if (query.access_route && clean(offer.access_route) !== clean(query.access_route)) return false;
    if (query.benefit_type && clean(offer.benefit_type) !== clean(query.benefit_type)) return false;
    if (query.status && clean(offer.status) !== clean(query.status)) return false;
    if (query.confidence && clean(offer.confidence) !== clean(query.confidence)) return false;
    if (query.verification && !clean(offer.verification).toLowerCase().includes(clean(query.verification).toLowerCase())) return false;
    if (country && regionAssessment(offer, country)[0] === 'mismatch') return false;
    if (clean(query.commercial).toLowerCase() === 'yes' && !commercialAssessment(offer, true)[0]) return false;
    return true;
  });
  return result;
}

function counts(field) {
  const tally = new Map();
  for (const offer of offers) {
    const key = clean(offer[field]) || 'Unknown';
    tally.set(key, (tally.get(key) || 0) + 1);
  }
  return [...tally].map(([name,count]) => ({ name, count })).sort((a,b) => b.count - a.count || a.name.localeCompare(b.name));
}

function summary() {
  const values = offers.map(explicitValueUsd).filter((value) => value !== null);
  return {
    metadata: catalog.metadata || {},
    counts: {
      offers: offers.length,
      categories: new Set(offers.map((offer) => clean(offer.category))).size,
      providers: new Set(offers.map((offer) => clean(offer.provider))).size,
      needs_review: offers.filter((offer) => reviewStatuses.has(clean(offer.status))).length,
      high_confidence: offers.filter((offer) => clean(offer.confidence) === 'High').length,
      explicit_value_usd: Math.round(values.reduce((a,b) => a + b, 0) * 100) / 100
    },
    facets: { categories:counts('category'), access_routes:counts('access_route'), benefit_types:counts('benefit_type'), statuses:counts('status'), confidence:counts('confidence') },
    use_cases: Object.entries(useCases).map(([id,value]) => ({ id, label:value.label })),
    discovery_sources: catalog.discovery_sources || []
  };
}

function recommend(profile = {}, useCase = '', limit = 20) {
  const ranked = offers.map((offer) => serializeOffer(offer, profile, useCase)).sort((a,b) => b.match.score - a.match.score || Number(a.agent_priority || 99) - Number(b.agent_priority || 99));
  return {
    profile,
    use_case: useCase,
    use_case_label: useCases[useCase]?.label || 'General discovery',
    recommendations: ranked.filter((offer) => offer.match.verdict !== 'not_recommended').slice(0, limit),
    generated_on: new Date().toISOString().slice(0,10),
    method_note: 'Heuristic ranking only. Open the official source before purchase, activation, or commercial use.'
  };
}

function buildStack(profile = {}, useCase = '', limit = 10) {
  const data = recommend(profile, useCase, 80);
  const chosen = [];
  const providers = new Set();
  const categoryCounts = new Map();
  for (const offer of data.recommendations) {
    if (providers.has(offer.provider)) continue;
    if ((categoryCounts.get(offer.category) || 0) >= 2) continue;
    if (offer.match.score < 45) continue;
    chosen.push(offer);
    providers.add(offer.provider);
    categoryCounts.set(offer.category, (categoryCounts.get(offer.category) || 0) + 1);
    if (chosen.length >= limit) break;
  }
  const value = chosen.reduce((total, offer) => total + (offer.explicit_value_usd || 0), 0);
  return { profile, use_case:useCase, use_case_label:useCases[useCase]?.label || 'Custom stack', offers:chosen, explicit_face_value_usd:Math.round(value * 100) / 100, value_note:'Sum includes only explicit USD values found in credit, free-license, or free-period records; it is not an estimated annual saving.' };
}

function bodyObject(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body); } catch { return {}; }
}

function send(res, status, data) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', status === 200 ? 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600' : 'no-store');
  return res.status(status).json(data);
}

module.exports = { catalog, offers, byId, useCases, reviewStatuses, summary, filterOffers, recommend, buildStack, serializeOffer, bodyObject, send };
