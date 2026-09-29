'use strict';
function currentFinancialState() {
    // @ts-ignore runtime global supplied by store-state.js
    return state;
}
function currentIntegratedStore() {
    // @ts-ignore runtime global supplied by integrated-ledger.js
    return integratedStore();
}
function currentIntegratedReplay() {
    // @ts-ignore runtime global supplied by integrated-ledger.js
    return integratedReplay();
}
function currentActiveProducts() {
    // @ts-ignore runtime global supplied by integrated-finance-engine.js
    return activeFinancialProducts();
}
function currentPensionStore() {
    // @ts-ignore runtime global supplied by pension-ledger.js
    return pensionStore();
}
function currentKisKindTotal(kind, accountIds) {
    // @ts-ignore runtime global supplied by broker-kis.js
    return brokerKisCurrentKindTotal(currentFinancialState().brokerKis, kind, accountIds);
}
function currentIsaAccount(account) {
    // @ts-ignore runtime global supplied by isa-ledger.js
    return isCurrentAccount(account);
}
function currentIsaMetrics(account) {
    // @ts-ignore runtime global supplied by isa-ledger.js
    return accountMetrics(account);
}
function currentPensionMetrics(kind) {
    // @ts-ignore runtime global supplied by pension-assets.js
    return pensionAssetMetrics(kind);
}
function currentFinancialProduct(id) {
    // @ts-ignore runtime global supplied by integrated-finance-engine.js
    return financialProduct(id);
}
function currentIntegratedLedger() {
    // @ts-ignore runtime global supplied by integrated-ledger.js
    return integratedLedger();
}
function currentIntegratedMonthKey(date) {
    // @ts-ignore runtime global supplied by integrated-ledger.js
    return integratedMonthKey(date);
}
function currentIntegratedLatestMonth() {
    // @ts-ignore runtime global supplied by integrated-ledger.js
    return integratedLatestMonth();
}
function moduleVerified(kind) { return !!currentFinancialState().moduleVerification?.[kind]; }
function integratedFinancialModel() {
    const replay = currentIntegratedReplay(), store = currentIntegratedStore(), accounts = store.accounts, activeIds = new Set(currentActiveProducts().map(product => product.id)), verify = { isa: moduleVerified('isa'), pension: moduleVerified('pension'), irp: moduleVerified('irp') };
    let cash = 0, deposit = 0, savings = 0, other = 0;
    for (const account of accounts) {
        const value = Math.max(0, Number(replay.assets[account.id] || 0)), hasResidual = value > .005, productActive = !account.productId || activeIds.has(account.productId);
        if (account.kind === 'cash')
            cash += value;
        else if (account.kind === 'parking' && (productActive || hasResidual))
            cash += value;
        else if (account.kind === 'deposit' && (productActive || hasResidual))
            deposit += value;
        else if (account.kind === 'savings' && (productActive || hasResidual))
            savings += value;
        else if (account.kind === 'other')
            other += value;
    }
    const linkedIsa = Math.max(0, Number(replay.assets['isa-link'] || 0)), linkedPension = Math.max(0, Number(replay.assets['pension-link'] || 0)), linkedIrp = Math.max(0, Number(replay.assets['irp-link'] || 0)), activePensionAccounts = currentPensionStore().accounts.filter(account => account.status === 'active'), kisPension = currentKisKindTotal('pension', activePensionAccounts.filter(account => account.kind === 'pension').map(account => account.id)), kisIrp = currentKisKindTotal('irp', activePensionAccounts.filter(account => account.kind === 'irp').map(account => account.id)), isaAccountMetrics = (currentFinancialState().accounts || []).filter((account) => currentIsaAccount(account)).map((account) => currentIsaMetrics(account)), isaMetrics = { value: isaAccountMetrics.reduce((sum, metrics) => sum + (Number(metrics.value) || 0), 0), cost: isaAccountMetrics.reduce((sum, metrics) => sum + (Number(metrics.cost) || 0), 0) }, isaRecorded = verify.isa || isaMetrics.value > .5 || isaMetrics.cost > .5, isa = isaRecorded ? Math.max(0, isaMetrics.value || 0) : linkedIsa, pensionMetrics = currentPensionMetrics('pension'), irpMetrics = currentPensionMetrics('irp'), localPension = Math.max(0, pensionMetrics.value || 0), localIrp = Math.max(0, irpMetrics.value || 0), useKisPension = !!kisPension && (kisPension.authoritative === true || kisPension.totalValue > .5 || localPension <= .5), useKisIrp = !!kisIrp && (kisIrp.authoritative === true || kisIrp.totalValue > .5 || localIrp <= .5), pension = useKisPension ? kisPension.totalValue : localPension, irp = useKisIrp ? kisIrp.totalValue : localIrp, available = { isa: isaRecorded, pension: useKisPension || verify.pension || localPension > .5, irp: useKisIrp || verify.irp || localIrp > .5 };
    let debt = 0;
    for (const liability of store.liabilities) {
        const value = Math.max(0, Number(replay.liabilities[liability.id] || 0)), product = liability.productId ? currentFinancialProduct(liability.productId) : null;
        if (product && product.status !== 'active' && value <= .005)
            continue;
        debt += value;
    }
    const totalAssets = cash + deposit + savings + isa + pension + irp + other;
    return { cash, deposit, savings, isa, pension, irp, other, totalAssets, totalDebt: debt, netAssets: totalAssets - debt, replay, linked: { isa: linkedIsa, pension: linkedPension, irp: linkedIrp }, verified: verify, available, currentSources: { isa: isaRecorded ? 'asset-os' : 'linked', pension: useKisPension ? 'kis' : pensionMetrics.source || 'asset-os', irp: useKisIrp ? 'kis' : irpMetrics.source || 'asset-os' }, kis: { pension: kisPension, irp: kisIrp }, isComplete: available.isa && available.pension && available.irp };
}
function integratedProductSavingAmount(rows) {
    const accountMap = new Map(currentIntegratedStore().accounts.map(account => [account.id, account]));
    return rows.filter(transaction => transaction.type === 'internalTransfer' && ['deposit', 'savings'].includes(accountMap.get(transaction.toAccountId || '')?.kind || '')).reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0);
}
function integratedSummary(month = currentIntegratedLatestMonth(), currentModel = null, sourceRows = null) {
    const rows = (sourceRows || currentIntegratedLedger()).filter(transaction => currentIntegratedMonthKey(transaction.date) === month), accountMap = new Map(currentIntegratedStore().accounts.map(account => [account.id, account])), sum = (predicate) => rows.filter(predicate).reduce((total, transaction) => total + (Number(transaction.amount) || 0), 0), income = sum(transaction => transaction.type === 'externalIncome'), fixed = sum(transaction => (['expense', 'externalExpense'].includes(transaction.type) && !!transaction.fixed) || ['debtInterest', 'debtInterestExternal'].includes(transaction.type)), variable = sum(transaction => ['expense', 'externalExpense'].includes(transaction.type) && !transaction.fixed), principal = sum(transaction => ['debtPrincipal', 'externalDebtPrincipal'].includes(transaction.type)), externalOut = sum(transaction => transaction.type === 'externalWithdrawal'), linkedInvest = sum(transaction => ['internalTransfer', 'externalAssetIn'].includes(transaction.type) && ['isa', 'pension', 'irp'].includes(accountMap.get(transaction.toAccountId || '')?.kind || '')), productSaving = integratedProductSavingAmount(rows) + sum(transaction => transaction.type === 'externalAssetIn' && ['deposit', 'savings'].includes(accountMap.get(transaction.toAccountId || '')?.kind || '')), invest = linkedInvest + productSaving, otherTransfers = sum(transaction => transaction.type === 'internalTransfer' && !['isa', 'pension', 'irp', 'deposit', 'savings', 'parking', 'cash'].includes(accountMap.get(transaction.toAccountId || '')?.kind || '')), trackedInvest = sum(transaction => transaction.type === 'internalTransfer' && transaction.fromAccountId === 'cash-main' && ['isa', 'pension', 'irp', 'deposit', 'savings'].includes(accountMap.get(transaction.toAccountId || '')?.kind || '')), operatingCashDelta = income + sum(transaction => transaction.type === 'refund' && transaction.toAccountId === 'cash-main') - sum(transaction => (transaction.type === 'expense' || transaction.type === 'debtInterest') && transaction.fromAccountId === 'cash-main') - sum(transaction => transaction.type === 'debtPrincipal' && transaction.fromAccountId === 'cash-main') - trackedInvest - sum(transaction => transaction.type === 'externalWithdrawal' && transaction.fromAccountId === 'cash-main'), model = currentModel || integratedFinancialModel();
    return { month, rows, income, fixed: fixed - sum(transaction => transaction.type === 'refund' && !!transaction.fixed), variable: variable - sum(transaction => transaction.type === 'refund' && !transaction.fixed), principal, invest, linkedInvest, productSaving, externalOut, otherTransfers, trackedInvest, operatingCashDelta, ...model, replay: model.replay };
}
