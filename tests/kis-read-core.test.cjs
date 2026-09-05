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
assert.match(edge,/tokenCacheKind/,'같은 앱키를 쓰는 연금저축·IRP는 한투 접근토큰을 재사용해야 한다');

console.log('kis-read core tests: PASS');
