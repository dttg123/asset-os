'use strict';
function normalizeFinanceSchedules(input) { const src = input && typeof input === 'object' ? input : { items: [] }, items = Array.isArray(src.items) ? src.items : []; return { items: items.map((x, i) => ({ ...x, id: String(x.id || `schedule-${i + 1}`), name: String(x.name || `일정 ${i + 1}`), kind: ['income', 'investment', 'saving', 'loan', 'insurance', 'expense'].includes(x.kind || '') ? x.kind : 'expense', amount: Math.max(0, Number(x.amount) || 0), amountMode: x.amountMode === 'estimate' ? 'estimate' : 'fixed', day: (x.day === 0 || x.day === '0') ? 0 : Math.min(31, Math.max(1, Number(x.day) || DEFAULT_FINANCE_DAY)), recurrence: x.recurrence === 'monthly' ? 'monthly' : 'monthly', startDate: String(x.startDate || ''), endDate: String(x.endDate || ''), targetKind: String(x.targetKind || ''), targetAccountId: String(x.targetAccountId || ''), targetPensionAccountId: String(x.targetPensionAccountId || ''), targetIsaAccountId: String(x.targetIsaAccountId || ''), productId: String(x.productId || ''), liabilityId: String(x.liabilityId || ''), active: x.active !== false, note: String(x.note || ''), source: String(x.source || 'user'), needsDate: !!x.needsDate, attention: String(x.attention || '') })) }; }
function financeSchedules() { return state.financeSchedules?.items || []; }
function clampEndedProductSchedules(target = state) { const products = target.financialProducts?.items || [], schedules = target.financeSchedules?.items || []; for (const p of products) {
    if (p.status === 'active')
        continue;
    const end = String(p.endedAt || p.settlement?.date || p.maturityDate || '');
    if (!end)
        continue;
    for (const s of schedules) {
        if (String(s.productId || '') !== String(p.id))
            continue;
        if (!s.endDate || String(s.endDate) > end)
            s.endDate = end;
    }
} return target; }
function closeFinanceProductSchedules(productId, date) { const end = String(date || localYmd()); for (const s of financeSchedules()) {
    if (String(s.productId || '') !== String(productId))
        continue;
    if (!s.endDate || String(s.endDate) > end)
        s.endDate = end;
} }
function scheduleMonthDays(month) { const [y, m] = String(month).split('-').map(Number), days = new Date(y, m, 0).getDate(); return { y, m, days }; }
function scheduleDateForMonth(s, month) { if (!s.active || !s.day)
    return ''; const { y, m, days } = scheduleMonthDays(month), day = Math.min(Number(s.day), days), date = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`; if (s.startDate && date < s.startDate)
    return ''; if (s.endDate && date > s.endDate)
    return ''; if (s.cardPlan && !cardInstallmentTerms(s, date))
    return ''; return date; }
function scheduleFallbackMatches(s, date, t) {
    if (!s || s.cardPlan || t.meta?.scheduleId || t.meta?.cardPlanId || t.meta?.analysisOnly || String(t.date) !== String(date) || (Number(t.amount) || 0) !== schedulePlannedAmount(s, String(date)))
        return false;
    const account = integratedStore().accounts.find((a) => a.id === t.toAccountId), sameName = normalizeName(t.category) === normalizeName(s.name);
    if (s.kind === 'income')
        return t.type === 'externalIncome' && sameName;
    if (['investment', 'saving'].includes(s.kind || '')) {
        if (!['internalTransfer', 'externalAssetIn'].includes(t.type || ''))
            return false;
        if (s.productId)
            return account?.productId === s.productId;
        const target = scheduleTargetAccount(s);
        if (target && t.toAccountId !== target)
            return false;
        const targetKind = s.targetKind || integratedStore().accounts.find((a) => a.id === target)?.kind || '';
        return account?.kind === targetKind && (sameName || ['isa', 'pension', 'irp'].includes(targetKind));
    }
    if (s.kind === 'loan') {
        if (!['debtInterest', 'debtInterestExternal', 'debtPrincipal', 'externalDebtPrincipal'].includes(t.type || ''))
            return false;
        if (s.liabilityId)
            return t.liabilityId === s.liabilityId;
        if (s.productId)
            return t.productId === s.productId;
        return sameName;
    }
    if (['insurance', 'expense'].includes(s.kind || ''))
        return ['expense', 'externalExpense'].includes(t.type || '') && sameName;
    return false;
}
function scheduleCompletionTx(scheduleId, date, sourceRows = null) {
    const rows = sourceRows || integratedOperationalLedger(), schedule = financeSchedules().find(s => s.id === scheduleId);
    const linked = rows.filter(t => t.meta?.scheduleId === scheduleId && t.meta?.scheduleDate === date), explicit = linked[0];
    if (explicit) {
        if (schedule?.kind === 'loan') {
            const principal = Number(explicit.meta?.loanPrincipal || 0), interest = Number(explicit.meta?.loanInterest || 0);
            const paidPrincipal = linked.filter(t => ['debtPrincipal', 'externalDebtPrincipal'].includes(t.type || '') && t.liabilityId === schedule.liabilityId).reduce((sum, t) => sum + Number(t.amount || 0), 0);
            const paidInterest = linked.filter(t => ['debtInterest', 'debtInterestExternal'].includes(t.type || '') && t.liabilityId === schedule.liabilityId).reduce((sum, t) => sum + Number(t.amount || 0), 0);
            if (principal > 0 && paidPrincipal !== principal || interest > 0 && paidInterest !== interest)
                return null;
        }
        return explicit;
    }
    return rows.find(t => scheduleFallbackMatches(schedule, date, t) && financeSchedules().filter(s => scheduleDateForMonth({ ...s, active: true }, date.slice(0, 7)) === date && scheduleFallbackMatches(s, date, t)).length === 1) || null;
}
function scheduleOccurrenceStatus(s, date, knownTx) { const tx = arguments.length >= 3 ? knownTx : scheduleCompletionTx(s.id, date); if (tx)
    return 'done'; const today = localYmd(); if (date < today)
    return 'overdue'; if (date === today)
    return 'today'; const diff = Math.round((new Date(date + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000); return diff <= 3 ? 'soon' : 'planned'; }
function scheduleStatusLabel(st) { return { done: '완료', overdue: '미완료', today: '오늘', soon: '임박', planned: '예정' }[st] || '예정'; }
function scheduleOccurrences(month = integratedSelectedMonth()) { const rows = integratedOperationalLedger(); return financeSchedules().map(s => { const date = scheduleDateForMonth(s.active ? s : { ...s, active: true }, month); if (!date)
    return null; const tx = scheduleCompletionTx(s.id, date, rows); if (!s.active && !tx)
    return null; return { schedule: s, date, status: scheduleOccurrenceStatus(s, date, tx), tx }; }).filter((o) => !!o && (o.schedule.kind !== 'income' || o.status === 'done')).sort((a, b) => a.date.localeCompare(b.date) || String(a.schedule.name).localeCompare(String(b.schedule.name), 'ko')); }
function scheduleUrgentOccurrences() { const today = localYmd(), months = new Set([today.slice(0, 7)]); const d = new Date(today + 'T00:00:00'); d.setDate(d.getDate() + 4); months.add(localYmd(d).slice(0, 7)); const dated = [...months].flatMap(m => scheduleOccurrences(m)).filter(x => x.schedule.kind !== 'income' && ['overdue', 'today', 'soon'].includes(x.status)), undated = financeSchedules().filter(x => x.active && x.needsDate && x.attention === 'overdue').map(s => ({ schedule: s, date: '날짜 미설정', status: 'overdue', tx: null, undated: true })); return [...undated, ...dated].sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.schedule.name).localeCompare(String(b.schedule.name), 'ko')); }
function scheduleTargetAccount(s) { if (s.targetAccountId)
    return s.targetAccountId; if (s.targetKind === 'pension')
    return 'pension-link'; if (s.targetKind === 'irp')
    return 'irp-link'; if (s.targetKind === 'isa')
    return 'isa-link'; if (s.productId)
    return financeProductAccountId(s.productId); return ''; }
function pensionAccountActiveOnDate(a, date) { if (!a)
    return false; const d = String(date || localYmd()), start = String(a.openedAt || ''), end = String(a.closedAt || ''); if (start && d < start)
    return false; if (end && d > end)
    return false; return true; }
function pensionAccountsForKind(kind, date = '') { return pensionStore().accounts.filter(a => a.kind === kind && (!date ? pensionAccount(a.id)?.status === 'active' : pensionAccountActiveOnDate(a, date))); }
function schedulePensionKind(sc) { const linkedKind = integratedStore().accounts.find((a) => a.id === sc?.targetAccountId)?.kind; return ['pension', 'irp'].includes(sc?.targetKind || '') ? sc.targetKind : (['pension', 'irp'].includes(linkedKind || '') ? linkedKind : ''); }
function resolveSchedulePensionAccount(sc, explicit = '', date = '') { const kind = schedulePensionKind(sc); if (!kind)
    return ''; const candidates = pensionAccountsForKind(kind, date || ''); const requested = String(explicit || sc?.targetPensionAccountId || ''); if (requested && candidates.some(a => a.id === requested))
    return requested; return candidates.length === 1 ? candidates[0].id : ''; }
function isaAccountsForDate(date = '') { const d = String(date || localYmd()), today = localYmd(); return state.accounts.filter(a => { const open = String(a.openedAt || a.baselineDate || ''), ends = [String(a.closedAt || ''), String(a.maturityAt || '')].filter(Boolean).sort(), end = ends[0] || ''; if (open && d < open)
    return false; if (end && d > end)
    return false; if (d >= today && a.status !== 'active')
    return false; return true; }); }
function resolveScheduleIsaAccount(sc, explicit = '', date = '') { const candidates = isaAccountsForDate(date || ''), requested = String(explicit || sc?.targetIsaAccountId || ''); if (requested && candidates.some(a => a.id === requested))
    return requested; return candidates.length === 1 ? candidates[0].id : ''; }
async function completeScheduleOccurrence(scheduleId, date, amountOverride = 0, targetPensionAccountId = '', targetIsaAccountId = '', loanPrincipalOverride = 0, loanInterestOverride = 0) {
    const request = validateScheduleCompletionRequest(scheduleId, date);
    if (!request.ok) {
        toast(request.error);
        return false;
    }
    const draft = request.schedule.kind === 'loan' ? calculateLoanScheduleCompletion(request.schedule, date, loanPrincipalOverride, loanInterestOverride) : calculateStandardScheduleCompletion(request.schedule, date, amountOverride, targetPensionAccountId, targetIsaAccountId);
    if (!draft.ok) {
        toast(draft.error);
        return false;
    }
    const validationError = validateScheduleCompletionDraft(draft);
    if (validationError) {
        toast(validationError);
        return false;
    }
    if (!(await commitScheduleCompletion(request.schedule, date, draft)))
        return false;
    renderScheduleCompletion(date, draft.successMessage);
    return true;
}
function centralPensionContributionRows(year = '') { const rows = []; for (const t of integratedOperationalLedger()) {
    if (t.meta?.analysisOnly)
        continue;
    if (!['internalTransfer', 'externalAssetIn'].includes(t.type || ''))
        continue;
    const accounts = integratedStore().accounts || [], pensionAccounts = pensionStore().accounts || [], kind = accounts.find(a => a.id === t.toAccountId)?.kind;
    if (!['pension', 'irp'].includes(kind || ''))
        continue;
    if (year && !String(t.date).startsWith(String(year)))
        continue;
    const explicit = String(t.meta?.pensionAccountId || t.meta?.targetPensionAccountId || ''), dated = pensionAccounts.filter(a => a.kind === kind && pensionAccountActiveOnDate(a, t.date)), resolved = explicit && pensionAccounts.some(a => a.id === explicit && a.kind === kind) ? explicit : (dated.length === 1 ? dated[0].id : '');
    rows.push({ id: `central-${t.id}`, accountId: resolved, kind, type: t.meta?.isaTransfer ? 'isaTransfer' : 'contribution', date: String(t.date), amount: Number(t.amount) || 0, sourceTxId: t.id, source: 'integrated', unresolved: !resolved });
} return rows; }
function centralIsaContributionRows(year = '') { const rows = []; for (const t of integratedOperationalLedger()) {
    if (t.meta?.analysisOnly)
        continue;
    if (!['internalTransfer', 'externalAssetIn'].includes(t.type || ''))
        continue;
    const accounts = integratedStore().accounts || [];
    if (accounts.find(a => a.id === t.toAccountId)?.kind !== 'isa')
        continue;
    if (year && !String(t.date).startsWith(String(year)))
        continue;
    const dated = isaAccountsForDate(t.date || ''), explicit = String(t.meta?.targetIsaAccountId || ''), resolved = explicit && dated.some(a => a.id === explicit) ? explicit : (dated.length === 1 ? dated[0].id : '');
    rows.push({ ...t, accountId: resolved, unresolved: !resolved });
} return rows; }
function centralIsaReplayRows(account, includeArchived = false) { if (!account || (!includeArchived && !isCurrentAccount(account)))
    return []; const localCounts = new Map(); for (const t of account.transactions || []) {
    if (t.status === 'cancelled' || !['deposit', 'internalTransferIn'].includes(t.type || ''))
        continue;
    const key = `${txDate(t)}|${Number(t.amount) || 0}`;
    localCounts.set(key, (localCounts.get(key) || 0) + 1);
} const out = []; for (const t of centralIsaContributionRows().filter(t => t.accountId === account.id && !t.unresolved)) {
    const key = `${String(t.date)}|${Number(t.amount) || 0}`, remaining = localCounts.get(key) || 0;
    if (remaining) {
        localCounts.set(key, remaining - 1);
        continue;
    }
    out.push({ id: `virtual-${t.id}`, type: 'internalTransferIn', date: String(t.date), amount: Number(t.amount) || 0, note: t.note || '통합 납입', status: 'posted', sourceTxId: t.id, meta: { centralContribution: true, targetIsaAccountId: account.id } });
} return out; }
function cardInstallmentTerms(s, date) {
    const plan = s.cardPlan;
    if (!plan)
        return null;
    if (!validYmdDate(String(plan.firstPaymentDate)) || !Number.isInteger(plan.months) || plan.months < 1 || plan.months > 60 || !Number.isFinite(plan.purchaseAmount) || plan.purchaseAmount <= 0 || !Number.isFinite(plan.annualRate) || plan.annualRate < 0)
        return null;
    const first = String(plan.firstPaymentDate), index = (Number(date.slice(0, 4)) - Number(first.slice(0, 4))) * 12 + Number(date.slice(5, 7)) - Number(first.slice(5, 7));
    if (index < 0 || index >= plan.months)
        return null;
    const base = Math.floor(plan.purchaseAmount / plan.months), principal = index === plan.months - 1 ? plan.purchaseAmount - base * (plan.months - 1) : base;
    const freeMonths = plan.interestFreeMonths ?? 0;
    if (!Number.isInteger(freeMonths) || freeMonths < 0 || freeMonths >= plan.months)
        return null;
    const balance = plan.purchaseAmount - base * index, interest = plan.interestMode === 'free' || index < freeMonths ? 0 : Math.round(balance * plan.annualRate / 1200);
    return { index: index + 1, principal, interest, total: principal + interest };
}
function schedulePlannedAmount(s, date) {
    const overrides = s.amountOverrides;
    if (overrides && Object.hasOwn(overrides, date))
        return Number(overrides[date]) || 0;
    const history = Array.isArray(s.amountHistory) ? s.amountHistory : [];
    const latest = [...history].filter(x => x && validYmdDate(x.effectiveFrom) && Number.isFinite(x.amount) && x.amount > 0 && x.effectiveFrom <= date).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)).at(-1);
    return latest ? latest.amount : cardInstallmentTerms(s, date)?.total || Number(s.amount) || 0;
}
async function updateSchedulePlannedAmount(id, date, amount, scope) {
    const s = financeSchedules().find(x => x.id === id);
    if (!s || !validYmdDate(date) || !['once', 'future'].includes(scope) || !financialNumberInRange(amount) || !Number.isInteger(amount) || amount <= 0) {
        toast('일정과 금액을 확인해 주세요.');
        return false;
    }
    const before = clone(s);
    if (scope === 'once')
        s.amountOverrides = { ...(s.amountOverrides || {}), [date]: amount };
    else {
        if (s.amountOverrides)
            delete s.amountOverrides[date];
        s.amountHistory = [...(Array.isArray(s.amountHistory) ? s.amountHistory : []).filter(x => x.effectiveFrom !== date), { effectiveFrom: date, amount }];
    }
    if (!(await persist(false))) {
        Object.assign(s, before);
        for (const key of ['amountOverrides', 'amountHistory'])
            if (!(key in before))
                delete s[key];
        return false;
    }
    return true;
}
function cardPlanSummary(s, month) {
    const plan = s.cardPlan, rows = integratedStore().ledger;
    const paid = rows.filter(t => t.liabilityId === s.liabilityId && ['debtPrincipal', 'externalDebtPrincipal'].includes(t.type || '')).reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const date = scheduleDateForMonth({ ...s, active: true }, month), actual = scheduleCompletionTx(s.id, date), terms = cardInstallmentTerms(s, date);
    let paidInstallments = 0;
    const totalInstallments = Number.isInteger(plan.months) && plan.months >= 1 && plan.months <= 60 ? plan.months : 0, first = String(plan.firstPaymentDate || '');
    for (let index = 0; validYmdDate(first) && index < totalInstallments; index++) {
        const cursor = new Date(Date.UTC(Number(first.slice(0, 4)), Number(first.slice(5, 7)) - 1 + index, 1)), key = cursor.toISOString().slice(0, 7), due = scheduleDateForMonth({ ...s, active: true }, key);
        if (due && scheduleCompletionTx(s.id, due, rows))
            paidInstallments++;
    }
    const remainingPrincipal = Math.max(0, plan.purchaseAmount - paid);
    return { purchaseAmount: plan.purchaseAmount, remainingPrincipal, plannedAmount: date ? schedulePlannedAmount(s, date) : 0, estimatedInterest: terms?.interest || 0, actualAmount: actual ? Number(actual.meta?.actualAmount ?? actual.amount) || 0 : null, paidInstallments, totalInstallments, completed: totalInstallments > 0 && paidInstallments === totalInstallments && remainingPrincipal === 0 };
}
async function createCardInstallment(input) {
    const amount = Number(input.purchaseAmount), months = Number(input.months), rate = Number(input.annualRate ?? 0), purchaseDate = String(input.purchaseDate || ''), first = String(input.firstPaymentDate || ''), name = String(input.name || '').trim(), mode = String(input.interestMode), freeMonths = mode === 'partial' ? Number(input.interestFreeMonths) : 0;
    if (!name || name.length > 80 || !validYmdDate(purchaseDate) || !validYmdDate(first) || first < purchaseDate || !Number.isInteger(amount) || amount <= 0 || !financialNumberInRange(amount) || !Number.isInteger(months) || months < 1 || months > 60 || amount < months || !['free', 'paid', 'partial'].includes(mode) || !Number.isInteger(freeMonths) || freeMonths < 0 || freeMonths >= months || (mode === 'partial' && freeMonths < 1) || !Number.isFinite(rate) || rate < 0 || rate > 100) {
        toast('구매금액·기간·납부일·이자 설정을 확인해 주세요.');
        return '';
    }
    const store = integratedStore(), before = clone(store), schedulesBefore = clone(state.financeSchedules), id = uid('card-plan'), liabilityId = uid('card-debt');
    const liabilities = store.liabilities, ledger = store.ledger;
    liabilities.push({ id: liabilityId, kind: 'other', name, cardPlanId: id });
    ledger.push({ id: uid('igl'), date: purchaseDate, type: 'openingLiability', amount, liabilityId, category: name, meta: { cardPlanId: id } }, { id: uid('igl'), date: purchaseDate, type: 'externalExpense', amount, category: name, note: '카드 구매 · 원금 납부는 지출에 다시 포함하지 않음', meta: { cardPlanId: id, cardPurchase: true } });
    const plan = { purchaseDate, firstPaymentDate: first, purchaseAmount: amount, months, annualRate: mode === 'free' ? 0 : rate, interestMode: mode, ...(mode === 'partial' ? { interestFreeMonths: freeMonths } : {}) };
    const s = { id, name, kind: 'loan', amount: 0, amountMode: 'estimate', day: Number(first.slice(8, 10)), startDate: first, active: true, liabilityId, source: 'user', cardPlan: plan };
    s.amount = cardInstallmentTerms(s, first)?.total || 0;
    if (!state.financeSchedules)
        state.financeSchedules = { items: [] };
    state.financeSchedules.items.push(s);
    const issues = integratedCandidateIssues(store);
    if (issues.length || !(await persist(false))) {
        state.integrated = before;
        state.financeSchedules = schedulesBefore;
        if (issues.length)
            toast(issues[0]);
        return '';
    }
    return id;
}
async function removeUnpaidCardInstallment(id) {
    const s = financeSchedules().find(x => x.id === id);
    if (!s?.cardPlan)
        return false;
    const store = integratedStore(), rows = store.ledger;
    if (rows.some(t => t.liabilityId === s.liabilityId && t.type !== 'openingLiability')) {
        toast('납부 기록이 있어 구매를 취소할 수 없습니다.');
        return false;
    }
    const before = clone(store), schedules = clone(state.financeSchedules);
    store.ledger = rows.filter(t => t.meta?.cardPlanId !== id);
    store.liabilities = store.liabilities.filter(x => x.id !== s.liabilityId);
    if (state.financeSchedules)
        state.financeSchedules.items = financeSchedules().filter(x => x.id !== id);
    if (!(await persist(false))) {
        state.integrated = before;
        state.financeSchedules = schedules;
        return false;
    }
    return true;
}
