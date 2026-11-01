// Decimal boundary values are interpreted as their canonical decimal spelling,
// never multiplied/added as IEEE Numbers for admission. No rounding is allowed.
export const BUDGET_SCALE=100000000000000n;
export const MAX_SQL_INTEGER=9223372036854775807n;
export const KLEIN_UNITS=10940349853515625n;
export function budgetUnits(value){
 const text=typeof value==='number'?String(value):value;
 if(typeof text!=='string'||!/^\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(text))throw Error('budget_precision_unverified');
 const [mantissa,exp='0']=text.toLowerCase().split('e'),[whole,fraction='']=mantissa.split('.');
 const shift=14+Number(exp)-fraction.length;
 if(!Number.isSafeInteger(shift)||Math.abs(shift)>100)throw Error('budget_precision_unverified');
 let units=BigInt(whole+fraction);
 if(shift>=0)units*=10n**BigInt(shift);else{const divisor=10n**BigInt(-shift);if(units%divisor)throw Error('budget_precision_unverified');units/=divisor;}
 if(units>MAX_SQL_INTEGER)throw Error('budget_precision_unverified');return units;
}
export function effectiveBudgetUnits(row){
 const units=budgetUnits(row.reserved_neurons);
 if(row.kind==='image'&&row.status==='success'&&units===3142000000000000n){try{const r=JSON.parse(row.response);if(r?.model==='@cf/black-forest-labs/flux-2-klein-4b'&&r.crop?.width===512&&r.crop?.height===512)return KLEIN_UNITS;}catch{}}
 return units;
}
export const budgetPoolOf=row=>row.kind==='image'||/^(world-vision:|world-retry:)/.test(row.id)?'image':'text';
export function fixedBudgetState(rows,day){const used={text:0n,image:0n};for(const row of rows)if(row.day===day){const pool=budgetPoolOf(row);used[pool]+=effectiveBudgetUnits(row);if(used[pool]>MAX_SQL_INTEGER)throw Error('budget_precision_unverified');}return used;}
// Same authoritative nine-column ledger. The budget view joins a per-row
// precision proof as reserved_units, not a balance/counter. Missing or stale
// proofs block native admission; historical rows are never auto-certified.
export const SQL_EFFECTIVE_UNITS=`CASE WHEN kind='image' AND status='success' AND reserved_units='3142000000000000' AND json_extract(CASE WHEN json_valid(response) THEN response ELSE '{}' END,'$.model')='@cf/black-forest-labs/flux-2-klein-4b' AND json_type(CASE WHEN json_valid(response) THEN response ELSE '{}' END,'$.crop.width') IN ('integer','real') AND json_extract(CASE WHEN json_valid(response) THEN response ELSE '{}' END,'$.crop.width')=512 AND json_type(CASE WHEN json_valid(response) THEN response ELSE '{}' END,'$.crop.height') IN ('integer','real') AND json_extract(CASE WHEN json_valid(response) THEN response ELSE '{}' END,'$.crop.height')=512 THEN 10940349853515625 ELSE CAST(reserved_units AS INTEGER) END`;
export const SQL_IMAGE_POOL=`(kind='image' OR substr(id,1,13)='world-vision:' OR substr(id,1,12)='world-retry:')`;
