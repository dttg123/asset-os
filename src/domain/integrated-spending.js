'use strict';
const DEFAULT_SPENDING_CATEGORIES = ['식비', '게임·취미', '가전·전자', '용돈·선물', '쇼핑', '주거·관리', '통신', '교통·차량', '보험', '의료·건강', '미분류', '기타'];
function spendingCategoryLabel(raw) { let name = String(raw || '기타').trim() || '기타'; const aliases = typeof setting === 'function' ? (setting().spendingCategoryAliases || {}) : {}, seen = new Set(); while (Object.hasOwn(aliases, name) && aliases[name] && !seen.has(name)) {
    seen.add(name);
    name = String(aliases[name]);
} return name; }
function spendingCategoryNames() { const settings = setting(), extra = Array.isArray(settings.spendingCategoryNames) ? settings.spendingCategoryNames : [], hidden = new Set(Array.isArray(settings.spendingCategoryHidden) ? settings.spendingCategoryHidden : []); return [...new Set([...DEFAULT_SPENDING_CATEGORIES.filter(x => !hidden.has(x)), ...extra, ...Object.values((settings.spendingClassifications || {})).map(x => spendingCategoryLabel(x?.category)), ...integratedLedger().filter(x => ['expense', 'externalExpense', 'refund'].includes(x.type)).map(x => spendingCategoryLabel(x.category))])].filter(Boolean); }
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
function spendingClassification(row) {
    const settings = typeof setting === 'function' ? setting() : {}, map = settings.spendingClassifications, entry = map && typeof map === 'object' && !Array.isArray(map) && Object.hasOwn(map, String(row.id)) ? map[String(row.id)] : null, label = entry && typeof entry === 'object' ? entry : {};
    const history = typeof financeSchedules === 'function' && financeSchedules().some(x => x.id === row.meta?.cardPlanId && x.source === 'statement-history'), merchant = String(row.meta?.merchant || '').trim(), fallback = history && row.category === '기타' ? (merchant === '조이시티' ? '게임·취미' : '미분류') : row.category;
    return { category: spendingCategoryLabel(typeof label.category === 'string' && label.category ? label.category : fallback), item: typeof label.item === 'string' && label.item ? label.item : String(history && merchant ? merchant : row.meta?.spendingItem || row.meta?.merchant || row.category || '미분류') };
}
async function saveSpendingClassifications(ids, category, item) {
    const source = typeof state !== 'undefined' && typeof integratedManualLedger === 'function' ? integratedManualLedger() : integratedLedger(), selected = [...new Set(ids)], name = String(item || '').trim(), group = String(category || '').trim(), settings = setting(), had = Object.hasOwn(settings, 'spendingClassifications'), before = settings.spendingClassifications;
    if (!selected.length || !name || name.length > 100 || !group || group.length > 60 || selected.some(id => !source.some(row => row.id === id && ['expense', 'externalExpense'].includes(row.type)))) {
        toast('분류할 구매 기록과 항목 이름을 확인해 주세요.');
        return false;
    }
    const next = { ...(before && typeof before === 'object' && !Array.isArray(before) ? before : {}) };
    for (const id of selected)
        Object.defineProperty(next, id, { value: { category: group, item: name }, enumerable: true, configurable: true, writable: true });
    settings.spendingClassifications = next;
    try {
        if (await persist(false))
            return true;
    }
    catch { }
    if (had)
        settings.spendingClassifications = before;
    else
        delete settings.spendingClassifications;
    toast('분류를 저장하지 못해 되돌렸어요.');
    return false;
}
function integratedSpendingRows(month) {
    const source = integratedLedger(), originals = typeof state !== 'undefined' && typeof integratedManualLedger === 'function' ? integratedManualLedger() : source;
    return source.filter(transaction => !transaction.meta?.cardInterestRefund && (/^\d{4}$/.test(month) ? String(transaction.date || '').startsWith(month + '-') : integratedMonthKey(transaction.date) === month) && ['expense', 'externalExpense', 'refund'].includes(transaction.type)).map(transaction => { const original = transaction.type === 'refund' ? originals.find(x => x.id === transaction.meta?.refundOf) || transaction : transaction, label = spendingClassification(original); return { ...transaction, category: label.category, meta: { ...original.meta, ...transaction.meta, spendingItem: label.item }, amount: transaction.type === 'refund' ? -Number(transaction.amount) : transaction.amount }; });
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
