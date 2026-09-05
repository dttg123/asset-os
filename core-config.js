'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const BROKER_KIS_PUBLIC_CONFIG=Object.freeze({projectUrl:'https://wjrzukoofscmvwicmoey.supabase.co',publishableKey:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indqcnp1a29vZnNjbXZ3aWNtb2V5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxNTk0NjcsImV4cCI6MjEwMzczNTQ2N30.DEYttJ7nXU9Z67NY3WXzIjiVFHUEMQ04qPd3JktVYz4',functionName:'kis-read',redirectUrl:'https://dttg123.github.io/asset-os/'});
const QA_MODE=typeof location!=='undefined'&&/(?:^|[?&])qa=1(?:&|$)/.test(String(location.search||''));
const QA_STORAGE_KEY='asset-os-qa-v1',LIVE_STORAGE_KEY='asset-os-v1.9.45-live';
const DEFAULT_FINANCE_DAY=25; const APP_VERSION='v0.4',SCHEMA_VERSION=20,KEY=QA_MODE?QA_STORAGE_KEY:LIVE_STORAGE_KEY,LEGACY_KEYS=['asset-os-v1.9.22-central-schedule','asset-os-v1.9.20-real-finance','asset-os-v1.9.19-finance-linked','asset-os-v1.9.18-integrated-ui-refine','asset-os-v1.9.17-integrated-complete-stage1','asset-os-v1.9.16-integrated-ledger-stage2','asset-os-v1.9.9-pension-step2-analysis','asset-os-v1.9.7-pension-step2-precision','asset-os-v1.9.6-pension-step2-refine','asset-os-v1.9.5-pension-step2','asset-os-v1.9.4-pension-step1','asset-os-v1.9.3-pension-step1','asset-os-v1.9.2-isa-review','asset-os-v1.9.1-isa-review','asset-os-v1.9-isa-review','asset-os-v1.8-isa-review','asset-os-v1.7-isa-review','asset-os-v1.6.1-isa-review','asset-os-v1.6-isa-review','asset-os-v1.5-isa-review','asset-os-v1.4-isa-review','asset-os-v1.3-isa-review'];
const nf=new Intl.NumberFormat('ko-KR');
const clone=v=>JSON.parse(JSON.stringify(v));
const INVESTMENT_ROLES=['성장','배당','현금흐름','안정','현금'];
function localYmd(d){if(d===undefined&&QA_MODE)return'2060-12-31';const value=d===undefined?new Date():d,y=value.getFullYear(),m=String(value.getMonth()+1).padStart(2,'0'),day=String(value.getDate()).padStart(2,'0');return `${y}-${m}-${day}`}
const ymd=()=>localYmd();
const normalizeName=s=>String(s||'').normalize('NFKC').replace(/\s+/g,'').replace(/[()（）·._-]/g,'').toUpperCase();
const txDate=t=>String(t.tradeDate||t.date||'');
const txSequence=t=>Number.isFinite(Number(t.sequence))?Number(t.sequence):0;
const sortTxs=txs=>[...txs].sort((a,b)=>txDate(a).localeCompare(txDate(b))||txSequence(a)-txSequence(b)||String(a.createdAt||'').localeCompare(String(b.createdAt||''))||String(a.id).localeCompare(String(b.id)));
const stableTxKey=t=>[(['buy','openingAllocation'].includes(t.type)?'buy':t.type),txDate(t),t.holdingId||'',Number(t.qty||0).toFixed(8),Number(t.price||0).toFixed(4),Number(t.amount||0).toFixed(2),Number(t.fee||0).toFixed(2),Number(t.tax||0).toFixed(2),t.transferId||'',t.reversesTransactionId||''].join('|');
const won=n=>nf.format(Math.round(Number(n)||0))+'원';
function displayWon(n){n=Math.round(Number(n)||0);const sign=n<0?'-':'',v=Math.abs(n);if(v<100000000)return sign+nf.format(v)+'원';let jo=Math.floor(v/1000000000000),rem=v%1000000000000,eok=Math.floor(rem/100000000),man=Math.round((rem%100000000)/10000);if(man>=10000){man=0;eok++}if(eok>=10000){eok=0;jo++}const parts=[];if(jo)parts.push(`${nf.format(jo)}조`);if(eok)parts.push(`${nf.format(eok)}억`);if(man)parts.push(`${nf.format(man)}만원`);return sign+(parts.length?parts.join(' '):'0원')}
function amountClass(v){const len=displayWon(v).replace(/\s/g,'').length;return len>=16?'amount-xxlong':len>=12?'amount-xlong':len>=9?'amount-long':''}
const num=n=>nf.format(Math.round(Number(n)||0));
const signed=n=>(Number(n)>=0?'+':'-')+won(Math.abs(Number(n)||0));
const pct=n=>(Number(n)>=0?'+':'')+(Number(n)||0).toFixed(1)+'%';
const uid=p=>(p+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7));
const formatDateTime=v=>{if(!v)return '-';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Seoul'}).format(d)};
const transactionSnapshot=t=>{const keys=['id','type','tradeDate','date','settlementDate','sequence','createdAt','holdingId','qty','price','amount','fee','tax','note','transferId','reversesTransactionId','linkedBuyId','sourceDividendId','setQty','setAvg','cashDelta','ratio','status','cancelledAt'];const out={};for(const k of keys)if(t?.[k]!==undefined)out[k]=clone(t[k]);return out};
const transactionRevision=(before,after,action,reason)=>({id:uid('revision'),action,changedAt:new Date().toISOString(),reason:String(reason||'').trim()||(action==='cancel'?'사용자 취소':'사용자 수정'),before:transactionSnapshot(before),after:transactionSnapshot(after)});
const revisionLabel=r=>r.action==='cancel'?'취소 처리':'수정 저장';

const escapeHtml=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let runtimeErrors=0;window.addEventListener('error',()=>runtimeErrors++);window.addEventListener('unhandledrejection',()=>runtimeErrors++);
let scrollRestoreToken=0;
function restoreScrollY(y){const target=Math.max(0,Number(y)||0),token=++scrollRestoreToken,apply=()=>{if(token!==scrollRestoreToken)return false;window.scrollTo(0,target);return true};apply();requestAnimationFrame(()=>{if(!apply())return;requestAnimationFrame(apply)});setTimeout(apply,80)}
function clearScrollGuard(guard){if(!guard)return;if(guard._releaseScrollHandler){window.removeEventListener('scroll',guard._releaseScrollHandler);guard._releaseScrollHandler=null}guard.style.height='0px'}
function holdScrollGuard(guard,height,targetY){if(!guard)return;clearScrollGuard(guard);const h=Math.max(0,Number(height)||0);if(!h)return;guard.style.height=`${h}px`;const release=()=>{const kept=guard.getBoundingClientRect().height,naturalMax=Math.max(0,document.documentElement.scrollHeight-kept-innerHeight);if(window.scrollY<=naturalMax+1){clearScrollGuard(guard);restoreScrollY(Math.min(Math.max(0,targetY),naturalMax));return true}return false};requestAnimationFrame(()=>{if(release())return;const onScroll=()=>requestAnimationFrame(release);guard._releaseScrollHandler=onScroll;window.addEventListener('scroll',onScroll,{passive:true})})}
function renderKeepingScroll(){const y=window.scrollY;render();restoreScrollY(y)}
function stableInlineToggle(anchor,panel,guard,expand,fill){if(!anchor||!panel)return;const y=window.scrollY,beforeH=panel.hidden?0:panel.getBoundingClientRect().height,globalGuard=$('#globalScrollGuard');clearScrollGuard(guard);clearScrollGuard(globalGuard);if(expand){if(typeof fill==='function')fill();panel.hidden=false;panel.classList.add('open');restoreScrollY(y);return}panel.hidden=true;panel.classList.remove('open');requestAnimationFrame(()=>{holdScrollGuard(globalGuard||guard,beforeH,y);restoreScrollY(y)})}
