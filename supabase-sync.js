'use strict';
const SUPABASE_URL='https://wjrzukoofscmvwicmoey.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_mZa3v8Ekw08_5tHQMNSPWQ_uMcioPDM';
const SUPABASE_STATE_TABLE='asset_os_state';
const SUPABASE_REDIRECT_URL='https://dttg123.github.io/asset-os/';
let assetSupabaseClient=null,assetSupabaseSession=null,cloudSyncTimer=0,cloudSyncBusy=false,cloudSyncStatus='로그인 필요',cloudSyncTone='wait',cloudLastSyncAt='',assetAppUnlocked=false;

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
async function startAssetAuthenticatedApp(){const callbackFailure=cloudAuthCallbackFailure();if(callbackFailure)return assetAuthGateState('error',callbackFailure);assetAuthGateState('loading');const initialized=await initSupabaseCloud();if(!initialized)return assetAuthGateState('error','Supabase 연결을 확인한 뒤 다시 시도해 주세요.');if(!cloudUser())return assetAuthGateState('login');const ok=await cloudReconcileState();if(ok)assetAuthGateUnlock();else assetAuthGateState('error','클라우드 원장을 확인하지 못했습니다. 네트워크를 확인해 주세요.')}

function cloudUser(){return assetSupabaseSession?.user||null}
function syncBrokerKisSessionFromCloud(session=assetSupabaseSession){
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
function cloudCurrentEnvelope(){const local=cloudLocalEnvelope();if(local.stored)return local.envelope;return{schemaVersion:SCHEMA_VERSION,appVersion:APP_VERSION,savedAt:new Date().toISOString(),data:clone(state)}}
function cloudPayloadValid(payload){return !!(payload&&typeof payload==='object'&&payload.data&&typeof payload.data==='object')}
function cloudDataHasMeaningfulRecords(data){const d=data||{},p=d.pension||{},i=d.integrated||{};return !!((d.accounts||[]).length||(p.accounts||[]).length||(p.contributions||[]).length||(p.transactions||[]).length||(p.holdings||[]).length||(p.incomes||[]).length||(d.financialProducts?.items||[]).length||(d.financialProducts?.events||[]).length||(d.financeSchedules?.items||[]).length||(i.ledger||[]).length)}
function cloudTableMissing(error){const msg=String(error?.message||'');return error?.code==='42P01'||/asset_os_state|relation .* does not exist/i.test(msg)}

function refreshCloudProfileUI(){
 const u=cloudUser(),menu=$('#cloudAuthMenuStatus'),avatar=$('#profileAvatar'),name=$('#profileName'),sub=$('#profileSub'),diag=$('#cloudDiagStatus');
 if(menu)menu.textContent=u?`${cloudUserEmail()||cloudUserLabel()} · ${cloudSyncStatus}`:'Google 로그인 · Supabase 자동 복원';
 if(avatar)avatar.textContent=u?(cloudUserLabel().trim().charAt(0)||'G').toUpperCase():'A';
 if(name)name.textContent=u?cloudUserLabel():'개인 자산 시스템';
 if(sub)sub.textContent=u?(cloudUserEmail()||'Google 계정 연결됨'):'공통 원장 엔진 + ISA + 개인연금·IRP 거래원장 + 통합 관리';
 if(diag){diag.textContent=u?cloudSyncStatus:'로그인 필요';diag.className=`diagnostic-value ${u&&cloudSyncTone==='ok'?'ok':'wait'}`}
 if($('#cloudSheet')?.classList.contains('open'))renderCloudAccountSheet();
}

async function initSupabaseCloud(){
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
 assetSupabaseSession=session||null;if(session)syncBrokerKisSessionFromCloud(session);refreshCloudProfileUI();
 if(!session){cloudSetStatus('로그인 필요','wait');assetAppUnlocked=false;assetAuthGateState('login');return false}
 if(['INITIAL_SESSION','SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'].includes(String(event||''))){
  cloudSetStatus('동기화 확인 중','wait');
  const ok=await cloudReconcileState();if(ok)assetAuthGateUnlock();return ok
 }
 return true
}

async function signInAssetGoogle(){
 if(!assetSupabaseClient&&!(await initSupabaseCloud()))return false;
 cloudSetStatus('Google 로그인 이동 중','wait');
 const {error}=await assetSupabaseClient.auth.signInWithOAuth({provider:'google',options:{redirectTo:SUPABASE_REDIRECT_URL}});
 if(error){cloudSetStatus(`로그인 실패: ${error.message}`,'wait');toast('Google 로그인을 시작하지 못했습니다.');return false}
 return true
}
async function signOutAssetGoogle(){
 if(!assetSupabaseClient)return false;
 const {error}=await assetSupabaseClient.auth.signOut();
 if(error){toast('로그아웃에 실패했습니다.');return false}
 brokerKisClient?.signOut();assetSupabaseSession=null;assetAppUnlocked=false;assetAuthGateState('login');cloudSetStatus('로그인 필요','wait');closeSheets();toast('Google 계정에서 로그아웃했습니다.');return true
}

async function cloudFetchStateRow(){
 const u=cloudUser();if(!u)return{row:null,error:null};
 const {data,error}=await assetSupabaseClient.from(SUPABASE_STATE_TABLE).select('payload,updated_at').eq('user_id',u.id).maybeSingle();
 return{row:data||null,error:error||null}
}
async function cloudPushState(envelope=cloudCurrentEnvelope(),quiet=false){
 if(!cloudUser()||!assetSupabaseClient||cloudSyncBusy)return false;
 cloudSyncBusy=true;
 try{
  const payload={...clone(envelope),schemaVersion:SCHEMA_VERSION,appVersion:APP_VERSION};
  if(!payload.savedAt)payload.savedAt=new Date().toISOString();
  const now=new Date().toISOString(),{error}=await assetSupabaseClient.from(SUPABASE_STATE_TABLE).upsert({user_id:cloudUser().id,payload,updated_at:now},{onConflict:'user_id'});
  if(error){if(cloudTableMissing(error))cloudSetStatus('DB 설정 필요','wait');else cloudSetStatus('클라우드 저장 실패','wait');if(!quiet)toast(cloudTableMissing(error)?'Supabase DB 설정이 아직 필요합니다.':'클라우드 저장을 확인해 주세요.');return false}
  cloudSetStatus('동기화됨','ok',now);return true
 }finally{cloudSyncBusy=false}
}
function queueCloudStatePush(){
 if(!cloudUser()||!assetSupabaseClient)return;
 clearTimeout(cloudSyncTimer);cloudSyncTimer=setTimeout(()=>cloudPushState(cloudCurrentEnvelope(),true).catch(()=>{}),1200)
}

function cloudApplyRemoteEnvelope(payload){
 if(!cloudPayloadValid(payload))throw new Error('클라우드 데이터 형식 오류');
 const local=cloudLocalEnvelope();
 try{if(local.raw)localStorage.setItem(`${KEY}-pre-cloud-${Date.now()}`,local.raw)}catch{}
 const normalized=normalizeState(clone(payload.data));
 state=normalized;lastPersistedState=clone(normalized);
 const savedAt=String(payload.savedAt||new Date().toISOString());
 localStorage.setItem(KEY,JSON.stringify({schemaVersion:SCHEMA_VERSION,appVersion:APP_VERSION,savedAt,data:normalized}));
 pruneRecoveryKeys();if(assetAppUnlocked)render();
}

async function cloudReconcileState(force='auto'){
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
  if(force==='pull'||!local.stored||rt>lt+1000){cloudApplyRemoteEnvelope(remote);cloudSetStatus('클라우드에서 복원됨','ok',row.updated_at||remote.savedAt);toast('Supabase에서 최신 데이터를 복원했습니다.');return true}
  if(force==='push'||lt>rt+1000){cloudSyncBusy=false;return await cloudPushState(local.envelope,true)}
  cloudSetStatus('동기화됨','ok',row.updated_at||remote.savedAt);return true
 }catch(e){cloudSetStatus('동기화 오류','wait');return false}
 finally{cloudSyncBusy=false}
}

function renderCloudAccountSheet(){
 const body=$('#cloudBody');if(!body)return;
 const u=cloudUser();
 if(!u){body.innerHTML=`<div class="cloud-account-card"><div class="cloud-account-icon">G</div><div><strong>Google 계정으로 연결</strong><small>로그인하면 Supabase에 원장을 보관하고 새 기기에서도 복원할 수 있습니다.</small></div></div><button id="cloudGoogleLogin" class="diagnostic-action cloud-primary">Google로 로그인</button><div class="cloud-note">로그인과 클라우드 원장 확인이 끝나야 Asset OS를 사용할 수 있습니다.</div>`;$('#cloudGoogleLogin').onclick=()=>signInAssetGoogle();return}
 body.innerHTML=`<div class="cloud-account-card"><div class="cloud-account-icon">${escapeHtml((cloudUserLabel().charAt(0)||'G').toUpperCase())}</div><div><strong>${escapeHtml(cloudUserLabel())}</strong><small>${escapeHtml(cloudUserEmail())}</small></div></div><div class="diagnostic-list cloud-diagnostics"><div class="diagnostic-row"><span class="diagnostic-copy"><strong>Supabase</strong><small>자동 로그인 · 기기간 원장 복원</small></span><span class="diagnostic-value ${cloudSyncTone==='ok'?'ok':'wait'}">${escapeHtml(cloudSyncStatus)}</span></div><div class="diagnostic-row"><span class="diagnostic-copy"><strong>최근 동기화</strong><small>localStorage와 클라우드 중 최신본 사용</small></span><span class="diagnostic-value">${escapeHtml(cloudTimeLabel(cloudLastSyncAt))}</span></div></div><div class="cloud-actions"><button id="cloudSyncNow" class="diagnostic-action cloud-primary">지금 동기화</button><button id="cloudLogout" class="diagnostic-action cloud-secondary">로그아웃</button></div><div class="cloud-note">로그아웃해도 이 기기의 Asset OS 데이터는 삭제되지 않습니다.</div>`;
 $('#cloudSyncNow').onclick=async()=>{cloudSetStatus('동기화 확인 중','wait');const ok=await cloudReconcileState();toast(ok?'클라우드 동기화를 확인했습니다.':'클라우드 동기화를 확인해 주세요.')};
 $('#cloudLogout').onclick=()=>showDialog({title:'Google 로그아웃',message:'이 기기의 Asset OS 데이터는 유지됩니다. Google 계정 연결만 해제할까요?',confirmText:'로그아웃',cancelText:'취소'},()=>signOutAssetGoogle());
}
function openCloudAccountSheet(){renderCloudAccountSheet();openSheet('#cloudSheet')}
