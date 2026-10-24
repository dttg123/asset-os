'use strict';
const DEFAULT_SPENDING_CATEGORIES = ['식비', '게임·취미', '가전·전자', '용돈·선물', '쇼핑', '주거·관리', '통신', '교통·차량', '보험', '의료·건강', '미분류', '기타'];
function spendingCategoryLabel(raw) { let name = String(raw || '기타').trim() || '기타'; const aliases = typeof setting === 'function' ? (setting().spendingCategoryAliases || {}) : {}, seen = new Set(); while (Object.hasOwn(aliases, name) && aliases[name] && !seen.has(name)) {
    seen.add(name);
    name = String(aliases[name]);
} return name; }
function spendingCategoryNames() { const settings = setting(), extra = Array.isArray(settings.spendingCategoryNames) ? settings.spendingCategoryNames : [], hidden = new Set(Array.isArray(settings.spendingCategoryHidden) ? settings.spendingCategoryHidden : []); return [...new Set([...DEFAULT_SPENDING_CATEGORIES, ...extra].map(spendingCategoryLabel))].filter(x => !!x && !hidden.has(x)); }
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
function spendingCategoryNamesSafe(name) { if (typeof setting !== 'function')
    return DEFAULT_SPENDING_CATEGORIES.includes(name); return spendingCategoryNames().includes(spendingCategoryLabel(name)); }
function spendingClassification(row) {
    const settings = typeof setting === 'function' ? setting() : {}, map = settings.spendingClassifications, entry = map && typeof map === 'object' && !Array.isArray(map) && Object.hasOwn(map, String(row.id)) ? map[String(row.id)] : null, label = entry && typeof entry === 'object' ? entry : {};
    const history = typeof financeSchedules === 'function' && financeSchedules().some(x => x.id === row.meta?.cardPlanId && x.source === 'statement-history'), merchant = String(row.meta?.merchant || '').trim(), fallback = history && row.category === '기타' ? (merchant === '조이시티' ? '게임·취미' : '미분류') : row.category;
    const schedule = typeof financeSchedules === 'function' ? financeSchedules().find(x => x.id === row.meta?.scheduleId) : null, raw = String(fallback || ''), known = spendingCategoryNamesSafe(raw), derived = known ? raw : schedule?.kind === 'insurance' ? '보험' : raw === '어머니용돈' ? '용돈·선물' : raw.includes('보험') ? '보험' : raw === '생활비' ? '기타' : fallback;
    return { category: spendingCategoryLabel(typeof label.category === 'string' && label.category ? label.category : derived), item: typeof label.item === 'string' && label.item ? label.item : String(history && merchant ? merchant : row.meta?.spendingItem || row.meta?.merchant || row.category || '미분류') };
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
    const range = spendingRange(month);
    const source = integratedLedger(), originals = typeof state !== 'undefined' && typeof integratedManualLedger === 'function' ? integratedManualLedger() : source;
    return source.filter(transaction => !transaction.meta?.cardInterestRefund && String(transaction.date || '') >= range.start && String(transaction.date || '') < range.end && ['expense', 'externalExpense', 'refund'].includes(transaction.type)).map(transaction => { const original = transaction.type === 'refund' ? originals.find(x => x.id === transaction.meta?.refundOf) || transaction : transaction, label = spendingClassification(original); return { ...transaction, category: label.category, fixed: !!original.fixed, meta: { ...original.meta, ...transaction.meta, spendingItem: label.item }, amount: transaction.type === 'refund' ? -Number(transaction.amount) : transaction.amount }; });
}
function spendingRange(period) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(period)) {
        const date = new Date(period + 'T00:00:00Z');
        if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== period)
            throw new Error('소비 날짜를 확인해 주세요.');
        date.setUTCDate(date.getUTCDate() + 1);
        return { start: period, end: date.toISOString().slice(0, 10), months: 0 };
    }
    const match = /^(\d{4})(?:-(\d{2})|-([QH])([1-4]))?$/.exec(period);
    if (!match)
        throw new Error('지원하지 않는 소비 기간입니다.');
    const year = Number(match[1]), months = match[3] === 'Q' ? 3 : match[3] === 'H' ? 6 : match[2] ? 1 : 12, index = Number(match[4] || 1), month = match[2] ? Number(match[2]) : (index - 1) * months + 1;
    if (month < 1 || month > 12)
        throw new Error('소비 기간을 확인해 주세요.');
    const start = `${year}-${String(month).padStart(2, '0')}`;
    return { start: start + '-01', end: integratedSpendingMonthShift(start, months) + '-01', months };
}
function spendingRangeKey(anchor, mode) {
    const year = anchor.slice(0, 4), month = Number(anchor.slice(5, 7));
    return mode === 'quarter' ? `${year}-Q${Math.ceil(month / 3)}` : mode === 'half' ? `${year}-H${Math.ceil(month / 6)}` : ['year', 'years'].includes(mode) ? year : anchor;
}
function spendingRangeLabel(period) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(period))
        return `${period.slice(0, 4)}년 ${Number(period.slice(5, 7))}월 ${Number(period.slice(8))}일`;
    const match = /^(\d{4})-([QH])(\d)$/.exec(period);
    return match ? `${match[1]}년 ${match[2] === 'Q' ? match[3] + '분기' : match[3] === '1' ? '상반기' : '하반기'}` : period.length === 4 ? period + '년' : `${period.slice(0, 4)}년 ${Number(period.slice(5))}월`;
}
function integratedSpendingView(anchor, mode = 'half') {
    const key = spendingRangeKey(anchor, mode), analysis = integratedSpendingAnalysis(key), range = spendingRange(key), start = range.start.slice(0, 7), trend = [];
    if (mode === 'month') {
        const days = new Date(Number(anchor.slice(0, 4)), Number(anchor.slice(5, 7)), 0).getDate();
        for (let d = 1; d <= days; d++) {
            const day = anchor + '-' + String(d).padStart(2, '0');
            trend.push({ month: day, label: d === 1 || d % 5 === 0 || d === days ? `${d}일` : '', amount: analysis.rows.filter(row => row.date === day).reduce((sum, row) => sum + Number(row.amount || 0), 0) });
        }
        return { ...analysis, trend };
    }
    if (mode === 'years')
        return { ...analysis, trend: analysis.trend };
    for (let i = 0; i < range.months; i++) {
        const month = integratedSpendingMonthShift(start, i);
        trend.push({ month, label: `${Number(month.slice(5))}월`, amount: analysis.rows.filter(row => integratedMonthKey(row.date) === month).reduce((sum, row) => sum + (Number(row.amount) || 0), 0) });
    }
    return { ...analysis, trend };
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
    const yearly = /^\d{4}$/.test(month), range = spendingRange(month), rangeKind = month.includes('-Q') ? 'quarter' : month.includes('-H') ? 'half' : 'month', total = amount(rows), previousMonth = range.months === 0 ? new Date(new Date(month + 'T00:00:00Z').getTime() - 86400000).toISOString().slice(0, 10) : yearly ? String(Number(month) - 1) : spendingRangeKey(integratedSpendingMonthShift(range.start.slice(0, 7), -range.months), rangeKind), previousTotal = amount(integratedSpendingRows(previousMonth)), change = total - previousTotal, changeRate = previousTotal ? change / previousTotal * 100 : null, trend = [], items = new Map();
    for (const row of rows) {
        const key = String(row.meta?.spendingItem || row.category || '기타'), identity = JSON.stringify([row.category, key]), item = items.get(identity) || { key, amount: 0, count: 0, category: row.category || '기타' };
        item.amount += Number(row.amount) || 0;
        item.count++;
        items.set(identity, item);
    }
    if (range.months === 0)
        return { month, rows, total, fixed: amount(fixedRows), variable: amount(variableRows), fixedRows, variableRows, categories: [...categories.values()], items: [...items.values()], previousMonth, previousTotal, change, changeRate, trend };
    for (let offset = -5; offset <= 0; offset++) {
        const key = yearly ? String(Number(month) + offset) : spendingRangeKey(integratedSpendingMonthShift(range.start.slice(0, 7), offset * range.months), rangeKind), value = amount(integratedSpendingRows(key));
        trend.push({ month: key, label: yearly ? `${key}년` : range.months > 1 ? spendingRangeLabel(key) : `${key.slice(2, 4)}.${key.slice(5)}`, amount: value });
    }
    return { month, rows, total, fixed: amount(fixedRows), variable: amount(variableRows), fixedRows, variableRows, categories: [...categories.values()].sort((left, right) => right.amount - left.amount || left.key.localeCompare(right.key, 'ko')), items: [...items.values()].sort((left, right) => right.amount - left.amount || left.key.localeCompare(right.key, 'ko')), previousMonth, previousTotal, change, changeRate, trend };
}
