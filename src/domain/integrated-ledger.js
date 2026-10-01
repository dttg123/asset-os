'use strict';
function ledgerState() {
    return state;
}
function ledgerSeed() {
    return seed;
}
function ledgerCompare(left, right) {
    return compareIntegratedTransactions(left, right);
}
function ledgerCalculateReplay(store, rows) {
    return calculateIntegratedReplay(store, rows);
}
function ledgerLocalYmd() {
    return localYmd();
}
function ledgerCentralIsaRows() {
    return centralIsaContributionRows();
}
function integratedStore() { return ledgerState().integrated || ledgerSeed().integrated; }
function integratedManualLedger() { return [...(integratedStore().ledger || [])]; }
function integratedLinkedLedger() { return []; }
function integratedTxOrder(left, right) { return ledgerCompare(left, right); }
function nextIntegratedSequence(date) { let max = 0; for (const transaction of integratedStore().ledger || [])
    if (String(transaction.date || '') === String(date) && Number.isFinite(Number(transaction.sequence)))
        max = Math.max(max, Number(transaction.sequence)); return max + 1; }
function isQaIntegratedFixture(transaction) { return !!transaction?.meta?.qaFixture; }
function integratedOperationalLedger() { return [...integratedManualLedger().filter(transaction => !isQaIntegratedFixture(transaction)), ...integratedLinkedLedger().filter(transaction => !isQaIntegratedFixture(transaction))].sort(integratedTxOrder); }
function integratedAnalysisBalanceLedger() { const start = String(integratedStore().startedAt || ''), manual = integratedManualLedger().filter(transaction => !isQaIntegratedFixture(transaction)), linked = (start ? integratedLinkedLedger().filter(transaction => String(transaction.date) >= start) : []).filter(transaction => !isQaIntegratedFixture(transaction)); return [...manual, ...linked].sort(integratedTxOrder); }
function isaCurrentMonthContribution(month = ledgerLocalYmd().slice(0, 7)) { return ledgerCentralIsaRows().filter(transaction => integratedMonthKey(transaction.date) === month).reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0); }
function integratedLedger() { return integratedOperationalLedger(); }
function integratedBalanceLedger() { const start = String(integratedStore().startedAt || ''), manual = integratedManualLedger().filter(transaction => !isQaIntegratedFixture(transaction)), linked = (start ? integratedLinkedLedger().filter(transaction => String(transaction.date) >= start) : []).filter(transaction => !isQaIntegratedFixture(transaction)); return [...manual, ...linked].sort(integratedTxOrder); }
function integratedMonthKey(value) { return String(value || '').slice(0, 7); }
function integratedLatestMonth() { const rows = integratedLedger().filter(transaction => !['openingAsset', 'openingLiability'].includes(transaction.type || '')); return rows.length ? integratedMonthKey(rows[rows.length - 1].date) : ledgerLocalYmd().slice(0, 7); }
function integratedReplay(rows = null, store = integratedStore()) {
    const source = store || integratedStore(), useRows = rows === null ? integratedBalanceLedger() : rows;
    return ledgerCalculateReplay(source, useRows);
}
