'use strict';
function kisInputRecord(value) { return value && typeof value === 'object' ? value : {}; }
function brokerKisText(value, max = 160) { return String(value ?? '').trim().slice(0, max); }
function brokerKisNumber(value) { const number = Number(String(value ?? '').replaceAll(',', '')); return Number.isFinite(number) ? number : 0; }
function brokerKisNonNegative(value) { return Math.max(0, brokerKisNumber(value)); }
function brokerKisDate(value) { const text = brokerKisText(value, 10); return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : ''; }
function brokerKisTimestamp(value) { if (value === undefined || value === null || value === '')
    return new Date().toISOString(); const text = brokerKisText(value, 40), date = new Date(text); return text && !Number.isNaN(date.getTime()) ? date.toISOString() : ''; }
function brokerKisOptionalTimestamp(value) { const text = brokerKisText(value, 40), date = new Date(text); return text && !Number.isNaN(date.getTime()) ? date.toISOString() : ''; }
function brokerKisKind(value) { return value === 'pension' || value === 'irp' ? value : ''; }
function brokerKisSide(value) { const text = brokerKisText(value, 12).toLowerCase(); return text === 'sell' || text === '01' ? 'sell' : text === 'buy' || text === '02' ? 'buy' : ''; }
function brokerKisNormalizeHolding(input) { const row = kisInputRecord(input); return { productCode: brokerKisText(row.productCode, 80), productName: brokerKisText(row.productName, 160), quantity: brokerKisNonNegative(row.quantity), avgPrice: brokerKisNonNegative(row.avgPrice), currentPrice: brokerKisNonNegative(row.currentPrice), marketValue: brokerKisNonNegative(row.marketValue), profitLoss: brokerKisNumber(row.profitLoss) }; }
function brokerKisNormalizeCashDetail(input) {
    const source = kisInputRecord(input), optional = (key) => source[key] === null || source[key] === undefined || source[key] === '' ? null : brokerKisNonNegative(source[key]);
    return { depositCash: optional('depositCash'), settledCash: optional('settledCash'), nextDayCash: optional('nextDayCash'), d2Cash: optional('d2Cash'), todayBuyAmount: optional('todayBuyAmount'), todaySellAmount: optional('todaySellAmount'), availableCash: optional('availableCash') };
}
