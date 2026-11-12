declare function crc32(bytes:Uint8Array):number;
type BanksaladRow={
 date:string;time:string;sourceType:string;group:string;category:string;name:string;amount:number;method:string;memo:string;origin?:'screenshot';
};
const banksaladHeaders=['날짜','시간','타입','대분류','소분류','내용','금액','화폐','결제수단','메모'];
const banksaladMaxFile=8*1024*1024;
const banksaladMaxXml=12*1024*1024;

function banksaladXmlElements(node:Document|Element,name:string):Element[]{
 return Array.from(node.getElementsByTagNameNS('*',name));
}
function banksaladZip(bytes:Uint8Array<ArrayBuffer>){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const invalid=()=>new Error('뱅크샐러드에서 받은 .xlsx 원본 파일을 선택해 주세요.');
 let end=bytes.length-22;
 const first=Math.max(0,end-65535);
 for(;end>=first;end--)if(view.getUint32(end,true)===0x06054b50&&end+22+view.getUint16(end+20,true)===bytes.length)break;
 if(end<first||view.getUint32(end+4,true)!==0)throw invalid();
 const count=view.getUint16(end+10,true),centralStart=view.getUint32(end+16,true);
 const centralEnd=centralStart+view.getUint32(end+12,true);
 if(count>1024||count!==view.getUint16(end+8,true)||centralEnd>end)throw invalid();
 const decoder=new TextDecoder(),entries=new Map<string,number>();
 let offset=centralStart;
 for(let index=0;index<count;index++){
  if(offset+46>centralEnd||view.getUint32(offset,true)!==0x02014b50)throw invalid();
  const nameEnd=offset+46+view.getUint16(offset+28,true);
  const next=nameEnd+view.getUint16(offset+30,true)+view.getUint16(offset+32,true);
  if(next>centralEnd)throw invalid();
  const name=decoder.decode(bytes.subarray(offset+46,nameEnd));
  if(entries.has(name))throw invalid();
  entries.set(name,offset);offset=next;
 }
 let expanded=0;
 return {
  has:(name:string)=>entries.has(name),
  async xml(name:string){
   const entry=entries.get(name);
   if(entry===undefined)throw invalid();
   const method=view.getUint16(entry+10,true),size=view.getUint32(entry+24,true);
   const packed=view.getUint32(entry+20,true),local=view.getUint32(entry+42,true);
   expanded+=size;
   if(expanded>banksaladMaxXml||local+30>centralStart||view.getUint32(local,true)!==0x04034b50||
      (view.getUint16(entry+8,true)&1)||method!==view.getUint16(local+8,true))throw invalid();
   const start=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true);
   if(start+packed>centralStart||(method!==0&&method!==8))throw invalid();
   const payload=bytes.subarray(start,start+packed),result=method===0?payload:new Uint8Array(size);
   if(method===8){
    if(typeof DecompressionStream==='undefined')throw new Error('엑셀을 열려면 브라우저를 업데이트해 주세요.');
    const reader=new Blob([payload]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
    let written=0;
    try{
     for(;;){
      const chunk=await reader.read();
      if(chunk.done)break;
      if(written+chunk.value.length>size)throw invalid();
      result.set(chunk.value,written);written+=chunk.value.length;
     }
    }finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
    if(written!==size)throw invalid();
   }
   if(result.length!==size||crc32(result)!==view.getUint32(entry+16,true))throw invalid();
   const text=decoder.decode(result);
   if(/<!DOCTYPE/i.test(text))throw invalid();
   const document=new DOMParser().parseFromString(text,'application/xml');
   if(banksaladXmlElements(document,'parsererror').length)throw invalid();
   return document;
  }
 };
}
function banksaladDate(value:string,date1904=false):string{
 if(/^\d+(?:\.0+)?$/.test(value)){
  const serial=Number(value);
  if(serial<0||serial>100000)return '';
  return new Date(Date.UTC(1899,11,30)+(serial+(date1904?1462:0))*86400000).toISOString().slice(0,10);
 }
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return '';
 const date=new Date(value+'T00:00:00Z');
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value?value:'';
}
function banksaladTime(value:string):string{
 if(!value)return '';
 if(/^\d{2}:\d{2}(?::\d{2})?$/.test(value)){
  const [h,m,s=0]=value.split(':').map(Number);
  return h<24&&m<60&&s<60?[h,m,s].map(n=>String(n).padStart(2,'0')).join(':'):'';
 }
 const fraction=Number(value);
 if(!Number.isFinite(fraction)||fraction<0||fraction>=1)return '';
 const seconds=Math.min(86399,Math.round(fraction*86400));
 return [Math.floor(seconds/3600),Math.floor(seconds%3600/60),seconds%60].map(n=>String(n).padStart(2,'0')).join(':');
}
async function readBanksaladFile(file:File):Promise<BanksaladRow[]>{
 if(!/\.xlsx$/i.test(file.name)||!file.size||file.size>banksaladMaxFile)throw new Error('8MB 이하의 뱅크샐러드 .xlsx 파일을 선택해 주세요.');
 const zip=banksaladZip(new Uint8Array(await file.arrayBuffer()));
 const [workbook,links,strings]=await Promise.all([
  zip.xml('xl/workbook.xml'),zip.xml('xl/_rels/workbook.xml.rels'),
  zip.has('xl/sharedStrings.xml')?zip.xml('xl/sharedStrings.xml'):null
 ]);
 const sheet=banksaladXmlElements(workbook,'sheet').find(node=>node.getAttribute('name')==='가계부 내역');
 const id=sheet?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
 const link=banksaladXmlElements(links,'Relationship').find(node=>node.getAttribute('Id')===id);
 const target=link?.getAttribute('Target')||'';
 if(!/^(?:\/xl\/)?worksheets\/[\w.-]+\.xml$/.test(target)||link?.getAttribute('TargetMode')==='External')throw new Error('가계부 내역 시트를 찾지 못했어요.');
 const shared=strings?banksaladXmlElements(strings,'si').map(node=>banksaladXmlElements(node,'t').map(t=>t.textContent||'').join('')):[];
 const worksheet=await zip.xml(target.startsWith('/')?target.slice(1):'xl/'+target);
 const date1904=/^(?:1|true)$/.test(banksaladXmlElements(workbook,'workbookPr')[0]?.getAttribute('date1904')||'');
 const data=banksaladXmlElements(worksheet,'sheetData')[0],rows=data?banksaladXmlElements(data,'row'):[];
 const values=(row:Element)=>{
  const cells=Array<string>(10).fill('');
  for(const cell of banksaladXmlElements(row,'c')){
   const address=/^([A-J])\d+$/.exec(cell.getAttribute('r')||'');
   if(!address)continue;
   if(banksaladXmlElements(cell,'f').length)throw new Error('수식이 있는 가계부는 열 수 없어요. 내려받은 원본을 선택해 주세요.');
   const type=cell.getAttribute('t'),value=banksaladXmlElements(cell,'v')[0]?.textContent||'';
   cells[address[1].charCodeAt(0)-65]=(type==='s'?shared[Number(value)]??'':type==='inlineStr'?
    banksaladXmlElements(cell,'t').map(t=>t.textContent||'').join(''):value).trim();
  }
  return cells;
 };
 if(!rows.length||values(rows[0]).some((value,index)=>value!==banksaladHeaders[index]))throw new Error('가계부 열 구성이 달라서 열 수 없어요.');
 const result:BanksaladRow[]=[];
 for(const row of rows.slice(1)){
  const cells=values(row);
  if(cells.every(value=>!value))continue;
  const [rawDate,rawTime,sourceType,group,category,name,rawAmount,currency,method,memo]=cells;
  const date=banksaladDate(rawDate,date1904),time=banksaladTime(rawTime),amount=Number(rawAmount);
  if(!date||(rawTime&&!time)||!sourceType||!rawAmount||!Number.isSafeInteger(amount)||currency!=='KRW'){
   throw new Error('가계부 '+row.getAttribute('r')+'행의 날짜·시간·유형·금액·통화를 확인해 주세요.');
  }
  result.push({date,time,sourceType,group,category,name,amount,method,memo});
 }
 if(!result.length)throw new Error('파일에 거래가 없어요.');
 return result.sort((a,b)=>b.date.localeCompare(a.date)||b.time.localeCompare(a.time));
}
function banksaladSourceKey(row:BanksaladRow):string{
 return JSON.stringify([row.date,row.time,row.sourceType,row.name,row.amount,row.method]);
}
function banksaladRowKind(row:BanksaladRow):string{
 if(row.group==='카드대금')return 'payment';
 if(row.sourceType==='지출')return row.amount>0?'refund':'purchase';
 return 'other';
}

declare const QA_MODE:boolean;
type BanksaladLedgerRow={
 id:string;date:string;type:string;amount?:number;fromAccountId?:string;toAccountId?:string;accountId?:string;
 note?:string;category?:string;liabilityId?:string;meta?:Record<string,unknown>
};
declare function integratedStore():{
 accounts:Array<{id:string;name:string;kind?:string}>;ledger:BanksaladLedgerRow[];
};
declare function cardAccounts():Array<{id:string;name:string;issuer?:string;archived?:boolean}>;
declare function runStoredCommand<T>(command:()=>Promise<T>):Promise<T>;
declare function cardCommit(change:()=>void):Promise<boolean>;
declare function stageCardPurchase(input:Record<string,unknown>):string;
declare function stageCardRefund(id:string,input:Record<string,unknown>):string;
declare function uid(prefix:string):string;
declare function postedDateError(value:unknown):string;
declare function cardMoney(value:unknown):number;
type BanksaladDraft=
 {kind:'purchase';cardId:string;firstPaymentDate:string}|
 {kind:'refund';originalKey:string}|
 {kind:'payment';cardId:string;accountId:string;balanceConfirmed:boolean};
type BanksaladReviewedRow=BanksaladRow&{saved:boolean;issues:string[]};
const banksaladDuplicateIssue='파일 안에 같은 거래 후보';
const banksaladExistingIssue='기존 원장과 중복 후보';

function banksaladReview(rows:BanksaladRow[]):BanksaladReviewedRow[]{
 const keyCounts=new Map<string,number>(),ledger=integratedStore().ledger;
 for(const row of rows){const key=banksaladSourceKey(row);keyCounts.set(key,(keyCounts.get(key)||0)+1)}
 const primary=new Map<string,BanksaladLedgerRow>();
 const payments=new Map<string,{date:string;cardId:string;amount:number}>();
 for(const entry of ledger){
  if(entry.meta?.qaFixture)continue;
  if(typeof entry.meta?.banksaladSourceKey==='string'&&entry.meta?.banksaladPrimary)primary.set(entry.meta.banksaladSourceKey,entry);
  if(entry.fromAccountId&&['debtPrincipal','debtInterest'].includes(entry.type)){
   const event=String(entry.meta?.cardEventId||(entry.meta?.scheduleId?entry.meta.scheduleId+' '+entry.meta.scheduleDate:entry.id));
   const key=entry.date+' '+event,existing=payments.get(key)||{date:entry.date,cardId:String(entry.meta?.cardId||''),amount:0};
   existing.amount+=Number(entry.amount)||0;payments.set(key,existing);
  }
 }
 return rows.map(row=>{
  const key=banksaladSourceKey(row),kind=banksaladRowKind(row),prior=primary.get(key);
  const expectedType=kind==='payment'?'externalWithdrawal':kind==='refund'?'refund':'externalExpense';
  const saved=!!prior&&prior.date===row.date&&prior.type===expectedType&&Number(prior.amount)===Math.abs(row.amount);
  const issues:string[]=[];
  if((keyCounts.get(key)||0)>1)issues.push(banksaladDuplicateIssue);
  if(prior&&!saved)issues.push('가져온 뒤 금액이 변경된 기록');
  if(!saved&&kind==='purchase'&&ledger.some(entry=>!entry.meta?.qaFixture&&entry.date===row.date&&
    ['expense','externalExpense'].includes(entry.type)&&entry.amount===-row.amount&&
    ([entry.note,entry.meta?.spendingItem,entry.meta?.merchant].includes(row.name)||
     (row.origin==='screenshot'||entry.meta?.banksaladOrigin==='screenshot')&&!!row.time&&
     String(entry.meta?.banksaladTime||'').slice(0,5)===row.time.slice(0,5))))issues.push(banksaladExistingIssue);
  if(!saved&&kind==='refund'&&ledger.some(entry=>entry.type==='refund'&&entry.date===row.date&&entry.amount===row.amount))issues.push(banksaladExistingIssue);
  if(!saved&&kind==='payment'&&(
   ledger.some(entry=>entry.type==='externalWithdrawal'&&entry.date===row.date&&entry.amount===-row.amount)||
   Array.from(payments.values()).some(payment=>payment.date===row.date&&payment.amount===-row.amount)
  ))issues.push(banksaladExistingIssue);
  const dateError=postedDateError(row.date);
  if(dateError)issues.push(dateError);
  if(kind==='payment'&&row.amount>=0)issues.push('납부 취소·환급은 확인 필요');
  return {...row,saved,issues};
 });
}
function banksaladPaymentIssue(row:BanksaladRow,draft:Extract<BanksaladDraft,{kind:'payment'}>):string{
 const store=integratedStore(),account=store.accounts.find(item=>item.id===draft.accountId);
 if(!draft.balanceConfirmed)return '기준잔액에 아직 반영하지 않은 출금인지 확인해 주세요.';
 if(!account||!['cash','deposit','parking'].includes(account.kind||''))return '실제 출금계좌에 해당하는 현금성 계좌를 선택해 주세요.';
 const observed=store.ledger.filter(entry=>
  (entry.type==='openingAsset'&&entry.toAccountId===draft.accountId)||
  (entry.type==='adjustment'&&entry.accountId===draft.accountId&&entry.meta?.reconciliation));
 if(observed.some(entry=>entry.date>=row.date))return '출금일 이후에 확인한 잔액이 있어요. 이미 포함된 출금인지 먼저 확인해 주세요.';
 const card=cardAccounts().find(item=>item.id===draft.cardId&&!item.archived);
 if(!card)return '납부한 카드를 선택해 주세요.';
 const issuer=String(card.issuer||'');
 const sourceIssuer=/삼성/.test(row.name)?'삼성':/KB|국민/i.test(row.name)?'국민':'';
 if(sourceIssuer&&issuer!=='기타 카드'&&!issuer.includes(sourceIssuer)&&!(sourceIssuer==='국민'&&/KB/i.test(issuer))){
  return '원본 출금 내역의 카드사와 선택한 카드사가 달라요.';
 }
 return '';
}
function banksaladPrimaryRow(key:string):BanksaladLedgerRow|undefined{
 return integratedStore().ledger.find(entry=>entry.meta?.banksaladSourceKey===key&&entry.meta?.banksaladPrimary);
}
async function saveBanksaladBatch(rows:BanksaladRow[],drafts:ReadonlyMap<string,BanksaladDraft>){
 if(!QA_MODE)throw new Error('현재는 테스트 원장에서만 저장할 수 있어요.');
 const snapshot=structuredClone(rows);
 const requested=new Map([...drafts].map(([key,draft])=>[key,structuredClone(draft)]));
 return runStoredCommand(async()=>{
  const review=banksaladReview(snapshot),available=new Set(review.map(banksaladSourceKey));
  if([...requested.keys()].some(key=>!available.has(key)))throw new Error('선택한 거래가 파일에 없어요.');
  const pending=review.filter(row=>requested.has(banksaladSourceKey(row))&&!row.saved)
   .sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
  const result={count:0,purchase:0,refund:0,payment:0};
  if(!pending.length)return result;
  let failure='';
  const ok=await cardCommit(()=>{
   try{
    for(const row of pending){
     const key=banksaladSourceKey(row),draft=requested.get(key)!;
     if(!cardMoney(Math.abs(row.amount)))throw new Error('0원 거래는 저장할 수 없어요.');
     if(row.issues.length||banksaladRowKind(row)!==draft.kind)throw new Error('중복 후보 또는 거래 유형을 확인해 주세요.');
     const ledger=integratedStore().ledger,oldIds=new Set(ledger.map(entry=>entry.id));
     if(draft.kind==='purchase'){
      stageCardPurchase({
       cardId:draft.cardId,name:row.name,purchaseDate:row.date,purchaseAmount:-row.amount,
       firstPaymentDate:draft.firstPaymentDate,months:1,interestMode:'free',
       category:row.category==='미분류'?row.group:row.category||row.group
      });
      result.purchase-=row.amount;
     }else if(draft.kind==='refund'){
      const original=banksaladPrimaryRow(draft.originalKey);
      const planId=original?.meta?.cardPlanId;
      if(!original||original.type!=='externalExpense'||typeof planId!=='string'||original.date>row.date)throw new Error('취소할 카드 원거래를 선택해 주세요.');
      stageCardRefund(planId,{date:row.date,amount:row.amount});
      result.refund+=row.amount;
     }else{
      const issue=banksaladPaymentIssue(row,draft);
      if(issue)throw new Error(issue);
      ledger.push({
       id:uid('igl'),date:row.date,type:'externalWithdrawal',amount:-row.amount,fromAccountId:draft.accountId,
       category:row.name,note:'카드대금 출금 확인 · 청구 배분 대기',
       meta:{unallocatedCardPayment:true,cardId:draft.cardId,sourcePaymentMethod:row.method,balanceConfirmed:true}
      });
      result.payment-=row.amount;
     }
     for(const entry of ledger.filter(item=>!oldIds.has(item.id))){
      entry.meta={...entry.meta,banksaladSourceKey:key,banksaladTime:row.time,
       ...(row.origin?{banksaladOrigin:row.origin}:{}),
       banksaladPrimary:entry.type==='externalExpense'||entry.type==='refund'||entry.type==='externalWithdrawal'};
     }
     result.count++;
    }
   }catch(error){failure=error instanceof Error?error.message:String(error);throw error}
  });
  if(!ok)throw new Error(failure||'저장을 완료하지 못했어요. 이번 선택 전체를 되돌렸어요.');
  return result;
 });
}

declare function openSheet(id:string):void;
declare function sheetInteractionToken():number;
declare function ux42OpenEntryMenu():void;
declare function won(amount:unknown):string;
declare function render():void;
declare function toast(message:string):void;
function banksaladNode<T extends keyof HTMLElementTagNameMap>(tag:T,cls='',text?:unknown):HTMLElementTagNameMap[T]{
 const node=document.createElement(tag);
 node.className=cls;
 if(text!==undefined)node.textContent=String(text);
 return node;
}
function banksaladField(label:string,input:HTMLElement):HTMLLabelElement{
 const field=banksaladNode('label','field');
 field.append(banksaladNode('span','',label),input);
 return field;
}
function banksaladCardSelect(label:string):{field:HTMLLabelElement;input:HTMLSelectElement}{
 const input=banksaladNode('select');
 const empty=banksaladNode('option','','카드 선택');
 empty.value='';input.append(empty);
 for(const card of cardAccounts().filter(card=>!card.archived)){
  const option=banksaladNode('option','',card.name);option.value=card.id;input.append(option);
 }
 return {field:banksaladField(label,input),input};
}
type BanksaladReviewPreset={rows:BanksaladRow[];label:string;drafts?:ReadonlyMap<string,BanksaladDraft>};
function openBanksaladPreview(preset?:BanksaladReviewPreset):void{
 document.querySelector<HTMLElement>('#sheetEyebrow')!.textContent='통합 · 가져오기';
 document.querySelector<HTMLElement>('#sheetTitle')!.textContent='뱅샐 엑셀 미리보기';
 const panel=banksaladNode('div','banksalad-preview'),back=banksaladNode('button','ux42-back','‹ 입력 종류');
 back.type='button';back.addEventListener('click',ux42OpenEntryMenu);
 const intro=banksaladNode('p','ux42-entry-hint',QA_MODE?
  '원본 엑셀을 읽고, 확인한 거래를 테스트 원장에 저장해요. 카드대금 출금은 소비 합계에 더하지 않아요.':
  '원본 엑셀의 거래를 이 기기에서 확인해요. 현재 저장은 테스트 원장에서 검증 중이에요.');
 const choose=banksaladNode('button','primary banksalad-action','엑셀 파일 선택');
 choose.type='button';
 const picker=banksaladNode('input');picker.type='file';picker.accept='.xlsx';picker.hidden=true;
 choose.addEventListener('click',()=>picker.click());
 const message=banksaladNode('p','banksalad-status');message.setAttribute('role','status');
 const content=banksaladNode('div');content.hidden=true;
 const dates=banksaladNode('div','banksalad-dates'),from=banksaladNode('input'),to=banksaladNode('input');
 from.type='date';to.type='date';
 dates.append(banksaladField('시작일',from),banksaladField('종료일',to));
 const totals=banksaladNode('div','banksalad-totals');
 const setup=banksaladNode('details','banksalad-setup');
 setup.append(banksaladNode('summary','','테스트 저장 설정'));
 const purchaseCard=banksaladCardSelect('카드 사용을 기록할 카드'),due=banksaladNode('input');
 due.type='date';
 const account=banksaladNode('select'),emptyAccount=banksaladNode('option','','출금계좌 선택');
 emptyAccount.value='';account.append(emptyAccount);
 for(const candidate of integratedStore().accounts.filter(row=>['cash','deposit','parking'].includes(row.kind||''))){
  const option=banksaladNode('option','',candidate.name);option.value=candidate.id;account.append(option);
 }
 const confirmed=banksaladNode('input');confirmed.type='checkbox';
 const confirmation=banksaladNode('label','banksalad-check');
 confirmation.append(confirmed,banksaladNode('span','','계좌에서 출금을 확인했고, 선택 계좌의 기준잔액에는 아직 반영하지 않았어요.'));
 setup.append(purchaseCard.field,banksaladField('일시불 첫 청구일',due),banksaladField('카드대금 출금계좌',account),confirmation,
  banksaladNode('p','ux42-entry-hint','카드 사용은 일시불로 확인한 건만 선택하세요. 할부는 기존 카드 구매 입력에서 확인해 주세요.'));
 const filter=banksaladNode('select');
 for(const [value,label] of Object.entries({all:'전체',purchase:'카드 사용 후보',refund:'취소·환불',payment:'카드대금 출금',other:'수입·이체',selected:'선택한 거래',issues:'중복·확인 필요',saved:'저장 완료'})){
  const option=banksaladNode('option','',label);option.value=value;filter.append(option);
 }
 const saveBox=banksaladNode('div','banksalad-save-box'),save=banksaladNode('button','primary banksalad-action','선택 거래 테스트 저장');
 save.type='button';save.disabled=true;
 const selection=banksaladNode('p','banksalad-status'),result=banksaladNode('p','banksalad-status');
 result.setAttribute('role','status');
 saveBox.append(selection,save,result);
 const list=banksaladNode('div','banksalad-results'),more=banksaladNode('button','banksalad-action','더 보기');
 more.type='button';
 content.append(dates,totals);
 if(QA_MODE)content.append(setup,saveBox);
 content.append(banksaladField('거래 보기',filter),list,more);
 panel.append(back,intro,picker,choose,message,content);
 document.querySelector<HTMLElement>('#sheetBody')!.replaceChildren(panel);
 openSheet('#detailSheet');
 const token=sheetInteractionToken();
 let rows:BanksaladRow[]=[],reviewed:BanksaladReviewedRow[]=[],visible:BanksaladReviewedRow[]=[],limit=30,busy=false;
 const picked=new Set<string>(),paymentCards=new Map<string,string>(),refundKeys=new Map<string,string>();
 function currentRows(){return reviewed.filter(row=>row.date>=from.value&&row.date<=to.value)}
 function selectedDrafts(){
  const drafts=new Map<string,BanksaladDraft>();
  for(const row of currentRows()){
   const key=banksaladSourceKey(row);
   if(!picked.has(key)||row.saved||row.issues.length)continue;
   const kind=banksaladRowKind(row);
   if(kind==='purchase'&&purchaseCard.input.value&&due.value)drafts.set(key,{kind,cardId:purchaseCard.input.value,firstPaymentDate:due.value});
   if(kind==='refund'&&refundKeys.has(key))drafts.set(key,{kind,originalKey:refundKeys.get(key)!});
   if(kind==='payment'&&paymentCards.get(key)&&account.value&&confirmed.checked){
    drafts.set(key,{kind,cardId:paymentCards.get(key)!,accountId:account.value,balanceConfirmed:true});
   }
  }
  return drafts;
 }
 function updateSelection(){
  const drafts=selectedDrafts(),pickedRows=currentRows().filter(row=>picked.has(banksaladSourceKey(row))&&!row.saved);
  const amount=(kind:string)=>pickedRows.filter(row=>banksaladRowKind(row)===kind).reduce((sum,row)=>sum+Math.abs(row.amount),0);
  selection.textContent=pickedRows.length+'건 선택 · 저장 준비 '+drafts.size+'건 · 순소비 '+won(amount('purchase')-amount('refund'))+' · 출금 '+won(amount('payment'));
  save.disabled=busy||!drafts.size||drafts.size!==pickedRows.length||!from.validity.valid||!to.validity.valid||from.value>to.value;
 }
 function item(row:BanksaladReviewedRow){
  const key=banksaladSourceKey(row),kind=banksaladRowKind(row),article=banksaladNode('article','banksalad-row');
  const left=banksaladNode('div'),right=banksaladNode('strong','banksalad-amount',(row.amount>0?'+':'')+won(row.amount));
  left.append(banksaladNode('small','',row.date+' '+row.time),banksaladNode('strong','',row.name||row.group),banksaladNode('small','',row.method));
  const issueText=row.saved?'저장 완료':row.issues.join(' · ');
  if(issueText)left.append(banksaladNode('small','banksalad-review',issueText));
  if(row.origin==='screenshot')left.append(banksaladNode('small','banksalad-review','사진으로 확인한 사용'));
  article.append(left,right);
  if(QA_MODE&&!row.saved&&!row.issues.length&&kind!=='other'){
   const input=banksaladNode('input');input.type='checkbox';input.checked=picked.has(key);
   const label=banksaladNode('label','banksalad-check');
   label.append(input,banksaladNode('span','',kind==='purchase'?'일시불 확인 · 선택':kind==='payment'?'카드대금 출금 확인 · 선택':'취소·환불 확인 · 선택'));
   input.addEventListener('change',()=>{if(input.checked)picked.add(key);else picked.delete(key);result.textContent='';updateSelection()});
   article.append(label);
   if(kind==='payment'){
    const card=banksaladCardSelect('납부한 카드');card.input.value=paymentCards.get(key)||'';
    card.input.addEventListener('change',()=>{paymentCards.set(key,card.input.value);updateSelection()});
    article.append(card.field,banksaladNode('small','banksalad-review','청구 배분 대기 · 소비 합계에서 제외'));
   }
   if(kind==='refund'){
    const original=banksaladNode('select'),empty=banksaladNode('option','','취소 원거래 선택');
    empty.value='';original.append(empty);
    for(const candidate of rows.filter(source=>source.sourceType==='지출'&&source.amount<0&&source.name===row.name&&
      -source.amount>=row.amount&&(source.date<row.date||source.date===row.date&&source.time<=row.time))){
     const option=banksaladNode('option','',candidate.date+' '+candidate.time+' · '+won(-candidate.amount));
     option.value=banksaladSourceKey(candidate);original.append(option);
    }
    original.value=refundKeys.get(key)||'';
    original.addEventListener('change',()=>{if(original.value)refundKeys.set(key,original.value);else refundKeys.delete(key);updateSelection()});
    article.append(banksaladField('취소 원거래',original));
   }
   if(kind==='purchase'&&!/CARD|신용카드/i.test(row.method))article.append(banksaladNode('small','banksalad-review','카드 이용내역과 대조 후 선택'));
  }
  return article;
 }
 function paint(){
  list.replaceChildren(...visible.slice(0,limit).map(item));
  more.hidden=limit>=visible.length;
 }
 function refresh(){
  reviewed=banksaladReview(rows);
  if(!from.value||!to.value||from.value>to.value||!from.validity.valid||!to.validity.valid){
   totals.textContent='파일 기간 안에서 시작일과 종료일을 확인해 주세요.';
   list.replaceChildren();more.hidden=true;save.disabled=true;return;
  }
  const current=currentRows(),sum=(selected:BanksaladRow[])=>selected.reduce((total,row)=>total-row.amount,0);
  totals.replaceChildren(
   banksaladNode('strong','',current.length+'건 · 저장 완료 '+current.filter(row=>row.saved).length+'건'),
   banksaladNode('small','','원본 순지출 '+won(sum(current.filter(row=>row.sourceType==='지출')))),
   banksaladNode('small','','카드대금 순출금 '+won(sum(current.filter(row=>banksaladRowKind(row)==='payment'))))
  );
  visible=current.filter(row=>filter.value==='all'||(filter.value==='issues'?row.issues.length>0:
   filter.value==='saved'?row.saved:filter.value==='selected'?picked.has(banksaladSourceKey(row)):banksaladRowKind(row)===filter.value));
  limit=30;paint();updateSelection();
 }
 for(const field of [from,to,filter])field.addEventListener('change',refresh);
 for(const field of [purchaseCard.input,due,account,confirmed])field.addEventListener('change',updateSelection);
 more.addEventListener('click',()=>{limit+=30;paint()});
 save.addEventListener('click',async()=>{
  if(busy||save.disabled)return;
  const drafts=selectedDrafts();
  busy=true;save.disabled=true;result.textContent='선택 거래를 저장하는 중…';
  try{
   const saved=await saveBanksaladBatch(rows,drafts);
   for(const key of drafts.keys())picked.delete(key);
   if(saved.count)render();
   refresh();
   result.textContent=saved.count+'건 저장 · 순소비 '+won(saved.purchase-saved.refund)+' · 카드대금 출금 '+won(saved.payment);
   if(saved.count)toast('확인한 거래 '+saved.count+'건을 테스트 원장에 저장했어요.');
  }catch(error){result.textContent=error instanceof Error?error.message:'저장에 실패했어요.'}
  finally{busy=false;updateSelection()}
 });
 function applyRows(loaded:BanksaladRow[],label:string,drafts?:ReadonlyMap<string,BanksaladDraft>){
  rows=structuredClone(loaded).sort((a,b)=>b.date.localeCompare(a.date)||b.time.localeCompare(a.time));
  if(!rows.length)return;
  picked.clear();paymentCards.clear();refundKeys.clear();result.textContent='';
  const latest=rows[0].date,earliest=rows[rows.length-1].date;
  const week=new Date(Date.parse(latest+'T00:00:00Z')-6*86400000).toISOString().slice(0,10);
  from.min=to.min=earliest;from.max=to.max=latest;from.value=week<earliest?earliest:week;to.value=latest;
  if(QA_MODE&&drafts){
   for(const [key,draft] of drafts){
    picked.add(key);
    if(draft.kind==='purchase'){purchaseCard.input.value=draft.cardId;due.value=draft.firstPaymentDate}
    if(draft.kind==='refund')refundKeys.set(key,draft.originalKey);
    if(draft.kind==='payment'){paymentCards.set(key,draft.cardId);account.value=draft.accountId;confirmed.checked=draft.balanceConfirmed}
   }
   filter.value='selected';
  }else filter.value='all';
  message.textContent=label+' · '+earliest+' ~ '+latest;
  content.hidden=false;refresh();
 }
 picker.addEventListener('change',async()=>{
  const file=picker.files?.[0];picker.value='';
  if(!file||busy)return;
  choose.disabled=true;content.hidden=true;message.textContent='엑셀을 읽는 중…';
  try{
   const loaded=await readBanksaladFile(file);
   if(token!==sheetInteractionToken())return;
   applyRows(loaded,'파일 전체 '+loaded.length.toLocaleString('ko-KR')+'건');
  }catch(error){if(token===sheetInteractionToken())message.textContent=error instanceof Error?error.message:'파일을 읽지 못했어요.'}
  finally{choose.disabled=false}
 });
 if(QA_MODE&&preset)applyRows(preset.rows,preset.label,preset.drafts);
}
