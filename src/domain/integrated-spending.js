'use strict';
const DEFAULT_SPENDING_CATEGORIES = ['식비', '게임·취미', '가전·전자', '용돈·선물', '쇼핑', '주거·관리', '통신', '교통·차량', '보험', '의료·건강', '기타'];
function spendingCategoryLabel(raw) { let name = String(raw || '기타').trim() || '기타'; const aliases = typeof setting === 'function' ? (setting().spendingCategoryAliases || {}) : {}, seen = new Set(); while (Object.hasOwn(aliases, name) && aliases[name] && !seen.has(name)) {
    seen.add(name);
    name = String(aliases[name]);
} return name; }
function spendingCategoryNames() { const settings = setting(), extra = Array.isArray(settings.spendingCategoryNames) ? settings.spendingCategoryNames : [], hidden = new Set(Array.isArray(settings.spendingCategoryHidden) ? settings.spendingCategoryHidden : []); return [...new Set([...DEFAULT_SPENDING_CATEGORIES.filter(x => !hidden.has(x)), ...extra, ...integratedLedger().filter(x => ['expense', 'externalExpense', 'refund'].includes(x.type)).map(x => spendingCategoryLabel(x.category))])].filter(Boolean); }
async function saveSpendingCategory(name, replacement) {
    const from = String(name || '').trim(), to = String(replacement || '').trim(), settings = setting(), keys = ['spendingCategoryNames', 'spendingCategoryHidden', 'spendingCategoryAliases'], before = keys.map(key => ({ key, present: Object.hasOwn(settings, key), value: settings[key] }));
    if (!to || to.length > 60 || ['__proto__', 'constructor', 'prototype'].includes(to) || from === to || !from && spendingCategoryNames().includes(to) || from && spendingCategoryLabel(to) === from) {
        toast('다른 카테고리 이름을 입력해 주세요.');
        return false;
    }
    const names = spendingCategoryNames();
    settings.spendingCategoryNames = [...new Set([...names.filter(x => x !== from), to])];
    settings.spendingCategoryHidden = [...new Set([...(Array.isArray(settings.spendingCategoryHidden) ? settings.spendingCategoryHidden : []), ...(from ? [from] : [])])];
    if (from)
        settings.spendingCategoryAliases = { ...(settings.spendingCategoryAliases || {}), [from]: to };
    if (!(await persist(false))) {
        for (const item of before)
            if (item.present)
                settings[item.key] = item.value;
            else
                delete settings[item.key];
        return false;
    }
    return true;
}
function integratedSpendingRows(month) {
    const source = integratedLedger();
    return source.filter(transaction => !transaction.meta?.cardInterestRefund && (/^\d{4}$/.test(month) ? String(transaction.date || '').startsWith(month + '-') : integratedMonthKey(transaction.date) === month) && ['expense', 'externalExpense', 'refund'].includes(transaction.type)).map(transaction => { const original = transaction.type === 'refund' ? source.find(x => x.id === transaction.meta?.refundOf) : transaction; return { ...transaction, category: spendingCategoryLabel(original?.category || transaction.category), meta: { ...original?.meta, ...transaction.meta, spendingItem: original?.meta?.spendingItem || original?.meta?.merchant || original?.category || transaction.category || '기타' }, amount: transaction.type === 'refund' ? -Number(transaction.amount) : transaction.amount }; });
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
    const yearly = /^\d{4}$/.test(month), total = amount(rows), previousMonth = yearly ? String(Number(month) - 1) : integratedSpendingMonthShift(month, -1), previousTotal = amount(integratedSpendingRows(previousMonth)), change = total - previousTotal, changeRate = previousTotal ? change / previousTotal * 100 : null, trend = [], items = new Map();
    for (const row of rows) {
        const key = String(row.meta?.spendingItem || row.category || '기타'), item = items.get(key) || { key, amount: 0, count: 0, category: row.category || '기타' };
        item.amount += Number(row.amount) || 0;
        item.count++;
        items.set(key, item);
    }
    for (let offset = -5; offset <= 0; offset++) {
        const key = yearly ? String(Number(month) + offset) : integratedSpendingMonthShift(month, offset), value = amount(integratedSpendingRows(key));
        trend.push({ month: key, label: yearly ? `${key}년` : `${Number(key.slice(5))}월`, amount: value });
    }
    return { month, rows, total, fixed: amount(fixedRows), variable: amount(variableRows), fixedRows, variableRows, categories: [...categories.values()].sort((left, right) => right.amount - left.amount || left.key.localeCompare(right.key, 'ko')), items: [...items.values()].sort((left, right) => right.amount - left.amount || left.key.localeCompare(right.key, 'ko')), previousMonth, previousTotal, change, changeRate, trend };
}
