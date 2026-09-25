const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

let source=fs.readFileSync('supabase/functions/kis-read/core.js','utf8').replaceAll('export function ','function ');
source+='\nthis.api={normalizeOrders,normalizeBalance,normalizeQuote,normalizeRights,safeRange,koreaDate};';
const context=vm.createContext({Date,Number,String,Math,RegExp,Array,Object,Error});
new vm.Script(source).runInContext(context);
const {normalizeOrders,normalizeBalance,normalizeQuote,normalizeRights,safeRange,koreaDate}=context.api;

const orders=normalizeOrders([{ord_dt:'20260902',ord_tmd:'101500',ord_gno_brno:'1',odno:'2',pdno:'A',prdt_name:'ETF',sll_buy_dvsn_cd:'02',ord_qty:'10',tot_ccld_qty:'3',tot_ccld_amt:'3000',nccs_qty:'7'}]);
assert.equal(orders.length,1);
assert.equal(orders[0].side,'buy');
assert.equal(orders[0].filledQty,3);
assert.equal(orders[0].filledAmount,3000);
assert.equal(orders[0].remainingQty,7);

const balance=normalizeBalance({output1:[{pdno:'A',prdt_name:'ETF',hldg_qty:'2',pchs_avg_pric:'100',prpr:'120',evlu_amt:'240',evlu_pfls_amt:'40'}],output2:[{dnca_tot_amt:'60',prvs_rcdl_excc_amt:'20',nxdy_excc_amt:'20',thdt_buy_amt:'40',scts_evlu_amt:'240',tot_evlu_amt:'300'}]},'2026-09-02T00:00:00Z');
assert.equal(balance.cash,60);
assert.equal(balance.securitiesValue,240);
assert.equal(balance.totalValue,300);
assert.equal(balance.holdings.length,1);
assert.equal(balance.cashDetail.depositCash,60);
assert.equal(balance.cashDetail.todayBuyAmount,40);
assert.equal(balance.cashDetail.availableCash,20);
assert.throws(()=>normalizeBalance({output1:[],output2:[]},'2026-09-02T00:00:00Z'),/KIS_BALANCE_INVALID/,'요약이 없는 빈 응답은 실제 0원으로 저장하면 안 된다');
assert.equal(koreaDate('2026-09-01T16:00:00Z'),'2026-09-02','한국 자정 전후 응답은 UTC 날짜가 아니라 한국 영업일로 저장해야 한다');

const rights=normalizeRights([{rght_type_cd:'32',bass_dt:'20260801',cash_dfrm_dt:'20260815',pdno:'A',prdt_name:'ETF',last_alct_amt:'50',tax_amt:'5'}]);
assert.equal(rights.length,1);
assert.equal(rights[0].amount,50);
assert.equal(rights[0].tax,5);
assert.equal(rights[0].classification,undefined);

assert.deepEqual(JSON.parse(JSON.stringify(normalizeQuote({stck_shrn_iscd:'035720',hts_kor_isnm:'카카오',stck_prpr:'35900',stck_sdpr:'35500'},'stock','035720'))),{type:'stock',code:'035720',name:'카카오',price:35900,previousClose:35500});
assert.deepEqual(JSON.parse(JSON.stringify(normalizeQuote({stnd_iscd:'KR6055553E12',hts_kor_isnm:'신한금융조건부(상)15',bond_prpr:'10222.7',bond_prdy_clpr:'10220'},'bond','KR6055553E12'))),{type:'bond',code:'KR6055553E12',name:'신한금융조건부(상)15',price:10222.7,previousClose:10220});
assert.equal(normalizeQuote({stck_prpr:'0'},'stock','035720'),null);

assert.deepEqual(JSON.parse(JSON.stringify(safeRange('2026-08-01','2026-08-31',31,31,new Date('2026-09-02T00:00:00Z')))),{from:'20260801',to:'20260831'});
assert.throws(()=>safeRange('2026-01-01','2026-09-01',31,31),/DATE_RANGE_INVALID/);

const edge=fs.readFileSync('supabase/functions/kis-read/index.ts','utf8');
assert.ok(edge.includes("env('ASSET_OS_OWNER_USER_ID')"));
assert.ok(edge.includes("env('ASSET_OS_ALLOWED_ORIGINS')"));
assert.ok(!/\b\d{8}-\d{2}\b/.test(edge),'account number literal must not exist');
assert.ok(!/KIS_(?:PENSION|IRP)_APP_(?:KEY|SECRET)\s*=/.test(edge),'KIS secret literal must not exist');
assert.ok(!edge.includes('tokenSource'),'token source must not be returned to caller');
assert.ok(!edge.includes('accessToken:'),'token must not be returned to caller');
assert.ok(!edge.includes('CANO: input'),'client account number must never be accepted');
assert.match(edge,/FHKBJ773400C0/,'official KIS domestic bond quote TR id required');
assert.match(edge,/FHKST01010100/,'official KIS domestic stock quote TR id required');
assert.match(edge,/firstBody/,'다중 페이지 잔고 조회에서 첫 페이지 합계 정보를 보존해야 한다');
assert.match(edge,/appkey: sharedKey \|\| env\('KIS_PENSION_APP_KEY'\)/,'연금저축·IRP는 하나의 한투 앱키를 사용해야 한다');
assert.match(edge,/appsecret: sharedSecret \|\| env\('KIS_PENSION_APP_SECRET'\)/,'연금저축·IRP는 하나의 한투 앱시크릿을 사용해야 한다');
assert.match(edge,/!!sharedKey !== !!sharedSecret/,'공용 앱키와 시크릿은 반드시 한 쌍으로 검증해야 한다');
assert.match(edge,/cano: env\(prefix \+ 'CANO'\)/,'연금저축·IRP 계좌번호는 계좌 종류별로 분리되어야 한다');
assert.match(edge,/productCode: env\(prefix \+ 'ACNT_PRDT_CD'\)/,'연금저축·IRP 상품코드는 계좌 종류별로 분리되어야 한다');
assert.doesNotMatch(edge,/env\(prefix \+ 'APP_(?:KEY|SECRET)'\)/,'계좌별 앱키로 분기해 토큰을 두 번 발급하면 안 된다');
assert.match(edge,/function tokenCacheKind\(\): AccountKind \{\s*return 'pension'\s*\}/,'모든 투자계좌 요청은 하나의 접근토큰 캐시를 사용해야 한다');
assert.match(edge,/KIS_REQUEST_TIMEOUT_MS/,'한투 요청은 제한시간이 있어야 한다');
assert.match(edge,/KIS_TOKEN_INVALID/,'무효 토큰을 구분해야 한다');
assert.match(edge,/await invalidateToken\(token\)[\s\S]*token = await accessToken/,'무효 토큰은 폐기 후 한 번 재발급해야 한다');

const accountConfigSource=edge.match(/function accountConfig\(accountKind: AccountKind\): AccountConfig \{[\s\S]*?\n\}/)?.[0]
  .replace('accountKind: AccountKind','accountKind').replace('): AccountConfig',')');
assert.ok(accountConfigSource,'계좌 설정 함수를 검사할 수 있어야 한다');
const secretValues={KIS_PENSION_APP_KEY:'one-key',KIS_PENSION_APP_SECRET:'one-secret',KIS_PENSION_CANO:'pension-cano',KIS_PENSION_ACNT_PRDT_CD:'29',KIS_IRP_CANO:'irp-cano',KIS_IRP_ACNT_PRDT_CD:'29'};
const configContext=vm.createContext({Deno:{env:{get:name=>secretValues[name]}},env:name=>{if(!secretValues[name])throw new Error('missing');return secretValues[name]}});
new vm.Script(`${accountConfigSource};this.accountConfig=accountConfig`).runInContext(configContext);
const pensionConfig=configContext.accountConfig('pension'),irpConfig=configContext.accountConfig('irp');
assert.equal(pensionConfig.appkey,irpConfig.appkey,'두 계좌는 동일한 앱키를 사용해야 한다');
assert.equal(pensionConfig.appsecret,irpConfig.appsecret,'두 계좌는 동일한 앱시크릿을 사용해야 한다');
assert.notEqual(pensionConfig.cano,irpConfig.cano,'두 계좌의 계좌번호는 절대 합치면 안 된다');
assert.equal(pensionConfig.cano,'pension-cano');
assert.equal(irpConfig.cano,'irp-cano');

const migration=fs.readFileSync('supabase/migrations/202609250001_harden_kis_token_cache.sql','utf8');
assert.match(migration,/insert into public\.kis_token_cache/,'토큰 캐시 행이 없어도 생성돼야 한다');
assert.match(migration,/on conflict \(account_type\) do update/,'동시 발급 잠금은 원자적으로 갱신돼야 한다');
assert.match(migration,/revoke all on function public\.claim_kis_token_refresh\(text\) from public, anon, authenticated/,'공개 사용자는 토큰 잠금 함수를 호출할 수 없어야 한다');
assert.match(migration,/grant execute on function public\.claim_kis_token_refresh\(text\) to service_role/,'Edge service role만 잠금 함수를 호출해야 한다');

console.log('kis-read core tests: PASS');
