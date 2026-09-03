'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const elements={
 '#sheetEyebrow':{textContent:''},
 '#sheetTitle':{textContent:''},
 '#sheetBody':{innerHTML:''}
};
const signed={value:false};
const context=vm.createContext({
 console,Date,FormData,Promise,String,Number,Set,
 state:{brokerKis:{connections:{pension:{accountId:'ps-main',lastSyncAt:'2026-09-02T00:00:00Z'},irp:{accountId:'irp-main',lastSyncAt:''}}}},
 syncBrokerKisSessionFromCloud:()=>false,
 brokerKisClient:{authState:()=>({configured:true,signedIn:signed.value,expiresAt:0}),signOut:()=>({ok:true})},
 pensionStore:()=>({accounts:[{id:'ps-main',kind:'pension',name:'한국투자 연금저축',status:'active'},{id:'irp-main',kind:'irp',name:'한국투자 IRP',status:'active'}]}),
 $:selector=>elements[selector]||null,
 $$:()=>[],
 escapeHtml:value=>String(value??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c])),
 formatDateTime:value=>value,
 localYmd:()=> '2026-09-02',
 openSheet:()=>{},
 setTimeout:()=>0,
 toast:()=>{}
});
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','ui-settings.js'),'utf8'),context,{filename:'ui-settings.js'});

vm.runInContext('openKisSettings()',context);
assert.match(elements['#sheetBody'].innerHTML,/인증 링크 받기/);
assert.doesNotMatch(elements['#sheetBody'].innerHTML,/이메일 인증번호/);
assert.match(elements['#sheetBody'].innerHTML,/Google 세션을 확인하지 못한 경우에만 이메일 인증을 사용합니다/);
assert.doesNotMatch(elements['#sheetBody'].innerHTML,/data-kis-sync/);
assert.doesNotMatch(elements['#sheetBody'].innerHTML,/appkey|appsecret|계좌번호 입력/i);

signed.value=true;
vm.runInContext('openKisSettings()',context);
const html=elements['#sheetBody'].innerHTML;
assert.match(html,/한국투자 연금저축/);
assert.match(html,/한국투자 IRP/);
assert.match(html,/Google 로그인 세션으로 안전하게 연결됩니다/);
assert.doesNotMatch(html,/연결 인증 해제/);
assert.equal((html.match(/data-kis-sync=/g)||[]).length,2);
assert.match(html,/납입·매매·배당 원장에는 자동으로 더하지 않습니다/);
assert.match(html,/최근 체결은 31일만 조회합니다/);

console.log('kis settings ui tests: PASS');
