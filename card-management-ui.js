'use strict';
const CARD_ISSUER_TEMPLATES = ['국민카드', '삼성카드', '현대카드', '신한카드', '하나카드', '롯데카드', '우리카드', 'NH농협카드', '기타 카드'];
const SETTINGS_GROUPS = [{ key: 'assets', title: '자산·연동', icon: '☁', hint: 'Google·클라우드 · 한국투자 연결', actions: ['cloud-auth', 'kis'] }, { key: 'finance', title: '금융 관리', icon: '▣', hint: '카드·할부 · 보험 · 납부 일정', actions: ['cards', 'card-ledger', 'insurance', 'schedule', 'categories', 'products'] }, { key: 'invest', title: '투자·연금', icon: '↗', hint: 'ISA · 연금저축 · IRP · AI 전략', actions: ['policies', 'pension-settings', 'ai-strategy'] }, { key: 'data', title: '앱 설정·데이터 관리', icon: '⚙', hint: '화면·테마 · 백업·복원 · 시스템 진단', actions: ['appearance', 'backup', 'advanced'] }];
const SETTINGS_LABELS = { 'cloud-auth': 'Google · 클라우드', kis: '한국투자 연결', cards: '카드 관리', 'card-ledger': '카드·할부 내역', insurance: '내 보험', schedule: '금융 일정', categories: '소비 카테고리', products: '예금·적금·대출 상품', policies: 'ISA·연금 제도 관리', 'pension-settings': '개인연금 설정', 'ai-strategy': 'AI 투자전략', appearance: '화면 및 테마', backup: '백업·복원', advanced: '고급 설정·시스템 진단' };
function cardUiButton(label, action, id = '', extra = '') { return `<button type="button" class="diagnostic-action" data-card-action="${escapeHtml(action)}" data-card-id="${escapeHtml(id)}" ${extra}>${escapeHtml(label)}</button>`; }
function cardUiPair(label, value) { return `<div class="sheetrow"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`; }
function cardUiInput(name, label, value = '', type = 'text', required = true) { return `<div class="field"><label for="card-field-${escapeHtml(name)}">${escapeHtml(label)}</label><input id="card-field-${escapeHtml(name)}" name="${escapeHtml(name)}" type="${escapeHtml(type)}" value="${escapeHtml(value)}" ${type === 'number' ? 'min="0" step="1" inputmode="numeric"' : ''} ${required ? 'required' : ''}></div>`; }
function cardUiSelect(name, label, rows, value = '') { return `<div class="field"><label for="card-field-${escapeHtml(name)}">${escapeHtml(label)}</label><select id="card-field-${escapeHtml(name)}" name="${escapeHtml(name)}">${rows.map(([key, text]) => `<option value="${escapeHtml(key)}" ${key === value ? 'selected' : ''}>${escapeHtml(text)}</option>`).join('')}</select></div>`; }
function cardUiDetail(title, body) { $('#sheetEyebrow').textContent = '통합 · 카드'; $('#sheetTitle').textContent = title; $('#sheetBody').innerHTML = body; openSheet('#detailSheet'); bindCardManagement(); }
function cardUiForm(title, body, save) {
    $('#formEyebrow').textContent = '통합 · 카드';
    $('#formTitle').textContent = title;
    $('#formBody').innerHTML = `<form id="cardLedgerForm" class="form">${body}<div class="warningbox" data-card-form-error hidden role="alert"></div><button type="submit" class="integrated-form-save">저장</button></form>`;
    openSheet('#formSheet', { mode: 'input' });
    const form = $('#cardLedgerForm');
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
function openCardManagement() { const rows = cardAccounts(); cardUiDetail('카드 관리', `<div class="cardv2-heading"><span>내 카드 ${rows.length}개</span>${cardUiButton('＋ 카드 추가', 'add-card')}</div><div class="cardv2-list">${rows.map(card => `<button class="cardv2-row" data-card-action="edit-card" data-card-id="${escapeHtml(card.id)}"><span class="cardv2-issuer">${escapeHtml(card.issuer.slice(0, 2))}</span><span><strong>${escapeHtml(card.name)}</strong><small>${card.lastFour ? '끝 ' + escapeHtml(card.lastFour) + ' · ' : ''}${card.archived ? '사용 중지' : '결제일 설정'}</small></span><b>매월 ${card.paymentDay}일</b><i>›</i></button>`).join('') || '<div class="integrated-empty">기본 카드사를 선택해 내 카드를 등록해 주세요.</div>'}</div><div class="source-note">카드 이름과 결제일로 관리합니다. 은행계좌 정보는 등록하지 않습니다.</div>`); }
function openCardAccountForm(id = '', issuer = '국민카드') {
    const current = cardAccounts().find(x => x.id === id), brand = current?.issuer || issuer;
    const form = cardUiForm(id ? '카드 수정' : '카드 추가', `${!id ? `<div class="cardv2-templates">${CARD_ISSUER_TEMPLATES.map(name => `<button type="button" data-card-template="${escapeHtml(name)}">${escapeHtml(name)}</button>`).join('')}</div>` : ''}${cardUiInput('name', '카드 이름', current?.name || brand)}${cardUiSelect('issuer', '카드사', CARD_ISSUER_TEMPLATES.map(x => [x, x]), brand)}${cardUiSelect('paymentDay', '매월 결제일', Array.from({ length: 31 }, (_, i) => [String(i + 1), `${i + 1}일`]), String(current?.paymentDay || 14))}${cardUiInput('lastFour', '끝 4자리 · 선택', current?.lastFour || '', 'text', false)}${id ? cardUiSelect('archived', '사용 상태', [['false', '사용 중'], ['true', '사용 중지']], String(current?.archived || false)) : ''}<div class="source-note">결제일을 바꿔도 이미 기록한 청구일과 납부 기록은 바뀌지 않습니다.</div>`, async (data) => { if (await saveCardAccount({ ...data, archived: data.archived === 'true' }, id)) {
        cardUiDone();
        openCardManagement();
        toast('카드를 저장했어요.');
    } });
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
    const form = cardUiForm(id ? '구매 기록 수정' : '카드 구매 기록', `${cardUiInput('name', '구매 이름', s?.name || '')}${cardUiInput('purchaseAmount', '총 구매액 · 원', plan?.grossAmount || '', 'number')}<div class="form-grid">${cardUiInput('purchaseDate', '구매일', date, 'date')}${cardUiSelect('category', '카테고리', spendingCategoryNames().map(x => [x, x]), spendingCategoryLabel(plan?.category || '기타'))}</div>${cardUiSelect('cardId', '카드 선택', cards.map(x => [x.id, `${x.name} · 매월 ${x.paymentDay}일`]), selected)}<div class="form-grid">${cardUiSelect('months', '결제 방식', [1, 2, 3, 4, 5, 6, 10, 12, 18, 24, 30, 36, 48, 60].map(x => [String(x), x === 1 ? '일시불' : `${x}개월`]), String(plan?.months || 24))}${cardUiSelect('interestMode', '이자 조건', [['free', '무이자'], ['paid', '유이자'], ['partial', '부분무이자']], plan?.interestMode || 'free')}</div><div data-card-interest>${cardUiInput('annualRate', '예상 연이율 · %', plan?.annualRate || 0, 'number')}<div data-card-rounds>${cardUiInput('paidRounds', '이자 부담 회차 · 쉼표로 구분', plan?.paidInterestRounds.join(',') || '1,2,3', 'text', false)}<small>카드사 조건에 맞게 입력해 주세요. 예: 1~3회차 부담 → 1,2,3</small></div></div>${cardUiInput('firstPaymentDate', '첫 청구일 · 명세서 확인', first, 'date')}<small>결제일은 카드에서 가져옵니다. 첫 청구 월은 명세서를 보고 직접 선택해 주세요.</small><details class="entry-extra"><summary>구매 할인·가맹점</summary>${cardUiInput('purchaseDiscount', '구매 시 할인 · 원', plan?.purchaseDiscount || 0, 'number')}${cardUiInput('merchant', '가맹점 · 선택', plan?.merchant || '', 'text', false)}</details><div class="cardv2-estimate" data-card-estimate></div><div class="source-note">원 단위 나머지는 마지막 회차에 반영합니다. 청구할인·포인트는 청구·납부에서 기록하고, 실제 청구액을 우선합니다.</div>`, async (data) => { const rounds = String(data.paidRounds || '').split(',').map(x => x.trim()).filter(Boolean).map(Number), input = { ...data, paidInterestRounds: rounds, cardLedgerVersion: 2 }; const key = id ? (await updateCardPurchase(id, input) ? id : '') : await createCardPurchase(input); if (key) {
        cardUiDone(key);
        toast('구매와 카드 원금을 저장했어요.');
    } });
    const update = (changed = '') => { const controls = form.elements, mode = controls.namedItem('interestMode').value, n = Number(controls.namedItem('months').value), gross = Number(controls.namedItem('purchaseAmount').value), discount = Number(controls.namedItem('purchaseDiscount').value), net = Math.max(0, gross - discount), base = Math.floor(net / n), last = net - base * (n - 1), card = cards.find(x => x.id === controls.namedItem('cardId').value); form.querySelector('[data-card-interest]').hidden = mode === 'free'; form.querySelector('[data-card-rounds]').hidden = mode !== 'partial'; const rateInput = controls.namedItem('annualRate'), roundInput = controls.namedItem('paidRounds'); rateInput.step = '0.01'; rateInput.max = '100'; rateInput.disabled = mode === 'free'; roundInput.disabled = mode !== 'partial'; roundInput.required = mode === 'partial'; const rounds = roundInput.value.split(',').map(x => x.trim()).filter(Boolean).map(Number); roundInput.setCustomValidity(mode === 'partial' && (!rounds.length || rounds.some(x => !Number.isInteger(x) || x < 1 || x > n) || new Set(rounds).size !== rounds.length) ? '이자 부담 회차를 1회부터 할부 기간 안에서 입력해 주세요.' : ''); const due = controls.namedItem('firstPaymentDate'); if (changed === 'cardId' && due.value && card) {
        const y = Number(due.value.slice(0, 4)), m = Number(due.value.slice(5, 7));
        due.value = `${y}-${String(m).padStart(2, '0')}-${String(Math.min(card.paymentDay, new Date(y, m, 0).getDate())).padStart(2, '0')}`;
    } ; form.querySelector('[data-card-estimate]').innerHTML = `<strong>첫 회차 예상 ${won(base)}${mode === 'free' ? '' : ' + 이자'}</strong><small>마지막 회차 원금 ${won(last)} · 카드 결제일 매월 ${card?.paymentDay || '-'}일</small>`; };
    form.addEventListener('input', () => update());
    form.addEventListener('change', event => update(event.target.name));
    update();
}
function openCardLedgerDetail(id) {
    const s = financeSchedules().find(x => x.id === id), p = s && cardV2(s);
    if (!s || !p)
        return;
    const account = cardAccounts().find(x => x.id === p.cardId), remaining = cardRemaining(s), refunds = cardRows(s).filter(x => x.type === 'refund' && x.meta?.cardCredit === 'refund'), events = [...new Set(refunds.map(x => String(x.meta?.cardEventId)))];
    cardUiDetail(String(s.name), `<section class="cardv2-estimate"><span>${escapeHtml(account?.name || '카드')} · ${p.months === 1 ? '일시불' : p.months + '개월'}</span><strong>남은 원금 ${won(remaining)}</strong><small>구매 ${escapeHtml(p.purchaseDate)} · ${escapeHtml(spendingCategoryLabel(p.category))} · ${escapeHtml(p.interestMode === 'partial' ? p.paidInterestRounds.join(',') + '회차 이자 부담' : p.interestMode === 'free' ? '무이자' : '유이자')}</small></section><div class="sheetrows">${cardUiPair('총 구매액', won(p.grossAmount))}${p.purchaseDiscount ? cardUiPair('구매 할인', `−${won(p.purchaseDiscount)}`) : ''}${cardUiPair('기록한 구매금액', won(p.purchaseAmount))}</div><div class="cardv2-actions">${cardUiButton('＋ 실제 청구 입력', 'bill-new', id)}${cardUiButton('구매 기록 수정', 'purchase-edit', id)}</div><h3 class="cardv2-title">청구 내역</h3><div class="cardv2-list">${[...p.bills].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map(b => `<button class="cardv2-row" data-card-action="bill-open" data-card-id="${escapeHtml(id)}" data-bill-id="${escapeHtml(b.id)}"><span><strong>${escapeHtml(b.dueDate)}</strong><small>${cardBillPaid(p, b) ? '납부 완료' : '실제 청구 · 납부 전'}</small></span><b>${won(cardBillTotal(b))}</b><i>›</i></button>`).join('') || '<div class="integrated-empty">명세서의 실제 원금·이자·할인을 입력해 주세요.</div>'}</div><h3 class="cardv2-title">납부 기록</h3>${p.payments.map(pay => `<div class="cardv2-payment"><strong>${escapeHtml(pay.date)} · ${pay.kind === 'payoff' ? '원금 전액 상환' : '청구액 납부'}</strong><small>현금 ${won(pay.cash)} · 포인트 ${won(pay.pointsPrincipal + pay.pointsInterest)}</small>${cardUiButton('납부 되돌리기', 'payment-remove', id, `data-payment-id="${escapeHtml(pay.id)}"`)}</div>`).join('') || '<div class="source-note">아직 납부 기록이 없습니다.</div>'}${cardUiButton('환불·부분취소', 'refund', id)}${remaining > 0 ? cardUiButton('남은 할부원금 전액 상환', 'payoff', id) : ''}${events.map(event => cardUiButton('환불 기록 되돌리기', 'refund-remove', id, `data-event-id="${escapeHtml(event)}"`)).join('')}${cardUiButton('미납 구매 기록 취소', 'purchase-remove', id)}<div class="source-note">카드 구매는 소비로 한 번 기록하고 원금 납부는 부채에서 차감합니다.</div>`);
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
    cardUiDetail('청구·납부', `<section class="cardv2-estimate"><span>${escapeHtml(s.name)} · ${escapeHtml(b.dueDate)}</span><strong>실제 청구 ${won(cardBillTotal(b))}</strong><small>${paid ? '납부 완료' : '납부 전'}</small></section><div class="sheetrows">${cardUiPair('청구 원금', won(b.principal))}${cardUiPair('청구 이자', won(b.interest))}${cardUiPair('원금 할인', `−${won(b.principalDiscount)}`)}${cardUiPair('이자 할인', `−${won(b.interestDiscount)}`)}</div>${!paid ? `${cardUiButton('납부 기록', 'bill-payment', id, `data-bill-id="${escapeHtml(billId)}"`)}${cardUiButton('이번 청구액 선납', 'bill-prepay', id, `data-bill-id="${escapeHtml(billId)}"`)}${cardUiButton('청구 내역 수정', 'bill-edit', id, `data-bill-id="${escapeHtml(billId)}"`)}${cardUiButton('청구 내역 삭제', 'bill-remove', id, `data-bill-id="${escapeHtml(billId)}"`)}` : ''}${cardUiButton('구매·전체 납부 기록 보기', 'purchase-open', id)}<div class="source-note">이번 청구액 선납은 이번 명세서만 납부합니다. 남은 할부원금 전체 상환과 구분합니다.</div>`);
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
function openSpendingCategoryManagement() { $('#sheetEyebrow').textContent = '통합 · 소비'; $('#sheetTitle').textContent = '카테고리 관리'; $('#sheetBody').innerHTML = `${cardUiButton('＋ 카테고리 추가', 'category-add')}<div class="cardv2-list">${spendingCategoryNames().map(name => `<div class="cardv2-category"><strong>${escapeHtml(name)}</strong><button data-card-action="category-edit" data-category="${escapeHtml(name)}">수정</button><button data-card-action="category-remove" data-category="${escapeHtml(name)}">삭제</button></div>`).join('')}</div><div class="source-note">분류를 바꿔도 원본 거래와 금액은 유지합니다. 삭제할 때 기존 기록을 옮길 분류를 선택합니다.</div>`; openSheet('#detailSheet'); bindCardManagement(); }
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
function spendingPeriodKey() { return setting().spendingPeriod === 'year' ? integratedSelectedMonth().slice(0, 4) : integratedSelectedMonth(); }
function spendingName(row) { return String(row.meta?.spendingItem || row.category || '기타'); }
function spendingTrendMarkup(analysis) { const max = Math.max(1, ...analysis.trend.map(x => Math.abs(x.amount))); return `<div class="spending-trend">${analysis.trend.map(x => `<button data-spending-period-open="${escapeHtml(x.month)}"><span class="spending-bar"><i style="height:${Math.max(2, Math.abs(x.amount) / max * 100)}%;${x.amount < 0 ? 'background:var(--down)' : ''}"></i></span><strong>${escapeHtml(x.label)}</strong><small>${won(x.amount)}</small></button>`).join('')}</div>`; }
integratedSpendingPage = function () { const period = spendingPeriodKey(), analysis = integratedSpendingAnalysis(period), view = setting().spendingView === 'items' ? 'items' : 'categories', budget = Math.max(0, Number(setting().monthlyLivingBudget) || 0), selectedCategory = String(setting().spendingCategoryFilter || ''), items = analysis.items.filter(x => !selectedCategory || x.category === selectedCategory), positive = analysis.categories.filter(x => x.amount > 0), positiveTotal = positive.reduce((s, x) => s + x.amount, 0), colors = ['#2678f6', '#12a997', '#e9a53c', '#9671e6', '#8594aa', '#df8c99']; let offset = 0; const gradient = positive.map((x, i) => { const start = offset; offset += x.amount / Math.max(1, positiveTotal) * 100; return `${colors[i % colors.length]} ${start}% ${offset}%`; }).join(','); return `<div class="cardv2-segment"><button data-spending-period="month" class="${escapeHtml(period.length === 7 ? 'active' : '')}">월별</button><button data-spending-period="year" class="${escapeHtml(period.length === 4 ? 'active' : '')}">연도별</button></div><section class="spending-hero"><div class="spending-hero-head"><span>${escapeHtml(period.length === 4 ? period + '년' : period)} 총 소비</span><button data-spending-new>＋ 지출</button></div><strong>${won(analysis.total)}</strong><small>${analysis.previousTotal ? `${period.length === 4 ? '지난해' : '지난달'} 대비 ${analysis.change > 0 ? '+' : '−'}${won(Math.abs(analysis.change))} · ${Math.abs(analysis.changeRate || 0).toFixed(1)}%` : '이전 기간 비교 기록 없음'}</small><small>구매일 기준 · 카드 원금 납부는 제외</small></section>${period.length === 7 ? `<button class="card spending-budget-card" data-spending-budget><span>${budget ? '월 생활비 목표' : '생활비 목표 설정'}</span><strong>${budget ? won(budget) : '선택 사항'}</strong>${budget ? `<small>사용 ${won(analysis.total)} · ${budget - analysis.total >= 0 ? '남음' : '초과'} ${won(Math.abs(budget - analysis.total))}</small>` : ''}</button>` : ''}<div class="cardv2-segment"><button data-spending-view="categories" class="${escapeHtml(view === 'categories' ? 'active' : '')}">카테고리별</button><button data-spending-view="items" class="${escapeHtml(view === 'items' ? 'active' : '')}">항목별</button></div>${view === 'categories' ? `<section class="card spending-card"><div class="sectionhead"><h2>카테고리별 소비</h2><button class="tinybtn" data-spending-category-manage>분류 관리</button></div>${positiveTotal ? `<div class="cardv2-donut-wrap"><div class="cardv2-donut" style="--cardv2-gradient:conic-gradient(${gradient})" role="img" aria-label="카테고리별 양수 소비 합계 ${escapeHtml(won(positiveTotal))}"><div><strong>${displayWon(positiveTotal)}</strong><small>소비 ${positive.length}개 분류</small></div></div></div>` : ''}<div class="spending-categories">${analysis.categories.map(x => `<button data-spending-category-filter="${escapeHtml(x.key)}"><span class="cardv2-category-label" style="--category-dot:${escapeHtml(x.amount > 0 ? colors[positive.indexOf(x) % colors.length] : '#8594aa')}">${escapeHtml(x.key)}<small>${x.count}건${x.amount > 0 && positiveTotal ? ' · ' + (x.amount / positiveTotal * 100).toFixed(1) + '%' : ''}</small></span><strong>${won(x.amount)}</strong><i>›</i></button>`).join('') || '<div class="integrated-empty">이 기간의 소비 기록이 없습니다.</div>'}</div>${analysis.categories.some(x => x.amount < 0) ? '<small>환불이 더 큰 분류는 음수로 표시하며 도넛에서 제외합니다.</small>' : ''}</section><section class="card spending-card"><div class="sectionhead"><h2>많이 쓴 항목 TOP 5</h2><button class="tinybtn" data-spending-view="items">전체 보기 ›</button></div>${spendingItemRows(analysis.items.slice(0, 5))}</section>` : `<div class="cardv2-filters"><button data-spending-category-filter="" class="${escapeHtml(!selectedCategory ? 'active' : '')}">전체</button>${analysis.categories.map(x => `<button data-spending-category-filter="${escapeHtml(x.key)}" class="${escapeHtml(selectedCategory === x.key ? 'active' : '')}">${escapeHtml(x.key)}</button>`).join('')}</div><section class="card spending-card"><div class="sectionhead"><h2>${escapeHtml(selectedCategory || '소비 항목')}</h2><span>${items.length}개</span></div>${spendingItemRows(items)}</section>`}<section class="card spending-split"><button data-spending-detail="fixed" data-spending-month="${escapeHtml(period)}"><span>고정비</span><strong>${won(analysis.rows.filter(x => x.fixed).reduce((sum, x) => sum + Number(x.amount || 0), 0))}</strong></button><button data-spending-detail="variable" data-spending-month="${escapeHtml(period)}"><span>변동비</span><strong>${won(analysis.rows.filter(x => !x.fixed).reduce((sum, x) => sum + Number(x.amount || 0), 0))}</strong></button></section><section class="card spending-card"><div class="sectionhead"><h2>${period.length === 4 ? '최근 6년' : '최근 6개월'} 소비</h2><button class="tinybtn" data-spending-detail="all" data-spending-month="${escapeHtml(period)}">원장 보기</button></div>${spendingTrendMarkup(analysis)}</section>`; };
function spendingItemRows(items) { return `<div class="cardv2-list">${items.map(x => `<button class="cardv2-row" data-spending-item="${escapeHtml(x.key)}"><span><strong>${escapeHtml(x.key)}</strong><small>${escapeHtml(x.category)} · ${x.count}건</small></span><b>${won(x.amount)}</b><i>›</i></button>`).join('') || '<div class="integrated-empty">해당 소비 항목이 없습니다.</div>'}</div>`; }
openIntegratedSpendingDetail = function (scope = 'all', key = '', period = spendingPeriodKey()) { const analysis = integratedSpendingAnalysis(period), rows = analysis.rows.filter(row => scope === 'fixed' ? row.fixed : scope === 'variable' ? !row.fixed : scope === 'category' ? row.category === key : true); $('#sheetEyebrow').textContent = '통합 · 소비'; $('#sheetTitle').textContent = scope === 'category' ? key : `${period} 소비 내역`; $('#sheetBody').innerHTML = `<div class="cardv2-list">${[...rows].reverse().map(row => `<button class="cardv2-row" data-spending-transaction="${escapeHtml(row.id)}"><span><strong>${escapeHtml(spendingName(row))}</strong><small>${escapeHtml(row.date)} · ${escapeHtml(row.category)}</small></span><b>${won(row.amount)}</b><i>›</i></button>`).join('') || '<div class="integrated-empty">소비 기록이 없습니다.</div>'}</div>`; openSheet('#detailSheet'); bindSpendingReview(); };
function openSpendingItemDetail(key, period = spendingPeriodKey()) { const analysis = integratedSpendingAnalysis(period), rows = analysis.rows.filter(x => spendingName(x) === key), total = rows.reduce((s, x) => s + Number(x.amount || 0), 0), trend = { ...analysis, trend: analysis.trend.map(x => ({ ...x, amount: integratedSpendingAnalysis(x.month).rows.filter(row => spendingName(row) === key).reduce((s, row) => s + Number(row.amount || 0), 0) })) }; $('#sheetEyebrow').textContent = '통합 · 소비 항목'; $('#sheetTitle').textContent = key; $('#sheetBody').innerHTML = `<section class="cardv2-estimate"><span>${escapeHtml(period)} 소비</span><strong>${won(total)}</strong><small>${rows.length}건</small></section><div class="cardv2-segment"><button data-spending-item-period="month" data-item-key="${escapeHtml(key)}" class="${escapeHtml(period.length === 7 ? 'active' : '')}">월별</button><button data-spending-item-period="year" data-item-key="${escapeHtml(key)}" class="${escapeHtml(period.length === 4 ? 'active' : '')}">연도별</button></div>${spendingTrendMarkup(trend)}<h3 class="cardv2-title">거래 내역</h3><div class="cardv2-list">${[...rows].reverse().map(row => `<button class="cardv2-row" data-spending-transaction="${escapeHtml(row.id)}"><span><strong>${escapeHtml(key)}</strong><small>${escapeHtml(row.date)} · ${row.type === 'refund' ? '환불' : escapeHtml(row.category)}</small></span><b>${won(row.amount)}</b><i>›</i></button>`).join('') || '<div class="integrated-empty">이 기간의 기록이 없습니다.</div>'}</div>`; openSheet('#detailSheet'); bindSpendingReview(); }
function bindSpendingReview() {
    $$('[data-spending-period]').forEach(b => b.onclick = async () => { setting().spendingPeriod = b.dataset.spendingPeriod; await persist(false); render(); });
    $$('[data-spending-view]').forEach(b => b.onclick = async () => { setting().spendingView = b.dataset.spendingView; setting().spendingCategoryFilter = ''; await persist(false); render(); });
    $$('[data-spending-category-filter]').forEach(b => b.onclick = async () => { setting().spendingView = 'items'; setting().spendingCategoryFilter = b.dataset.spendingCategoryFilter || ''; await persist(false); render(); });
    $$('[data-spending-item]').forEach(b => b.onclick = () => openSpendingItemDetail(b.dataset.spendingItem || ''));
    $$('[data-spending-category-manage]').forEach(b => b.onclick = () => openSpendingCategoryManagement());
    $$('[data-spending-transaction]').forEach(b => b.onclick = () => openIntegratedTransactionDetail(b.dataset.spendingTransaction || ''));
    $$('[data-spending-item-period]').forEach(b => b.onclick = () => openSpendingItemDetail(b.dataset.itemKey || '', b.dataset.spendingItemPeriod === 'year' ? integratedSelectedMonth().slice(0, 4) : integratedSelectedMonth()));
    $$('[data-spending-period-open]').forEach(b => b.onclick = async () => { const key = b.dataset.spendingPeriodOpen || ''; setting().spendingPeriod = key.length === 4 ? 'year' : 'month'; setting().integratedMonth = key.length === 4 ? key + '-01' : key; await persist(false); closeSheets({ all: true }); nav('integrated', 'spending'); });
}
