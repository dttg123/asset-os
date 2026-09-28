'use strict';

type BrokerAction='balance'|'orders'|'rights'|'quote';
interface BrokerClientConfig {projectUrl:string;publishableKey:string;functionName:string;redirectUrl:string}
interface BrokerClientSession {accessToken:string;expiresAt:number}
interface BrokerClientResult {ok:boolean;error?:string;status?:number;stage?:string;upstreamCode?:string;data?:unknown;expiresAt?:number;qa?:boolean}
interface BrokerAuthSubscription {unsubscribe?:()=>void}
interface BrokerAuthApi {
 onAuthStateChange(callback:(event:unknown,session:unknown)=>unknown):{data?:{subscription?:BrokerAuthSubscription}}|null;
 getSession():Promise<{data?:{session?:unknown}}>;
 signOut(options:{scope:string}):Promise<unknown>;
 signInWithOtp(input:{email:string;options:{shouldCreateUser:boolean;emailRedirectTo?:string}}):Promise<{error?:unknown}>;
 setSession(input:{access_token:string;refresh_token:string}):Promise<unknown>;
}
interface BrokerAuthClient {auth:BrokerAuthApi}
interface BrokerStoreApi {importBalance:(...args:unknown[])=>unknown;importOrders:(...args:unknown[])=>unknown;importRights:(...args:unknown[])=>unknown}
interface BrokerRuntimeRoot {brokerKis?:BrokerStoreApi}
interface BrokerBrowserWindow {supabase?:{createClient:(url:string,key:string,options:unknown)=>BrokerAuthClient};__assetOS?:BrokerRuntimeRoot}
declare const QA_MODE:boolean;
declare var assetOsRuntimeApi:BrokerRuntimeRoot|undefined;

const brokerKisClient=(()=>{
 const REQUEST_TIMEOUT_MS=20000;
 let config:BrokerClientConfig={projectUrl:'',publishableKey:'',functionName:'kis-read',redirectUrl:''};
 let session:BrokerClientSession={accessToken:'',expiresAt:0};
 let authClient:BrokerAuthClient|null=null;
 let authSubscription:BrokerAuthSubscription|null=null;
 const record=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'?value as Record<string,unknown>:{};
 const qaBlocked=()=>typeof QA_MODE!=='undefined'&&QA_MODE;
 const cleanUrl=(value:unknown)=>String(value||'').trim().replace(/\/+$/,'');
 const cleanText=(value:unknown,max=200)=>String(value||'').trim().slice(0,max);
 const cleanCode=(value:unknown)=>{const text=cleanText(value,40).toUpperCase();return/^[A-Z0-9_-]{1,40}$/.test(text)?text:''};
 const cleanStage=(value:unknown)=>{const text=cleanText(value,20).toLowerCase();return['balance','orders','rights','quote'].includes(text)?text:''};
 function configure(input:Record<string,unknown>={}){
  const projectUrl=cleanUrl(input.projectUrl),publishableKey=cleanText(input.publishableKey,300),functionName=cleanText(input.functionName||'kis-read',80),redirectUrl=cleanText(input.redirectUrl,500);
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(projectUrl))return{ok:false,error:'BROKER_PROJECT_URL_INVALID'};
  if(!publishableKey)return{ok:false,error:'BROKER_PUBLISHABLE_KEY_REQUIRED'};
  if(redirectUrl&&!/^https:\/\/[a-z0-9.-]+(?:\/[^?#]*)?$/i.test(redirectUrl))return{ok:false,error:'BROKER_REDIRECT_URL_INVALID'};
  config={projectUrl,publishableKey,functionName,redirectUrl};
  if(qaBlocked())return{ok:true,qa:true};
  if(authSubscription?.unsubscribe)authSubscription.unsubscribe();
  const browserWindow=window as unknown as BrokerBrowserWindow;
  authClient=browserWindow.supabase?.createClient?browserWindow.supabase.createClient(projectUrl,publishableKey,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:false,storageKey:'asset-os-kis-auth'}}):null;
  if(authClient){const listener=authClient.auth.onAuthStateChange((_event,next)=>adoptSession(next));authSubscription=listener?.data?.subscription||null;authClient.auth.getSession().then(({data})=>adoptSession(data?.session)).catch(()=>{})}
  return{ok:true}
 }
 function configured(){return!!config.projectUrl&&!!config.publishableKey}
 function authState(){return{configured:configured(),signedIn:!!session.accessToken&&session.expiresAt>Date.now(),expiresAt:session.expiresAt||0}}
 function adoptSession(input:unknown){if(qaBlocked())return{ok:false,error:'QA_NETWORK_BLOCKED'};const source=record(input),accessToken=cleanText(source.access_token,6000),expiresAt=Math.max(0,Number(source.expires_at)||0)*1000;if(!accessToken)return{ok:false,error:'AUTH_SESSION_MISSING'};session={accessToken,expiresAt:expiresAt||Date.now()+Math.max(0,Number(source.expires_in)||0)*1000};return{ok:true,expiresAt:session.expiresAt}}
 function accessTokenMatchesProject(token:unknown){try{const part=String(token||'').split('.')[1]||'',padded=part.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(part.length/4)*4,'='),payload=record(JSON.parse(atob(padded))),issuer=new URL(String(payload.iss||'')),metadata=record(payload.app_metadata),provider=String(metadata.provider||''),methods=(Array.isArray(payload.amr)?payload.amr:[]).map(item=>String(record(item).method||'').toLowerCase()),oauthSession=methods.some(method=>method==='oauth'||method.startsWith('oauth_provider/'));return issuer.origin===config.projectUrl&&provider==='email'&&!oauthSession}catch{return false}}
 function signOut(){session={accessToken:'',expiresAt:0};authClient?.auth.signOut({scope:'local'}).catch(()=>{});return{ok:true}}
 async function jsonRequest(url:string,options:RequestInit={}):Promise<BrokerClientResult>{
  if(qaBlocked())return{ok:false,error:'QA_NETWORK_BLOCKED'};
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);try{const response=await fetch(url,{...options,signal:controller.signal}),text=await response.text();let data:unknown={};try{data=text?JSON.parse(text):{}}catch{data={error:'BROKER_RESPONSE_INVALID'}}const body=record(data);
   if(!response.ok)return{ok:false,status:response.status,error:cleanCode(body.error)||`HTTP_${response.status}`,stage:cleanStage(body.stage),upstreamCode:cleanCode(body.upstreamCode)};
   return{ok:true,status:response.status,data}
  }catch(error){return{ok:false,error:record(error).name==='AbortError'?'BROKER_REQUEST_TIMEOUT':'BROKER_NETWORK_ERROR'}}finally{clearTimeout(timer)}
 }
 function publicHeaders(extra:Record<string,string>={}){return{'content-type':'application/json',apikey:config.publishableKey,...extra}}
 async function requestOtp(email:unknown){
  if(qaBlocked())return{ok:false,error:'QA_NETWORK_BLOCKED'};
  if(!configured())return{ok:false,error:'BROKER_NOT_CONFIGURED'};const value=cleanText(email,240);if(!/^\S+@\S+\.\S+$/.test(value))return{ok:false,error:'EMAIL_INVALID'};
  if(authClient){const {error}=await authClient.auth.signInWithOtp({email:value,options:{shouldCreateUser:false,emailRedirectTo:config.redirectUrl||undefined}}),detail=record(error);return error?{ok:false,status:Number(detail.status)||0,error:cleanText(detail.message||detail.code||'AUTH_LINK_FAILED',240)}:{ok:true}}
  const redirect=config.redirectUrl?`?redirect_to=${encodeURIComponent(config.redirectUrl)}`:'';
  const result=await jsonRequest(`${config.projectUrl}/auth/v1/otp${redirect}`,{method:'POST',headers:publicHeaders(),body:JSON.stringify({email:value,create_user:false})});return result.ok?{ok:true}:{ok:false,status:result.status,error:result.error}
 }
 function consumeRedirect(){
  if(qaBlocked())return{ok:false,error:'QA_NETWORK_BLOCKED'};
  if(typeof location==='undefined')return{ok:false,error:'BROKER_REDIRECT_UNAVAILABLE'};const raw=String(location.hash||'');if(!raw.includes('access_token='))return{ok:false,error:'BROKER_REDIRECT_EMPTY'};
  const params=new URLSearchParams(raw.replace(/^#/,'')),accessToken=cleanText(params.get('access_token'),6000),refreshToken=cleanText(params.get('refresh_token'),6000),expiresIn=Math.max(0,Number(params.get('expires_in'))||0);if(!accessToken)return{ok:false,error:'AUTH_SESSION_MISSING'};if(!accessTokenMatchesProject(accessToken))return{ok:false,error:'BROKER_REDIRECT_FOREIGN'};
  session={accessToken,expiresAt:Date.now()+expiresIn*1000};if(authClient&&refreshToken)authClient.auth.setSession({access_token:accessToken,refresh_token:refreshToken}).catch(()=>{});history.replaceState(null,'',`${location.pathname}${location.search}#/home`);return{ok:true,expiresAt:session.expiresAt}
 }
 async function invoke(action:unknown,body:Record<string,unknown>={}):Promise<BrokerClientResult>{
  if(qaBlocked())return{ok:false,error:'QA_NETWORK_BLOCKED'};
  if(!configured())return{ok:false,error:'BROKER_NOT_CONFIGURED'};if(!authState().signedIn)return{ok:false,error:'BROKER_AUTH_REQUIRED'};
  const allowed=new Set<BrokerAction>(['balance','orders','rights','quote']),name=cleanText(action,30) as BrokerAction;if(!allowed.has(name))return{ok:false,error:'BROKER_ACTION_INVALID'};
  const payload=name==='quote'?{action:name,quotes:Array.isArray(body.quotes)?body.quotes:[]}:{action:name,accountKind:body.accountKind,from:body.from,to:body.to};
  const result=await jsonRequest(`${config.projectUrl}/functions/v1/${config.functionName}`,{method:'POST',headers:publicHeaders({authorization:`Bearer ${session.accessToken}`}),body:JSON.stringify(payload)});
  if(!result.ok)return result;const data=record(result.data);if(data.ok!==true||data.action!==name||(name!=='quote'&&data.accountKind!==body.accountKind)||(name==='quote'&&!Array.isArray(data.quotes)))return{ok:false,error:'BROKER_RESPONSE_CONTRACT_INVALID'};return{ok:true,data}
 }
 async function sync(action:BrokerAction,accountKind:unknown,localAccountId:unknown,range:Record<string,unknown>={}){
  const result=await invoke(action,{accountKind,from:range.from,to:range.to});if(!result.ok)return result;const data=record(result.data),fetchedAt=data.fetchedAt||new Date().toISOString(),runtime=(typeof assetOsRuntimeApi!=='undefined'&&assetOsRuntimeApi)||(window as unknown as BrokerBrowserWindow).__assetOS,api=runtime?.brokerKis;if(!api)return{ok:false,error:'BROKER_STORE_UNAVAILABLE'};
  if(action==='balance')return api.importBalance(data.balance||{},accountKind,localAccountId,fetchedAt);
  if(action==='orders')return api.importOrders(data.orders||[],accountKind,localAccountId,fetchedAt,range.to||'');
  return api.importRights(data.rights||[],accountKind,localAccountId,fetchedAt)
 }
 async function quotes(items:unknown){return invoke('quote',{quotes:items})}
 return{configure,authState,adoptSession,signOut,requestOtp,consumeRedirect,invoke,sync,quotes}
})();
