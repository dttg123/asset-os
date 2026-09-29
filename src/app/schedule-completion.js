'use strict';
function validateScheduleCompletionRequest(scheduleId, date) {
    const schedule = financeSchedules().find(item => item.id === scheduleId);
    if (!schedule)
        return { ok: false, error: '일정을 찾지 못했습니다.' };
    const expectedDate = scheduleDateForMonth(schedule, integratedMonthKey(date));
    if (expectedDate !== String(date))
        return { ok: false, error: '해당 일정의 예정일과 일치하지 않습니다.' };
    if (scheduleCompletionTx(scheduleId, date))
        return { ok: false, error: '이미 완료된 일정입니다.' };
    const dateError = postedDateError(date);
    if (dateError)
        return { ok: false, error: dateError };
    return { ok: true, schedule };
}
function scheduleCompletionCashError(amount) {
    const cash = Number(integratedReplay().assets['cash-main'] || 0);
    return cash + 1e-8 < amount ? '생활현금이 부족합니다. 월급 또는 현금 유입을 먼저 완료로 기록해 주세요.' : '';
}
function calculateLoanScheduleCompletion(schedule, date, principalOverride, interestOverride) {
    const principal = Math.max(0, Number(principalOverride) || 0), interest = Math.max(0, Number(interestOverride) || 0), amount = principal + interest;
    if (!amount)
        return { ok: false, error: '실제 원금 또는 이자를 입력해 주세요.' };
    const cashError = scheduleCompletionCashError(amount);
    if (cashError)
        return { ok: false, error: cashError };
    const baseMeta = { scheduleId: schedule.id, scheduleDate: date, scheduledAmount: Number(schedule.amount) || 0, actualAmount: amount, loanPrincipal: principal, loanInterest: interest }, rows = [];
    if (principal)
        rows.push({ id: uid('igl'), date, type: 'debtPrincipal', amount: principal, fromAccountId: 'cash-main', liabilityId: schedule.liabilityId, category: `${schedule.name} 원금`, note: '금융 일정에서 완료 기록', productId: schedule.productId, meta: { ...baseMeta, component: 'principal' } });
    if (interest)
        rows.push({ id: uid('igl'), date, type: 'debtInterest', amount: interest, fromAccountId: 'cash-main', liabilityId: schedule.liabilityId, category: `${schedule.name} 이자`, note: '금융 일정에서 완료 기록', productId: schedule.productId, meta: { ...baseMeta, component: 'interest' } });
    return { ok: true, rows, checkAggregate: true, successMessage: '원금과 이자를 완료로 기록했습니다.' };
}
function calculateStandardScheduleCompletion(schedule, date, amountOverride, targetPensionAccountId, targetIsaAccountId) {
    const amount = Math.max(0, Number(amountOverride) || Number(schedule.amount) || 0);
    if (!amount)
        return { ok: false, error: '금액을 확인해 주세요.' };
    const pensionKind = schedulePensionKind(schedule), isIsa = schedule.targetKind === 'isa' || integratedStore().accounts.find(account => account.id === scheduleTargetAccount(schedule))?.kind === 'isa';
    const resolvedPension = pensionKind ? resolveSchedulePensionAccount(schedule, targetPensionAccountId, date) : '';
    const resolvedIsa = isIsa ? resolveScheduleIsaAccount(schedule, targetIsaAccountId, date) : '';
    const meta = { scheduleId: schedule.id, scheduleDate: date, scheduledAmount: Number(schedule.amount) || 0, actualAmount: amount };
    if (pensionKind) {
        if (!resolvedPension)
            return { ok: false, error: `${pensionAccountKindLabel(pensionKind)} 납입 계좌를 선택해 주세요.` };
        meta.targetPensionAccountId = resolvedPension;
    }
    if (isIsa) {
        if (!resolvedIsa)
            return { ok: false, error: '실제 ISA 납입 계좌를 선택해 주세요.' };
        meta.targetIsaAccountId = resolvedIsa;
    }
    let transaction = null;
    if (schedule.kind === 'income')
        transaction = { id: uid('igl'), date, type: 'externalIncome', amount, toAccountId: 'cash-main', category: schedule.name, note: '금융 일정에서 완료 기록', meta };
    else if (['investment', 'saving'].includes(schedule.kind)) {
        const to = scheduleTargetAccount(schedule);
        if (!to)
            return { ok: false, error: '연결 대상이 없습니다.' };
        const cashError = scheduleCompletionCashError(amount);
        if (cashError)
            return { ok: false, error: cashError };
        transaction = { id: uid('igl'), date, type: 'internalTransfer', amount, fromAccountId: 'cash-main', toAccountId: to, category: schedule.name, note: '금융 일정에서 완료 기록', meta };
    }
    else if (['insurance', 'expense'].includes(schedule.kind)) {
        const cashError = scheduleCompletionCashError(amount);
        if (cashError)
            return { ok: false, error: cashError };
        transaction = { id: uid('igl'), date, type: 'expense', fixed: true, amount, fromAccountId: 'cash-main', category: schedule.name, note: '금융 일정에서 완료 기록', meta };
    }
    if (!transaction)
        return { ok: false, error: '아직 자동 기록을 지원하지 않는 일정입니다.' };
    return { ok: true, rows: [transaction], checkAggregate: false, targetPensionAccountId: resolvedPension, targetIsaAccountId: resolvedIsa, successMessage: '완료로 기록했습니다.' };
}
function validateScheduleCompletionDraft(draft) {
    const candidateStore = draft.checkAggregate ? clone(integratedStore()) : null;
    for (const row of draft.rows) {
        const error = integratedValidateCandidate(row, '');
        if (error)
            return error;
        if (candidateStore)
            candidateStore.ledger.push(row);
    }
    if (!candidateStore)
        return '';
    const issues = integratedCandidateIssues(candidateStore);
    return issues.length ? issues[0].replace('자산 잔액 음수:', '잔액이 부족합니다:').replace('부채 잔액 음수:', '대출잔액보다 많이 상환할 수 없습니다:') : '';
}
function commitScheduleCompletion(schedule, date, draft) {
    if (draft.targetPensionAccountId)
        schedule.targetPensionAccountId = draft.targetPensionAccountId;
    if (draft.targetIsaAccountId)
        schedule.targetIsaAccountId = draft.targetIsaAccountId;
    integratedStore().ledger.push(...draft.rows);
    setting().integratedMonth = integratedMonthKey(date);
    return persist(false);
}
function renderScheduleCompletion(date, message) {
    closeSheets();
    render();
    setTimeout(() => openScheduleDay(date), 60);
    toast(message);
    haptic('light');
}
