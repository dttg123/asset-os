'use strict';
function statusText(s){return ({active:'운영 중',maturity_pending:'만기 대기',closed:'일반 해지 완료',transferred:'연금 전환 완료',archived:'보관'})[s]||s}
function validYmdDate(v){const s=String(v||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const [y,m,d]=s.split('-').map(Number),dt=new Date(`${s}T12:00:00`);return dt.getFullYear()===y&&dt.getMonth()+1===m&&dt.getDate()===d}
function postedDateError(date){const d=String(date||'');if(!validYmdDate(d))return'날짜를 확인해 주세요.';if(d>localYmd())return'미래 날짜의 완료 거래는 저장할 수 없습니다.';return''}
function isaTransactionDateError(a,date){const d=String(date||''),basic=postedDateError(d);if(basic)return basic;const opened=String(a?.openedAt||a?.baselineDate||a?.baseline?.date||'');if(opened&&d<opened)return'ISA 개설일 이전 거래는 저장할 수 없습니다.';const end=String(a?.closedAt||a?.maturityAt||'');if(end&&d>end)return'ISA 만기·종료일 이후 거래는 저장할 수 없습니다.';return''}
function pensionTransactionDateError(a,date){const d=String(date||''),basic=postedDateError(d);if(basic)return basic;const opened=String(a?.openedAt||'');if(opened&&d<opened)return`${pensionAccountKindLabel(a?.kind||'pension')} 개설일 이전 거래는 저장할 수 없습니다.`;const end=String(a?.closedAt||'');if(end&&d>end)return`${pensionAccountKindLabel(a?.kind||'pension')} 종료일 이후 거래는 저장할 수 없습니다.`;return''}
function isCurrentAccount(a){return !!a&&['active','maturity_pending'].includes(a.status)}
function isTradeableAccount(a){return !!a&&a.status==='active'}
function isPastAccount(a){return !!a&&['closed','transferred','archived'].includes(a.status)}
function transactionNumericError(tx){
 const finite=v=>Number.isFinite(Number(v)),fee=Number(tx.fee??0),tax=Number(tx.tax??0);
 if(!finite(fee)||!finite(tax)||fee<0||tax<0)return '수수료와 세금은 0 이상의 올바른 숫자여야 합니다.';
 if(['buy','sell','openingAllocation'].includes(tx.type)){const q=Number(tx.qty),p=Number(tx.price);if(!finite(q)||q<=0)return '수량은 0보다 커야 합니다.';if(!finite(p)||p<=0)return '단가는 0보다 커야 합니다.';if(tx.type==='sell'&&fee+tax>q*p+1e-8)return '매도 수수료와 세금 합계가 매도금액을 초과할 수 없습니다.'}
 if(['securityTransferIn','securityTransferOut'].includes(tx.type)){const q=Number(tx.qty);if(!finite(q)||q<=0)return '이전 수량은 0보다 커야 합니다.'}
 if(['deposit','internalTransferIn','depositReversal','withdrawal','internalTransferOut','dividend','distribution','interest','feeRefund','taxRefund'].includes(tx.type)){const amount=Number(tx.amount);if(!finite(amount)||amount<=0)return '금액은 0보다 커야 합니다.';if(['dividend','distribution','interest'].includes(tx.type)&&fee+tax>amount+1e-8)return '수수료와 세금 합계가 세전 수령액을 초과할 수 없습니다.'}
 if(tx.type==='adjustment'){for(const key of ['setQty','setAvg','cashDelta'])if(tx[key]!=null&&tx[key]!==''&&!finite(tx[key]))return '잔고 조정값은 올바른 숫자여야 합니다.';if(tx.setQty!=null&&Number(tx.setQty)<0)return '조정 수량은 음수가 될 수 없습니다.';if(tx.setAvg!=null&&Number(tx.setAvg)<0)return '조정 평균단가는 음수가 될 수 없습니다.'}
 return ''
}
function typeText(t){return ({buy:'매수',sell:'매도',openingAllocation:'기초자금 매수반영',dividend:'배당',distribution:'ETF 분배금',interest:'예수금 이자',deposit:'외부 입금',internalTransferIn:'통합→ISA 이체',depositReversal:'입금 취소·반환',withdrawal:'일반 출금',internalTransferOut:'ISA→통합 이체',adjustment:'잔고 조정',split:'액면분할',reverseSplit:'병합',merger:'합병',delisting:'상장폐지',feeRefund:'수수료 환급',taxRefund:'세금 환급'})[t]||t}

