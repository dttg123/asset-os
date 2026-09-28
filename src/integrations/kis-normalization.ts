'use strict';

type KisAccountKind='pension'|'irp';
type KisOrderSide='buy'|'sell';
interface KisNormalizedHolding {productCode:string;productName:string;quantity:number;avgPrice:number;currentPrice:number;marketValue:number;profitLoss:number}
interface KisCashDetail {depositCash:number|null;settledCash:number|null;nextDayCash:number|null;d2Cash:number|null;todayBuyAmount:number|null;todaySellAmount:number|null;availableCash:number|null}

function kisInputRecord(value:unknown):Record<string,unknown>{return value&&typeof value==='object'?value as Record<string,unknown>:{}}
function brokerKisText(value:unknown,max=160){return String(value??'').trim().slice(0,max)}
function brokerKisNumber(value:unknown){const number=Number(String(value??'').replaceAll(',',''));return Number.isFinite(number)?number:0}
function brokerKisNonNegative(value:unknown){return Math.max(0,brokerKisNumber(value))}
function brokerKisDate(value:unknown){const text=brokerKisText(value,10);return /^\d{4}-\d{2}-\d{2}$/.test(text)?text:''}
function brokerKisTimestamp(value:unknown){if(value===undefined||value===null||value==='')return new Date().toISOString();const text=brokerKisText(value,40),date=new Date(text);return text&&!Number.isNaN(date.getTime())?date.toISOString():''}
function brokerKisOptionalTimestamp(value:unknown){const text=brokerKisText(value,40),date=new Date(text);return text&&!Number.isNaN(date.getTime())?date.toISOString():''}
function brokerKisKind(value:unknown):KisAccountKind|''{return value==='pension'||value==='irp'?value:''}
function brokerKisSide(value:unknown):KisOrderSide|''{const text=brokerKisText(value,12).toLowerCase();return text==='sell'||text==='01'?'sell':text==='buy'||text==='02'?'buy':''}
function brokerKisNormalizeHolding(input:unknown):KisNormalizedHolding{const row=kisInputRecord(input);return{productCode:brokerKisText(row.productCode,80),productName:brokerKisText(row.productName,160),quantity:brokerKisNonNegative(row.quantity),avgPrice:brokerKisNonNegative(row.avgPrice),currentPrice:brokerKisNonNegative(row.currentPrice),marketValue:brokerKisNonNegative(row.marketValue),profitLoss:brokerKisNumber(row.profitLoss)}}
function brokerKisNormalizeCashDetail(input:unknown):KisCashDetail{
 const source=kisInputRecord(input),optional=(key:keyof KisCashDetail)=>source[key]===null||source[key]===undefined||source[key]===''?null:brokerKisNonNegative(source[key]);
 return{depositCash:optional('depositCash'),settledCash:optional('settledCash'),nextDayCash:optional('nextDayCash'),d2Cash:optional('d2Cash'),todayBuyAmount:optional('todayBuyAmount'),todaySellAmount:optional('todaySellAmount'),availableCash:optional('availableCash')}
}
