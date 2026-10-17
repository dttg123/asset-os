'use strict';
function integratedPolicyLimitIssues(store = integratedStore()) {
    const issues = [];
    if (typeof isaContributionModel === 'function') {
        for (const account of state.accounts.filter(isCurrentAccount)) {
            const model = isaContributionModel(account, localYmd(), store);
            if (model.overage > .5)
                issues.push(`ISA 누적 납입한도를 ${won(model.overage)} 초과합니다.`);
        }
    }
    const accountMap = new Map((store.accounts || []).map(a => [a.id, a]));
    const years = [...new Set((store.ledger || []).map(t => String(t.date || '').slice(0, 4)).filter(x => /^\d{4}$/.test(x)))];
    for (const year of years) {
        let ordinary = 0;
        for (const t of store.ledger || []) {
            if (!String(t.date || '').startsWith(year) || t.meta?.analysisOnly || t.meta?.isaTransfer || !['internalTransfer', 'externalAssetIn'].includes(t.type || ''))
                continue;
            const kind = accountMap.get(t.toAccountId)?.kind;
            if (['pension', 'irp'].includes(kind || ''))
                ordinary += Number(t.amount) || 0;
        }
        const limit = Number(policyForYear('pension', year).annualContributionLimit) || 18000000;
        if (ordinary > limit + .5)
            issues.push(`${year}년 연금계좌 일반 납입한도를 ${won(ordinary - limit)} 초과합니다.`);
    }
    return issues;
}
function integratedCandidateIssues(candidateStore) {
    const original = state.integrated;
    try {
        state.integrated = candidateStore;
        return integratedIssues(candidateStore);
    }
    finally {
        state.integrated = original;
    }
}
function integratedEntryDateForMonth(month = localYmd().slice(0, 7)) {
    const m = String(month || ''), today = localYmd();
    if (!/^\d{4}-\d{2}$/.test(m))
        return today;
    const [year, monthNumber] = m.split('-').map(Number), lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate(), day = Math.min(Number(today.slice(8, 10)) || 1, lastDay);
    return `${m}-${String(day).padStart(2, '0')}`;
}
const integratedEntryTypes = ['externalIncome', 'lifeExpense', 'savingInvestment', 'loanPayment'];
function integratedCleanEntryPreset(value, withAmounts = false) {
    if (!value || typeof value !== 'object')
        return null;
    const raw = value, uiType = String(raw.uiType || '');
    if (!integratedEntryTypes.includes(uiType))
        return null;
    const out = { uiType };
    for (const key of ['category', 'toAccountId', 'liabilityId', 'targetPensionAccountId', 'targetIsaAccountId'])
        if (typeof raw[key] === 'string')
            out[key] = String(raw[key]).slice(0, 80);
    if (withAmounts) {
        for (const key of ['amount', 'principal', 'interest']) {
            const amount = Number(raw[key]);
            if (Number.isFinite(amount) && amount >= 0 && financialNumberInRange(amount))
                out[key] = amount;
        }
        out.note = typeof raw.note === 'string' ? raw.note.slice(0, 500) : '';
    }
    return out;
}
function integratedEntryPresetFromRecord(tx) {
    if (tx.readonly || tx.productId || tx.meta?.scheduleId || tx.meta?.isaLifecycleAccountId || !['externalIncome', 'expense', 'internalTransfer', 'debtPrincipal', 'debtInterest'].includes(tx.type || ''))
        return null;
    return integratedCleanEntryPreset({ uiType: integratedUiType(tx), category: tx.category, toAccountId: tx.toAccountId, liabilityId: tx.liabilityId, amount: tx.amount, principal: tx.type === 'debtPrincipal' ? tx.amount : 0, interest: tx.type === 'debtInterest' ? tx.amount : 0, note: tx.note, targetPensionAccountId: tx.meta?.targetPensionAccountId, targetIsaAccountId: tx.meta?.targetIsaAccountId }, true);
}
function integratedEntryFavorites() {
    const values = setting().integratedEntryFavorites;
    return Array.isArray(values) ? values.map(value => integratedCleanEntryPreset(value, true)).filter((value) => value !== null).slice(0, 8) : [];
}
function integratedRecentEntryPresets() {
    const seen = new Set(), out = [];
    for (const tx of [...integratedStore().ledger].reverse()) {
        const preset = integratedEntryPresetFromRecord(tx);
        if (!preset)
            continue;
        const key = JSON.stringify([preset.uiType, preset.category, preset.toAccountId, preset.liabilityId]);
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push(preset);
        if (out.length === 4)
            break;
    }
    return out;
}
function integratedEntryShortcutsMarkup() {
    const groups = [['자주 쓰는 기록', integratedEntryFavorites(), 'favorite'], ['최근 기록', integratedRecentEntryPresets(), 'recent']];
    const content = groups.filter(([, items]) => items.length).map(([label, items, kind]) => `<div class="entry-shortcuts"><span>${label}</span><div class="entry-shortcut-list">${items.map((item, index) => `<span class="entry-shortcut"><button type="button" data-entry-preset="${escapeHtml(kind + ':' + index)}">${escapeHtml(item.category || integratedDefaultCategory(item.uiType))}</button>${kind === 'favorite' ? `<button type="button" class="entry-shortcut-remove" data-entry-remove="${escapeHtml(index)}" aria-label="${escapeHtml(item.category || '기록')} 즐겨찾기 삭제">×</button>` : ''}</span>`).join('')}</div></div>`).join('');
    return content ? `<details class="entry-library"><summary>최근 기록·즐겨찾기</summary>${content}</details>` : '';
}
function integratedSummaryEntryPresets() {
    const saved = [...integratedEntryFavorites(), ...integratedRecentEntryPresets()], seen = new Set();
    const entries = saved.filter(x => { const key = JSON.stringify([x.uiType, x.category, x.toAccountId, x.liabilityId]); if (seen.has(key))
        return false; seen.add(key); return true; }).slice(0, 4);
    const pension = integratedStore().accounts.find(a => a.kind === 'pension');
    const defaults = [{ uiType: 'externalIncome', category: '급여' }, { uiType: 'lifeExpense', category: '생활비' }, pension ? { uiType: 'savingInvestment', category: '연금 납입', toAccountId: pension.id } : { uiType: 'lifeExpense', category: '교통' }, { uiType: 'lifeExpense', category: '식비' }];
    for (const item of defaults) {
        if (entries.length >= 4)
            break;
        if (!entries.some(x => x.uiType === item.uiType && x.category === item.category))
            entries.push(item);
    }
    return entries;
}
function integratedEntryContext(item) {
    const kind = { externalIncome: '수입', lifeExpense: '지출', savingInvestment: '저축·투자', loanPayment: '대출 납부' }[item.uiType] || '기록';
    const target = item.liabilityId ? integratedStore().liabilities.find(a => a.id === item.liabilityId)?.name : item.toAccountId ? integratedStore().accounts.find(a => a.id === item.toAccountId)?.name : '';
    return [kind, target, item.note].filter(Boolean).join(' · ');
}
function integratedSummaryEntryMarkup() {
    const paths = { externalIncome: 'M4 8h16v12H4z M8 8V4h8v4 M9 14h6 M12 11v6', lifeExpense: 'M4 5h2l2 10h10l2-7H7 M9 19h.01 M17 19h.01', savingInvestment: 'M3 20h18 M5 20V9h4v11 M10 20V4h4v16 M15 20v-8h4v8', loanPayment: 'M4 8h16v12H4z M7 8V5h10v3 M8 14h8' };
    return `<section class="integrated-quick-presets"><h2>자주 쓰는 기록</h2><div class="integrated-preset-list">${integratedSummaryEntryPresets().map((x, i) => `<button data-summary-entry="${escapeHtml(i)}" class="preset-tile preset-tone-${escapeHtml(String(i))}"><span class="preset-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${escapeHtml(paths[x.uiType] || paths.lifeExpense)}"/></svg></span><span class="preset-copy"><strong>${escapeHtml(x.category || integratedDefaultCategory(x.uiType))}</strong><small>${Number(x.amount) > 0 ? won(x.amount) : '금액 입력'}</small><small class="preset-context">${escapeHtml(integratedEntryContext(x))}</small></span><span class="preset-chevron" aria-hidden="true">›</span></button>`).join('')}</div></section>`;
}
function bindIntegratedSummaryEntries() {
    document.querySelectorAll('[data-summary-entry]').forEach(b => b.onclick = () => { const entry = integratedSummaryEntryPresets()[Number(b.dataset.summaryEntry)]; if (entry)
        openIntegratedTransactionForm('', { ...entry, date: integratedEntryDateForMonth() }); });
}
function integratedFormEntryPreset(form, withAmounts = false) {
    const data = new FormData(form);
    return integratedCleanEntryPreset(Object.fromEntries(data.entries()), withAmounts);
}
function openIntegratedTransactionForm(id = '', preset = {}) {
    const tx = id ? integratedStore().ledger.find(t => t.id === id) || null : null;
    if (tx?.meta?.cardPlanId) {
        toast('카드 구매는 카드·할부에서 확인해 주세요.');
        return;
    }
    if (tx?.meta?.isaLifecycleAccountId) {
        toast('ISA 정산에 연결된 거래입니다. 회차 기록에서 확인해 주세요.');
        return;
    }
    if (tx?.type === 'refund') {
        toast('환불 기록은 삭제 후 다시 등록해 주세요.');
        return;
    }
    if (tx && tx.meta?.scheduleId) {
        toast('일정에서 생성된 거래는 일정 상세에서 확인해 주세요.');
        return;
    }
    const remembered = typeof setting === 'function' ? integratedCleanEntryPreset(setting().integratedEntryLast) : null;
    const formPreset = tx || { ...(remembered || {}), ...preset, date: preset.date || integratedEntryDateForMonth() };
    $('#formEyebrow').textContent = '통합';
    $('#formTitle').textContent = tx ? '거래 수정' : '거래 입력';
    $('#formBody').innerHTML = integratedFormMarkup(tx, formPreset);
    openSheet('#formSheet', { mode: 'input' });
    syncIntegratedFormFields();
    const form = $('#integratedTxForm');
    if (form.elements.category)
        form.elements.category.dataset.auto = tx || formPreset.category ? '0' : '1';
    const syncTypes = () => { form.querySelectorAll('[data-entry-type]').forEach(b => { const selected = b.dataset.entryType === form.elements.uiType?.value; b.classList.toggle('active', selected); b.setAttribute('aria-pressed', String(selected)); }); if (!tx) {
        const labels = { externalIncome: '수입 입력', lifeExpense: '지출 입력', savingInvestment: '저축·투자 입력', loanPayment: '대출 납부' };
        $('#formTitle').textContent = labels[form.elements.uiType?.value || ''] || '거래 입력';
    } };
    form.querySelectorAll('[data-entry-type]').forEach(button => button.onclick = () => { if (!form.elements.uiType)
        return; form.elements.uiType.value = button.dataset.entryType || ''; form.elements.uiType.dispatchEvent(new Event('change', { bubbles: true })); syncTypes(); });
    form.elements.uiType?.addEventListener('change', syncTypes);
    syncTypes();
    const amountInput = form.querySelector('#entryAmount'), amountDisplay = form.querySelector('.entry-amount-display');
    if (amountInput && amountDisplay) {
        const displayAmount = () => { const amount = Number(amountInput.value), valid = !!amountInput.value && Number.isFinite(amount) && financialNumberInRange(amount); amountInput.classList.toggle('has-value', valid); amountDisplay.textContent = valid ? amount.toLocaleString('ko-KR') : ''; amountDisplay.classList.toggle('amount-long', valid && amountDisplay.textContent.length > 13); };
        amountInput.addEventListener('input', displayAmount);
        displayAmount();
    }
    form.elements.uiType?.addEventListener('change', () => { if (form.elements.category)
        form.elements.category.dataset.auto = '1'; syncIntegratedFormFields(); formClearError(form); sheetDirty = true; });
    form.elements.toAccountId?.addEventListener('change', () => { syncIntegratedFormFields(); formClearError(form); sheetDirty = true; });
    form.elements.date?.addEventListener('change', () => { syncIntegratedFormFields(); const hint = form.querySelector('[data-entry-date-context]'), date = form.elements.date?.value || ''; if (hint)
        hint.textContent = date === localYmd() ? `오늘 ${date} 기록` : date ? `${date} 날짜로 기록합니다. 저장 전 날짜를 확인해 주세요.` : '기록할 날짜를 선택해 주세요.'; sheetDirty = true; });
    form.querySelectorAll('[data-entry-category]').forEach(button => button.onclick = () => { if (!form.elements.category)
        return; form.elements.category.value = button.dataset.entryCategory || ''; form.elements.category.dataset.auto = '0'; form.querySelectorAll('[data-entry-category]').forEach(b => b.classList.toggle('active', b === button)); sheetDirty = true; formClearError(form); });
    form.addEventListener('input', (event) => { sheetDirty = true; const target = event.target; if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement))
        return; const name = target.name; if (['amount', 'principal', 'interest', 'date', 'targetPensionAccountId', 'targetIsaAccountId'].includes(name)) {
        const error = integratedFormLiveError(form);
        if (error)
            formShowError(form, error);
        else
            formClearError(form);
    } });
    form.querySelectorAll?.('[data-entry-preset]').forEach(button => button.addEventListener('click', () => {
        const [kind, index] = String(button.dataset.entryPreset).split(':'), entry = (kind === 'favorite' ? integratedEntryFavorites() : integratedRecentEntryPresets())[Number(index)];
        if (!entry)
            return;
        const apply = () => { sheetDirty = false; openIntegratedTransactionForm('', { ...entry, date: form.elements.date?.value || integratedEntryDateForMonth() }); sheetDirty = true; };
        if (sheetDirty)
            showDialog({ title: '기록을 불러올까요?', message: '입력 중인 내용이 선택한 기록으로 바뀝니다.', confirmText: '불러오기', cancelText: '취소' }, apply);
        else
            apply();
    }));
    form.querySelectorAll?.('[data-entry-remove]').forEach(button => button.addEventListener('click', async () => { const entries = integratedEntryFavorites(), before = clone(setting().integratedEntryFavorites); entries.splice(Number(button.dataset.entryRemove), 1); setting().integratedEntryFavorites = entries; if (!(await persist())) {
        setting().integratedEntryFavorites = before;
        return;
    } button.closest('.entry-shortcut')?.remove(); toast('자주 쓰는 기록에서 뺐어요.'); }));
    form.addEventListener('submit', async (event) => { event.preventDefault(); (await saveIntegratedTransaction(event.currentTarget, !!event.submitter?.hasAttribute('data-entry-continue'))); });
}
function integratedFormLiveError(form) {
    const data = new FormData(form), type = String(data.get('uiType') || ''), systemType = form.dataset.systemType || '';
    if (type === 'loanPayment') {
        const principalRaw = String(data.get('principal') ?? ''), interestRaw = String(data.get('interest') ?? ''), principal = Number(principalRaw), interest = Number(interestRaw);
        if (!financialNumberInRange(principal) || !financialNumberInRange(interest))
            return '원금과 이자는 정확하게 저장 가능한 숫자여야 합니다.';
        if (principal < 0 || interest < 0)
            return '원금과 이자는 0원 이상 입력해 주세요.';
        if (principal <= 0 && interest <= 0)
            return '원금 또는 이자를 1원 이상 입력해 주세요.';
    }
    else {
        const raw = String(data.get('amount') ?? '');
        if (!raw)
            return '';
        const amount = Number(raw);
        if (!Number.isFinite(amount) || amount <= 0)
            return '금액은 1원 이상 입력해 주세요.';
        if (!financialNumberInRange(amount))
            return '금액이 너무 커 정확하게 저장할 수 없습니다.';
    }
    const rows = integratedCandidatesFromForm(form);
    if (!rows.length && !systemType)
        return '';
    for (const row of rows) {
        const error = integratedValidateCandidate(row, form.dataset.editId || '');
        if (error)
            return error;
    }
    return '';
}
function integratedCandidatesFromForm(form) {
    const data = new FormData(form), systemType = form.dataset.systemType || '', editingId = String(form.dataset.editId || ''), existing = editingId ? (integratedStore().ledger || []).find(t => t.id === editingId) : null;
    const date = String(data.get('date') || ymd()), note = String(data.get('note') || '').trim(), base = { date, note, sequence: existing && String(existing.date) === date && Number.isFinite(Number(existing.sequence)) ? Number(existing.sequence) : nextIntegratedSequence(date), createdAt: existing?.createdAt || new Date().toISOString() };
    if (systemType) {
        const amount = Number(data.get('amount')), category = String(data.get('category') || systemType);
        if (systemType === 'openingAsset')
            return [{ ...base, id: form.dataset.editId || uid('igl'), type: 'openingAsset', amount, toAccountId: String(data.get('toAccountId') || ''), category }];
        if (systemType === 'openingLiability')
            return [{ ...base, id: form.dataset.editId || uid('igl'), type: 'openingLiability', amount, liabilityId: String(data.get('liabilityId') || ''), category }];
    }
    const type = String(data.get('uiType') || ''), amount = Number(data.get('amount')), category = String(data.get('category') || integratedDefaultCategory(type)).trim();
    if (type === 'externalIncome')
        return [{ ...base, id: editingId || uid('igl'), type: 'externalIncome', amount, toAccountId: 'cash-main', category }];
    if (type === 'lifeExpense')
        return [{ ...base, id: editingId || uid('igl'), type: existing?.type === 'externalExpense' ? 'externalExpense' : 'expense', fixed: !!existing?.fixed, amount, fromAccountId: existing?.type === 'externalExpense' ? undefined : 'cash-main', category, ...(existing?.productId ? { productId: existing.productId, meta: clone(existing.meta || {}) } : {}) }];
    if (type === 'savingInvestment') {
        const toAccountId = String(data.get('toAccountId') || ''), targetKind = integratedStore().accounts.find(a => a.id === toAccountId)?.kind || '', requested = String(data.get('targetPensionAccountId') || '');
        const candidates = ['pension', 'irp'].includes(targetKind) ? pensionAccountsForKind(targetKind, date) : [], resolved = requested && candidates.some(a => a.id === requested) ? requested : (candidates.length === 1 ? candidates[0].id : '');
        const isaRequested = String(data.get('targetIsaAccountId') || ''), isaCandidates = targetKind === 'isa' ? isaAccountsForDate(date) : [], isaResolved = isaRequested && isaCandidates.some(a => a.id === isaRequested) ? isaRequested : (isaCandidates.length === 1 ? isaCandidates[0].id : '');
        const meta = ['pension', 'irp'].includes(targetKind) ? { targetPensionAccountId: resolved, pensionRoutingRequired: !resolved } : targetKind === 'isa' ? { targetIsaAccountId: isaResolved, isaRoutingRequired: !isaResolved } : {};
        return [{ ...base, id: editingId || uid('igl'), type: 'internalTransfer', amount, fromAccountId: 'cash-main', toAccountId, category: category || integratedAccountName(toAccountId), meta }];
    }
    if (type === 'loanPayment') {
        const principal = Number(data.get('principal')) || 0, interest = Number(data.get('interest')) || 0, liabilityId = String(data.get('liabilityId') || ''), rows = [];
        const principalId = editingId && existing?.type === 'debtPrincipal' ? editingId : uid('igl'), interestId = editingId && existing?.type === 'debtInterest' ? editingId : uid('igl');
        if (principal > 0)
            rows.push({ ...base, id: principalId, type: 'debtPrincipal', amount: principal, fromAccountId: 'cash-main', liabilityId, category: '대출 원금상환' });
        if (interest > 0)
            rows.push({ ...base, id: interestId, type: 'debtInterest', amount: interest, fromAccountId: 'cash-main', liabilityId, category: '대출 이자' });
        return rows;
    }
    return [];
}
function integratedValidateCandidate(candidate, editingId = '') {
    if (candidate.meta?.pensionRoutingRequired)
        return '복수 연금계좌 중 실제 납입 계좌를 선택해 주세요.';
    if (candidate.meta?.isaRoutingRequired)
        return '복수 ISA 중 실제 납입 계좌를 선택해 주세요.';
    const dateError = postedDateError(candidate.date || '');
    if (dateError)
        return dateError;
    const accountMap = new Map((integratedStore().accounts || []).map(a => [a.id, a])), targetKind = accountMap.get(candidate.toAccountId)?.kind || '', explicitPension = String(candidate.meta?.targetPensionAccountId || ''), explicitIsa = String(candidate.meta?.targetIsaAccountId || '');
    if (['internalTransfer', 'externalAssetIn'].includes(candidate.type || '') && ['pension', 'irp'].includes(targetKind)) {
        const eligible = pensionAccountsForKind(targetKind, candidate.date || '');
        if (explicitPension && !eligible.some(a => a.id === explicitPension))
            return '선택한 연금 납입 계좌가 해당 날짜에 운영 중이 아닙니다.';
        if (eligible.length > 1 && !explicitPension)
            return '복수 연금계좌 중 실제 납입 계좌를 선택해 주세요.';
        if (!eligible.length)
            return '해당 날짜에 운영 중인 연금 납입 계좌가 없습니다.';
    }
    if (['internalTransfer', 'externalAssetIn'].includes(candidate.type || '') && targetKind === 'isa') {
        const eligible = isaAccountsForDate(candidate.date || '');
        if (explicitIsa && !eligible.some(a => a.id === explicitIsa))
            return '선택한 ISA가 해당 날짜에 운영 중이 아닙니다.';
        if (eligible.length > 1 && !explicitIsa)
            return '복수 ISA 중 실제 납입 계좌를 선택해 주세요.';
        if (!eligible.length)
            return '해당 날짜에 운영 중인 ISA가 없습니다.';
        const target = eligible.find(a => a.id === (explicitIsa || eligible[0]?.id));
        if (target?.baselineDate && (candidate.date || '') <= target.baselineDate)
            return `초기 잔고 기준일 ${formatDate(target.baselineDate)} 이후 납입만 추가해 주세요.`;
    }
    for (const id of [candidate.fromAccountId, candidate.toAccountId, candidate.accountId].filter(Boolean)) {
        const account = accountMap.get(id || ''), product = account?.productId ? financialProduct(account.productId || '') : null;
        if (account && product && !financialProductActiveOnDate(product, candidate.date || ''))
            return `${account.name} 상품의 운영기간 밖 거래는 저장할 수 없습니다.`;
    }
    if (candidate.liabilityId) {
        const liability = (integratedStore().liabilities || []).find(x => x.id === candidate.liabilityId), product = liability?.productId ? financialProduct(liability.productId || '') : null;
        if (liability && product && !financialProductActiveOnDate(product, candidate.date || ''))
            return `${liability.name} 대출의 운영기간 밖 거래는 저장할 수 없습니다.`;
    }
    if (candidate.type === 'adjustment') {
        if (!Number.isFinite(Number(candidate.delta)))
            return '보정금액은 올바른 숫자여야 합니다.';
        if (!financialNumberInRange(candidate.delta))
            return '보정금액이 너무 커 정확하게 저장할 수 없습니다.';
        if (Number(candidate.delta) === 0)
            return '보정금액은 0원이 될 수 없습니다.';
    }
    else {
        if (!Number.isFinite(Number(candidate.amount)))
            return '금액은 1원 이상 입력해 주세요.';
        if (!financialNumberInRange(candidate.amount))
            return '금액이 너무 커 정확하게 저장할 수 없습니다.';
        if (Number(candidate.amount) <= 0)
            return '금액은 1원 이상 입력해 주세요.';
    }
    if (candidate.type === 'internalTransfer' && candidate.fromAccountId === candidate.toAccountId)
        return '같은 계좌로는 이체할 수 없습니다.';
    const test = clone(integratedStore());
    test.ledger = (test.ledger || []).filter(t => t.id !== editingId && !isQaIntegratedFixture(t));
    test.ledger.push(candidate);
    const issues = [...integratedCandidateIssues(test), ...integratedPolicyLimitIssues(test)];
    return issues.length ? issues[0].replace('자산 잔액 음수:', '잔액이 부족합니다:').replace('부채 잔액 음수:', '대출잔액보다 많이 상환할 수 없습니다:') : '';
}
async function saveIntegratedTransaction(form, continueEntry = false) {
    const rows = integratedCandidatesFromForm(form), editingId = form.dataset.editId || '';
    if (!rows.length) {
        const message = '기록할 금액을 입력해 주세요.', isLoan = String(new FormData(form).get('uiType') || '') === 'loanPayment';
        formShowError(form, message, isLoan ? 'principal' : 'amount');
        toast(message);
        return;
    }
    const test = clone(integratedStore());
    if (editingId)
        test.ledger = (test.ledger || []).filter(t => t.id !== editingId);
    for (const row of rows) {
        const error = integratedValidateCandidate(row, editingId);
        if (error) {
            formShowError(form, error);
            toast(error);
            return;
        }
        test.ledger.push(row);
    }
    const combinedIssues = [...integratedCandidateIssues(test), ...integratedPolicyLimitIssues(test)];
    if (combinedIssues.length) {
        const message = combinedIssues[0].replace('자산 잔액 음수:', '잔액이 부족합니다:').replace('부채 잔액 음수:', '대출잔액보다 많이 상환할 수 없습니다:'), isLoan = rows.some(row => row.type === 'loanPayment');
        formShowError(form, message, isLoan ? 'principal' : 'amount');
        toast(message);
        return;
    }
    if (editingId)
        integratedStore().ledger = integratedStore().ledger.filter(t => t.id !== editingId);
    integratedStore().ledger.push(...rows);
    integratedStore().mode = 'live';
    integratedStore().label = '내 통합 거래기록';
    setting().integratedMonth = integratedMonthKey(rows[0].date || '');
    integratedLedgerSearch = '';
    integratedSearchDisplayLimit = 50;
    setting().integratedLedgerFilter = 'all';
    const entry = integratedFormEntryPreset(form), favorite = integratedFormEntryPreset(form, true);
    if (!editingId && !form.dataset.systemType && entry) {
        setting().integratedEntryLast = entry;
        if (new FormData(form).get('saveFavorite') && favorite) {
            const entries = integratedEntryFavorites().filter(item => JSON.stringify(item) !== JSON.stringify(favorite));
            setting().integratedEntryFavorites = [favorite, ...entries].slice(0, 8);
        }
    }
    if (!(await persist()))
        return;
    sheetDirty = false;
    closeSheets({ all: true });
    nav('integrated', 'ledger');
    toast('저장했어요.');
    haptic('light');
    if (continueEntry && !editingId && !form.dataset.systemType)
        openIntegratedTransactionForm('', { ...(entry || {}), date: rows[0].date });
}
function openCashReconcileForm() {
    const date = integratedEntryDateForMonth(), store = integratedStore(), current = Number(integratedReplay(store.ledger.filter(row => String(row.date || '') <= date), store).assets['cash-main'] || 0);
    $('#formEyebrow').textContent = '통합 · 가계부';
    $('#formTitle').textContent = '현금 잔액 맞추기';
    $('#formBody').innerHTML = `<form id="cashReconcileForm" class="form"><div class="finance-form-note real">통장·현금의 실제 잔액을 입력하면 현재 기록과의 차이만 보정 원장으로 남깁니다. 기존 수입·지출 기록은 바꾸지 않습니다.</div><div class="form-grid"><div class="field"><label>확인일</label><input name="date" type="date" value="${escapeHtml(date)}" required></div><div class="field"><label>실제 잔액</label><input name="actualBalance" type="number" min="0" step="1" value="${escapeHtml(Math.round(current))}" required></div></div><div class="finance-settlement-box"><strong>기록상 잔액 ${won(current)}</strong>저장 전 확인일 기준으로 다시 계산합니다.</div><div class="field"><label>메모 <small>선택</small></label><input name="note" placeholder="예: 은행 앱 잔액 확인"></div><div class="form-error" role="alert" aria-live="polite" hidden></div><button class="integrated-form-save" type="submit">잔액 맞추기</button></form>`;
    openSheet('#formSheet', { mode: 'input' });
    const form = $('#cashReconcileForm');
    form.addEventListener('submit', async (event) => { event.preventDefault(); (await saveCashReconcile(event.currentTarget)); });
}
async function saveCashReconcile(form) {
    const data = new FormData(form), date = String(data.get('date') || ymd()), actual = Number(data.get('actualBalance')), note = String(data.get('note') || '').trim(), dateError = postedDateError(date);
    if (dateError) {
        formShowError(form, dateError, 'date');
        return;
    }
    if (!Number.isFinite(actual) || actual < 0 || !financialNumberInRange(actual)) {
        formShowError(form, '실제 잔액은 0원 이상 정확한 숫자로 입력해 주세요.', 'actualBalance');
        return;
    }
    const store = integratedStore(), rows = store.ledger.filter(row => String(row.date || '') <= date), current = Number(integratedReplay(rows, store).assets['cash-main'] || 0), delta = actual - current;
    if (Math.abs(delta) < .5) {
        formShowError(form, '이미 실제 잔액과 일치합니다.', 'actualBalance');
        return;
    }
    const candidate = { id: uid('igl'), date, type: 'adjustment', accountId: 'cash-main', delta, category: '현금 잔액 맞춤', note, meta: { reconciliation: true, previousBalance: current, recordedBalance: actual } };
    const error = integratedValidateCandidate(candidate, '');
    if (error) {
        formShowError(form, error, 'actualBalance');
        return;
    }
    store.ledger.push(candidate);
    store.mode = 'live';
    store.label = '내 통합 거래기록';
    setting().integratedMonth = integratedMonthKey(date);
    integratedLedgerSearch = '';
    integratedSearchDisplayLimit = 50;
    setting().integratedLedgerFilter = 'all';
    if (!(await persist()))
        return;
    sheetDirty = false;
    closeSheets({ all: true });
    nav('integrated', 'summary');
    toast(`현금 잔액을 ${won(actual)}으로 맞췄습니다.`);
    haptic('light');
}
function deleteIntegratedTransaction(id) {
    const tx = integratedStore().ledger.find(t => t.id === id);
    if (!tx) {
        toast('거래를 찾지 못했습니다.');
        return;
    }
    if (tx.meta?.cardPlanId) {
        toast('카드 구매와 미납 원금이 연결된 기록입니다.');
        return;
    }
    if (tx.meta?.isaLifecycleAccountId) {
        toast('ISA 정산에 연결된 거래는 개별 삭제할 수 없습니다.');
        return;
    }
    showDialog({ title: '이 거래를 삭제할까요?', message: `${tx.date} · ${tx.category || integratedTxLabel(tx)} 기록을 삭제합니다. 관련 합계가 즉시 다시 계산됩니다.`, confirmText: '삭제', cancelText: '취소', danger: true }, async () => {
        const before = clone(integratedStore());
        integratedStore().ledger = integratedStore().ledger.filter(t => t.id !== id);
        const issues = integratedCandidateIssues(integratedStore());
        if (issues.length) {
            state.integrated = before;
            toast('삭제하면 잔액이 맞지 않아 취소했습니다.');
            return;
        }
        integratedStore().mode = 'live';
        integratedStore().label = '내 통합 거래기록';
        if (!(await persist()))
            return;
        sheetDirty = false;
        closeSheets();
        nav('integrated', 'ledger');
        toast('거래를 삭제했습니다.');
        haptic('light');
    });
}
function eventTarget(event) { return event.currentTarget; }
function openIntegratedTransactionDetail(id) {
    const tx = integratedLedger().find(x => x.id === id);
    if (!tx) {
        toast('거래를 찾지 못했습니다.');
        return;
    }
    const linkedProduct = !!tx.productId, productLinkedManaged = linkedProduct && ['externalAssetIn', 'externalAssetOut', 'externalDebtPrincipal', 'debtInterestExternal', 'openingAsset', 'openingLiability'].includes(tx.type || '');
    $('#sheetEyebrow').textContent = '통합 · 거래';
    $('#sheetTitle').textContent = tx.category || integratedTxLabel(tx);
    const sourceBox = tx.meta?.cardPlanId ? '<div class="source-note">카드 구매와 미납 원금이 연결된 기록입니다. 통합 → 일정 → 카드·할부에서 확인해 주세요.</div>' : tx.readonly ? `<div class="source-note">${tx.sourceModule === 'isa' ? 'ISA' : '개인연금'}의 실제 기록을 자동으로 읽은 거래입니다. 통합에서 중복 수정하지 않습니다.</div><button class="diagnostic-action" data-linked-source="${escapeHtml(tx.sourceModule)}">원본 화면 열기</button>` : productLinkedManaged ? `<div class="source-note">금융상품과 연결된 거래입니다. 통합에서 따로 수정하면 상품 잔액과 어긋날 수 있어 상품 화면에서 관리합니다.</div><button class="diagnostic-action" data-linked-product="${escapeHtml(tx.productId)}">금융상품 열기</button>` : `<div class="integrated-detail-note">수정·삭제하면 통합 수치가 즉시 다시 계산됩니다.</div><div class="integrated-detail-actions"><button data-integrated-edit="${escapeHtml(tx.id || '')}">수정</button><button class="danger" data-integrated-delete-detail="${escapeHtml(tx.id || '')}">삭제</button></div>`;
    $('#sheetBody').innerHTML = `<div class="sheetrows"><div class="sheetrow"><span>날짜</span><strong>${escapeHtml(tx.date)}</strong></div><div class="sheetrow"><span>유형</span><strong>${escapeHtml(integratedTxLabel(tx))}</strong></div><div class="sheetrow"><span>금액</span><strong>${tx.type === 'adjustment' ? signed(Number(tx.delta) || 0) : won(tx.amount)}</strong></div>${integratedTxAccountsText(tx) ? `<div class="sheetrow"><span>계좌</span><strong>${escapeHtml(integratedTxAccountsText(tx))}</strong></div>` : ''}${tx.note ? `<div class="sheetrow"><span>메모</span><strong>${escapeHtml(tx.note)}</strong></div>` : ''}</div>${sourceBox}${integratedEntryPresetFromRecord(tx) ? '<button class="diagnostic-action" data-entry-copy>이 기록 복사</button>' : ''}${!tx.meta?.cardPlanId && ['expense', 'externalExpense'].includes(tx.type || '') ? `<button class="diagnostic-action" data-refund="${escapeHtml(tx.id || '')}">환불·부분취소</button>` : ''}`;
    openSheet('#detailSheet');
    $('[data-entry-copy]')?.addEventListener('click', () => { const preset = integratedEntryPresetFromRecord(tx); if (preset) {
        closeSheets({ all: true });
        openIntegratedTransactionForm('', { ...preset, date: integratedEntryDateForMonth() });
        sheetDirty = true;
    } });
    $('[data-refund]')?.addEventListener('click', () => openIntegratedRefundForm(tx.id || ''));
    $('[data-integrated-edit]')?.addEventListener('click', (event) => openIntegratedTransactionForm(eventTarget(event).dataset.integratedEdit));
    $('[data-integrated-delete-detail]')?.addEventListener('click', (event) => deleteIntegratedTransaction(String(eventTarget(event).dataset.integratedDeleteDetail || '')));
    $('[data-linked-source]')?.addEventListener('click', (event) => { closeSheets(); eventTarget(event).dataset.linkedSource === 'isa' ? nav('isa', 'transactions') : nav('pension', 'contribution'); });
    $('[data-linked-product]')?.addEventListener('click', (event) => { const productId = String(eventTarget(event).dataset.linkedProduct || ''); closeSheets({ fromPop: true }); setTimeout(() => openFinancialProductDetail(productId), 40); });
}
function recordIntegratedRefund(originalId, date, amount) {
    const original = integratedStore().ledger.find(t => t.id === originalId);
    if (!original || !['expense', 'externalExpense'].includes(original.type || ''))
        return { ok: false, error: '환불할 지출 기록을 찾지 못했습니다.' };
    const row = { id: uid('refund'), date, type: 'refund', amount: Number(amount), toAccountId: original.type === 'expense' ? original.fromAccountId : '', category: original.category, fixed: original.fixed, note: '원거래 환불', meta: { refundOf: original.id } };
    const error = integratedValidateCandidate(row);
    if (error)
        return { ok: false, error };
    integratedStore().ledger.push(row);
    return { ok: true, row };
}
function openIntegratedRefundForm(id) {
    const tx = integratedStore().ledger.find(t => t.id === id);
    if (!tx)
        return;
    const refunded = integratedStore().ledger.filter(row => row.type === 'refund' && row.meta?.refundOf === id).reduce((sum, row) => sum + Number(row.amount), 0), remaining = Number(tx.amount) - refunded;
    $('#formEyebrow').textContent = '통합 · 환불';
    $('#formTitle').textContent = '환불·부분취소 기록';
    $('#formBody').innerHTML = `<form id="refundForm" class="form"><div class="readonly-row"><span>환불 가능한 잔액</span><strong>${won(remaining)}</strong></div><div class="field"><label>환불일</label><input name="date" type="date" value="${escapeHtml(localYmd())}" required></div><div class="field"><label>실제 환불액</label><input name="amount" type="number" min="1" max="${escapeHtml(remaining)}" value="${escapeHtml(remaining)}" required></div><div class="source-note">원래 지출은 보존하며 환불한 달의 소비에서 차감합니다.</div><button class="form-btn primary">환불 저장</button></form>`;
    openSheet('#formSheet', { mode: 'input' });
    $('#refundForm').onsubmit = async (event) => {
        event.preventDefault();
        const form = event.currentTarget, data = new FormData(form), before = clone(state), result = recordIntegratedRefund(id, String(data.get('date')), Number(data.get('amount')));
        if (!result.ok) {
            toast(result.error);
            return;
        }
        setting().integratedMonth = integratedMonthKey(String(data.get('date')));
        setting().integratedLedgerFilter = 'all';
        integratedLedgerSearch = '';
        if (!(await persist())) {
            state = before;
            return;
        }
        sheetDirty = false;
        closeSheets({ all: true });
        nav('integrated', 'ledger');
        toast('환불을 기록했습니다.');
    };
}
