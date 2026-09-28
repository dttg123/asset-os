'use strict';
const POLICY_REVIEW_DAYS=180,POLICY_REVIEW_SOON_DAYS=30;

interface ReviewablePolicy {
 verifiedAt?: string;
 reviewAfter?: string;
 expiresAt?: string;
}
type PolicyReviewCode='ok'|'review-soon'|'needs-review';
interface PolicyReviewResult {
 code: PolicyReviewCode;
 label: '정상'|'재검토 예정'|'확인 필요';
 reviewAt: string;
 reason: ''|'확인일 없음'|'연도 변경'|'확인 후 180일 경과'|'검토일 임박';
 daysRemaining: number|null;
}

function policyDateOrdinal(value:string){const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||''));if(!match)return NaN;const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]),date=new Date(Date.UTC(year,month-1,day));return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day?Math.floor(date.getTime()/86400000):NaN}
function policyOrdinalDate(ordinal:number){return new Date(ordinal*86400000).toISOString().slice(0,10)}
function policyDateAddDays(date:string,days:number){const ordinal=policyDateOrdinal(date);return Number.isFinite(ordinal)?policyOrdinalDate(ordinal+Math.trunc(days)):''}
function policyLocalDate(value:Date|string){if(typeof value==='string')return /^\d{4}-\d{2}-\d{2}$/.test(value)?value:'';const date=value instanceof Date?value:new Date(value);if(Number.isNaN(date.getTime()))return'';return`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
function policyReviewState(item:ReviewablePolicy|null|undefined,at:Date|string=new Date()):PolicyReviewResult{
 const today=policyLocalDate(at),verifiedAt=String(item?.verifiedAt||''),verifiedOrdinal=policyDateOrdinal(verifiedAt),todayOrdinal=policyDateOrdinal(today);
 if(!Number.isFinite(verifiedOrdinal)||!Number.isFinite(todayOrdinal))return{code:'needs-review',label:'확인 필요',reviewAt:'',reason:'확인일 없음',daysRemaining:null};
 const configuredReview=String(item?.reviewAfter||item?.expiresAt||''),ageReview=policyDateOrdinal(configuredReview)>verifiedOrdinal?configuredReview:policyDateAddDays(verifiedAt,POLICY_REVIEW_DAYS);
 const yearReview=`${Number(verifiedAt.slice(0,4))+1}-01-01`,reviewAt=[ageReview,yearReview].filter(date=>Number.isFinite(policyDateOrdinal(date))).sort()[0]||ageReview;
 const daysRemaining=policyDateOrdinal(reviewAt)-todayOrdinal;
 if(daysRemaining<=0){const reason:PolicyReviewResult['reason']=today.slice(0,4)!==verifiedAt.slice(0,4)?'연도 변경':'확인 후 180일 경과';return{code:'needs-review',label:'확인 필요',reviewAt,reason,daysRemaining}}
 if(daysRemaining<=POLICY_REVIEW_SOON_DAYS)return{code:'review-soon',label:'재검토 예정',reviewAt,reason:'검토일 임박',daysRemaining};
 return{code:'ok',label:'정상',reviewAt,reason:'',daysRemaining}
}
