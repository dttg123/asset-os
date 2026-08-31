'use strict';
function setting(){return state.settings}
function currentAccount(){return state.accounts.find(a=>a.id===setting().selectedAccountId)||state.accounts[0]}
function policy(kind='isa',account='current'){const group=state.policies[kind];if(!group)return{};if(Array.isArray(group.versions)){let targetId=group.activePolicyId;if(kind==='isa'){if(account===null)targetId=group.activePolicyId;else if(account==='current')targetId=currentAccount()?.policyId||group.activePolicyId;else targetId=account?.policyId||group.activePolicyId}else if(account&&typeof account==='object')targetId=account.policyId||group.activePolicyId;return group.versions.find(v=>v.id===targetId)||group.versions.find(v=>v.id===group.activePolicyId)||group.versions[0]||{}}return group}
function policyForYear(kind,year){const group=state.policies[kind];if(!group?.versions?.length)return policy(kind);const y=Number(year)||new Date().getFullYear(),end=`${y}-12-31`,eligible=group.versions.filter(v=>!v.effectiveFrom||String(v.effectiveFrom)<=end).sort((a,b)=>String(a.effectiveFrom||'').localeCompare(String(b.effectiveFrom||'')));return eligible.at(-1)||group.versions[0]||{}}
function policyGroup(kind){return state.policies[kind]||{activePolicyId:'',versions:[]}}
function policyStatus(p){return p?.userEdited?'사용자 설정':p?.status==='current'?'현행':'보관'}

