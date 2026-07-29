import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
const token=process.env.AIRTABLE_TOKEN;
const baseId=process.env.AIRTABLE_BASE_ID||'appG1mi8PAyxr4DMY';
const tableName=process.env.AIRTABLE_TABLE_NAME||'Offers';
if(!token)throw new Error('AIRTABLE_TOKEN is required.');
const packed=fs.readFileSync(path.join(process.cwd(),'data','catalog.json.gz.b64'),'utf8');
const catalog=JSON.parse(zlib.gunzipSync(Buffer.from(packed,'base64')).toString('utf8'));
const map={offer_id:'Offer ID',provider:'Provider',program:'Program',category:'Category',subcategories:'Subcategories',benefit_type:'Benefit Type',benefit_summary:'Benefit Summary',price_or_value:'Price or Value',duration:'Duration',renewal:'Renewal',student_level:'Student Level',eligibility:'Eligibility',verification:'Verification',region_scope:'Region Scope',region_codes:'Region Codes',access_route:'Access Route',commercial_use:'Commercial Use',status:'Status',status_note:'Status Note',offer_end_date:'Offer End Date',source_url:'Source URL',source_type:'Source Type',last_checked:'Last Checked',next_review:'Next Review',confidence:'Confidence',agent_priority:'Agent Priority',keywords:'Keywords'};
const records=catalog.offers.map((offer)=>({fields:Object.fromEntries(Object.entries(map).flatMap(([source,target])=>offer[source]===''||offer[source]==null?[]:[[target,offer[source]]]))}));
const endpoint=`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;
for(let i=0;i<records.length;i+=10){const batch=records.slice(i,i+10);const r=await fetch(endpoint,{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({performUpsert:{fieldsToMergeOn:['Offer ID']},typecast:true,records:batch})});if(!r.ok)throw new Error(`Airtable ${r.status}: ${await r.text()}`);console.log(`Synchronized ${Math.min(i+10,records.length)}/${records.length}`)}
