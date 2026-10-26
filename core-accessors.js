'use strict';
function setting() { return state.settings; }
// Tab-local view preferences never enter the financial save queue or cloud sync.
const VIEW_PREFERENCE_KEYS = ['selectedAccountId', 'integratedMonth', 'integratedMonthViewedOn', 'integratedLedgerFilter', 'txFilter', 'compositionGroup', 'compositionFocus', 'pensionAssetScope', 'pensionAssetFocus', 'pensionGoalExpanded', 'dividendPeriod', 'dividendKey', 'spendingPeriod', 'spendingView', 'spendingCategoryFilter', 'spendingChartContext', 'spendingChartPeriod', 'integratedLedgerCategory', 'policyTab'];
function viewPreferenceValue(key, value) {
    if (key === 'pensionGoalExpanded')
        return typeof value === 'boolean';
    if (typeof value !== 'string' || value.length > 256)
        return false;
    const choices = { pensionAssetScope: ['all', 'pension', 'irp'], spendingPeriod: ['month', 'quarter', 'half', 'year', 'years'], spendingView: ['categories', 'items'], policyTab: ['isa', 'pension', 'irp', 'finance'], dividendPeriod: ['month', 'year', 'recent'], integratedLedgerFilter: ['all', 'income', 'expense', 'saving', 'debt'] };
    if (choices[key])
        return choices[key].includes(value);
    if (key === 'integratedMonth')
        return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
    if (key === 'integratedMonthViewedOn')
        return /^\d{4}-\d{2}-\d{2}$/.test(value);
    return key !== 'selectedAccountId' || state.accounts.some(account => account.id === value);
}
function rememberViewPreferences() {
    try {
        const values = {}, base = {}, saved = typeof lastPersistedState !== 'undefined' && lastPersistedState ? lastPersistedState.settings : state.settings;
        for (const key of VIEW_PREFERENCE_KEYS)
            if (viewPreferenceValue(key, setting()[key])) {
                values[key] = setting()[key];
                base[key] = saved[key];
            }
        sessionStorage.setItem(`${KEY}-view-preferences`, JSON.stringify({ values, base }));
    }
    catch { /* Storage restrictions must not block a view action. */ }
}
function restoreViewPreferences() {
    try {
        const record = JSON.parse(sessionStorage.getItem(`${KEY}-view-preferences`) || 'null');
        if (!record?.values || !record.base)
            return;
        for (const key of VIEW_PREFERENCE_KEYS) {
            const value = record.values[key];
            if (viewPreferenceValue(key, value) && JSON.stringify(setting()[key]) === JSON.stringify(record.base[key]))
                setting()[key] = value;
        }
    }
    catch { /* Ignore malformed view metadata; the financial state stays authoritative. */ }
}
function resetIntegratedViewOnLaunch() {
    const today = localYmd();
    setting().integratedMonth = today.slice(0, 7);
    setting().integratedMonthViewedOn = today;
    setting().spendingChartContext = '';
    setting().spendingChartPeriod = '';
}
function currentAccount() { return state.accounts.find(a => a.id === setting().selectedAccountId) || state.accounts[0]; }
function policy(kind = 'isa', account = 'current') { const group = state.policies[kind]; if (!group)
    return {}; if (Array.isArray(group.versions)) {
    let targetId = group.activePolicyId;
    if (kind === 'isa') {
        if (account === null)
            targetId = group.activePolicyId;
        else if (account === 'current')
            targetId = currentAccount()?.policyId || group.activePolicyId;
        else
            targetId = account?.policyId || group.activePolicyId;
    }
    else if (account && typeof account === 'object')
        targetId = account.policyId || group.activePolicyId;
    return group.versions.find(v => v.id === targetId) || group.versions.find(v => v.id === group.activePolicyId) || group.versions[0] || {};
} return group; }
function policyForYear(kind, year) {
    const group = state.policies[kind];
    if (!group?.versions?.length)
        return policy(kind);
    const y = Number(year) || businessYear(), end = `${y}-12-31`, allowed = (v) => !['proposal', 'retired'].includes(String(v.status || '')) && (!v.effectiveFrom || String(v.effectiveFrom) <= end);
    const history = kind === 'isa' ? [] : (group.applicationHistory || []), applied = [...history].filter(h => h.effectiveFrom <= end).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)).at(-1), historic = applied && group.versions.find(v => v.id === applied.policyId && allowed(v));
    if (historic)
        return historic;
    const isaApplied = new Set(kind === 'isa' ? state.accounts.flatMap(a => (a.policyHistory || []).filter(h => h.effectiveFrom <= end).map(h => h.policyId)) : []);
    const eligible = group.versions.filter(v => allowed(v) && (!v.userEdited || (!history.length && v.id === group.activePolicyId) || isaApplied.has(v.id || ''))).sort((a, b) => String(a.effectiveFrom || '').localeCompare(String(b.effectiveFrom || '')));
    return eligible.at(-1) || group.versions.find(v => !v.userEdited && !['proposal', 'retired'].includes(String(v.status || ''))) || {};
}
function policyGroup(kind) { return (state.policies[kind] || { activePolicyId: '', versions: [] }); }
function policyStatus(p) { return p?.userEdited ? '사용자 설정' : p?.status === 'current' ? '현행' : '보관'; }
