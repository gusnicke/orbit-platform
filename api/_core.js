const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const packed = fs.readFileSync(path.join(process.cwd(), 'data', 'catalog.json.gz.b64'), 'utf8');
const catalog = JSON.parse(zlib.gunzipSync(Buffer.from(packed, 'base64')).toString('utf8'));
const offers = catalog.offers || [];
const byId = new Map(offers.map((offer) => [offer.offer_id, offer]));
const useCases = {
  'ai-engineering': { label:'AI engineering', terms:['AI tools','Developer tools','Cloud & infrastructure','Databases','Monitoring & observability'] },
  'web-development': { label:'Web development', terms:['Developer tools','Domains & web hosting','Cloud & infrastructure','Databases','Testing & QA','CI/CD & DevOps'] },
  design: { label:'Design and prototyping', terms:['Design & creative','Collaboration & productivity','CAD, 3D & engineering','Game development & 3D'] },
  'data-science': { label:'Data science', terms:['Data & analytics','Math, science & engineering','Cloud & infrastructure','Developer tools','Databases','Data & APIs'] },
  cybersecurity: { label:'Cybersecurity', terms:['Authentication & security','Developer tools','Cloud & infrastructure','Learning & courses','Monitoring & observability'] },
  research: { label:'Academic research', terms:['Writing & research','Learning & courses','Data & analytics','Math, science & engineering','Collaboration & productivity','Cloud storage'] },
  'content-creation': { label:'Content creation', terms:['Design & creative','Audio & music','Media & subscriptions','Writing & research','Collaboration & productivity'] },
  'student-startup': { label:'Student startup', terms:['Developer tools','Cloud & infrastructure','Domains & web hosting','Design & creative','Collaboration & productivity','Payments & commerce','AI tools'] }
};
const reviewStatuses = new Set(['marketplace_snapshot','paused','expiring_soon','needs_live_verification']);
const european = new Set(['SE','DE','FR','NL','IE','ES','IT','PL','DK','NO','FI','BE','AT','CH','PT','CZ']);
const clean = (value) => String(value ?? '').trim();
function regionAssessment(offer, country) {
  const code = clean(country).toUpperCase();
  if (!code) return ['unknown','Country not supplied'];
  const codes = new Set(clean(offer.region_codes).split(',').map((x) => x.trim().toUpperCase()).filter(Boolean));
  const scope = clean(offer.region_scope).toLowerCase();
  if (codes.has(code) || (code === 'GB' && codes.has('UK'))) return ['exact','Country explicitly listed'];
  if (codes.size && !codes.has('GLOBAL') && !codes.has('GLOBAL_SELECT') && !codes.has(code)) return ['mismatch','Country is not in the explicit region list'];
  if (/global|worldwide|many countries|supported markets|supported regions/.test(scope)) return ['possible','Broad availability; source verification required'];
  if (scope.includes('europe') && european.has(code)) return ['possible','European availability indicated'];
  return ['unknown','Availability must be checked at the source'];
}
function commercialAssessment(offer, required) {
  if (!required) return [true,'Commercial use not required'];
  const text = clean(offer.commercial_use).toLowerCase();
  if (/non-commercial|educational use only|education use only|personal use/.test(text)) return [false,'Terms appear incompatible with commercial work'];
  return [true,'Commercial-use status requires source verification'];
}
const statusWeight = (status) => ({active:25,general_free:18,institution_access:15,marketplace_snapshot:3,needs_live_verification:0,expiring_soon:-10,paused:-45}[status] || 0);
const routeWeight = (route) => ({'Direct vendor':20,'Institution-mediated':15,'GitHub Student Developer Pack':12,'Student Beans':3,'UNiDAYS':3}[route] || 0);
function eligibilityScore(offer, profile={}, useCase='') {
  let score = 25 + (clean(offer.confidence) === 'High' ? 12 : 3) + statusWeight(clean(offer.status)) + routeWeight(clean(offer.access_route));
  const reasons=[], cautions=[];
  const [region, regionReason] = regionAssessment(offer, profile.country);
  if (region === 'exact') { score += 25; reasons.push(regionReason); }
  else if (region === 'possible') { score += 10; reasons.push(regionReason); }
  else if (region === 'mismatch') { score -= 100; cautions.push(regionReason); }
  else cautions.push(regionReason);
  if (offer.access_route === 'GitHub Student Developer Pack') {
    if (profile.github_verified) { score += 18; reasons.push('GitHub Student verification available'); }
    else { score -= 12; cautions.push('Verified GitHub Education account required'); }
  }
  if (/school email|institutional email|university email/i.test(offer.verification || '')) score += profile.school_email ? 8 : -5;
  const [commercialOk, commercialReason] = commercialAssessment(offer, Boolean(profile.commercial_required));
  if (!commercialOk) { score -= 55; cautions.push(commercialReason); }
  if (useCases[useCase]?.terms.includes(clean(offer.category))) { score += 28; reasons.push(`Strong fit for ${useCases[useCase].label}`); }
  if (reviewStatuses.has(clean(offer.status))) cautions.push('Live verification required before relying on this offer');
  const verdict = score >= 85 ? 'strong_match' : score >= 60 ? 'likely_match' : score >= 30 ? 'verify' : 'not_recommended';
  return { score, verdict, reasons:reasons.slice(0,4), cautions:cautions.slice(0,4), region_match:region };
}
function explicitValueUsd(offer) {
  if (!['Credit','Free license','Free period'].includes(clean(offer.benefit_type))) return null;
  const values = [...clean(offer.price_or_value).matchAll(/\$\s*([0-9][0-9,]*(?:\.\d+)?)/g)].map((m) => Number(m[1].replaceAll(',','')));
  return values.length ? Math.max(...values) : null;
}
function serializeOffer(offer, profile, useCase='') { const out={...offer,explicit_value_usd:explicitValueUsd(offer)}; if(profile) out.match=eligibilityScore(offer,profile,useCase); return out; }
function filterOffers(query={}) {
  const q=clean(query.q).toLowerCase(), country=clean(query.country);
  return offers.filter((offer) => {
    if (q && !Object.values(offer).map(clean).join(' ').toLowerCase().includes(q)) return false;
    for (const key of ['category','access_route','benefit_type','status','confidence']) if (query[key] && clean(offer[key]) !== clean(query[key])) return false;
    if (query.verification && !clean(offer.verification).toLowerCase().includes(clean(query.verification).toLowerCase())) return false;
    if (country && regionAssessment(offer,country)[0] === 'mismatch') return false;
    if (clean(query.commercial).toLowerCase() === 'yes' && !commercialAssessment(offer,true)[0]) return false;
    return true;
  });
}
function counts(field){const tally=new Map();for(const offer of offers){const key=clean(offer[field])||'Unknown';tally.set(key,(tally.get(key)||0)+1)}return [...tally].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name))}
function summary(){const values=offers.map(explicitValueUsd).filter((v)=>v!==null);return{metadata:catalog.metadata||{},counts:{offers:offers.length,categories:new Set(offers.map((o)=>clean(o.category))).size,providers:new Set(offers.map((o)=>clean(o.provider))).size,needs_review:offers.filter((o)=>reviewStatuses.has(clean(o.status))).length,high_confidence:offers.filter((o)=>clean(o.confidence)==='High').length,explicit_value_usd:Math.round(values.reduce((a,b)=>a+b,0)*100)/100},facets:{categories:counts('category'),access_routes:counts('access_route'),benefit_types:counts('benefit_type'),statuses:counts('status'),confidence:counts('confidence')},use_cases:Object.entries(useCases).map(([id,v])=>({id,label:v.label})),discovery_sources:catalog.discovery_sources||[]}}
function recommend(profile={},useCase='',limit=20){const ranked=offers.map((o)=>serializeOffer(o,profile,useCase)).sort((a,b)=>b.match.score-a.match.score);return{profile,use_case:useCase,use_case_label:useCases[useCase]?.label||'General discovery',recommendations:ranked.filter((o)=>o.match.verdict!=='not_recommended').slice(0,limit),generated_on:new Date().toISOString().slice(0,10),method_note:'Heuristic ranking only. Open the official source before purchase, activation, or commercial use.'}}
function buildStack(profile={},useCase='',limit=10){const data=recommend(profile,useCase,80),chosen=[],providers=new Set(),categoryCounts=new Map();for(const offer of data.recommendations){if(providers.has(offer.provider)||(categoryCounts.get(offer.category)||0)>=2||offer.match.score<45)continue;chosen.push(offer);providers.add(offer.provider);categoryCounts.set(offer.category,(categoryCounts.get(offer.category)||0)+1);if(chosen.length>=limit)break}return{profile,use_case:useCase,use_case_label:useCases[useCase]?.label||'Custom stack',offers:chosen,explicit_face_value_usd:Math.round(chosen.reduce((t,o)=>t+(o.explicit_value_usd||0),0)*100)/100,value_note:'Only explicit USD face values are summed.'}}
function bodyObject(req){if(!req.body)return{};if(typeof req.body==='object')return req.body;try{return JSON.parse(req.body)}catch{return{}}}
function send(res,status,data){res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control',status===200?'public, max-age=0, s-maxage=300, stale-while-revalidate=3600':'no-store');return res.status(status).json(data)}
module.exports={catalog,offers,byId,useCases,reviewStatuses,summary,filterOffers,recommend,buildStack,serializeOffer,bodyObject,send};
