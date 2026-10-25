'use strict';
/* v0.6.4 final product polish. Existing ledgers stay untouched; this layer only reshapes views. */
let v069AssetGroup = '', v069ScheduleGroup = { summary: '', page: '' }, v069AiDraft = null;
const v069HomeCard = homeCard;
homeCard = function (id) { return v069HomeCard(id).replace('이번 달 지출·납입', '이번 달 자금 계획').replace(/기록 ([^<]+) · 남은 일정 \d+건/, '집행 $1 · 예정 ' + displayWon(homeSample().scheduled)); };
const v069OpenDetail = openDetail;
openDetail = function (type) { v069OpenDetail(type); if (type === 'contribution') {
    if ($('#sheetTitle'))
        $('#sheetTitle').textContent = '이번 달 자금 계획';
    const labels = $$('#sheetBody .sheetrow span');
    for (const label of labels) {
        if (label.textContent === '남은 일정')
            label.textContent = '예정 일정';
        if (label.textContent === '기록된 금액')
            label.textContent = '집행 금액';
        if (label.textContent === '남은 예정금액')
            label.textContent = '예정 금액';
        if (label.textContent === '이번 달 합계')
            label.textContent = '계획 합계';
    }
} };
const v069Growth = openFinancialGrowthAnalysis;
openFinancialGrowthAnalysis = function (period) { v069Growth(period); if ($('#sheetTitle'))
    $('#sheetTitle').textContent = '순금융자산 추이'; for (const span of $$('#sheetBody .finance-growth-box span'))
    if (span.textContent === '순자산 증가율')
        span.textContent = '순금융자산 증가율'; };
const v069PensionContribution = pensionContributionPage;
pensionContributionPage = function () {
    const template = document.createElement('template');
    template.innerHTML = v069PensionContribution();
    const year = localYmd().slice(0, 4), summary = pensionSummary(year), hero = template.content.querySelector('.pension-credit-hero'), goal = template.content.querySelector('.pension-goal'), monthly = template.content.querySelector('.monthly-card'), kpis = template.content.querySelector('.pension-kpis');
    template.content.querySelector('.pension-credit-year')?.remove();
    const title = hero?.querySelector('h2'), eyebrow = hero?.querySelector('.eyebrow');
    if (title && eyebrow) {
        eyebrow.textContent = title.textContent;
        title.remove();
    }
    if (kpis && hero) {
        const items = [...kpis.children], remaining = items.find(x => x.querySelector('span')?.textContent === '남은 공제한도'), credit = items.find(x => x.querySelector('span')?.textContent === '예상 세액공제'), base = items.find(x => x.querySelector('span')?.textContent === '공제 대상액');
        if (remaining) {
            remaining.className = 'pension-remaining';
            hero.appendChild(remaining);
        }
        if (goal && credit) {
            const facts = document.createElement('div');
            facts.className = 'pension-credit-facts';
            const button = document.createElement('button');
            button.className = 'pension-credit-estimate';
            button.dataset.pensionTaxProfile = '';
            button.setAttribute('aria-label', `${year} 예상 세액공제·공제율 ${(summary.creditRate * 100).toFixed(1)}% 설정`);
            button.innerHTML = credit.innerHTML + '<span aria-hidden="true">›</span>';
            facts.appendChild(button);
            goal.appendChild(facts);
        }
        if (goal && base) {
            const detail = template.content.querySelector('.pension-goal-detail');
            if (detail) {
                const info = document.createElement('div');
                info.className = 'pension-credit-detail';
                info.appendChild(base);
                const note = document.createElement('p');
                note.textContent = summary.taxProfile.configured ? '공제율·총급여는 위 예상 세액공제에서 변경할 수 있습니다.' : '총급여를 입력하면 13.2%·16.5% 공제율을 자동 적용합니다.';
                info.appendChild(note);
                detail.appendChild(info);
            }
        }
        kpis.remove();
    }
    if (hero && summary.ordinaryOverage) {
        const warning = document.createElement('div');
        warning.className = 'warningbox';
        warning.textContent = `일반 납입한도 초과 ${won(summary.ordinaryOverage)}`;
        hero.appendChild(warning);
    }
    if (goal) {
        const head = goal.querySelector('.pension-goal-head'), arrow = head?.querySelector('.pension-goal-arrow');
        if (arrow)
            arrow.textContent = `${Math.round(Math.min(100, Number(summary.goalCurrent) / Math.max(1, Number(summary.goalTotal)) * 100))}%`;
        const total = goal.querySelector('.pension-goal-total'), progress = goal.querySelector(':scope > .progress');
        if (total && progress) {
            progress.after(total);
            total.querySelector('span')?.remove();
        }
    }
    const batch = template.content.querySelector('[data-pension-contribution-batch]');
    if (batch) {
        batch.textContent = '납입 기록';
        if (monthly)
            monthly.after(batch);
    }
    const monthlyNote = monthly?.querySelector('.sectionhead small');
    if (monthlyNote)
        monthlyNote.textContent = '최근 3개월';
    if (monthly) {
        const now = Number(localYmd().slice(5, 7));
        monthly.querySelectorAll('.monthly-month').forEach((row, index) => { row.classList.toggle('recent', index + 1 <= now && index + 1 >= Math.max(1, now - 2)); const amounts = row.querySelectorAll('.monthly-row > span'); if (amounts.length === 3) {
            const details = document.createElement('details');
            details.className = 'monthly-breakdown';
            const sum = document.createElement('summary');
            sum.innerHTML = (row.querySelector('.monthly-row > strong')?.outerHTML || '') + amounts[2].outerHTML + '<span aria-hidden="true">›</span>';
            details.appendChild(sum);
            const breakdown = document.createElement('div');
            breakdown.className = 'monthly-breakdown-values';
            breakdown.innerHTML = '<span>연금저축</span>' + amounts[0].outerHTML + '<span>IRP</span>' + amounts[1].outerHTML;
            details.appendChild(breakdown);
            row.querySelector('.monthly-row')?.replaceWith(details);
        } });
    }
    return template.innerHTML;
};
const v069PensionBatch = openPensionContributionBatchForm;
openPensionContributionBatchForm = function () { v069PensionBatch(); if ($('#formTitle'))
    $('#formTitle').textContent = '월별 납입 내역 정리'; };
const v069PensionAssets = pensionAssetsPage;
pensionAssetsPage = function () { return v069PensionAssets().replace(/투자자산 · ([^<]+) 평가액/, '$1 평가액').replace('받은 배당·이자', '배당·이자 현황'); };
const v069PensionFuture = pensionFuturePage;
pensionFuturePage = function () { const template = document.createElement('template'); template.innerHTML = v069PensionFuture(); const head = template.content.querySelector('.pension-future-page>.sectionhead'); if (head) {
    head.classList.add('pension-future-toolbar');
    head.innerHTML = `<span>${pensionProjection().years > 0 ? '나이를 움직여 예상 금액을 확인하세요.' : '현재 연금자산의 월 인출 환산액입니다.'}</span><button data-pension-future-settings>계산 기준</button>`;
} return template.innerHTML; };
const v069FutureMarkup = pensionFutureSheetMarkup;
pensionFutureSheetMarkup = function () { const c = pensionFutureChartModel(), age = pensionFutureSelectedAge == null ? c.p.retirementAge : Number(pensionFutureSelectedAge), point = c.points.reduce((best, x) => Math.abs(x.age - age) < Math.abs(best.age - age) ? x : best, c.points[0]), years = Math.max(0, point.age - c.p.currentAge), real = point.value / Math.pow(1 + c.p.inflation, years), monthlyReal = real * c.p.withdrawal / 12; return v069FutureMarkup().replace(/<text class="pension-future-axis-title"[^>]*>자산금액<\/text>/, '').replace('<p>현재 자산과 월 납입액을 기준으로', `<div class="pension-future-real" id="pensionFutureRealValue">물가 반영 현재가치 · 예상자산 ${pensionReadableWon(real)} · 월연금 ${pensionReadableWon(monthlyReal)}</div><p>현재 자산과 월 납입액을 기준으로`); };
const v069UpdateFuture = updatePensionFuturePoint;
updatePensionFuturePoint = function (clientX) { v069UpdateFuture(clientX); const c = pensionFutureChartModel(), pt = c.points.find(x => x.age === pensionFutureSelectedAge); if (!pt)
    return; const years = Math.max(0, pt.age - c.p.currentAge), real = pt.value / Math.pow(1 + c.p.inflation, years), monthlyReal = real * c.p.withdrawal / 12; if ($('#pensionFutureRealValue'))
    $('#pensionFutureRealValue').textContent = `물가 반영 현재가치 · 예상자산 ${pensionReadableWon(real)} · 월연금 ${pensionReadableWon(monthlyReal)}`; };
function v069AssetDetailRow(name, value, key, verified = true) { const detail = verified || value ? won(value) : '미확인'; return `<button class="integrated-asset-row ${value ? '' : 'is-zero'} ${verified ? '' : 'is-unverified'}" data-integrated-asset="${escapeHtml(key)}"><span>${name}</span><strong>${detail}</strong><i>›</i></button>`; }
function v069AssetGroups(f) { const cash = (Number(f.cash) || 0) + (Number(f.deposit) || 0) + (Number(f.savings) || 0), investment = (Number(f.isa) || 0) + (Number(f.pension) || 0) + (Number(f.irp) || 0) + (Number(f.other) || 0), total = Math.max(1, Number(f.totalAssets) || 0), groups = [{ key: 'cash', name: '현금성 자산', value: cash, details: v069AssetDetailRow('현금·입출금', f.cash, 'cash') + v069AssetDetailRow('예금', f.deposit, 'deposit') + v069AssetDetailRow('적금·청약', f.savings, 'savings') }, { key: 'investment', name: '투자자산', value: investment, details: v069AssetDetailRow('ISA', f.isa, 'isa', f.available.isa) + v069AssetDetailRow('연금저축', f.pension, 'pension', f.available.pension) + v069AssetDetailRow('IRP', f.irp, 'irp', f.available.irp) + (f.other ? v069AssetDetailRow('기타자산', f.other, 'other') : '') }, { key: 'debt', name: '대출·부채', value: Number(f.totalDebt) || 0, details: v069AssetDetailRow('대출·부채', f.totalDebt, 'debt') }]; return groups.filter(g => g.value || g.key !== 'debt').map(g => `<div class="integrated-asset-group ${v069AssetGroup === g.key ? 'open' : ''}"><button class="integrated-asset-group-head" data-integrated-asset-group="${escapeHtml(g.key)}" aria-expanded="${escapeHtml(v069AssetGroup === g.key ? 'true' : 'false')}"><span><strong>${g.name}</strong>${g.key !== 'debt' ? `<small>${(g.value / total * 100).toFixed(1)}%</small>` : ''}</span><b>${g.key === 'debt' ? '-' : ''}${won(g.value)}</b><i>⌄</i></button><div class="integrated-asset-group-body" ${v069AssetGroup === g.key ? '' : 'hidden'}>${g.details}</div></div>`).join(''); }
function v069ScheduleMeta(kind) { if (kind === 'income')
    return ['income', '수입']; if (kind === 'insurance')
    return ['insurance', '보험']; if (kind === 'loan')
    return ['loan', '대출']; if (['investment', 'saving'].includes(kind))
    return ['saving', '저축·투자']; return ['living', '생활지출']; }
function v069ScheduleGroups(list, scope) { const order = ['card', 'insurance', 'loan', 'saving', 'living', 'income'], map = new Map(order.map(k => [k, []])); for (const row of list) {
    const [key] = row.schedule.cardPlan ? ['card', '카드'] : v069ScheduleMeta(row.schedule.kind);
    map.get(key).push(row);
} return order.flatMap(key => { const rows = map.get(key); if (!rows.length)
    return []; const label = rows[0].schedule.cardPlan ? '카드' : v069ScheduleMeta(rows[0].schedule.kind)[1], amount = rows.reduce((sum, o) => sum + scheduleOccurrenceDisplayAmount(o), 0), open = v069ScheduleGroup[scope] === key, details = rows.map(o => `<button class="schedule-row" ${scope === 'summary' ? `data-fixed-cost-item="${escapeHtml(o.schedule.id)}" data-fixed-cost-date="${escapeHtml(o.date)}"` : `data-fixed-cost-item="${escapeHtml(o.schedule.id)}" data-fixed-cost-date="${escapeHtml(o.date)}"`}><span class="schedule-copy"><strong>${escapeHtml(integratedScheduleName(o.schedule))}</strong><small>${escapeHtml(o.date)} · ${escapeHtml(o.schedule.cardPlan ? '카드' : scheduleKindLabel(o.schedule.kind))}</small></span><strong class="schedule-amount">${won(scheduleOccurrenceDisplayAmount(o))}</strong><span class="schedule-status ${o.status}">${scheduleOccurrenceUiLabel(o)}</span></button>`).join(''); return [`<div class="schedule-category ${open ? 'open' : ''}"><button class="schedule-category-head" data-schedule-category="${escapeHtml(key)}" data-schedule-scope="${escapeHtml(scope)}" aria-expanded="${escapeHtml(open ? 'true' : 'false')}"><span><strong>${label}</strong><small>${rows.length}건</small></span><b>${won(amount)}</b><i>⌄</i></button><div class="schedule-category-body" ${open ? '' : 'hidden'}>${details}</div></div>`]; }).join(''); }
const v069IntegratedSummary = integratedSummaryPage;
integratedSummaryPage = function () {
    const month = integratedSelectedMonth(), f = integratedFinancialModel(), pending = scheduleOccurrences(month).filter(o => o.status !== 'done' && o.schedule.kind !== 'income').sort((a, b) => a.date.localeCompare(b.date)), template = document.createElement('template');
    template.innerHTML = v069IntegratedSummary();
    const label = template.content.querySelector('.integrated-overview-label');
    if (label)
        label.textContent = f.isComplete ? '순금융자산 · 현재 기준' : '확인된 금융자산 · 현재 기준';
    const sub = template.content.querySelector('.integrated-overview-sub');
    if (sub)
        sub.innerHTML = `<span>${f.isComplete ? '금융자산' : '확인된 금융자산'} <strong class="${escapeHtml(amountClass(f.totalAssets))}" title="${escapeHtml(won(f.totalAssets))}">${displayWon(f.totalAssets)}</strong></span><span>${f.isComplete ? '부채' : '확인된 부채'} <strong class="${escapeHtml(amountClass(f.totalDebt))}" title="${escapeHtml(won(f.totalDebt))}">${displayWon(f.totalDebt)}</strong></span>`;
    const list = template.content.querySelector('.integrated-asset-list');
    if (list)
        list.innerHTML = v069AssetGroups(f);
    const quick = template.content.querySelector('.household-quick');
    quick?.insertAdjacentHTML('afterend', integratedSummaryEntryMarkup());
    const schedule = template.content.querySelector('[data-fixed-cost-card]'), total = pending.reduce((sum, o) => sum + scheduleOccurrenceDisplayAmount(o), 0);
    if (schedule) {
        const title = schedule.querySelector('.fixed-cost-head strong'), small = schedule.querySelector('.fixed-cost-head small'), amount = schedule.querySelector('.fixed-cost-head-right b'), body = schedule.querySelector('[data-fixed-cost-body]');
        if (title)
            title.textContent = `${integratedMonthLabel(month)} 남은 납부액`;
        if (small)
            small.textContent = pending.length ? `미완료 ${pending.length}건` : '선택한 달의 미완료 일정 없음';
        if (amount)
            amount.textContent = won(total);
        if (body) {
            body.innerHTML = pending.length ? v069ScheduleGroups(pending, 'summary') : '<div class="integrated-empty">선택한 달의 금융 일정은 모두 처리했습니다.</div>';
            body.insertAdjacentHTML('beforebegin', `<div class="fixed-cost-preview">${pending.slice(0, 3).map(o => `<button class="schedule-row" data-fixed-cost-item="${escapeHtml(o.schedule.id)}" data-fixed-cost-date="${escapeHtml(o.date)}"><span class="schedule-copy"><strong>${escapeHtml(integratedScheduleName(o.schedule))}</strong><small>${escapeHtml(o.date)}</small></span><strong class="schedule-amount">${won(scheduleOccurrenceDisplayAmount(o))}</strong></button>`).join('')}<button class="diagnostic-action" data-integrated-tab-go="schedule">일정 전체 보기 ›</button></div>`);
        }
        schedule.insertAdjacentHTML('afterend', integratedConsumptionPreview(month));
    }
    template.content.querySelector('.integrated-overview-hero')?.remove();
    template.content.querySelector('[data-integrated-assets-guard]')?.remove();
    for (const note of template.content.querySelectorAll('.source-note'))
        if (note.textContent === '입력된 계좌만 합산했습니다. 금액이 없는 계좌는 제외됩니다.')
            note.remove();
    const monthly = template.content.querySelector('.integrated-month-mini'), entry = template.content.querySelector('.household-quick');
    if (monthly && entry)
        entry.before(monthly);
    const monthHead = template.content.querySelector('.integrated-month-mini-head');
    if (monthHead) {
        const strong = monthHead.querySelector('strong'), small = monthHead.querySelector('small');
        if (strong)
            strong.textContent = `${integratedMonthLabel(month)} 현금흐름`;
        small?.remove();
    }
    const presets = template.content.querySelector('.integrated-quick-presets'), recentCard = template.content.querySelector('.integrated-recent');
    if (presets && recentCard)
        recentCard.before(presets);
    const cashLabel = template.content.querySelector('.integrated-month-mini-item.left span');
    if (cashLabel)
        cashLabel.textContent = '현금 증감';
    const recent = template.content.querySelectorAll('.integrated-recent .integrated-ledger-row');
    [...recent].slice(3).forEach(x => x.remove());
    return template.innerHTML;
};
const v069MonthDetail = openIntegratedMonthDetail;
openIntegratedMonthDetail = function (month) { v069MonthDetail(month); if ($('#sheetEyebrow'))
    $('#sheetEyebrow').textContent = '통합 · 현금흐름'; if ($('#sheetTitle'))
    $('#sheetTitle').textContent = `${integratedMonthLabel(month || integratedSelectedMonth())} 현금흐름`; const label = $('#sheetBody .integrated-month-cash span'); if (label)
    label.textContent = '현금 증감'; };
const v069SchedulePage = integratedSchedulePage;
integratedSchedulePage = function () {
    const month = integratedScheduleMonth(), occ = scheduleOccurrences(month).sort((a, b) => a.date.localeCompare(b.date)), pending = occ.filter(o => o.status !== 'done'), done = occ.filter(o => o.status === 'done').length, template = document.createElement('template');
    template.innerHTML = v069SchedulePage();
    const title = template.content.querySelector('.schedule-head h2'), small = template.content.querySelector('.schedule-head small'), pill = template.content.querySelector('.schedule-head .count-pill'), list = template.content.querySelector('.schedule-card .schedule-list');
    if (title)
        title.textContent = `${integratedMonthLabel(month)} 남은 납부액`;
    if (small)
        small.innerHTML = `<span class="schedule-payment-summary"><b>${won(pending.filter(o => o.schedule.kind !== 'income').reduce((sum, o) => sum + scheduleOccurrenceDisplayAmount(o), 0))}</b> · 납부 ${pending.filter(o => o.schedule.kind !== 'income').length}건</span>${pending.some(o => o.schedule.kind === 'income') ? '<span class="schedule-income-summary">수입 예정 ' + won(pending.filter(o => o.schedule.kind === 'income').reduce((sum, o) => sum + scheduleOccurrenceDisplayAmount(o), 0)) + ' 별도</span>' : ''}`;
    if (pill)
        pill.textContent = `완료 ${done}건`;
    const finished = occ.filter(o => o.status === 'done');
    if (list)
        list.innerHTML = `<div class="schedule-pending-list">${v069ScheduleGroups(pending, 'schedule') || '<div class="integrated-empty">선택한 달의 미완료 일정이 없어요.</div>'}</div>${finished.length ? `<details class="schedule-fold schedule-completed"><summary>완료 ${finished.length}건 보기</summary>${v069ScheduleGroups(finished, 'completed')}</details>` : ''}`;
    template.content.querySelector('.schedule-monthbar')?.remove();
    const week = template.content.querySelector('.schedule-week'), grid = template.content.querySelector('.schedule-grid');
    if (week && grid) {
        const details = document.createElement('details'), summary = document.createElement('summary');
        details.className = 'schedule-calendar-toggle';
        summary.textContent = '달력 보기';
        details.append(summary);
        week.before(details);
        details.append(week, grid);
    }
    return template.innerHTML;
};
const v069SpendingPage = integratedSpendingPage;
integratedSpendingPage = function () { const analysis = integratedSpendingAnalysis(integratedSelectedMonth()), template = document.createElement('template'); template.innerHTML = v069SpendingPage(); const budget = template.content.querySelector('[data-spending-budget]>span'), hint = template.content.querySelector('[data-spending-budget]>small'); if (budget)
    budget.textContent = '월간 생활비 기준'; if (hint && !setting().monthlyLivingBudget)
    hint.textContent = '필요할 때만 설정할 수 있습니다.'; const list = template.content.querySelector('.spending-categories'), top = analysis.categories.slice(0, 5), other = analysis.categories.slice(5); if (list && other.length) {
    list.innerHTML = top.map(row => `<button data-spending-detail="category" data-spending-key="${escapeHtml(row.key)}"><span>${escapeHtml(row.key)}<small>${row.count}건</small></span><strong>${won(row.amount)}</strong><i>›</i></button>`).join('') + `<button data-spending-detail="other"><span>기타 ${other.length}개<small>${other.reduce((n, x) => n + x.count, 0)}건</small></span><strong>${won(other.reduce((n, x) => n + x.amount, 0))}</strong><i>›</i></button>`;
} return template.innerHTML; };
secondaryActions = function () { const past = state.accounts.filter(isPastAccount).length; return `<section class="card isa-compact-manage"><div class="isa-compact-manage-row single"><strong>회차 관리</strong><button data-history-route>이전 ISA <b>${past}</b></button></div></section>`; };
const v069TransactionsPage = transactionsPage;
transactionsPage = function () { if (transactionDisplayLimit === 50)
    transactionDisplayLimit = 20; return v069TransactionsPage().replace(/(<button class="diagnostic-action" data-tx-more>다음 )\d+(건 보기 · 남은 (\d+)건<\/button>)/, (_, head, tail, remaining) => `${head}${Math.min(20, Number(remaining) || 0)}${tail}`); };
const V069_KR_HOLIDAYS = { 2026: AI_KR_MARKET_HOLIDAYS_2026 };
aiTradingDaysSince = function (value, now = new Date()) { const start = aiKoreaDate(value), end = aiKoreaDate(now); if (!start || !end)
    return Infinity; let cursor = new Date(`${start}T00:00:00Z`), finish = new Date(`${end}T00:00:00Z`), days = 0; while (cursor < finish && days < 400) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const key = cursor.toISOString().slice(0, 10), dow = cursor.getUTCDay(), holidays = V069_KR_HOLIDAYS[Number(key.slice(0, 4))];
    if (dow !== 0 && dow !== 6 && !holidays?.has(key))
        days++;
} return days; };
const v069Preflight = aiStrategyPreflight;
aiStrategyPreflight = function (payload, amount, fundingSource) { const result = v069Preflight(payload, amount, fundingSource); if (Number(localYmd().slice(0, 4)) !== 2026)
    result.warnings = result.warnings.map(x => x.replace('주말·시장 휴장일은 제외했습니다.', '등록되지 않은 연도의 휴장일은 주말 기준으로 판정했습니다.')); return result; };
function v069BindAiForm() { const form = $('#aiStrategyForm'); if (!form)
    return; $$('[data-ai-purpose]').forEach(button => button.onclick = () => { aiStrategyPurpose = button.dataset.aiPurpose || 'buy'; $$('[data-ai-purpose]').forEach(x => x.classList.toggle('active', x === button)); const rebalance = aiStrategyPurpose === 'rebalance', label = $('#aiStrategyAmountLabel'); if (label)
    label.textContent = rebalance ? '추가 투자금 (선택)' : '판단할 금액'; form.elements.namedItem('amount').placeholder = rebalance ? '0원도 가능' : '예: 3,000,000'; }); $$('[data-ai-amount]').forEach(button => button.onclick = () => { form.elements.namedItem('amount').value = button.dataset.aiAmount || ''; }); form.onsubmit = async (event) => { event.preventDefault(); const data = new FormData(form), amount = Math.max(0, Math.round(Number(data.get('amount')) || 0)), fundingSource = String(data.get('fundingSource') || 'new_money'), includedScopes = aiStrategyScopes(data.getAll('includedScope')); if (!includedScopes.length)
    return toast('분석에 포함할 계좌를 하나 이상 선택해 주세요.'); if (amount <= 0 && aiStrategyPurpose !== 'rebalance')
    return toast('판단할 금액을 입력해 주세요.'); setting().aiStrategy = { ...aiStrategySetting(), purpose: aiStrategyPurpose, fundingSource, amount, includedScopes }; if (!(await persist(false)))
    return; const built = aiStrategyFile(aiStrategyPurpose, amount, fundingSource, includedScopes); v069AiDraft = { purpose: aiStrategyPurpose, amount, fundingSource, includedScopes, ...built }; v069RenderAiReview(); }; }
function v069RenderAiReview() { const draft = v069AiDraft, q = draft.payload.dataQuality, accounts = draft.payload.isa.accounts.length + draft.payload.pensionSavings.accounts.length + draft.payload.irp.accounts.length, scopeText = draft.payload.request.includedAccountTypes, issues = q.blockers.map((x) => `<div class="warningbox"><strong>공유 전 확인</strong><br>${escapeHtml(x)}</div>`).join(''); $('#sheetBody').innerHTML = `<div class="ai-review-summary"><div><span>분석 목적</span><strong>${escapeHtml(draft.payload.request.purpose)}</strong></div><div><span>포함 계좌</span><strong>${escapeHtml(scopeText)} · ${accounts}개</strong></div><div><span>판단 금액</span><strong>${won(draft.amount)}</strong></div><div><span>판단 기간</span><strong>현재 · 중기 · 장기</strong></div></div>${issues || '<div class="source-note"><strong>요청 내용</strong><br>최신 시장 확인 → 계좌별 매수·대기·유지 판단 → 금액·수량·실행 순서</div>'}<div class="source-note">결론을 먼저 제시하고 1~3개월, 6~12개월, 3~5년 전망을 매수 판단에 연결합니다.</div><div class="ai-review-actions"><button type="button" class="form-btn primary" data-ai-share>ChatGPT에 공유하기</button><div><button type="button" class="form-btn" data-ai-edit>입력 수정</button><button type="button" class="form-btn" data-ai-download>분석파일 다운로드</button></div></div>`; $('[data-ai-edit]')?.addEventListener('click', openAiStrategy); $('[data-ai-share]')?.addEventListener('click', () => shareAiStrategyFile(draft.purpose, draft.amount, draft.fundingSource, draft.includedScopes)); $('[data-ai-download]')?.addEventListener('click', () => downloadAiStrategyFile(draft.purpose, draft.amount, draft.fundingSource, draft.includedScopes)); }
openAiStrategy = function () { const saved = aiStrategySetting(); aiStrategyPurpose = saved.purpose; v069AiDraft = null; $('#sheetEyebrow').textContent = '통합 투자자료'; $('#sheetTitle').textContent = 'AI 투자전략'; $('#sheetBody').innerHTML = aiStrategyMarkup().replace('공유하기</button>', '분석파일 만들기</button>'); openSheet('#detailSheet'); v069BindAiForm(); };
const v069BackupHub = openBackupHub;
openBackupHub = function () { v069BackupHub(); const grid = $('#sheetBody .backup-grid'), restore = grid?.querySelector('[data-backup-restore]'); if (grid && !grid.querySelector('[data-backup-csv]')) {
    const button = document.createElement('button');
    button.className = 'backup-action';
    button.dataset.backupCsv = '';
    button.innerHTML = '<strong>엑셀용 CSV 내보내기</strong><small>통합·ISA·연금 거래와 월별요약 4개 파일</small>';
    grid.insertBefore(button, restore || null);
    button.onclick = exportExcelCsvZip;
} };
const v069FinanceHub = openFinancialProductHub;
openFinancialProductHub = function (filter) { v069FinanceHub(filter); for (const small of $$('#sheetBody .finance-product-card small'))
    small.innerHTML = small.innerHTML.replace('현재 기록 잔액', '현재 잔액'); };
const v069FinanceDetail = openFinancialProductDetail;
openFinancialProductDetail = function (id) { v069FinanceDetail(id); for (const span of $$('#sheetBody .finance-product-summary span')) {
    if (span.textContent === '현재 기록 잔액')
        span.textContent = '현재 잔액';
    if (span.textContent === '현재 적용금리')
        span.textContent = '적용 금리';
} };
const v069Bind = bind;
bind = function () { v069Bind(); bindScheduleTools(); bindIntegratedSummaryEntries(); $$('[data-card-hub]').forEach(button => button.onclick = () => openCardPlansHub()); $$('[data-integrated-asset-group]').forEach(button => button.onclick = () => { v069AssetGroup = v069AssetGroup === button.dataset.integratedAssetGroup ? '' : button.dataset.integratedAssetGroup || ''; renderKeepingScroll(); }); $$('[data-schedule-category]').forEach(button => button.onclick = () => { const scope = button.dataset.scheduleScope, key = button.dataset.scheduleCategory; if (!scope || !key)
    return; v069ScheduleGroup[scope] = v069ScheduleGroup[scope] === key ? '' : key; $$('[data-schedule-category]').filter(x => x.dataset.scheduleScope === scope).forEach(x => { const open = x.dataset.scheduleCategory === v069ScheduleGroup[scope], group = x.closest('.schedule-category'), body = group?.querySelector('.schedule-category-body'); x.setAttribute('aria-expanded', String(open)); group?.classList.toggle('open', open); if (body)
    body.hidden = !open; }); }); const more = $('[data-tx-more]'); if (more)
    more.onclick = () => { transactionDisplayLimit += 20; renderKeepingScroll(); }; };
const appearanceMenu = document.querySelector('[data-profile-action="appearance"] small');
if (appearanceMenu)
    appearanceMenu.textContent = '포인트색·다크모드·터치 진동';
const v0615BackupHub = openBackupHub;
openBackupHub = function () {
    v0615BackupHub();
    const grid = $('#sheetBody .backup-grid');
    if (!grid)
        return;
    const advanced = document.createElement('details');
    advanced.className = 'source-note';
    const title = document.createElement('summary');
    title.textContent = '고급 백업 설정';
    advanced.appendChild(title);
    const body = document.createElement('div');
    body.className = 'backup-grid';
    advanced.appendChild(body);
    for (const key of ['data-backup-csv', 'data-initial-import', 'data-phone-folder', 'data-phone-now', 'data-backup-drive', 'data-backup-keep']) {
        const button = grid.querySelector('[' + key + ']');
        if (button)
            body.appendChild(button);
    }
    grid.after(advanced);
};
