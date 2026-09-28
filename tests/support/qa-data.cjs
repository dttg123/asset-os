'use strict';
const crypto=require('node:crypto');

function seeded(seed){let value=Number(seed)>>>0;return()=>{value+=0x6d2b79f5;let t=value;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function longHorizon({seed=20260928,startYear=2026,years=1}={}){
 const random=seeded(seed),rows=[],accounts=[{id:'cash'},{id:'savings'}],liabilities=[{id:'loan'}];
 rows.push({id:'opening-cash',date:`${startYear}-01-01`,sequence:1,type:'openingAsset',toAccountId:'cash',amount:5000000});
 rows.push({id:'opening-loan',date:`${startYear}-01-01`,sequence:2,type:'openingLiability',liabilityId:'loan',amount:2000000});
 for(let offset=0;offset<years*12;offset++){
  const year=startYear+Math.floor(offset/12),month=offset%12+1,key=`${year}-${String(month).padStart(2,'0')}`;
  const income=4000000+Math.floor(random()*600001),expense=1200000+Math.floor(random()*500001),saving=300000+Math.floor(random()*200001),principal=Math.min(50000,Math.max(0,2000000-offset*50000));
  rows.push(
   {id:`income-${key}`,date:`${key}-25`,type:'externalIncome',toAccountId:'cash',amount:income},
   {id:`expense-${key}`,date:`${key}-26`,type:'expense',fromAccountId:'cash',amount:expense},
   {id:`save-${key}`,date:`${key}-27`,type:'internalTransfer',fromAccountId:'cash',toAccountId:'savings',amount:saving}
  );
  if(principal)rows.push({id:`principal-${key}`,date:`${key}-28`,type:'debtPrincipal',fromAccountId:'cash',liabilityId:'loan',amount:principal});
 }
 const canonical=JSON.stringify({seed,startYear,years,rows});
 return{seed,startYear,years,accounts,liabilities,rows,hash:crypto.createHash('sha256').update(canonical).digest('hex')}
}
module.exports={seeded,longHorizon};
