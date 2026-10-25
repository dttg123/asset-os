"use strict";
'use strict';
const CARD_ISSUER_TEMPLATES = ['국민카드', '삼성카드', '현대카드', '신한카드', '하나카드', '롯데카드', '우리카드', 'NH농협카드', '기타 카드'];
const SETTINGS_GROUPS = [{ key: 'assets', title: '자산·연동', icon: '☁', hint: 'Google·클라우드 · 한국투자 연결', actions: ['cloud-auth', 'kis'] }, { key: 'finance', title: '금융 관리', icon: '▣', hint: '카드·할부 · 보험 · 납부 일정', actions: ['cards', 'card-ledger', 'insurance', 'schedule', 'categories', 'products'] }, { key: 'invest', title: '투자·연금', icon: '↗', hint: 'ISA · 연금저축 · IRP · AI 전략', actions: ['policies', 'pension-settings', 'ai-strategy'] }, { key: 'data', title: '앱 설정·데이터 관리', icon: '⚙', hint: '화면·테마 · 백업·복원 · 시스템 진단', actions: ['appearance', 'backup', 'advanced'] }];
const SETTINGS_LABELS = { 'cloud-auth': 'Google · 클라우드', kis: '한국투자 연결', cards: '카드 관리', 'card-ledger': '카드·할부 내역', insurance: '내 보험', schedule: '금융 일정', categories: '소비 카테고리', products: '예금·적금·대출 상품', policies: 'ISA·연금 제도 관리', 'pension-settings': '개인연금 설정', 'ai-strategy': 'AI 투자전략', appearance: '화면 및 테마', backup: '백업·복원', advanced: '고급 설정·시스템 진단' };
function cardUiButton(label, action, id = '', extra = '') { return `<button type="button" class="diagnostic-action" data-card-action="${escapeHtml(action)}" data-card-id="${escapeHtml(id)}" ${extra}>${escapeHtml(label)}</button>`; }
function cardUiPair(label, value) { return `<div class="sheetrow"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`; }
function cardUiInput(name, label, value = '', type = 'text', required = true) { return `<div class="field"><label for="card-field-${escapeHtml(name)}">${escapeHtml(label)}</label><input id="card-field-${escapeHtml(name)}" name="${escapeHtml(name)}" type="${escapeHtml(type)}" value="${escapeHtml(value)}" ${type === 'number' ? 'min="0" step="1" inputmode="numeric"' : ''} ${required ? 'required' : ''}></div>`; }
function cardUiSelect(name, label, rows, value = '') { return `<div class="field"><label for="card-field-${escapeHtml(name)}">${escapeHtml(label)}</label><select id="card-field-${escapeHtml(name)}" name="${escapeHtml(name)}">${rows.map(([key, text]) => `<option value="${escapeHtml(key)}" ${key === value ? 'selected' : ''}>${escapeHtml(text)}</option>`).join('')}</select></div>`; }
function cardUiDetail(title, body) { $('#sheetEyebrow').textContent = '통합 · 카드'; $('#sheetTitle').textContent = title; $('#sheetBody').innerHTML = body; openSheet('#detailSheet'); bindCardManagement(); bindSpendingReview(); }
function cardUiCategoryField(value = '미분류') { const names = spendingCategoryNames(), current = names.includes(value) ? value : '미분류'; return `<div class="field spending-category-field"><label>카테고리</label><input type="hidden" name="category" value="${escapeHtml(current)}"><details class="spending-category-picker"><summary aria-label="카테고리 선택"><span data-category-current>${escapeHtml(current)}</span><span aria-hidden="true">⌄</span></summary><input type="search" data-category-search placeholder="분류 검색" aria-label="분류 검색" autocomplete="off"><div class="spending-category-options">${names.map(name => `<button type="button" data-category-choice="${escapeHtml(name)}" aria-pressed="${escapeHtml(name === current)}">${spendingCategoryIcon(name)}<span>${escapeHtml(name)}</span></button>`).join('')}</div><small data-category-empty hidden>검색 결과가 없어요. 설정에서 분류를 추가할 수 있어요.</small></details></div>`; }
function bindSpendingCategoryPicker(form) { const picker = form.querySelector('.spending-category-picker'); if (!picker)
    return; picker.querySelector('[data-category-search]').onkeydown = event => { if (event.key === 'Enter' && !event.isComposing) {
    event.preventDefault();
    event.stopPropagation();
    picker.querySelector('[data-category-choice]:not([hidden])')?.focus();
} }; picker.querySelector('[data-category-search]').oninput = e => { const query = e.currentTarget.value.trim().toLocaleLowerCase(); let count = 0; picker.querySelectorAll('[data-category-choice]').forEach(b => { b.hidden = !String(b.dataset.categoryChoice).toLocaleLowerCase().includes(query); if (!b.hidden)
    count++; }); picker.querySelector('[data-category-empty]').hidden = count > 0; }; picker.querySelectorAll('[data-category-choice]').forEach(b => b.onclick = () => { const input = form.querySelector('[name="category"]'); input.value = b.dataset.categoryChoice || '미분류'; picker.querySelector('[data-category-current]').textContent = input.value; picker.querySelectorAll('[data-category-choice]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); picker.open = false; sheetDirty = true; input.dispatchEvent(new Event('input', { bubbles: true })); }); }
function cardUiForm(title, body, save) {
    $('#formEyebrow').textContent = '통합 · 카드';
    $('#formTitle').textContent = title;
    $('#formBody').innerHTML = `<form id="cardLedgerForm" class="form">${body}<div class="warningbox" data-card-form-error hidden role="alert"></div><button type="submit" class="integrated-form-save">저장</button></form>`;
    openSheet('#formSheet', { mode: 'input' });
    const form = $('#cardLedgerForm');
    bindSpendingCategoryPicker(form);
    let saving = false;
    form.onsubmit = async (event) => { event.preventDefault(); if (saving)
        return; saving = true; const button = form.querySelector('button[type="submit"]'); button.disabled = true; try {
        await save(Object.fromEntries(new FormData(form).entries()));
    }
    catch (error) {
        const box = form.querySelector('[data-card-form-error]');
        box.hidden = false;
        box.textContent = error instanceof Error ? error.message : String(error);
    }
    finally {
        saving = false;
        button.disabled = false;
    } };
    return form;
}
function cardUiDone(id = '') { sheetDirty = false; closeSheets({ all: true }); render(); if (id)
    openCardLedgerDetail(id); }
async function cardUiActionResult(ok, id) { if (!ok)
    return; cardUiDone(id); toast('카드 기록을 저장했어요.'); }
function openSettingsGroup(key) { const group = SETTINGS_GROUPS.find(x => x.key === key); if (!group)
    return; $('#sheetEyebrow').textContent = '설정'; $('#sheetTitle').textContent = group.title; $('#sheetBody').innerHTML = `<div class="menulist">${group.actions.map(action => `<button class="menurow" data-profile-action="${escapeHtml(action)}"><span class="menuico">${escapeHtml(group.icon)}</span><span class="menucopy"><strong>${escapeHtml(SETTINGS_LABELS[action])}</strong></span><span class="menugo">›</span></button>`).join('')}</div>`; openSheet('#detailSheet'); $$('#sheetBody [data-profile-action]').forEach(button => button.onclick = async () => { const action = button.dataset.profileAction; if (action === 'cloud-auth')
    openCloudAccountSheet();
else if (action === 'kis')
    await openKisSettings();
else if (action === 'cards')
    openCardManagement();
else if (action === 'card-ledger')
    openCardPlansHub();
else if (action === 'insurance')
    openInsuranceHub();
else if (action === 'schedule') {
    closeSheets({ all: true });
    nav('integrated', 'schedule');
}
else if (action === 'categories')
    openSpendingCategoryManagement();
else if (action === 'products')
    await openFinancialProductHub();
else if (action === 'policies')
    await openPolicyHub();
else if (action === 'pension-settings')
    openPensionSettings();
else if (action === 'ai-strategy')
    openAiStrategy();
else if (action === 'appearance')
    openSheet('#appearanceSheet');
else if (action === 'backup')
    openBackupHub();
else if (action === 'advanced')
    openAdvancedSettings(); }); }
function openCardManagement() { const rows = cardAccounts(); cardUiDetail('카드 관리', `<div class="cardv2-heading"><span>내 카드 ${rows.length}개</span>${cardUiButton('＋ 카드 추가', 'add-card')}</div><div class="cardv2-list">${rows.map(card => `<button class="cardv2-row" data-card-action="edit-card" data-card-id="${escapeHtml(card.id)}"><span class="cardv2-issuer">${escapeHtml(card.issuer.slice(0, 2))}</span><span><strong>${escapeHtml(card.name)}</strong><small>${card.lastFour ? '끝 ' + escapeHtml(card.lastFour) + ' · ' : ''}${card.archived ? '사용 중지' : card.statementDay ? '매월 ' + card.statementDay + '일 결제확정' : '결제일 설정'}</small></span><b>매월 ${card.paymentDay}일</b><i>›</i></button>`).join('') || '<div class="integrated-empty">기본 카드사를 선택해 내 카드를 등록해 주세요.</div>'}</div><div class="source-note">카드 이름과 결제일로 관리합니다. 은행계좌 정보는 등록하지 않습니다.</div><h3 class="cardv2-title">청구·납부 내역</h3>${cardUiButton('카드·할부 내역 보기', 'ledger-hub')}`); }
function openCardAccountForm(id = '', issuer = '국민카드') {
    const current = cardAccounts().find(x => x.id === id), brand = current?.issuer || issuer;
    const form = cardUiForm(id ? '카드 수정' : '카드 추가', `${!id ? '<div class="cardv2-segment" role="tablist" aria-label="카드 등록 방법"><button type="button" role="tab" aria-selected="true" class="active" data-card-entry-mode="template">기본 카드사</button><button type="button" role="tab" aria-selected="false" data-card-entry-mode="manual">직접 입력</button></div>' : ''}${!id ? `<div class="cardv2-templates">${CARD_ISSUER_TEMPLATES.map(name => `<button type="button" data-card-template="${escapeHtml(name)}">${escapeHtml(name)}</button>`).join('')}</div>` : ''}${cardUiInput('name', '카드 이름', current?.name || brand)}${cardUiSelect('issuer', '카드사', CARD_ISSUER_TEMPLATES.map(x => [x, x]), brand)}${cardUiSelect('paymentDay', '매월 결제일', [['', '결제일 선택'], ...Array.from({ length: 31 }, (_, i) => [String(i + 1), `${i + 1}일`])], String(current?.paymentDay || ''))}${cardUiSelect('statementDay', '매월 결제확정일 · 선택', [['', '미설정'], ...Array.from({ length: 31 }, (_, i) => [String(i + 1), `${i + 1}일`])], String(current?.statementDay || ''))}${cardUiInput('lastFour', '끝 4자리 · 선택', current?.lastFour || '', 'text', false)}${id ? cardUiSelect('archived', '사용 상태', [['false', '사용 중'], ['true', '사용 중지']], String(current?.archived || false)) : ''}<div class="source-note">결제일을 바꿔도 이미 기록한 청구일과 납부 기록은 바뀌지 않습니다.</div>`, async (data) => { if (await saveCardAccount({ ...data, archived: data.archived === 'true' }, id)) {
        cardUiDone();
        openCardManagement();
        toast('카드를 저장했어요.');
    } });
    form.elements.namedItem('paymentDay').required = true;
    form.querySelectorAll('[data-card-entry-mode]').forEach(button => button.onclick = () => { const manual = button.dataset.cardEntryMode === 'manual'; form.querySelector('.cardv2-templates').hidden = manual; form.querySelectorAll('[data-card-entry-mode]').forEach(x => { x.classList.toggle('active', x === button); x.setAttribute('aria-selected', String(x === button)); }); if (manual)
        form.elements.namedItem('name').focus(); });
    form.querySelectorAll('[data-card-template]').forEach(button => button.onclick = () => { form.elements.namedItem('name').value = button.dataset.cardTemplate || ''; form.elements.namedItem('issuer').value = button.dataset.cardTemplate || ''; sheetDirty = true; });
    const last = form.elements.namedItem('lastFour');
    last.maxLength = 4;
    last.inputMode = 'numeric';
    last.pattern = '[0-9]{4}';
}
function openCardPurchaseForm(id = '') {
    const s = financeSchedules().find(x => x.id === id), plan = s && cardV2(s), cards = cardAccounts().filter(x => !x.archived || x.id === plan?.cardId);
    if (!cards.length) {
        cardUiDetail('카드 구매 기록', `<div class="integrated-empty">결제일을 연결할 카드를 먼저 등록해 주세요.</div>${cardUiButton('카드 등록하기', 'add-card')}`);
        return;
    }
    const date = plan?.purchaseDate || localYmd(), first = plan?.firstPaymentDate || '', selected = plan?.cardId || cards[0].id;
    const form = cardUiForm(id ? '구매 기록 수정' : '카드 구매 기록', `${cardUiInput('name', '구매 이름', s?.name || '')}${cardUiInput('purchaseAmount', '총 구매액 · 원', plan?.grossAmount || '', 'number')}<div class="form-grid">${cardUiInput('purchaseDate', '구매일', date, 'date')}${cardUiCategoryField(spendingCategoryLabel(plan?.category || '미분류'))}</div>${cardUiSelect('cardId', '카드 선택', cards.map(x => [x.id, `${x.name} · 매월 ${x.paymentDay}일`]), selected)}<div class="form-grid">${cardUiSelect('months', '결제 방식', [1, 2, 3, 4, 5, 6, 10, 12, 18, 24, 30, 36, 48, 60].map(x => [String(x), x === 1 ? '일시불' : `${x}개월`]), String(plan?.months || 24))}${cardUiSelect('interestMode', '이자 조건', [['free', '무이자'], ['paid', '유이자'], ['partial', '부분무이자']], plan?.interestMode || 'free')}</div><div data-card-interest>${cardUiInput('annualRate', '예상 연이율 · %', plan?.annualRate || 0, 'number')}<div data-card-rounds>${cardUiInput('paidRounds', '이자 부담 회차 · 쉼표로 구분', plan?.paidInterestRounds.join(',') || '1,2,3', 'text', false)}<small>카드사 조건에 맞게 입력해 주세요. 예: 1~3회차 부담 → 1,2,3</small></div></div>${cardUiInput('firstPaymentDate', '첫 청구일 · 명세서 확인', first, 'date')}<small>결제일은 카드에서 가져옵니다. 첫 청구 월은 명세서를 보고 직접 선택해 주세요.</small><details class="entry-extra"><summary>구매 할인·가맹점</summary>${cardUiInput('purchaseDiscount', '구매 시 할인 · 원', plan?.purchaseDiscount || 0, 'number')}${cardUiInput('merchant', '가맹점 · 선택', plan?.merchant || '', 'text', false)}</details><div class="cardv2-estimate" data-card-estimate></div><div class="source-note">원 단위 나머지는 마지막 회차에 반영합니다. 청구할인·포인트는 청구·납부에서 기록하고, 실제 청구액을 우선합니다.</div>`, async (data) => { const rounds = String(data.paidRounds || '').split(',').map(x => x.trim()).filter(Boolean).map(Number), input = { ...data, paidInterestRounds: rounds, cardLedgerVersion: 2 }; const key = id ? (await updateCardPurchase(id, input) ? id : '') : await createCardPurchase(input); if (key) {
        cardUiDone(key);
        toast('구매와 카드 원금을 저장했어요.');
    } });
    form.classList.add('card-purchase-form');
    const saveButton = form.querySelector('button[type=submit]'), fields = document.createElement('div');
    fields.className = 'card-purchase-fields';
    while (form.firstChild && form.firstChild !== saveButton)
        fields.appendChild(form.firstChild);
    form.insertBefore(fields, saveButton);
    saveButton.textContent = id ? '구매 기록 수정' : '구매 기록 저장';
    const update = (changed = '') => { const controls = form.elements, mode = controls.namedItem('interestMode').value, n = Number(controls.namedItem('months').value), gross = Number(controls.namedItem('purchaseAmount').value), discount = Number(controls.namedItem('purchaseDiscount').value), net = Math.max(0, gross - discount), base = Math.floor(net / n), last = net - base * (n - 1), card = cards.find(x => x.id === controls.namedItem('cardId').value); form.querySelector('[data-card-interest]').hidden = mode === 'free'; form.querySelector('[data-card-rounds]').hidden = mode !== 'partial'; const rateInput = controls.namedItem('annualRate'), roundInput = controls.namedItem('paidRounds'); rateInput.step = '0.01'; rateInput.max = '100'; rateInput.disabled = mode === 'free'; roundInput.disabled = mode !== 'partial'; roundInput.required = mode === 'partial'; const rounds = roundInput.value.split(',').map(x => x.trim()).filter(Boolean).map(Number); roundInput.setCustomValidity(mode === 'partial' && (!rounds.length || rounds.some(x => !Number.isInteger(x) || x < 1 || x > n) || new Set(rounds).size !== rounds.length) ? '이자 부담 회차를 1회부터 할부 기간 안에서 입력해 주세요.' : ''); const due = controls.namedItem('firstPaymentDate'); if (changed === 'cardId' && due.value && card) {
        const y = Number(due.value.slice(0, 4)), m = Number(due.value.slice(5, 7));
        due.value = `${y}-${String(m).padStart(2, '0')}-${String(Math.min(card.paymentDay, new Date(y, m, 0).getDate())).padStart(2, '0')}`;
    } ; form.querySelector('[data-card-estimate]').innerHTML = `<strong>첫 회차 예상 ${won(base)}${mode === 'free' ? '' : ' + 이자'}</strong><small>마지막 회차 원금 ${won(last)} · 카드 결제일 매월 ${card?.paymentDay || '-'}일</small>`; };
    form.addEventListener('input', () => update());
    form.addEventListener('change', event => update(event.target.name));
    update();
}
function cardHistorySection(plan) { const history = plan.historyBaseline; if (!history)
    return ''; return `<section class="cardv2-history"><h3 class="cardv2-title">과거 명세서 연결</h3><p class="source-note">${escapeHtml(history.asOf)}에 확인한 잔여 원금으로 연결했어요. ${history.includeSpending ? '확인한 구매금액은 소비에 반영했어요.' : '과거 소비는 다시 합산하지 않았어요.'} 납부일·현금·포인트가 미확인인 내역은 새 현금 출금으로 만들지 않았어요. 이후 청구는 확인된 명세서만 표시해요.</p>${history.statements.map(row => `<div class="cardv2-payment"><strong>${escapeHtml(row.month)} · ${row.round}회차 · ${row.status === 'paid' ? '명세서 납부 확인' : '청구 예정'}</strong><small>원금 ${won(row.principal)} · 이자 ${won(row.interest)} · 처리 후 ${row.status === 'paid' ? '' : '예정 '}잔액 ${won(row.remainingPrincipal)}</small><small>${row.paidDate ? '입금일 ' + escapeHtml(row.paidDate) : row.status === 'paid' ? '실제 입금일·납부 재원 미확인' : '납부 전'}</small></div>`).join('')}</section>`; }
function openCardLedgerDetail(id) {
    const s = financeSchedules().find(x => x.id === id), p = s && cardV2(s);
    if (!s || !p)
        return;
    const account = cardAccounts().find(x => x.id === p.cardId), remaining = cardRemaining(s), original = cardRows(s).find(x => x.meta?.cardPurchase), classification = integratedCardIdentity(id), refunds = cardRows(s).filter(x => x.type === 'refund' && x.meta?.cardCredit === 'refund'), events = [...new Set(refunds.map(x => String(x.meta?.cardEventId)))];
    cardUiDetail(classification.item, `<section class="cardv2-estimate"><span>${escapeHtml(account?.name || '카드')} · ${p.months === 1 ? '일시불' : p.months + '개월'}</span><strong>남은 원금 ${won(remaining)}</strong><small>구매 ${escapeHtml(p.purchaseDate)} · ${escapeHtml(spendingCategoryLabel(classification.category))} · ${escapeHtml(p.historyBaseline ? '명세서 이자 기준' : p.interestMode === 'partial' ? p.paidInterestRounds.join(',') + '회차 이자 부담' : p.interestMode === 'free' ? '무이자' : '유이자')}</small></section><div class="sheetrows">${cardUiPair('총 구매액', won(p.grossAmount))}${p.purchaseDiscount ? cardUiPair(p.historyBaseline ? '확인된 할인' : '구매 할인', `−${won(p.purchaseDiscount)}`) : ''}${cardUiPair('기록한 구매금액', won(p.purchaseAmount))}</div><div class="cardv2-actions">${original ? `<button class="diagnostic-action" data-spending-classify="${escapeHtml(original.id)}" data-classify-card="${escapeHtml(id)}">항목 이름·분류 수정</button>` : ''}${cardUiButton('＋ 실제 청구 입력', 'bill-new', id)}${p.historyBaseline ? '' : cardUiButton('구매 기록 수정', 'purchase-edit', id)}</div>${cardHistorySection(p)}<h3 class="cardv2-title">청구 내역</h3><div class="cardv2-list">${[...p.bills].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map(b => `<button class="cardv2-row" data-card-action="bill-open" data-card-id="${escapeHtml(id)}" data-bill-id="${escapeHtml(b.id)}"><span><strong>${escapeHtml(b.dueDate)}</strong><small>${cardBillPaid(p, b) ? '납부 완료' : '실제 청구 · 납부 전'}</small></span><b>${won(cardBillTotal(b))}</b><i>›</i></button>`).join('') || '<div class="integrated-empty">명세서의 실제 원금·이자·할인을 입력해 주세요.</div>'}</div><h3 class="cardv2-title">납부 기록</h3>${p.payments.map(pay => `<div class="cardv2-payment"><strong>${escapeHtml(pay.date)} · ${pay.kind === 'payoff' ? '원금 전액 상환' : '청구액 납부'}</strong><small>현금 ${won(pay.cash)} · 포인트 ${won(pay.pointsPrincipal + pay.pointsInterest)}</small>${cardUiButton('납부 되돌리기', 'payment-remove', id, `data-payment-id="${escapeHtml(pay.id)}"`)}</div>`).join('') || '<div class="source-note">아직 납부 기록이 없습니다.</div>'}${cardUiButton('환불·부분취소', 'refund', id)}${remaining > 0 ? cardUiButton('남은 할부원금 전액 상환', 'payoff', id) : ''}${events.map(event => cardUiButton('환불 기록 되돌리기', 'refund-remove', id, `data-event-id="${escapeHtml(event)}"`)).join('')}${p.historyBaseline ? '' : cardUiButton('미납 구매 기록 취소', 'purchase-remove', id)}<div class="source-note">카드 구매는 소비로 한 번 기록하고 원금 납부는 부채에서 차감합니다.</div>`);
}
function openCardBillForm(id, billId = '') {
    const s = financeSchedules().find(x => x.id === id), p = s && cardV2(s);
    if (!s || !p)
        return;
    const b = p.bills.find(x => x.id === billId), month = integratedSelectedMonth(), first = p.firstPaymentDate, day = Number(first.slice(8)), y = Number(month.slice(0, 4)), m = Number(month.slice(5, 7)), due = `${month}-${String(Math.min(day, new Date(y, m, 0).getDate())).padStart(2, '0')}`;
    cardUiForm('실제 청구 기록', `${cardUiInput('issuedDate', '명세서 확인일', b?.issuedDate || localYmd(), 'date')}${cardUiInput('dueDate', '실제 결제 예정일', b?.dueDate || due, 'date')}<div class="form-grid">${cardUiInput('principal', '청구 원금 · 할인 전', b?.principal ?? '', 'number')}${cardUiInput('interest', '청구 이자 · 할인 전', b?.interest || 0, 'number')}</div><details class="entry-extra" ${b?.principalDiscount || b?.interestDiscount ? 'open' : ''}><summary>청구할인</summary>${cardUiInput('principalDiscount', '원금 할인 · 원', b?.principalDiscount || 0, 'number')}${cardUiInput('interestDiscount', '이자 할인 · 원', b?.interestDiscount || 0, 'number')}<small>명세서의 원금·이자 할인 구분을 그대로 입력해 주세요.</small></details>${cardUiInput('note', '메모 · 선택', b?.note || '', 'text', false)}<div class="source-note">구매 기록은 유지하고 실제 청구만 별도로 저장합니다. 청구할인은 확인일에 원금과 소비에서 반영합니다.</div>`, async (data) => { const key = await saveCardBill(id, data, billId); if (key) {
        cardUiDone();
        openCardBillDetail(id, key);
    } });
}
function openCardBillDetail(id, billId) {
    const s = financeSchedules().find(x => x.id === id), p = s && cardV2(s), b = p?.bills.find(x => x.id === billId);
    if (!s || !p || !b)
        return;
    const paid = cardBillPaid(p, b);
    cardUiDetail('청구·납부', `<section class="cardv2-estimate"><span>${escapeHtml(integratedCardIdentity(id).item)} · ${escapeHtml(b.dueDate)}</span><strong>실제 청구 ${won(cardBillTotal(b))}</strong><small>${paid ? '납부 완료' : '납부 전'}</small></section><div class="sheetrows">${cardUiPair('청구 원금', won(b.principal))}${cardUiPair('청구 이자', won(b.interest))}${cardUiPair('원금 할인', `−${won(b.principalDiscount)}`)}${cardUiPair('이자 할인', `−${won(b.interestDiscount)}`)}</div>${!paid ? `${cardUiButton('납부 기록', 'bill-payment', id, `data-bill-id="${escapeHtml(billId)}"`)}${cardUiButton('이번 청구액 선납', 'bill-prepay', id, `data-bill-id="${escapeHtml(billId)}"`)}${cardUiButton('청구 내역 수정', 'bill-edit', id, `data-bill-id="${escapeHtml(billId)}"`)}${cardUiButton('청구 내역 삭제', 'bill-remove', id, `data-bill-id="${escapeHtml(billId)}"`)}` : ''}${cardUiButton('구매·전체 납부 기록 보기', 'purchase-open', id)}<div class="source-note">이번 청구액 선납은 이번 명세서만 납부합니다. 남은 할부원금 전체 상환과 구분합니다.</div>`);
}
function openCardPaymentForm(id, billId = '', prepay = false) {
    const s = financeSchedules().find(x => x.id === id), p = s && cardV2(s), b = p?.bills.find(x => x.id === billId);
    if (!s || !p || billId && !b)
        return;
    const payoff = !billId, principal = payoff ? cardRemaining(s) : b.principal - b.principalDiscount, interest = payoff ? 0 : b.interest - b.interestDiscount;
    const form = cardUiForm(payoff ? '남은 원금 전액 상환' : prepay ? '이번 청구액 선납' : '납부 기록', `${cardUiInput('date', '실제 납부일', localYmd(), 'date')}<div class="sheetrows">${cardUiPair(payoff ? '상환할 남은 원금' : '할인 후 청구 원금', won(principal))}${!payoff ? cardUiPair('할인 후 이자', won(interest)) : ''}</div>${payoff ? cardUiInput('interest', '카드사 확정 이자 · 원', 0, 'number') : ''}<details class="entry-extra"><summary>포인트 사용</summary>${cardUiInput('pointsPrincipal', '원금에 사용한 포인트', 0, 'number')}${cardUiInput('pointsInterest', '이자에 사용한 포인트', 0, 'number')}</details><div class="cardv2-estimate" data-card-cash-preview></div><div class="source-note">${payoff ? '카드사에서 전액 상환금액과 추가 이자·수수료 유무를 확인해 주세요. 수수료가 있다면 별도 지출로 기록합니다.' : '실제 청구액과 현금·포인트 합계를 맞춰 기록합니다. 남은 회차는 그대로 유지합니다.'}</div>`, async (data) => { const key = await recordCardPayment(id, { ...data, kind: payoff ? 'payoff' : 'bill', billId, principal }); if (key)
        await cardUiActionResult(true, id); });
    const update = () => { const pp = Number(form.elements.namedItem('pointsPrincipal').value), pi = Number(form.elements.namedItem('pointsInterest').value), chargeInterest = payoff ? Number(form.elements.namedItem('interest').value) : interest; form.querySelector('[data-card-cash-preview]').innerHTML = `<strong>현금 납부 ${won(principal + chargeInterest - pp - pi)}</strong><small>포인트 ${won(pp + pi)} · 합계 ${won(principal + chargeInterest)}</small>`; };
    form.addEventListener('input', update);
    update();
}
function openCardRefundForm(id) { cardUiForm('환불·부분취소', `${cardUiInput('date', '실제 환불일', localYmd(), 'date')}${cardUiInput('amount', '구매금액 환불 · 원', '', 'number')}<div class="form-grid">${cardUiInput('cashAmount', '현금으로 돌려받은 금액', 0, 'number')}${cardUiInput('pointsAmount', '돌려받은 포인트', 0, 'number')}</div><details class="entry-extra"><summary>납부한 이자도 돌려받은 경우</summary>${cardUiInput('interestCashAmount', '이자 중 현금 환급', 0, 'number')}${cardUiInput('interestPointsAmount', '이자 중 포인트 환급', 0, 'number')}</details><div class="source-note">나머지는 미납 카드 원금에서 차감합니다. 실제 환불 경로대로 구분해 주세요.</div>`, async (data) => { if (await recordCardRefund(id, data))
    await cardUiActionResult(true, id); }); }
function openSpendingCategoryManagement() { $('#sheetEyebrow').textContent = '통합 · 소비'; $('#sheetTitle').textContent = '카테고리 관리'; $('#sheetBody').innerHTML = `${cardUiButton('＋ 카테고리 추가', 'category-add')}<div class="cardv2-list">${spendingCategoryNames().map(name => `<div class="cardv2-category">${spendingCategoryIcon(name)}<strong>${escapeHtml(name)}</strong><button data-card-action="category-edit" data-category="${escapeHtml(name)}">수정</button><button data-card-action="category-remove" data-category="${escapeHtml(name)}">삭제</button></div>`).join('')}</div><div class="source-note">분류를 바꿔도 원본 거래와 금액은 유지합니다. 삭제할 때 기존 기록을 옮길 분류를 선택합니다.</div>`; openSheet('#detailSheet'); bindCardManagement(); bindSpendingReview(); }
function openSpendingCategoryForm(name = '', remove = false) { cardUiForm(remove ? '카테고리 이동·삭제' : name ? '카테고리 수정' : '카테고리 추가', remove ? cardUiSelect('replacement', '기록을 옮길 카테고리', spendingCategoryNames().filter(x => x !== name).map(x => [x, x]), '기타') : cardUiInput('replacement', '카테고리 이름', name), async (data) => { if (await saveSpendingCategory(name, String(data.replacement || ''))) {
    cardUiDone();
    openSpendingCategoryManagement();
} }); }
function bindCardManagement() {
    $$('[data-settings-group]').forEach(b => b.onclick = () => openSettingsGroup(b.dataset.settingsGroup || ''));
    $$('[data-card-action]').forEach(b => b.onclick = () => { const action = b.dataset.cardAction || '', id = b.dataset.cardId || '', bill = b.dataset.billId || '', confirm = (label, run) => showDialog({ title: label, message: '연결된 금액과 기록을 함께 다시 계산합니다.', confirmText: '진행', cancelText: '취소' }, async () => { await cardUiActionResult(await run(), id); }); if (action === 'add-card')
        openCardAccountForm();
    else if (action === 'edit-card')
        openCardAccountForm(id);
    else if (action === 'manage-cards')
        openCardManagement();
    else if (action === 'ledger-hub')
        openCardPlansHub();
    else if (action === 'purchase-new')
        openCardPurchaseForm();
    else if (action === 'purchase-edit')
        openCardPurchaseForm(id);
    else if (action === 'purchase-open')
        openCardLedgerDetail(id);
    else if (action === 'purchase-remove')
        confirm('미납 구매 기록을 취소할까요?', () => removeUnpaidCardInstallment(id));
    else if (action === 'bill-new')
        openCardBillForm(id);
    else if (action === 'bill-open')
        openCardBillDetail(id, bill);
    else if (action === 'bill-edit')
        openCardBillForm(id, bill);
    else if (action === 'bill-remove')
        confirm('청구 기록을 삭제할까요?', () => removeCardBill(id, bill));
    else if (action === 'bill-payment' || action === 'bill-prepay')
        openCardPaymentForm(id, bill, action === 'bill-prepay');
    else if (action === 'payoff')
        openCardPaymentForm(id);
    else if (action === 'refund')
        openCardRefundForm(id);
    else if (action === 'payment-remove')
        confirm('납부를 되돌릴까요?', () => removeCardPayment(id, b.dataset.paymentId || ''));
    else if (action === 'refund-remove')
        confirm('환불을 되돌릴까요?', () => removeCardRefund(id, b.dataset.eventId || ''));
    else if (action === 'category-add')
        openSpendingCategoryForm();
    else if (action === 'category-edit')
        openSpendingCategoryForm(b.dataset.category || '');
    else if (action === 'category-remove')
        openSpendingCategoryForm(b.dataset.category || '', true); });
}
// Keep legacy card plans readable. Only newly authored purchases use the new ledger.
openCardInstallmentForm = function () { openCardPurchaseForm(); };
const cardPreviousDetail = openCardPlanDetail;
openCardPlanDetail = function (id) { const s = financeSchedules().find(x => x.id === id); if (s && cardV2(s))
    openCardLedgerDetail(id);
else
    cardPreviousDetail(id); };
const cardPreviousHub = openCardPlansHub;
openCardPlansHub = function () { cardPreviousHub(); $('#sheetBody').insertAdjacentHTML('afterbegin', cardUiButton('카드 관리', 'manage-cards')); if (route().root === 'integrated' && route().tab === 'schedule')
    $$('#sheetBody [data-card-plan-new]').forEach(b => b.remove()); bindCardManagement(); };
const cardPreviousSummary = integratedSummaryPage;
integratedSummaryPage = function () { return cardPreviousSummary() + `<section class="card cardv2-entry"><div><h2>카드 구매 기록</h2><small>일시불·할부와 납부 일정을 연결해요.</small></div>${cardUiButton('＋ 구매 기록', 'purchase-new')}</section>`; };
const cardPreviousScheduleDay = openScheduleDay;
openScheduleDay = async function (date, id = '') { const s = financeSchedules().find(x => x.id === id); if (s && cardV2(s)) {
    openCardLedgerDetail(id);
    return;
} await cardPreviousScheduleDay(date, id); const list = financeSchedules().filter(x => cardV2(x)?.bills.some(b => b.dueDate === date)); for (const card of list)
    $('#sheetBody').insertAdjacentHTML('beforeend', cardUiButton(`${card.name} · 청구·납부 보기`, 'purchase-open', card.id)); bindCardManagement(); };
const cardPreviousBind = bind;
bind = function () { cardPreviousBind(); bindCardManagement(); bindSpendingReview(); };
function spendingPeriodMode() { return String(setting().spendingPeriod || 'month'); }
function spendingPeriodKey() { return spendingRangeKey(integratedSelectedMonth(), spendingPeriodMode()); }
function spendingViewContext() { return integratedSelectedMonth() + ':' + spendingPeriodMode(); }
function spendingFocusedPeriod() { return spendingPeriodKey(); }
function clearSpendingSelection() { delete setting().spendingChartContext; delete setting().spendingChartPeriod; setting().spendingCategoryFilter = ''; }
function spendingName(row) { return String(row.meta?.spendingItem || row.category || '미분류'); }
function spendingCategoryIcon(category) {
    const key = category.includes('보험') ? 'insurance' : category.includes('식비') ? 'food' : category.includes('게임') ? 'game' : category.includes('가전') ? 'device' : category.includes('용돈') ? 'gift' : category.includes('쇼핑') ? 'bag' : category.includes('주거') ? 'home' : category.includes('교통') ? 'car' : category.includes('미분류') ? 'unknown' : 'receipt';
    const paths = { insurance: 'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3ZM8 12l3 3 5-6', food: 'M6 3v7m-3-7v5a3 3 0 0 0 6 0V3M6 11v10M17 3c-3 2-3 7 0 8h2M19 3v18', game: 'M7 8h10c3 0 5 9 3 10-2 1-4-3-5-3H9c-1 0-3 4-5 3C2 17 4 8 7 8ZM7 10v4M5 12h4M16 11h.01M18 13h.01', device: 'M3 5h18v12H3zM8 21h8M12 17v4', gift: 'M3 8h18v4H3zM5 12v9h14v-9M12 8v13M12 8C5 8 6 2 9 3c2 0 3 5 3 5Zm0 0c7 0 6-6 3-5-2 0-3 5-3 5Z', bag: 'M5 7h14l1 14H4L5 7ZM8 8V6a4 4 0 0 1 8 0v2', home: 'm3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7', car: 'm4 10 2-6h12l2 6M3 10h18v9H3zM6 19v2M18 19v2M6 14h1M17 14h1', unknown: 'M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 4M12 18h.01', receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3ZM9 8h6M9 12h6' };
    return `<span class="spending-icon spending-icon-${key}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${key === 'unknown' ? '<circle cx="12" cy="12" r="10"/>' : ''}<path d="${escapeHtml(paths[key])}"/></svg></span>`;
}
function spendingTrendMarkup(analysis, item = '', linked = false) {
    const saved = linked && setting().spendingChartContext === spendingViewContext() ? String(setting().spendingChartPeriod || '') : '', selected = analysis.trend.find(x => x.month === (saved || analysis.month)) || (linked ? analysis.trend.find(x => x.month === integratedSelectedMonth()) : null) || analysis.trend.findLast(x => x.amount !== 0) || analysis.trend.at(-1);
    if (!selected)
        return '';
    const max = Math.max(1, ...analysis.trend.map(x => Math.abs(x.amount))), period = selected.month, daily = period.length === 10;
    return `<div class="spending-chart ${daily ? 'spending-chart-daily' : ''}" ${linked ? 'data-spending-linked="true"' : ''}><div class="spending-trend" style="--spending-columns:${analysis.trend.length}">${analysis.trend.map(x => `<button data-spending-select="${escapeHtml(x.month)}" data-spending-amount="${escapeHtml(x.amount)}" aria-pressed="${escapeHtml(x.month === period)}" aria-label="${escapeHtml(spendingPeriodLabel(x.month) + ' 순소비 ' + won(x.amount))}"><span class="spending-bar"><i class="${escapeHtml(x.month === period ? 'current' : '')}" style="height:${Math.abs(x.amount) / max * 100}%;${x.amount < 0 ? 'background:var(--down)' : ''}"></i></span><strong>${escapeHtml(x.label)}</strong></button>`).join('')}</div><div class="spending-chart-selection" aria-live="polite"><span data-spending-selected-label>${escapeHtml(spendingPeriodLabel(period))}</span><strong data-spending-selected-amount>${won(selected.amount)}</strong><button class="tinybtn" data-spending-selected-detail="${escapeHtml(period)}" data-spending-selected-item="${escapeHtml(item)}">${item ? '이 기간 거래 보기' : '분류별 내역 보기'} <span aria-hidden="true">›</span></button></div></div>`;
}
function spendingPeriodLabel(period) { return spendingRangeLabel(period); }
function spendingItemRows(items, ranked = false, period = spendingFocusedPeriod()) {
    const rows = integratedSpendingAnalysis(period).rows;
    return `<div class="cardv2-list spending-items">${items.map((x, index) => { const dates = rows.filter(row => spendingName(row) === x.key && row.category === x.category).map(row => String(row.date)).sort(), range = dates.length ? dates[0].slice(5).replace('-', '.') + (dates.at(-1) !== dates[0] ? '–' + dates.at(-1).slice(5).replace('-', '.') : '') : ''; return `<button class="cardv2-row" data-spending-item="${escapeHtml(x.key)}" data-spending-item-category="${escapeHtml(x.category)}">${ranked ? `<span class="spending-rank">${index + 1}</span>` : spendingCategoryIcon(x.category)}<span><strong>${escapeHtml(x.key)}</strong><small>${x.count}건${range ? ' · ' + escapeHtml(range) : ''}${x.category === '미분류' ? ' · 분류 필요' : ''}</small></span><b>${won(x.amount)}</b><i aria-hidden="true">›</i></button>`; }).join('') || '<div class="integrated-empty">해당 소비 항목이 없습니다.</div>'}</div>`;
}
integratedSpendingPage = function () {
    const period = spendingPeriodKey(), windowAnalysis = integratedSpendingView(integratedSelectedMonth(), spendingPeriodMode()), analysis = integratedSpendingAnalysis(period), view = setting().spendingView === 'items' ? 'items' : 'categories', budget = Math.max(0, Number(setting().monthlyLivingBudget) || 0);
    let selected = String(setting().spendingCategoryFilter || '');
    if (selected && !analysis.categories.some(x => x.key === selected)) {
        selected = '';
        setting().spendingCategoryFilter = '';
    }
    const items = analysis.items.filter(x => !selected || x.category === selected), unclassified = analysis.rows.filter(x => x.category === '미분류').length;
    const categoryList = `<div class="spending-categories">${analysis.categories.map(x => `<button data-spending-category-filter="${escapeHtml(x.key)}">${spendingCategoryIcon(x.key)}<span class="cardv2-category-label">${escapeHtml(x.key)}<small>${x.count}건</small></span><strong>${won(x.amount)}</strong><i aria-hidden="true">›</i></button>`).join('') || '<div class="integrated-empty">이 기간의 소비 기록이 없습니다.</div>'}</div>`;
    return `<div class="spending-review"><section class="spending-hero"><div class="spending-hero-head"><span>${escapeHtml(spendingPeriodLabel(period))} 총 소비</span><button data-spending-new>＋ 지출</button></div><strong>${won(analysis.total)}</strong><small class="${escapeHtml(analysis.change < 0 ? 'spending-decrease' : '')}">${analysis.previousTotal ? `${escapeHtml(spendingPeriodLabel(analysis.previousMonth))} 대비 ${analysis.change > 0 ? '+' : analysis.change < 0 ? '−' : ''}${won(Math.abs(analysis.change))} · ${Math.abs(analysis.changeRate || 0).toFixed(1)}%` : '이전 기간 비교 기록 없음'}</small><p class="spending-chart-window">${spendingPeriodMode() === 'month' ? '일별 소비' : spendingPeriodMode() === 'years' ? '연도별 소비' : '월별 소비'}</p>${spendingTrendMarkup(windowAnalysis, '', true)}<small>구매일 기준 · 카드 원금 납부는 제외</small></section><section class="card spending-split"><button data-spending-detail="fixed" data-spending-month="${escapeHtml(period)}"><span>고정비</span><strong>${won(analysis.rows.filter(x => x.fixed).reduce((n, x) => n + Number(x.amount || 0), 0))}</strong></button><button data-spending-detail="variable" data-spending-month="${escapeHtml(period)}"><span>변동비</span><strong>${won(analysis.rows.filter(x => !x.fixed).reduce((n, x) => n + Number(x.amount || 0), 0))}</strong></button></section><div class="cardv2-segment spending-view" aria-label="소비 보기"><button data-spending-view="categories" class="${escapeHtml(view === 'categories' ? 'active' : '')}">카테고리별</button><button data-spending-view="items" class="${escapeHtml(view === 'items' ? 'active' : '')}">항목별</button></div>${view === 'categories' ? `<section class="card spending-card"><div class="sectionhead"><h2>카테고리별 소비</h2><button class="tinybtn" data-spending-category-manage>분류 관리</button></div><div class="spending-distribution">${categoryList}</div>${unclassified ? `<button class="spending-unclassified" data-spending-category-filter="미분류">${spendingCategoryIcon('미분류')}<span>미분류 ${unclassified}건</span><strong>분류하기 ›</strong></button>` : ''}<details class="spending-top-items"><summary>많이 쓴 항목 TOP 5</summary>${spendingItemRows(analysis.items.slice(0, 5), true, period)}</details></section>` : `<div class="cardv2-filters"><button data-spending-category-filter="" class="${escapeHtml(!selected ? 'active' : '')}">전체</button>${analysis.categories.map(x => `<button data-spending-category-filter="${escapeHtml(x.key)}" class="${escapeHtml(selected === x.key ? 'active' : '')}">${escapeHtml(x.key)}</button>`).join('')}</div><section class="card spending-card"><div class="sectionhead"><h2>${escapeHtml(selected || '소비 항목')}</h2><span>${items.length}개</span></div>${spendingItemRows(items, false, period)}</section>`}${/^\d{4}-\d{2}$/.test(period) ? `<button class="card spending-budget-card" data-spending-budget><span>${budget ? '월 생활비 목표' : '생활비 목표 설정'}</span><strong>${budget ? won(budget) : '선택 사항 ›'}</strong>${budget ? `<small>사용 ${won(analysis.total)} · ${budget - analysis.total >= 0 ? '남음' : '초과'} ${won(Math.abs(budget - analysis.total))}</small>` : ''}</button>` : ''}</div>`;
};
let spendingListRows = [];
function spendingTransactionRows(rows, limit = 10) {
    spendingListRows = [...rows].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    let last = '';
    const body = spendingListRows.slice(0, limit).map(row => {
        const date = String(row.date || ''), heading = date !== last ? `<h4 class="spending-date-group">${escapeHtml(date)}</h4>` : '';
        last = date;
        const name = spendingName(row), category = String(row.category || ''), subtitle = row.type === 'refund' ? '환불' : category === name ? '' : category;
        return `${heading}<button class="cardv2-row" data-spending-transaction="${escapeHtml(row.id)}">${spendingCategoryIcon(category)}<span><strong>${escapeHtml(name)}</strong>${subtitle ? `<small>${escapeHtml(subtitle)}</small>` : ''}</span><b>${won(row.amount)}</b><i aria-hidden="true">›</i></button>`;
    }).join('');
    return `<div class="cardv2-list spending-transactions">${body || '<div class="integrated-empty">이 기간의 기록이 없습니다.</div>'}${spendingListRows.length > limit ? `<button class="diagnostic-action" data-spending-more="${escapeHtml(limit + 20)}">더 보기 · ${Math.min(limit, spendingListRows.length)} / ${spendingListRows.length}건</button>` : ''}</div>`;
}
openIntegratedSpendingDetail = function (scope = 'all', key = '', period = spendingFocusedPeriod()) {
    const analysis = integratedSpendingAnalysis(period), rows = analysis.rows.filter(row => scope === 'fixed' ? row.fixed : scope === 'variable' ? !row.fixed : scope === 'category' ? row.category === key : true), groups = new Map();
    for (const row of rows) {
        const category = String(row.category || '기타'), group = groups.get(category) || [];
        group.push(row);
        groups.set(category, group);
    }
    const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    $('#sheetEyebrow').textContent = '통합 · 소비';
    $('#sheetTitle').textContent = `${spendingPeriodLabel(period)} ${scope === 'category' ? key : scope === 'fixed' ? '고정비' : scope === 'variable' ? '변동비' : '소비'} 내역`;
    $('#sheetBody').innerHTML = `<div class="spending-group-total"><span>순소비 · ${rows.length}건</span><strong>${won(total)}</strong></div><div class="spending-group-list">${[...groups].sort((a, b) => b[1].reduce((n, r) => n + Number(r.amount || 0), 0) - a[1].reduce((n, r) => n + Number(r.amount || 0), 0)).map(([category, list]) => `<button class="spending-category-group" data-spending-group="${escapeHtml(category)}" data-spending-group-period="${escapeHtml(period)}" data-spending-group-scope="${escapeHtml(scope)}">${spendingCategoryIcon(category)}<span><strong>${escapeHtml(category)}</strong><small>${list.length}건</small></span><b>${won(list.reduce((n, r) => n + Number(r.amount || 0), 0))}</b><i aria-hidden="true">›</i></button>`).join('') || '<div class="integrated-empty">이 기간의 기록이 없습니다.</div>'}</div>`;
    if (scope === 'category')
        $('#sheetBody').innerHTML += spendingTransactionRows(rows);
    openSheet('#detailSheet');
    bindSpendingReview();
};
function openSpendingItemDetail(key, period = spendingFocusedPeriod(), tab = 'summary', scopeCategory = '') {
    const analysis = integratedSpendingAnalysis(period), matches = (x) => spendingName(x) === key && (!scopeCategory || x.category === scopeCategory), rows = analysis.rows.filter(matches), total = rows.reduce((sum, x) => sum + Number(x.amount || 0), 0), category = scopeCategory || rows[0]?.category || '미분류', previous = analysis.previousMonth, previousTotal = integratedSpendingAnalysis(previous).rows.filter(matches).reduce((sum, x) => sum + Number(x.amount || 0), 0), trend = { ...analysis, trend: analysis.trend.map(x => ({ ...x, amount: integratedSpendingAnalysis(x.month).rows.filter(matches).reduce((sum, row) => sum + Number(row.amount || 0), 0) })) };
    $('#sheetEyebrow').textContent = '통합 · 소비 항목';
    $('#sheetTitle').textContent = key;
    $('#sheetBody').innerHTML = `<div class="spending-item-detail" data-item-category="${escapeHtml(category)}"><div class="spending-detail-heading">${spendingCategoryIcon(category)}<span>${escapeHtml(category)}</span><button class="tinybtn" data-spending-classify-item="${escapeHtml(key)}" data-classify-period="${escapeHtml(period)}">이름·분류 수정</button></div><div class="spending-detail-tabs" role="tablist" aria-label="항목 상세"><button role="tab" aria-selected="${escapeHtml(tab === 'summary')}" class="${escapeHtml(tab === 'summary' ? 'active' : '')}" data-spending-item-tab="summary" data-item-key="${escapeHtml(key)}" data-item-period="${escapeHtml(period)}">요약</button><button role="tab" aria-selected="${escapeHtml(tab === 'transactions')}" class="${escapeHtml(tab === 'transactions' ? 'active' : '')}" data-spending-item-tab="transactions" data-item-key="${escapeHtml(key)}" data-item-period="${escapeHtml(period)}">거래내역</button></div><div class="cardv2-segment spending-period"><button data-spending-item-period="month" data-item-key="${escapeHtml(key)}" data-item-tab="${escapeHtml(tab)}" data-item-period="${escapeHtml(period)}" class="${escapeHtml(/^\d{4}-\d{2}$/.test(period) ? 'active' : '')}">월별</button><button data-spending-item-period="year" data-item-key="${escapeHtml(key)}" data-item-tab="${escapeHtml(tab)}" data-item-period="${escapeHtml(period)}" class="${escapeHtml(period.length === 4 ? 'active' : '')}">연도별</button></div>${tab === 'summary' ? `<section class="spending-item-summary"><span>${escapeHtml(spendingPeriodLabel(period))} 소비</span><strong>${won(total)}</strong><small>${rows.length}건 · ${escapeHtml(category)}</small><details class="spending-item-trend"><summary>기간별 추이 보기</summary>${spendingTrendMarkup(trend, key)}</details>${previousTotal ? `<p class="source-note">${escapeHtml(spendingPeriodLabel(analysis.previousMonth))} 대비 ${total - previousTotal > 0 ? '+' : total - previousTotal < 0 ? '−' : ''}${won(Math.abs(total - previousTotal))}</p>` : ''}</section><div class="sectionhead"><h3>최근 거래</h3><button class="tinybtn" data-spending-item-tab="transactions" data-item-key="${escapeHtml(key)}" data-item-period="${escapeHtml(period)}">전체 보기 ›</button></div>${spendingTransactionRows([...rows].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 3))}` : `<div class="sectionhead"><h3>거래 내역 ${rows.length}건</h3><strong>${won(total)}</strong></div>${spendingTransactionRows(rows)}`}</div>`;
    openSheet('#detailSheet');
    bindSpendingReview();
}
function openSpendingClassification(ids, period, cardId = '') {
    const source = integratedManualLedger(), rows = source.filter(x => ids.includes(x.id) && ['expense', 'externalExpense'].includes(String(x.type)));
    if (!rows.length) {
        toast('분류할 구매 원본을 찾지 못했어요.');
        return;
    }
    const first = spendingClassification(rows[0]);
    cardUiForm('항목 이름·분류 수정', `${cardUiInput('item', '항목 이름', first.item)}${cardUiCategoryField(first.category)}<p class="source-note">선택한 구매 ${rows.length}건의 표시 이름과 분류를 바꿉니다. 구매·청구·납부 원본과 금액은 그대로 유지돼요.</p>`, async (data) => { if (await saveSpendingClassifications(rows.map(x => x.id), String(data.category), String(data.item))) {
        cardUiDone();
        if (cardId)
            openCardLedgerDetail(cardId);
        else
            openSpendingItemDetail(String(data.item), period, 'summary', String(data.category));
        toast('이름과 분류를 저장했어요.');
    } });
}
function bindSpendingReview() {
    if (route().root === 'integrated' && route().tab === 'spending')
        $$('[data-integrated-month-shift]').forEach(b => b.onclick = () => { const step = spendingPeriodMode() === 'quarter' ? 3 : spendingPeriodMode() === 'half' ? 6 : ['year', 'years'].includes(spendingPeriodMode()) ? 12 : 1; setting().integratedMonth = integratedSpendingMonthShift(integratedSelectedMonth(), step * Number(b.dataset.integratedMonthShift)); clearSpendingSelection(); rememberViewPreferences(); render(); });
    $$('[data-spending-period]').forEach(b => b.onclick = async () => { setting().spendingPeriod = b.dataset.spendingPeriod; clearSpendingSelection(); rememberViewPreferences(); render(); });
    $$('[data-spending-view]').forEach(b => b.onclick = async () => { setting().spendingView = b.dataset.spendingView; setting().spendingCategoryFilter = ''; rememberViewPreferences(); render(); });
    $$('[data-spending-category-filter]').forEach(b => b.onclick = async () => { setting().spendingView = 'items'; setting().spendingCategoryFilter = b.dataset.spendingCategoryFilter || ''; rememberViewPreferences(); render(); });
    $$('[data-spending-item]').forEach(b => b.onclick = () => openSpendingItemDetail(b.dataset.spendingItem || '', spendingPeriodKey(), 'summary', b.dataset.spendingItemCategory || ''));
    $$('[data-spending-category-manage]').forEach(b => b.onclick = () => openSpendingCategoryManagement());
    $$('[data-spending-transaction]').forEach(b => b.onclick = () => openIntegratedTransactionDetail(b.dataset.spendingTransaction || ''));
    $$('[data-spending-item-tab]').forEach(b => b.onclick = () => openSpendingItemDetail(b.dataset.itemKey || '', b.dataset.itemPeriod, b.dataset.spendingItemTab, b.closest('[data-item-category]')?.dataset.itemCategory));
    $$('[data-spending-item-period]').forEach(b => b.onclick = () => openSpendingItemDetail(b.dataset.itemKey || '', b.dataset.spendingItemPeriod === 'year' ? String(b.dataset.itemPeriod || integratedSelectedMonth()).slice(0, 4) : (/^\d{4}-\d{2}$/.test(String(b.dataset.itemPeriod || '')) ? b.dataset.itemPeriod : String(b.dataset.itemPeriod || integratedSelectedMonth()).slice(0, 4) + '-' + integratedSelectedMonth().slice(5, 7)), b.dataset.itemTab, b.closest('[data-item-category]')?.dataset.itemCategory));
    $$('[data-spending-classify]').forEach(b => b.onclick = () => openSpendingClassification([b.dataset.spendingClassify || ''], spendingPeriodKey(), b.dataset.classifyCard));
    $$('[data-spending-classify-item]').forEach(b => b.onclick = () => { const period = b.dataset.classifyPeriod || spendingPeriodKey(), rows = integratedSpendingAnalysis(period).rows.filter(x => spendingName(x) === b.dataset.spendingClassifyItem && x.category === b.closest('[data-item-category]')?.dataset.itemCategory); openSpendingClassification([...new Set(rows.map(x => String(x.type === 'refund' ? x.meta?.refundOf : x.id)))], period); });
    $$('[data-spending-select]').forEach(b => b.onclick = () => { const chart = b.closest('.spending-chart'); if (!chart)
        return; if (chart.hasAttribute('data-spending-linked')) {
        setting().spendingChartContext = spendingViewContext();
        setting().spendingChartPeriod = b.dataset.spendingSelect;
        rememberViewPreferences();
    } chart.querySelectorAll('[data-spending-select]').forEach(x => { const active = x === b; x.setAttribute('aria-pressed', String(active)); x.querySelector('i')?.classList.toggle('current', active); }); chart.querySelector('[data-spending-selected-label]').textContent = spendingPeriodLabel(b.dataset.spendingSelect || ''); chart.querySelector('[data-spending-selected-amount]').textContent = won(Number(b.dataset.spendingAmount)); chart.querySelector('[data-spending-selected-detail]').dataset.spendingSelectedDetail = b.dataset.spendingSelect; });
    $$('[data-spending-selected-detail]').forEach(b => b.onclick = () => { const period = b.dataset.spendingSelectedDetail || spendingPeriodKey(), item = b.dataset.spendingSelectedItem; if (item)
        openSpendingItemDetail(item, period, 'transactions', b.closest('[data-item-category]')?.dataset.itemCategory);
    else
        openIntegratedSpendingDetail('all', '', period); });
    $$('[data-spending-group]').forEach(b => b.onclick = () => { const period = b.dataset.spendingGroupPeriod || spendingFocusedPeriod(), key = b.dataset.spendingGroup || '', scope = b.dataset.spendingGroupScope, rows = integratedSpendingAnalysis(period).rows.filter(row => row.category === key && (scope === 'fixed' ? row.fixed : scope === 'variable' ? !row.fixed : true)); $('#sheetTitle').textContent = spendingPeriodLabel(period) + ' ' + key; $('#sheetBody').innerHTML = `<div class="spending-group-total"><span>${rows.length}건 · 순소비</span><strong>${won(rows.reduce((n, r) => n + Number(r.amount || 0), 0))}</strong></div>` + spendingTransactionRows(rows); bindSpendingReview(); });
    $$('[data-spending-more]').forEach(b => b.onclick = () => { const list = b.closest('.spending-transactions'); if (list) {
        list.outerHTML = spendingTransactionRows(spendingListRows, Number(b.dataset.spendingMore));
        bindSpendingReview();
    } });
}
