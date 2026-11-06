"use strict";
/* Integrated v4.2 interaction layer.
 * UI-only: no changes to accounting, persistence, backup or schema.
 * Loaded after existing integrated/card modules and before boot.
 */
'use strict';
const ux42State = { context: '', target: 'category', period: '', category: '', item: '', kind: 'all', limit: 8 };
function ux42Node(tag, cls, textValue) {
    const node = document.createElement(tag);
    if (cls)
        node.className = cls;
    if (textValue !== undefined)
        node.textContent = String(textValue);
    return node;
}
function ux42Context() {
    return integratedSelectedMonth() + ':' + spendingPeriodMode();
}
function ux42ResetIfNeeded() {
    const context = ux42Context();
    if (ux42State.context !== context) {
        ux42State.context = context;
        ux42State.target = 'category';
        ux42State.period = spendingFocusedPeriod();
        ux42State.category = '';
        ux42State.item = '';
        ux42State.kind = 'all';
        ux42State.limit = 8;
    }
}
const ux42OldPeriodMode = spendingPeriodMode;
spendingPeriodMode = function () {
    const value = ux42OldPeriodMode();
    return value === 'half' ? 'quarter' : value === 'year' ? 'years' : value;
};
spendingPeriodControls = function () {
    return '<div class="cardv2-segment spending-period ux42-periods" aria-label="소비 조회 기간">' +
        [['month', '월'], ['quarter', '분기'], ['years', '연도']].map(function (pair) {
            return '<button data-spending-period="' + pair[0] + '" class="' + (spendingPeriodMode() === pair[0] ? 'active' : '') + '">' + pair[1] + '</button>';
        }).join('') + '</div>';
};
const ux42OldSpendingView = integratedSpendingView;
integratedSpendingView = function (anchor, mode) {
    if (mode !== 'quarter')
        return ux42OldSpendingView(anchor, mode);
    const result = ux42OldSpendingView(anchor, mode), year = String(anchor).slice(0, 4);
    const trend = [1, 2, 3, 4].map(function (q) {
        const key = year + '-Q' + q;
        return { month: key, label: q + '분기', amount: integratedSpendingAnalysis(key).total };
    });
    return { ...result, trend };
};
function ux42PeriodRows(period) {
    try {
        return integratedSpendingAnalysis(period).rows || [];
    }
    catch {
        return [];
    }
}
function ux42RowItem(row) {
    return String((row.meta && row.meta.spendingItem) || row.category || '미분류');
}
function ux42SetFocus(target, period, category, item, kind) {
    ux42ResetIfNeeded();
    ux42State.target = target;
    ux42State.period = period || spendingFocusedPeriod();
    ux42State.category = category || '';
    ux42State.item = item || '';
    ux42State.kind = kind || 'all';
    ux42State.limit = 8;
    ux42UpdateSpendingFocus();
}
function ux42UpdateSpendingFocus() {
    const chartPanel = document.querySelector('[data-ux42-chart-panel]');
    const categoryPanel = document.querySelector('[data-ux42-category-panel]');
    if (!chartPanel || !categoryPanel)
        return;
    ux42ResetIfNeeded();
    const chart = ux42State.target === 'chart';
    chartPanel.hidden = !chart;
    categoryPanel.hidden = chart;
    const host = chart ? chartPanel : categoryPanel, period = ux42State.period || spendingFocusedPeriod();
    let rows = ux42PeriodRows(period);
    if (ux42State.category)
        rows = rows.filter(function (row) { return String(row.category || '미분류') === ux42State.category; });
    if (ux42State.item)
        rows = rows.filter(function (row) { return ux42RowItem(row) === ux42State.item; });
    if (ux42State.kind === 'fixed')
        rows = rows.filter(function (row) { return Boolean(row.fixed); });
    else if (ux42State.kind === 'variable')
        rows = rows.filter(function (row) { return !row.fixed; });
    rows = [...rows].sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    const amount = rows.reduce(function (sum, row) { return sum + (Number(row.amount) || 0); }, 0);
    const caption = [spendingPeriodLabel(period), ux42State.category, ux42State.item, ux42State.kind === 'fixed' ? '고정지출' : ux42State.kind === 'variable' ? '변동비' : ''].filter(Boolean).join(' · ');
    host.replaceChildren();
    const heading = ux42Node('div', 'ux42-focus-heading');
    const left = ux42Node('div', '');
    left.append(ux42Node('strong', '', caption || '선택한 소비 내역'), ux42Node('small', '', rows.length + '건 · 원장 기준'));
    const right = ux42Node('strong', 'ux42-focus-amount', won(amount));
    heading.append(left, right);
    host.append(heading);
    if (chart || ux42State.category || ux42State.item || ux42State.kind !== 'all') {
        const clear = ux42Node('button', 'ux42-clear', '선택 해제 · 기간 전체 보기');
        clear.type = 'button';
        clear.addEventListener('click', function () { ux42SetFocus('category', spendingFocusedPeriod(), '', '', 'all'); });
        host.append(clear);
    }
    if (ux42State.item) {
        const detail = ux42Node('button', 'ux42-item-detail', '항목 상세 · 이름·분류 수정');
        detail.type = 'button';
        detail.addEventListener('click', function () { openSpendingItemDetail(ux42State.item, period, 'summary', ux42State.category); });
        host.append(detail);
    }
    const body = ux42Node('div', 'ux42-focus-rows');
    if (!rows.length)
        body.append(ux42Node('p', 'ux42-empty', '선택한 범위에 거래가 없습니다.'));
    let previous = '';
    for (const row of rows.slice(0, ux42State.limit)) {
        if (row.date !== previous) {
            previous = String(row.date || '');
            body.append(ux42Node('div', 'ux42-date', previous));
        }
        const button = ux42Node('button', 'ux42-tx-row');
        button.type = 'button';
        button.dataset.ux42Tx = String(row.id || '');
        if (!row.id)
            button.disabled = true;
        const copy = ux42Node('span', '');
        copy.append(ux42Node('strong', '', ux42RowItem(row)), ux42Node('small', '', String(row.category || '미분류') + (row.type === 'refund' ? ' · 환불' : '')));
        button.append(copy, ux42Node('b', '', won(Number(row.amount) || 0)));
        button.addEventListener('click', function () { if (row.id)
            openIntegratedTransactionDetail(String(row.id)); });
        body.append(button);
    }
    host.append(body);
    if (rows.length > ux42State.limit) {
        const more = ux42Node('button', 'ux42-more', '20건 더 보기 · ' + ux42State.limit + ' / ' + rows.length + '건');
        more.type = 'button';
        more.addEventListener('click', function () { ux42State.limit += 20; ux42UpdateSpendingFocus(); });
        host.append(more);
    }
    document.querySelectorAll('[data-ux42-category]').forEach(function (button) {
        const selected = !chart && ux42State.category === button.dataset.ux42Category && !ux42State.item && ux42State.kind === 'all';
        button.classList.toggle('selected', selected);
        button.setAttribute('aria-pressed', String(selected));
    });
    document.querySelectorAll('[data-ux42-item]').forEach(function (button) {
        button.classList.toggle('selected', !chart && ux42State.item === button.dataset.ux42Item && ux42State.category === button.dataset.ux42ItemCategory);
    });
}
function ux42AddCategory(container, category) {
    const button = ux42Node('button', 'ux42-category-row');
    button.type = 'button';
    button.dataset.ux42Category = category.key;
    button.setAttribute('aria-pressed', 'false');
    const label = ux42Node('span', 'ux42-category-label');
    label.append(ux42Node('strong', '', category.key), ux42Node('small', '', category.count + '건'));
    button.append(label, ux42Node('b', '', won(category.amount)));
    button.addEventListener('click', function () { ux42SetFocus('category', spendingFocusedPeriod(), category.key, '', 'all'); });
    container.append(button);
}
function ux42DecorateSpending() {
    const review = document.querySelector('.spending-review');
    if (!review)
        return;
    ux42ResetIfNeeded();
    // Replace both legacy lists with one category/item browser.
    review.querySelectorAll('.spending-view,.spending-card,.cardv2-filters,.spending-year-views').forEach(function (node) { node.remove(); });
    const hero = review.querySelector('.spending-hero');
    hero?.querySelector('[data-spending-new]')?.remove();
    const hint = review.querySelector('.spending-chart-window');
    if (hint)
        hint.textContent = spendingPeriodMode() === 'quarter' ? '분기를 누르면 아래에서 거래 확인' : spendingPeriodMode() === 'years' ? '연도를 누르면 아래에서 거래 확인' : '그래프를 누르면 해당 날짜의 거래 확인';
    // Keep the date picker as an optional keyboard/touch alternative.
    const picker = review.querySelector('.spending-day-picker');
    if (picker) {
        const fold = ux42Node('details', 'ux42-date-picker');
        fold.append(ux42Node('summary', '', '날짜 직접 선택'));
        picker.replaceWith(fold);
        fold.append(picker);
    }
    const selectedDetail = review.querySelector('[data-spending-selected-detail]');
    if (selectedDetail)
        selectedDetail.textContent = '거래 보기';
    const analysis = integratedSpendingAnalysis(spendingFocusedPeriod());
    const categoryCard = ux42Node('section', 'card ux42-category-card');
    const title = ux42Node('div', 'ux42-title-row');
    title.append(ux42Node('h2', '', '소비 내역'));
    const manage = ux42Node('button', 'tinybtn', '분류 관리');
    manage.type = 'button';
    manage.addEventListener('click', function () { openSpendingCategoryManagement(); });
    title.append(manage);
    categoryCard.append(title);
    const view = setting().spendingView === 'items' ? 'items' : 'categories';
    const switcher = ux42Node('div', 'cardv2-segment ux42-views');
    switcher.setAttribute('aria-label', '소비 내역 보기');
    for (const [key, label] of [['categories', '카테고리별'], ['items', '항목별']]) {
        const button = ux42Node('button', view === key ? 'active' : '', label);
        button.type = 'button';
        button.dataset.ux42View = key;
        button.setAttribute('aria-pressed', String(view === key));
        button.addEventListener('click', function () {
            setting().spendingView = key;
            rememberViewPreferences();
            render();
        });
        switcher.append(button);
    }
    categoryCard.append(switcher);
    const list = ux42Node('div', 'ux42-category-list');
    list.hidden = view !== 'categories';
    analysis.categories.forEach(function (category) { ux42AddCategory(list, category); });
    if (!analysis.categories.length)
        list.append(ux42Node('p', 'ux42-empty', '선택한 기간의 소비 기록이 없습니다.'));
    categoryCard.append(list);
    const items = ux42Node('div', 'ux42-item-list');
    items.hidden = view !== 'items';
    [...analysis.items].sort(function (a, b) { return b.amount - a.amount; }).forEach(function (item) {
        const b = ux42Node('button', 'ux42-item-row');
        b.type = 'button';
        b.dataset.ux42Item = item.key;
        b.dataset.ux42ItemCategory = item.category;
        const left = ux42Node('span', '');
        left.append(ux42Node('strong', '', item.key), ux42Node('small', '', item.category + ' · ' + item.count + '건'));
        b.append(left, ux42Node('b', '', won(item.amount)));
        b.addEventListener('click', function () { ux42SetFocus('category', spendingFocusedPeriod(), item.category, item.key, 'all'); });
        items.append(b);
    });
    if (!analysis.items.length)
        items.append(ux42Node('p', 'ux42-empty', '선택한 기간의 소비 기록이 없습니다.'));
    categoryCard.append(items);
    const split = review.querySelector('.spending-split');
    if (split)
        split.after(categoryCard);
    else
        hero?.after(categoryCard);
    const chartPanel = ux42Node('section', 'card ux42-chart-focus');
    chartPanel.dataset.ux42ChartPanel = '';
    chartPanel.hidden = true;
    chartPanel.setAttribute('aria-live', 'polite');
    const categoryPanel = ux42Node('section', 'card ux42-category-focus');
    categoryPanel.dataset.ux42CategoryPanel = '';
    categoryPanel.setAttribute('aria-live', 'polite');
    categoryCard.after(chartPanel, categoryPanel);
    review.querySelectorAll('.spending-split [data-spending-detail]').forEach(function (button) {
        button.onclick = function () { ux42SetFocus('category', spendingFocusedPeriod(), '', '', button.dataset.spendingDetail === 'fixed' ? 'fixed' : 'variable'); };
    });
    review.querySelectorAll('[data-spending-selected-detail]').forEach(function (button) {
        button.onclick = function () {
            const period = button.dataset.spendingSelectedDetail || spendingFocusedPeriod();
            ux42SetFocus('chart', period, '', '', 'all');
        };
    });
    ux42UpdateSpendingFocus();
}
const ux42OldSelectChartPoint = selectSpendingChartPoint;
selectSpendingChartPoint = function (chart, button) {
    ux42OldSelectChartPoint(chart, button);
    if (chart && chart.hasAttribute('data-spending-linked') && route().root === 'integrated' && route().tab === 'spending') {
        ux42SetFocus('chart', button.dataset.spendingSelect || spendingFocusedPeriod(), '', '', 'all');
    }
};
function ux42DecorateSummary() {
    document.querySelectorAll('.cardv2-entry').forEach(function (node) { node.remove(); });
    const quick = document.querySelector('.household-quick');
    if (quick) {
        const wrapper = ux42Node('details', 'ux42-manage-fold');
        wrapper.append(ux42Node('summary', '', '잔액 맞추기 · 관리 도구'));
        const action = quick.querySelector('[data-cash-reconcile]');
        if (action)
            wrapper.append(action);
        quick.replaceWith(wrapper);
    }
    const presets = document.querySelector('.integrated-quick-presets');
    if (presets) {
        const fold = ux42Node('details', 'ux42-presets-fold');
        fold.append(ux42Node('summary', '', '자주 쓰는 기록 펼치기'));
        presets.replaceWith(fold);
        fold.append(presets);
    }
    const preview = document.querySelector('.integrated-consumption-preview');
    if (preview && !preview.querySelector('.ux42-mini-trend')) {
        const month = integratedSelectedMonth(), analysis = integratedSpendingAnalysis(month);
        const trend = analysis.trend || [], max = Math.max(1, ...trend.map(function (x) { return Math.abs(Number(x.amount) || 0); }));
        const area = ux42Node('div', 'ux42-mini-trend');
        const title = ux42Node('small', '', '최근 6개월 소비 추이 · 막대를 누르면 금액 확인');
        area.append(title);
        const bars = ux42Node('div', 'ux42-mini-bars'), readout = ux42Node('div', 'ux42-mini-readout', won(analysis.total));
        for (const point of trend) {
            const b = ux42Node('button', 'ux42-mini-bar');
            b.type = 'button';
            b.setAttribute('aria-label', point.label + ' 소비 ' + won(point.amount));
            const bar = ux42Node('i', '');
            bar.style.height = Math.max(3, Math.abs(Number(point.amount) || 0) / max * 100) + '%';
            b.append(bar, ux42Node('small', '', point.label));
            b.addEventListener('click', function () {
                bars.querySelectorAll('button').forEach(function (n) { n.classList.remove('active'); });
                b.classList.add('active');
                readout.textContent = point.label + ' · ' + won(point.amount);
            });
            bars.append(b);
        }
        area.append(bars, readout);
        preview.append(area);
    }
}
function ux42EntryBack(form) {
    if (form.querySelector('.ux42-back'))
        return;
    const back = ux42Node('button', 'ux42-back', '‹ 카드 구매·다른 입력');
    back.type = 'button';
    form.prepend(back);
    back.addEventListener('click', function () {
        const doBack = function () { sheetDirty = false; ux42OpenEntryMenu(); };
        if (sheetDirty)
            showDialog({ title: '입력을 취소할까요?', message: '저장하지 않은 입력은 사라집니다.', confirmText: '입력 종류로', cancelText: '계속 입력' }, doBack);
        else
            doBack();
    });
}
const ux42PreviousTransaction = openIntegratedTransactionForm;
openIntegratedTransactionForm = function (id, preset) {
    ux42PreviousTransaction(id, preset);
    const form = document.querySelector('#formSheet.open #integratedTxForm.integrated-entry');
    if (!id && form)
        ux42EntryBack(form);
};
function ux42OpenTransaction(type) {
    openIntegratedTransactionForm('', { uiType: type });
}
function ux42OpenEntryMenu() {
    document.querySelector('#sheetEyebrow').textContent = '통합 · 입력';
    document.querySelector('#sheetTitle').textContent = '새 기록 입력';
    const body = document.querySelector('#sheetBody');
    body.replaceChildren();
    const intro = ux42Node('p', 'ux42-entry-hint', '새 기록을 추가합니다. 이미 발생한 카드값·보험·대출 납부는 해당 청구·일정에서 처리해요.');
    body.append(intro);
    const choices = [
        ['지출', '현금·체크카드 등 생활비 기록', 'expense'],
        ['수입', '급여·기타 수입을 추가', 'income'],
        ['저축·투자', '계좌 간 납입·이체를 기록', 'saving'],
        ['카드 구매', '신용카드 일시불·할부 기록', 'card'],
        ['납부 일정 보기', '보험·대출·저축 납부는 해당 기록에서', 'schedule']
    ];
    for (const choice of choices) {
        const button = ux42Node('button', 'ux42-entry-choice');
        button.type = 'button';
        button.dataset.ux42Choice = choice[2];
        const left = ux42Node('span', '');
        left.append(ux42Node('strong', '', choice[0]), ux42Node('small', '', choice[1]));
        button.append(left, ux42Node('b', '', '›'));
        button.addEventListener('click', function () {
            if (choice[2] === 'card')
                openCardPurchaseForm();
            else if (choice[2] === 'schedule') {
                closeSheets({ all: true });
                nav('integrated', 'schedule');
            }
            else
                ux42OpenTransaction(choice[2] === 'income' ? 'externalIncome' : choice[2] === 'saving' ? 'savingInvestment' : 'lifeExpense');
        });
        body.append(button);
    }
    openSheet('#detailSheet');
}
function ux42UpgradePurchase(id) {
    const form = document.querySelector('#formSheet.open .card-purchase-form');
    if (!form)
        return;
    if (!id)
        ux42EntryBack(form);
    const months = form.elements.namedItem('months');
    const interest = form.elements.namedItem('interestMode');
    const rate = form.elements.namedItem('annualRate');
    const rounds = form.elements.namedItem('paidRounds');
    if (!months || !interest || !rounds)
        return;
    if (!id) {
        months.value = '1';
        interest.value = 'free';
        months.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const field = rounds.closest('.field');
    const picker = ux42Node('div', 'ux42-round-picker');
    if (field && !field.querySelector('.ux42-round-picker'))
        field.append(picker);
    const note = ux42Node('small', 'ux42-interest-hint', '이율을 모르면 예상 이자는 미확정 상태로 두고, 명세서에서 실제 청구이자를 입력해요.');
    const rateField = rate?.closest('.field');
    if (rateField)
        rateField.append(note);
    const refresh = function () {
        const n = Number(months.value) || 1, partial = interest.value === 'partial';
        if (n === 1 && interest.value !== 'free') {
            interest.value = 'free';
            interest.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const interestField = interest.closest('.field');
        if (interestField)
            interestField.hidden = n === 1;
        picker.hidden = !partial || n === 1;
        note.hidden = n === 1 || interest.value === 'free' || Number(rate?.value) > 0;
        if (picker.hidden)
            return;
        picker.replaceChildren(ux42Node('small', 'ux42-round-label', '본인이 이자를 내는 회차 · 여러 개 선택'));
        const selected = new Set(String(rounds.value || '').split(',').map(function (x) { return Number(x.trim()); }).filter(function (x) { return x > 0; }));
        for (let i = 1; i <= Math.min(n, 12); i++) {
            const b = ux42Node('button', 'ux42-round' + (selected.has(i) ? ' active' : ''), i + '회');
            b.type = 'button';
            b.setAttribute('aria-pressed', String(selected.has(i)));
            b.addEventListener('click', function () {
                if (selected.has(i))
                    selected.delete(i);
                else
                    selected.add(i);
                rounds.value = [...selected].sort(function (a, b) { return a - b; }).join(',');
                rounds.dispatchEvent(new Event('input', { bubbles: true }));
                refresh();
            });
            picker.append(b);
        }
        if (n > 12)
            picker.append(ux42Node('small', 'ux42-round-note', '13회차 이상은 위의 회차 입력란에서 직접 지정'));
    };
    interest.addEventListener('change', refresh);
    months.addEventListener('change', refresh);
    rounds.addEventListener('input', refresh);
    rate?.addEventListener('input', refresh);
    refresh();
}
const ux42PreviousPurchase = openCardPurchaseForm;
openCardPurchaseForm = function (id) {
    ux42PreviousPurchase(id);
    ux42UpgradePurchase(id || '');
};
function ux42DecorateSchedule() {
    const list = document.querySelector('.schedule-pending-list');
    if (!list)
        return;
    const title = ux42Node('p', 'ux42-schedule-hint', '미완료 항목은 해당 행을 눌러 납부합니다. 완료 기록은 아래에서 확인해요.');
    list.prepend(title);
}
const ux42PreviousBind = bind;
bind = function () {
    ux42PreviousBind();
    if (route().root !== 'integrated')
        return;
    const shell = document.querySelector('.integrated-module-shell');
    if (!shell)
        return;
    const tabs = shell.querySelector('.integrated-tabs');
    if (tabs && !shell.querySelector('.ux42-common-action')) {
        const actions = ux42Node('div', 'ux42-common-action');
        actions.append(ux42Node('span', '', route().tab === 'spending' ? '현금·체크카드 지출 기록' : '새 기록 입력 · 납부는 해당 일정에서'));
        const button = ux42Node('button', 'ux42-add', '＋ 입력');
        button.type = 'button';
        if (route().tab === 'spending') {
            button.textContent = '＋ 지출';
            button.addEventListener('click', function () { ux42OpenTransaction('lifeExpense'); });
        }
        else
            button.addEventListener('click', ux42OpenEntryMenu);
        actions.append(button);
        tabs.after(actions);
    }
    const tab = route().tab;
    if (tab === 'ledger')
        shell.querySelectorAll('[data-integrated-new]').forEach(function (node) { node.remove(); });
    if (tab === 'spending')
        ux42DecorateSpending();
    if (tab === 'summary')
        ux42DecorateSummary();
    if (tab === 'schedule')
        ux42DecorateSchedule();
};
