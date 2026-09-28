'use strict';
function holdingPriceScale(holding) { const value = Number(holding?.priceScale); return Number.isFinite(value) && value > 0 ? value : 1; }
function holdingPositionValue(holding, quantity = holding?.qty, price = holding?.currentPrice) { return (Number(quantity) || 0) * (Number(price) || 0) / holdingPriceScale(holding); }
function holdingCostValue(holding, quantity = holding?.qty, price = holding?.avgPrice) { return holdingPositionValue(holding, quantity, price); }
function transactionPositionValue(holding, quantity, price) { return holdingPositionValue(holding, quantity, price); }
function calculatePensionPosition(holding, transactions) {
    let qty = Math.max(0, Number(holding.baselineQty ?? holding.qty) || 0), avg = Math.max(0, Number(holding.baselineAvgPrice ?? holding.avgPrice) || 0);
    const rows = transactions.filter(transaction => transaction.holdingId === holding.id && ['buy', 'sell', 'adjustment'].includes(String(transaction.type))).sort((left, right) => String(left.date).localeCompare(String(right.date)) || String(left.createdAt || '').localeCompare(String(right.createdAt || '')) || String(left.id).localeCompare(String(right.id)));
    for (const transaction of rows) {
        if (transaction.type === 'buy') {
            const quantity = Math.max(0, Number(transaction.qty) || 0), price = Math.max(0, Number(transaction.price) || 0), oldCost = qty * avg, newCost = quantity * price + Math.max(0, Number(transaction.fee) || 0) + Math.max(0, Number(transaction.tax) || 0);
            qty += quantity;
            avg = qty ? (oldCost + newCost) / qty : 0;
        }
        else if (transaction.type === 'sell') {
            qty = Math.max(0, qty - Math.max(0, Number(transaction.qty) || 0));
            if (qty <= 1e-9) {
                qty = 0;
                avg = 0;
            }
        }
        else if (transaction.type === 'adjustment') {
            qty = Math.max(0, Number(transaction.setQty) || 0);
            avg = qty ? Math.max(0, Number(transaction.setAvg) || 0) : 0;
        }
    }
    return { qty, avg };
}
