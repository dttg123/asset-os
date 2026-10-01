'use strict';
function validationIntegratedStore() {
    return integratedStore();
}
function validationPostedDateError(date) {
    return postedDateError(date);
}
function validationIsaAccounts(date) {
    return isaAccountsForDate(date);
}
function validationPensionAccounts(kind, date) {
    return pensionAccountsForKind(kind, date);
}
function validationIsQaFixture(transaction) {
    return isQaIntegratedFixture(transaction);
}
function validationReplay(rows, store) {
    return integratedReplay(rows, store);
}
function validationFinancialProducts() {
    return financialProducts();
}
function validationProductAccountId(id) {
    return financeProductAccountId(id);
}
function validationProductLiabilityId(id) {
    return financeProductLiabilityId(id);
}
function validationWon(value) {
    return won(value);
}
function integratedIssues(store = validationIntegratedStore()) {
    const issues = [], accountIds = new Set(), liabilityIds = new Set(), transactionIds = new Set();
    for (const account of store.accounts || []) {
        if (!account.id || accountIds.has(account.id))
            issues.push(`자산 계좌 ID 중복/누락: ${account.id || '-'}`);
        accountIds.add(account.id);
    }
    for (const liability of store.liabilities || []) {
        if (!liability.id || liabilityIds.has(liability.id))
            issues.push(`부채 ID 중복/누락: ${liability.id || '-'}`);
        liabilityIds.add(liability.id);
    }
    const allowed = new Set(['refund', 'openingAsset', 'openingLiability', 'externalIncome', 'expense', 'externalExpense', 'debtInterest', 'debtInterestExternal', 'debtPrincipal', 'externalDebtPrincipal', 'externalAssetIn', 'externalAssetOut', 'internalTransfer', 'externalWithdrawal', 'adjustment']);
    for (const transaction of store.ledger || []) {
        if (!transaction.id || transactionIds.has(transaction.id))
            issues.push(`원장 ID 중복/누락: ${transaction.id || '-'}`);
        transactionIds.add(transaction.id);
        const dateError = validationPostedDateError(transaction.date);
        if (dateError)
            issues.push(`${dateError}: ${transaction.id}`);
        if (!allowed.has(transaction.type || ''))
            issues.push(`거래유형 오류: ${transaction.id}`);
        if (transaction.type === 'adjustment') {
            if (!Number.isFinite(Number(transaction.delta)) || Number(transaction.delta) === 0)
                issues.push(`보정금액 오류: ${transaction.id}`);
        }
        else if (!Number.isFinite(Number(transaction.amount)) || Number(transaction.amount) <= 0)
            issues.push(`금액 오류: ${transaction.id}`);
        if (transaction.fromAccountId && !accountIds.has(transaction.fromAccountId))
            issues.push(`출금계좌 없음: ${transaction.id}`);
        if (transaction.toAccountId && !accountIds.has(transaction.toAccountId))
            issues.push(`입금계좌 없음: ${transaction.id}`);
        if (transaction.accountId && !accountIds.has(transaction.accountId))
            issues.push(`보정계좌 없음: ${transaction.id}`);
        if (transaction.liabilityId && !liabilityIds.has(transaction.liabilityId))
            issues.push(`부채 없음: ${transaction.id}`);
        if (transaction.type === 'internalTransfer' && transaction.fromAccountId === transaction.toAccountId)
            issues.push(`동일계좌 이체: ${transaction.id}`);
        const targetKind = (store.accounts || []).find(account => account.id === transaction.toAccountId)?.kind || '';
        if (!transaction.meta?.analysisOnly && ['internalTransfer', 'externalAssetIn'].includes(transaction.type || '') && targetKind === 'isa') {
            const eligible = validationIsaAccounts(transaction.date), explicit = String(transaction.meta?.targetIsaAccountId || '');
            if (eligible.length > 1 && !explicit)
                issues.push(`ISA 납입 대상 미지정: ${transaction.id}`);
            else if (explicit && !eligible.some(account => account.id === explicit))
                issues.push(`ISA 납입 대상 날짜 불일치: ${transaction.id}`);
        }
        if (!transaction.meta?.analysisOnly && ['internalTransfer', 'externalAssetIn'].includes(transaction.type || '') && ['pension', 'irp'].includes(targetKind)) {
            const explicit = String(transaction.meta?.targetPensionAccountId || ''), dated = validationPensionAccounts(targetKind, transaction.date);
            if (dated.length > 1 && !explicit)
                issues.push(`연금 납입 대상 미지정: ${transaction.id}`);
            else if (explicit && !dated.some(account => account.id === explicit))
                issues.push(`연금 납입 대상 날짜 불일치: ${transaction.id}`);
        }
    }
    const refunds = new Map();
    for (const transaction of store.ledger || [])
        if (transaction.type === 'refund') {
            const original = (store.ledger || []).find(candidate => candidate.id === transaction.meta?.refundOf);
            if (!original || !['expense', 'externalExpense'].includes(original.type || '') || transaction.date < original.date || transaction.toAccountId !== (original.type === 'expense' ? original.fromAccountId : ''))
                issues.push(`환불 원거래 또는 날짜 오류: ${transaction.id}`);
            else {
                const originalId = String(original.id), total = (refunds.get(originalId) || 0) + Number(transaction.amount);
                refunds.set(originalId, total);
                if (total > Number(original.amount))
                    issues.push(`환불 누계가 원거래 금액을 초과합니다: ${original.id}`);
            }
        }
    const operationalRows = (store.ledger || []).filter(transaction => !validationIsQaFixture(transaction)), replay = validationReplay(operationalRows, store);
    for (const [id, value] of Object.entries(replay.minAssets || replay.assets))
        if (value < -.0000001)
            issues.push(`자산 잔액 음수: ${id}`);
    for (const [id, value] of Object.entries(replay.minLiabilities || replay.liabilities))
        if (value < -.0000001)
            issues.push(`부채 잔액 음수: ${id}`);
    for (const product of validationFinancialProducts()) {
        if (product.status === 'active')
            continue;
        const id = product.type === 'loan' ? validationProductLiabilityId(product.id) : validationProductAccountId(product.id), value = Math.max(0, Number(product.type === 'loan' ? replay.liabilities[id] : replay.assets[id]) || 0);
        if (value > .005)
            issues.push(`종료상품 잔액 잔존: ${product.name} ${validationWon(value)}`);
    }
    return issues;
}
