'use strict';

const brokerKisClient=(()=>{
 let config={projectUrl:'',publishableKey:'',functionName:'kis-read',redirectUrl:''};
 let session={accessToken:'',expiresAt:0};
 const cleanUrl=v=>String(v||'').trim().replace(/\/+$/,'');
 const cleanText=(v,max=200)=>String(v||'').trim().slice(0,max);
 function configure(input={}){
  const projectUrl=cleanUrl(input.projectUrl),publishableKey=cleanText(input.publishableKey,300),functionName=cleanText(input.functionName||'kis-read',80),redirectUrl=cleanUrl(input.redirectUrl);
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(projectUrl))return{ok:false,error:'BROKER_PROJECT_URL_INVALID'};
  if(!publishableKey)return{ok:false,error:'BROKER_PUBLISHABLE_KEY_REQUIRED'};
  if(redirectUrl&&!/^https:\/\/[a-z0-9.-]+(?:\/[^?#]*)?$/i.test(redirectUrl))return{ok:false,error:'BROKER_REDIRECT_URL_INVALID'};
  config={projectUrl,publishableKey,functionName,redirectUrl};return{ok:true}
 }
 function configured(){return !!config.projectUrl&&!!config.publishableKey}
 function authState(){return{configured:configured(),signedIn:!!session.accessToken&&session.expiresAt>Date.now(),expiresAt:session.expiresAt||0}}
 function signOut(){session={accessToken:'',expiresAt:0};return{ok:true}}
 async function jsonRequest(url,options={}){
  const response=await fetch(url,options),text=await response.text();let data={};try{data=text?JSON.parse(text):{}}catch{data={error:'BROKER_RESPONSE_INVALID'}}
  if(!response.ok)return{ok:false,status:response.status,error:cleanText(data?.message||data?.msg||data?.error||`HTTP_${response.status}`,240)};
  return{ok:true,status:response.status,data}
 }
 function publicHeaders(extra={}){return{'content-type':'application/json',apikey:config.publishableKey,...extra}}
 async function requestOtp(email){
  if(!configured())return{ok:false,error:'BROKER_NOT_CONFIGURED'};const value=cleanText(email,240);if(!/^\S+@\S+\.\S+$/.test(value))return{ok:false,error:'EMAIL_INVALID'};
  const redirect=config.redirectUrl?`?redirect_to=${encodeURIComponent(config.redirectUrl)}`:'';
  const result=await jsonRequest(`${config.projectUrl}/auth/v1/otp${redirect}`,{method:'POST',headers:publicHeaders(),body:JSON.stringify({email:value,create_user:false})});return result.ok?{ok:true}:{ok:false,status:result.status,error:result.error}
 }
 function consumeRedirect(){
  if(typeof location==='undefined')return{ok:false,error:'BROKER_REDIRECT_UNAVAILABLE'};const raw=String(location.hash||'');if(!raw.includes('access_token='))return{ok:false,error:'BROKER_REDIRECT_EMPTY'};
  const params=new URLSearchParams(raw.replace(/^#/,'')),accessToken=cleanText(params.get('access_token'),6000),expiresIn=Math.max(0,Number(params.get('expires_in'))||0);if(!accessToken)return{ok:false,error:'AUTH_SESSION_MISSING'};
  session={accessToken,expiresAt:Date.now()+expiresIn*1000};history.replaceState(null,'',`${location.pathname}${location.search}#/home`);return{ok:true,expiresAt:session.expiresAt}
 }
 async function verifyOtp(email,token){
  if(!configured())return{ok:false,error:'BROKER_NOT_CONFIGURED'};const value=cleanText(email,240),code=cleanText(token,12);if(!/^\S+@\S+\.\S+$/.test(value)||!/^\d{6,8}$/.test(code))return{ok:false,error:'OTP_INVALID'};
  const result=await jsonRequest(`${config.projectUrl}/auth/v1/verify`,{method:'POST',headers:publicHeaders(),body:JSON.stringify({email:value,token:code,type:'email'})});
  const accessToken=cleanText(result.data?.access_token,6000),expiresIn=Math.max(0,Number(result.data?.expires_in)||0);if(!result.ok||!accessToken)return{ok:false,status:result.status,error:result.error||'AUTH_SESSION_MISSING'};
  session={accessToken,expiresAt:Date.now()+expiresIn*1000};return{ok:true,expiresAt:session.expiresAt}
 }
 async function invoke(action,body={}){
  if(!configured())return{ok:false,error:'BROKER_NOT_CONFIGURED'};if(!authState().signedIn)return{ok:false,error:'BROKER_AUTH_REQUIRED'};
  const allowed=new Set(['balance','orders','rights']),name=cleanText(action,30);if(!allowed.has(name))return{ok:false,error:'BROKER_ACTION_INVALID'};
  const result=await jsonRequest(`${config.projectUrl}/functions/v1/${config.functionName}`,{method:'POST',headers:publicHeaders({authorization:`Bearer ${session.accessToken}`}),body:JSON.stringify({action:name,accountKind:body.accountKind,from:body.from,to:body.to})});
  if(!result.ok)return result;const data=result.data;if(!data||data.ok!==true||data.action!==name||!['pension','irp'].includes(data.accountKind))return{ok:false,error:'BROKER_RESPONSE_CONTRACT_INVALID'};return{ok:true,data}
 }
 async function sync(action,accountKind,localAccountId,range={}){
  const result=await invoke(action,{accountKind,from:range.from,to:range.to});if(!result.ok)return result;const data=result.data,fetchedAt=data.fetchedAt||new Date().toISOString(),api=window.__assetOS?.brokerKis;if(!api)return{ok:false,error:'BROKER_STORE_UNAVAILABLE'};
  if(action==='balance')return api.importBalance(data.balance||{},accountKind,localAccountId,fetchedAt);
  if(action==='orders')return api.importOrders(data.orders||[],accountKind,localAccountId,fetchedAt);
  return api.importRights(data.rights||[],accountKind,localAccountId,fetchedAt)
 }
 return{configure,authState,signOut,requestOtp,verifyOtp,consumeRedirect,invoke,sync}
})();
