/* asset-os source: supabase-sync.js */
'use strict';
const SUPABASE_URL='https://wjrzukoofscmvwicmoey.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_mZa3v8Ekw08_5tHQMNSPWQ_uMcioPDM';
const SUPABASE_STATE_TABLE='asset_os_state';
const SUPABASE_REDIRECT_URL='https://dttg123.github.io/asset-os/';
let assetSupabaseClient=null,assetSupabaseSession=null,cloudSyncTimer=0,cloudSyncBusy=false,cloudPushPending=false,cloudSyncStatus='로그인 필요',cloudSyncTone='wait',cloudLastSyncAt='',cloudBaseFingerprint='',assetAppUnlocked=false;
const qaCloudBlocked=()=>typeof QA_MODE!=='undefined'&&QA_MODE;

function cloudAuthCallbackFailure(){
 const sources=[new URLSearchParams(String(location.search||'').replace(/^\?/,'')),new URLSearchParams(String(location.hash||'').replace(/^#/,''))];
 const get=key=>sources.map(x=>x.get(key)).find(Boolean)||'',code=get('error_code'),error=get('error');if(!code&&!error)return'';
 const rawDescription=String(get('error_description')||'').replace(/\+/g,' ');let description=rawDescription;try{description=decodeURIComponent(rawDescription)}catch{}
 try{history.replaceState(null,'',location.pathname||'/')}catch{}
 if(code==='bad_oauth_state')return'Google 로그인 링크가 만료됐습니다. 다시 로그인해 주세요.';
 if(code==='unexpected_failure'||/exchange external code|invalid_client/i.test(description))return'Google 인증 서버 설정 오류입니다. OAuth Client Secret을 확인해 주세요.';
 return`Google 로그인 오류: ${description||code||error}`
}

function assetAuthGateState(mode,message=''){
 const gate=$('#assetAuthGate'),button=$('#assetAuthButton'),status=$('#assetAuthStatus');if(!gate||!button||!status)return;
 gate.hidden=false;document.documentElement.classList.add('asset-auth-locked');status.className=`asset-auth-status ${mode==='error'?'error':''}`;
 if(mode==='loading'){button.disabled=true;button.textContent='연결 확인 중';status.textContent=message||'Supabase 세션을 확인하고 있습니다.'}
 else if(mode==='login'){button.disabled=false;button.textContent='Google로 로그인';status.textContent=message||'로그인 후 클라우드 원장을 확인하고 앱을 엽니다.'}
 else{button.disabled=false;button.textContent='다시 확인';status.textContent=message||'연결을 확인하지 못했습니다.'}
}
function assetAuthGateUnlock(){if(assetAppUnlocked)return;assetAppUnlocked=true;const gate=$('#assetAuthGate');if(gate)gate.hidden=true;document.documentElement.classList.remove('asset-auth-locked');if(!location.hash)location.hash='#/home';render();refreshCloudProfileUI();if(state.system?.loadWarning)setTimeout(()=>toast('저장 데이터 확인이 필요합니다.'),100)}
function cloudAuthGateMessage(){
 if(cloudSyncStatus==='동기화 충돌 확인 필요')return'클라우드와 이 기기의 원장이 동시에 변경되어 자동으로 열지 않았습니다. 자료 충돌을 확인해 주세요.';
 if(cloudSyncStatus==='빈 클라우드 자료 보호됨')return'빈 클라우드 자료가 이 기기의 원장을 덮지 않도록 앱을 잠갔습니다.';
 if(cloudSyncStatus==='클라우드 데이터 확인 필요')return'클라우드 원장 형식을 확인하지 못해 앱을 열지 않았습니다.';
 if(cloudSyncStatus==='DB 설정 필요')return'Supabase DB 설정을 확인해 주세요.';
 if(cloudSyncStatus==='동기화 오류')return'클라우드 원장 동기화 중 오류가 발생했습니다. 다시 확인해 주세요.';
 return'클라우드 원장을 확인하지 못했습니다. 네트워크를 확인해 주세요.'
}
async function startAssetAuthenticatedApp(){if(qaCloudBlocked()){cloudSetStatus('QA 로컬 전용','ok');assetAuthGateUnlock();return true}const callbackFailure=cloudAuthCallbackFailure();if(callbackFailure)return assetAuthGateState('error',callbackFailure);assetAuthGateState('loading');const initialized=await initSupabaseCloud();if(!initialized)return assetAuthGateState('error','Supabase 연결을 확인한 뒤 다시 시도해 주세요.');if(!cloudUser())return assetAuthGateState('login');const ok=await cloudReconcileState();if(ok)assetAuthGateUnlock();else assetAuthGateState('error',cloudAuthGateMessage())}

function cloudUser(){return assetSupabaseSession?.user||null}
function syncBrokerKisSessionFromCloud(session=assetSupabaseSession){
 if(qaCloudBlocked())return false;
 if(!session?.access_token||typeof brokerKisClient==='undefined'||typeof brokerKisClient.adoptSession!=='function')return false;
 return brokerKisClient.adoptSession(session)?.ok===true
}
function cloudUserLabel(){const u=cloudUser();return String(u?.user_metadata?.full_name||u?.user_metadata?.name||u?.email||'Google 사용자')}
function cloudUserEmail(){return String(cloudUser()?.email||'')}
function cloudTimeLabel(v){return v?formatDateTime(v):'-'}
function cloudSetStatus(text,tone='wait',when=''){cloudSyncStatus=String(text||'');cloudSyncTone=tone;cloudLastSyncAt=when||cloudLastSyncAt;refreshCloudProfileUI()}
function cloudLocalEnvelope(){
 let raw='';try{raw=localStorage.getItem(KEY)||''}catch{}
 if(raw){try{const parsed=JSON.parse(raw);if(parsed?.data)return{envelope:parsed,raw,stored:true}}catch{}}
 return{envelope:{schemaVersion:SCHEMA_VERSION,appVersion:APP_VERSION,savedAt:'',data:clone(state||seed)},raw:'',stored:false}
}
function cloudEnvelopeTime(x){const t=Date.parse(String(x?.savedAt||''));return Number.isFinite(t)?t:0}
function cloudCanonicalValue(value){
 if(Array.isArray(value))return value.map(cloudCanonicalValue);
 if(value&&typeof value==='object')return Object.keys(value).sort().reduce((result,key)=>{const item=cloudCanonicalValue(value[key]);if(item!==undefined)result[key]=item;return result},{});
 return value
}
function cloudEnvelopeFingerprint(x){try{return JSON.stringify(cloudCanonicalValue(x?.data||{}))}catch{return''}}
function cloudCurrentEnvelope(){const local=cloudLocalEnvelope();if(local.stored)return local.envelope;return{schemaVersion:SCHEMA_VERSION,appVersion:APP_VERSION,savedAt:new Date().toISOString(),data:clone(state)}}
function cloudPayloadValid(payload){return !!(payload&&typeof payload==='object'&&payload.data&&typeof payload.data==='object')}
function cloudDataHasMeaningfulRecords(data){const d=data||{},p=d.pension||{},i=d.integrated||{};return !!((d.accounts||[]).length||(p.accounts||[]).length||(p.contributions||[]).length||(p.transactions||[]).length||(p.holdings||[]).length||(p.incomes||[]).length||(d.financialProducts?.items||[]).length||(d.financialProducts?.events||[]).length||(d.financeSchedules?.items||[]).length||(i.ledger||[]).length)}
function cloudTableMissing(error){const msg=String(error?.message||'');return error?.code==='42P01'||/asset_os_state|relation .* does not exist/i.test(msg)}

function refreshCloudProfileUI(){
 const u=cloudUser(),menu=$('#cloudAuthMenuStatus'),avatar=$('#profileAvatar'),name=$('#profileName'),sub=$('#profileSub'),diag=$('#cloudDiagStatus');
 if(qaCloudBlocked()){if(menu)menu.textContent='QA 로컬 전용 · 동기화 차단';if(avatar)avatar.textContent='Q';if(name)name.textContent='QA 테스트 사용자';if(sub)sub.textContent='운영 데이터와 완전히 분리된 브라우저 저장소';if(diag){diag.textContent='차단됨';diag.className='diagnostic-value ok'}if($('#cloudSheet')?.classList.contains('open'))renderCloudAccountSheet();return}
 if(menu)menu.textContent=u?`${cloudUserEmail()||cloudUserLabel()} · ${cloudSyncStatus}`:'Google 로그인 · Supabase 자동 복원';
 if(avatar)avatar.textContent=u?(cloudUserLabel().trim().charAt(0)||'G').toUpperCase():'A';
 if(name)name.textContent=u?cloudUserLabel():'개인 자산 시스템';
 if(sub)sub.textContent=u?(cloudUserEmail()||'Google 계정 연결됨'):'공통 원장 엔진 + ISA + 개인연금·IRP 거래원장 + 통합 관리';
 if(diag){diag.textContent=u?cloudSyncStatus:'로그인 필요';diag.className=`diagnostic-value ${u&&cloudSyncTone==='ok'?'ok':'wait'}`}
 if($('#cloudSheet')?.classList.contains('open'))renderCloudAccountSheet();
}

async function initSupabaseCloud(){
 if(qaCloudBlocked())return false;
 if(assetSupabaseClient)return true;
 if(!window.supabase?.createClient){cloudSetStatus('클라우드 모듈 로드 실패','wait');return false}
 try{
  assetSupabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}});
  assetSupabaseClient.auth.onAuthStateChange((event,session)=>{assetSupabaseSession=session||null;if(session)syncBrokerKisSessionFromCloud(session);if(event==='INITIAL_SESSION')return;setTimeout(()=>handleCloudAuthState(event,session).catch(()=>{}),0)});
  const {data,error}=await assetSupabaseClient.auth.getSession();
  if(error)throw error;
  assetSupabaseSession=data?.session||null;if(assetSupabaseSession)syncBrokerKisSessionFromCloud(assetSupabaseSession);
  return true
 }catch(e){cloudSetStatus(`연결 확인 필요: ${e.message||'초기화 실패'}`,'wait');return false}
}

async function handleCloudAuthState(event,session){
 if(qaCloudBlocked())return false;
 assetSupabaseSession=session||null;if(session)syncBrokerKisSessionFromCloud(session);refreshCloudProfileUI();
 if(!session){cloudSetStatus('로그인 필요','wait');assetAppUnlocked=false;assetAuthGateState('login');return false}
 if(['INITIAL_SESSION','SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'].includes(String(event||''))){
  cloudSetStatus('동기화 확인 중','wait');
  const ok=await cloudReconcileState();if(ok)assetAuthGateUnlock();else if(!assetAppUnlocked)assetAuthGateState('error',cloudAuthGateMessage());return ok
 }
 return true
}

async function signInAssetGoogle(){
 if(qaCloudBlocked()){toast('QA 모드에서는 Google 로그인이 차단됩니다.');return false}
 if(!assetSupabaseClient&&!(await initSupabaseCloud()))return false;
 cloudSetStatus('Google 로그인 이동 중','wait');
 const {error}=await assetSupabaseClient.auth.signInWithOAuth({provider:'google',options:{redirectTo:SUPABASE_REDIRECT_URL}});
 if(error){cloudSetStatus(`로그인 실패: ${error.message}`,'wait');toast('Google 로그인을 시작하지 못했습니다.');return false}
 return true
}
async function signOutAssetGoogle(){
 if(qaCloudBlocked())return false;
 if(!assetSupabaseClient)return false;
 const {error}=await assetSupabaseClient.auth.signOut();
 if(error){toast('로그아웃에 실패했습니다.');return false}
 brokerKisClient?.signOut();assetSupabaseSession=null;assetAppUnlocked=false;assetAuthGateState('login');cloudSetStatus('로그인 필요','wait');closeSheets();toast('Google 계정에서 로그아웃했습니다.');return true
}

async function cloudFetchStateRow(){
 if(qaCloudBlocked())return{row:null,error:{message:'QA_CLOUD_BLOCKED'}};
 const u=cloudUser();if(!u)return{row:null,error:null};
 const {data,error}=await assetSupabaseClient.from(SUPABASE_STATE_TABLE).select('payload,updated_at').eq('user_id',u.id).maybeSingle();
 return{row:data||null,error:error||null}
}
async function cloudPushState(envelope=cloudCurrentEnvelope(),quiet=false){
 if(qaCloudBlocked())return false;
 if(!cloudUser()||!assetSupabaseClient)return false;if(cloudSyncBusy){cloudPushPending=true;return false}
 cloudPushPending=false;
 cloudSyncBusy=true;
 try{
  const payload={...clone(envelope),schemaVersion:SCHEMA_VERSION,appVersion:APP_VERSION};
  if(!payload.savedAt)payload.savedAt=new Date().toISOString();
  const current=await cloudFetchStateRow(),remote=current.row?.payload,remoteFingerprint=cloudPayloadValid(remote)?cloudEnvelopeFingerprint(remote):'',payloadFingerprint=cloudEnvelopeFingerprint(payload);if(current.error){cloudSetStatus('동기화 확인 실패','wait');return false}if(cloudBaseFingerprint&&remoteFingerprint&&remoteFingerprint!==cloudBaseFingerprint&&remoteFingerprint!==payloadFingerprint){cloudSetStatus('동기화 충돌 확인 필요','wait');if(!quiet)toast('다른 기기에서 원장이 변경됐습니다. 덮어쓰지 않고 충돌로 보호했습니다.');return false}
  const now=new Date().toISOString(),{error}=await assetSupabaseClient.from(SUPABASE_STATE_TABLE).upsert({user_id:cloudUser().id,payload,updated_at:now},{onConflict:'user_id'});
  if(error){if(cloudTableMissing(error))cloudSetStatus('DB 설정 필요','wait');else cloudSetStatus('클라우드 저장 실패','wait');if(!quiet)toast(cloudTableMissing(error)?'Supabase DB 설정이 아직 필요합니다.':'클라우드 저장을 확인해 주세요.');return false}
  cloudBaseFingerprint=payloadFingerprint;cloudSetStatus('동기화됨','ok',now);return true
 }finally{cloudSyncBusy=false;if(cloudPushPending){clearTimeout(cloudSyncTimer);cloudSyncTimer=setTimeout(()=>cloudPushState(cloudCurrentEnvelope(),true).catch(()=>{}),250)}}
}
function queueCloudStatePush(){
 if(qaCloudBlocked())return;
 if(!cloudUser()||!assetSupabaseClient)return;
 if(cloudSyncBusy){cloudPushPending=true;return}
 clearTimeout(cloudSyncTimer);cloudSyncTimer=setTimeout(()=>cloudPushState(cloudCurrentEnvelope(),true).catch(()=>{}),1200)
}

function cloudApplyRemoteEnvelope(payload){
 if(!cloudPayloadValid(payload))throw new Error('클라우드 데이터 형식 오류');
 const local=cloudLocalEnvelope();
 if(local.raw)storeRecoveryCopy(`${KEY}-pre-cloud-${Date.now()}`,local.raw);
 const normalized=normalizeState(clone(payload.data));
 state=normalized;lastPersistedState=clone(normalized);
 const savedAt=String(payload.savedAt||new Date().toISOString());
 localStorage.setItem(KEY,JSON.stringify({schemaVersion:SCHEMA_VERSION,appVersion:APP_VERSION,environment:APP_ENV,savedAt,data:normalized}));
 cloudBaseFingerprint=cloudEnvelopeFingerprint(payload);pruneRecoveryKeys();if(assetAppUnlocked)render();
}

async function cloudReconcileState(force='auto'){
 if(qaCloudBlocked())return false;
 if(!cloudUser()||!assetSupabaseClient||cloudSyncBusy)return false;
 cloudSyncBusy=true;
 try{
  const local=cloudLocalEnvelope(),{row,error}=await cloudFetchStateRow();
  if(error){if(cloudTableMissing(error))cloudSetStatus('DB 설정 필요','wait');else cloudSetStatus('동기화 확인 실패','wait');return false}
  if(!row){cloudSyncBusy=false;return await cloudPushState(cloudCurrentEnvelope(),true)}
  const remote=row.payload;
  if(!cloudPayloadValid(remote)){cloudSetStatus('클라우드 데이터 확인 필요','wait');return false}
  const lt=local.stored?cloudEnvelopeTime(local.envelope):0,rt=cloudEnvelopeTime(remote);
  const localMeaningful=local.stored&&cloudDataHasMeaningfulRecords(local.envelope?.data),remoteMeaningful=cloudDataHasMeaningfulRecords(remote.data);
  if(!localMeaningful&&remoteMeaningful){cloudApplyRemoteEnvelope(remote);cloudSetStatus('클라우드에서 복원됨','ok',row.updated_at||remote.savedAt);return true}
  if(localMeaningful&&!remoteMeaningful&&force!=='push'){cloudSetStatus('빈 클라우드 자료 보호됨','wait');return false}
  if(force==='pull'||!local.stored||rt>lt){cloudApplyRemoteEnvelope(remote);cloudSetStatus('클라우드에서 복원됨','ok',row.updated_at||remote.savedAt);toast('Supabase에서 최신 데이터를 복원했습니다.');return true}
  if(force==='push'||lt>rt){cloudSyncBusy=false;return await cloudPushState(local.envelope,true)}
  if(cloudEnvelopeFingerprint(local.envelope)!==cloudEnvelopeFingerprint(remote)){cloudSetStatus('동기화 충돌 확인 필요','wait');return false}
  cloudBaseFingerprint=cloudEnvelopeFingerprint(remote);
  cloudSetStatus('동기화됨','ok',row.updated_at||remote.savedAt);return true
 }catch(e){cloudSetStatus('동기화 오류','wait');return false}
 finally{cloudSyncBusy=false}
}

function renderCloudAccountSheet(){
 const body=$('#cloudBody');if(!body)return;
 if(qaCloudBlocked()){body.innerHTML='<div class="cloud-account-card"><div class="cloud-account-icon">Q</div><div><strong>QA 로컬 전용</strong><small>Supabase 로그인·복원·업로드가 모두 차단되어 있습니다.</small></div></div><div class="cloud-note">이 화면의 데이터는 운영 원장과 다른 localStorage 키에만 저장됩니다.</div>';return}
 const u=cloudUser();
 if(!u){body.innerHTML=`<div class="cloud-account-card"><div class="cloud-account-icon">G</div><div><strong>Google 계정으로 연결</strong><small>로그인하면 Supabase에 원장을 보관하고 새 기기에서도 복원할 수 있습니다.</small></div></div><button id="cloudGoogleLogin" class="diagnostic-action cloud-primary">Google로 로그인</button><div class="cloud-note">로그인과 클라우드 원장 확인이 끝나야 Asset OS를 사용할 수 있습니다.</div>`;$('#cloudGoogleLogin').onclick=()=>signInAssetGoogle();return}
 body.innerHTML=`<div class="cloud-account-card"><div class="cloud-account-icon">${escapeHtml((cloudUserLabel().charAt(0)||'G').toUpperCase())}</div><div><strong>${escapeHtml(cloudUserLabel())}</strong><small>${escapeHtml(cloudUserEmail())}</small></div></div><div class="diagnostic-list cloud-diagnostics"><div class="diagnostic-row"><span class="diagnostic-copy"><strong>Supabase</strong><small>자동 로그인 · 기기간 원장 복원</small></span><span class="diagnostic-value ${cloudSyncTone==='ok'?'ok':'wait'}">${escapeHtml(cloudSyncStatus)}</span></div><div class="diagnostic-row"><span class="diagnostic-copy"><strong>최근 동기화</strong><small>localStorage와 클라우드 중 최신본 사용</small></span><span class="diagnostic-value">${escapeHtml(cloudTimeLabel(cloudLastSyncAt))}</span></div></div><div class="cloud-actions"><button id="cloudSyncNow" class="diagnostic-action cloud-primary">지금 동기화</button><button id="cloudLogout" class="diagnostic-action cloud-secondary">로그아웃</button></div><div class="cloud-note">로그아웃해도 이 기기의 Asset OS 데이터는 삭제되지 않습니다.</div>`;
 $('#cloudSyncNow').onclick=async()=>{cloudSetStatus('동기화 확인 중','wait');const ok=await cloudReconcileState();toast(ok?'클라우드 동기화를 확인했습니다.':'클라우드 동기화를 확인해 주세요.')};
 $('#cloudLogout').onclick=()=>showDialog({title:'Google 로그아웃',message:'이 기기의 Asset OS 데이터는 유지됩니다. Google 계정 연결만 해제할까요?',confirmText:'로그아웃',cancelText:'취소'},()=>signOutAssetGoogle());
}
function openCloudAccountSheet(){renderCloudAccountSheet();openSheet('#cloudSheet')}
;
/* asset-os source: qa-mode.js */
'use strict';

const QA_START_YEAR=2026,QA_END_YEAR=2060,QA_MONTHS=(QA_END_YEAR-QA_START_YEAR+1)*12;
const QA_ISA_SKIP_YEARS=new Set([2027,2031,2036,2042,2049,2054,2058]);
const QA_PENSION_SKIP_YEARS=new Set([2033,2041,2052]);
function qaStorageState(input){
 const out=clone(input),dropZero=(row,key)=>{if(!Number(row[key]))delete row[key]},dropEmpty=(row,key)=>{if(row[key]===''||row[key]==null)delete row[key]};
 for(const account of out.accounts||[]){
  for(const key of ['ledgerIndex','contributionLedger','cashLedger','securityLedger','adjustmentLedger'])delete account[key];
  for(const tx of account.transactions||[]){if(tx.tradeDate===tx.date)delete tx.tradeDate;delete tx.createdAt;delete tx.idempotencyKey;dropEmpty(tx,'settlementDate');if(!tx.revisions?.length)delete tx.revisions;for(const key of ['fee','tax','amount','qty','price','setQty','setAvg'])dropZero(tx,key);if(tx.meta?.qaGenerated===true&&Object.keys(tx.meta).length===1)delete tx.meta}
  for(const snapshot of account.assetSnapshots||[])if(snapshot.meta?.qaFixture===true)delete snapshot.meta;
 }
 for(const tx of out.pension?.transactions||[]){delete tx.createdAt;for(const key of ['fee','tax','amount','qty','price','setQty','setAvg'])dropZero(tx,key);dropEmpty(tx,'note')}
 for(const snapshot of out.pension?.assetSnapshots||[])if(snapshot.meta?.qaFixture===true)delete snapshot.meta;
 for(const tx of out.integrated?.ledger||[]){delete tx.createdAt;delete tx.sequence;if(tx.fixed===false)delete tx.fixed;for(const key of ['note','sourceModule','sourceId','productId'])dropEmpty(tx,key);if(tx.meta?.qaGenerated===true){delete tx.meta.qaGenerated;if(!Object.keys(tx.meta).length)delete tx.meta}}
 return out
}
function qaPad(value){return String(value).padStart(2,'0')}
function qaStamp(date,index=0){return `${date}T12:00:00.${String(index%1000).padStart(3,'0')}Z`}
function qaRound(value,unit=1000){return Math.max(unit,Math.round(Number(value||0)/unit)*unit)}
function qaMarketPrice(year,month,base=100000){
 const age=year-QA_START_YEAR,trend=Math.pow(1.045,age),wave=1+Math.sin((age*12+month)*.37)*.08;
 const shock=([2028,2034,2042,2050,2057].includes(year)?.62:[2029,2035,2043,2051,2058].includes(year)?.82:1);
 return qaRound(base*trend*wave*shock,100)
}
function qaMonthlyContribution(total,index,count,year,month,skip){
 const years=Math.ceil(count/12),yearIndex=Math.floor(index/12),monthsInYear=Math.min(12,count-yearIndex*12),yearBase=Math.floor(total/years),yearTarget=yearBase+(yearIndex===years-1?total-yearBase*years:0),base=Math.floor(yearTarget/monthsInYear);if(skip)return 0;
 let amount=base;if(QA_ISA_SKIP_YEARS.has(year)&&month===6)amount+=base;
 if(month===12||index===count-1)amount+=yearTarget-(base*monthsInYear);
 return amount
}

function qaBuildThirtyFiveYearState(){
 const next=clone(seed),ledger=[],isaAccounts=[],pensionTransactions=[],pensionSnapshots=[];let sequence=0;
 const add=row=>ledger.push({...row,sequence:++sequence,createdAt:qaStamp(row.date,sequence),meta:{...(row.meta||{}),qaGenerated:true}});
 const financialItems=[
  {id:'qa-home-loan',type:'loan',name:'QA 주택담보대출',institution:'테스트은행',status:'active',startDate:'2030-01-01',maturityDate:'2079-12-31',annualRate:4,rateType:'variable',repaymentMethod:'equalPrincipal',contractPrincipal:230000000,termMonths:600,paymentDay:26,rateHistory:[{effectiveFrom:'2030-01-01',rate:4},{effectiveFrom:'2040-01-01',rate:5.2},{effectiveFrom:'2050-01-01',rate:3.4}]},
  {id:'qa-car-loan',type:'loan',name:'QA 자동차대출',institution:'테스트캐피탈',status:'ended',startDate:'2034-01-01',maturityDate:'2038-12-31',endedAt:'2038-12-31',endReason:'paidOff',annualRate:5.2,rateType:'fixed',repaymentMethod:'equalPrincipal',contractPrincipal:30000000,termMonths:60,paymentDay:26},
  {id:'qa-deposit',type:'deposit',name:'QA 정기예금',institution:'테스트은행',status:'active',startDate:'2060-01-01',maturityDate:'2060-12-31',annualRate:3.5,rateType:'fixed',interestMethod:'simple',taxMode:'general',paymentStyle:'lump',contractPrincipal:20000000},
  {id:'qa-savings',type:'savings',name:'QA 월적금',institution:'테스트은행',status:'active',startDate:'2060-01-01',maturityDate:'2060-12-31',annualRate:4.2,rateType:'fixed',interestMethod:'simple',taxMode:'general',paymentStyle:'monthly',scheduledAmount:500000,paymentDay:25,contributionStatus:'active',contractPrincipal:6000000}
 ];
 add({id:'qa-open-cash',date:'2026-01-01',type:'openingAsset',amount:30000000,toAccountId:'cash-main',category:'QA 시작 생활자금'});
 add({id:'qa-open-home-loan',date:'2030-01-01',type:'openingLiability',amount:230000000,liabilityId:'finance-debt-qa-home-loan',category:'주택담보대출 실행'});
 add({id:'qa-open-car-loan',date:'2034-01-01',type:'openingLiability',amount:30000000,liabilityId:'finance-debt-qa-car-loan',category:'자동차대출 실행'});

 for(let cycle=0;cycle<12;cycle++){
  const start=QA_START_YEAR+cycle*3,end=start+2,lastYear=Math.min(end,QA_END_YEAR),count=(lastYear-start+1)*12,id=`qa-isa-${start}`,holdingId=`qa-isa-h-${start}`;
  const targets=[20000000,50000000,60000000],target=Math.round(targets[cycle%3]*count/36),scenario=`납입 ${Math.round(target/10000).toLocaleString('ko-KR')}만원`;
  const account={id,name:`QA ISA ${start} · ${scenario}`,type:cycle%4===0?'서민형':'일반형',status:end<=QA_END_YEAR?'closed':'active',openedAt:`${start}-01-01`,closedAt:end<=QA_END_YEAR?`${end}-12-31`:'',maturityAt:`${end}-12-31`,policyId:next.policies.isa.activePolicyId,policyHistory:[],baseline:{date:`${start}-01-01`,cash:0,contribution:0},baselineDate:`${start}-01-01`,baselineCash:0,reconciliationTolerance:10,holdings:[{id:holdingId,name:'QA 미국지수 ETF',securityKey:`QAUSINDEX${start}`,instrumentCode:'379800',quoteType:'stock',quoteSource:'kis',investmentRole:'성장',baselineQty:0,baselineAvg:0,currentPrice:qaMarketPrice(lastYear,12,100000)}],transactions:[],assetSnapshots:[]};
  let txSequence=0,totalQty=0,cash=0,paid=0;
  for(let i=0;i<count;i++){
   const year=start+Math.floor(i/12),month=i%12+1,md=qaPad(month),date=`${year}-${md}-25`,skip=QA_ISA_SKIP_YEARS.has(year)&&month===5;
   const amount=qaMonthlyContribution(target,i,count,year,month,skip),price=qaMarketPrice(year,month,100000);
   if(amount>0){
    account.transactions.push({id:`${id}-dep-${year}-${md}`,type:'deposit',date,tradeDate:date,sequence:++txSequence,amount,fee:0,tax:0,meta:{qaGenerated:true}});cash+=amount;paid+=amount;
    const qty=Math.max(0,Math.floor(cash/price)),cost=qty*price;if(qty>0){account.transactions.push({id:`${id}-buy-${year}-${md}`,type:'buy',holdingId,date,tradeDate:date,sequence:++txSequence,qty,price,fee:0,tax:0,meta:{qaGenerated:true}});totalQty+=qty;cash-=cost}
   }
   if(month===12){const dividend=Math.round(totalQty*120),tax=Math.round(dividend*.154);account.transactions.push({id:`${id}-div-${year}`,type:'dividend',holdingId,date:`${year}-12-26`,tradeDate:`${year}-12-26`,sequence:++txSequence,amount:dividend,fee:0,tax,meta:{qaGenerated:true}});cash+=dividend-tax}
   if(month%3===0){const value=Math.round(totalQty*price);account.assetSnapshots.push({date:`${year}-${md}-28`,cost:paid,value,cash:Math.max(0,Math.round(cash)),totalValue:Math.max(0,Math.round(value+cash)),meta:{qaFixture:true,valueBasis:'securities',totalValueBasis:'securities_plus_cash',grain:'month'}})}
  }
  if(end<=QA_END_YEAR){const price=qaMarketPrice(end,12,112000);account.transactions.push({id:`${id}-close-sell`,type:'sell',holdingId,date:`${end}-12-28`,tradeDate:`${end}-12-28`,sequence:++txSequence,qty:totalQty,price,fee:0,tax:0,meta:{qaGenerated:true}});cash+=totalQty*price;const settlement=Math.round(cash);account.cashSnapshot=settlement;account.holdings[0].snapshotQty=0;account.holdings[0].snapshotAvg=0;account.holdings[0].snapshotPrice=price;account.maturity={decision:'close',actualSettlement:settlement,actualReceived:settlement,actualTax:0};account.assetSnapshots.push({date:`${end}-12-31`,cost:paid,value:0,cash:settlement,totalValue:settlement,meta:{qaFixture:true,valueBasis:'securities',totalValueBasis:'securities_plus_cash',grain:'month'}})}
  isaAccounts.push(account)
 }

 const pensionAccounts=[
  {id:'qa-pension',kind:'pension',name:'QA 한국투자 연금저축',provider:'한국투자증권',status:'active',openedAt:'2026-01-01',closedAt:'',policyId:next.policies.pension.activePolicyId,policyHistory:[]},
  {id:'qa-irp',kind:'irp',name:'QA 한국투자 IRP',provider:'한국투자증권',status:'active',openedAt:'2026-01-01',closedAt:'',policyId:next.policies.irp.activePolicyId,policyHistory:[]}
 ];
 const pensionHoldings=[
  {id:'qa-pension-h',accountId:'qa-pension',name:'QA 연금 미국지수 ETF',productType:'ETF',baselineQty:0,baselineAvgPrice:0,currentPrice:qaMarketPrice(QA_END_YEAR,12,100000),investmentRole:'성장',risky:true},
  {id:'qa-irp-h',accountId:'qa-irp',name:'QA IRP 채권혼합 ETF',productType:'ETF',baselineQty:0,baselineAvgPrice:0,currentPrice:qaMarketPrice(QA_END_YEAR,12,85000),investmentRole:'안정',risky:false}
 ];
 let pensionQty=0,irpQty=0,pensionCost=0,irpCost=0,pensionCash=0,irpCash=0,homeBalance=230000000,carBalance=30000000;
 const leaveMonths=new Set(['2038-05','2047-09']);
 for(let year=QA_START_YEAR;year<=QA_END_YEAR;year++)for(let month=1;month<=12;month++){
  const md=qaPad(month),ym=`${year}-${md}`,salaryDate=`${ym}-21`,transferDate=`${ym}-25`,idx=(year-QA_START_YEAR)*12+month-1,inflation=Math.pow(1.02,year-QA_START_YEAR);
  if(!leaveMonths.has(ym))add({id:`qa-salary-${year}-${md}`,date:salaryDate,type:'externalIncome',amount:qaRound(4342250*Math.pow(1.025,year-QA_START_YEAR),1000),toAccountId:'cash-main',category:'월급'});
  const costs=[['보험',250000,true,5],['통신',70000,true,10],['관리비',180000+(month%4)*18000,true,12],['구독',30000,true,15],['식비',520000+(idx%5)*35000,false,18],['교통',100000+(idx%3)*20000,false,20],['카드값',280000+(idx%7)*55000,false,23],['생활용품',90000+(idx%4)*25000,false,27]];
  for(const [key,raw,fixed,day] of costs)add({id:`qa-expense-${key}-${year}-${md}`,date:`${ym}-${qaPad(day)}`,type:'expense',amount:qaRound(raw*inflation,1000),fromAccountId:'cash-main',fixed,category:key});
  if(idx%29===0)add({id:`qa-extra-medical-${year}-${md}`,date:`${ym}-14`,type:'expense',amount:qaRound((800000+(idx%4)*450000)*inflation,1000),fromAccountId:'cash-main',fixed:false,category:'병원·치과'});
  if(idx%17===8)add({id:`qa-extra-travel-${year}-${md}`,date:`${ym}-14`,type:'expense',amount:qaRound((1200000+(idx%3)*600000)*inflation,1000),fromAccountId:'cash-main',fixed:false,category:'여행'});
  if(idx%61===20)add({id:`qa-extra-appliance-${year}-${md}`,date:`${ym}-14`,type:'expense',amount:qaRound((1800000+(idx%2)*1500000)*inflation,1000),fromAccountId:'cash-main',fixed:false,category:'가전·가구'});
  const pensionSkipped=QA_PENSION_SKIP_YEARS.has(year)&&month===7,pensionAmount=pensionSkipped?0:500000*(QA_PENSION_SKIP_YEARS.has(year)&&month===8?2:1),pensionPrice=qaMarketPrice(year,month,100000),irpPrice=qaMarketPrice(year,month,85000);
  if(pensionAmount){add({id:`qa-pension-transfer-${year}-${md}`,date:transferDate,type:'internalTransfer',amount:pensionAmount,fromAccountId:'cash-main',toAccountId:'pension-link',category:'연금저축 납입',meta:{targetPensionAccountId:'qa-pension'}});pensionCash+=pensionAmount;const qty=Math.floor(pensionCash/pensionPrice),cost=qty*pensionPrice;if(qty>0){pensionTransactions.push({id:`qa-ptx-pension-${year}-${md}`,accountId:'qa-pension',holdingId:'qa-pension-h',type:'buy',date:transferDate,createdAt:qaStamp(transferDate,1),qty,price:pensionPrice,fee:0,tax:0,note:pensionAmount>500000?'전월 미납 보충매수':'월매수'});pensionQty+=qty;pensionCost+=cost;pensionCash-=cost}}
  add({id:`qa-irp-transfer-${year}-${md}`,date:transferDate,type:'internalTransfer',amount:250000,fromAccountId:'cash-main',toAccountId:'irp-link',category:'IRP 납입',meta:{targetPensionAccountId:'qa-irp'}});irpCash+=250000;const iq=Math.floor(irpCash/irpPrice),icost=iq*irpPrice;if(iq>0){pensionTransactions.push({id:`qa-ptx-irp-${year}-${md}`,accountId:'qa-irp',holdingId:'qa-irp-h',type:'buy',date:transferDate,createdAt:qaStamp(transferDate,2),qty:iq,price:irpPrice,fee:0,tax:0,note:'월매수'});irpQty+=iq;irpCost+=icost;irpCash-=icost}
  const cycle=Math.floor((year-QA_START_YEAR)/3),cycleStart=QA_START_YEAR+cycle*3,cycleMonths=Math.min((Math.min(cycleStart+2,QA_END_YEAR)-cycleStart+1)*12,36),target=Math.round([20000000,50000000,60000000][cycle%3]*cycleMonths/36),cycleIndex=(year-cycleStart)*12+month-1,skipIsa=QA_ISA_SKIP_YEARS.has(year)&&month===5,isaAmount=qaMonthlyContribution(target,cycleIndex,cycleMonths,year,month,skipIsa);
  if(isaAmount)add({id:`qa-isa-transfer-${year}-${md}`,date:transferDate,type:'internalTransfer',amount:isaAmount,fromAccountId:'cash-main',toAccountId:'isa-link',category:'ISA 납입',meta:{targetIsaAccountId:`qa-isa-${cycleStart}`}});
  if(month===12){const bonus=qaRound((800000+(year%5)*350000)*inflation,1000);add({id:`qa-bonus-${year}`,date:`${year}-12-22`,type:'externalIncome',amount:bonus,toAccountId:'cash-main',category:'성과급'});const pd=Math.round(pensionQty*120),ptax=Math.round(pd*.154),idv=Math.round(irpQty*90),itax=Math.round(idv*.154);pensionTransactions.push({id:`qa-pension-div-${year}`,accountId:'qa-pension',holdingId:'qa-pension-h',type:'dividend',date:`${year}-12-26`,createdAt:qaStamp(`${year}-12-26`,3),amount:pd,fee:0,tax:ptax,note:'연금 ETF 분배금'});pensionTransactions.push({id:`qa-irp-div-${year}`,accountId:'qa-irp',holdingId:'qa-irp-h',type:'dividend',date:`${year}-12-26`,createdAt:qaStamp(`${year}-12-26`,4),amount:idv,fee:0,tax:itax,note:'IRP ETF 분배금'});pensionCash+=pd-ptax;irpCash+=idv-itax}
  pensionSnapshots.push({date:`${ym}-28`,pension:{cost:pensionCost,value:Math.round(pensionQty*pensionPrice+pensionCash),cash:Math.round(pensionCash)},irp:{cost:irpCost,value:Math.round(irpQty*irpPrice+irpCash),cash:Math.round(irpCash)},meta:{qaFixture:true,grain:'month',source:{pension:'asset-os',irp:'asset-os'}}});
  if(year>=2030&&homeBalance>0){const principal=Math.min(homeBalance,383333),rate=year>=2050?.034:year>=2040?.052:.04,interest=Math.round(homeBalance*rate/12);add({id:`qa-home-principal-${year}-${md}`,date:`${ym}-26`,type:'debtPrincipal',amount:principal,fromAccountId:'cash-main',liabilityId:'finance-debt-qa-home-loan',category:'주택대출 원금'});add({id:`qa-home-interest-${year}-${md}`,date:`${ym}-26`,type:'debtInterest',amount:interest,fromAccountId:'cash-main',liabilityId:'finance-debt-qa-home-loan',category:'주택대출 이자',fixed:true});homeBalance-=principal}
  if(year>=2034&&year<=2038&&carBalance>0){const principal=Math.min(carBalance,500000),interest=Math.round(carBalance*.052/12);add({id:`qa-car-principal-${year}-${md}`,date:`${ym}-26`,type:'debtPrincipal',amount:principal,fromAccountId:'cash-main',liabilityId:'finance-debt-qa-car-loan',category:'자동차대출 원금'});add({id:`qa-car-interest-${year}-${md}`,date:`${ym}-26`,type:'debtInterest',amount:interest,fromAccountId:'cash-main',liabilityId:'finance-debt-qa-car-loan',category:'자동차대출 이자',fixed:true});carBalance-=principal}
 }
 next.accounts=isaAccounts;next.settings.selectedAccountId='qa-isa-2059';next.settings.integratedMonth='2060-12';
 next.pension.accounts=pensionAccounts;next.pension.holdings=pensionHoldings;next.pension.transactions=pensionTransactions;next.pension.assetSnapshots=pensionSnapshots;next.pension.projection={birthYear:1995,retirementAge:65,yearsToRetire:0,monthlyContribution:750000,annualReturn:.06,withdrawalRate:.03,inflationRate:.02};
 next.integrated={...buildIntegratedSeed(),startedAt:'2026-01-01',ledger};next.financialProducts={items:financialItems,events:[{id:'qa-interest',productId:'qa-deposit',date:'2060-12-31',type:'interestObserved',amount:700000,label:'QA 이자',note:'가상 데이터'}]};next.financeSchedules={items:[{id:'qa-schedule-salary',name:'QA 월급',kind:'income',amount:7500000,day:21,recurrence:'monthly',startDate:'2026-01-01',active:true,source:'qa'},{id:'qa-schedule-insurance',name:'QA 보험료',kind:'insurance',amount:250000,day:5,recurrence:'monthly',startDate:'2026-01-01',active:true,source:'qa'},{id:'qa-schedule-living',name:'QA 관리비',kind:'expense',amount:200000,amountMode:'estimate',day:12,recurrence:'monthly',startDate:'2026-01-01',active:true,source:'qa'},{id:'qa-schedule-pension',name:'QA 연금저축 월 납입',kind:'investment',amount:500000,day:25,recurrence:'monthly',startDate:'2026-01-01',endDate:'',targetKind:'pension',targetAccountId:'pension-link',targetPensionAccountId:'qa-pension',active:true,source:'qa'},{id:'qa-schedule-irp',name:'QA IRP 월 납입',kind:'investment',amount:250000,day:25,recurrence:'monthly',startDate:'2026-01-01',endDate:'',targetKind:'irp',targetAccountId:'irp-link',targetPensionAccountId:'qa-irp',active:true,source:'qa'},{id:'qa-schedule-isa',name:'QA ISA 납입',kind:'investment',amount:500000,amountMode:'estimate',day:25,recurrence:'monthly',startDate:'2026-01-01',targetKind:'isa',targetAccountId:'isa-link',active:true,source:'qa'},{id:'qa-schedule-saving',name:'QA 월적금',kind:'saving',amount:500000,day:25,recurrence:'monthly',startDate:'2060-01-01',endDate:'2060-12-31',targetAccountId:'finance-asset-qa-savings',productId:'qa-savings',active:true,source:'qa'},{id:'qa-schedule-home-loan',name:'QA 주택대출',kind:'loan',amount:650000,amountMode:'estimate',day:26,recurrence:'monthly',startDate:'2030-01-01',endDate:'2079-12-31',liabilityId:'finance-debt-qa-home-loan',productId:'qa-home-loan',active:true,source:'qa'}]};
 next.insurance={policies:[{id:'qa-insurance',name:'QA 건강보험',company:'테스트보험',category:'건강',premium:250000,paymentStyle:'monthly',contractDate:'2026-01-01',coverageEndDate:'2060-12-31',paymentEndDate:'2060-12-31',status:'active',insured:'QA 사용자',contractor:'QA 사용자',coverages:[{name:'질병 진단비',amount:30000000,note:'가상'},{name:'상해 수술비',amount:5000000,note:'가상'},{name:'입원 일당',amount:100000,note:'1일 기준'},{name:'자동차사고 형사합의지원금(자가용)',amount:200000000,note:'장문 줄바꿈 확인'},{name:'자동차사고 변호사선임비용(자가용)',amount:50000000,note:'장문 줄바꿈 확인'},{name:'자동차사고 벌금(대인)',amount:30000000,note:'가상'},{name:'자동차사고 벌금(대물)',amount:5000000,note:'가상'},{name:'낙하물·로드킬 차량손해위로금',amount:1000000,note:'목록 하단 스크롤 확인'}],note:'QA 전용 · 긴 상세창 스크롤 검증'}]};
 const normalized=normalizeState(next),store=normalized.brokerKis,at='2060-12-31T09:00:00Z',pensionPrice=qaMarketPrice(2060,12,100000),irpPrice=qaMarketPrice(2060,12,85000);
 brokerKisImportBalanceSnapshot(store,{date:'2060-12-31',cash:5000000,securitiesValue:Math.round(pensionQty*pensionPrice),totalValue:Math.round(pensionQty*pensionPrice)+5000000,holdings:[{productCode:'QA379800',productName:'QA 미국S&P500 ETF',quantity:pensionQty,avgPrice:pensionQty?pensionCost/pensionQty:0,currentPrice:pensionPrice,marketValue:Math.round(pensionQty*pensionPrice),profitLoss:Math.round(pensionQty*pensionPrice-pensionCost)}]},'pension','qa-pension',at);
 brokerKisImportBalanceSnapshot(store,{date:'2060-12-31',cash:3000000,securitiesValue:Math.round(irpQty*irpPrice),totalValue:Math.round(irpQty*irpPrice)+3000000,holdings:[{productCode:'QAIRP50',productName:'IBK 미국AI TOP10 국채혼합50',quantity:irpQty,avgPrice:irpQty?irpCost/irpQty:0,currentPrice:irpPrice,marketValue:Math.round(irpQty*irpPrice),profitLoss:Math.round(irpQty*irpPrice-irpCost)}]},'irp','qa-irp',at);
 brokerKisImportOrderSnapshots(store,[{orderDate:'2060-12-25',orderTime:'101500',branchNo:'QA',orderNo:'QA0001',productCode:'QA379800',productName:'QA 미국S&P500 ETF',exchangeCode:'KRX',side:'buy',orderQty:5,filledQty:3,filledAmount:3*pensionPrice,remainingQty:2,cancelledQty:0,fee:900,tax:0}], 'pension','qa-pension',at,'2060-12-31');
 brokerKisImportRights(store,[{rightTypeCode:'32',baseDate:'2060-12-01',cashPaymentDate:'2060-12-26',productCode:'QA379800',productName:'QA 미국S&P500 ETF',amount:100000,tax:15000}], 'pension','qa-pension',at);
 brokerKisCompleteSync(store,'pension','qa-pension',at);brokerKisCompleteSync(store,'irp','qa-irp',at);
 normalized.system.qaDataset={version:APP_VERSION,generatedAt:new Date().toISOString(),range:'2026-2060',months:QA_MONTHS,scenario:'real-user-35-years',homeLoanRemaining:homeBalance,carLoanRemaining:carBalance};
 return normalized
}

function qaDatasetStats(){const model=integratedFinancialModel(),isa=state.accounts.reduce((n,a)=>n+(a.transactions||[]).length,0),pension=(state.pension.transactions||[]).length,integrated=(state.integrated.ledger||[]).length,round=n=>Math.round(Number(n)*100)/100;return{isa,pension,integrated,total:isa+pension+integrated,totalAssets:round(model.totalAssets),totalDebt:round(model.totalDebt),netAssets:round(model.netAssets),cash:round(model.cash),isaAccounts:state.accounts.length,months:state.system.qaDataset?.months||0}}
function qaRenderStats(){const box=$('#qaStats');if(!box)return;const s=qaDatasetStats();box.textContent=`${state.system?.qaDataset?.range||'직접 입력 QA'} · ${nf.format(s.total)}건 · 순자산 ${displayWon(s.netAssets)} · 대출 ${displayWon(s.totalDebt)}`}
function qaResetTransientViewState(){transactionDisplayLimit=50;dividendDisplayLimit=50;pensionTransactionDisplayLimit=20;pensionTransactionSearch='';integratedLedgerSearch='';integratedSearchDisplayLimit=50;setting().integratedLedgerFilter='all'}
function qaGenerateThirtyFiveYears(){if(!QA_MODE)return false;state=qaBuildThirtyFiveYearState();qaResetTransientViewState();lastPersistedState=clone(state);const ok=persist(false);render();qaRenderStats();toast(ok?'QA 35년 실사용 데이터를 만들었습니다.':'QA 데이터 저장에 실패했습니다.');return ok}
function qaResetData(){if(!QA_MODE)return false;localStorage.removeItem(QA_STORAGE_KEY);state=normalizeState(seed);qaResetTransientViewState();lastPersistedState=clone(state);persist(false);render();qaRenderStats();toast('QA 데이터만 초기화했습니다.');return true}
function qaRunMistakes(){if(!QA_MODE)return false;const before={integrated:state.integrated.ledger.length,pension:state.pension.transactions.length};const checks=[integratedValidateCandidate({id:'qa-mistake-zero',date:'2060-12-30',type:'expense',amount:0,fromAccountId:'cash-main'}),integratedValidateCandidate({id:'qa-mistake-same',date:'2060-12-30',type:'internalTransfer',amount:1000,fromAccountId:'cash-main',toAccountId:'cash-main'}),integratedValidateCandidate({id:'qa-mistake-over',date:'2060-12-30',type:'expense',amount:1e12,fromAccountId:'cash-main'}),integratedValidateCandidate({id:'qa-mistake-loan',date:'2060-12-30',type:'debtPrincipal',amount:1e12,fromAccountId:'cash-main',liabilityId:'finance-debt-qa-home-loan'}),pensionTransactionSave({accountId:'qa-irp',holdingId:'qa-irp-h',type:'sell',date:'2060-12-30',qty:999999,price:100000,fee:0,tax:0}).error];const blocked=checks.filter(Boolean).length===5&&before.integrated===state.integrated.ledger.length&&before.pension===state.pension.transactions.length;state.system.qaMistakes={checkedAt:new Date().toISOString(),blocked,checks};persist(false);toast(blocked?'실수 5종이 모두 차단됐습니다.':'실수 차단 결과를 확인해 주세요.');return blocked}
function initQaMode(){if(!QA_MODE)return;document.documentElement.classList.add('qa-mode');const banner=$('#qaBanner');if(banner)banner.hidden=false;$$('.statuschip').forEach(x=>x.textContent=`${APP_VERSION} QA`);const versionValue=$('#diagnosticsSheet .diagnostic-row:first-child .diagnostic-value');if(versionValue)versionValue.textContent=`${APP_VERSION} QA`;/* Preserve empty and manually entered QA data; fixtures require explicit generation. */$('#qaGenerate').onclick=()=>showDialog({title:'QA 35년 실사용 데이터 생성',message:'QA 저장소만 덮어씁니다. 운영 데이터와 Supabase에는 접근하지 않습니다.',confirmText:'생성',cancelText:'취소'},qaGenerateThirtyFiveYears);$('#qaMistakes').onclick=qaRunMistakes;$('#qaReset').onclick=()=>showDialog({title:'QA 데이터 초기화',message:'이 브라우저의 QA 데이터만 삭제합니다. 운영 데이터는 유지됩니다.',confirmText:'QA만 초기화',cancelText:'취소'},qaResetData);qaRenderStats()}
;
/* asset-os source: pwa.js */
'use strict';
if('serviceWorker'in navigator)window.addEventListener('load',async()=>{try{const reg=await navigator.serviceWorker.register('./service-worker.js?v=0.6.6&build=20260926-2',{scope:'./',updateViaCache:'none'});await reg.update();let refreshing=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(refreshing)return;refreshing=true;const key='asset-os-sw-reload-0.6.6-build20260926-2';if(sessionStorage.getItem(key))return;sessionStorage.setItem(key,'1');location.reload()})}catch{}});
;
/* asset-os source: boot.js */
'use strict';
state=loadState();
lastPersistedState=clone(state);
function applyExternalSavedState(saved){
 const interruptedInput=sheetMode==='input'&&sheetDirty;
 if(interruptedInput){
  if(activeSheetId==='#registerSheet')holdingRegistrationDraft=null;
  closeSheets({all:true});
 }
 state=normalizeState(saved.data);
 lastPersistedState=clone(state);
 render();
 if(typeof qaRenderStats==='function')qaRenderStats();
 if(interruptedInput)showNotice('다른 화면에서 변경됨','충돌로 인한 저장 누락을 막기 위해 작성 중이던 입력 화면을 닫고 최신 내용을 반영했습니다. 다시 열어 입력해 주세요.');
 else toast('다른 화면의 최신 변경사항을 반영했습니다.');
 return interruptedInput;
}
window.addEventListener('storage',event=>{
 if(event.storageArea!==localStorage||event.key!==KEY||!event.newValue)return;
 try{
  const saved=JSON.parse(event.newValue);
  if(!saved?.data||Number(saved.schemaVersion)!==SCHEMA_VERSION)return;
  applyExternalSavedState(saved);
 }catch{}
});
$$('.nav').forEach(b=>b.onclick=()=>nav(b.dataset.root));window.addEventListener('hashchange',()=>{resetTransientPanels();window.scrollTo(0,0);render()});$('#profile').onclick=()=>{refreshCloudProfileUI();openSheet('#profileSheet')};$('#scrim').onclick=()=>requestCloseSheets('scrim');$('#dialogScrim').onclick=()=>hideDialog(true);$('#confirmCancel').onclick=()=>hideDialog(true);$('#confirmOk').onclick=()=>{const cb=dialogConfirmAction;hideDialog(false);if(cb)cb()};document.addEventListener('input',e=>{if(e.target.closest('.sheet.open')&&sheetMode==='input')sheetDirty=true});document.addEventListener('submit',e=>{const form=e.target;if(!(form instanceof HTMLFormElement))return;const now=Date.now(),last=Number(form.dataset.lastSubmitAt)||0;if(now-last<500){e.preventDefault();e.stopImmediatePropagation();return}form.dataset.lastSubmitAt=String(now)},true);window.addEventListener('popstate',()=>{if(suppressSheetPop){suppressSheetPop=false;const y=pendingScrollRestore;pendingScrollRestore=null;if(y!=null)requestAnimationFrame(()=>window.scrollTo(0,y));return}if($$('.sheet.open').length)requestCloseSheets('back',true)});
$$('[data-profile-action]').forEach(b=>b.onclick=()=>{const x=b.dataset.profileAction;if(x==='cloud-auth')openCloudAccountSheet();else if(x==='appearance')openSheet('#appearanceSheet');else if(x==='pension-settings')openPensionSettings();else if(x==='backup')openBackupHub();else if(x==='insurance')openInsuranceHub();else if(x==='ai-strategy')openAiStrategy();else if(x==='kis')openKisSettings();else if(x==='advanced')openAdvancedSettings();});
$('#themeToggle').onchange=e=>{setting().theme=e.target.checked?'dark':'light';persist();applyTheme()};$('#fabToggle').onchange=e=>{setting().fab=false;e.target.checked=false;persist();applyTheme()};$('#hapticToggle').onchange=e=>{setting().haptics=e.target.checked;persist();applyTheme()};$('#backupInput').onchange=async e=>{const f=e.target.files?.[0];e.target.value='';if(f)await restoreBackupFile(f)};$('#initialImportInput').onchange=async e=>{const f=e.target.files?.[0];e.target.value='';if(f)await importInitialMergeFile(f)};$('#accentChoices').onclick=e=>{const b=e.target.closest('[data-value]');if(!b)return;setting().accent=b.dataset.value;persist();applyTheme()};
$('#runDiagnostics').onclick=()=>{let storageOk=true;try{localStorage.setItem('__asset_os_test__','1');localStorage.removeItem('__asset_os_test__')}catch{storageOk=false}const issues=typeof systemIntegrityIssues==='function'?systemIntegrityIssues():[],ok=storageOk&&!issues.length;$('#localStatus').textContent=storageOk?'정상':'확인 필요';$('#localStatus').className='diagnostic-value '+(storageOk?'ok':'wait');updateDiagnostics();toast(ok?'저장·금융 교차검증이 정상입니다.':storageOk?`금융 데이터 확인 필요 · ${issues.length}건`:'로컬 저장 권한을 확인해 주세요.')};
$('#fab').onclick=actions;
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('#confirmDialog').hidden)hideDialog(true);else requestCloseSheets('escape')}});
document.addEventListener('click',e=>{const row=e.target.closest?.('[data-pension-archive-tx]');if(row)openPensionArchiveRecord(row.dataset.pensionArchiveTx)});
document.addEventListener('click',e=>{const allRefresh=e.target.closest?.('[data-investment-refresh-all]');if(allRefresh)refreshAllInvestments();const refresh=e.target.closest?.('[data-pension-kis-refresh]');if(refresh)refreshPensionKisScope();const taxProfile=e.target.closest?.('[data-pension-tax-profile]');if(taxProfile)openPensionTaxProfileForm();const risk=e.target.closest?.('[data-pension-risk-classify]');if(risk)openPensionRiskClassificationForm();const order=e.target.closest?.('[data-pension-kis-order]');if(order)openPensionKisOrderDetail(order.dataset.pensionKisOrder);const right=e.target.closest?.('[data-pension-kis-right]');if(right)openPensionKisRightDetail(right.dataset.pensionKisRight)});


assetOsRuntimeApi={version:APP_VERSION,schemaVersion:SCHEMA_VERSION,getState:()=>clone(state),replaceState:data=>{state=normalizeState(data);persist(false);render();return clone(state)},reset:resetLiveData,metrics:id=>accountMetrics(state.accounts.find(a=>a.id===id)||currentAccount()),replay:(account,txs)=>replay(normalizeState({settings:seed.settings,policies:seed.policies,accounts:[account]}).accounts[0],txs),normalize:normalizeState,ymd,addYears,applyReconcileSnapshot:(accountId,snapshot)=>{const a=state.accounts.find(x=>x.id===accountId);const r=applyReconcileSnapshot(a,snapshot);if(r.ok&&!persist(false))return{ok:false,error:'PERSIST_FAILED'};return r},findDuplicateTransaction:(accountId,tx)=>findDuplicateTransaction(state.accounts.find(x=>x.id===accountId),tx),annualContributionTotal:id=>annualContributionTotal(state.accounts.find(a=>a.id===id)||currentAccount()),registerHoldingFromBalance:(accountId,input)=>{const a=state.accounts.find(x=>x.id===accountId);const r=registerHoldingFromBalance(a,input);if(r.ok&&!persist(false))return{ok:false,error:'PERSIST_FAILED'};return r},applyHoldingRegistration:(accountId,draft)=>applyHoldingRegistrationToAccount(state.accounts.find(x=>x.id===accountId),draft),openArchivedAccountDetail,applyPolicyVersion:(kind,id)=>applyPolicyVersion(kind,id),assignPolicyToAccount:(accountId,policyId,effectiveFrom)=>{const r=assignPolicyToAccount(accountId,policyId,effectiveFrom||ymd());persist(false);return r},taxableBreakdown:id=>taxableBreakdown(state.accounts.find(a=>a.id===id)||currentAccount()),consistencyIssues:id=>clone(consistencyIssues(state.accounts.find(a=>a.id===id)||currentAccount())),allIsaIssues:()=>clone(allIsaIssues()),dividendCompositionModel:(accountId)=>clone(compositionModel(state.accounts.find(a=>a.id===accountId)||currentAccount())),dividendYieldFor:(accountId,key,period,amount)=>dividendYieldFor(state.accounts.find(a=>a.id===accountId)||currentAccount(),key,period,amount),transactionHistory:(accountId,txId)=>clone((state.accounts.find(a=>a.id===accountId)||currentAccount()).transactions.find(t=>t.id===txId)?.revisions||[]),persist:()=>persist(false),isCurrentAccount:a=>isCurrentAccount(a),isPastAccount:a=>isPastAccount(a),transactionNumericError:t=>transactionNumericError(t),isaTransactionDateError:(id,date)=>isaTransactionDateError(state.accounts.find(a=>a.id===id),date),pensionTransactionDateError:(id,date)=>pensionTransactionDateError(pensionAccount(id),date),visibleHoldingCount:id=>visibleHoldingCount(state.accounts.find(a=>a.id===id)),setTransactionLimit:n=>{transactionDisplayLimit=Number(n)||50;render()},pensionContributionBatchCandidate:input=>clone(pensionContributionBatchCandidate(clone(input||{}))),applyPensionContributionBatch:input=>clone(applyPensionContributionBatch(clone(input||{}))),pensionSummary:year=>clone(pensionSummary(year||String(businessYear()))),pensionMonthly:year=>clone(pensionMonthly(year||String(businessYear()))),pensionAssetMetrics:scope=>clone(pensionAssetMetrics(scope||pensionAssetScope())),pensionAssetModel:(scope,lens)=>clone(pensionAssetModel(scope||pensionAssetScope(),lens||pensionAssetLens())),pensionRiskMetrics:()=>clone(pensionRiskMetrics()),pensionIncomeSummary:scope=>clone(pensionIncomeSummary(scope||pensionAssetScope())),pensionIncomeYears:scope=>clone(pensionIncomeYears(scope||pensionAssetScope())),pensionIncomePrincipalAt:(scope,key,mode)=>pensionIncomePrincipalAt(scope||pensionAssetScope(),key||'',mode||''),pensionProjection:()=>clone(pensionProjection()),pensionProjectionSeries:()=>clone(pensionProjectionSeries()),pensionPerformanceContribution:scope=>clone(pensionPerformanceContribution(scope||pensionAssetScope())),pensionSnapshotRows:scope=>clone(pensionSnapshotRows(scope||'all')),pensionAnalysisDisplayRows:(scope,period)=>clone(pensionAnalysisDisplayRows(scope||'all',period||'1y')),integratedSummary:month=>clone(integratedSummary(month)),integratedReplay:()=>clone(integratedReplay()),integratedIssues:()=>clone(integratedIssues()),systemIntegrityIssues:()=>clone(systemIntegrityIssues()),financialProductEventIssues:()=>clone(financialProductEventIssues()),financeProductEventError:e=>financeProductEventError(clone(e)),integratedStore:()=>clone(integratedStore()),integratedValidateCandidate:(candidate,editingId)=>integratedValidateCandidate(clone(candidate),editingId||''),integratedRowsForMonth:month=>clone(integratedRowsForMonth(month)),integratedFinancialModel:()=>clone(integratedFinancialModel()),historicalFinancialModel:date=>clone(historicalFinancialModel(date||localYmd())),financialGrowthBreakdown:(start,end)=>clone(financialGrowthBreakdown(start,end)),financialGrowthSeries:period=>clone(financialGrowthSeries(period||'6m')),backupPayload:()=>clone(backupPayload()),backupZip:()=>createBackupZipBytes(),parseBackupZip:bytes=>clone(parseBackupZipBytes(bytes)),validateBackupPayload:p=>clone(validateBackupPayload(clone(p))),syncCurrentIsaSnapshots:()=>{syncCurrentIsaSnapshots();return clone(state.accounts.filter(isCurrentAccount).map(a=>({id:a.id,snapshots:a.assetSnapshots})))},syncCurrentPensionSnapshot:()=>{syncCurrentPensionSnapshot();return clone(state.pension.assetSnapshots)},financialProducts:()=>clone(financialProducts()),financeProductBalance:id=>financeProductBalance(financialProduct(id)),financeProductBenefitBalance:id=>financeProductBenefitBalance(financialProduct(id)),financeProductRecentInterest:id=>clone(financeProductRecentInterest(financialProduct(id))),financeProductEvents:id=>clone(financeProductEvents(id)),financeSchedules:()=>clone(financeSchedules()),scheduleOccurrences:month=>clone(scheduleOccurrences(month||integratedSelectedMonth())),scheduleUrgent:()=>clone(scheduleUrgentOccurrences()),centralPensionRows:year=>clone(centralPensionContributionRows(year||'')),centralIsaRows:year=>clone(centralIsaContributionRows(year||'')),completeScheduleOccurrence:(id,date,amount,pensionTarget,isaTarget)=>completeScheduleOccurrence(id,date,amount,pensionTarget,isaTarget),resolveSchedulePensionAccount:(id,target,date)=>resolveSchedulePensionAccount(financeSchedules().find(x=>x.id===id),target,date),resolveScheduleIsaAccount:(id,target,date)=>resolveScheduleIsaAccount(financeSchedules().find(x=>x.id===id),target,date),pensionAccountCash:id=>pensionAccountCash(id),pensionAccountExposure:id=>clone(pensionAccountExposure(id)),createPensionAccount:input=>clone(createPensionAccount(clone(input||{}))),archivePensionAccount:id=>clone(archivePensionAccount(id)),reopenPensionAccount:id=>clone(reopenPensionAccount(id)),runtimeErrors:()=>runtimeErrors,pensionTransactions:scope=>clone(pensionTransactions(scope||'all')),pensionTransactionIssues:txs=>clone(pensionTransactionIssues(txs?clone(txs):pensionStore().transactions)),pensionTransactionSave:(tx,id)=>{const r=pensionTransactionSave(clone(tx),id||'');if(r.ok)persist(false);return clone(r)},pensionTransactionDelete:id=>{const r=pensionTransactionDelete(id);if(r)persist(false);return r},investmentRole:h=>investmentRoleForHolding(h),policyForYear:(kind,year)=>clone(policyForYear(kind,year)),isaComposition:id=>clone(compositionModel(state.accounts.find(a=>a.id===id)||currentAccount())),pensionCounts:()=>({accounts:state.pension.accounts.length,contributions:state.pension.contributions.length,transactions:state.pension.transactions.length,holdings:state.pension.holdings.length,incomes:state.pension.incomes.length}),isaAnalysisDisplayRows:(period)=>clone(isaAnalysisDisplayRows(currentAccount(),period||'1y')),counts:()=>({accounts:state.accounts.length,holdings:state.accounts.reduce((sum,a)=>sum+a.holdings.length,0),dividends:state.accounts.reduce((sum,a)=>sum+dividends(a).length,0)})};
assetOsRuntimeApi.brokerKis={
 store:()=>clone(state.brokerKis),
 issues:()=>clone(brokerKisIssues(state.brokerKis)),
 importOrders:(rows,kind,accountId,fetchedAt,orderSyncThrough)=>{const a=pensionAccount(accountId);if(!a||a.kind!==brokerKisKind(kind))return{ok:false,error:'KIS_ACCOUNT_LINK_MISMATCH'};const before=clone(state.brokerKis),result=brokerKisImportOrderSnapshots(state.brokerKis,clone(rows||[]),kind,accountId,fetchedAt||new Date().toISOString(),orderSyncThrough||'');if(result.error){state.brokerKis=before;return{ok:false,...clone(result)}}if(!persist(false)){state.brokerKis=before;return{ok:false,error:'PERSIST_FAILED'}}return{ok:true,...clone(result)}},
 importBalance:(input,kind,accountId,fetchedAt)=>{const a=pensionAccount(accountId);if(!a||a.kind!==brokerKisKind(kind))return{ok:false,error:'KIS_ACCOUNT_LINK_MISMATCH'};const before=clone(state.brokerKis),result=brokerKisImportBalanceSnapshot(state.brokerKis,clone(input||{}),kind,accountId,fetchedAt||new Date().toISOString());if(!result.ok)return result;if(!persist(false)){state.brokerKis=before;return{ok:false,error:'PERSIST_FAILED'}}return clone(result)},
 linkInstrument:input=>{const h=pensionHoldingById(input?.holdingId);if(!h||h.accountId!==input?.accountId)return{ok:false,error:'KIS_INSTRUMENT_LINK_MISMATCH'};const before=clone(state.brokerKis),result=brokerKisLinkInstrument(state.brokerKis,clone(input||{}));if(!result.ok)return result;if(!persist(false)){state.brokerKis=before;return{ok:false,error:'PERSIST_FAILED'}}return clone(result)},
 ledgerDraft:orderKey=>clone(brokerKisLedgerDraft(state.brokerKis,orderKey)),
 matchOrder:(orderKey,transactionId)=>{if(!pensionStore().transactions.some(x=>x.id===transactionId))return{ok:false,error:'PENSION_TRANSACTION_NOT_FOUND'};const tx=pensionStore().transactions.find(x=>x.id===transactionId),before=clone(state.brokerKis),result=brokerKisMatchOrder(state.brokerKis,orderKey,transactionId,new Date().toISOString(),tx.qty);if(!result.ok)return result;if(!persist(false)){state.brokerKis=before;return{ok:false,error:'PERSIST_FAILED'}}return clone(result)},
 importRights:(rows,kind,accountId,fetchedAt)=>{const a=pensionAccount(accountId);if(!a||a.kind!==brokerKisKind(kind))return{ok:false,error:'KIS_ACCOUNT_LINK_MISMATCH'};const before=clone(state.brokerKis),result=brokerKisImportRights(state.brokerKis,clone(rows||[]),kind,accountId,fetchedAt||new Date().toISOString());if(result.error){state.brokerKis=before;return{ok:false,...clone(result)}}if(!persist(false)){state.brokerKis=before;return{ok:false,error:'PERSIST_FAILED'}}return{ok:true,...clone(result)}},
 latestBalance:(kind,accountId)=>clone(brokerKisLatestBalance(state.brokerKis,kind,accountId)),
 history:kind=>clone(state.brokerKis.history?.[brokerKisKind(kind)]||brokerKisEmptyHistory(kind)),
 beginHistory:input=>{const before=clone(state.brokerKis),result=brokerKisBeginHistory(state.brokerKis,clone(input||{}));if(!result.ok)return result;if(!persist(false)){state.brokerKis=before;return{ok:false,error:'PERSIST_FAILED'}}return clone(result)},
 updateHistory:input=>{const before=clone(state.brokerKis),result=brokerKisUpdateHistory(state.brokerKis,clone(input||{}));if(!result.ok)return result;if(!persist(false)){state.brokerKis=before;return{ok:false,error:'PERSIST_FAILED'}}return clone(result)},
 completeSync:(kind,accountId,completedAt)=>{const a=pensionAccount(accountId);if(!a||a.kind!==brokerKisKind(kind))return{ok:false,error:'KIS_ACCOUNT_LINK_MISMATCH'};const before=clone(state.brokerKis),connection=brokerKisCompleteSync(state.brokerKis,kind,accountId,completedAt||new Date().toISOString());if(!persist(false)){state.brokerKis=before;return{ok:false,error:'PERSIST_FAILED'}}return{ok:true,connection:clone(connection)}},
 failSync:(kind,accountId,error,failedAt)=>{const before=clone(state.brokerKis),connection=brokerKisFailSync(state.brokerKis,kind,accountId,error,failedAt||new Date().toISOString());if(!persist(false)){state.brokerKis=before;return{ok:false,error:'PERSIST_FAILED'}}return{ok:false,error:connection.lastError,connection:clone(connection)}}
};
assetOsRuntimeApi.brokerKisClient=brokerKisClient;if(QA_MODE)window.__assetOS=assetOsRuntimeApi;else try{delete window.__assetOS}catch{};
brokerKisClient.configure(BROKER_KIS_PUBLIC_CONFIG);
brokerKisClient.consumeRedirect();
if(typeof initQaMode==='function')initQaMode();
$('#assetAuthButton').onclick=async()=>{if(cloudUser())await startAssetAuthenticatedApp();else await signInAssetGoogle()};
startAssetAuthenticatedApp().catch(()=>assetAuthGateState('error','연결 확인 중 오류가 발생했습니다. 다시 시도해 주세요.'));
