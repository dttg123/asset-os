'use strict';
function integratedSpendingRows(month) {
    return integratedLedger().filter(transaction => integratedMonthKey(transaction.date) === month && ['expense', 'externalExpense', 'refund'].includes(transaction.type)).map(transaction => transaction.type === 'refund' ? { ...transaction, amount: -Number(transaction.amount) } : transaction);
}
function integratedSpendingMonthShift(month, delta) {
    const [year, value] = String(month).split('-').map(Number), date = new Date(year, value - 1 + delta, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
function integratedSpendingAnalysis(month = integratedLatestMonth()) {
    const rows = integratedSpendingRows(month), amount = (list) => list.reduce((sum, row) => sum + (Number(row.amount) || 0), 0), fixedRows = rows.filter(row => row.fixed), variableRows = rows.filter(row => !row.fixed), categories = new Map();
    for (const row of rows) {
        const key = String(row.category || '기타').trim() || '기타', entry = categories.get(key) || { key, amount: 0, count: 0 };
        entry.amount += Number(row.amount) || 0;
        entry.count++;
        categories.set(key, entry);
    }
    const total = amount(rows), previousMonth = integratedSpendingMonthShift(month, -1), previousTotal = amount(integratedSpendingRows(previousMonth)), change = total - previousTotal, changeRate = previousTotal ? change / previousTotal * 100 : null, trend = [];
    for (let offset = -5; offset <= 0; offset++) {
        const key = integratedSpendingMonthShift(month, offset), value = amount(integratedSpendingRows(key));
        trend.push({ month: key, label: `${Number(key.slice(5))}월`, amount: value });
    }
    return { month, rows, total, fixed: amount(fixedRows), variable: amount(variableRows), fixedRows, variableRows, categories: [...categories.values()].sort((left, right) => right.amount - left.amount || left.key.localeCompare(right.key, 'ko')), previousMonth, previousTotal, change, changeRate, trend };
}
