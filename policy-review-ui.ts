'use strict';

interface PolicyUiItem {id?:string;verifiedAt?:string;reviewAfter?:string;expiresAt?:string;sourceUrl?:string;sourceLabel?:string;effectiveFrom?:string}
interface PolicyUiReviewResult {code:'ok'|'review-soon'|'needs-review';label:'정상'|'재검토 예정'|'확인 필요';reviewAt:string;reason:string;daysRemaining:number|null}
interface PolicyUiGroup {versions:PolicyUiItem[]}
interface PolicyUiSettings {policyTab?:string}
declare function localYmd():string;
declare function formatDate(value:unknown):string;
declare function setting():PolicyUiSettings;
declare function currentAccount():unknown;
declare function policy(kind:string,account?:unknown):PolicyUiItem;
declare function policyGroup(kind:string):PolicyUiGroup;
declare function policyReviewState(item:PolicyUiItem|null|undefined,at?:Date|string):PolicyUiReviewResult;
declare var openPolicyHub:(initialKind?:string,financeFilter?:string)=>unknown;
declare var openPolicyReadonly:(kind?:string,policyId?:string)=>unknown;

function policyReviewClass(review:PolicyUiReviewResult){return review.code==='needs-review'?'review-needed':review.code==='review-soon'?'review-soon':'review-ok'}
function policySafeSourceUrl(value:unknown){try{const url=new URL(String(value||''));return url.protocol==='https:'?url.href:''}catch{return''}}
function renderPolicyReviewNotice(item:PolicyUiItem){
 const card=document.querySelector('#sheetBody .policy-card');if(!card)return;
 const review=policyReviewState(item,localYmd()),badge=card.querySelector('.policy-status');
 if(badge){badge.textContent=review.label;badge.classList.remove('user','review-needed','review-soon','review-ok');badge.classList.add(policyReviewClass(review))}
 card.querySelector('.policy-review-notice')?.remove();
 if(review.code!=='ok'){
  const notice=document.createElement('div');notice.className=`policy-review-notice ${policyReviewClass(review)}`;
  notice.textContent=review.code==='needs-review'?`정책값 재확인이 필요합니다 · ${review.reason}`:`${formatDate(review.reviewAt)}까지 정책값을 다시 확인하세요.`;
  card.querySelector('.policy-summary-grid')?.before(notice);
 }
 const note=card.querySelector('.source-note'),url=policySafeSourceUrl(item.sourceUrl);
 if(note){note.textContent=`다음 재검토 ${formatDate(review.reviewAt)} · 계산은 현재 저장값을 계속 사용합니다.`;if(url){const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.textContent=' 출처 열기';note.appendChild(link)}}
}
const openPolicyHubWithoutReview=openPolicyHub;
openPolicyHub=function(initialKind='',financeFilter='all'){
 const result=openPolicyHubWithoutReview(initialKind,financeFilter);if(initialKind==='finance')return result;
 const kind=['isa','pension','irp'].includes(initialKind)?initialKind:(['isa','pension','irp'].includes(setting().policyTab||'')?String(setting().policyTab):'isa'),item=kind==='isa'?policy('isa',currentAccount()):policy(kind,null);renderPolicyReviewNotice(item);return result
};
const openPolicyReadonlyWithoutReview=openPolicyReadonly;
openPolicyReadonly=function(kind='isa',policyId=''){
 const result=openPolicyReadonlyWithoutReview(kind,policyId),group=policyGroup(kind),item=policyId?(group.versions.find(version=>version.id===policyId)||policy(kind)):policy(kind),review=policyReviewState(item,localYmd()),note=document.querySelector('#sheetBody .source-note'),url=policySafeSourceUrl(item.sourceUrl);
 if(note){note.textContent=`${item.sourceLabel} · 적용 ${formatDate(item.effectiveFrom)} · 확인 ${formatDate(item.verifiedAt)} · ${review.label}`;if(url){const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.textContent=' · 출처 열기';note.appendChild(link)}}return result
};
