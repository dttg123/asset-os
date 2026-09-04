'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const context=vm.createContext({console,Date,Set,Map,URL,encodeURIComponent});
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','broker-kis.js'),'utf8'),context,{filename:'broker-kis.js'});
const call=(name,...args)=>vm.runInContext(`${name}(...__args)`,Object.assign(context,{__args:args}));
const plain=value=>JSON.parse(JSON.stringify(value));

function sample(overrides={}){
 return{orderDate:'2026-08-31',orderTime:'101500',branchNo:'001',orderNo:'12345',productCode:'ETF001',productName:'테스트 ETF',exchangeCode:'KRX',side:'buy',orderQty:100,filledQty:30,filledAmount:300000,remainingQty:70,cancelledQty:0,...overrides}
}

{
 const store=call('brokerKisEmptyStore');
 const first=plain(call('brokerKisImportOrderSnapshots',store,[sample()],'pension','ps-main','2026-09-01T00:00:00Z'));
 const second=plain(call('brokerKisImportOrderSnapshots',store,[sample()],'pension','ps-main','2026-09-01T00:01:00Z'));
 assert.deepEqual(first,{inserted:1,updated:0,skipped:0,rejected:0,total:1});
 assert.deepEqual(second,{inserted:0,updated:0,skipped:1,rejected:0,total:1});
 assert.equal(store.orders.length,1,'동일 조회를 반복해도 주문은 1건이어야 한다');
 assert.equal(store.orders[0].status,'partial');
}

{
 const store=call('brokerKisEmptyStore');
 call('brokerKisImportOrderSnapshots',store,[sample()],'pension','ps-main','2026-09-01T00:00:00Z');
 const result=plain(call('brokerKisImportOrderSnapshots',store,[sample({filledQty:100,filledAmount:1020000,remainingQty:0})],'pension','ps-main','2026-09-01T07:00:00Z'));
 assert.equal(result.updated,1);
 assert.equal(store.orders.length,1,'부분체결 갱신은 새 주문을 만들면 안 된다');
 assert.equal(store.orders[0].filledQty,100);
 assert.equal(store.orders[0].avgPrice,10200);
 assert.equal(store.orders[0].status,'filled');
 assert.equal(store.orders[0].revisions.length,1,'부분체결 원본 상태는 revision으로 보존해야 한다');
}

{
 const store=call('brokerKisEmptyStore');
 call('brokerKisImportOrderSnapshots',store,[sample(),sample({orderDate:'2026-09-01'}),sample({productCode:'ETF002'}),sample({side:'sell'})],'pension','ps-main','2026-09-01T07:00:00Z');
 assert.equal(store.orders.length,4,'날짜·종목·매수매도가 다르면 별도 주문이어야 한다');
 assert.equal(new Set(store.orders.map(x=>x.orderKey)).size,4);
}

{
 const store=call('brokerKisEmptyStore');
 call('brokerKisImportOrderSnapshots',store,[sample({filledQty:30,remainingQty:0,cancelled:true,cancelledQty:70})],'irp','irp-main','2026-09-01T07:00:00Z');
 assert.equal(store.orders[0].status,'partial_cancelled');
 assert.equal(store.orders[0].filledQty,30,'취소된 미체결 수량은 체결수량에 합산하면 안 된다');
}

{
 const store=call('brokerKisEmptyStore');
 call('brokerKisImportOrderSnapshots',store,[sample({filledQty:10,filledAmount:105000,remainingQty:0})],'pension','ps-main','2026-09-01T07:00:00Z');
 call('brokerKisImportOrderSnapshots',store,[sample({orderNo:'54321',filledQty:2,filledAmount:22000,remainingQty:0})],'irp','irp-main','2026-09-01T07:01:00Z');
 const all=plain(call('brokerKisVisibleOrders',store,'all')),irp=plain(call('brokerKisVisibleOrders',store,'irp'));
 assert.equal(all.length,2);assert.equal(irp.length,1);assert.equal(irp[0].amount,22000);assert.equal(irp[0].brokerOrder,true);
 call('brokerKisMatchOrder',store,store.orders[1].orderKey,'ptx-existing','2026-09-01T08:00:00Z');
 assert.equal(plain(call('brokerKisVisibleOrders',store,'all')).length,1,'원장과 매칭된 체결은 거래 화면에서 중복 표시하면 안 된다');
}

{
 const store=call('brokerKisEmptyStore');
 call('brokerKisImportOrderSnapshots',store,[sample({filledQty:100,filledAmount:1000000,remainingQty:0,appKey:'DO_NOT_STORE',appSecret:'DO_NOT_STORE',token:'DO_NOT_STORE',cano:'DO_NOT_STORE'})],'pension','ps-main','2026-09-01T07:00:00Z');
 call('brokerKisLinkInstrument',store,{accountId:'ps-main',productCode:'ETF001',holdingId:'holding-1',linkedAt:'2026-09-01T07:01:00Z'});
 const draft=plain(call('brokerKisLedgerDraft',store,store.orders[0].orderKey));
 assert.equal(draft.type,'buy');
 assert.equal(draft.qty,100);
 assert.equal(draft.price,10000);
 assert.equal(draft.source,'kis');
 assert.equal(draft.brokerOrderKey,store.orders[0].orderKey);
 assert.equal('contribution' in draft,false,'KIS 매매가 납입 원장을 만들면 안 된다');
 const serialized=JSON.stringify(store);
 for(const secret of ['DO_NOT_STORE','appSecret','appKey','token','cano'])assert.equal(serialized.includes(secret),false,`${secret} 값/필드는 저장하면 안 된다`);
}

{
 const dirty={connections:{pension:{accountId:'ps-main',lastSyncAt:'2026-09-01T07:00:00Z',lastError:'',appKey:'LEAK',appSecret:'LEAK',token:'LEAK',cano:'LEAK'}}};
 const normalized=plain(call('normalizeBrokerKis',dirty));
 assert.deepEqual(normalized.connections.pension,{accountId:'ps-main',lastSyncAt:'2026-09-01T07:00:00.000Z',orderSyncThrough:'',lastError:''});
 const serialized=JSON.stringify(normalized);
 for(const secret of ['LEAK','appSecret','appKey','token','cano'])assert.equal(serialized.includes(secret),false,`연결 메타데이터에 ${secret} 값을 저장하면 안 된다`);
}

{
 const store=call('brokerKisEmptyStore');
 const first=call('brokerKisImportBalanceSnapshot',store,{cash:500000,securitiesValue:1500000,totalValue:2000000,holdings:[{productCode:'ETF001',productName:'테스트',quantity:10,avgPrice:100000,currentPrice:150000,marketValue:1500000}]},'pension','ps-main','2026-09-01T01:00:00Z');
 const second=call('brokerKisImportBalanceSnapshot',store,{cash:400000,securitiesValue:1600000,totalValue:2000000,holdings:[{productCode:'ETF001',productName:'테스트',quantity:10,avgPrice:100000,currentPrice:160000,marketValue:1600000}]},'pension','ps-main','2026-09-01T09:00:00Z');
 assert.equal(first.replaced,false);assert.equal(second.replaced,true);assert.equal(store.balanceSnapshots.length,1,'같은 날 잔고는 최신값으로 교체해야 한다');
 const latest=plain(call('brokerKisLatestBalance',store,'pension','ps-main'));
 assert.equal(latest.cash,400000);assert.equal(latest.totalValue,2000000);
 assert.equal(store.connections.pension.accountId,'ps-main');assert.equal(store.connections.pension.lastSyncAt,'2026-09-01T09:00:00.000Z');
 assert.equal(call('brokerKisCurrentKindTotal',store,'pension',['ps-main']).totalValue,2000000);
 assert.equal(call('brokerKisCurrentKindTotal',store,'pension',['ps-main','ps-second']),null,'일부 계좌만 조회됐으면 전체 현재값을 교체하면 안 된다');
}

{
 const store=call('brokerKisEmptyStore'),row={rightTypeCode:'32',baseDate:'2026-08-01',cashPaymentDate:'2026-08-20',productCode:'ETF001',productName:'테스트',amount:10000,tax:0};
 const first=plain(call('brokerKisImportRights',store,[row],'pension','ps-main','2026-09-01T01:00:00Z'));
 const duplicate=plain(call('brokerKisImportRights',store,[row],'pension','ps-main','2026-09-01T02:00:00Z'));
 const correction=plain(call('brokerKisImportRights',store,[{...row,amount:11000}],'pension','ps-main','2026-09-01T03:00:00Z'));
 assert.equal(first.inserted,1);assert.equal(duplicate.skipped,1);assert.equal(correction.updated,1);assert.equal(store.rights.length,1);
 assert.equal(store.rights[0].amount,11000);assert.equal(store.rights[0].revisions.length,1);
 assert.equal(store.rights[0].classification,'unclassified_cash_right','권리코드 32를 검증 없이 배당으로 자동 분류하면 안 된다');
 assert.equal(store.connections.pension.lastSyncAt,'2026-09-01T03:00:00.000Z');
}

{
 const store=call('brokerKisEmptyStore');
 call('brokerKisImportOrderSnapshots',store,[sample({filledQty:100,filledAmount:1000000,remainingQty:0})],'pension','ps-main','2026-09-01T07:00:00Z');
 const normalized=plain(call('normalizeBrokerKis',plain(store)));
 assert.deepEqual(normalized,plain(store),'저장→정규화 Round Trip에서 KIS 데이터가 변하면 안 된다');
 assert.deepEqual(plain(call('brokerKisIssues',normalized)),[]);
}

{
 const store=call('brokerKisEmptyStore');
 const begun=plain(call('brokerKisBeginHistory',store,{accountKind:'pension',accountId:'ps-main',startDate:'2020-01-01',targetDate:'2026-09-03',updatedAt:'2026-09-03T00:00:00Z'}));
 assert.equal(begun.ok,true);assert.equal(store.history.pension.status,'running');assert.equal(store.history.pension.startDate,'2020-01-01');
 call('brokerKisUpdateHistory',store,{accountKind:'pension',orderThrough:'2020-01-31',status:'paused',lastError:'NETWORK',updatedAt:'2026-09-03T00:01:00Z'});
 const resumed=plain(call('brokerKisBeginHistory',store,{accountKind:'pension',accountId:'ps-main',startDate:'2020-01-01',targetDate:'2026-09-03',updatedAt:'2026-09-03T00:02:00Z'}));
 assert.equal(resumed.history.orderThrough,'2020-01-31','같은 계좌·시작일 재시도는 완료 구간을 보존해야 한다');assert.equal(resumed.history.lastError,'');
 call('brokerKisUpdateHistory',store,{accountKind:'pension',orderThrough:'2026-09-03',rightsThrough:'2026-09-03',status:'complete',updatedAt:'2026-09-03T00:03:00Z'});
 const normalized=plain(call('normalizeBrokerKis',plain(store)));assert.equal(normalized.history.pension.status,'complete');assert.equal(normalized.history.pension.orderThrough,'2026-09-03');
 const reset=plain(call('brokerKisBeginHistory',store,{accountKind:'pension',accountId:'ps-main',startDate:'2021-01-01',targetDate:'2026-09-03',updatedAt:'2026-09-03T00:04:00Z'}));
 assert.equal(reset.history.orderThrough,'','시작일 변경은 이전 진행 커서를 재사용하면 안 된다');
}

{
 const store=call('brokerKisEmptyStore');
 for(let day=0;day<150;day++){const date=new Date(Date.UTC(2020,0,1+day)).toISOString().slice(0,10);call('brokerKisImportBalanceSnapshot',store,{cash:day,totalValue:day},'pension','ps-main',`${date}T00:00:00Z`)}
 const normalized=plain(call('normalizeBrokerKis',plain(store)));
 assert.equal(normalized.balanceSnapshots.length,150,'장기 잔고 이력을 120개에서 잘라내면 안 된다');
}

{
 const store=call('brokerKisEmptyStore'),rows=[];
 for(let i=0;i<1000;i++){const date=new Date(Date.UTC(2020,0,1+i)).toISOString().slice(0,10);rows.push(sample({orderDate:date,orderNo:String(100000+i),filledQty:1,filledAmount:10000,remainingQty:0}))}
 const first=plain(call('brokerKisImportOrderSnapshots',store,rows,'pension','ps-main','2026-09-03T01:00:00Z'));
 const second=plain(call('brokerKisImportOrderSnapshots',store,rows,'pension','ps-main','2026-09-03T02:00:00Z'));
 assert.equal(first.inserted,1000);assert.equal(second.skipped,1000);assert.equal(store.orders.length,1000,'장기 체결 재조회에서 중복이 생기거나 과거 건이 잘리면 안 된다');
 assert.equal(plain(call('normalizeBrokerKis',plain(store))).orders.length,1000);
}

console.log('broker-kis tests: PASS');
