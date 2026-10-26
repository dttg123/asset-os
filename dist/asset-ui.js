/* asset-os source: core-visual-utils.js */
'use strict';
function getHolding(a, id) { return accountMetrics(a).holdings.find((h) => h.id === id); }
function holdingName(a, id) { return a.holdings.find((h) => h.id === id)?.name || '계좌 현금'; }
function formatDate(d) { if (!d)
    return '-'; const [y, m, day] = String(d).split('-'); return `${y}.${m}.${day}`; }
function quantityNumber(value, maxDigits = 6) { const n = Number(value) || 0; return new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: maxDigits }).format(n); }
function daysUntil(d) { if (!d)
    return null; const [y, m, day] = String(d).split('-').map(Number), todayParts = String(typeof localYmd === 'function' ? localYmd() : '').split('-').map(Number), now = todayParts.length === 3 && todayParts.every(Number.isFinite) ? new Date(todayParts[0], todayParts[1] - 1, todayParts[2]) : new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate()), target = new Date(y, m - 1, day); return Math.ceil((target.getTime() - today.getTime()) / 86400000); }
function ddayLabel(d) { const left = daysUntil(d); if (left === null)
    return '-'; if (left > 0)
    return `D-${left}`; if (left === 0)
    return 'D-DAY'; return `D+${Math.abs(left)}`; }
function polarToCartesian(cx, cy, r, angleDeg) { const rad = (angleDeg - 90) * Math.PI / 180; return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }; }
function describeArcPath(cx, cy, r, startPct, endPct) { const startAngle = startPct / 100 * 360, endAngle = endPct / 100 * 360, span = endAngle - startAngle; if (span >= 359.99) {
    const p1 = polarToCartesian(cx, cy, r, startAngle), p2 = polarToCartesian(cx, cy, r, startAngle + 180);
    return `M ${p1.x.toFixed(3)} ${p1.y.toFixed(3)} A ${r} ${r} 0 1 1 ${p2.x.toFixed(3)} ${p2.y.toFixed(3)} A ${r} ${r} 0 1 1 ${p1.x.toFixed(3)} ${p1.y.toFixed(3)}`;
} const start = polarToCartesian(cx, cy, r, endAngle), end = polarToCartesian(cx, cy, r, startAngle), largeArcFlag = span <= 180 ? 0 : 1; return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`; }
function assetDonutSvg(segments, selected = '', dataset = 'data-donut-group', ariaLabel = '자산군 구성') { return `<svg class="donut-svg" viewBox="0 0 100 100" role="img" aria-label="${escapeHtml(ariaLabel)}">${segments.map(x => { const key = x.key || x.name, is = key === selected; return `<g class="donut-segment ${is ? 'selected' : selected ? 'dimmed' : ''}" ${dataset}="${escapeHtml(key)}"><title>${escapeHtml(x.name)} ${x.pct.toFixed(1)}%</title><path d="${escapeHtml(describeArcPath(50, 50, 38, x.start, x.end))}" fill="none" stroke="${escapeHtml(x.color)}" stroke-width="20" stroke-linecap="butt"/></g>`; }).join('')}</svg>`; }
function formValidationMarkup() { return '<div class="form-validation-message" data-form-error role="alert" aria-live="polite" hidden></div>'; }
function formValidationFieldName(message = '') { const text = String(message); if (/날짜|개설일|종료일|만기/.test(text))
    return 'date'; if (/수량/.test(text))
    return 'qty'; if (/단가|평단/.test(text))
    return 'price'; if (/수수료|세금/.test(text))
    return 'fee'; if (/원금/.test(text))
    return 'principal'; if (/이자/.test(text))
    return 'interest'; if (/종목명/.test(text))
    return 'newName'; if (/금액|수령액|현금|잔액|납입한도/.test(text))
    return 'amount'; return ''; }
function formClearError(form) { if (!form)
    return; const box = form.querySelector('[data-form-error]'); if (box) {
    box.textContent = '';
    box.hidden = true;
} form.classList?.remove('has-validation-error'); for (const field of form.querySelectorAll('[aria-invalid="true"]')) {
    field.removeAttribute('aria-invalid');
    field.closest?.('.field')?.classList.remove('has-error');
} return false; }
function formShowError(form, message = '', fieldName = '') { if (!form || !message)
    return formClearError(form); formClearError(form); const box = form.querySelector('[data-form-error]'); if (box) {
    box.textContent = String(message);
    box.hidden = false;
} form.classList?.add('has-validation-error'); const name = fieldName || formValidationFieldName(message), field = (name ? form.elements.namedItem(name) : null) || (name === 'date' ? form.elements.namedItem('tradeDate') : null); if (field && 'setAttribute' in field) {
    field.setAttribute('aria-invalid', 'true');
    field.closest('.field')?.classList.add('has-error');
} return true; }
function isaContributionRowsForStore(a, store = integratedStore(), throughDate = localYmd()) {
    const accounts = store?.accounts || [], rows = [];
    for (const t of store?.ledger || []) {
        if (t.meta?.analysisOnly || isQaIntegratedFixture(t) || !['internalTransfer', 'externalAssetIn'].includes(t.type) || String(t.date || '') > throughDate)
            continue;
        if (accounts.find(x => x.id === t.toAccountId)?.kind !== 'isa')
            continue;
        const dated = state.accounts.filter(x => isaAccountActiveOnDate(x, t.date)), explicit = String(t.meta?.targetIsaAccountId || ''), resolved = explicit && dated.some(x => x.id === explicit) ? explicit : (dated.length === 1 ? dated[0].id : '');
        if (resolved === a.id)
            rows.push(t);
    }
    return rows;
}
function isaContributionModel(a, asOf = localYmd(), store = integratedStore()) {
    const p = policy('isa', a), annualLimit = Math.max(0, Number(p.annualLimit) || 0), totalLimit = Math.max(annualLimit, Number(p.totalContributionLimit) || 100000000), opened = String(a?.openedAt || a?.baselineDate || asOf), closed = String(a?.closedAt || ''), end = closed && closed < asOf ? closed : asOf, openedYear = Number(opened.slice(0, 4)), endYear = Number(end.slice(0, 4)), eligibleYears = Number.isFinite(openedYear) && Number.isFinite(endYear) ? Math.max(1, endYear - openedYear + 1) : 1, accruedLimit = Math.min(totalLimit, annualLimit * eligibleYears), baselineDate = String(a?.baselineDate || a?.baseline?.date || opened), baseline = Math.max(0, Number(a?.baselineContribution ?? a?.baseline?.contribution) || 0), rows = isaContributionRowsForStore(a, store, asOf).filter(t => String(t.date || '') > baselineDate), lifetimePaid = baseline + rows.reduce((sum, t) => sum + (Number(t.amount) || 0), 0), year = String(asOf).slice(0, 4), currentRows = rows.filter(t => String(t.date || '').startsWith(year)), knownBaseline = String(a?.contributionBaselineYear || '') === year ? Math.max(0, Number(a?.contributionBaseline) || 0) : 0, currentYearPaid = knownBaseline + currentRows.reduce((sum, t) => sum + (Number(t.amount) || 0), 0), remaining = Math.max(0, accruedLimit - lifetimePaid);
    return { year, annualLimit, totalLimit, eligibleYears, accruedLimit, baseline, lifetimePaid, currentYearPaid, remaining, overage: Math.max(0, lifetimePaid - accruedLimit), carryoverAvailable: Math.max(0, remaining - Math.max(0, annualLimit - currentYearPaid)) };
}
function annualContributionTotal(a) { return isPastAccount(a) ? Number(a.annualContribution || 0) : isaContributionModel(a).currentYearPaid; }
function addYears(dateString, years) { const value = String(dateString || ''), m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m)
    return value; const y = Number(m[1]) + Math.trunc(Number(years) || 0), mi = Number(m[2]) - 1, day = Math.min(Number(m[3]), new Date(y, mi + 1, 0).getDate()); return `${y}-${String(mi + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; }
;
/* asset-os source: home.js */
"use strict";
'use strict';
function route() { const p = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean); return { root: p[0] || 'home', tab: p[1] || 'summary' }; }
function resetTransientPanels() { pensionMonthsExpanded = false; integratedAssetsExpanded = false; integratedFixedCostsExpanded = false; dividendAnalysisExpanded = false; pensionIncomeAnalysisExpanded = false; pensionAssetAnalysisExpanded = false; dividendDisplayLimit = 50; pensionIncomeAnalysisMode = 'month'; pensionIncomeSelectedPoint = ''; pensionAnalysisMode = 'trend'; pensionAnalysisPeriod = '1y'; pensionAnalysisSelectedKey = ''; }
function nav(root, tab = 'summary') { const fromSheet = $$('.sheet.open').length > 0; if (fromSheet)
    closeSheets({ all: true }); if (typeof cancelSheetBackForNavigation === 'function')
    cancelSheetBackForNavigation(); resetTransientPanels(); const next = root === 'home' ? '#/home' : `#/${root}/${tab}`; if (fromSheet) {
    history.replaceState(null, '', next);
    render();
    window.scrollTo(0, 0);
}
else if (location.hash === next) {
    render();
    window.scrollTo(0, 0);
}
else
    location.hash = next; }
function moduleIcon(id) { const paths = { isa: '<path d="M4 18V10m6 8V6m6 12v-5m-13 8h18"/>', pension: '<path d="M5 9h14v11H5z"/><path d="M8 9V7a4 4 0 0 1 8 0v2"/><path d="M9 14h6"/>', cash: '<path d="M4 7h15a2 2 0 0 1 2 2v9H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12"/><path d="M16 12h5"/>', contribution: '<path d="M5 7h14M5 12h10M5 17h7"/><path d="M18 15v6m-3-3h6"/>', alerts: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>' }; return `<svg viewBox="0 0 24 24">${paths[id] || paths.alerts}</svg>`; }
function activeMetrics() { const accounts = state.accounts.filter(isCurrentAccount), metrics = accounts.map(accountMetrics), value = metrics.reduce((sum, m) => sum + m.value, 0), cost = metrics.reduce((sum, m) => sum + m.cost, 0), profit = metrics.reduce((sum, m) => sum + m.profit, 0); return { accounts, holdings: metrics.flatMap(m => m.holdings.filter(h => Number(h.qty) > 1e-8)), cash: metrics.reduce((sum, m) => sum + m.cash, 0), holdingsValue: metrics.reduce((sum, m) => sum + m.holdingsValue, 0), value, cost, profit, unrealized: metrics.reduce((sum, m) => sum + m.unrealized, 0), realized: metrics.reduce((sum, m) => sum + m.realized, 0), income: metrics.reduce((sum, m) => sum + m.income, 0), rate: cost ? profit / cost * 100 : 0 }; }
function homeMonthActivity(month = localYmd().slice(0, 7)) { const rows = integratedLedger().filter(t => integratedMonthKey(t.date) === month), accounts = new Map(integratedStore().accounts.map(a => [a.id, a])), sum = (fn) => rows.filter(fn).reduce((n, t) => n + (Number(t.amount) || 0), 0), living = sum(t => ['expense', 'externalExpense'].includes(t.type || '')), saving = sum(t => ['internalTransfer', 'externalAssetIn'].includes(t.type || '') && ['isa', 'pension', 'irp', 'deposit', 'savings'].includes(accounts.get(t.toAccountId)?.kind || '')), loan = sum(t => ['debtInterest', 'debtInterestExternal', 'debtPrincipal', 'externalDebtPrincipal'].includes(t.type || '')), other = sum(t => ['externalWithdrawal', 'externalAssetOut'].includes(t.type || '')), remaining = scheduleOccurrences(month).filter(o => o.status !== 'done' && o.schedule.kind !== 'income'); return { month, rows, living, saving, loan, other, total: living + saving + loan + other, remaining, remainingAmount: remaining.reduce((n, o) => n + (Number(o.schedule.amount) || 0), 0) }; }
function homeSample() { const am = activeMetrics(), month = pensionCurrentMonthOrdinary(), isaMonth = isaCurrentMonthContribution(), activity = homeMonthActivity(), pm = pensionAssetMetrics('all'), fm = integratedFinancialModel(), total = fm.totalAssets, totalChange = 0, kisPension = fm.currentSources.pension === 'kis' || fm.currentSources.irp === 'kis', mixedPension = fm.currentSources.pension !== fm.currentSources.irp; return { total, debt: fm.totalDebt, totalChange, totalRate: 0, isa: fm.isa, isaSource: fm.currentSources.isa, pension: fm.pension + fm.irp, cash: fm.cash + fm.deposit + fm.savings + fm.other, isaProfit: fm.available?.isa ? am.profit : 0, pensionProfit: (fm.available?.pension || fm.available?.irp || kisPension) ? pm.profit : 0, isaRate: fm.available?.isa ? am.rate : 0, pensionRate: (fm.available?.pension || fm.available?.irp || kisPension) ? pm.rate : 0, pensionSource: mixedPension ? 'mixed' : kisPension ? 'kis' : (fm.verified.pension || fm.verified.irp) ? 'asset-os' : 'linked', contributed: activity.saving, outgoing: activity.total, scheduled: activity.remainingAmount, pensionMonth: month, activity }; }
function nearestMaturityAlert() { const list = state.accounts.filter(a => isCurrentAccount(a) && a.maturityAt).sort((a, b) => String(a.maturityAt).localeCompare(String(b.maturityAt))), a = list[0]; if (!a)
    return null; return { account: a, label: a.status === 'maturity_pending' ? '처리 대기' : ddayLabel(a.maturityAt), date: String(a.maturityAt).slice(0, 7).replace('-', '.'), days: daysUntil(a.maturityAt) }; }
function homeInvestmentRefreshMarkup() { const refresh = investmentRefreshStatus(), names = { isa: 'ISA 시세', pension: '연금저축 잔고·내역', irp: 'IRP 잔고·내역' }, retry = refresh.errors.length > 0, result = refresh.attempt ? `${formatDateTime(refresh.attempt)} · ${retry ? '일부 실패' : '갱신 완료'}` : refresh.last ? `최근 자료 ${formatDateTime(refresh.last)}` : '갱신 기록 없음'; return `<section class="manual-refresh-row home-investment-refresh"><div><strong>투자계좌 갱신${retry ? ' · 확인 필요' : ''}</strong><small class="refresh-scope-note">ISA는 시세만 · 연금저축·IRP는 잔고·내역 조회</small><small data-refresh-result>${escapeHtml(result)}</small><details class="refresh-account-times"><summary>계좌별 자료 시각</summary>${refresh.accounts.map(row => `<small>${escapeHtml(names[row.kind] || row.kind)} · ${row.at ? escapeHtml(formatDateTime(row.at)) : '갱신 자료 없음'}${refresh.errors.includes(row.kind) ? ' · 실패' : ''}</small>`).join('')}</details></div><button ${retry ? 'data-investment-refresh-failed' : 'data-investment-refresh-all'}>${retry ? '실패만 재시도' : '전체 갱신'}</button></section>`; }
function homePreviousMonthEnd(date = localYmd()) { const [year, month] = date.slice(0, 7).split('-').map(Number); return localYmd(new Date(year, month - 1, 0, 12)); }
function homeMonthChange() { const end = localYmd(), result = financialGrowthBreakdown(homePreviousMonthEnd(end), end), available = !!result.start?.coverage?.complete && !!result.end?.coverage?.complete; return { available, netChange: Number(result.netChange) || 0, externalNet: Number(result.externalNet) || 0, marketOther: (Number(result.adjustment) || 0) + (Number(result.residual) || 0) }; }
function addMonthsToYmd(date, months) { const [year, month, day] = date.split('-').map(Number), target = new Date(year, month - 1 + months, 1, 12), last = new Date(target.getFullYear(), target.getMonth() + 1, 0, 12).getDate(); return localYmd(new Date(target.getFullYear(), target.getMonth(), Math.min(day, last), 12)); }
function homeFinancialAlerts() { const today = localYmd(), alerts = []; for (const product of activeFinancialProducts()) {
    const maturity = String(product.maturityDate || ''), maturityDays = maturity ? daysUntil(maturity) : 9999;
    if (maturity && maturityDays <= 30)
        alerts.push({ title: `${product.name} ${maturityDays < 0 ? '만기 확인 필요' : maturityDays === 0 ? '오늘 만기' : `만기 D-${maturityDays}`}`, detail: `${maturity} · ${product.type === 'loan' ? '대출' : '예적금'} 확인`, kind: 'finance', productId: String(product.id) });
    if (product.rateType === 'variable' && Number(product.rateChangeMonths) > 0) {
        const latest = String(product.rateHistory?.at(-1)?.effectiveFrom || product.startDate || ''), next = latest ? addMonthsToYmd(latest, Number(product.rateChangeMonths)) : '';
        if (next && daysUntil(next) <= 30)
            alerts.push({ title: `${product.name} 금리 재확인`, detail: `변동금리 확인 예정 ${next}`, kind: 'finance', productId: String(product.id) });
    }
    const feeUntil = String(product.prepaymentFeeUntil || '');
    if (product.type === 'loan' && feeUntil && daysUntil(feeUntil) >= 0 && daysUntil(feeUntil) <= 30)
        alerts.push({ title: `${product.name} 중도상환수수료 종료`, detail: feeUntil, kind: 'finance', productId: String(product.id) });
} return alerts.sort((a, b) => a.detail.localeCompare(b.detail, 'ko')); }
function homeSystemAlerts() { const balance = pensionBalanceIssueRows(), balanceTitles = new Set(balance.map(row => row.title)), finance = homeFinancialAlerts(), system = systemIntegrityIssues().filter(message => !message.startsWith('ISA:') && !balanceTitles.has(message)).map(message => ({ title: message, detail: '통합에서 확인', kind: 'system' })), backup = backupHealth(); if (['warn', 'danger'].includes(backup.level))
    system.push({ title: backup.label, detail: backup.detail, kind: 'backup' }); const refresh = typeof investmentRefreshStatus === 'function' ? investmentRefreshStatus() : { errors: [] }, names = { pension: '개인연금', irp: 'IRP' }; for (const key of (refresh.errors || []))
    system.push({ title: `${names[key] || key} 갱신 확인 필요`, detail: '이전 자료를 유지하고 있습니다.', kind: 'refresh' }); return [...finance, ...balance, ...system]; }
function homeChangeMarkup() { const change = homeMonthChange(); return change.available ? `<div class="change home-change"><strong class="${escapeHtml(change.netChange < 0 ? 'negative' : 'positive')}">이번 달 순자산 ${signed(change.netChange)}</strong></div>` : '<div class="change">이번 달 변화 준비 중</div>'; }
function homeChangeDetailMarkup() { const change = homeMonthChange(); return change.available ? `<div class="sheetrows"><div class="sheetrow"><span>이번 달 순자산 변화</span><strong>${signed(change.netChange)}</strong></div><div class="sheetrow"><span>외부 순유입</span><strong>${signed(change.externalNet)}</strong></div><div class="sheetrow"><span>평가·기타</span><strong>${signed(change.marketOther)}</strong></div></div>` : '<div class="source-note">월 변화 기준을 준비 중입니다.</div>'; }
function homeCard(id) {
    const s = homeSample();
    if (id === 'isa') {
        const recorded = s.isaSource === 'asset-os', linked = !recorded && s.isa > 0;
        return `<article class="card summary-card"><button class="card-main" data-route="isa"><div class="summary-top"><span class="module-icon module-isa">${moduleIcon('isa')}</span><span class="module-name">ISA</span></div><div class="amount ${recorded || linked ? amountClass(s.isa) : ''}" title="${escapeHtml(recorded || linked ? won(s.isa) : '')}">${recorded || linked ? displayWon(s.isa) : '미입력'}</div><div class="home-module-caption">${recorded ? '등록된 보유·현금 현재값' : linked ? '납입 현금 연결 · 평가액 미입력' : '평가자산 미입력'}</div></button><button class="detail-trigger" data-detail="isa-home"><span>${recorded ? '투자손익 보기' : '연결 상태 보기'}</span><span>›</span></button></article>`;
    }
    if (id === 'pension') {
        const available = s.pension > 0 || s.pensionSource !== 'linked', caption = s.pensionSource === 'kis' ? '한국투자 조회 잔고' : s.pensionSource === 'mixed' ? '한국투자 조회 + 연결 원장' : s.pensionSource === 'asset-os' ? '연금저축+IRP 평가자산' : s.pension > 0 ? '납입·통합 원장 연결액 · 종목 미연결' : '평가자산 미입력';
        return `<article class="card summary-card"><button class="card-main" data-route="pension"><div class="summary-top"><span class="module-icon module-pension">${moduleIcon('pension')}</span><span class="module-name">개인연금</span></div><div class="amount ${available ? amountClass(s.pension) : ''}" title="${escapeHtml(available ? won(s.pension) : '')}">${available ? displayWon(s.pension) : '미입력'}</div><div class="home-module-caption">${caption}</div></button><button class="detail-trigger" data-detail="pension"><span>${s.pensionSource === 'linked' ? '연결 상태 보기' : '투자손익 보기'}</span><span>›</span></button></article>`;
    }
    if (id === 'cash')
        return `<article class="card summary-card"><button class="card-main" data-route="integrated"><div class="summary-top"><span class="module-icon module-cash">${moduleIcon('cash')}</span><span class="module-name">현금·예적금</span></div><div class="amount ${amountClass(s.cash)}" title="${escapeHtml(won(s.cash))}">${displayWon(s.cash)}</div><div class="home-module-caption">통합에서 현금·예금·적금 확인</div></button><button class="detail-trigger" data-detail="cash"><span>상세 보기</span><span>›</span></button></article>`;
    if (id === 'contribution') {
        const planned = s.outgoing + s.scheduled;
        return `<article class="card summary-card contribution-card"><button class="card-main" data-route="integrated" data-current-month="true"><div class="summary-top"><span class="module-icon module-contribution">${moduleIcon('contribution')}</span><span class="module-name">이번 달 지출·납입</span></div><div class="amount ${amountClass(planned)}" title="${escapeHtml(won(planned))}">${displayWon(planned)}</div><div class="home-module-caption">기록 ${displayWon(s.outgoing)} · 남은 일정 ${s.activity.remaining.length}건</div></button><button class="detail-trigger" data-detail="contribution"><span>이번 달 보기</span><span>›</span></button></article>`;
    }
    return '';
}
function homeAccountRow(id) { const template = document.createElement('template'); template.innerHTML = homeCard(id); const caption = template.content.querySelector('.home-module-caption'), detail = template.content.querySelector('.detail-trigger'); if (caption && detail) {
    const label = detail.querySelector('span')?.textContent || '상세 보기';
    caption.setAttribute('title', caption.textContent || '');
    caption.textContent = id === 'cash' ? '통합에서 확인' : label;
    detail.setAttribute('aria-label', `${id === 'isa' ? 'ISA' : id === 'pension' ? '개인연금' : '현금·예적금'} ${label}`);
    detail.innerHTML = '<span aria-hidden="true">›</span>';
} return template.innerHTML; }
function homeAlertCount() { const isaReady = homeSample().isaSource === 'asset-os'; return scheduleUrgentOccurrences().length + (isaReady ? allIsaIssues().length : 0) + homeSystemAlerts().length + (isaReady && nearestMaturityAlert() ? 1 : 0); }
function openAlertsCenter() { const isaReady = homeSample().isaSource === 'asset-os', issues = isaReady ? allIsaIssues() : [], alert = isaReady ? nearestMaturityAlert() : null, urgent = scheduleUrgentOccurrences(), system = homeSystemAlerts(); $('#sheetEyebrow').textContent = '알림'; $('#sheetTitle').textContent = '확인할 알림'; $('#sheetBody').innerHTML = `<div class="integrity-list">${urgent.map(o => `<button class="integrity-row" data-home-schedule="${escapeHtml(o.date)}"><i class="integrity-dot ${o.status === 'overdue' ? 'high' : ''}"></i><span class="integrity-copy"><strong>${escapeHtml(o.schedule.name)} · ${scheduleStatusLabel(o.status)}</strong><small>${escapeHtml(o.date)} · ${won(o.schedule.amount)}</small></span><span class="integrity-go">›</span></button>`).join('')}${issues.map(x => `<button class="integrity-row" data-integrity-account="${escapeHtml(x.accountId)}" ${x.transactionId ? `data-integrity-tx="${escapeHtml(x.transactionId)}"` : ''}><i class="integrity-dot ${x.severity === 'high' ? 'high' : ''}"></i><span class="integrity-copy"><strong>${escapeHtml(x.title)}</strong><small>${escapeHtml(state.accounts.find(a => a.id === x.accountId)?.name || 'ISA')} · ${escapeHtml(x.detail)}</small></span><span class="integrity-go">›</span></button>`).join('')}${system.map(item => `<button class="integrity-row" ${item.accountId ? `data-pension-balance-check="${escapeHtml(item.accountId)}"` : item.productId ? `data-finance-alert="${escapeHtml(item.productId)}"` : item.kind === 'backup' ? 'data-backup-alert' : item.kind === 'refresh' ? 'data-refresh-alert' : 'data-system-alert'}><i class="integrity-dot"></i><span class="integrity-copy"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small></span><span class="integrity-go">›</span></button>`).join('')}${alert ? `<button class="integrity-row" data-maturity-alert="${escapeHtml(alert.account.id)}"><i class="integrity-dot"></i><span class="integrity-copy"><strong>${escapeHtml(alert.account.name)} 만기 ${alert.label}</strong><small>${alert.date}</small></span><span class="integrity-go">›</span></button>` : ''}${!urgent.length && !issues.length && !system.length && !alert ? '<div class="empty-state"><strong>지금 처리할 중요 알림이 없습니다.</strong></div>' : ''}</div>${homeInvestmentRefreshMarkup()}`; openSheet('#detailSheet'); setTimeout(() => bindIntegrityActions(), 0); }
function bindIntegrityActions() {
    $$('[data-pension-balance-check]').forEach(button => button.onclick = () => openPensionBalanceDetail(button.dataset.pensionBalanceCheck || ''));
    $$('[data-home-schedule]').forEach(b => b.onclick = async () => { const d = b.dataset.homeSchedule; if (!d)
        return; if (d === '날짜 미설정')
        return nav('integrated', 'schedule'); (await openScheduleDay(d)); });
    $$('[data-integrity-account]').forEach(b => b.onclick = async () => { const accountId = b.dataset.integrityAccount, txId = b.dataset.integrityTx; if (!accountId)
        return; const account = state.accounts.find(a => a.id === accountId); if (txId) {
        openTransactionDetail(txId, accountId);
        return;
    } if (account && isPastAccount(account)) {
        openArchivedAccountDetail(accountId);
        return;
    } setting().selectedAccountId = accountId; rememberViewPreferences(); closeSheets(); nav('isa', 'transactions'); });
    $$('[data-maturity-alert]').forEach(b => b.onclick = async () => { const accountId = b.dataset.maturityAlert; if (!accountId)
        return; setting().selectedAccountId = accountId; rememberViewPreferences(); closeSheets(); nav('isa', 'tax'); });
    $$('[data-finance-alert]').forEach(b => b.onclick = () => { const id = b.dataset.financeAlert; if (id)
        openFinancialProductDetail(id); });
    $$('[data-system-alert]').forEach(b => b.onclick = () => { closeSheets(); nav('integrated', 'summary'); });
    $$('[data-refresh-alert]').forEach(b => b.onclick = () => $('#sheetBody .home-investment-refresh')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    $$('[data-backup-alert]').forEach(b => b.onclick = () => openBackupHub());
}
function homeTrendMarkup() { const rows = financialGrowthSeries('3m').filter(row => row.coverage?.complete && Number.isFinite(row.netAssets)); if (rows.length < 2)
    return ''; const first = rows[0], last = rows.at(-1), delta = last.netAssets - first.netAssets, changeClass = delta < 0 ? 'negative' : delta > 0 ? 'positive' : 'neutral'; return `<button class="home-trend home-change-compare" data-home-growth><span class="home-trend-head"><strong>순자산 변화</strong><span>상세 보기 ›</span></span><strong class="home-compare-delta ${escapeHtml(changeClass)}">${delta === 0 ? '변화 없음' : signed(delta)}</strong><span class="home-compare-values"><span>${escapeHtml(first.asOf)}<b>${won(first.netAssets)}</b></span><span aria-hidden="true">→</span><span>${escapeHtml(last.asOf)}<b>${won(last.netAssets)}</b></span></span></button>`; }
function home() { const s = homeSample(); return `<div class="stack home-app-stack"><button class="hero" data-detail="total"><div class="herohead"><div class="label">순금융자산</div><span class="heropeek">›</span></div><div class="heroamount ${amountClass(s.total - s.debt)}" title="${escapeHtml(won(s.total - s.debt))}">${displayWon(s.total - s.debt)}</div><div class="home-module-caption">보유 금융자산에서 대출·부채 차감</div>${homeChangeMarkup()}</button><section class="card home-account-list"><div class="sectionhead"><h2>내 계좌</h2></div>${['isa', 'pension', 'cash'].map(homeAccountRow).join('')}</section><section class="home-plan">${homeCard('contribution')}</section>${homeTrendMarkup()}</div>`; }
;
/* asset-os source: isa-summary.js */
'use strict';
function accountStrip() { const a = currentAccount(); return `<button class="account-selector" data-account-selector><span class="account-selector-copy"><strong>${escapeHtml(a.name)}</strong><small>${escapeHtml(a.type)}${isCurrentAccount(a) ? ` · 만기 ${formatDate(a.maturityAt)} · ${ddayLabel(a.maturityAt)}` : ''}</small></span><span class="account-selector-side"><span class="status-badge">${statusText(a.status)}</span><span class="account-selector-arrow">⌄</span></span></button>`; }
function isaHero(a) { const m = accountMetrics(a), neg = m.profit < 0, isTransferred = a.status === 'transferred', isClosed = a.status === 'closed', isPending = a.status === 'maturity_pending', isCurrent = isCurrentAccount(a); const valueLabel = isClosed ? '실제 해지금액' : isTransferred ? '실제 연금전환액' : isPending ? '만기 처리 전 평가액' : isCurrent ? '총 평가액' : '보관 평가액', displayValue = isTransferred ? (a.maturity?.actualTransferAmount ?? m.value) : m.value, closedLabel = formatDate(a.closedAt || a.maturityAt), closedNote = a.maturity?.note || (a.status === 'archived' ? '보관 계좌' : '만기 완료'); return `<section class="isa-hero">${isCurrent ? '<button class="isa-hero-content" data-isa-asset-analysis aria-expanded="false">' : '<div class="isa-hero-content">'}<div class="eyebrow">${valueLabel}</div><div class="isa-value ${amountClass(displayValue)}" title="${escapeHtml(won(displayValue))}">${displayWon(displayValue)}</div>${isCurrent ? '<span class="isa-hero-link">투자 현황 보기 <b aria-hidden="true">›</b></span></button>' : '</div>'}</section><section class="card isa-summary-facts"><div class="isa-profit ${neg ? 'negative' : ''}">${isCurrent ? `<span>평가손익</span><strong>${signed(m.profit)}<small>${pct(m.rate)}</small></strong>${isPending ? ' · 만기 처리 대기' : ''}` : `${closedLabel} · ${escapeHtml(closedNote)}`}</div><div class="isa-stats"><div class="isa-stat"><span>${isCurrent ? '투자원금' : '만기 시점 원금'}</span><strong class="${escapeHtml(amountClass(m.cost))}" title="${escapeHtml(won(m.cost))}">${displayWon(m.cost)}</strong></div><div class="isa-stat"><span>계좌 현금</span><strong class="${escapeHtml(amountClass(m.cash))}" title="${escapeHtml(won(m.cash))}">${displayWon(m.cash)}</strong></div></div></section>`; }
function maturitySummary(a) { if (!a.maturity || !isPastAccount(a))
    return ''; const m = a.maturity, transfer = m.decision === 'transfer'; return `<section class="card maturity-card"><div class="maturity-head"><div><h3>${transfer ? '연금계좌 전환 완료' : '일반 해지 완료'}</h3><small>${formatDate(a.closedAt || a.maturityAt)} · 읽기 전용 정산 기록</small></div></div><div class="maturity-result"><div class="result-row"><span>${transfer ? '실제 전환금액' : '실제 해지금액'}</span><strong>${won(transfer ? (m.actualTransferAmount ?? m.actualSettlement ?? 0) : (m.actualSettlement ?? 0))}<span class="compare">예상 ${won(transfer ? (m.expectedTransferAmount ?? m.expectedSettlement ?? 0) : (m.expectedSettlement ?? 0))}</span></strong></div><div class="result-row"><span>실제 납부세금</span><strong>${won(m.actualTax || 0)}<span class="compare">예상 ${won(m.expectedTax || 0)}</span></strong></div>${transfer ? `<div class="result-row"><span>전환 대상</span><strong>${escapeHtml(m.transferTarget || '-')}<span class="compare">추가 공제대상 ${won(m.taxDeductionBase || 0)}</span></strong></div><div class="result-row"><span>예상 추가 세액공제</span><strong>${won(m.expectedTaxCredit || 0)}</strong></div>` : `<div class="result-row"><span>실제 수령액</span><strong>${won(m.actualReceived ?? Math.max(0, (m.actualSettlement || 0) - (m.actualTax || 0)))}</strong></div>`}</div></section>`; }
function portfolioBucketForHolding(h) { return normalizeInvestmentRole(h?.investmentRole || '', h); }
function compositionModel(a) {
    const m = accountMetrics(a), colors = ['#2f6fed', '#15977e', '#735ddd', '#d18a1f', '#7b8798'], order = INVESTMENT_ROLES, groups = new Map();
    for (const h of m.holdings.filter(h => h.qty > 1e-8)) {
        const key = portfolioBucketForHolding(h), entry = groups.get(key) || { key, name: key, value: 0, cost: 0, count: 0, holdingIds: [] };
        const cost = holdingCostValue(h);
        entry.value += h.marketValue;
        entry.cost += cost;
        entry.count++;
        entry.holdingIds.push(h.id);
        groups.set(key, entry);
    }
    if (m.cash > 0) {
        const key = '현금', entry = groups.get(key) || { key, name: key, value: 0, cost: 0, count: 0, holdingIds: [] };
        entry.value += m.cash;
        entry.cost += m.cash;
        groups.set(key, entry);
    }
    const arr = [...groups.values()].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key) || b.value - a.value), total = arr.reduce((sum, x) => sum + x.value, 0) || 1;
    let acc = 0;
    const segments = arr.map((x, i) => { const pct = x.value / total * 100, start = acc; acc += pct; return { ...x, pct, start, end: acc, color: colors[i % colors.length], profit: x.value - x.cost }; });
    return { m, total, segments };
}
function isaPortfolioGroupHoldings(a, key) { return accountMetrics(a).holdings.filter(h => h.qty > 1e-8 && portfolioBucketForHolding(h) === key).sort((x, y) => y.marketValue - x.marketValue || String(x.name).localeCompare(String(y.name), 'ko')); }
function inlineComposition(a) {
    const model = compositionModel(a), focus = model.segments.some(x => x.key === setting().compositionFocus) ? setting().compositionFocus : '', selected = model.segments.find(x => x.key === focus), groupHoldings = selected ? isaPortfolioGroupHoldings(a, selected.key) : [], selectedRate = selected && selected.cost ? selected.profit / selected.cost * 100 : 0;
    return `<section class="card pension-asset-card common-portfolio-card"><div class="sectionhead"><h2>포트폴리오 구성</h2><span class="count-pill">투자 역할</span></div><div class="pension-composition-main"><div class="donut-viz inline">${assetDonutSvg(model.segments, focus, 'data-inline-donut', 'ISA 자산군 구성')}<div class="pension-donut-center"><strong>${selected ? selected.pct.toFixed(1) + '%' : 'ISA'}</strong><small>${selected ? escapeHtml(selected.name) : `${model.m.holdings.length}개 보유`}</small></div></div><div class="pension-legend">${model.segments.map(x => `<button class="${focus === x.key ? 'active' : ''} ${focus && focus !== x.key ? 'dimmed' : ''}" data-inline-group="${escapeHtml(x.key)}"><i style="background:${x.color}"></i><strong>${escapeHtml(x.name)}</strong><span>${x.pct.toFixed(1)}%</span></button>`).join('')}</div></div>${selected ? `<div class="pension-selected-panel expanded"><div class="pension-selected pension-selected-toggle"><span class="pension-selected-info"><strong>${escapeHtml(selected.name)}</strong><small>${selected.key === '현금' && selected.count === 0 ? '계좌 현금' : `${selected.count}개 보유 · 전체 ${selected.pct.toFixed(1)}%`}</small></span><span class="pension-selected-result"><b>${won(selected.value)}</b><small class="${escapeHtml(selected.profit < 0 ? 'negative' : '')}">평가손익 ${signed(selected.profit)} · ${pct(selectedRate)}</small></span></div><div class="pension-selected-list">${groupHoldings.map(h => { const cost = holdingCostValue(h), profit = h.marketValue - cost, rate = cost ? profit / cost * 100 : 0, groupWeight = selected.value ? h.marketValue / selected.value * 100 : 0; return `<button class="pension-selected-row" data-holding="${escapeHtml(h.id)}"><span class="pension-holding-copy"><span class="pension-holding-name"><strong>${escapeHtml(h.name)}</strong></span><small>${holdingQuantityText(h)} · 자산군 내 ${groupWeight.toFixed(1)}%</small></span><span class="pension-holding-right"><strong>${won(h.marketValue)}</strong><small class="${escapeHtml(profit < 0 ? 'negative' : '')}">${pct(rate)}</small></span></button>`; }).join('') || (selected.key === '현금' ? `<div class="source-note">계좌 현금 ${won(model.m.cash)}</div>` : '<div class="empty-state"><span>해당 자산군의 보유종목이 없습니다.</span></div>')}</div></div>` : ''}</section>`;
}
function isaHoldingRowsMarkup(hs) { return hs.map(h => { const cost = holdingCostValue(h), profit = h.marketValue - cost, rate = cost ? profit / cost * 100 : 0; return `<button class="portfolio-holding-row" data-holding="${escapeHtml(h.id)}"><span class="copy"><span class="name"><strong>${escapeHtml(h.name)}</strong></span><span class="meta">${escapeHtml(investmentRoleMeta(h))} · ${holdingQuantityText(h)}</span></span><span class="right"><strong>${won(h.marketValue)}</strong><small class="${escapeHtml(profit < 0 ? 'negative' : '')}">${signed(profit)} · ${pct(rate)}</small></span></button>`; }).join(''); }
function isaHoldingsCard(a) { const hs = accountMetrics(a).holdings.filter(h => h.qty > 1e-8).sort((x, y) => y.marketValue - x.marketValue || String(x.name).localeCompare(String(y.name), 'ko')); return `<section class="card portfolio-holdings-card" data-isa-holdings-card><div class="portfolio-holdings-head"><div><h2>보유종목</h2><span>${hs.length}개</span></div>${hs.length ? `<button class="portfolio-holdings-toggle" data-isa-holdings-toggle aria-expanded="${escapeHtml(isaHoldingsExpanded ? 'true' : 'false')}">${isaHoldingsExpanded ? '숨기기 ∧' : '펼치기 ∨'}</button>` : ''}</div><div class="portfolio-holdings-list" data-isa-holdings-extra ${isaHoldingsExpanded ? '' : 'hidden'}>${isaHoldingRowsMarkup(hs) || '<div class="empty-state"><span>보유종목이 없습니다.</span></div>'}</div></section><div class="inline-detail-guard" data-isa-holdings-guard></div>`; }
function dividendModel(a, analysis = false) {
    const source = analysis ? dividendAnalysisRecords(a) : dividends(a), ds = source.map(x => ({ ...x, grossAmount: Number(x.grossAmount ?? x.amount) || 0, amount: dividendNetAmount(x) })), total = ds.reduce((sum, x) => sum + (Number(x.amount) || 0), 0);
    return { ds, total };
}
function dividendSection(a) { const d = dividendModel(a), year = localYmd().slice(0, 4), yearTotal = d.ds.filter(x => txDate(x).startsWith(year)).reduce((sum, x) => sum + (Number(x.amount) || 0), 0), yearYield = dividendYieldFor(a, year, 'year', yearTotal).rate, latest = d.ds[0]; return `<section class="card dividend-dashboard compact-analysis" data-dividend-card><div class="sectionhead"><h2>배당금 현황</h2><button class="analysis-toggle" data-dividend-analysis aria-expanded="false">분석 ›</button></div><div class="dividend-metrics compact-four"><div class="dividend-metric emphasis"><span>누적 배당</span><strong>${won(d.total)}</strong></div><div class="dividend-metric"><span>${year}년 배당</span><strong>${won(yearTotal)}</strong></div><div class="dividend-metric"><span>${year} 배당률</span><strong>${yearYield == null ? '계산 전' : yearYield.toFixed(2) + '%'}</strong></div><div class="dividend-metric"><span>최근 배당</span><strong class="${escapeHtml(latest ? amountClass(latest.amount) : '')}" title="${escapeHtml(latest ? won(latest.amount) : '')}">${latest ? displayWon(latest.amount) : '-'}</strong><small>${latest ? escapeHtml(holdingName(a, latest.holdingId)) : '내역 없음'}</small></div></div></section>`; }
function quickActions(a) { if (a.status !== 'active')
    return ''; const linked = isaQuoteLinks(a).length, last = (a.holdings || []).filter(h => h.quoteSource === 'kis').map(h => h.quoteUpdatedAt || '').sort().pop() || ''; return `<div class="quick-actions native-isa-entry"><button class="quick-action primary" data-new-tx><strong>거래 입력</strong><span aria-hidden="true">＋</span></button><details class="isa-account-tools"><summary>계좌·현재가 정보</summary><div class="source-note">성장·배당·현금흐름·안정·현금의 투자 역할 기준입니다. 포트폴리오에서 역할을 누르면 해당 종목이 펼쳐집니다.</div><section class="manual-refresh-row isa-quote-card"><div><strong>ISA 현재가</strong><small>${last ? `최근 ${formatDateTime(last)}` : '아직 갱신 전'} · ${linked}개 종목 · 종 아이콘에서 전체 갱신</small></div></section><button class="quick-action" data-register><strong>보유내역 등록</strong><span aria-hidden="true">›</span></button></details></div>`; }
function secondaryActions(a) { const past = state.accounts.filter(isPastAccount).length; return `<section class="card isa-compact-manage"><div class="isa-compact-manage-row"><strong>관리</strong><button data-route="isa" data-tab="transactions">거래 <b>${a.transactions.length}</b></button><button data-route="isa" data-tab="tax">세금·만기</button><button data-history-route>이전 <b>${past}</b></button></div></section>`; }
function visibleHoldingCount(a) { return a ? accountMetrics(a).holdings.filter(h => Number(h.qty) > 1e-8).length : 0; }
function transactionFacts(a) { return replay(a).facts; }
function transactionAmountMarkup(a, t, facts = null) { const f = (facts || transactionFacts(a)).get(t.id) || {}, amount = f.tradeAmount ?? Math.abs(txAmount(t)); if (t.status === 'cancelled')
    return `<span class="rowamount"><span class="loss">취소됨</span><b>${won(amount)}</b></span>`; if (t.type === 'buy')
    return `<span class="rowamount">매수금액<b>${won(amount)}</b></span>`; if (t.type === 'sell')
    return `<span class="rowamount">매도대금<b>${won(amount)}</b>${typeof f.realized === 'number' && Number.isFinite(f.realized) ? `<span class="${escapeHtml(f.realized >= 0 ? 'gain' : 'loss')}">실현손익 ${signed(f.realized)}</span>` : ''}</span>`; if (['dividend', 'distribution', 'interest'].includes(t.type))
    return `<span class="rowamount dividend">수령<b>${won(amount)}</b></span>`; if (['deposit', 'internalTransferIn'].includes(t.type))
    return `<span class="rowamount deposit">${t.type === 'internalTransferIn' ? '통합 납입' : '과거 입금'}<b>${won(amount)}</b></span>`; if (['withdrawal', 'internalTransferOut'].includes(t.type))
    return `<span class="rowamount">출금<b>${won(amount)}</b></span>`; return `<span class="rowamount">조정<b>${won(amount)}</b></span>`; }
function contributionCard(a) {
    const p = policy('isa', a), currentAccountState = isCurrentAccount(a), limit = currentAccountState ? isaContributionModel(a) : null, current = limit ? limit.lifetimePaid : Number(a.annualContribution || 0), remain = limit ? limit.remaining : 0, ratio = limit ? Math.min(100, current / Math.max(1, limit.accruedLimit) * 100) : 100, net = Math.max(0, taxableNet(a)), ex = exemption(a), applied = Math.min(net, ex), tax = expectedTax(a), pending = a.status === 'maturity_pending', baselineContribution = Math.max(0, Number(a.baselineContribution ?? a.baseline?.contribution) || 0);
    return `<section class="card isa-management"><div class="sectionhead"><h2>ISA 한도·절세</h2><button data-tax-route>${a.status === 'active' ? ddayLabel(a.maturityAt) : pending ? '처리 대기' : '정산 완료'} ›</button></div>${baselineContribution ? `<div class="isa-management-row"><div class="isa-management-head"><span>확인된 누적 납입원금</span><strong>${won(baselineContribution)}</strong></div><small>초기 잔고 기준일 ${formatDate(a.baselineDate || a.baseline?.date)} · 인출해도 납입한도는 복원되지 않음</small></div>` : ''}<div class="isa-management-grid"><div class="isa-management-row"><div class="isa-management-head"><span>${currentAccountState ? '누적 납입 / 누적 한도' : '최종 누적 납입'}</span><strong>${currentAccountState ? `${won(current)} / ${won(limit.accruedLimit)}` : won(current)}</strong></div><small>${currentAccountState ? (pending ? '만기 처리 대기 중이며 추가 납입은 중단됩니다.' : `올해 확인 납입 ${won(limit.currentYearPaid)} · 지금 추가 가능 ${won(remain)}`) : '종료 계좌 기록'}</small><div class="progress ${limit?.overage ? 'warn' : ''}"><i style="width:${ratio}%"></i></div></div><div class="isa-management-row"><div class="isa-management-head"><span>예상 비과세 적용</span><strong>${won(applied)}</strong></div><small>${a.type} 한도 ${won(ex)} · 예상세금 ${won(tax)}</small><div class="progress ${net > ex ? 'warn' : ''}"><i style="width:${Math.min(100, applied / Math.max(1, ex) * 100)}%"></i></div></div></div>${a.status === 'active' ? `<div class="auto-note">연 ${won(limit.annualLimit)}씩 미사용 한도를 이월해 누적 ${won(limit.totalLimit)}까지 계산합니다.${limit.carryoverAvailable ? ` 현재 추가 가능액 중 이월분 ${won(limit.carryoverAvailable)}.` : ''}</div>` : pending ? '<div class="auto-note">만기 처리 전 자산과 납입 이력은 현재 합산에 유지되지만 새 거래·납입은 입력할 수 없습니다.</div>' : ''}</section>`;
}
function isaSummary() { const a = currentAccount(), tabs = [['summary', '요약'], ['transactions', '거래'], ['tax', '세금·만기']]; return `<div class="stack">${isaHero(a)}<div class="tabs">${tabs.map(([k, l]) => `<button class="tab ${k === 'summary' ? 'active' : ''}" data-isa-tab="${escapeHtml(k)}">${l}</button>`).join('')}</div>${accountStrip()}${inlineComposition(a)}${quickActions(a)}${dividendSection(a)}${isaHoldingsCard(a)}${contributionCard(a)}${a.maturity ? maturitySummary(a) : ''}${secondaryActions(a)}</div>`; }
function txAmount(tx) { const fee = Number(tx.fee) || 0, tax = Number(tx.tax) || 0, h = tx.holdingId ? getHolding(currentAccount(), tx.holdingId) : null, trade = transactionPositionValue(h, Number(tx.qty) || 0, Number(tx.price) || 0); if (['buy', 'openingAllocation'].includes(tx.type))
    return -(trade + fee + tax); if (tx.type === 'sell')
    return trade - fee - tax; if (['withdrawal', 'internalTransferOut', 'depositReversal'].includes(tx.type))
    return -(Number(tx.amount) || 0); if (['dividend', 'distribution', 'interest'].includes(tx.type))
    return (Number(tx.amount) || 0) - fee - tax; return Number(tx.amount) || 0; }
function transactionsPage() { const a = currentAccount(), m = accountMetrics(a), filter = setting().txFilter || 'all', matchesFilter = (t) => filter === 'all' || t.type === filter || (filter === 'dividend' && t.type === 'distribution') || (filter === 'adjustment' && t.type === 'openingAllocation'), all = [...sortTxs([...a.transactions, ...centralIsaReplayRows(a, true)])].reverse().filter(matchesFilter), visible = all.slice(0, transactionDisplayLimit), facts = m.facts || transactionFacts(a), remaining = Math.max(0, all.length - visible.length), status = all.length > transactionDisplayLimit ? `최근 ${visible.length}건 / 전체 ${all.length}건` : `전체 ${all.length}건`, baseline = Number(a.baselineContribution ?? a.baseline?.contribution) || 0; return `<div class="stack">${accountStrip()}<section class="compact-account-summary"><div><span>총 평가액</span><strong>${won(m.value)}</strong></div><div class="compact-profit ${m.profit < 0 ? 'negative' : ''}">${signed(m.profit)} · ${pct(m.rate)}</div></section>${baseline ? `<section class="card section-card"><div class="sectionhead"><h2>초기 잔고 기준</h2><span class="count-pill">${formatDate(a.baselineDate || a.baseline?.date)}</span></div><div class="sheetrows"><div class="sheetrow"><span>누적 납입원금</span><strong>${won(baseline)}</strong></div><div class="sheetrow"><span>계좌 현금</span><strong>${won(a.baselineCash || a.baseline?.cash || 0)}</strong></div><div class="sheetrow"><span>보유종목</span><strong>${m.holdings.filter(h => h.qty > 1e-8).length}개</strong></div></div><div class="auto-note">이 기준값은 신규 거래가 아니라 계좌 원장의 시작점입니다.</div></section>` : ''}<div class="filter-strip">${[['all', '전체'], ['buy', '매수'], ['sell', '매도'], ['dividend', '배당'], ['withdrawal', '출금'], ['adjustment', '조정']].map(([k, l]) => `<button class="filter-chip ${filter === k ? 'active' : ''}" data-tx-filter="${escapeHtml(k)}">${l}</button>`).join('')}</div><section class="card section-card"><div class="sectionhead"><h2>기준일 이후 거래</h2>${isTradeableAccount(a) ? '<button class="tinybtn primary" data-new-tx>거래 추가</button>' : `<span class="count-pill">${a.status === 'maturity_pending' ? '만기 대기' : '종료 계좌'}</span>`}</div><div class="archive-list-status">${status}</div><div class="transaction-list">${visible.length ? visible.map(t => { const name = t.holdingId ? holdingName(a, t.holdingId) : typeText(t.type); return `<button class="transaction-row" ${t.sourceTxId ? `data-integrated-tx="${escapeHtml(t.sourceTxId)}"` : `data-tx="${escapeHtml(t.id)}"`}><span class="rowcopy"><strong>${escapeHtml(name)}${name === typeText(t.type) ? '' : ` · ${typeText(t.type)}`}</strong><small>${formatDate(txDate(t))}${t.status === 'cancelled' ? ' · 취소됨' : ''}${(t.revisions || []).length ? `<span class="revision-mark">이력 ${(t.revisions || []).length}</span>` : ''}${t.qty ? ` · ${quantityNumber(t.qty)}주 × ${won(t.price)}` : ''}${t.note ? ` · ${escapeHtml(t.note)}` : ''}</small></span>${transactionAmountMarkup(a, t, facts)}</button>`; }).join('') : '<div class="empty-state"><strong>기준일 이후 거래가 없습니다.</strong><span>초기 잔고는 위에 정상 등록되어 있습니다.</span></div>'}</div>${remaining ? `<button class="diagnostic-action" data-tx-more>다음 ${Math.min(50, remaining)}건 보기 · 남은 ${remaining}건</button>` : ''}</section></div>`; }
function taxPage() { const a = currentAccount(), p = policy('isa', a), net = taxableNet(a), ex = exemption(a), over = Math.max(0, net - ex), tax = expectedTax(a), b = taxableBreakdown(a), transferSample = 30000000, base = Math.min(transferSample * p.transferDeductionRate, p.transferDeductionMax), credit = base * p.taxCreditRate; return `<div class="stack">${accountStrip()}${isCurrentAccount(a) ? '<button class="diagnostic-action" data-isa-lifecycle>연장·만기 결과 기록</button>' : '<button class="diagnostic-action" data-isa-successor>새 ISA 회차 등록</button>'}<section class="tax-hero"><div class="tax-label">예상 과세대상 순이익</div><div class="tax-value">${won(net)}</div><div class="tax-sub">${a.type} 비과세 한도 ${won(ex)} · 초과분 ${won(over)}</div><div class="progress ${over > 0 ? 'warn' : ''}"><i style="width:${Math.min(100, net / Math.max(1, ex) * 100)}%"></i></div><div class="tax-grid"><div class="tax-metric"><span>비과세 적용분</span><strong>${won(Math.min(net, ex))}</strong></div><div class="tax-metric"><span>초과 과세분</span><strong>${won(over)}</strong></div><div class="tax-metric"><span>적용 세율</span><strong>${(p.taxRate * 100).toFixed(1)}%</strong></div><div class="tax-metric"><span>예상 세금</span><strong>${won(tax)}</strong></div></div></section><section class="card section-card"><div class="sectionhead"><h2>손익통산 구성</h2><button class="tinybtn" data-policy-view>제도 보기</button></div><div class="sheetrows"><div class="sheetrow"><span>과세대상 실현이익</span><strong>${won(b.gains || 0)}</strong></div><div class="sheetrow"><span>과세대상 실현손실</span><strong>${signed(b.losses || 0)}</strong></div><div class="sheetrow"><span>배당·이자 등</span><strong>${won(b.dividends || 0)}</strong></div><div class="sheetrow"><span>비용·조정</span><strong>${signed(b.expenses || 0)}</strong></div><div class="sheetrow"><span>과세 제외 매매손익</span><strong>${signed((b.excludedGains || 0) + (b.excludedLosses || 0))}</strong></div><div class="sheetrow total"><span>예상 순이익</span><strong>${won(net)}</strong></div></div>${b.unclassified ? `<div class="warningbox">과세분류 미확인 실현손익 ${won(b.unclassified)}은 예상세금에서 제외했습니다.</div>` : ''}<div class="policy-note">국내 상장주식·국내주식형 ETF·채권의 비과세 매매손익을 제외합니다. 해외지수형·채권 ETF는 과표기준가 자료가 없어 실제 정산과 차이가 날 수 있습니다.</div></section>${isPastAccount(a) && a.maturity ? maturitySummary(a) : `<section class="card section-card"><div class="sectionhead"><h2>만기 연금전환 미리보기</h2><button class="tinybtn" data-transfer-calc>예상액 계산</button></div><div class="maturity-result"><div class="result-row"><span>가정 전환금액</span><strong>${won(transferSample)}</strong></div><div class="result-row"><span>추가 공제대상 한도</span><strong>${won(base)}</strong></div><div class="result-row"><span>적용 세액공제율</span><strong>${(p.taxCreditRate * 100).toFixed(1)}%</strong></div><div class="result-row"><span>예상 추가 세액공제</span><strong>${won(credit)}</strong></div></div></section>`}</div>`; }
function historyPage() { const past = state.accounts.filter(isPastAccount); return `<div class="stack"><section class="modulehero"><div class="eyebrow">ISA 회차 보관</div><h2>이전 ISA</h2><div class="modulebalance">${past.length}개 회차</div><div class="pills"><span class="pill">현재 자산 합산 제외</span><span class="pill">읽기 전용</span></div></section>${past.map(a => { const amount = a.status === 'transferred' ? a.maturity?.actualTransferAmount : a.maturity?.actualSettlement; return `<section class="card maturity-card"><div class="maturity-head"><div><h3>${escapeHtml(a.name)}</h3><small>${formatDate(a.openedAt)} ~ ${formatDate(a.closedAt || a.maturityAt)} · ${statusText(a.status)}</small></div><button class="tinybtn primary" data-archive-open="${escapeHtml(a.id)}">열기</button></div><div class="account-counts"><span class="count-pill">종목 ${visibleHoldingCount(a)}개</span><span class="count-pill">배당 ${dividends(a).length}건</span><span class="count-pill">실제금액 ${won(amount || 0)}</span></div></section>`; }).join('') || '<section class="card"><div class="empty-state"><strong>이전 ISA가 없습니다.</strong><span>종료·전환된 회차가 생기면 여기에 보관됩니다.</span></div></section>'}</div>`; }
function isaEmptyState() { return `<div class="stack"><section class="modulehero"><div class="eyebrow">ISA 계좌</div><h2>등록된 ISA가 없습니다.</h2><div class="modulebalance">0개 계좌</div><div class="pills"><span class="pill">거래·보유·배당 입력 전</span></div></section><section class="card placeholder"><div><strong>첫 ISA 계좌를 만들어 주세요.</strong><span>계좌를 만든 뒤 기초잔고 또는 거래 원장부터 입력합니다.</span></div><button class="diagnostic-action" data-empty-new-isa>＋ 새 ISA 계좌</button></section></div>`; }
function isaPage(tab = 'summary') { if (!state.accounts.length)
    return isaEmptyState(); const safe = ['summary', 'transactions', 'tax', 'history'].includes(tab) ? tab : 'summary', tabs = [['summary', '요약'], ['transactions', '거래'], ['tax', '세금·만기']], primary = `<div class="tabs module-primary-tabs" aria-label="ISA 메뉴">${tabs.map(([k, l]) => `<button class="tab ${safe === k ? 'active' : ''}" data-isa-tab="${escapeHtml(k)}">${l}</button>`).join('')}</div>`, content = safe === 'transactions' ? transactionsPage() : safe === 'tax' ? taxPage() : safe === 'history' ? historyPage() : isaSummary(); return `<div class="module-page-shell isa-module-shell">${primary}${content}</div>`; }
;
/* asset-os source: pension-forms.js */
"use strict";
'use strict';
function pensionTransactionSearchText(t) { const h = t.holdingId ? (pensionStore().holdings.find(x => x.id === t.holdingId) || pensionHoldingById(t.holdingId)) : null, a = t.accountId ? pensionAccount(t.accountId) : null, accountKind = t.accountKind === 'irp' ? 'IRP' : t.accountKind === 'pension' ? '연금저축' : t.accountKind; return transactionSearchKey([t.date, t.baseDate, t.time, t.type, t.incomeCategory, t.incomeType, pensionTradeLabel(t.type), t.productCode, t.productName, t.label, t.note, accountKind, a?.name, h?.name, t.amount, t.grossAmount, t.tax, t.qty, t.price]); }
function pensionTransactionRowMarkup(t) {
    if (t.linkedContribution)
        return `<button class="pension-trade-row" data-integrated-tx="${escapeHtml(t.sourceTxId)}"><span><strong>${t.type === 'isaTransfer' ? 'ISA 만기 이전' : '납입'} · ${escapeHtml(pensionAccount(t.accountId)?.name || '대상 계좌 확인 필요')}</strong><small>${formatDate(t.date)} · 통합 원장</small></span><b>${won(t.amount)}</b></button>`;
    if (t.brokerRight) {
        const account = t.accountKind === 'irp' ? 'IRP' : '연금저축';
        return `<button class="pension-trade-row archive" data-pension-kis-right="${escapeHtml(t.id)}"><span><strong>${escapeHtml(brokerKisIncomeTypeLabel(t.type))} · ${escapeHtml(t.productName || t.label)}</strong><small>${account} · ${formatDate(t.date)} · 한투 자동조회</small></span><b class="positive">${won(t.amount)}</b></button>`;
    }
    if (t.brokerOrder) {
        const account = t.accountKind === 'irp' ? 'IRP' : '연금저축';
        return `<button class="pension-trade-row archive" data-pension-kis-order="${escapeHtml(t.id)}"><span><strong>${pensionTradeLabel(t.type)} · ${escapeHtml(t.productName)}</strong><small>${account} · ${formatDate(t.date)}${t.time ? ` ${escapeHtml(t.time.slice(0, 2) + ':' + t.time.slice(2, 4))}` : ''} · 한투 자동조회</small></span><b class="${escapeHtml(t.type === 'sell' ? 'positive' : '')}">${won(t.amount)}</b></button>`;
    }
    if (t.archive) {
        const income = t.type === 'dividend', label = income ? (t.reconciledAmount ? '과거 월합계 미상세분' : '과거 배당') : '과거 실현손익', account = t.accountKind === 'irp' ? 'IRP' : '연금저축', negative = Number(t.amount) < 0;
        return `<button class="pension-trade-row archive" data-pension-archive-tx="${escapeHtml(t.id)}"><span><strong>${label} · ${escapeHtml(t.label || account)}</strong><small>${account} · ${formatDate(t.date)} · 원본 확정</small></span><b class="${escapeHtml(negative ? 'negative' : 'positive')}">${income ? won(t.amount) : signed(t.amount)}</b></button>`;
    }
    if (!t.brokerRight && !t.archive && !pensionStore().transactions.some(x => x.id === t.id)) {
        return `<div class="pension-trade-row archive"><span><strong>${escapeHtml(pensionTradeLabel(t.type))} · ${escapeHtml(pensionHoldingById(t.holdingId)?.name || t.label || '과거 수령')}</strong><small>${formatDate(t.date)} · 과거 수령 기록</small></span><b class="positive">${won(t.amount)}</b></div>`;
    }
    const h = pensionStore().holdings.find(x => x.id === t.holdingId) || pensionHoldingById(t.holdingId), a = pensionAccount(t.accountId), money = ['buy', 'sell'].includes(t.type || '') ? (Number(t.qty) || 0) * (Number(t.price) || 0) : (Number(t.amount) || 0), positive = ['dividend', 'distribution', 'interest', 'other_right', 'sell'].includes(t.type || '');
    return `<button class="pension-trade-row" data-pension-tx="${escapeHtml(t.id)}"><span><strong>${pensionTradeLabel(t.type)} · ${escapeHtml(h?.name || (t.type === 'interest' ? '계좌 현금' : '종목 없음'))}</strong><small>${escapeHtml(a?.name || '-')} · ${formatDate(t.date)}${t.note ? ` · ${escapeHtml(t.note)}` : ''}</small></span><b class="${escapeHtml(positive ? 'positive' : '')}">${t.type === 'adjustment' ? `${quantityNumber(t.setQty)}주` : won(money)}</b></button>`;
}
function pensionTransactionPage() {
    const scope = pensionAssetScope(), query = String(pensionTransactionSearch || '').trim(), needle = transactionSearchKey([query]), allRows = pensionVisibleTransactionRows(scope), matched = needle ? allRows.filter(t => pensionTransactionSearchText(t).includes(needle)) : allRows, rows = matched.slice(0, pensionTransactionDisplayLimit), cash = pensionSpendableCashStatus(scope), income = pensionIncomeSummary(scope).total;
    return `<div class="stack">${pensionTabs('transactions')}${pensionScopeSwitch(scope)}${pensionKisRefreshMarkup(scope)}<section class="card pension-trade-summary"><div><span>${cash.label}</span><strong>${won(cash.allConfirmed ? cash.available : cash.display)}</strong>${cash.allConfirmed ? '' : `<small>당일 매수 ${won(cash.pendingBuy)} · 갱신 후 결제예정액 확인</small>`}</div><div><span>누적 현금수익</span><strong>${won(income)}</strong></div><button data-pension-new-tx>＋ 거래 입력</button></section><section class="card pension-trade-card"><div class="sectionhead"><h2>거래 내역</h2><span class="count-pill">${rows.length}/${matched.length}건</span></div><form class="transaction-search" data-pension-search-form><input name="query" type="search" inputmode="search" autocomplete="off" value="${escapeHtml(query)}" placeholder="종목·날짜·금액·계좌·메모 검색" aria-label="연금 거래 검색"><button type="submit">검색</button>${needle ? '<button type="button" class="clear" data-pension-search-clear>지우기</button>' : ''}</form><div class="pension-trade-list">${rows.length ? rows.map(pensionTransactionRowMarkup).join('') : `<div class="empty-state"><strong>${needle ? '검색 결과가 없습니다.' : '아직 거래·과거자료가 없습니다.'}</strong><span>${needle ? '검색어를 바꾸거나 지워 주세요.' : '납입은 통합에서, 매수·매도·배당·이자는 여기에서 기록합니다.'}</span></div>`}</div>${matched.length > rows.length ? `<button class="diagnostic-action" data-pension-tx-more>${Math.min(20, matched.length - rows.length)}건 더 보기 · 남은 ${matched.length - rows.length}건</button>` : ''}</section><details class="source-note"><summary>조회 기준</summary>직접 입력·한투 매매·배당·분배금·이자·과거 확정자료를 함께 표시합니다. 한투 조회자료는 현재 잔고·평단·거래 가능 현금 계산에 다시 더하지 않습니다.</details></div>`;
}
function openPensionKisOrderDetail(orderKey) { const t = brokerKisVisibleOrders(state.brokerKis, 'all').find(x => x.id === orderKey); if (!t)
    return toast('한투 체결자료를 찾지 못했습니다.'); const account = t.accountKind === 'irp' ? 'IRP' : '연금저축'; $('#sheetEyebrow').textContent = `${account} · 한투 자동조회`; $('#sheetTitle').textContent = `${pensionTradeLabel(t.type)} · ${t.productName}`; $('#sheetBody').innerHTML = `<div class="profitbox"><div class="metric"><span>체결금액</span><strong>${won(t.amount)}</strong></div><div class="metric"><span>체결일</span><strong>${formatDate(t.date)}</strong></div></div><div class="sheetrows"><div class="sheetrow"><span>계좌</span><strong>${account}</strong></div><div class="sheetrow"><span>종목코드</span><strong>${escapeHtml(t.productCode || '-')}</strong></div><div class="sheetrow"><span>수량 × 평균단가</span><strong>${quantityNumber(t.qty)}주 × ${won(t.price)}</strong></div><div class="sheetrow"><span>체결상태</span><strong>${t.status === 'filled' ? '전량 체결' : '일부 체결'}</strong></div><div class="sheetrow"><span>수수료·세금</span><strong>${won((Number(t.fee) || 0) + (Number(t.tax) || 0))}</strong></div><div class="sheetrow"><span>저장방식</span><strong>한투 조회 · 읽기 전용</strong></div></div><div class="source-note">현재 잔고는 한투 잔고 조회값을 사용하므로 이 체결금액을 자산에 다시 더하지 않습니다.</div>`; openSheet('#detailSheet'); }
function openPensionKisRightDetail(rightKey) { const t = brokerKisRightIncomeRecords(state.brokerKis, '').find(x => x.id === rightKey); if (!t)
    return toast('한투 수령자료를 찾지 못했습니다.'); const account = t.accountKind === 'irp' ? 'IRP' : '연금저축', type = brokerKisIncomeTypeLabel(t.type); $('#sheetEyebrow').textContent = `${account} · 한투 자동조회`; $('#sheetTitle').textContent = `${type} · ${t.productName || t.label}`; $('#sheetBody').innerHTML = `<div class="profitbox"><div class="metric"><span>실수령액</span><strong>${won(t.amount)}</strong></div><div class="metric"><span>지급일</span><strong>${formatDate(t.date)}</strong></div></div><div class="sheetrows"><div class="sheetrow"><span>상위 분류</span><strong>${t.incomeCategory === 'dividend' ? '배당수익' : t.incomeCategory === 'interest' ? '이자수익' : '기타수익'}</strong></div><div class="sheetrow"><span>세부 유형</span><strong>${type}</strong></div><div class="sheetrow"><span>계좌</span><strong>${account}</strong></div><div class="sheetrow"><span>종목코드</span><strong>${escapeHtml(t.productCode || '-')}</strong></div><div class="sheetrow"><span>분류 근거</span><strong>${t.classificationBasis === 'event-description' ? '지급 유형 확인' : t.classificationBasis === 'name-inferred' ? '종목명 기준 추정' : t.classificationBasis === 'instrument-inferred' ? '상품 유형 기준 추정' : '미확인'}</strong></div><div class="sheetrow"><span>원본 권리코드</span><strong>${escapeHtml(t.rightTypeCode || '-')}</strong></div>${t.rightTypeName ? `<div class="sheetrow"><span>원본 지급 유형</span><strong>${escapeHtml(t.rightTypeName)}</strong></div>` : ''}${t.baseDate ? `<div class="sheetrow"><span>권리 기준일</span><strong>${formatDate(t.baseDate)}</strong></div>` : ''}<div class="sheetrow"><span>지급 총액</span><strong>${won(t.grossAmount)}</strong></div><div class="sheetrow"><span>세금</span><strong>${won(t.tax)}</strong></div><div class="sheetrow total"><span>실수령액</span><strong>${won(t.amount)}</strong></div><div class="sheetrow"><span>저장방식</span><strong>한투 조회 · 읽기 전용</strong></div></div><div class="source-note">배당 분석과 거래이력에는 포함하지만, 한투 현재 잔고를 사용하므로 계좌 현금에 다시 더하지 않습니다.</div>`; openSheet('#detailSheet'); }
function pensionTradeFormMarkup(tx = null, preferredAccountId = '') { const type = tx?.type || 'buy', accountId = tx?.accountId || (preferredAccountId && pensionAccount(preferredAccountId)?.status === 'active' ? preferredAccountId : '') || pensionStore().accounts.find(a => a.status === 'active' && (pensionAssetScope() === 'all' || a.kind === pensionAssetScope()))?.id || pensionStore().accounts.find(a => a.status === 'active')?.id || '', holdings = pensionStore().holdings.filter(h => h.accountId === accountId), holdingId = tx?.holdingId || holdings[0]?.id || '', role = tx?.newRole || '성장'; return `<form id="pensionTradeForm" class="form" data-editing-id="${escapeHtml(tx?.id || '')}"><div class="form-grid"><div class="field"><label>거래 유형</label><select name="type">${[['buy', '매수'], ['sell', '매도'], ['dividend', '배당'], ['distribution', '분배금'], ['interest', '이자'], ['other_right', '기타 권리'], ['adjustment', '보정']].map(([v, l]) => `<option value="${escapeHtml(v)}" ${type === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div><div class="field"><label>계좌</label><select name="accountId">${pensionStore().accounts.filter(a => a.status === 'active').map(a => `<option value="${escapeHtml(a.id)}" ${a.id === accountId ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}</select></div></div><div class="field"><label>거래일</label><input name="date" type="date" value="${escapeHtml(tx?.date || ymd())}" required></div><div class="field pension-trade-holding"><label>종목</label><select name="holdingId">${holdings.map(h => `<option value="${escapeHtml(h.id)}" ${h.id === holdingId ? 'selected' : ''}>${escapeHtml(h.name)} · ${escapeHtml(investmentRoleMeta(h))}</option>`).join('')}<option value="__new__">＋ 신규 종목</option><option value="__cash__">계좌 현금</option></select></div><div class="pension-new-holding hidden-field"><div class="field"><label>신규 종목명</label><input name="newName" placeholder="종목명"></div><div class="form-grid"><div class="field"><label>투자 역할</label><select name="newRole">${INVESTMENT_ROLES.map(x => `<option ${x === role ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div class="field"><label>보조 태그</label><input name="themeTag" placeholder="예: 반도체"></div></div></div><div class="pension-qty-price form-grid"><div class="field"><label>수량</label><input name="qty" type="number" inputmode="decimal" min="0" step="0.000001" value="${escapeHtml(tx?.qty || '')}"></div><div class="field"><label>단가</label><input name="price" type="number" inputmode="numeric" min="0" step="1" value="${escapeHtml(tx?.price || '')}"></div></div><div class="pension-income-amount field"><label>수령액</label><input name="amount" type="number" inputmode="numeric" min="0" step="1" value="${escapeHtml(tx?.amount || '')}"></div><div class="pension-adjust-fields form-grid"><div class="field"><label>보정 수량</label><input name="setQty" type="number" min="0" step="0.000001" value="${escapeHtml(tx?.setQty || '')}"></div><div class="field"><label>보정 평단</label><input name="setAvg" type="number" min="0" step="1" value="${escapeHtml(tx?.setAvg || '')}"></div></div><div class="pension-cost-fields form-grid"><div class="field"><label>수수료</label><input name="fee" type="number" min="0" step="1" value="${escapeHtml(tx?.fee || 0)}"></div><div class="field"><label>세금</label><input name="tax" type="number" min="0" step="1" value="${escapeHtml(tx?.tax || 0)}"></div></div><div class="field"><label>메모</label><input name="note" value="${escapeHtml(tx?.note || '')}"></div><div class="form-actions"><button type="button" class="form-btn" data-pension-trade-cancel>취소</button><button class="form-btn primary">${tx ? '수정 저장' : '거래 저장'}</button></div></form>`; }
function updatePensionTradeFormVisibility() { const f = $('#pensionTradeForm'); if (!f)
    return; const type = f.elements.type.value, accountId = f.elements.accountId.value, holding = f.elements.holdingId; const prev = holding.value, allowed = pensionStore().holdings.filter(h => h.accountId === accountId); holding.innerHTML = allowed.map(h => `<option value="${escapeHtml(h.id)}">${escapeHtml(h.name)} · ${escapeHtml(investmentRoleMeta(h))}</option>`).join('') + '<option value="__new__">＋ 신규 종목</option><option value="__cash__">계좌 현금</option>'; if ([...holding.options].some(o => o.value === prev))
    holding.value = prev;
else
    holding.value = allowed[0]?.id || '__new__'; const isNew = type === 'buy' && holding.value === '__new__'; f.querySelector('.pension-new-holding')?.classList.toggle('hidden-field', !isNew); f.querySelector('.pension-qty-price')?.classList.toggle('hidden-field', !['buy', 'sell'].includes(type)); f.querySelector('.pension-income-amount')?.classList.toggle('hidden-field', !['dividend', 'distribution', 'interest', 'other_right'].includes(type)); f.querySelector('.pension-adjust-fields')?.classList.toggle('hidden-field', type !== 'adjustment'); f.querySelector('.pension-cost-fields')?.classList.toggle('hidden-field', !['buy', 'sell', 'dividend', 'distribution', 'interest', 'other_right'].includes(type)); const newOption = holding.querySelector('option[value="__new__"]'), cashOption = holding.querySelector('option[value="__cash__"]'); if (newOption)
    newOption.disabled = type !== 'buy'; if (cashOption)
    cashOption.disabled = !['dividend', 'distribution', 'interest', 'other_right'].includes(type); if (type !== 'buy' && holding.value === '__new__')
    holding.value = allowed[0]?.id || '__cash__'; if (!['dividend', 'distribution', 'interest', 'other_right'].includes(type) && holding.value === '__cash__')
    holding.value = allowed[0]?.id || '__new__'; }
let openPensionTradeForm = function (id = '', returnTab = 'transactions', preferredAccountId = '') { const tx = id ? pensionStore().transactions.find(x => x.id === id) : null; $('#formEyebrow').textContent = '개인연금 거래'; $('#formTitle').textContent = tx ? '거래 수정' : '거래 입력'; $('#formBody').innerHTML = pensionTradeFormMarkup(tx, preferredAccountId); openSheet('#formSheet', { mode: 'input' }); const f = $('#pensionTradeForm'); f.dataset.returnTab = returnTab; updatePensionTradeFormVisibility(); f.elements.type.onchange = updatePensionTradeFormVisibility; f.elements.accountId.onchange = updatePensionTradeFormVisibility; f.elements.holdingId.onchange = updatePensionTradeFormVisibility; $('[data-pension-trade-cancel]').onclick = () => requestCloseSheets('cancel'); f.onsubmit = async (e) => { e.preventDefault(); const fd = new FormData(f), editingId = f.dataset.editingId || '', type = String(fd.get('type')), accountId = String(fd.get('accountId')), holdingChoice = String(fd.get('holdingId')), candidate = { type, accountId, holdingId: holdingChoice === '__cash__' ? '' : holdingChoice, date: String(fd.get('date') || ymd()), qty: Number(fd.get('qty')) || 0, price: Number(fd.get('price')) || 0, amount: Number(fd.get('amount')) || 0, fee: Number(fd.get('fee')) || 0, tax: Number(fd.get('tax')) || 0, setQty: Number(fd.get('setQty')) || 0, setAvg: Number(fd.get('setAvg')) || 0, note: String(fd.get('note') || '') }; let addedHolding = null; if (type === 'buy' && holdingChoice === '__new__') {
    const name = String(fd.get('newName') || '').trim();
    if (!name)
        return toast('신규 종목명을 입력해 주세요.');
    addedHolding = { id: uid('ph'), accountId, name, investmentRole: normalizeInvestmentRole(String(fd.get('newRole') || '성장')), themeTag: String(fd.get('themeTag') || ''), assetClass: normalizeInvestmentRole(String(fd.get('newRole') || '성장')), productType: 'ETF', baselineQty: 0, baselineAvgPrice: 0, qty: 0, avgPrice: 0, currentPrice: candidate.price, risky: !['안정', '현금'].includes(String(fd.get('newRole'))), order: pensionStore().holdings.length + 1 };
    pensionStore().holdings.push(addedHolding);
    candidate.holdingId = addedHolding.id;
} const h = pensionHoldingById(candidate.holdingId), previousCurrentPrice = h?.currentPrice; if (h && candidate.price > 0)
    h.currentPrice = candidate.price; const result = (await pensionTransactionSave(candidate, editingId)); if (!result.ok) {
    if (addedHolding)
        pensionStore().holdings = pensionStore().holdings.filter(x => x.id !== addedHolding.id);
    else if (h)
        h.currentPrice = previousCurrentPrice;
    syncPensionDerivedHoldings();
    return toast(result.error);
} if (!(await persist())) {
    return;
} sheetDirty = false; const returnTab = f.dataset.returnTab || 'transactions'; closeSheets(); nav('pension', returnTab); toast(editingId ? '거래를 수정했습니다.' : '거래를 저장했습니다.'); }; };
function openPensionAccountForm(kind = 'pension') { $('#formEyebrow').textContent = '개인연금 계좌'; $('#formTitle').textContent = `새 ${pensionAccountKindLabel(kind)} 계좌`; $('#formBody').innerHTML = `<form id="pensionAccountForm" class="form"><div class="field"><label>구분</label><select name="kind"><option value="pension" ${kind === 'pension' ? 'selected' : ''}>연금저축</option><option value="irp" ${kind === 'irp' ? 'selected' : ''}>IRP</option></select></div><div class="field"><label>계좌 이름</label><input name="name" placeholder="예: 한국투자 연금저축" required></div><div class="form-grid"><div class="field"><label>금융회사</label><input name="provider" placeholder="금융회사"></div><div class="field"><label>개설일</label><input name="openedAt" type="date" value="${escapeHtml(ymd())}" required></div></div><div class="source-note">새 계좌는 현재 적용 중인 해당 제도 버전을 연결합니다. 과거 거래와 기존 계좌는 덮어쓰지 않습니다.</div><div class="form-actions"><button type="button" class="form-btn" data-pension-account-cancel>취소</button><button class="form-btn primary">계좌 추가</button></div></form>`; openSheet('#formSheet', { mode: 'input' }); $('[data-pension-account-cancel]').onclick = () => requestCloseSheets('cancel'); $('#pensionAccountForm').onsubmit = async (e) => { e.preventDefault(); const fd = new FormData(e.currentTarget), result = createPensionAccount({ kind: String(fd.get('kind')), name: String(fd.get('name')), provider: String(fd.get('provider')), openedAt: String(fd.get('openedAt')) }); if (!result.ok)
    return toast(result.error); const account = result.account; if (!(await persist()))
    return; sheetDirty = false; closeSheets(); render(); setTimeout(openPensionAccountManager, 70); toast(`${account.name} 계좌를 추가했습니다.`); }; }
function openPensionAccountManager() {
    const rows = pensionStore().accounts.slice().sort((a, b) => (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1) || String(a.openedAt).localeCompare(String(b.openedAt)));
    $('#sheetEyebrow').textContent = '개인연금 · 장기 관리';
    $('#sheetTitle').textContent = '연금저축·IRP 계좌';
    $('#sheetBody').innerHTML = `<div class="registration-toolbar"><button class="primary" data-new-pension-account="pension">＋ 연금저축 계좌</button><button data-new-pension-account="irp">＋ IRP 계좌</button></div><div class="pension-account-list">${rows.map(a => { const e = pensionAccountExposure(a.id), p = policy(a.kind, a); return `<div class="pension-account-item"><div class="pension-account-item-head"><div><strong>${escapeHtml(a.name)}</strong><small>${escapeHtml(pensionAccountKindLabel(a.kind))} · ${escapeHtml(a.provider || '금융회사 미입력')} · ${formatDate(a.openedAt)}${a.closedAt ? ` ~ ${formatDate(a.closedAt)}` : ''}<br>${escapeHtml(p?.name || '제도 미연결')} · 평가 ${won(e.value)} · 현금 ${won(e.cash)}</small></div><span class="pension-account-state ${a.status === 'active' ? '' : 'archived'}">${a.status === 'active' ? '운영' : '보관'}</span></div><div class="pension-account-actions"><button data-pension-account-trade="${escapeHtml(a.id)}">거래 입력</button>${a.status === 'active' ? `<button class="danger" data-pension-account-archive="${escapeHtml(a.id)}">보관 전환</button>` : `<button data-pension-account-reopen="${escapeHtml(a.id)}">다시 운영</button>`}</div></div>`; }).join('') || '<div class="empty-state"><span>등록된 연금계좌가 없습니다.</span></div>'}</div><div class="source-note">계좌를 삭제하지 않고 보관 상태로 남깁니다. 보유종목 또는 계좌 현금이 남은 계좌는 보관 전환할 수 없습니다. 복수 계좌가 생기면 통합 일정에서 실제 납입 대상을 선택합니다.</div>`;
    openSheet('#detailSheet');
    $$('[data-new-pension-account]').forEach(b => b.onclick = () => openPensionAccountForm(b.dataset.newPensionAccount));
    $$('[data-pension-account-trade]').forEach(b => b.onclick = async () => { const a = pensionAccount(b.dataset.pensionAccountTrade); if (!a || a.status !== 'active')
        return toast('운영 중인 계좌에서만 거래를 입력할 수 있습니다.'); setting().pensionAssetScope = a.kind; rememberViewPreferences(); openPensionTradeForm('', 'assets', a.id || ''); });
    $$('[data-pension-account-archive]').forEach(b => b.onclick = () => showDialog({ title: '이 계좌를 보관할까요?', message: '계좌는 삭제되지 않고 과거 기록으로 남습니다. 보유종목과 계좌 현금이 0이어야 합니다.', confirmText: '보관', cancelText: '취소' }, async () => { const r = archivePensionAccount(b.dataset.pensionAccountArchive || ''); if (!r.ok)
        return toast(r.error); if (!(await persist()))
        return; closeSheets(); render(); setTimeout(openPensionAccountManager, 70); toast('계좌를 보관으로 전환했습니다.'); }));
    $$('[data-pension-account-reopen]').forEach(b => b.onclick = async () => { const r = reopenPensionAccount(b.dataset.pensionAccountReopen || ''); if (!r.ok)
        return toast(r.error); if (!(await persist()))
        return; closeSheets(); render(); setTimeout(openPensionAccountManager, 70); toast('계좌를 다시 운영 상태로 전환했습니다.'); });
}
function openPensionTransactionDetail(id) { const t = pensionStore().transactions.find(x => x.id === id); if (!t)
    return toast('거래를 찾지 못했습니다.'); const a = pensionAccount(t.accountId), h = pensionStore().holdings.find(x => x.id === t.holdingId) || pensionHoldingById(t.holdingId), amount = ['buy', 'sell'].includes(t.type || '') ? (Number(t.qty) || 0) * (Number(t.price) || 0) : (Number(t.amount) || 0); $('#sheetEyebrow').textContent = pensionAccountKindLabel(a?.kind); $('#sheetTitle').textContent = pensionTradeLabel(t.type); $('#sheetBody').innerHTML = `<div class="profitbox"><div class="metric"><span>금액</span><strong>${t.type === 'adjustment' ? `${quantityNumber(t.setQty)}주` : won(amount)}</strong></div><div class="metric"><span>거래일</span><strong>${formatDate(t.date)}</strong></div></div><div class="sheetrows"><div class="sheetrow"><span>계좌</span><strong>${escapeHtml(a?.name || '-')}</strong></div><div class="sheetrow"><span>종목</span><strong>${escapeHtml(h?.name || t.productName || t.label || (t.type === 'interest' ? '계좌 현금' : '-'))}</strong></div>${['buy', 'sell'].includes(t.type || '') ? `<div class="sheetrow"><span>수량 × 단가</span><strong>${quantityNumber(t.qty)}주 × ${won(t.price)}</strong></div>` : ''}<div class="sheetrow"><span>수수료·세금</span><strong>${won((Number(t.fee) || 0) + (Number(t.tax) || 0))}</strong></div><div class="sheetrow"><span>메모</span><strong>${escapeHtml(t.note || '-')}</strong></div></div><div class="integrated-detail-actions"><button data-pension-tx-edit>수정</button><button class="danger" data-pension-tx-delete>삭제</button></div>`; openSheet('#detailSheet'); $('[data-pension-tx-edit]').onclick = () => openPensionTradeForm(id); $('[data-pension-tx-delete]').onclick = () => showDialog({ title: '이 거래를 삭제할까요?', message: '삭제하면 보유수량·평단·현금·배당 합계를 원장에서 다시 계산합니다.', confirmText: '삭제', cancelText: '취소', danger: true }, async () => { if (!(await pensionTransactionDelete(id)))
    return toast(pensionTransactionDeleteError || '거래를 삭제할 수 없습니다.'); if (!(await persist()))
    return; closeSheets(); nav('pension', 'transactions'); toast('거래를 삭제했습니다.'); }); }
function pensionContributionBatchAccountOptions(kind) { return pensionStore().accounts.filter(a => a.kind === kind && a.status === 'active').map(a => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.name)}</option>`).join(''); }
function pensionContributionBatchMonthChecks(kind, throughMonth) { return Array.from({ length: throughMonth }, (_, i) => `<label class="pension-batch-month"><input type="checkbox" name="${kind}Month" value="${escapeHtml(i + 1)}" checked><span>${i + 1}월</span></label>`).join(''); }
function openPensionContributionBatchForm() {
    const year = localYmd().slice(0, 4), day = 25, throughMonth = pensionContributionBatchLatestMonth(year, day);
    $('#formEyebrow').textContent = '개인연금 · 납입 원장';
    $('#formTitle').textContent = '월 납입 기록 맞추기';
    $('#formBody').innerHTML = `<form id="pensionContributionBatchForm" class="form"><div class="source-note">실제로 납입한 월만 선택하세요. 기존 수동 기록은 보존하며, 이 화면에서 만든 같은 연도 기록만 안전하게 다시 맞춥니다.</div><div class="form-grid"><div class="field"><label>연도</label><input name="year" type="number" min="2000" max="${escapeHtml(year)}" value="${escapeHtml(year)}" required></div><div class="field"><label>기록 기준월</label><input name="throughMonth" type="number" min="1" max="12" value="${escapeHtml(throughMonth)}" required></div></div><div class="field"><label>납입일</label><input name="day" type="number" min="1" max="28" value="25" required></div><section class="pension-batch-kind"><h3>연금저축</h3><div class="form-grid"><div class="field"><label>월 납입액</label><input name="pensionAmount" type="number" inputmode="numeric" min="0" step="1" value="500000" required></div><div class="field"><label>연결 계좌</label><select name="pensionAccountId" required>${pensionContributionBatchAccountOptions('pension')}</select></div></div><div class="pension-batch-months">${pensionContributionBatchMonthChecks('pension', throughMonth)}</div></section><section class="pension-batch-kind"><h3>IRP</h3><div class="form-grid"><div class="field"><label>월 납입액</label><input name="irpAmount" type="number" inputmode="numeric" min="0" step="1" value="250000" required></div><div class="field"><label>연결 계좌</label><select name="irpAccountId" required>${pensionContributionBatchAccountOptions('irp')}</select></div></div><div class="pension-batch-months">${pensionContributionBatchMonthChecks('irp', throughMonth)}</div></section><div class="source-note">저장하면 선택 월의 납입 원장과 앞으로의 매월 납입 일정이 함께 정리됩니다. 미래월은 완료 처리하지 않습니다.</div><div class="form-actions"><button type="button" class="form-btn" data-pension-batch-cancel>취소</button><button class="form-btn primary">검토 후 저장</button></div></form>`;
    openSheet('#formSheet', { mode: 'input' });
    const f = $('#pensionContributionBatchForm');
    $('[data-pension-batch-cancel]').onclick = () => requestCloseSheets('cancel');
    f.onsubmit = (e) => { e.preventDefault(); const fd = new FormData(f), input = { year: String(fd.get('year')), throughMonth: Number(fd.get('throughMonth')), day: Number(fd.get('day')), pensionAmount: Number(fd.get('pensionAmount')), irpAmount: Number(fd.get('irpAmount')), pensionAccountId: String(fd.get('pensionAccountId')), irpAccountId: String(fd.get('irpAccountId')), months: { pension: fd.getAll('pensionMonth').map(Number), irp: fd.getAll('irpMonth').map(Number) } }, candidate = pensionContributionBatchCandidate(input); if (!candidate.ok)
        return toast(candidate.error); showDialog({ title: `${input.year}년 납입 기록을 저장할까요?`, message: `새로 반영할 금액은 연금저축 ${won(candidate.summary.pension)}, IRP ${won(candidate.summary.irp)}, 합계 ${won(candidate.summary.total)}입니다. 선택하지 않은 월은 미납으로 남습니다.`, confirmText: '저장', cancelText: '취소' }, async () => { const result = applyPensionContributionBatch(input); if (!result.ok)
        return toast(result.error); if (!(await persist(false)))
        return; sheetDirty = false; closeSheets(); nav('pension', 'contribution'); toast(`${input.year}년 월별 납입 기록을 저장했습니다.`); }); };
}
function pensionTradeCandidateFromForm(form) { const data = new FormData(form), type = String(data.get('type')), holdingChoice = String(data.get('holdingId')); return { id: 'pension-form-preview', type, accountId: String(data.get('accountId')), holdingId: holdingChoice === '__cash__' ? '' : holdingChoice, date: String(data.get('date') || ymd()), qty: Number(data.get('qty')) || 0, price: Number(data.get('price')) || 0, amount: Number(data.get('amount')) || 0, fee: Number(data.get('fee')) || 0, tax: Number(data.get('tax')) || 0, setQty: Number(data.get('setQty')) || 0, setAvg: Number(data.get('setAvg')) || 0, note: String(data.get('note') || ''), createdAt: new Date().toISOString() }; }
function pensionTradeFormError(form, complete = false) { const data = new FormData(form), candidate = pensionTradeCandidateFromForm(form), holdingChoice = String(data.get('holdingId')), isTrade = ['buy', 'sell'].includes(candidate.type), isIncome = ['dividend', 'distribution', 'interest', 'other_right'].includes(candidate.type); if (candidate.type === 'buy' && holdingChoice === '__new__' && !String(data.get('newName') || '').trim())
    return complete ? '신규 종목명을 입력해 주세요.' : ''; if (!complete && ((isTrade && (!String(data.get('qty') || '') || !String(data.get('price') || ''))) || (isIncome && !String(data.get('amount') || ''))))
    return ''; const dateError = pensionTransactionDateError(pensionAccount(candidate.accountId), candidate.date); if (dateError)
    return dateError; const numericError = transactionNumericError(candidate); if (numericError)
    return numericError; if (holdingChoice === '__new__')
    return ''; const editingId = form.dataset.editingId || '', list = pensionStore().transactions.filter(x => x.id !== editingId); list.push(candidate); const issue = pensionTransactionIssues(list).find(x => String(x).startsWith(candidate.id + ':')); return issue ? String(issue).replace(candidate.id + ': ', '') : ''; }
function pensionTradeRequiredFields(form) { const type = form.elements.type.value, isTrade = ['buy', 'sell'].includes(type), isIncome = ['dividend', 'distribution', 'interest', 'other_right'].includes(type), isNew = type === 'buy' && form.elements.holdingId.value === '__new__'; form.elements.qty.required = isTrade; form.elements.price.required = isTrade; form.elements.amount.required = isIncome; form.elements.newName.required = isNew; form.elements.qty.min = isTrade ? '0.000001' : '0'; form.elements.price.min = isTrade ? '1' : '0'; form.elements.amount.min = isIncome ? '1' : '0'; }
const openPensionTradeFormWithoutInlineValidation = openPensionTradeForm;
openPensionTradeForm = function (...args) { openPensionTradeFormWithoutInlineValidation(...args); const form = $('#pensionTradeForm'); if (!form)
    return; form.querySelector('.form-actions')?.insertAdjacentHTML('beforebegin', formValidationMarkup()); pensionTradeRequiredFields(form); for (const control of [form.elements.type, form.elements.accountId, form.elements.holdingId]) {
    const previous = control.onchange;
    control.onchange = (event) => { previous?.call(control, event); pensionTradeRequiredFields(form); formClearError(form); };
} const live = (event) => { if (!['qty', 'price', 'amount', 'fee', 'tax', 'setQty', 'setAvg', 'date', 'newName'].includes(event.target?.name || ''))
    return; const error = pensionTradeFormError(form, false); if (error)
    formShowError(form, error);
else
    formClearError(form); }; form.addEventListener('input', live); const submit = form.onsubmit; form.onsubmit = (event) => { const error = pensionTradeFormError(form, true); if (error) {
    event.preventDefault();
    formShowError(form, error);
    toast(error);
    return;
} submit?.call(form, event); }; };
;
/* asset-os source: pension-pages.js */
'use strict';
function pensionTabs(tab = 'contribution') { return `<div class="tabs pension-step-tabs">${[['contribution', '납입·공제'], ['assets', '자산'], ['future', '미래연금'], ['transactions', '거래']].map(([k, l]) => `<button class="tab ${tab === k ? 'active' : ''}" data-pension-tab="${escapeHtml(k)}">${l}</button>`).join('')}</div>`; }
function pensionContributionPage() { const current = localYmd(), y = current.slice(0, 4), m = pensionSummary(y), expanded = !!setting().pensionGoalExpanded, psPct = Math.min(100, m.ordinaryPs / Math.max(1, m.goalPs) * 100), irpPct = Math.min(100, m.ordinaryIrp / Math.max(1, m.goalIrp) * 100), goalPct = Math.min(100, m.goalCurrent / Math.max(1, m.goalTotal) * 100), months = pensionMonthly(y), nowMonth = Number(current.slice(5, 7)); return `<div class="stack"><section class="pension-credit-hero"><div class="pension-credit-title"><div><div class="eyebrow">개인연금 · 납입·공제</div><h2>${m.transfer ? '올해 납입·전환' : '올해 납입'}</h2></div><span class="pension-credit-year">${y}</span></div><div class="pension-inflow">${won(m.total)}</div>${m.transfer ? `<div class="pension-inflow-sub">납입 ${won(m.ordinary)} · ISA 전환 ${won(m.transfer)}</div>` : ''}<div class="pension-kpis"><div class="pension-kpi accent"><span>공제 대상액</span><strong>${won(m.creditBase)}</strong></div><div class="pension-kpi"><span>예상 세액공제</span><strong>${won(m.estimatedCredit)}</strong></div><div class="pension-kpi"><span>현재 공제한도</span><strong>${won(m.totalCreditLimit)}</strong></div><div class="pension-kpi"><span>남은 공제한도</span><strong>${won(m.remainingCredit)}</strong></div></div></section>${pensionTabs('contribution')}<button class="pension-contribution-batch-open" data-pension-contribution-batch>월 납입 기록 맞추기</button><section class="card pension-goal ${expanded ? 'open' : ''}"><button class="pension-goal-head" data-pension-goal-toggle><span><strong>내 공제 목표</strong></span><span class="pension-goal-arrow">⌄</span></button><div class="pension-goal-total"><span>진행</span><strong>${won(m.goalCurrent)} / ${won(m.goalTotal)}</strong></div><div class="progress"><i style="width:${goalPct}%"></i></div>${expanded ? `<div class="pension-goal-detail"><div><div class="goal-row-head"><span>연금저축 600</span><strong>${won(m.ordinaryPs)} / ${won(m.goalPs)}</strong></div><div class="progress"><i style="width:${psPct}%"></i></div></div><div><div class="goal-row-head"><span>IRP 300</span><strong>${won(m.ordinaryIrp)} / ${won(m.goalIrp)}</strong></div><div class="progress"><i style="width:${irpPct}%"></i></div></div></div>` : ''}</section><section class="card monthly-card compact ${pensionMonthsExpanded ? 'expanded' : ''}" data-pension-monthly-card><div class="sectionhead"><div><h2>${y} 월별 납입</h2><small style="display:block;color:var(--muted);margin-top:3px">기본은 이번 달만 표시</small></div><button class="monthly-toggle" data-pension-months-toggle aria-expanded="${escapeHtml(pensionMonthsExpanded ? 'true' : 'false')}">${pensionMonthsExpanded ? '접기' : '12개월 펼치기'}</button></div><div class="monthly-head"><span>월</span><span>연금저축</span><span>IRP</span><span>합계</span></div><div class="monthly-list">${months.map(r => `<div class="monthly-month ${r.month === nowMonth ? 'current' : ''}"><div class="monthly-row"><strong>${r.month}월</strong><span class="${escapeHtml(r.pension ? '' : 'zero')}">${r.pension ? won(r.pension) : '0원'}</span><span class="${escapeHtml(r.irp ? '' : 'zero')}">${r.irp ? won(r.irp) : '0원'}</span><span class="${escapeHtml(r.total ? '' : 'zero')}">${r.total ? won(r.total) : '0원'}</span></div>${r.transfer ? `<div class="monthly-transfer"><strong>ISA 전환</strong><span>${r.transferPension ? `연금저축 ${won(r.transferPension)}` : ''}${r.transferPension && r.transferIrp ? ' · ' : ''}${r.transferIrp ? `IRP ${won(r.transferIrp)}` : ''}</span><b>+${won(r.transfer)}</b></div>` : ''}</div>`).join('')}</div><div class="monthly-total"><strong>납입 합계</strong><span>${won(m.ordinaryPs)}</span><span>${won(m.ordinaryIrp)}</span><span>${won(m.ordinary)}</span></div>${m.transfer ? `<div class="monthly-transfer-total"><strong>ISA 전환 합계</strong><span>${won(m.transfer)}</span></div>` : ''}</section><div class="monthly-scroll-guard" data-monthly-scroll-guard></div></div>`; }
function pensionScopeSwitch(scope) { return `<div class="pension-scope-switch">${[['all', '전체'], ['pension', '연금저축'], ['irp', 'IRP']].map(([k, l]) => `<button class="${escapeHtml(scope === k ? 'active' : '')}" data-pension-scope="${escapeHtml(k)}">${l}</button>`).join('')}</div>`; }
function pensionKisRefreshMarkup(scope) { if (scope !== 'all')
    return ''; const connections = ['pension', 'irp'].map(k => state.brokerKis?.connections?.[k]).filter((x) => !!x?.accountId); if (!connections.length)
    return ''; const times = connections.map((x) => String(x.lastCompleteSyncAt || '')).filter(Boolean).sort(), last = times[0] || '', incomplete = connections.some(x => x.lastError); return `<section class="manual-refresh-row pension-kis-refresh" data-pension-kis-refresh-status><div><strong>한투 연금 조회${incomplete ? ' · 확인 필요' : ''}</strong><small>${last ? `전체 완료 ${formatDateTime(last)}` : '아직 전체 갱신 전'} · 홈에서 전체 갱신</small></div></section>`; }
function openPensionTaxProfileForm() { const year = localYmd().slice(0, 4), profile = pensionTaxCreditProfile(year); $('#formEyebrow').textContent = '개인연금 · 세액공제'; $('#formTitle').textContent = `${year} 공제율 기준`; $('#formBody').innerHTML = `<form id="pensionTaxProfileForm" class="form"><div class="source-note">총급여 5,500만원 이하 또는 종합소득금액 4,500만원 이하는 16.5%, 초과는 13.2%를 적용합니다. 둘 중 해당하는 한 항목만 입력해도 됩니다.</div><div class="field"><label>총급여액</label><input name="grossSalary" type="number" min="0" step="10000" value="${escapeHtml(profile.grossSalary || '')}" placeholder="예: 62000000"></div><div class="field"><label>종합소득금액 · 근로소득자가 아니면 입력</label><input name="comprehensiveIncome" type="number" min="0" step="10000" value="${escapeHtml(profile.comprehensiveIncome || '')}"></div><button class="form-btn primary">저장</button></form>`; openSheet('#formSheet', { mode: 'input' }); $('#pensionTaxProfileForm').onsubmit = async (e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); setting().pensionTaxProfile = { ...(setting().pensionTaxProfile || {}), [year]: { grossSalary: Math.max(0, Math.round(Number(fd.get('grossSalary')) || 0)), comprehensiveIncome: Math.max(0, Math.round(Number(fd.get('comprehensiveIncome')) || 0)) } }; if (!(await persist(false)))
    return; sheetDirty = false; closeSheets(); render(); toast('해당 연도의 세액공제율 기준을 저장했습니다.'); }; }
let pensionExpandedAssetGroup = '';
let pensionMonthsExpanded = false, integratedAssetsExpanded = false;
function pensionCompositionCard(scope) { const model = pensionAssetModel(scope, 'assetClass'), focus = model.segments.some(x => x.key === setting().pensionAssetFocus) ? setting().pensionAssetFocus : '', selected = model.segments.find(x => x.key === focus), groupHoldings = selected ? pensionAssetGroupHoldings(scope, selected.key) : [], selectedRate = selected && selected.cost ? selected.profit / selected.cost * 100 : 0, selectedDetail = selected?.detail ? `<div class="source-note">${escapeHtml(selected.detail)}</div>` : ''; return `<section class="card pension-asset-card common-portfolio-card"><div class="sectionhead"><h2>포트폴리오 구성</h2><span class="count-pill">투자 역할</span></div><div class="pension-composition-main"><div class="donut-viz inline">${assetDonutSvg(model.segments, focus, 'data-pension-donut', '개인연금 자산군 구성')}<div class="pension-donut-center"><strong>${selected ? selected.pct.toFixed(1) + '%' : pensionAssetScopeLabel(scope)}</strong><small>${selected ? escapeHtml(selected.name) : `${model.holdings.length}개 보유`}</small></div></div><div class="pension-legend">${model.segments.map((x) => `<button class="${focus === x.key ? 'active' : ''} ${focus && focus !== x.key ? 'dimmed' : ''}" data-pension-group="${escapeHtml(x.key)}"><i style="background:${x.color}"></i><strong>${escapeHtml(x.name)}</strong><span>${x.pct.toFixed(1)}%</span></button>`).join('')}</div></div>${selected ? `<div class="pension-selected-panel expanded"><div class="pension-selected pension-selected-toggle"><span class="pension-selected-info"><strong>${escapeHtml(selected.name)}</strong><small>${selected.key === '현금' ? '계좌 현금' : selected.count === 0 ? '종목 상세 미연결' : `${selected.count}개 보유 · 전체 ${selected.pct.toFixed(1)}%`}</small></span><span class="pension-selected-result"><b>${won(selected.value)}</b><small class="${escapeHtml(selected.profit < 0 ? 'negative' : '')}">평가손익 ${signed(selected.profit)} · ${pct(selectedRate)}</small></span></div>${selectedDetail}<div class="pension-selected-list">${groupHoldings.map(pensionSelectedHoldingMarkup).join('') || (selected.key === '현금' ? `<div class="source-note">계좌 현금 ${won(selected.value)}</div>` : !selected.detail ? '<div class="empty-state"><span>해당 자산군의 보유종목이 없습니다.</span></div>' : '')}</div></div>` : ''}<div class="composition-summary-note">투자 역할을 누르면 바로 아래에 해당 종목이 펼쳐집니다.</div></section>`; }
function pensionSelectedHoldingMarkup(h) { const a = pensionHoldingAccount(h), value = pensionHoldingValue(h), cost = pensionHoldingCost(h), profit = value - cost, rate = cost ? profit / cost * 100 : 0, tag = h.readOnly ? 'div' : 'button', attr = h.readOnly ? '' : ` data-pension-holding="${escapeHtml(h.id)}"`; return `<${tag} class="pension-selected-row"${attr}><span class="pension-holding-copy"><span class="pension-holding-name"><strong>${escapeHtml(h.name)}</strong><span class="pension-account-badge">${h.readOnly ? '한투 조회' : pensionAccountKindLabel(a?.kind)}</span></span><small>${quantityNumber(h.qty)}주${h.readOnly ? ' · 읽기 전용' : ''}</small></span><span class="pension-holding-right"><strong>${won(value)}</strong><small class="${escapeHtml(profit < 0 ? 'negative' : '')}">${pct(rate)}</small></span></${tag}>`; }
function pensionHoldingRowsMarkup(hs) { return hs.map(h => { const a = pensionHoldingAccount(h), value = pensionHoldingValue(h), cost = pensionHoldingCost(h), profit = value - cost, rate = cost ? profit / cost * 100 : 0, tag = h.readOnly ? 'div' : 'button', attr = h.readOnly ? '' : ` data-pension-holding="${escapeHtml(h.id)}"`; return `<${tag} class="portfolio-holding-row"${attr}><span class="copy"><span class="name"><strong>${escapeHtml(h.name)}</strong><span class="pension-account-badge">${h.readOnly ? '한투 조회' : pensionAccountKindLabel(a?.kind)}</span></span><span class="meta">${escapeHtml(investmentRoleMeta(h))} · ${quantityNumber(h.qty)}주${h.readOnly ? ' · 읽기 전용' : ''}</span></span><span class="right"><strong>${won(value)}</strong><small class="${escapeHtml(profit < 0 ? 'negative' : '')}">${signed(profit)} · ${pct(rate)}</small></span></${tag}>`; }).join(''); }
function pensionHoldingsCard(scope) { const hs = pensionAssetMetrics(scope).holdings.slice().sort((x, y) => pensionHoldingValue(y) - pensionHoldingValue(x) || String(x.name).localeCompare(String(y.name), 'ko')); return `<section class="card portfolio-holdings-card" data-pension-holdings-card><div class="portfolio-holdings-head"><div><h2>보유종목</h2><span>${pensionAssetScopeLabel(scope)} · ${hs.length}개</span></div>${hs.length ? `<button class="portfolio-holdings-toggle" data-pension-holdings-toggle aria-expanded="${escapeHtml(pensionHoldingsExpanded ? 'true' : 'false')}">${pensionHoldingsExpanded ? '숨기기 ∧' : '펼치기 ∨'}</button>` : ''}</div><div class="portfolio-holdings-list" data-pension-holdings-extra ${pensionHoldingsExpanded ? '' : 'hidden'}>${pensionHoldingRowsMarkup(hs) || '<div class="empty-state"><span>보유종목이 없습니다.</span></div>'}</div></section><div class="inline-detail-guard" data-pension-holdings-guard></div>`; }
function pensionRiskCard(scope) { if (scope !== 'irp')
    return ''; const r = pensionRiskMetrics(), near = r.ratio >= 65 || !r.classificationComplete, stateClass = r.ratio > r.limit ? 'over' : near ? 'warn' : '', stateText = !r.classificationComplete ? `미분류 ${won(r.unknown)}` : r.ratio > r.limit ? `초과 +${(r.ratio - r.limit).toFixed(2)}%p` : `여유 ${Math.max(0, r.limit - r.ratio).toFixed(2)}%p`; return `<section class="card pension-risk ${near ? '' : 'compact'}"><div class="pension-risk-head"><div><span>IRP 위험자산${r.classificationComplete ? '' : ' · 확인 필요'}</span><strong>${r.ratio.toFixed(2)}% / ${r.limit.toFixed(0)}%</strong></div><div class="pension-risk-state ${stateClass}">${stateText}</div></div>${near ? `<div class="progress ${r.ratio > r.limit ? 'warn' : ''}"><i style="width:${Math.min(100, r.ratio / r.limit * 100)}%"></i></div>` : ''}${!r.classificationComplete ? '<div class="source-note">분류가 확인되지 않은 종목은 한도 여유로 계산하지 않습니다.</div><button class="diagnostic-action" data-pension-risk-classify>미분류 종목 확인</button>' : ''}</section>`; }
function pensionIncomeCard(scope) { const x = pensionIncomeSummary(scope), latest = x.records.find(row => row.amount > 0); return `<section class="card dividend-dashboard pension-income-card compact-analysis" data-pension-income-card><div class="sectionhead"><h2>배당·이자·권리 수익</h2><button class="analysis-toggle" data-pension-income-analysis aria-expanded="false">분석 ›</button></div><div class="dividend-metrics compact-four"><div class="dividend-metric emphasis"><span>누적 수령</span><strong class="${escapeHtml(amountClass(x.total))}" title="${escapeHtml(won(x.total))}">${displayWon(x.total)}</strong></div><div class="dividend-metric"><span>${x.year}년 수령</span><strong class="${escapeHtml(amountClass(x.yearTotal))}" title="${escapeHtml(won(x.yearTotal))}">${displayWon(x.yearTotal)}</strong></div><div class="dividend-metric"><span>${x.year} 현금수익률</span><strong>${x.yieldRate == null ? '계산 불가' : x.yieldRate.toFixed(2) + '%'}</strong></div><div class="dividend-metric"><span>최근 수령</span><strong>${latest ? won(latest.amount) : '-'}</strong><small>${latest ? escapeHtml(pensionHoldingById(latest.holdingId)?.name || pensionStore().holdings.find((h) => h.id === latest.holdingId)?.name || latest.productName || latest.label || '종목') : '내역 없음'}</small></div></div></section>`; }
function pensionAssetSourceNote(m) { if (m.source === 'kis' || m.source === 'mixed')
    return `<div class="source-note">한국투자 조회 · 펀드 등 종목 미제공 금액은 ‘한투 기타자산’으로 표시해요.${m.source === 'mixed' ? ' 일부 금액은 납입내역에서 가져옵니다.' : ''}</div>`; if (m.source === 'linked')
    return '<div class="source-note">현재는 납입내역으로 계산한 금액입니다. 종목과 손익은 한국투자 조회 또는 거래 입력 후 표시됩니다.</div>'; return ''; }
function pensionAssetsPage() { const scope = pensionAssetScope(), m = pensionAssetMetrics(scope), heroProfit = pensionHeroSigned(m.profit); return `<div class="stack"><section class="pension-asset-hero"><div class="pension-asset-label">투자자산 · ${pensionAssetScopeLabel(scope)} 평가액</div><div class="pension-asset-value ${amountClass(m.value)}" aria-label="${escapeHtml(won(m.value))}" title="${escapeHtml(won(m.value))}">${displayWon(m.value)}</div><div class="pension-asset-profit ${m.profit < 0 ? 'negative' : ''}" aria-label="평가손익 ${signed(m.profit)}">평가손익 ${heroProfit} · ${pct(m.rate)}</div><button class="pension-asset-analysis-open" data-pension-asset-analysis aria-expanded="false"><span>자산 분석</span><b>›</b></button></section>${pensionTabs('assets')}${pensionScopeSwitch(scope)}${pensionKisRefreshMarkup(scope)}<div class="pension-asset-actions"><button class="primary" data-pension-asset-trade>＋ 거래 입력</button><button data-pension-account-manage>계좌 관리 ›</button></div>${pensionAssetSourceNote(m)}${pensionCompositionCard(scope)}${pensionRiskCard(scope)}${pensionIncomeCard(scope)}${pensionHoldingsCard(scope)}</div>`; }
function pensionReachedPageMarkup(p) { return `<div class="profitbox future-primary"><div class="metric"><span>현재 연금자산</span><strong class="${escapeHtml(pensionFutureAmountClass(p.future))}" title="${escapeHtml(won(p.future))}">${pensionFutureHeadlineWon(p.future)}</strong></div><div class="metric"><span>월 연금 환산</span><strong class="${escapeHtml(pensionFutureAmountClass(p.monthlyPension))}" title="${escapeHtml(won(p.monthlyPension))}">${pensionFutureHeadlineWon(p.monthlyPension)}</strong></div></div><div class="pension-future-assumptions"><span>현재 ${p.currentAge}세</span><span>인출률 ${(p.withdrawal * 100).toFixed(1)}%</span><span>물가상승률 ${(p.inflation * 100).toFixed(1)}%</span></div><div class="pension-future-note">은퇴 목표 나이에 도달했습니다. 더 먼 시점을 보려면 계산 기준에서 목표 나이를 높여 주세요.</div>`; }
function pensionFuturePage() { pensionFutureSelectedAge = null; const p = pensionProjection(), content = p.years > 0 ? pensionFutureSheetMarkup() : pensionReachedPageMarkup(p); return `<div class="stack">${pensionTabs('future')}<section class="card pension-future-page"><div class="sectionhead"><h2>미래연금</h2><button data-pension-future-settings>기준 변경</button></div>${content}</section></div>`; }
function pensionPage(tab = 'contribution') { const safe = ['contribution', 'assets', 'future', 'transactions'].includes(tab) ? tab : 'contribution', content = safe === 'assets' ? pensionAssetsPage() : safe === 'future' ? pensionFuturePage() : safe === 'transactions' ? pensionTransactionPage() : pensionContributionPage(), tabs = pensionTabs(safe).replace('tabs pension-step-tabs', 'tabs module-primary-tabs pension-step-tabs'); return `<div class="module-page-shell pension-module-shell">${tabs}${content}</div>`; }
function pensionHoldingDetailMarkup(h) { const a = pensionHoldingAccount(h), value = pensionHoldingValue(h), cost = pensionHoldingCost(h), profit = value - cost, rate = cost ? profit / cost * 100 : 0, income = pensionIncomeRecords(a?.kind || 'all').filter(x => x.accountId === h.accountId && (x.holdingId === h.id || h.productCode && x.productCode === h.productCode)).reduce((s, x) => s + (Number(x.amount) || 0), 0); return `<div class="profitbox"><div class="metric"><span>평가금액</span><strong>${won(value)}</strong></div><div class="metric"><span>평가손익</span><strong class="${escapeHtml(profit >= 0 ? 'positive' : '')}">${signed(profit)}</strong></div></div><div class="sheetrows"><div class="sheetrow"><span>계좌</span><strong>${escapeHtml(a?.name || '-')}</strong></div><div class="sheetrow"><span>자산군</span><strong>${escapeHtml(h.assetClass)}</strong></div><div class="sheetrow"><span>수량</span><strong>${quantityNumber(h.qty)}주</strong></div><div class="sheetrow"><span>평균단가</span><strong>${won(h.avgPrice)}</strong></div><div class="sheetrow"><span>현재가</span><strong>${won(h.currentPrice)}</strong></div><div class="sheetrow"><span>수익률</span><strong>${pct(rate)}</strong></div><div class="sheetrow"><span>배당·이자·권리 수익</span><strong>${won(income)}</strong></div></div>`; }
function pensionContributionAnalysisMarkup(scope) { const c = pensionPerformanceContribution(scope), h = typeof pensionArchivePerformanceSummary === 'function' ? pensionArchivePerformanceSummary(scope) : { total: 0 }, confirmed = c.totalProfit + h.total, denom = Math.max(.0001, c.rows.reduce((sum, x) => sum + Math.abs(x.contribution), 0)); return `<div class="pension-earnings-grid"><div class="pension-earning-box primary"><span>현재 평가손익</span><strong class="${escapeHtml(c.totalProfit < 0 ? 'negative' : 'positive')}">${signed(c.totalProfit)}</strong></div><div class="pension-earning-box primary"><span>과거 확정수익</span><strong class="${escapeHtml(h.total < 0 ? 'negative' : 'positive')}">${signed(h.total)}</strong></div><div class="pension-earning-box"><span>누적 총수익</span><strong class="${escapeHtml(confirmed < 0 ? 'negative' : 'positive')}">${signed(confirmed)}</strong></div><div class="pension-earning-box"><span>현재 평가수익률</span><strong>${pct(c.totalRate)}</strong></div></div><div class="pension-contribution-list">${c.ranked.map((x) => { const share = Math.min(100, Math.abs(x.contribution) / denom * 100); return `<div class="pension-contribution-row"><strong>${escapeHtml(x.name)}</strong><div class="pension-contribution-track"><i class="${escapeHtml(x.contribution < 0 ? 'negative' : '')}" style="width:${share.toFixed(1)}%"></i></div><span class="pension-contribution-value"><b class="${escapeHtml(x.contribution < 0 ? 'negative' : 'positive')}">${x.contribution >= 0 ? '+' : ''}${x.contribution.toFixed(2)}%p</b><small>${signed(x.profit)} · ${pct(x.rate)}</small></span></div>`; }).join('')}</div><div class="source-note">자산군 막대는 현재 보유자산 평가손익 기준입니다. 제공하신 과거 실현손익·배당은 위 누적 총수익에 별도 반영하며, KIS 잔고에는 더하지 않습니다.</div>`; }
function openPensionHoldingDetail(id) { const h = pensionHoldingById(id); if (!h)
    return; $('#sheetEyebrow').textContent = pensionAccountKindLabel(pensionHoldingAccount(h)?.kind); $('#sheetTitle').textContent = h.name || ''; $('#sheetBody').innerHTML = pensionHoldingDetailMarkup(h); openSheet('#detailSheet'); }
;
/* asset-os source: chart-income.js */
'use strict';
let pensionIncomeAnalysisMode = 'month', pensionIncomeSelectedPoint = '', pensionIncomeYearRange = '10y', pensionIncomeChartMode = 'bar';
function pensionCompactWon(v) { let value = Math.max(0, Number(v) || 0); if (value >= 1000000000000)
    return `${(value / 1000000000000).toFixed(value >= 10000000000000 ? 0 : 1).replace(/\.0$/, '')}조`; if (value >= 100000000)
    return `${(value / 100000000).toFixed(value >= 1000000000 ? 0 : 1).replace(/\.0$/, '')}억`; if (value >= 10000)
    return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1).replace(/\.0$/, '')}만`; return `${Math.round(value).toLocaleString('ko-KR')}원`; }
function pensionHeroSigned(v) { const value = Number(v) || 0; return `${value >= 0 ? '+' : '-'}${Math.abs(value) >= 1000000000000 ? pensionCompactWon(Math.abs(value)) : won(Math.abs(value))}`; }
function pensionReadableWon(v) { const value = Math.max(0, Math.round(Number(v) || 0)); if (value >= 100000000)
    return displayWon(value); if (value >= 10000)
    return `${nf.format(Math.round(value / 10000))}만원`; return won(value); }
function pensionFutureHeadlineWon(v) { return pensionReadableWon(Math.max(0, Math.round(Number(v) || 0))); }
function pensionFutureAmountClass(v) { const c = amountClass(v); return c === 'amount-xxlong' ? 'xxlong' : c === 'amount-xlong' ? 'xlong' : c === 'amount-long' ? 'long' : ''; }
function incomeYearRangePoints(points, range = '10y') { const arr = [...(points || [])], limit = range === '5y' ? 5 : range === '10y' ? 10 : range === '20y' ? 20 : 0; return limit ? arr.slice(-limit) : arr; }
function incomeRecordSpanYears(records = []) { const months = [...(records || [])].map(x => String(x.date || '').slice(0, 7)).filter(x => /^\d{4}-\d{2}$/.test(x)).sort(); if (!months.length)
    return 0; const [ay, am] = months[0].split('-').map(Number), last = months.at(-1), [by, bm] = last.split('-').map(Number), count = Math.max(1, (by - ay) * 12 + (bm - am) + 1); return Math.max(1, Math.ceil(count / 12)); }
function incomeYearRangeControls(range, attr, totalYears) { if (totalYears <= 5)
    return ''; const options = [['5y', '5년']]; if (totalYears > 5)
    options.push(['10y', '10년']); if (totalYears > 10)
    options.push(['20y', '20년']); options.push(['all', `전체${totalYears > 20 ? ` ${totalYears}년` : ''}`]); const active = options.some(([k]) => k === range) ? range : 'all'; return `<div class="income-year-range" aria-label="연도 범위">${options.map(([k, l]) => `<button class="${escapeHtml(active === k ? 'active' : '')}" ${attr}="${k}">${l}</button>`).join('')}</div>`; }
function incomeChartModeControls(mode, attr) { return `<div class="income-chart-mode" aria-label="그래프 방식"><button class="${escapeHtml(mode === 'bar' ? 'active' : '')}" ${attr}="bar">수령액</button><button class="${escapeHtml(mode === 'line' ? 'active' : '')}" ${attr}="line">성장추이</button></div>`; }
function incomeRangeSummaryMarkup(points, amountTerm = '수령') { if (!points?.length)
    return ''; const sum = points.reduce((n, x) => n + (Number(x.value ?? x.amount) || 0), 0), recorded = points.filter(x => (Number(x.value ?? x.amount) || 0) > 0), first = recorded[0] || points[0], last = recorded.at(-1) || points.at(-1); return `<div class="income-range-summary"><div><span>선택기간 ${escapeHtml(amountTerm)}</span><strong aria-label="${escapeHtml(won(sum))}">${pensionCompactWon(sum)}</strong></div><div><span>수령 기록 기간</span><strong>${escapeHtml(first.key)}${first.key === last.key ? '' : ` → ${escapeHtml(last.key)}`}</strong></div></div>`; }
function incomeAxisMarkup(max, H = 170, T = 22, B = 28) { const CH = H - T - B, ticks = [max, max * .5, 0]; return `<svg class="income-y-svg" viewBox="0 0 42 ${H}" aria-hidden="true">${ticks.map((v, i) => { const y = T + CH * (i / (ticks.length - 1)); return `<text class="income-axis" x="38" y="${escapeHtml(y + 3)}" text-anchor="end">${pensionCompactWon(v)}</text>`; }).join('')}</svg>`; }
function commonIncomeChartMarkup(points, selectedKey, pointAttr, yearly = false, caption = '막대를 누르면 해당 기간 수령액과 수익률을 확인합니다.', chartMode = 'bar', longRange = false) {
    const normalized = points.map(x => ({ key: String(x.key || ''), label: String(x.label || ''), short: String(x.short ?? (yearly ? String(x.year || x.label || '').slice(-2) : String(x.month || x.label || '').replace('월', ''))), value: Math.max(0, Number(x.value ?? x.amount) || 0) }));
    if (!normalized.length || !normalized.some(x => x.value > 0))
        return `<div class="chart-panel income-chart-panel"><div class="empty-state"><strong>아직 받은 내역이 없습니다.</strong><span>배당·분배금·이자·기타 권리가 기록되면 그래프가 표시됩니다.</span></div></div>`;
    const H = 170, T = 22, B = 28, CH = H - T - B, maxRaw = Math.max(1, ...normalized.map(x => x.value)), max = pensionZeroAxisMax(maxRaw), per = yearly ? (normalized.length > 20 ? 34 : normalized.length > 10 ? 30 : 26) : 23, plotW = Math.max(278, normalized.length * per), step = plotW / Math.max(1, normalized.length), barW = Math.max(10, Math.min(22, step * .60)), labelEvery = yearly ? (normalized.length <= 10 ? 1 : Math.ceil(normalized.length / 8)) : 1, pointsXY = normalized.map((x, i) => ({ x: step * (i + .5), y: T + CH - (x.value / max) * CH, ...x }));
    const grid = [0, .5, 1].map(r => { const y = T + CH * r; return `<line class="income-grid" x1="0" y1="${escapeHtml(y)}" x2="${escapeHtml(plotW)}" y2="${escapeHtml(y)}"></line>`; }).join('');
    const xlabels = pointsXY.map((p, i) => { const show = !yearly || i === 0 || i === pointsXY.length - 1 || i % labelEvery === 0; return show ? `<text class="income-axis income-x" x="${escapeHtml(p.x.toFixed(2))}" y="${escapeHtml(H - 7)}" text-anchor="middle">${escapeHtml(yearly ? String(p.short) : String(i + 1))}</text>` : ''; }).join('');
    let marks = '';
    if (chartMode === 'line' && yearly) {
        const path = pointsXY.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
        marks = `<path class="income-growth-line" d="${escapeHtml(path)}"></path>${pointsXY.map((p, i) => { const selected = selectedKey === p.key; return `<g class="income-line-point ${selected ? 'active' : ''}" ${pointAttr}="${escapeHtml(p.key)}" tabindex="0" role="button" aria-label="${escapeHtml(p.label)} ${won(p.value)}"><rect class="income-line-hit" x="${escapeHtml((p.x - step / 2).toFixed(2))}" y="${escapeHtml(T)}" width="${escapeHtml(step.toFixed(2))}" height="${escapeHtml(CH)}"></rect><circle class="income-growth-dot" cx="${escapeHtml(p.x.toFixed(2))}" cy="${escapeHtml(p.y.toFixed(2))}" r="${escapeHtml(selected ? 5 : 3.2)}"></circle>${selected && p.value > 0 ? `<text class="income-value-label" x="${escapeHtml(p.x.toFixed(2))}" y="${escapeHtml(Math.max(11, p.y - 8).toFixed(2))}" text-anchor="middle">${pensionCompactWon(p.value)}</text>` : ''}</g>`; }).join('')}`;
    }
    else {
        marks = pointsXY.map((p, i) => { const h = p.value <= 0 ? 0 : (p.value / max) * CH, y = T + CH - h, selected = selectedKey === p.key; return `<g class="income-bar-group ${selected ? 'active' : ''} ${p.value <= 0 ? 'zero' : ''}" ${pointAttr}="${escapeHtml(p.key)}" tabindex="0" role="button" aria-label="${escapeHtml(p.label)} ${won(p.value)}"><rect class="income-bar-hit" x="${escapeHtml((p.x - step / 2).toFixed(2))}" y="${escapeHtml(T)}" width="${escapeHtml(step.toFixed(2))}" height="${escapeHtml(CH)}"></rect><rect class="income-bar" x="${escapeHtml((p.x - barW / 2).toFixed(2))}" y="${escapeHtml(y.toFixed(2))}" width="${escapeHtml(barW.toFixed(2))}" height="${escapeHtml(Math.max(0, h).toFixed(2))}" rx="4"></rect>${selected && p.value > 0 ? `<text class="income-value-label" x="${escapeHtml(p.x.toFixed(2))}" y="${escapeHtml(Math.max(11, y - 6).toFixed(2))}" text-anchor="middle">${pensionCompactWon(p.value)}</text>` : ''}</g>`; }).join('');
    }
    return `<div class="chart-panel income-chart-panel"><div class="income-chart-shell">${incomeAxisMarkup(max, H, T, B)}<div class="income-chart-scroll ${longRange ? 'long-range' : ''}" ${longRange ? 'data-long-range="true"' : ''}><svg class="income-svg" viewBox="0 0 ${plotW} ${H}" style="width:${plotW}px;min-width:${plotW}px" role="img" aria-label="${escapeHtml(yearly ? (chartMode === 'line' ? '연도별 배당 성장추이' : '연도별 배당 수령 그래프') : '월별 배당 수령 그래프')}">${grid}${marks}${xlabels}</svg></div></div><div class="chart-caption">${escapeHtml(caption)}</div></div>`;
}
function commonIncomeAnalysisMarkup({ mode, points = [], selected = null, rate = null, modeAttr, pointAttr, amountTerm = '수령', rateTerm = '수익률', focusNote = '', recentHtml = '', yearly = false, caption = '', yearRange = '10y', rangeAttr = '', chartMode = 'bar', chartModeAttr = '', totalYearCount = 0 }) {
    const tabs = `<div class="period-switch">${[['month', '월별'], ['year', '연도별'], ['recent', '최근 내역']].map(([k, l]) => `<button class="${escapeHtml(mode === k ? 'active' : '')}" ${modeAttr}="${k}">${l}</button>`).join('')}</div>`, yearTools = yearly ? `<div class="income-year-tools">${incomeYearRangeControls(yearRange, rangeAttr, totalYearCount || points.length)}${incomeChartModeControls(chartMode, chartModeAttr)}</div>${incomeRangeSummaryMarkup(points, amountTerm)}` : '', chart = mode === 'recent' ? '' : commonIncomeChartMarkup(points, selected?.key || '', pointAttr, yearly, caption || `막대를 누르면 해당 기간 ${amountTerm}과 ${rateTerm}을 확인합니다.`, chartMode, yearly && points.length > 10), focus = selected ? `<div class="period-yield-card"><div class="period-yield-head"><div><span>${escapeHtml(selected.label)} ${escapeHtml(amountTerm)}</span><strong>${won(selected.value ?? selected.amount)}</strong></div><div class="period-yield-rate">${rate == null ? '계산 불가' : Number(rate).toFixed(2) + '%'}</div></div><small>${escapeHtml(focusNote)}</small></div>` : '';
    return `<div class="compact-dividend-analysis common-income-analysis">${tabs}${yearTools}${chart}${focus}${mode === 'recent' ? recentHtml : ''}</div>`;
}
function pensionIncomeAnalysisMarkup(scope, mode, selectedKey = '') {
    const s = pensionIncomeSummary(scope), monthly = mode === 'month', yearly = mode === 'year', recent = mode === 'recent';
    const allYearPoints = pensionIncomeYears(scope), points = recent ? [] : (monthly ? pensionIncomeMonths(scope, s.year) : incomeYearRangePoints(allYearPoints, pensionIncomeYearRange));
    const fallback = recent ? null : (points.filter(x => (x.amount || 0) > 0).at(-1) || null), rawSelected = recent ? null : (points.find(x => x.key === selectedKey) || fallback), selected = rawSelected ? { ...rawSelected, value: rawSelected.amount } : null;
    const principal = selected ? pensionIncomePrincipalAt(scope, selected.key, monthly ? 'month' : 'year') : 0, selectedRate = selected ? (principal ? (selected.value || 0) / principal * 100 : null) : null, recentRows = recent ? (s.records || []).filter(row => (row.amount || 0) > 0).slice(0, 3) : [], recentHtml = `<div class="composition-holdings compact-income-detail"><div class="sectionhead"><h2 style="font-size:13px">최근 내역</h2><span class="count-pill">최대 3건</span></div><div class="dividend-list compact-dividend-list">${recentRows.length ? recentRows.map(x => { const h = pensionHoldingById(x.holdingId), type = typeof brokerKisIncomeTypeLabel === 'function' ? brokerKisIncomeTypeLabel(x.type) : (x.type === 'interest' ? '이자' : '배당'), source = x.source === 'kis-right' ? ' · 한투 조회' : x.source === 'source-archive' ? ' · 과거자료' : ''; return `<div class="dividend-row"><span class="rowcopy"><strong>${escapeHtml(h?.name || pensionStore().holdings.find(h => h.id === x.holdingId)?.name || x.productName || x.label || '종목')}</strong><small>${formatDate(x.date)} · ${type}${source}</small></span><span class="rowamount positive">${won(x.amount)}</span></div>`; }).join('') : '<div class="empty-state"><span>배당·분배금·이자·기타 권리 내역이 없습니다.</span></div>'}</div>${recentRows.some(x => x.source === 'kis-right') ? '<div class="source-note">한투 권리내역은 세후 수령액을 조회용으로 표시하며 계좌 현금·거래 원장에 다시 더하지 않습니다.</div>' : ''}</div>`;
    return commonIncomeAnalysisMarkup({ mode, points, selected, rate: selectedRate, modeAttr: 'data-pension-income-mode', pointAttr: 'data-pension-income-point', amountTerm: '수령', rateTerm: '현금수익률', focusNote: selected ? (principal ? `${monthly ? '월말' : '연말'} 투자원금 ${won(principal)} 기준` : '해당 기간 투자원금 스냅샷 없음') : '', recentHtml, yearly, caption: yearly && pensionIncomeChartMode === 'line' ? '연간 수령액의 장기 성장 흐름입니다. 점을 누르면 해당 연도를 확인합니다.' : '막대를 누르면 해당 기간 수령액과 현금수익률을 확인합니다.', yearRange: pensionIncomeYearRange, rangeAttr: 'data-pension-income-range', chartMode: pensionIncomeChartMode, chartModeAttr: 'data-pension-income-chart', totalYearCount: incomeRecordSpanYears(pensionIncomeRecords(scope)) });
}
function captureIncomeChartScroll() { const e = $('.income-chart-scroll'); if (!e)
    return null; const max = Math.max(0, e.scrollWidth - e.clientWidth); return { left: e.scrollLeft, max, ratio: max > 0 ? e.scrollLeft / max : 0, atEnd: max > 0 && max - e.scrollLeft <= 4 }; }
function restoreIncomeChartScroll(saved, preferLatest = false) { requestAnimationFrame(() => { const e = $('.income-chart-scroll'); if (!e)
    return; const max = Math.max(0, e.scrollWidth - e.clientWidth); let left = 0; if (saved && max > 0 && saved.max > 0) {
    if (saved.atEnd)
        left = max;
    else if (Math.abs(max - saved.max) <= 2)
        left = Math.max(0, Math.min(max, saved.left));
    else
        left = Math.max(0, Math.min(max, max * saved.ratio));
}
else if (max > 0 && preferLatest)
    left = max; e.scrollLeft = left; }); }
function pensionIncomeAnalysisSheetMarkup(scope = pensionAssetScope()) { const x = pensionIncomeSummary(scope), records = x.records || [], latest = records.find(row => (row.amount || 0) > 0); return `<div class="analysis-sheet-summary"><div class="dividend-metrics compact-four"><div class="dividend-metric emphasis"><span>누적 수령</span><strong>${won(x.total)}</strong></div><div class="dividend-metric"><span>${x.year}년 수령</span><strong>${won(x.yearTotal)}</strong></div><div class="dividend-metric"><span>${x.year} 현금수익률</span><strong>${x.yieldRate == null ? '계산 불가' : x.yieldRate.toFixed(2) + '%'}</strong></div><div class="dividend-metric"><span>최근 수령</span><strong>${latest ? won(latest.amount) : '-'}</strong><small>${latest ? escapeHtml(pensionHoldingById(latest.holdingId)?.name || pensionStore().holdings.find(h => h.id === latest.holdingId)?.name || latest.productName || latest.label || '종목') : '내역 없음'}</small></div></div></div>${pensionIncomeAnalysisMarkup(scope, pensionIncomeAnalysisMode, pensionIncomeSelectedPoint)}`; }
function bindPensionIncomeAnalysis() { const selectPoint = (key) => { pensionIncomeSelectedPoint = key; renderPensionIncomeAnalysis(false); }; $$('[data-pension-income-mode]').forEach(b => b.onclick = () => { pensionIncomeAnalysisMode = ['month', 'year', 'recent'].includes((b.dataset.pensionIncomeMode || '')) ? (b.dataset.pensionIncomeMode || '') : 'month'; pensionIncomeSelectedPoint = ''; renderPensionIncomeAnalysis(true); }); $$('[data-pension-income-range]').forEach(b => b.onclick = () => { pensionIncomeYearRange = ['5y', '10y', '20y', 'all'].includes((b.dataset.pensionIncomeRange || '')) ? (b.dataset.pensionIncomeRange || '') : '10y'; pensionIncomeSelectedPoint = ''; renderPensionIncomeAnalysis(true); }); $$('[data-pension-income-chart]').forEach(b => b.onclick = () => { pensionIncomeChartMode = (b.dataset.pensionIncomeChart || '') === 'line' ? 'line' : 'bar'; pensionIncomeSelectedPoint = ''; renderPensionIncomeAnalysis(false); }); $$('[data-pension-income-point]').forEach(b => { b.onclick = () => selectPoint((b.dataset.pensionIncomePoint || '')); b.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    selectPoint((b.dataset.pensionIncomePoint || ''));
} }; }); }
function renderPensionIncomeAnalysis(preferLatest = false) { const body = $('#sheetBody'); if (!body)
    return; const saved = captureIncomeChartScroll(); body.innerHTML = pensionIncomeAnalysisSheetMarkup(pensionAssetScope()); bindPensionIncomeAnalysis(); restoreIncomeChartScroll(saved, preferLatest); }
function openPensionIncomeAnalysis() { pensionIncomeAnalysisMode = 'month'; pensionIncomeSelectedPoint = ''; pensionIncomeYearRange = '10y'; pensionIncomeChartMode = 'bar'; $('#sheetEyebrow').textContent = pensionAssetScope() === 'irp' ? 'IRP' : '개인연금'; $('#sheetTitle').textContent = '배당·이자·권리 분석'; $('#sheetBody').innerHTML = pensionIncomeAnalysisSheetMarkup(pensionAssetScope()); openSheet('#detailSheet', { variant: 'income-analysis' }); setTimeout(bindPensionIncomeAnalysis, 0); }
;
/* asset-os source: ai-strategy.js */
'use strict';
let aiStrategyPurpose = 'buy';
const AI_STRATEGY_SCOPES = ['isa', 'pension', 'irp'];
function aiStrategyScopes(value) {
    if (!Array.isArray(value))
        return [...AI_STRATEGY_SCOPES];
    return AI_STRATEGY_SCOPES.filter(key => value.includes(key));
}
function aiStrategyScopeLabels(scopes) { const labels = { isa: 'ISA', pension: '개인연금', irp: 'IRP' }; return aiStrategyScopes(scopes).map(key => labels[key]).join(' · '); }
function aiStrategySetting() {
    const saved = setting().aiStrategy || {};
    return {
        purpose: ['buy', 'rebalance', 'tax'].includes(saved.purpose || '') ? saved.purpose : 'buy',
        fundingSource: ['new_money', 'account_cash', 'next_contribution'].includes(saved.fundingSource || '') ? saved.fundingSource : 'new_money',
        includedScopes: aiStrategyScopes(saved.includedScopes),
        amount: Math.max(0, Math.round(Number(saved.amount) || 0)),
        horizonYears: Math.max(3, Math.round(Number(saved.horizonYears) || 3)),
        riskStyle: '공격형', maxDrawdown: -40, preferNewMoney: true
    };
}
function aiStrategyPrompt(purpose, amount, fundingSource = 'new_money', includedScopes = AI_STRATEGY_SCOPES) {
    const focus = purpose === 'rebalance' ? '전체 리밸런싱' : purpose === 'tax' ? '연금·절세 전략' : '지금 더 투자해도 되는지', zeroRebalance = purpose === 'rebalance' && amount <= 0, scopeLabel = aiStrategyScopeLabels(includedScopes);
    const sourceLabel = zeroRebalance ? '추가 자금 없음 · 기존 보유종목 비중 조정' : fundingSource === 'account_cash' ? '계좌 안 현금' : fundingSource === 'next_contribution' ? '다음 납입금' : '새로 넣을 돈';
    return `너는 내 계좌를 평가하는 감사자가 아니라 실제 매수 결정을 돕는 투자판단 파트너다. 첨부한 Asset OS 자료와 오늘의 최신 시장자료를 함께 사용해 ${focus}에 대한 결론을 내려라.\n\n가장 먼저 보여줄 것\n- ${scopeLabel} 계좌별로 지금 행동을 매수 / 분할매수 / 대기 / 유지 / 축소 / 교체 중 하나로 확정\n- 각 계좌에서 실행할 종목, 금액, 최신 현재가 기준 예상 수량, 실행 순서\n- 지금 전액을 쓰지 않는다면 이번 집행액과 남겨둘 금액\n\n판단 순서\n1. 웹에서 오늘 날짜의 금리·환율·미국 및 한국 증시·보유종목 가격과 핵심 이슈를 확인한다. 첨부 현재가가 오래됐으면 최신 웹 가격을 사용한다.\n2. 현재 시장을 5줄 이내로 판단한다.\n3. 앞으로 1~3개월, 6~12개월, 3~5년의 기본 전망을 계좌 보유종목과 투자 테마에 연결한다.\n4. 선택한 ${scopeLabel} 계좌를 각각 판단하고 마지막에 실제 실행 순서를 하나의 표로 정리한다.\n5. 다음 매수 또는 판단 변경 시점을 날짜·가격·시장 조건 중 확인 가능한 기준으로 제시한다.\n\n내 조건\n- 자금 출처: ${sourceLabel}\n- ${zeroRebalance ? '추가 투자금' : '판단 금액'}: ${amount.toLocaleString('ko-KR')}원\n- 투자기간: 3년 이상\n- 투자성향: 공격형\n- 감내 가능한 최대 손실: -40%\n- ${zeroRebalance ? '추가 자금 없이 기존 보유종목의 유지·축소·교체를 판단' : '기존 종목을 불필요하게 매도하지 말고 신규 자금 배분을 우선'}\n\n답변 원칙\n- 결론부터 말하고 애매한 양비론으로 끝내지 않는다.\n- 앱 구조, 데이터 형식, 개인정보 제외 여부를 설명하지 않는다.\n- 일반적인 투자 위험 설명, 교과서식 주의사항, 긴 면책문구를 쓰지 않는다.\n- 보유내역을 그대로 다시 읽어주는 데 분량을 쓰지 않는다.\n- 위험요인은 별도 장문 항목으로 만들지 말고 매수·대기 판단을 바꾸는 조건에만 짧게 반영한다.\n- 정확한 수량을 계산할 수 없으면 최신 가격 기준의 금액 범위로 제시한다.\n- 오늘 이미 체결한 주문은 중복 추천하지 않는다.`;
}
function aiRecentRows(rows, limit = 240) { return [...(rows || [])].sort((a, b) => String(b.date || b.orderDate || '').localeCompare(String(a.date || a.orderDate || ''))).slice(0, limit); }
function aiIsoAgeHours(value) { const time = new Date(String(value || '')).getTime(); return Number.isFinite(time) ? Math.max(0, (Date.now() - time) / 36e5) : Infinity; }
const AI_KR_MARKET_HOLIDAYS_2026 = new Set(['2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18', '2026-03-02', '2026-05-05', '2026-05-25', '2026-08-17', '2026-09-24', '2026-09-25', '2026-09-28', '2026-10-05', '2026-10-09', '2026-12-25']);
function aiKoreaDate(value) { const date = new Date(String(value || '')); if (!Number.isFinite(date.getTime()))
    return ''; return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date); }
function aiTradingDaysSince(value, now = new Date()) { const start = aiKoreaDate(value), end = aiKoreaDate(now); if (!start || !end)
    return Infinity; let cursor = new Date(`${start}T00:00:00Z`), finish = new Date(`${end}T00:00:00Z`), days = 0; while (cursor < finish && days < 400) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const key = cursor.toISOString().slice(0, 10), dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6 && !AI_KR_MARKET_HOLIDAYS_2026.has(key))
        days++;
} return days; }
function aiKoreaTimestamp(value) { const date = new Date(String(value || '')); return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(date) : '갱신 기록 없음'; }
function aiPurposeLabel(value) { return value === 'rebalance' ? '리밸런싱' : value === 'tax' ? '절세·납입' : '추가매수 판단'; }
function aiFundingLabel(value) { return value === 'account_cash' ? '계좌 안 현금' : value === 'next_contribution' ? '다음 납입금' : '새로 넣을 돈'; }
function aiIsaAccountExport(account, index) {
    const metrics = accountMetrics(account), holdingRefs = new Map(), currentPolicy = policy('isa', account), year = String(businessYear()), fallbackPaid = annualContributionTotal(account), contributionModel = typeof isaContributionModel === 'function' ? isaContributionModel(account) : { currentYearPaid: fallbackPaid, lifetimePaid: fallbackPaid, accruedLimit: Number(currentPolicy.annualLimit) || 0, remaining: Math.max(0, (Number(currentPolicy.annualLimit) || 0) - fallbackPaid), carryoverAvailable: 0 }, paidThisYear = contributionModel.currentYearPaid;
    const metricHoldings = metrics.holdings || [], accountHoldings = account.holdings || [], holdings = metricHoldings.map((holding, holdingIndex) => {
        const source = accountHoldings.find(row => row.id === holding.id) || holding, ref = `ISA${index + 1}-H${holdingIndex + 1}`;
        holdingRefs.set(String(holding.id || ''), ref);
        const quoteAt = source.quoteUpdatedAt || source.priceUpdatedAt || '';
        return { ref, name: holding.name, instrumentCode: source.instrumentCode || '', quoteType: source.quoteType || '', assetClass: holding.assetClass || source.assetClass || '', quantity: Number(holding.quantity ?? holding.qty) || 0, quantityUnit: source.quantityUnit || 'share', averagePrice: Number(holding.avgPrice) || 0, currentPrice: Number(holding.currentPrice) || 0, marketValue: Math.round(Number(holding.marketValue) || 0), profitLoss: Math.round((Number(holding.marketValue) || 0) - holdingCostValue(holding)), quoteSource: source.quoteSource || '', quoteUpdatedAt: quoteAt, quoteAgeHours: aiIsoAgeHours(quoteAt) };
    });
    const transactions = aiRecentRows(account.transactions).map(tx => ({ type: tx.type, date: txDate(tx), status: tx.status || 'completed', holdingRef: holdingRefs.get(String(tx.holdingId || '')) || '', quantity: Number(tx.quantity ?? tx.qty) || 0, price: Number(tx.price) || 0, amount: Number(tx.amount) || 0, fee: Number(tx.fee) || 0, tax: Number(tx.tax) || 0 }));
    return { ref: `ISA${index + 1}`, type: account.type || '', status: account.status, openedAt: account.openedAt || '', maturityAt: account.maturityAt || '', policy: { name: currentPolicy.name || '', verifiedAt: currentPolicy.verifiedAt || '', annualLimit: Number(currentPolicy.annualLimit) || 0, totalContributionLimit: Number(currentPolicy.totalContributionLimit) || 100000000, taxExemption: account.type === '서민형' ? Number(currentPolicy.lowIncomeExemption) || 0 : account.type === '농어민형' ? Number(currentPolicy.farmerExemption) || 0 : Number(currentPolicy.generalExemption) || 0, taxRate: Number(currentPolicy.taxRate) || 0, mandatoryYears: Number(currentPolicy.mandatoryYears) || 0 }, contribution: { year, paid: Math.round(paidThisYear), currentYearPaid: Math.round(paidThisYear), lifetimePaid: Math.round(contributionModel.lifetimePaid), accruedLimit: Math.round(contributionModel.accruedLimit), remaining: Math.round(contributionModel.remaining), carryoverAvailable: Math.round(contributionModel.carryoverAvailable) }, summary: { value: Math.round(metrics.value), cost: Math.round(metrics.cost), cash: Math.round(metrics.cash), profit: Math.round(metrics.profit), returnRate: Number(metrics.rate) || 0, componentDelta: Math.round(metrics.value - metrics.cash - (metrics.holdingsValue || 0)) }, holdings, transactions, assetSnapshots: aiRecentRows(account.assetSnapshots, 120).map(x => ({ date: x.date, cost: Number(x.cost) || 0, securitiesValue: Number(x.value) || 0, cash: Number(x.cash) || 0, totalValue: Number(x.totalValue ?? x.value) || 0, valueBasis: x.meta?.valueBasis || 'legacy_unknown', grain: x.meta?.grain || 'unknown' })) };
}
function aiStrategyAvailableCash(summary) {
    const reported = 'reportedAvailableCash' in summary ? summary.reportedAvailableCash : summary.availableCash;
    const cash = Math.max(0, Number(summary.cash) || 0), available = reported == null ? cash : Math.max(0, Number(reported) || 0);
    return Math.max(0, Math.min(cash, available) + Math.min(0, Number(summary.componentDelta) || 0));
}
function aiPensionAccountExport(account, index) {
    const view = pensionAccountView(account), kind = account.kind === 'irp' ? 'IRP' : '연금저축', connection = state.brokerKis?.connections?.[account.kind || ''] || {};
    return { ref: `${kind === 'IRP' ? 'IRP' : 'PENSION'}${index + 1}`, label: `${kind} ${index + 1}`, kind, status: account.status, openedAt: account.openedAt || '', source: view.kis ? '한국투자 조회' : 'Asset OS 원장', sync: { lastCompleteAt: connection.lastCompleteSyncAt || '', lastBalanceAt: connection.lastBalanceAt || '', lastOrdersAt: connection.lastOrdersAt || '', lastError: connection.lastError || '' }, summary: { value: Math.round(view.total), cash: Math.round(view.cash), reportedAvailableCash: view.cashStatus?.availableCash ?? null, availableCash: Math.round(aiStrategyAvailableCash({ cash: view.cash, availableCash: view.cashStatus?.availableCash, componentDelta: view.componentDelta })), cashConfirmed: view.cashStatus?.confirmed !== false, pendingBuy: Math.round(Number(view.cashStatus?.pendingBuy) || 0), securitiesValue: Math.round(view.holdingValue), unallocated: Math.round(view.unallocated), componentDelta: Math.round(view.componentDelta || 0) }, holdings: view.holdings.map(h => ({ name: h.name, productCode: h.productCode || '', productType: h.productType || '', assetClass: h.assetClass || '', quantity: Number(h.qty) || 0, averagePrice: Number(h.avgPrice) || 0, currentPrice: Number(h.currentPrice) || 0, marketValue: Math.round(pensionHoldingValue(h)), profitLoss: Math.round(pensionHoldingValue(h) - pensionHoldingCost(h)), riskClassification: h.risky === true ? 'risky' : h.risky === false ? 'non_risky' : 'unclassified', riskSource: h.riskSource || '', readOnly: !!h.readOnly })) };
}
function aiPensionSection(kind) {
    const accounts = pensionStore().accounts.filter(a => a.status === 'active' && a.kind === kind).map(aiPensionAccountExport);
    const metrics = pensionAssetMetrics(kind), accountIds = new Set(pensionStore().accounts.filter(a => a.kind === kind).map(a => a.id));
    const transactions = aiRecentRows((pensionStore().transactions || []).filter(tx => accountIds.has(tx.accountId))).map(tx => ({ type: tx.type, date: tx.date, holding: pensionHoldingById(tx.holdingId)?.name || '', quantity: Number(tx.qty) || 0, price: Number(tx.price) || 0, amount: Number(tx.amount) || 0, fee: Number(tx.fee) || 0, tax: Number(tx.tax) || 0 }));
    const contributions = aiRecentRows(centralPensionContributionRows().filter(row => row.kind === kind), 120).map(row => ({ date: row.date, amount: Number(row.amount) || 0, type: row.type || 'contribution' }));
    const brokerOrders = aiRecentRows(brokerKisVisibleOrders(state.brokerKis, kind), 240).map(order => ({ date: order.date || order.orderDate, time: order.time || order.orderTime || '', type: order.type || order.side, productCode: order.productCode || '', productName: order.productName || '', quantity: Number(order.qty ?? order.quantity) || 0, price: Number(order.price) || 0, amount: Number(order.amount) || 0, status: order.status || '' }));
    const income = aiRecentRows(pensionIncomeRecords(kind), 240).map(row => { const type = row.incomeType || row.type, category = row.incomeCategory || (typeof brokerKisIncomeCategory === 'function' ? brokerKisIncomeCategory(type) : ['dividend', 'distribution'].includes(type || '') ? 'dividend' : type === 'interest' ? 'interest' : 'other'); return { date: row.date, category, type, amount: Number(row.amount) || 0, grossAmount: Number(row.grossAmount ?? row.amount) || 0, tax: Number(row.tax) || 0, label: row.label || row.productName || pensionHoldingById(row.holdingId)?.name || pensionStore().holdings.find(h => h.id === row.holdingId)?.name || '', source: row.source || '', readOnly: !!row.readOnly, rightTypeCode: row.rightTypeCode || '', rightTypeName: row.rightTypeName || '', classificationBasis: row.classificationBasis || '', productCode: row.productCode || '' }; });
    const assetSnapshots = aiRecentRows((pensionStore().assetSnapshots || []).map(row => ({ date: row.date, values: kind === 'irp' ? (row.irp || {}) : (row.pension || {}), grain: row.meta?.grain || 'month', source: row.meta?.source?.[kind] || 'unknown' })), 120), year = String(businessYear()), yearPaid = contributions.filter(row => String(row.date).startsWith(year)).reduce((sum, row) => sum + (Number(row.amount) || 0), 0), currentPolicy = policy(kind === 'irp' ? 'irp' : 'pension'), pensionPolicy = typeof policyForYear === 'function' ? policyForYear('pension', year) : policy('pension'), taxProfile = typeof pensionTaxCreditProfile === 'function' ? pensionTaxCreditProfile(year, pensionPolicy) : { rate: Number(pensionPolicy.taxCreditRate) || .132, configured: false };
    return { accounts, combined: { value: Math.round(metrics.value), cost: Math.round(metrics.cost), cash: Math.round(metrics.cash), profit: Math.round(metrics.profit), returnRate: Number(metrics.rate) || 0 }, contribution: { year, paid: Math.round(yearPaid) }, policy: { name: currentPolicy.name || '', verifiedAt: currentPolicy.verifiedAt || '', annualContributionLimit: Number(currentPolicy.annualContributionLimit) || 0, annualTaxCreditLimit: Number(currentPolicy.annualTaxCreditLimit) || 0, combinedTaxCreditLimit: Number(currentPolicy.combinedTaxCreditLimit) || 0, taxCreditRate: taxProfile.rate, taxRateConfigured: taxProfile.configured, riskyAssetLimit: Number(currentPolicy.riskyAssetLimit) || 0 }, contributions, transactions, brokerOrders, income, assetSnapshots };
}
function aiIntegratedCashFlowExport() {
    if (typeof integratedSelectedMonth !== 'function' || typeof integratedSpendingMonthShift !== 'function' || typeof integratedSummary !== 'function' || typeof integratedSpendingAnalysis !== 'function')
        return { currentMonth: '', monthlyLivingBudget: 0, months: [] };
    const current = integratedSelectedMonth(), months = [];
    for (let offset = -5; offset <= 0; offset++) {
        const month = integratedSpendingMonthShift(current, offset), summary = integratedSummary(month), spending = integratedSpendingAnalysis(month);
        months.push({ month, income: Math.round(summary.income), livingExpense: Math.round(spending.total), fixedExpense: Math.round(spending.fixed), variableExpense: Math.round(spending.variable), savingAndInvestment: Math.round(summary.invest), debtPrincipal: Math.round(summary.principal), operatingCashDelta: Math.round(summary.operatingCashDelta) });
    }
    return { currentMonth: current, monthlyLivingBudget: Math.round(Math.max(0, Number(setting().monthlyLivingBudget) || 0)), months };
}
function aiStrategyPreflight(payload, amount, fundingSource) {
    const blockers = [], warnings = [];
    const isRebalance = payload?.request?.purpose === '리밸런싱';
    const isaAccounts = payload.isa.accounts || [], isaHoldings = isaAccounts.flatMap(a => a.holdings), stale7 = isaHoldings.filter(h => h.quoteAgeHours > 168), stale3 = isaHoldings.filter(h => h.quoteAgeHours > 72 && h.quoteAgeHours <= 168);
    if (isaAccounts.some(a => Math.abs(a.summary.componentDelta) > 1))
        blockers.push('ISA 합계와 보유·현금 구성값이 일치하지 않습니다.');
    if (stale7.length)
        warnings.push(`ISA 현재가가 7일 넘게 오래된 종목 ${stale7.length}개가 있습니다. 최신 주문 전에는 현재가를 다시 갱신해 주세요.`);
    else if (stale3.length)
        warnings.push(`ISA 현재가가 3일 넘게 오래된 종목 ${stale3.length}개가 있습니다.`);
    const pensionAccounts = [...payload.pensionSavings.accounts, ...payload.irp.accounts];
    const kisAccounts = pensionAccounts.filter(a => a.source === '한국투자 조회'), staleKis = kisAccounts.filter(a => aiTradingDaysSince(a.sync?.lastCompleteAt) > 1);
    const negativePensionDelta = pensionAccounts.filter(a => Number(a.summary.componentDelta) < -1), positivePensionDelta = pensionAccounts.filter(a => Number(a.summary.componentDelta) > 1);
    if (negativePensionDelta.length) {
        const difference = negativePensionDelta.reduce((sum, a) => sum + Math.abs(Number(a.summary.componentDelta) || 0), 0);
        const message = `연금 조회 총액이 현금·종목 합계보다 ${difference.toLocaleString('ko-KR')}원 작습니다. 차액은 투자 가능 현금에서 제외합니다.`;
        warnings.push(message);
    }
    if (positivePensionDelta.length)
        warnings.push(`연금 조회 합계 중 종목 상세가 없는 기타자산이 있는 계좌 ${positivePensionDelta.length}개를 별도 금액으로 포함했습니다.`);
    if (pensionAccounts.some(a => a.summary.cashConfirmed === false))
        blockers.push('당일 체결 때문에 연금 예수금의 실제 사용 가능액이 확정되지 않았습니다.');
    if (kisAccounts.some(a => a.sync?.lastError))
        blockers.push('한국투자 잔고·체결 갱신이 부분 완료 상태입니다.');
    if (staleKis.length)
        warnings.push(`한국투자 갱신이 1거래일 넘게 지난 계좌: ${staleKis.map(a => `${a.label || a.ref || a.kind || '계좌'} (${aiKoreaTimestamp(a.sync?.lastCompleteAt)})`).join(', ')}. 주말·시장 휴장일은 제외했습니다. 최신 주문 전에는 다시 갱신해 주세요.`);
    if (!payload.request.includedScopes?.length)
        blockers.push('분석에 포함할 계좌를 하나 이상 선택해 주세요.');
    if (payload.irp.accounts.length && payload.irp.risk.classificationComplete === false)
        blockers.push('IRP에 위험자산 분류가 확인되지 않은 종목이 있습니다.');
    if (amount <= 0 && !isRebalance)
        blockers.push('판단할 투자금액이 0원입니다.');
    if (fundingSource === 'account_cash') {
        const accounts = [...payload.isa.accounts, ...pensionAccounts], unconfirmed = accounts.some(a => 'cashConfirmed' in a.summary && a.summary.cashConfirmed === false), available = accounts.reduce((sum, a) => sum + aiStrategyAvailableCash(a.summary), 0);
        if (unconfirmed)
            blockers.push('계좌 안 현금을 쓰려면 당일 체결 정산 후 사용 가능액을 먼저 확인해야 합니다.');
        else if (amount > available)
            blockers.push(`판단 금액이 확인된 계좌 현금 ${Math.round(available).toLocaleString('ko-KR')}원을 초과합니다.`);
    }
    return { ready: blockers.length === 0, blockers, warnings };
}
function aiEmptyPensionSection() { return { accounts: [], combined: { value: 0, cost: 0, cash: 0, profit: 0, returnRate: 0 }, contribution: { year: String(businessYear()), paid: 0 }, policy: {}, contributions: [], transactions: [], brokerOrders: [], income: [], assetSnapshots: [] }; }
function buildAiStrategyPayload(purpose, amount, fundingSource = 'new_money', includedScopes = AI_STRATEGY_SCOPES) {
    const scopes = aiStrategyScopes(includedScopes), has = (key) => scopes.includes(key), isaAccounts = has('isa') ? state.accounts.filter(isCurrentAccount).map(aiIsaAccountExport) : [], pensionSavings = has('pension') ? aiPensionSection('pension') : aiEmptyPensionSection(), irpSection = has('irp') ? aiPensionSection('irp') : aiEmptyPensionSection(), projection = pensionProjection(), risk = has('irp') ? pensionRiskMetrics() : { risky: 0, unknown: 0, ratio: 0, maxRatio: 0, limit: 70, classificationComplete: true };
    const payload = { format: 'asset-os-ai-strategy-v2', generatedAt: new Date().toISOString(), privacy: { excluded: ['이름', '이메일', '계좌번호', '메모', 'API 키', '토큰'] }, request: { cashBasis: '연금 투자 가능 현금은 summary.availableCash를 사용합니다. reportedAvailableCash는 차액 반영 전 조회값입니다.', purpose: aiPurposeLabel(purpose), fundingSource: aiFundingLabel(fundingSource), additionalInvestmentWon: amount, includedScopes: scopes, includedAccountTypes: aiStrategyScopeLabels(scopes), prompt: aiStrategyPrompt(purpose, amount, fundingSource, scopes) }, profile: { investmentHorizon: '3년 이상', riskStyle: '공격형', maximumDrawdownTolerance: '-40%', rebalancePreference: '가능하면 매도보다 신규 자금으로 조정' }, isa: { accounts: isaAccounts, combined: { value: isaAccounts.reduce((s, x) => s + x.summary.value, 0), cost: isaAccounts.reduce((s, x) => s + x.summary.cost, 0), cash: isaAccounts.reduce((s, x) => s + x.summary.cash, 0), profit: isaAccounts.reduce((s, x) => s + x.summary.profit, 0) } }, pensionSavings, irp: { ...irpSection, risk: { riskyValue: Math.round(risk.risky), unclassifiedValue: Math.round(risk.unknown), confirmedRatio: Number(risk.ratio) || 0, maximumPossibleRatio: Number(risk.maxRatio) || 0, limit: Number(risk.limit) || 70, classificationComplete: !!risk.classificationComplete } }, cashFlow: aiIntegratedCashFlowExport(), combinedPlan: { totalValue: Math.round(payloadNumber(pensionSavings.combined.value) + payloadNumber(irpSection.combined.value) + isaAccounts.reduce((s, x) => s + x.summary.value, 0)), projection: { retirementAge: projection.retirementAge, currentAge: projection.currentAge, monthlyContribution: Math.round(projection.monthly), annualReturnRate: Number(projection.annual) || 0, inflationRate: Number(projection.inflation) || 0, expectedAssetsAtRetirement: Math.round(projection.future), expectedMonthlyPension: Math.round(projection.monthlyPension) } } };
    const dataQuality = aiStrategyPreflight(payload, amount, fundingSource);
    return { ...payload, dataQuality };
}
function payloadNumber(value) { return Number(value) || 0; }
function aiStrategyFile(purpose, amount, fundingSource, includedScopes) { const payload = buildAiStrategyPayload(purpose, amount, fundingSource, includedScopes), exportPayload = { ...payload, dataQuality: { ready: payload.dataQuality.ready, blockers: payload.dataQuality.blockers } }, blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'text/plain' }); return { file: new File([blob], '투자분석.txt', { type: 'text/plain' }), payload }; }
function downloadAiStrategyFile(purpose, amount, fundingSource, includedScopes) {
    const { file, payload } = aiStrategyFile(purpose, amount, fundingSource, includedScopes);
    if (!payload.dataQuality.ready) {
        showNotice('저장 전 확인', payload.dataQuality.blockers.join('\n'));
        return false;
    }
    downloadBytes(file, file.name, file.type);
    toast('분석파일을 내려받았습니다. ChatGPT 대화에 첨부해 주세요.');
    return true;
}
async function shareAiStrategyFile(purpose, amount, fundingSource, includedScopes) {
    const { file, payload } = aiStrategyFile(purpose, amount, fundingSource, includedScopes);
    if (!payload.dataQuality.ready) {
        showNotice('공유 전 확인', payload.dataQuality.blockers.join('\n'));
        return false;
    }
    if (!(typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] }))) {
        showNotice('공유 기능 필요', '이 기기에서는 파일 공유를 지원하지 않습니다. Android의 Chrome 또는 설치된 Asset OS에서 다시 시도해 주세요.');
        return false;
    }
    try {
        await navigator.share({ title: 'Asset OS 투자분석', text: `${payload.request.includedAccountTypes} 투자판단 자료입니다.`, files: [file] });
        toast('투자분석 자료를 공유했습니다.');
        return true;
    }
    catch (error) {
        if (error?.name !== 'AbortError')
            showNotice('공유 실패', '파일을 공유하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        return false;
    }
}
function aiStrategyMarkup() {
    const saved = aiStrategySetting();
    aiStrategyPurpose = saved.purpose;
    return `<form id="aiStrategyForm" class="form ai-strategy-form"><div class="ai-purpose-grid">${[['buy', '추가매수 판단'], ['rebalance', '리밸런싱'], ['tax', '절세·납입']].map(([key, label]) => `<button type="button" class="ai-purpose ${saved.purpose === key ? 'active' : ''}" data-ai-purpose="${escapeHtml(key)}">${label}</button>`).join('')}</div><div class="field"><label>분석에 포함할 계좌</label><div class="ai-account-scopes">${[['isa', 'ISA'], ['pension', '개인연금'], ['irp', 'IRP']].map(([key, label]) => `<label><input type="checkbox" name="includedScope" value="${escapeHtml(key)}" ${saved.includedScopes.includes(key) ? 'checked' : ''}><span>${label}</span></label>`).join('')}</div></div><div class="field"><label>사용할 돈</label><select name="fundingSource"><option value="new_money" ${saved.fundingSource === 'new_money' ? 'selected' : ''}>새로 넣을 돈</option><option value="account_cash" ${saved.fundingSource === 'account_cash' ? 'selected' : ''}>계좌 안 현금</option><option value="next_contribution" ${saved.fundingSource === 'next_contribution' ? 'selected' : ''}>다음 납입금</option></select></div><div class="field"><label id="aiStrategyAmountLabel">${saved.purpose === 'rebalance' ? '추가 투자금 (선택)' : '판단할 금액'}</label><input name="amount" type="number" inputmode="numeric" min="0" step="10000" value="${escapeHtml(saved.amount || '')}" placeholder="${escapeHtml(saved.purpose === 'rebalance' ? '0원도 가능' : '예: 3,000,000')}"></div><div class="ai-amount-preset">${[500000, 1000000, 3000000, 5000000].map(v => `<button type="button" data-ai-amount="${escapeHtml(v)}">${v / 10000}만원</button>`).join('')}</div><div class="source-note">선택한 계좌 자료만 파일에 포함합니다. 개인정보와 연결 비밀값은 제외합니다.</div><div class="form-actions one"><button class="form-btn primary">공유하기</button></div></form>`;
}
function openAiStrategy() {
    const saved = aiStrategySetting();
    $('#sheetEyebrow').textContent = '통합 투자자료';
    $('#sheetTitle').textContent = 'AI 투자전략';
    $('#sheetBody').innerHTML = aiStrategyMarkup();
    openSheet('#detailSheet');
    const form = $('#aiStrategyForm');
    $$('[data-ai-purpose]').forEach(button => button.onclick = () => { aiStrategyPurpose = button.dataset.aiPurpose || 'buy'; $$('[data-ai-purpose]').forEach(x => x.classList.toggle('active', x === button)); const rebalance = aiStrategyPurpose === 'rebalance', label = $('#aiStrategyAmountLabel'); if (label)
        label.textContent = rebalance ? '추가 투자금 (선택)' : '판단할 금액'; form.elements.namedItem('amount').placeholder = rebalance ? '0원도 가능' : '예: 3,000,000'; });
    $$('[data-ai-amount]').forEach(button => button.onclick = () => { form.elements.namedItem('amount').value = button.dataset.aiAmount || ''; });
    form.onsubmit = async (event) => { event.preventDefault(); const data = new FormData(form), amount = Math.max(0, Math.round(Number(data.get('amount')) || 0)), fundingSource = String(data.get('fundingSource') || 'new_money'), includedScopes = aiStrategyScopes(data.getAll('includedScope')); if (!includedScopes.length)
        return toast('분석에 포함할 계좌를 하나 이상 선택해 주세요.'); if (amount <= 0 && aiStrategyPurpose !== 'rebalance')
        return toast('판단할 금액을 입력해 주세요.'); setting().aiStrategy = { ...saved, purpose: aiStrategyPurpose, fundingSource, amount, includedScopes }; if (!(await persist(false)))
        return; await shareAiStrategyFile(aiStrategyPurpose, amount, fundingSource, includedScopes); };
}
;
/* asset-os source: chart-pension-future.js */
'use strict';
let pensionFutureSelectedAge = null;
function pensionProjectionSeries() { const p = pensionProjection(), points = [], m = pensionAssetMetrics('all'); for (let y = 0; y <= p.years; y++) {
    const n = Math.round(y * 12), r = p.annual / 12, value = r > 0 ? p.current * Math.pow(1 + r, n) + p.monthly * (Math.pow(1 + r, n) - 1) / r : p.current + p.monthly * n, principal = m.cost + p.monthly * n;
    points.push({ year: y, age: p.currentAge + y, value, principal, monthlyPension: value * p.withdrawal / 12 });
} return points; }
function pensionNiceStep(raw) { const v = Math.max(1, Math.abs(Number(raw) || 1)), pow = Math.pow(10, Math.floor(Math.log10(v))), n = v / pow, m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10; return m * pow; }
function pensionZeroAxisMax(rawMax) { const target = Math.max(1, (Number(rawMax) || 1) * 1.12), step = pensionNiceStep(target / 4), max = Math.ceil(target / step) * step; return Math.max(step * 4, max); }
function pensionTightAxisRange(values) { const nums = values.map(Number).filter(Number.isFinite); if (!nums.length)
    return { min: 0, max: 1 }; const low = Math.min(...nums), high = Math.max(...nums), span = Math.max(1, high - low), pad = Math.max(span * .22, high * .025, 1000), targetMin = Math.max(0, low - pad), targetMax = high + pad, step = pensionNiceStep(Math.max(1, targetMax - targetMin) / 4), min = Math.max(0, Math.floor(targetMin / step) * step), max = Math.ceil(targetMax / step) * step; return { min, max: Math.max(min + step * 3, max) }; }
function pensionFutureChartModel() { const p = pensionProjection(), series = pensionProjectionSeries(), W = 320, H = 190, L = 48, R = 12, T = 17, B = 30, CW = W - L - R, CH = H - T - B, rawMax = Math.max(1, ...series.flatMap(x => [x.value, x.principal])), max = pensionZeroAxisMax(rawMax), points = series.map((x, i) => ({ ...x, x: L + (series.length <= 1 ? CW : i / (series.length - 1) * CW), assetY: T + CH - (x.value / max) * CH, costY: T + CH - (x.principal / max) * CH })), assetLine = points.length ? `M ${points.map((pt, i) => `${i ? 'L' : ' '}${pt.x.toFixed(2)} ${pt.assetY.toFixed(2)}`).join(' ')}` : '', costLine = points.length ? `M ${points.map((pt, i) => `${i ? 'L' : ' '}${pt.x.toFixed(2)} ${pt.costY.toFixed(2)}`).join(' ')}` : ''; return { p, series, points, W, H, L, R, T, B, CW, CH, max, rawMax, assetLine, costLine }; }
function pensionFutureSheetMarkup() { const c = pensionFutureChartModel(), p = c.p, selectedAge = pensionFutureSelectedAge == null ? p.retirementAge : Math.max(p.currentAge, Math.min(p.retirementAge, Number(pensionFutureSelectedAge) || p.retirementAge)), selected = c.points.reduce((best, x) => Math.abs(x.age - selectedAge) < Math.abs(best.age - selectedAge) ? x : best, c.points[0]), tickValues = [c.max, c.max * .75, c.max * .5, c.max * .25, 0], xAges = [p.currentAge, Math.round(p.currentAge + (p.retirementAge - p.currentAge) / 3), Math.round(p.currentAge + (p.retirementAge - p.currentAge) * 2 / 3), p.retirementAge]; pensionFutureSelectedAge = selected.age; return `<div class="profitbox future-primary"><div class="metric"><span id="pensionFutureHeadlineAge">${selected.age}세 예상자산</span><strong id="pensionFutureHeadlineValue" class="${escapeHtml(pensionFutureAmountClass(selected.value))}" aria-label="${escapeHtml(won(selected.value))}" title="${escapeHtml(won(selected.value))}">${pensionFutureHeadlineWon(selected.value)}</strong></div><div class="metric"><span id="pensionFutureHeadlineMonthlyAge">${selected.age}세 월 연금</span><strong id="pensionFutureHeadlineMonthly" class="${escapeHtml(pensionFutureAmountClass(selected.monthlyPension))}" aria-label="${escapeHtml(won(selected.monthlyPension))}" title="${escapeHtml(won(selected.monthlyPension))}">${pensionFutureHeadlineWon(selected.monthlyPension)}</strong></div></div><div class="pension-future-principal"><span><b id="pensionFutureAgeLabel">${selected.age}세</b> 누적 납입원금</span><strong id="pensionFutureCostLabel" title="${escapeHtml(won(selected.principal))}">${pensionReadableWon(selected.principal)}</strong></div><div class="pension-future-chart-wrap"><svg id="pensionFutureChart" class="pension-future-chart" viewBox="0 0 ${c.W} ${c.H}" role="img" aria-label="${p.currentAge}세부터 ${p.retirementAge}세까지 예상 연금자산과 누적 납입원금">${tickValues.map((v, i) => { const y = c.T + c.CH * (i / (tickValues.length - 1)); return `<line class="pension-future-gridline" x1="${escapeHtml(c.L)}" y1="${escapeHtml(y)}" x2="${escapeHtml(c.W - c.R)}" y2="${escapeHtml(y)}"></line><text class="pension-future-axis" x="${escapeHtml(c.L - 6)}" y="${escapeHtml(y + 3)}" text-anchor="end">${pensionCompactWon(v)}</text>`; }).join('')}<text class="pension-future-axis-title" x="5" y="11">자산금액</text><path class="pension-future-cost-line" d="${escapeHtml(c.costLine)}"></path><path class="pension-future-line" d="${escapeHtml(c.assetLine)}"></path><line id="pensionFutureMarkerLine" class="pension-future-marker-line" x1="${escapeHtml(selected.x.toFixed(2))}" x2="${escapeHtml(selected.x.toFixed(2))}" y1="${escapeHtml(c.T)}" y2="${escapeHtml(c.T + c.CH)}"></line><circle id="pensionFutureCostDot" class="pension-future-cost-dot" cx="${escapeHtml(selected.x.toFixed(2))}" cy="${escapeHtml(selected.costY.toFixed(2))}" r="4"></circle><circle id="pensionFutureMarkerDot" class="pension-future-marker-dot" cx="${escapeHtml(selected.x.toFixed(2))}" cy="${escapeHtml(selected.assetY.toFixed(2))}" r="5"></circle>${xAges.map((age, i) => { const ratio = (age - p.currentAge) / Math.max(1, p.retirementAge - p.currentAge), x = c.L + ratio * c.CW; return `<text class="pension-future-axis" x="${escapeHtml(x)}" y="${escapeHtml(c.H - 8)}" text-anchor="${escapeHtml(i === 0 ? 'start' : i === xAges.length - 1 ? 'end' : 'middle')}">${age}세</text>`; }).join('')}<rect class="pension-future-track" data-pension-future-track x="${escapeHtml(c.L)}" y="${escapeHtml(c.T)}" width="${escapeHtml(c.CW)}" height="${escapeHtml(c.CH + 8)}"></rect></svg></div><div class="pension-future-legend"><span><i></i>예상자산</span><span><i class="cost"></i>누적 납입원금</span></div><details class="pension-future-details"><summary>ⓘ 계산 기준</summary><div class="pension-future-assumptions"><span>월 ${won(p.monthly)}</span><span>수익률 ${(p.annual * 100).toFixed(1)}%</span><span>인출률 ${(p.withdrawal * 100).toFixed(1)}%</span></div><p>현재 자산과 월 납입액을 기준으로 단순 복리 계산한 예상치입니다. 그래프를 좌우로 움직이면 선택한 나이의 예상자산과 월 연금이 위 금액에 함께 반영됩니다.</p></details>`; }
function updatePensionFuturePoint(clientX) { const svg = $('#pensionFutureChart'), hit = $('[data-pension-future-track]'); if (!svg)
    return; const c = pensionFutureChartModel(), rect = (hit || svg).getBoundingClientRect(), ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width))), idx = Math.max(0, Math.min(c.points.length - 1, Math.round(ratio * (c.points.length - 1)))), pt = c.points[idx]; pensionFutureSelectedAge = pt.age; $('#pensionFutureMarkerLine')?.setAttribute('x1', pt.x.toFixed(2)); $('#pensionFutureMarkerLine')?.setAttribute('x2', pt.x.toFixed(2)); $('#pensionFutureMarkerDot')?.setAttribute('cx', pt.x.toFixed(2)); $('#pensionFutureMarkerDot')?.setAttribute('cy', pt.assetY.toFixed(2)); $('#pensionFutureCostDot')?.setAttribute('cx', pt.x.toFixed(2)); $('#pensionFutureCostDot')?.setAttribute('cy', pt.costY.toFixed(2)); if ($('#pensionFutureAgeLabel'))
    $('#pensionFutureAgeLabel').textContent = `${pt.age}세`; if ($('#pensionFutureCostLabel')) {
    $('#pensionFutureCostLabel').textContent = pensionReadableWon(pt.principal);
    $('#pensionFutureCostLabel').title = won(pt.principal);
} if ($('#pensionFutureHeadlineAge'))
    $('#pensionFutureHeadlineAge').textContent = `${pt.age}세 예상자산`; if ($('#pensionFutureHeadlineMonthlyAge'))
    $('#pensionFutureHeadlineMonthlyAge').textContent = `${pt.age}세 월 연금`; if ($('#pensionFutureHeadlineValue')) {
    $('#pensionFutureHeadlineValue').textContent = pensionFutureHeadlineWon(pt.value);
    $('#pensionFutureHeadlineValue').className = pensionFutureAmountClass(pt.value);
    $('#pensionFutureHeadlineValue').title = won(pt.value);
    $('#pensionFutureHeadlineValue').setAttribute('aria-label', won(pt.value));
} if ($('#pensionFutureHeadlineMonthly')) {
    $('#pensionFutureHeadlineMonthly').textContent = pensionFutureHeadlineWon(pt.monthlyPension);
    $('#pensionFutureHeadlineMonthly').className = pensionFutureAmountClass(pt.monthlyPension);
    $('#pensionFutureHeadlineMonthly').title = won(pt.monthlyPension);
    $('#pensionFutureHeadlineMonthly').setAttribute('aria-label', won(pt.monthlyPension));
} }
function bindPensionFutureSheet() { const track = $('[data-pension-future-track]'); if (!track)
    return; let active = false, pointerId = null; const lock = (e) => { active = true; pointerId = e.pointerId; e.preventDefault(); e.stopPropagation(); try {
    track.setPointerCapture(e.pointerId);
}
catch { } ; updatePensionFuturePoint(e.clientX); }; const move = (e) => { if (!active || e.pointerId !== pointerId)
    return; if (e.pointerType === 'mouse' && !e.buttons)
    return; e.preventDefault(); e.stopPropagation(); updatePensionFuturePoint(e.clientX); }; const release = (e) => { if (!active)
    return; e.preventDefault(); e.stopPropagation(); updatePensionFuturePoint(e.clientX); active = false; try {
    track.releasePointerCapture(pointerId ?? e.pointerId);
}
catch { } ; pointerId = null; }; track.style.touchAction = 'none'; track.onpointerdown = lock; track.onpointermove = move; track.onpointerup = release; track.onpointercancel = release; track.onlostpointercapture = () => { active = false; pointerId = null; }; }
;
/* asset-os source: chart-asset-analysis.js */
'use strict';
function analysisSeekMarkup(rows, kind, selectedKey) { const index = Math.max(0, rows.findIndex(row => row.key === selectedKey)); return `<div class="analysis-seek"><input type="range" min="0" max="${escapeHtml(Math.max(1, rows.length - 1))}" value="${escapeHtml(index)}" step="1" ${rows.length < 2 ? 'disabled' : ''} data-analysis-seek="${escapeHtml(kind)}" aria-label="기록 날짜 선택"><span data-analysis-date="${escapeHtml(kind)}">${escapeHtml(rows[index]?.date || '')}</span></div>`; }
function bindAnalysisGesture(svgSelector, kind, update) {
    const svg = $(svgSelector), hit = svg?.querySelector('.pension-analysis-hit');
    if (!svg || !hit)
        return;
    let pointerId = null;
    svg.style.touchAction = 'none';
    svg.onpointerdown = (e) => { if (e.pointerType === 'mouse' && e.button !== 0)
        return; pointerId = e.pointerId; e.preventDefault(); e.stopPropagation(); try {
        svg.setPointerCapture(e.pointerId);
    }
    catch { } update(e.clientX); };
    svg.onpointermove = (e) => { if (e.pointerId !== pointerId)
        return; e.preventDefault(); e.stopPropagation(); update(e.clientX); };
    const end = (e) => { if (e.pointerId !== pointerId)
        return; e.preventDefault(); e.stopPropagation(); if (e.type !== 'pointercancel')
        update(e.clientX); try {
        svg.releasePointerCapture(e.pointerId);
    }
    catch { } pointerId = null; };
    svg.onpointerup = end;
    svg.onpointercancel = end;
    svg.onlostpointercapture = () => { pointerId = null; };
    const touch = (e) => { if (e.touches.length !== 1)
        return; e.preventDefault(); e.stopPropagation(); update(e.touches[0].clientX); };
    svg.addEventListener('touchstart', touch, { passive: false });
    svg.addEventListener('touchmove', touch, { passive: false });
    const seek = $(kind === 'isa' ? '#sheetBody [data-analysis-seek="isa"]' : '#sheetBody [data-analysis-seek="pension"]');
    seek?.addEventListener('input', () => { const rect = hit.getBoundingClientRect(), ratio = Number(seek.value) / Math.max(1, Number(seek.max)); update(rect.left + ratio * rect.width); });
}
function syncAnalysisSeek(kind, index, date) { const seek = $(kind === 'isa' ? '#sheetBody [data-analysis-seek="isa"]' : '#sheetBody [data-analysis-seek="pension"]'), label = $(kind === 'isa' ? '#sheetBody [data-analysis-date="isa"]' : '#sheetBody [data-analysis-date="pension"]'); if (seek) {
    seek.value = String(index);
    seek.setAttribute('aria-valuetext', date);
} if (label)
    label.textContent = date; }
function pensionMonthSerial(date) { const d = new Date(String(date).slice(0, 10) + 'T00:00:00'); return d.getFullYear() * 12 + d.getMonth(); }
function pensionPeriodCutoffSerial(latest, period) { const span = period === '3m' ? 3 : period === '6m' ? 6 : period === '1y' ? 12 : period === '3y' ? 36 : period === '5y' ? 60 : Infinity; return Number.isFinite(span) ? latest - span + 1 : -Infinity; }
function pensionAggregateSnapshotRows(rows, grain) { const map = new Map(); for (const x of rows) {
    const d = new Date(String(x.date).slice(0, 10) + 'T00:00:00'), y = d.getFullYear(), m = d.getMonth(), key = grain === 'month' ? `${y}-${String(m + 1).padStart(2, '0')}` : grain === 'quarter' ? `${y}-Q${Math.floor(m / 3) + 1}` : `${y}`, label = grain === 'month' ? `${String(m + 1).padStart(2, '0')}월` : grain === 'quarter' ? `${String(y).slice(-2)} Q${Math.floor(m / 3) + 1}` : `${y}`;
    map.set(key, { ...x, key, label, periodKey: key });
} return [...map.values()].sort((a, b) => a.date.localeCompare(b.date)); }
function pensionAnalysisDisplayRows(scope = 'all', period = pensionAnalysisPeriod) { const raw = pensionSnapshotRows(scope); if (!raw.length)
    return []; const latest = pensionMonthSerial(raw[raw.length - 1].date), cut = pensionPeriodCutoffSerial(latest, period), filtered = raw.filter(x => pensionMonthSerial(x.date) >= cut), months = Math.max(1, latest - pensionMonthSerial(filtered[0].date) + 1); let grain = 'month'; if (period === '3y' && filtered.length > 18)
    grain = 'quarter';
else if (period === '5y')
    grain = filtered.length > 18 ? 'quarter' : 'month';
else if (period === 'all') {
    if (months > 60)
        grain = 'year';
    else if (months > 24)
        grain = 'quarter';
} const aggregated = pensionAggregateSnapshotRows(filtered, grain), archive = typeof pensionArchivePerformanceDisplayRows === 'function' ? pensionArchivePerformanceDisplayRows(scope, period) : []; return aggregated.length < 2 && archive.length > aggregated.length ? [] : aggregated; }
function pensionAnalysisPeriodLabel(period) { return period === '3m' ? '3개월' : period === '6m' ? '6개월' : period === '1y' ? '1년' : period === '3y' ? '3년' : period === '5y' ? '5년' : '전체'; }
function pensionAnalysisGrainLabel(rows) { if (!rows.length)
    return '기록 없음'; if (rows.every(x => /^\d{4}-\d{2}$/.test(String(x.key || ''))))
    return '월'; if (rows.some(x => /Q\d/.test(x.label)))
    return '분기'; if (rows.some(x => /^\d{4}$/.test(x.label)))
    return '연도'; if (rows.some(x => /^\d{2}\.\d{2}$/.test(x.label)))
    return '일'; return '월'; }
function pensionAnalysisTickIndexes(n, period = '') { const maxTicks = period === '3m' ? 3 : period === '6m' ? 6 : period === '1y' ? 6 : period === 'all' ? 8 : 8; if (n <= maxTicks)
    return new Set(Array.from({ length: n }, (_, i) => i)); const out = new Set([0, n - 1]); for (let k = 1; k < maxTicks - 1; k++)
    out.add(Math.round(k * (n - 1) / (maxTicks - 1))); return out; }
function investmentAxisLabel(row, period, index = 0) { const label = String(row?.label || ''); if (period === '1y')
    return label.replace(/^0/, ''); if (/Q\d/.test(label)) {
    const m = label.match(/(\d{2}) Q(\d)/);
    if (!m)
        return label;
    return m[2] === '1' ? `${m[1]}Q1` : `Q${m[2]}`;
} if (/^\d{4}$/.test(label))
    return label.slice(-2); return label; }
let isaAnalysisPeriod = '1y', isaAnalysisSelectedKey = '';
function isaSnapshotRows(a = currentAccount()) { const raw = Array.isArray(a?.assetSnapshots) ? a.assetSnapshots : [], m = accountMetrics(a), rows = raw.map(x => { const date = String(x.date || '').slice(0, 10); return { key: date, date, label: date.slice(5).replace('-', '.'), cost: Number(x.cost) || 0, value: Number(x.value) || 0 }; }).sort((x, y) => x.date.localeCompare(y.date)); if (!rows.length) {
    const securitiesValue = (m.holdings || []).reduce((sum, h) => sum + (Number(h.marketValue) || 0), 0), date = localYmd();
    rows.push({ key: date, date, label: date.slice(5).replace('-', '.'), cost: m.cost, value: securitiesValue });
} return rows; }
function isaAggregateSnapshotRows(rows, grain) { if (grain === 'day')
    return rows.map(x => ({ ...x, key: x.date, label: x.date.slice(5).replace('-', '.') })); const map = new Map(); for (const x of rows) {
    const d = new Date(`${x.date}T00:00:00`), y = d.getFullYear(), m = d.getMonth(), key = grain === 'month' ? `${y}-${String(m + 1).padStart(2, '0')}` : grain === 'quarter' ? `${y}-Q${Math.floor(m / 3) + 1}` : `${y}`, label = grain === 'month' ? `${String(m + 1).padStart(2, '0')}월` : grain === 'quarter' ? `${String(y).slice(-2)} Q${Math.floor(m / 3) + 1}` : `${y}`;
    map.set(key, { ...x, key, label, periodKey: key });
} return [...map.values()].sort((x, y) => x.date.localeCompare(y.date)); }
function isaAnalysisDisplayRows(a = currentAccount(), period = isaAnalysisPeriod) { const raw = isaSnapshotRows(a); if (!raw.length)
    return []; const latest = pensionMonthSerial(raw[raw.length - 1].date), cut = pensionPeriodCutoffSerial(latest, period), filtered = raw.filter(x => pensionMonthSerial(x.date) >= cut), months = Math.max(1, latest - pensionMonthSerial(filtered[0].date) + 1); let grain = ['3m', '6m'].includes(period) ? 'day' : 'month'; if (period === '3y' && filtered.length > 18)
    grain = 'quarter';
else if (period === '5y')
    grain = filtered.length > 18 ? 'quarter' : 'month';
else if (period === 'all') {
    if (months > 60)
        grain = 'year';
    else if (months > 24)
        grain = 'quarter';
} return isaAggregateSnapshotRows(filtered, grain); }
function isaAnalysisMarkup(a = currentAccount()) { const rows = isaAnalysisDisplayRows(a), W = 320, H = 168, L = 44, R = 9, T = 12, B = 27, CW = W - L - R, CH = H - T - B, sel = rows.find(x => x.key === isaAnalysisSelectedKey) || rows[rows.length - 1]; if (!rows.length)
    return '<div class="empty-state"><strong>아직 ISA 보유종목 평가액 추이 기록이 없습니다.</strong></div>'; const axis = pensionTightAxisRange(rows.flatMap(x => [x.value, x.cost])), range = Math.max(1, axis.max - axis.min), pts = rows.map((x, i) => ({ ...x, x: L + (rows.length <= 1 ? CW : i / (rows.length - 1) * CW), valueY: T + CH - ((x.value - axis.min) / range) * CH, costY: T + CH - ((x.cost - axis.min) / range) * CH })), line = (k) => `M ${pts.map((p, i) => `${i ? 'L' : ' '}${p.x.toFixed(1)} ${p[k].toFixed(1)}`).join(' ')}`, selected = pts.find(x => x.key === sel.key) || pts[pts.length - 1], profit = selected.value - selected.cost, rate = selected.cost ? profit / selected.cost * 100 : 0, yTicks = Array.from({ length: 4 }, (_, i) => axis.max - (axis.max - axis.min) * (i / 3)), ticks = pensionAnalysisTickIndexes(pts.length, isaAnalysisPeriod), periods = [['3m', '3M'], ['6m', '6M'], ['1y', '1Y'], ['3y', '3Y'], ['5y', '5Y'], ['all', '전체']]; return `<div class="pension-analysis-minihead"><strong>수익 흐름</strong><div class="isa-analysis-period-pills">${periods.map(([k, l]) => `<button class="${escapeHtml(isaAnalysisPeriod === k ? 'active' : '')}" data-isa-analysis-period="${escapeHtml(k)}">${l}</button>`).join('')}</div></div><div class="pension-earnings-grid"><div class="pension-earning-box primary"><span>평가손익</span><strong id="isaAnalysisProfit" class="${escapeHtml(profit < 0 ? 'negative' : 'positive')}">${signed(profit)}</strong></div><div class="pension-earning-box primary"><span>수익률</span><strong id="isaAnalysisRate" class="${escapeHtml(rate < 0 ? 'negative' : 'positive')}">${pct(rate)}</strong></div><div class="pension-earning-box"><span id="isaAnalysisPointLabel">${escapeHtml(selected.date)} 보유종목</span><strong id="isaAnalysisValue">${won(selected.value)}</strong></div><div class="pension-earning-box"><span>투자원금</span><strong id="isaAnalysisCost">${won(selected.cost)}</strong></div></div><div class="pension-analysis-period-meta"><strong>${escapeHtml(rows[0].date)} ~ ${escapeHtml(rows.at(-1).date)}</strong> · ${pensionAnalysisGrainLabel(rows)}별</div><div class="pension-analysis-chart-wrap compact"><svg id="isaAnalysisChart" class="pension-analysis-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="ISA 보유종목 평가액 추이">${yTicks.map((v, i) => { const y = T + CH * (i / 3); return `<line class="pension-analysis-grid" x1="${escapeHtml(L)}" y1="${escapeHtml(y)}" x2="${escapeHtml(W - R)}" y2="${escapeHtml(y)}"></line><text class="pension-analysis-axis" x="${escapeHtml(L - 5)}" y="${escapeHtml(y + 3)}" text-anchor="end">${pensionCompactWon(v)}</text>`; }).join('')}<path class="pension-analysis-cost" d="${escapeHtml(line('costY'))}"></path><path class="pension-analysis-asset" d="${escapeHtml(line('valueY'))}"></path><circle id="isaAnalysisCostDot" class="pension-analysis-dot cost" cx="${escapeHtml(selected.x)}" cy="${escapeHtml(selected.costY)}" r="4"></circle><circle id="isaAnalysisValueDot" class="pension-analysis-dot asset" cx="${escapeHtml(selected.x)}" cy="${escapeHtml(selected.valueY)}" r="5"></circle><line id="isaAnalysisMarker" class="pension-analysis-marker" x1="${escapeHtml(selected.x)}" x2="${escapeHtml(selected.x)}" y1="${escapeHtml(T)}" y2="${escapeHtml(T + CH)}"></line>${pts.map((p, i) => ticks.has(i) ? `<text class="pension-analysis-axis investment-x-label" x="${escapeHtml(p.x)}" y="${escapeHtml(H - 6)}" text-anchor="${escapeHtml(i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle')}">${escapeHtml(investmentAxisLabel(p, isaAnalysisPeriod, i))}</text>` : '').join('')}<rect class="pension-analysis-hit" data-isa-analysis-track x="${escapeHtml(L)}" y="${escapeHtml(T)}" width="${escapeHtml(CW)}" height="${escapeHtml(CH + 8)}"></rect></svg></div>${analysisSeekMarkup(pts, 'isa', selected.key)}<div class="pension-analysis-legend compact"><span><i></i>보유종목 평가액</span><span><i class="cost"></i>투자원금</span></div>`; }
function updateIsaAnalysisPoint(clientX) { const svg = $('#isaAnalysisChart'), hit = $('[data-isa-analysis-track]'); if (!svg)
    return; const rows = isaAnalysisDisplayRows(currentAccount(), isaAnalysisPeriod); if (!rows.length)
    return; const W = 320, H = 168, L = 44, R = 9, T = 12, B = 27, CW = W - L - R, CH = H - T - B, rect = (hit || svg).getBoundingClientRect(), ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width))), idx = Math.max(0, Math.min(rows.length - 1, Math.round(ratio * (rows.length - 1)))), row = rows[idx], x = L + (rows.length <= 1 ? CW : idx / (rows.length - 1) * CW), axis = pensionTightAxisRange(rows.flatMap(x => [x.value, x.cost])), range = Math.max(1, axis.max - axis.min), valueY = T + CH - ((row.value - axis.min) / range) * CH, costY = T + CH - ((row.cost - axis.min) / range) * CH, profit = row.value - row.cost, rate = row.cost ? profit / row.cost * 100 : 0; isaAnalysisSelectedKey = row.key; syncAnalysisSeek('isa', idx, row.date); $('#isaAnalysisMarker')?.setAttribute('x1', x.toFixed(1)); $('#isaAnalysisMarker')?.setAttribute('x2', x.toFixed(1)); $('#isaAnalysisValueDot')?.setAttribute('cx', x.toFixed(1)); $('#isaAnalysisValueDot')?.setAttribute('cy', valueY.toFixed(1)); $('#isaAnalysisCostDot')?.setAttribute('cx', x.toFixed(1)); $('#isaAnalysisCostDot')?.setAttribute('cy', costY.toFixed(1)); if ($('#isaAnalysisPointLabel'))
    $('#isaAnalysisPointLabel').textContent = `${row.date} 보유종목`; if ($('#isaAnalysisValue'))
    $('#isaAnalysisValue').textContent = won(row.value); if ($('#isaAnalysisCost'))
    $('#isaAnalysisCost').textContent = won(row.cost); if ($('#isaAnalysisProfit')) {
    $('#isaAnalysisProfit').textContent = signed(profit);
    $('#isaAnalysisProfit').className = profit < 0 ? 'negative' : 'positive';
} if ($('#isaAnalysisRate')) {
    $('#isaAnalysisRate').textContent = pct(rate);
    $('#isaAnalysisRate').className = rate < 0 ? 'negative' : 'positive';
} }
function bindIsaAssetAnalysis() { $$('[data-isa-analysis-period]').forEach(b => b.onclick = () => { isaAnalysisPeriod = ['3m', '6m', '1y', '3y', '5y', 'all'].includes((b.dataset.isaAnalysisPeriod || '')) ? (b.dataset.isaAnalysisPeriod || '') : '1y'; isaAnalysisSelectedKey = ''; $('#sheetBody').innerHTML = isaAnalysisMarkup(currentAccount()); bindIsaAssetAnalysis(); }); bindAnalysisGesture('#sheetBody #isaAnalysisChart', 'isa', updateIsaAnalysisPoint); }
function openIsaAssetAnalysis() { isaAnalysisPeriod = '1y'; isaAnalysisSelectedKey = ''; $('#sheetEyebrow').textContent = 'ISA'; $('#sheetTitle').textContent = '자산 분석'; $('#sheetBody').innerHTML = isaAnalysisMarkup(currentAccount()); openSheet('#detailSheet'); bindIsaAssetAnalysis(); }
let pensionAnalysisScope = 'all', pensionAnalysisMode = 'trend', pensionAnalysisSelectedKey = '', pensionAnalysisPeriod = '1y';
function pensionSnapshotRows(scope = 'all') { const raw = pensionStore().assetSnapshots || []; return raw.map(x => { const ps = (typeof financialHistoryPensionRow === 'function' ? financialHistoryPensionRow(x, 'pension') : x.pension) || { cost: 0, value: 0 }, irp = (typeof financialHistoryPensionRow === 'function' ? financialHistoryPensionRow(x, 'irp') : x.irp) || { cost: 0, value: 0 }; let cost = 0, value = 0; if (scope === 'pension') {
    cost = Number(ps.cost) || 0;
    value = Number(ps.value) || 0;
}
else if (scope === 'irp') {
    cost = Number(irp.cost) || 0;
    value = Number(irp.value) || 0;
}
else {
    cost = (Number(ps.cost) || 0) + (Number(irp.cost) || 0);
    value = (Number(ps.value) || 0) + (Number(irp.value) || 0);
} return { key: String(x.date).slice(0, 7), date: x.date, label: String(x.date).slice(5, 7) + '월', cost, value, profit: value - cost, rate: cost ? (value - cost) / cost * 100 : 0 }; }).sort((a, b) => a.date.localeCompare(b.date)); }
function pensionArchivePerformanceDisplayRows(scope = 'all', period = pensionAnalysisPeriod) { const raw = typeof pensionArchivePerformanceRows === 'function' ? pensionArchivePerformanceRows(scope) : []; if (!raw.length)
    return []; const latest = pensionMonthSerial(raw.at(-1).date), cut = pensionPeriodCutoffSerial(latest, period), filtered = raw.filter(x => pensionMonthSerial(x.date) >= cut), months = Math.max(1, latest - pensionMonthSerial(filtered[0].date) + 1); let grain = 'month'; if (period === '3y' && filtered.length > 18)
    grain = 'quarter';
else if (period === '5y')
    grain = filtered.length > 18 ? 'quarter' : 'month';
else if (period === 'all') {
    if (months > 60)
        grain = 'year';
    else if (months > 24)
        grain = 'quarter';
} if (grain === 'month')
    return filtered; const map = new Map(); for (const x of filtered) {
    const d = new Date(String(x.date).slice(0, 10) + 'T00:00:00'), y = d.getFullYear(), m = d.getMonth(), key = grain === 'quarter' ? `${y}-Q${Math.floor(m / 3) + 1}` : `${y}`, label = grain === 'quarter' ? `${String(y).slice(-2)} Q${Math.floor(m / 3) + 1}` : `${y}`;
    map.set(key, { ...x, key, label });
} return [...map.values()].sort((a, b) => a.date.localeCompare(b.date)); }
function pensionArchivePerformanceChartMarkup(scope) { const rows = pensionArchivePerformanceDisplayRows(scope, pensionAnalysisPeriod), W = 320, H = 154, L = 44, R = 9, T = 12, B = 24, CW = W - L - R, CH = H - T - B, sel = rows.find(x => x.key === pensionAnalysisSelectedKey) || rows.at(-1); if (!rows.length)
    return '<div class="empty-state"><strong>연결할 과거 연금자료가 없습니다.</strong></div>'; const basis = pensionAssetMetrics(scope).cost, axis = pensionTightAxisRange(rows.flatMap(x => [basis, basis + x.cumulativeTotal])), range = Math.max(1, axis.max - axis.min), pts = rows.map((x, i) => ({ ...x, x: L + (rows.length <= 1 ? CW : i / (rows.length - 1) * CW), value: basis + x.cumulativeTotal, valueY: T + CH - (((basis + x.cumulativeTotal) - axis.min) / range) * CH, basisY: T + CH - ((basis - axis.min) / range) * CH })), line = (k) => `M ${pts.map((p, i) => `${i ? 'L' : ' '}${p.x.toFixed(1)} ${p[k].toFixed(1)}`).join(' ')}`, selected = pts.find(x => x.key === sel.key) || pts.at(-1), yTicks = Array.from({ length: 4 }, (_, i) => axis.max - (axis.max - axis.min) * (i / 3)), ticks = pensionAnalysisTickIndexes(pts.length, pensionAnalysisPeriod); return `<div class="pension-earnings-grid"><div class="pension-earning-box"><span>기준 투자원금</span><strong id="pensionArchiveBasis">${won(basis)}</strong></div><div class="pension-earning-box"><span>누적 실현손익</span><strong id="pensionArchiveRealized" class="${escapeHtml(selected.cumulativeRealized < 0 ? 'negative' : 'positive')}">${signed(selected.cumulativeRealized)}</strong></div><div class="pension-earning-box"><span>누적 배당</span><strong id="pensionArchiveIncome" class="${escapeHtml(selected.cumulativeIncome < 0 ? 'negative' : 'positive')}">${signed(selected.cumulativeIncome)}</strong></div><div class="pension-earning-box primary"><span>확정수익 환산자산</span><strong id="pensionArchiveValue">${won(selected.value)}</strong></div></div><div class="pension-analysis-period-meta"><strong>${escapeHtml(rows[0].date)} ~ ${escapeHtml(rows.at(-1).date)}</strong> · ${pensionAnalysisGrainLabel(rows)}별</div><div class="pension-analysis-chart-wrap compact"><svg id="pensionAnalysisChart" class="pension-analysis-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="기준 투자원금에 누적 실현손익과 배당을 더한 환산자산 추이">${yTicks.map((v, i) => { const y = T + CH * (i / 3); return `<line class="pension-analysis-grid" x1="${escapeHtml(L)}" y1="${escapeHtml(y)}" x2="${escapeHtml(W - R)}" y2="${escapeHtml(y)}"></line><text class="pension-analysis-axis" x="${escapeHtml(L - 5)}" y="${escapeHtml(y + 3)}" text-anchor="end">${pensionCompactWon(v)}</text>`; }).join('')}<path class="pension-analysis-cost" d="${escapeHtml(line('basisY'))}"></path><path class="pension-analysis-asset" d="${escapeHtml(line('valueY'))}"></path><circle id="pensionArchiveBasisDot" class="pension-analysis-dot cost" cx="${escapeHtml(selected.x)}" cy="${escapeHtml(selected.basisY)}" r="4"></circle><circle id="pensionArchiveValueDot" class="pension-analysis-dot asset" cx="${escapeHtml(selected.x)}" cy="${escapeHtml(selected.valueY)}" r="5"></circle><line id="pensionAnalysisMarker" class="pension-analysis-marker" x1="${escapeHtml(selected.x)}" x2="${escapeHtml(selected.x)}" y1="${escapeHtml(T)}" y2="${escapeHtml(T + CH)}"></line>${pts.map((p, i) => ticks.has(i) ? `<text class="pension-analysis-axis" x="${escapeHtml(p.x)}" y="${escapeHtml(H - 6)}" text-anchor="${escapeHtml(i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle')}">${escapeHtml(investmentAxisLabel(p, pensionAnalysisPeriod, i))}</text>` : '').join('')}<rect class="pension-analysis-hit" data-pension-analysis-track x="${escapeHtml(L)}" y="${escapeHtml(T)}" width="${escapeHtml(CW)}" height="${escapeHtml(CH + 7)}"></rect></svg></div>${analysisSeekMarkup(pts, 'pension', selected.key)}<div class="pension-analysis-legend compact"><span><i></i>확정수익 환산자산</span><span><i class="cost"></i>기준 투자원금</span></div><div class="source-note">당시 실제 계좌잔액이 아니라 현재 기준 투자원금에 월별 누적 실현손익과 배당을 더한 환산 흐름입니다. 잔고·납입 원장에는 중복 가산하지 않습니다.</div>`; }
function pensionAnalysisChartMarkup(scope, mode, selectedKey = '') { if (mode === 'performance')
    return pensionContributionAnalysisMarkup(scope); const rows = pensionAnalysisDisplayRows(scope, pensionAnalysisPeriod), W = 320, H = 154, L = 44, R = 9, T = 12, B = 24, CW = W - L - R, CH = H - T - B, sel = rows.find(x => x.key === selectedKey) || rows[rows.length - 1]; if (!rows.length)
    return pensionArchivePerformanceChartMarkup(scope); const axis = pensionTightAxisRange(rows.flatMap(x => [x.value, x.cost])), min = axis.min, max = axis.max, range = Math.max(1, max - min), pts = rows.map((x, i) => ({ ...x, x: L + (rows.length <= 1 ? CW : i / (rows.length - 1) * CW), valueY: T + CH - ((x.value - min) / range) * CH, costY: T + CH - ((x.cost - min) / range) * CH })), line = (key) => `M ${pts.map((p, i) => `${i ? 'L' : ' '}${p.x.toFixed(1)} ${p[key].toFixed(1)}`).join(' ')}`, selected = pts.find(x => x.key === (sel?.key || '')) || pts[pts.length - 1], tickCount = 4, yTicks = Array.from({ length: tickCount }, (_, i) => max - (max - min) * (i / (tickCount - 1))), ticks = pensionAnalysisTickIndexes(pts.length, pensionAnalysisPeriod), profit = selected.value - selected.cost, rate = selected.cost ? profit / selected.cost * 100 : 0, focus = `<div class="pension-earnings-grid"><div class="pension-earning-box primary"><span>평가손익</span><strong id="pensionAnalysisProfit" class="${escapeHtml(profit < 0 ? 'negative' : 'positive')}">${signed(profit)}</strong></div><div class="pension-earning-box primary"><span>수익률</span><strong id="pensionAnalysisRate" class="${escapeHtml(rate < 0 ? 'negative' : 'positive')}">${pct(rate)}</strong></div><div class="pension-earning-box"><span id="pensionAnalysisPointLabel">${escapeHtml(selected.date)} 평가자산</span><strong id="pensionAnalysisValue">${won(selected.value)}</strong></div><div class="pension-earning-box"><span>투자원금</span><strong id="pensionAnalysisCost">${won(selected.cost)}</strong></div></div>`, meta = `<div class="pension-analysis-period-meta"><strong>${escapeHtml(rows[0].date)} ~ ${escapeHtml(rows.at(-1).date)}</strong> · ${pensionAnalysisGrainLabel(rows)}별</div>`; return `${focus}${meta}<div class="pension-analysis-chart-wrap compact"><svg id="pensionAnalysisChart" class="pension-analysis-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="자산 추이">${yTicks.map((v, i) => { const y = T + CH * (i / (tickCount - 1)); return `<line class="pension-analysis-grid" x1="${escapeHtml(L)}" y1="${escapeHtml(y)}" x2="${escapeHtml(W - R)}" y2="${escapeHtml(y)}"></line><text class="pension-analysis-axis" x="${escapeHtml(L - 5)}" y="${escapeHtml(y + 3)}" text-anchor="end">${pensionCompactWon(v)}</text>`; }).join('')}<path class="pension-analysis-cost" d="${escapeHtml(line('costY'))}"></path><path class="pension-analysis-asset" d="${escapeHtml(line('valueY'))}"></path><circle id="pensionAnalysisCostDot" class="pension-analysis-dot cost" cx="${escapeHtml(selected.x)}" cy="${escapeHtml(selected.costY)}" r="4"></circle><circle id="pensionAnalysisValueDot" class="pension-analysis-dot asset" cx="${escapeHtml(selected.x)}" cy="${escapeHtml(selected.valueY)}" r="5"></circle><line id="pensionAnalysisMarker" class="pension-analysis-marker" x1="${escapeHtml(selected.x)}" x2="${escapeHtml(selected.x)}" y1="${escapeHtml(T)}" y2="${escapeHtml(T + CH)}"></line>${pts.map((p, i) => ticks.has(i) ? `<text class="pension-analysis-axis" x="${escapeHtml(p.x)}" y="${escapeHtml(H - 6)}" text-anchor="${escapeHtml(i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle')}">${escapeHtml(investmentAxisLabel(p, pensionAnalysisPeriod, i))}</text>` : '').join('')}<rect class="pension-analysis-hit" data-pension-analysis-track x="${escapeHtml(L)}" y="${escapeHtml(T)}" width="${escapeHtml(CW)}" height="${escapeHtml(CH + 7)}"></rect></svg></div>${analysisSeekMarkup(pts, 'pension', selected.key)}<div class="pension-analysis-legend compact"><span><i></i>평가자산</span><span><i class="cost"></i>투자원금</span></div>`; }
function pensionAnalysisSheetMarkup() { const scope = pensionAssetScope(); pensionAnalysisScope = scope; if (pensionAnalysisMode === 'performance')
    return `<div class="pension-analysis-minihead"><strong>성과 기여도</strong><button data-pension-analysis-mode="trend">자산 추이로 ›</button></div>${pensionAnalysisChartMarkup(scope, 'performance', pensionAnalysisSelectedKey)}`; const periods = [['3m', '3M'], ['6m', '6M'], ['1y', '1Y'], ['3y', '3Y'], ['5y', '5Y'], ['all', '전체']]; return `<div class="pension-analysis-minihead"><strong>수익 흐름</strong><div class="pension-analysis-period-pills">${periods.map(([k, l]) => `<button class="${escapeHtml(pensionAnalysisPeriod === k ? 'active' : '')}" data-pension-analysis-period="${escapeHtml(k)}">${l}</button>`).join('')}</div></div>${pensionAnalysisChartMarkup(scope, 'trend', pensionAnalysisSelectedKey)}<button class="pension-analysis-more" data-pension-analysis-mode="performance">성과 기여도 보기 ›</button>`; }
function updatePensionAnalysisPoint(clientX) { const svg = $('#pensionAnalysisChart'), hit = $('[data-pension-analysis-track]'); if (!svg || pensionAnalysisMode !== 'trend')
    return; let rows = pensionAnalysisDisplayRows(pensionAnalysisScope, pensionAnalysisPeriod); const archive = !rows.length; if (archive)
    rows = pensionArchivePerformanceDisplayRows(pensionAnalysisScope, pensionAnalysisPeriod); if (!rows.length)
    return; const W = 320, H = 154, L = 44, R = 9, T = 12, B = 24, CW = W - L - R, CH = H - T - B, rect = (hit || svg).getBoundingClientRect(), ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width))), idx = Math.max(0, Math.min(rows.length - 1, Math.round(ratio * (rows.length - 1)))), row = rows[idx], x = L + (rows.length <= 1 ? CW : idx / (rows.length - 1) * CW); pensionAnalysisSelectedKey = row.key; syncAnalysisSeek('pension', idx, row.date); $('#pensionAnalysisMarker')?.setAttribute('x1', x.toFixed(1)); $('#pensionAnalysisMarker')?.setAttribute('x2', x.toFixed(1)); if (archive) {
    const basis = pensionAssetMetrics(pensionAnalysisScope).cost, axis = pensionTightAxisRange(rows.flatMap(x => [basis, basis + x.cumulativeTotal])), range = Math.max(1, axis.max - axis.min), value = basis + row.cumulativeTotal, valueY = T + CH - ((value - axis.min) / range) * CH, basisY = T + CH - ((basis - axis.min) / range) * CH;
    $('#pensionArchiveValueDot')?.setAttribute('cx', x.toFixed(1));
    $('#pensionArchiveValueDot')?.setAttribute('cy', valueY.toFixed(1));
    $('#pensionArchiveBasisDot')?.setAttribute('cx', x.toFixed(1));
    $('#pensionArchiveBasisDot')?.setAttribute('cy', basisY.toFixed(1));
    if ($('#pensionArchiveBasis'))
        $('#pensionArchiveBasis').textContent = won(basis);
    if ($('#pensionArchiveValue'))
        $('#pensionArchiveValue').textContent = won(value);
    if ($('#pensionArchiveRealized')) {
        $('#pensionArchiveRealized').textContent = signed(row.cumulativeRealized);
        $('#pensionArchiveRealized').className = row.cumulativeRealized < 0 ? 'negative' : 'positive';
    }
    if ($('#pensionArchiveIncome')) {
        $('#pensionArchiveIncome').textContent = signed(row.cumulativeIncome);
        $('#pensionArchiveIncome').className = row.cumulativeIncome < 0 ? 'negative' : 'positive';
    }
    return;
} const axis = pensionTightAxisRange(rows.flatMap(x => [x.value, x.cost])), range = Math.max(1, axis.max - axis.min), valueY = T + CH - ((row.value - axis.min) / range) * CH, costY = T + CH - ((row.cost - axis.min) / range) * CH, profit = row.value - row.cost, rate = row.cost ? profit / row.cost * 100 : 0; $('#pensionAnalysisValueDot')?.setAttribute('cx', x.toFixed(1)); $('#pensionAnalysisValueDot')?.setAttribute('cy', valueY.toFixed(1)); $('#pensionAnalysisCostDot')?.setAttribute('cx', x.toFixed(1)); $('#pensionAnalysisCostDot')?.setAttribute('cy', costY.toFixed(1)); if ($('#pensionAnalysisPointLabel'))
    $('#pensionAnalysisPointLabel').textContent = `${row.date} 평가자산`; if ($('#pensionAnalysisValue'))
    $('#pensionAnalysisValue').textContent = won(row.value); if ($('#pensionAnalysisCost'))
    $('#pensionAnalysisCost').textContent = won(row.cost); if ($('#pensionAnalysisProfit')) {
    $('#pensionAnalysisProfit').textContent = signed(profit);
    $('#pensionAnalysisProfit').className = profit < 0 ? 'negative' : 'positive';
} if ($('#pensionAnalysisRate')) {
    $('#pensionAnalysisRate').textContent = pct(rate);
    $('#pensionAnalysisRate').className = rate < 0 ? 'negative' : 'positive';
} }
function bindPensionAssetAnalysis() { $$('[data-pension-analysis-mode]').forEach(b => b.onclick = () => { pensionAnalysisMode = (b.dataset.pensionAnalysisMode || ''); pensionAnalysisSelectedKey = ''; renderPensionAssetAnalysis(); }); $$('[data-pension-analysis-period]').forEach(b => b.onclick = () => { pensionAnalysisPeriod = ['3m', '6m', '1y', '3y', '5y', 'all'].includes((b.dataset.pensionAnalysisPeriod || '')) ? (b.dataset.pensionAnalysisPeriod || '') : '1y'; pensionAnalysisSelectedKey = ''; renderPensionAssetAnalysis(); }); $('[data-pension-analysis-period-select]')?.addEventListener('change', (e) => { pensionAnalysisPeriod = ['3m', '6m', '1y', '3y', '5y', 'all'].includes(e.currentTarget.value) ? e.currentTarget.value : '1y'; pensionAnalysisSelectedKey = ''; renderPensionAssetAnalysis(); }); bindAnalysisGesture('#sheetBody #pensionAnalysisChart', 'pension', updatePensionAnalysisPoint); }
function renderPensionAssetAnalysis() { const body = $('#sheetBody'); if (!body)
    return; body.innerHTML = pensionAnalysisSheetMarkup(); bindPensionAssetAnalysis(); }
function openPensionAssetAnalysis() { pensionAnalysisScope = pensionAssetScope(); pensionAnalysisMode = 'trend'; pensionAnalysisPeriod = '1y'; pensionAnalysisSelectedKey = ''; $('#sheetEyebrow').textContent = '개인연금'; $('#sheetTitle').textContent = `${pensionAssetScopeLabel(pensionAssetScope())} 자산 분석`; $('#sheetBody').innerHTML = pensionAnalysisSheetMarkup(); openSheet('#detailSheet'); bindPensionAssetAnalysis(); }
;
/* asset-os source: integrated-pages.js */
"use strict";
'use strict';
let integratedFixedCostsExpanded = false;
function integratedSelectedMonth() {
    const today = localYmd(), settings = setting();
    if (settings.integratedMonthViewedOn !== today) {
        settings.integratedMonth = today.slice(0, 7);
        settings.integratedMonthViewedOn = today;
    }
    const preferred = String(settings.integratedMonth || '');
    return /^\d{4}-\d{2}$/.test(preferred) ? preferred : today.slice(0, 7);
}
function integratedMonthLabel(month = integratedSelectedMonth()) { const [y, m] = String(month).split('-'); return `${y}년 ${Number(m)}월`; }
async function integratedShiftMonth(delta) { const [y, m] = integratedSelectedMonth().split('-').map(Number), d = new Date(y, m - 1 + Number(delta), 1); setting().integratedMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; rememberViewPreferences(); render(); }
function integratedMonthBar(spending = false) {
    const month = integratedSelectedMonth(), current = localYmd().slice(0, 7), mode = spending ? String(setting().spendingPeriod || 'month') : 'month', unit = { quarter: '분기', half: '반기', year: '연도', years: '연도' }[mode] || '달', periodPicker = spending && unit !== '달', isCurrent = spending ? spendingRangeKey(month, mode) === spendingRangeKey(current, mode) : month === current, returnLabel = mode === 'quarter' ? '이번 분기로' : mode === 'half' ? '이번 반기로' : ['year', 'years'].includes(mode) ? '올해로' : '이번 달로';
    const selector = periodPicker ? `<button type="button" class="spending-period-label" data-spending-period-picker aria-label="조회 기간 선택: ${escapeHtml(spendingRangeLabel(spendingRangeKey(month, mode)))}">${escapeHtml(spendingRangeLabel(spendingRangeKey(month, mode)))}<span aria-hidden="true">⌄</span></button>` : `<input type="month" aria-label="조회 연월" data-integrated-month-select value="${escapeHtml(month)}" style="min-width:0;max-width:180px;border:0;background:transparent;color:inherit;font:inherit">`;
    return `<div class="integrated-monthbar"><button type="button" data-integrated-month-shift="-1" aria-label="이전 ${escapeHtml(unit)}">‹</button>${selector}<button type="button" data-integrated-month-shift="1" aria-label="다음 ${escapeHtml(unit)}">›</button></div><div class="integrated-view-tools ${spending ? 'spending-period-tools' : ''}">${spending ? spendingPeriodControls() : ''}<button type="button" data-integrated-current-month ${isCurrent ? 'disabled' : ''}>${isCurrent ? '현재 기간 조회 중' : escapeHtml(returnLabel)}</button>${spending ? '' : '<button type="button" data-card-hub>카드·할부 <span aria-hidden="true">›</span></button>'}</div>`;
}
function integratedTabs(tab) { return `<div class="integrated-tabs four"><button class="${escapeHtml(tab === 'summary' ? 'active' : '')}" data-integrated-tab="summary">전체</button><button class="${escapeHtml(tab === 'ledger' ? 'active' : '')}" data-integrated-tab="ledger">거래</button><button class="${escapeHtml(tab === 'spending' ? 'active' : '')}" data-integrated-tab="spending">소비</button><button class="${escapeHtml(tab === 'schedule' ? 'active' : '')}" data-integrated-tab="schedule">일정</button></div>`; }
function integratedAccountName(id) { return integratedStore().accounts.find(a => a.id === id)?.name || integratedStore().liabilities.find(x => x.id === id)?.name || id || '-'; }
function integratedTxLabel(t) { if (t.meta?.cardPlanId) {
    if (t.meta.cardInterestRefund)
        return '카드 이자 환불';
    if (t.type === 'externalExpense')
        return '카드 구매';
    if (t.meta.cardCredit === 'discount')
        return '카드 청구할인';
    if (t.type === 'refund')
        return '카드 환불';
    if (t.meta.cardPoints)
        return '카드 포인트 납부';
    if (['debtInterest', 'debtInterestExternal'].includes(t.type || ''))
        return '카드 이자 납부';
    if (['debtPrincipal', 'externalDebtPrincipal'].includes(t.type || ''))
        return '카드 원금 납부';
} return { refund: '환불', openingAsset: '기초자산', openingLiability: '기초부채', externalIncome: '수입', externalAssetIn: '저축·투자', externalAssetOut: '상품 출금', expense: '생활지출', externalExpense: '외부 결제 과거지출', debtInterest: '대출 이자 납부', debtInterestExternal: '대출 이자 납부', debtPrincipal: '대출 원금 상환', externalDebtPrincipal: '대출 원금 상환', internalTransfer: '저축·투자', externalWithdrawal: '기타 지출', adjustment: '잔액보정' }[t.type || ''] || t.type; }
function integratedTxFilterKey(t) { const account = integratedStore().accounts.find(a => a.id === t.toAccountId); if (t.type === 'externalIncome')
    return 'income'; if (['refund', 'expense', 'externalExpense', 'externalWithdrawal', 'externalAssetOut'].includes(t.type || ''))
    return 'expense'; if (['internalTransfer', 'externalAssetIn'].includes(t.type || '') && ['isa', 'pension', 'irp', 'deposit', 'savings'].includes(account?.kind || ''))
    return 'saving'; if (['debtInterest', 'debtInterestExternal', 'debtPrincipal', 'externalDebtPrincipal'].includes(t.type || ''))
    return 'debt'; return 'system'; }
function integratedTxAmountMarkup(t) { if (t.type === 'refund')
    return `<span class="integrated-ledger-amount plus">+${won(Math.abs(Number(t.amount) || 0))}</span>`; if (['internalTransfer', 'externalAssetIn'].includes(t.type || ''))
    return `<span class="integrated-ledger-amount move">${t.type === 'externalAssetIn' ? '+' : ''}${won(t.amount)}</span>`; if (['refund', 'externalIncome', 'openingAsset'].includes(t.type || ''))
    return `<span class="integrated-ledger-amount plus">+${won(t.amount)}</span>`; if (t.type === 'openingLiability')
    return `<span class="integrated-ledger-amount">${won(t.amount)}</span>`; if (t.type === 'adjustment')
    return `<span class="integrated-ledger-amount ${Number(t.delta) >= 0 ? 'plus' : 'minus'}">${Number(t.delta) >= 0 ? '+' : '-'}${won(Math.abs(Number(t.delta) || 0))}</span>`; return `<span class="integrated-ledger-amount minus">-${won(t.amount)}</span>`; }
function integratedTxAccountsText(t) { if (t.meta?.cardPoints)
    return '카드 포인트 사용'; if (t.meta?.cardCredit && t.type !== 'refund')
    return '카드 원금 차감'; if (t.type === 'internalTransfer')
    return `${integratedAccountName(t.fromAccountId)} → ${integratedAccountName(t.toAccountId)}`; if (t.type === 'externalAssetIn')
    return `앱 밖 계좌 → ${integratedAccountName(t.toAccountId)}`; if (t.type === 'externalAssetOut')
    return `${integratedAccountName(t.fromAccountId)} → 앱 밖 계좌`; if (t.type === 'externalDebtPrincipal' || t.type === 'debtInterestExternal')
    return `앱 밖 계좌 → ${integratedAccountName(t.liabilityId)}`; if (t.toAccountId)
    return integratedAccountName(t.toAccountId); if (t.fromAccountId)
    return integratedAccountName(t.fromAccountId); if (t.accountId)
    return integratedAccountName(t.accountId); if (t.liabilityId)
    return integratedAccountName(t.liabilityId); return ''; }
function integratedRowsForMonth(month = integratedSelectedMonth()) { return integratedLedger().filter(t => integratedMonthKey(t.date) === month); }
function transactionSearchKey(parts) { return parts.map(v => String(v ?? '')).join(' ').normalize('NFKC').toLowerCase().replace(/[,\s./-]/g, ''); }
function integratedCardIdentity(id) {
    const schedule = financeSchedules().find(x => x.id === id), purchase = integratedStore().ledger.find(x => x.meta?.cardPlanId === id && x.meta?.cardPurchase);
    return purchase ? spendingClassification(purchase) : spendingClassification({ category: String(schedule?.cardPlan?.category || '미분류'), meta: { spendingItem: String(schedule?.name || '카드 구매') } });
}
function integratedScheduleName(schedule) { return schedule.cardPlan ? integratedCardIdentity(String(schedule.id)).item : String(schedule.name || '금융 일정'); }
function integratedTransactionDisplay(t) {
    const original = t.type === 'refund' ? integratedLedger().find(x => x.id === t.meta?.refundOf) || t : t;
    if (t.meta?.cardPlanId && t.meta.cardInterestRefund)
        return { category: '카드 이자 환불', item: integratedCardIdentity(String(t.meta.cardPlanId)).item };
    if (['expense', 'externalExpense', 'refund'].includes(t.type || '') && typeof spendingClassification === 'function')
        return spendingClassification(original);
    const label = String(integratedTxLabel(t) || '기타'), schedule = financeSchedules().find(x => x.id === t.meta?.scheduleId), item = t.meta?.cardPlanId ? integratedCardIdentity(String(t.meta.cardPlanId)).item : schedule?.name || t.category || label;
    return { category: label, item: String(item) };
}
function integratedTransactionSubtitle(t) {
    const display = integratedTransactionDisplay(t);
    return [display.category, integratedTxLabel(t), integratedTxAccountsText(t)].filter((x, i, list) => !!x && list.indexOf(x) === i).join(' · ');
}
function integratedTransactionSearchText(t) { const display = integratedTransactionDisplay(t); return transactionSearchKey([t.date, t.category, t.note, integratedTxLabel(t), integratedTxAccountsText(t), t.amount, t.delta, display.item, display.category]); }
function integratedLedgerPage() {
    const month = integratedSelectedMonth(), filter = setting().integratedLedgerFilter || 'all', query = String(integratedLedgerSearch || '').trim(), needle = transactionSearchKey([query]), searching = !!needle, systemTypes = new Set(['openingAsset', 'openingLiability', 'adjustment']), source = (searching ? integratedLedger() : integratedRowsForMonth(month)).filter(t => !systemTypes.has(t.type || '')), candidates = [...source].sort((a, b) => String(b.date).localeCompare(String(a.date))).filter(t => (filter === 'all' || integratedTxFilterKey(t) === filter) && (!searching || integratedTransactionSearchText(t).includes(needle))), categories = [...new Set(candidates.map(t => integratedTransactionDisplay(t).category))];
    let category = String(setting().integratedLedgerCategory || '');
    if (category && !categories.includes(category)) {
        category = '';
        setting().integratedLedgerCategory = '';
    }
    const matched = candidates.filter(t => !category || integratedTransactionDisplay(t).category === category), rows = matched.slice(0, integratedSearchDisplayLimit), filters = [['all', '전체'], ['income', '수입'], ['expense', '생활지출'], ['saving', '저축·투자'], ['debt', '대출']], title = searching ? '전체 기간 검색' : `${integratedMonthLabel(month)} 거래`, count = matched.length > rows.length ? `${rows.length}/${matched.length}건` : `${rows.length}건`, groups = new Map();
    for (const row of rows) {
        const key = integratedTransactionDisplay(row).category;
        groups.set(key, [...(groups.get(key) || []), row]);
    }
    return `<section class="card integrated-ledger-card"><div class="integrated-ledger-top"><div><h2>${escapeHtml(title)}</h2><span>${count}</span></div><button class="integrated-add-small" data-integrated-new>＋ 거래</button></div><form class="transaction-search" data-integrated-search-form><input name="query" type="search" inputmode="search" autocomplete="off" value="${escapeHtml(query)}" placeholder="전체 기간 날짜·금액·분류·메모 검색" aria-label="통합 거래 검색"><button type="submit">검색</button>${searching ? '<button type="button" class="clear" data-integrated-search-clear>지우기</button>' : ''}</form>${searching ? '<div class="transaction-search-note">검색 중에는 선택한 달과 관계없이 전체 기간에서 찾습니다.</div>' : ''}<div class="ledger-filter-strip"><div class="integrated-filters">${filters.map(([k, l]) => `<button class="integrated-filter ${filter === k ? 'active' : ''}" data-integrated-filter="${escapeHtml(k)}">${l}</button>`).join('')}</div><div class="cardv2-filters ledger-category-filters" aria-label="거래 카테고리"><button data-integrated-category="" class="${escapeHtml(!category ? 'active' : '')}">모든 분류</button>${categories.map(key => `<button data-integrated-category="${escapeHtml(key)}" class="${escapeHtml(category === key ? 'active' : '')}">${escapeHtml(key)}</button>`).join('')}</div></div><div class="ledger-active-filters">${escapeHtml((filters.find(([k]) => k === filter)?.[1] || '전체') + ' · ' + (category || '모든 분류'))} · ${matched.length}건${filter !== 'all' || category ? '<button data-integrated-filter-reset>필터 초기화</button>' : ''}</div><div class="integrated-ledger-list">${rows.length ? [...groups].map(([key, list]) => `<section class="ledger-category-group"><h3>${escapeHtml(key)} <small>${list.length}건</small></h3>${list.map(t => `<button class="integrated-ledger-row is-clickable" data-integrated-tx="${escapeHtml(t.id)}" style="width:100%;border:0;background:transparent;text-align:left;color:inherit"><div><strong>${escapeHtml(integratedTransactionDisplay(t).item)}${t.readonly ? '<span class="integrated-readonly">자동 연결</span>' : ''}</strong><small>${escapeHtml(t.date)} · ${escapeHtml(integratedTransactionSubtitle(t))}</small></div><div class="integrated-ledger-right">${integratedTxAmountMarkup(t)}<span class="integrated-chevron">›</span></div></button>`).join('')}</section>`).join('') : `<div class="integrated-empty">${searching ? '검색 결과가 없습니다.' : '이 달의 거래가 없습니다.'}</div>`}</div>${matched.length > rows.length ? `<button class="diagnostic-action" data-integrated-search-more>다음 ${Math.min(50, matched.length - rows.length)}건 보기 · 남은 ${matched.length - rows.length}건</button>` : ''}</section>`;
}
function integratedScheduleMonth() { return integratedSelectedMonth(); }
function scheduleKindLabel(kind) { return { income: '수입', investment: '저축·투자', saving: '저축·투자', loan: '대출 납부', insurance: '보험료', expense: '고정지출' }[kind] || '금융 일정'; }
function scheduleActionLabel(kind) { return kind === 'income' ? '수입 확인' : (['investment', 'saving'].includes(kind) ? '납입' : (['loan', 'insurance', 'expense'].includes(kind) ? '납부' : '완료')); }
function scheduleOccurrenceDisplayAmount(o) { const actual = Number(o?.tx?.meta?.actualAmount ?? o?.tx?.amount); return o?.status === 'done' && Number.isFinite(actual) && actual >= 0 ? actual : schedulePlannedAmount(o.schedule, o.date); }
function scheduleOccurrenceUiLabel(o) { return o.status === 'done' && Math.abs(scheduleOccurrenceDisplayAmount(o) - schedulePlannedAmount(o.schedule, o.date)) > .5 ? '금액 다름' : scheduleStatusLabel(o.status); }
function remainingScheduleCard(month = integratedSelectedMonth()) { const list = scheduleOccurrences(month).filter(o => o.status !== 'done' && o.schedule.kind !== 'income'), total = list.reduce((sum, o) => sum + scheduleOccurrenceDisplayAmount(o), 0); return `<section class="card integrated-fixed-cost-card ${integratedFixedCostsExpanded ? 'open' : ''}" data-fixed-cost-card><button class="fixed-cost-head" data-fixed-cost-toggle aria-expanded="${escapeHtml(integratedFixedCostsExpanded ? 'true' : 'false')}"><span><strong>${escapeHtml(integratedMonthLabel(month))} 남은 일정</strong><small>${list.length ? `${list.length}건 · 납입·대출·보험·고정비 합계` : '선택한 달의 미완료 일정 없음'}</small></span><span class="fixed-cost-head-right"><b>${won(total)}</b><i>⌄</i></span></button><div class="fixed-cost-body" data-fixed-cost-body ${integratedFixedCostsExpanded ? '' : 'hidden'}>${list.length ? `<div class="schedule-list compact">${list.map(o => `<button class="schedule-row" data-fixed-cost-item="${escapeHtml(o.schedule.id)}" data-fixed-cost-date="${escapeHtml(o.date)}"><span class="schedule-copy"><strong>${escapeHtml(integratedScheduleName(o.schedule))}</strong><small>${escapeHtml(o.date)} · ${escapeHtml(o.schedule.cardPlan ? '카드' : scheduleKindLabel(o.schedule.kind))}</small></span><strong class="schedule-amount">${won(scheduleOccurrenceDisplayAmount(o))}</strong><span class="schedule-status ${o.status}">${scheduleStatusLabel(o.status)}</span></button>`).join('')}</div>` : '<div class="integrated-empty">선택한 달의 금융 일정은 모두 처리했습니다.</div>'}</div></section>`; }
function integratedSchedulePage() { const month = integratedScheduleMonth(), occ = scheduleOccurrences(month), { y, m, days } = scheduleMonthDays(month), first = new Date(y, m - 1, 1).getDay(), today = localYmd(), byDay = new Map(); for (const o of occ) {
    const d = Number(o.date.slice(-2));
    if (!byDay.has(d))
        byDay.set(d, []);
    byDay.get(d).push(o);
} const cells = []; for (let i = 0; i < first; i++)
    cells.push('<span class="schedule-day empty"></span>'); for (let d = 1; d <= days; d++) {
    const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, list = byDay.get(d) || [];
    cells.push(list.length ? `<button class="schedule-day ${date === today ? 'today' : ''} has-events" data-schedule-day="${escapeHtml(date)}"><span class="daynum">${d}</span><span class="daydots">${list.slice(0, 4).map(o => `<i class="${escapeHtml(o.status)}"></i>`).join('')}</span></button>` : `<span class="schedule-day ${date === today ? 'today' : ''}"><span class="daynum">${d}</span><span class="daydots"></span></span>`);
} const undated = financeSchedules().filter(x => x.active && x.needsDate); return `<section class="card schedule-card"><div class="schedule-head"><div><h2>금융 일정</h2><small>예정 → 확인 → 완료 기록까지 한 곳에서 관리합니다.</small></div><span class="count-pill">${occ.length}건</span></div><div class="schedule-monthbar"><button data-integrated-month-shift="-1">‹</button><strong>${escapeHtml(integratedMonthLabel(month))}</strong><button data-integrated-month-shift="1">›</button></div><div class="schedule-week">${['일', '월', '화', '수', '목', '금', '토'].map(x => `<span>${x}</span>`).join('')}</div><div class="schedule-grid">${cells.join('')}</div><div class="schedule-list">${occ.map(o => `<button class="schedule-row" data-schedule-day="${escapeHtml(o.date)}"><span class="schedule-copy"><strong>${escapeHtml(integratedScheduleName(o.schedule))}</strong><small>${escapeHtml(o.date)} · ${escapeHtml(o.schedule.note || '')}</small></span><strong class="schedule-amount">${won(scheduleOccurrenceDisplayAmount(o))}</strong><span class="schedule-status ${o.status}">${scheduleStatusLabel(o.status)}</span></button>`).join('') || '<div class="integrated-empty">이 달의 금융 일정이 없습니다.</div>'}</div></section>${undated.length ? `<section class="card schedule-card"><div class="sectionhead"><h2>납부일 확인 필요</h2><span>${undated.length}건</span></div><div class="schedule-pending-info">${undated.map(x => `<strong>${escapeHtml(x.name)}${x.attention === 'overdue' ? ' · 연체 확인 필요' : ''}</strong> · ${won(x.amount)} · ${escapeHtml(x.note)}<br>`).join('')}<br>날짜를 임의로 만들지 않았습니다. 실제 납부일을 확인하면 캘린더에 연결합니다.</div></section>` : ''}`; }
async function openScheduleDay(date, scheduleId = '') { if (date === '날짜 미설정') {
    setting().integratedMonth = localYmd().slice(0, 7);
    rememberViewPreferences();
    nav('integrated', 'schedule');
    return;
} const list = scheduleOccurrences(String(date).slice(0, 7)).filter(o => o.date === date && (!scheduleId || o.schedule.id === scheduleId)); $('#sheetEyebrow').textContent = '통합 · 금융 일정'; $('#sheetTitle').textContent = formatDate(date); $('#sheetBody').innerHTML = `<div class="schedule-detail-list">${list.map(o => { const pk = schedulePensionKind(o.schedule), eligible = pk ? pensionAccountsForKind(pk, date) : [], resolved = pk ? resolveSchedulePensionAccount(o.schedule, '', date) : '', isIsa = o.schedule.targetKind === 'isa' || integratedStore().accounts.find(a => a.id === scheduleTargetAccount(o.schedule))?.kind === 'isa', isaEligible = isIsa ? isaAccountsForDate(date) : [], isaResolved = isIsa ? resolveScheduleIsaAccount(o.schedule, '', date) : '', selector = pk && eligible.length > 1 ? `<div class="schedule-account-target"><label>실제 납입 계좌</label><select data-schedule-pension-account="${escapeHtml(o.schedule.id)}"><option value="">계좌 선택</option>${eligible.map(a => `<option value="${escapeHtml(a.id)}" ${a.id === resolved ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}</select></div>` : pk && eligible.length === 1 ? `<div class="schedule-account-target"><label>납입 계좌</label><strong>${escapeHtml(eligible[0].name)}</strong></div>` : pk ? '<div class="warningbox" style="margin-top:9px">운영 중인 납입 대상 계좌가 없습니다. 개인연금 → 자산 → 계좌 관리에서 계좌를 먼저 준비해 주세요.</div>' : isIsa && isaEligible.length > 1 ? `<div class="schedule-account-target"><label>실제 ISA 납입 계좌</label><select data-schedule-isa-account="${escapeHtml(o.schedule.id)}"><option value="">ISA 선택</option>${isaEligible.map(a => `<option value="${escapeHtml(a.id)}" ${a.id === isaResolved ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}</select></div>` : isIsa && isaEligible.length === 1 ? `<div class="schedule-account-target"><label>납입 계좌</label><strong>${escapeHtml(isaEligible[0].name)}</strong></div>` : isIsa ? '<div class="warningbox" style="margin-top:9px">운영 중인 ISA가 없습니다.</div>' : '', simpleNote = /^매월\s*\d{1,2}일$/.test(String(o.schedule.note || '').trim()), note = simpleNote ? '' : String(o.schedule.note || '').trim(); return `<div class="schedule-detail-item compact"><div class="top"><div><strong>${escapeHtml(integratedScheduleName(o.schedule))}</strong>${note ? `<small>${escapeHtml(note)}</small>` : ''}</div><span class="schedule-status ${o.status}">${scheduleStatusLabel(o.status)}</span></div><div class="schedule-primary-amount"><span>${o.status === 'done' ? '실제 금액' : o.schedule.kind !== 'loan' && o.schedule.amountMode === 'estimate' ? '예상 금액' : '금액'}</span><strong>${won(scheduleOccurrenceDisplayAmount(o))}</strong></div>${selector}${scheduleLoanInputsMarkup(o)}${o.status === 'done' ? `<button class="schedule-complete" data-schedule-record="${escapeHtml(o.tx?.id)}">연결된 기록 보기</button>${o.tx?.meta?.scheduleId === o.schedule.id ? `<button class="diagnostic-action" data-schedule-actual-edit="${escapeHtml(o.schedule.id)}" data-date="${escapeHtml(date)}">실제 납부 수정</button>` : ''}` : `${o.schedule.kind !== 'loan' && o.schedule.amountMode === 'estimate' ? `<div class="field" style="margin-top:10px"><label>실제 금액</label><input data-schedule-amount="${escapeHtml(o.schedule.id)}" type="number" inputmode="numeric" min="1" step="1" value="${escapeHtml(schedulePlannedAmount(o.schedule, date))}"></div>` : ''}<button class="schedule-complete" data-schedule-complete="${escapeHtml(o.schedule.id)}" data-schedule-date="${escapeHtml(date)}" ${(pk && !eligible.length) || (isIsa && !isaEligible.length) ? 'disabled' : ''}>${escapeHtml(scheduleActionLabel(o.schedule.kind))} 완료로 기록</button>`}<button class="diagnostic-action" data-schedule-plan-edit="${escapeHtml(o.schedule.id)}" data-date="${escapeHtml(date)}">예정금액 수정</button></div>`; }).join('') || '<div class="integrated-empty">등록된 일정이 없습니다.</div>'}</div>`; openSheet('#detailSheet'); bindScheduleTools(); $$('[data-schedule-complete]').forEach(b => b.onclick = async () => { const input = findDataElement(document, "data-schedule-amount", b.dataset.scheduleComplete), account = findDataElement(document, "data-schedule-pension-account", b.dataset.scheduleComplete), isaAccount = findDataElement(document, "data-schedule-isa-account", b.dataset.scheduleComplete), principal = findDataElement(document, "data-schedule-loan-principal", b.dataset.scheduleComplete), interest = findDataElement(document, "data-schedule-loan-interest", b.dataset.scheduleComplete), amount = input ? Number(input.value) || 0 : 0; (await completeScheduleOccurrence(b.dataset.scheduleComplete, b.dataset.scheduleDate, amount, account?.value || '', isaAccount?.value || '', Number(principal?.value) || 0, Number(interest?.value) || 0)); }); }
function scheduleLoanInputsMarkup(o) { const s = o?.schedule; if (!s || s.kind !== 'loan' || o.status === 'done')
    return ''; return `<div class="form-grid" style="margin-top:10px"><div class="field"><label>실제 원금</label><input data-schedule-loan-principal="${escapeHtml(s.id)}" type="number" inputmode="numeric" min="0" step="1" value="0"></div><div class="field"><label>실제 이자</label><input data-schedule-loan-interest="${escapeHtml(s.id)}" type="number" inputmode="numeric" min="0" step="1" value="0"></div></div><div class="source-note">예정금액을 원금과 이자로 자동 추측하지 않습니다. 실제 납부내역대로 입력해 주세요.</div>`; }
function integratedSummaryPage() {
    const month = integratedSelectedMonth(), x = integratedSummary(month), f = integratedFinancialModel(), issues = systemIntegrityIssues(), recent = [...integratedRowsForMonth(month)].filter(t => !['openingAsset', 'openingLiability'].includes(t.type || '')).reverse().slice(0, 4), rows = [['현금·입출금', f.cash, 'cash', true], ['예금', f.deposit, 'deposit', true], ['적금', f.savings, 'savings', true], ['ISA', f.isa, 'isa', f.available.isa], ['연금저축', f.pension, 'pension', f.available.pension], ['IRP', f.irp, 'irp', f.available.irp]];
    if (f.other)
        rows.push(['기타자산', f.other, 'other', true]);
    const active = activeFinancialProducts(), ended = financialProducts().filter(p => p.status === 'ended').length, share = (v) => f.totalAssets ? `${(v / f.totalAssets * 100).toFixed(1)}%` : '';
    const assetRows = `<div class="integrated-asset-list">${rows.map(([n, v, k, verified]) => `<button class="integrated-asset-row ${v ? '' : 'is-zero'} ${verified ? '' : 'is-unverified'}" data-integrated-asset="${escapeHtml(k)}"><span>${n}${verified && v ? ` <em class="asset-share">${share(v)}</em>` : !verified && v ? ` <em class="module-unverified">연결현금</em>` : !verified ? ` <em class="module-unverified">실제값 미입력</em>` : ''}</span><strong>${verified || v ? won(v) : '미확인'}</strong><i>›</i></button>`).join('')}${f.totalDebt ? `<button class="integrated-asset-row" data-integrated-asset="debt"><span>대출·부채</span><strong>-${won(f.totalDebt)}</strong><i>›</i></button>` : ''}</div>`;
    const quick = `<section class="household-quick" aria-label="가계부 빠른 기록"><button data-household-expense class="integrated-record-primary"><b>＋ 기록 입력</b></button><div class="integrated-record-tools"><button data-cash-reconcile>잔액 맞추기</button></div></section>`;
    return `<section class="integrated-overview-hero inline-accordion ${integratedAssetsExpanded ? 'open' : ''}" data-integrated-assets-card><button class="integrated-overview-head" data-integrated-assets-toggle aria-expanded="${escapeHtml(integratedAssetsExpanded ? 'true' : 'false')}"><span><small class="integrated-overview-label">${f.isComplete ? '순자산' : '확인된 금융자산'}</small><strong class="integrated-overview-value ${amountClass(f.isComplete ? f.netAssets : f.totalAssets)}" title="${escapeHtml(won(f.isComplete ? f.netAssets : f.totalAssets))}">${displayWon(f.isComplete ? f.netAssets : f.totalAssets)}</strong></span><b class="integrated-overview-arrow inline-accordion-arrow">⌄</b></button><div class="integrated-overview-sub"><span>${f.isComplete ? '총자산' : '확인된 자산'} <strong class="${escapeHtml(amountClass(f.totalAssets))}" title="${escapeHtml(won(f.totalAssets))}">${displayWon(f.totalAssets)}</strong></span><span>${f.isComplete ? '총부채' : '확인된 부채'} <strong class="${escapeHtml(amountClass(f.totalDebt))}" title="${escapeHtml(won(f.totalDebt))}">${displayWon(f.totalDebt)}</strong></span></div><div class="integrated-overview-assets inline-accordion-body" data-integrated-assets-body ${integratedAssetsExpanded ? '' : 'hidden'}>${assetRows}</div></section><div class="inline-detail-guard" data-integrated-assets-guard></div>${issues.length ? `<div class="warningbox" data-integrated-integrity-warning><strong>금액 확인 필요 ${issues.length}건</strong><br>${issues.slice(0, 3).map(escapeHtml).join('<br>')}${issues.length > 3 ? `<br>외 ${issues.length - 3}건` : ''}</div>` : ''}${!f.isComplete ? '<div class="source-note" style="margin-top:10px">입력된 계좌만 합산했습니다. 금액이 없는 계좌는 제외됩니다.</div>' : ''}${quick}${remainingScheduleCard(month)}<button class="integrated-month-mini" data-integrated-month-detail="${escapeHtml(month)}"><div class="integrated-month-mini-head"><div><strong>${escapeHtml(integratedMonthLabel(month))} 요약</strong><small>선택하면 수입·지출·저축 흐름을 자세히 봅니다.</small></div><span>›</span></div><div class="integrated-month-mini-grid"><div class="integrated-month-mini-item in"><span>수입</span><strong>${won(x.income)}</strong></div><div class="integrated-month-mini-item out"><span>생활지출</span><strong>${won(x.fixed + x.variable)}</strong></div><div class="integrated-month-mini-item move"><span>저축·투자</span><strong>${won(x.invest)}</strong></div><div class="integrated-month-mini-item left"><span>남은 현금</span><strong>${signed(x.operatingCashDelta)}</strong></div></div></button><section class="card integrated-recent"><div class="sectionhead"><h2>최근 거래</h2><button class="tinybtn" data-integrated-tab-go="ledger">전체 보기</button></div><div class="integrated-ledger-list">${recent.length ? recent.map(t => `<button class="integrated-ledger-row is-clickable" data-integrated-tx="${escapeHtml(t.id)}" style="width:100%;border:0;background:transparent;text-align:left;color:inherit"><div><strong>${escapeHtml(integratedTransactionDisplay(t).item)}${t.readonly ? '<span class="integrated-readonly">자동</span>' : ''}</strong><small>${escapeHtml(t.date)} · ${escapeHtml(integratedTransactionSubtitle(t))}</small></div><div class="integrated-ledger-right">${integratedTxAmountMarkup(t)}<span class="integrated-chevron">›</span></div></button>`).join('') : '<div class="integrated-empty">아직 거래가 없습니다.</div>'}</div></section>`;
}
function openIntegratedMonthDetail(month = integratedSelectedMonth()) { const x = integratedSummary(month), rows = integratedRowsForMonth(month), accountMap = new Map(integratedStore().accounts.map(a => [a.id, a])), group = (title, arr) => `<div class="integrated-month-detail-group"><strong>${title}</strong>${arr.length ? arr.map(([n, v]) => `<div class="integrated-month-detail-row"><span>${escapeHtml(n)}</span><strong>${won(v)}</strong></div>`).join('') : '<div class="integrated-month-detail-row"><span>기록 없음</span><strong>0원</strong></div>'}</div>`, by = (fn) => { const m = {}; for (const t of rows.filter(fn)) {
    const display = integratedTransactionDisplay(t), k = ['expense', 'externalExpense', 'refund'].includes(t.type || '') ? display.category : display.item;
    m[k] = (m[k] || 0) + (t.type === 'refund' ? -1 : 1) * (Number(t.amount) || 0);
} return Object.entries(m); }, income = by(t => t.type === 'externalIncome'), spend = by(t => ['expense', 'externalExpense', 'refund', 'debtInterest', 'debtInterestExternal'].includes(t.type || '')), saving = by(t => (t.type === 'internalTransfer' && ['isa', 'pension', 'irp', 'deposit', 'savings'].includes(accountMap.get(t.toAccountId)?.kind || '')) || (t.type === 'externalAssetIn' && ['isa', 'pension', 'irp', 'deposit', 'savings'].includes(accountMap.get(t.toAccountId)?.kind || ''))), principal = by(t => ['debtPrincipal', 'externalDebtPrincipal'].includes(t.type || '')), otherOut = by(t => t.type === 'externalWithdrawal'); $('#sheetEyebrow').textContent = '통합 · 월 요약'; $('#sheetTitle').textContent = `${integratedMonthLabel(month)} 상세`; $('#sheetBody').innerHTML = `${group('수입', income)}${group('생활지출', spend)}${group('저축·투자', saving)}${principal.length ? group('대출·카드 원금 상환', principal) : ''}${otherOut.length ? group('기타 출금', otherOut) : ''}<div class="integrated-month-cash"><span>현금 증감</span><strong>${signed(x.operatingCashDelta)}</strong></div><div class="source-note">앱 밖 계좌에서 바로 납입한 금액은 월 흐름에는 포함하지만, 추적 중인 현금 잔액에서는 빼지 않습니다.</div>`; openSheet('#detailSheet'); }
function integratedProductReadOnlyRows(type) { const items = activeFinancialProducts(type); if (!items.length)
    return '<div class="integrated-empty">현재 등록된 상품이 없습니다.</div>'; return `<div class="sheetrows">${items.map(p => { const bal = financeProductBalance(p), rate = Number(p.annualRate) || 0, maturity = p.maturityDate ? formatDate(p.maturityDate) : '만기 없음', status = p.contributionStatus === 'paused' ? '납입 중단' : p.contributionStatus === 'free' ? '자유납입' : '진행'; return `<div class="sheetrow"><span><b style="display:block;color:var(--text);font-size:10px">${escapeHtml(p.name)}</b><small style="display:block;margin-top:3px">${escapeHtml(p.institution || '')} · ${rate ? `연 ${pct(rate)}` : '금리 미입력'} · ${escapeHtml(maturity)} · ${escapeHtml(status)}</small></span><strong>${won(bal)}</strong></div>`; }).join('')}</div>`; }
function integratedCashReadOnly() { const r = integratedReplay(), base = Math.max(0, Number(r.assets['cash-main'] || 0)), parking = activeFinancialProducts('parking'); return `<div class="sheetrows"><div class="sheetrow total"><span>현금·입출금</span><strong>${won(base)}</strong></div>${parking.map(p => `<div class="sheetrow"><span>${escapeHtml(p.name)}</span><strong>${won(financeProductBalance(p))}</strong></div>`).join('')}</div><div class="source-note">이 화면은 조회 전용입니다. 상품 설정은 프로필 → 제도·상품 관리에서만 변경합니다.</div>`; }
function integratedDebtReadOnly() { const items = activeFinancialProducts('loan'); if (!items.length)
    return '<div class="integrated-empty">현재 등록된 대출이 없습니다.</div>'; return `<div class="sheetrows">${items.map(p => `<div class="sheetrow"><span><b style="display:block;color:var(--text);font-size:10px">${escapeHtml(p.name)}</b><small style="display:block;margin-top:3px">${Number(p.annualRate) ? `연 ${pct(Number(p.annualRate))}` : '금리 미입력'} · ${p.maturityDate ? formatDate(p.maturityDate) : '만기 미입력'}</small></span><strong>${won(financeProductBalance(p))}</strong></div>`).join('')}</div><div class="source-note">대출 조건 수정·완납 처리는 프로필 → 제도·상품 관리에서만 합니다.</div>`; }
function integratedLinkedAssetReadOnly(kind) { const title = kind === 'isa' ? 'ISA' : kind === 'irp' ? 'IRP' : '연금저축', f = integratedFinancialModel(), known = Math.max(0, Number(f[kind] || 0)), available = !!f.available?.[kind]; if (!available) {
    return { title, body: `${known > 0 ? `<div class="sheetrows"><div class="sheetrow total"><span>통합에서 확인된 계좌 현금</span><strong>${won(known)}</strong></div></div>` : `<div class="integrated-empty"><strong>현재값을 아직 입력하지 않았습니다.</strong></div>`}<div class="source-note">값이 없는 계좌는 합계에서 제외합니다. ${known > 0 ? '현재 합계에는 통합 원장의 납입 현금만 포함합니다.' : '보유종목·평가액을 입력하면 자동으로 합산합니다.'}</div><button class="diagnostic-action" data-integrated-module-go="${escapeHtml(kind)}">${title} 화면 보기</button>` };
} const source = f.currentSources?.[kind], sourceLabel = source === 'kis' ? '한국투자 조회 합계' : source === 'asset-os' ? 'Asset OS 계산 합계' : '통합 원장 합계'; return { title, body: `<div class="sheetrows"><div class="sheetrow"><span>${sourceLabel}</span><strong>${won(known)}</strong></div></div><button class="diagnostic-action" data-integrated-module-go="${escapeHtml(kind)}">${title}에서 자세히 보기</button>` }; }
function openIntegratedAsset(kind) { $('#sheetEyebrow').textContent = '통합 · 조회'; let title = '', body = ''; if (kind === 'cash') {
    title = '현금·입출금';
    body = integratedCashReadOnly();
}
else if (kind === 'deposit') {
    title = '예금';
    body = integratedProductReadOnlyRows('deposit') + '<div class="source-note">상품 설정은 프로필 → 제도·상품 관리에서만 변경합니다.</div>';
}
else if (kind === 'savings') {
    title = '적금·청약';
    body = integratedProductReadOnlyRows('savings') + '<div class="source-note">상품 설정은 프로필 → 제도·상품 관리에서만 변경합니다.</div>';
}
else if (kind === 'debt') {
    title = '대출·부채';
    body = integratedDebtReadOnly();
}
else if (['isa', 'pension', 'irp'].includes(kind)) {
    const v = integratedLinkedAssetReadOnly(kind);
    title = v.title;
    body = v.body;
}
else {
    title = '자산 상세';
    body = '<div class="integrated-empty">표시할 상세 정보가 없습니다.</div>';
} $('#sheetTitle').textContent = title; $('#sheetBody').innerHTML = body; openSheet('#detailSheet'); $$('[data-integrated-module-go]').forEach(b => b.onclick = async () => { const target = b.dataset.integratedModuleGo; closeSheets(); if (target === 'isa')
    return nav('isa', 'summary'); setting().pensionAssetScope = target === 'irp' ? 'irp' : 'pension'; rememberViewPreferences(); nav('pension', 'assets'); }); }
function integratedSpendingPage() { const month = integratedSelectedMonth(), analysis = integratedSpendingAnalysis(month), budget = Math.max(0, Number(setting().monthlyLivingBudget) || 0), remaining = budget - analysis.total, max = Math.max(1, ...analysis.trend.map((row) => row.amount)), comparison = analysis.previousTotal === 0 ? (analysis.total ? '지난달 기록 없음' : '지난달과 동일') : analysis.change === 0 ? '지난달과 동일' : `${analysis.change > 0 ? '▲' : '▼'} ${won(Math.abs(analysis.change))} · ${Math.abs(analysis.changeRate || 0).toFixed(1)}%`; return `<section class="spending-hero"><div class="spending-hero-head"><span>${escapeHtml(integratedMonthLabel(month))} 총 소비</span><button data-spending-new>＋ 지출</button></div><strong>${won(analysis.total)}</strong><small class="${escapeHtml(analysis.change > 0 ? 'up' : analysis.change < 0 ? 'down' : '')}">지난달 대비 ${comparison}</small></section><button class="card spending-budget-card" data-spending-budget><span>${budget ? '월 생활비 목표' : '생활비 목표 설정'}</span>${budget ? `<strong>${won(budget)}</strong><small>사용 ${won(analysis.total)} · ${remaining >= 0 ? '남음' : '초과'} ${won(Math.abs(remaining))}</small><i><b style="width:${Math.min(100, analysis.total / Math.max(1, budget) * 100)}%"></b></i>` : '<small>원할 때만 한 번 설정합니다. 카테고리별 예산은 만들지 않습니다.</small>'}</button><section class="card spending-split"><button data-spending-detail="fixed"><span>고정비</span><strong>${won(analysis.fixed)}</strong><small>${analysis.fixedRows.length}건</small></button><button data-spending-detail="variable"><span>변동비</span><strong>${won(analysis.variable)}</strong><small>${analysis.variableRows.length}건</small></button></section><section class="card spending-card"><div class="sectionhead"><h2>카테고리별 소비</h2><span>${analysis.categories.length}개</span></div><div class="spending-categories">${analysis.categories.map((row) => `<button data-spending-detail="category" data-spending-key="${escapeHtml(row.key)}"><span>${escapeHtml(row.key)}<small>${row.count}건</small></span><strong>${won(row.amount)}</strong><i>›</i></button>`).join('') || '<div class="integrated-empty">이 달의 소비 기록이 없습니다.</div>'}</div></section><section class="card spending-card"><div class="sectionhead"><h2>최근 6개월 소비</h2><button class="tinybtn" data-spending-detail="all">원장 보기</button></div><div class="spending-trend">${analysis.trend.map((row) => `<button data-spending-month="${escapeHtml(row.month)}" data-spending-detail="month"><span class="spending-bar"><i style="height:${row.amount ? Math.max(8, row.amount / max * 100) : 2}%"></i></span><strong>${row.label}</strong><small>${row.amount ? displayWon(row.amount) : '0원'}</small></button>`).join('')}</div></section>`; }
function openMonthlyLivingBudgetForm() { $('#formEyebrow').textContent = '통합 · 소비'; $('#formTitle').textContent = '월 생활비 목표'; $('#formBody').innerHTML = `<form id="livingBudgetForm" class="form"><div class="source-note">전체 생활비 목표 하나만 관리합니다. 0원으로 저장하면 목표 표시를 끕니다.</div><div class="field"><label>월 목표금액</label><input name="budget" type="number" inputmode="numeric" min="0" step="10000" value="${escapeHtml(Math.max(0, Number(setting().monthlyLivingBudget) || 0))}" required></div><button class="integrated-form-save" type="submit">저장</button></form>`; openSheet('#formSheet', { mode: 'input' }); $('#livingBudgetForm').onsubmit = async (e) => { e.preventDefault(); setting().monthlyLivingBudget = Math.max(0, Math.round(Number(new FormData(e.currentTarget).get('budget')) || 0)); if (!(await persist()))
    return; sheetDirty = false; closeSheets({ all: true }); nav('integrated', 'spending'); toast(setting().monthlyLivingBudget ? '생활비 목표를 저장했습니다.' : '생활비 목표를 껐습니다.'); }; }
function openIntegratedSpendingDetail(scope = 'all', key = '', month = integratedSelectedMonth()) { const analysis = integratedSpendingAnalysis(month), rows = scope === 'fixed' ? analysis.fixedRows : scope === 'variable' ? analysis.variableRows : scope === 'other' ? analysis.rows.filter(row => new Set(analysis.categories.slice(5).map(x => x.key)).has(String(row.category || '기타').trim() || '기타')) : scope === 'category' ? analysis.rows.filter(row => (String(row.category || '기타').trim() || '기타') === key) : analysis.rows; $('#sheetEyebrow').textContent = '통합 · 소비 분석'; $('#sheetTitle').textContent = scope === 'category' ? key : `${integratedMonthLabel(month)} 소비`; $('#sheetBody').innerHTML = `<div class="integrated-ledger-list">${[...rows].reverse().map(t => `<button class="integrated-ledger-row is-clickable" data-integrated-tx="${escapeHtml(t.id)}" style="width:100%;border:0;background:transparent;text-align:left;color:inherit"><div><strong>${escapeHtml(t.category || integratedTxLabel(t))}</strong><small>${escapeHtml(t.date)} · ${t.type === 'expense' ? (t.fixed ? '고정비' : '변동비') : '고정비'}</small></div><div class="integrated-ledger-right">${integratedTxAmountMarkup(t)}<span class="integrated-chevron">›</span></div></button>`).join('') || '<div class="integrated-empty">해당 소비 기록이 없습니다.</div>'}</div>`; openSheet('#detailSheet'); $$('[data-integrated-tx]').forEach(button => button.onclick = () => openIntegratedTransactionDetail(button.dataset.integratedTx || '')); }
function integratedPage(tab = 'summary') { const safe = ['summary', 'ledger', 'spending', 'schedule'].includes(tab) ? tab : 'summary', content = safe === 'ledger' ? integratedLedgerPage() : safe === 'spending' ? integratedSpendingPage() : safe === 'schedule' ? integratedSchedulePage() : integratedSummaryPage(), tabs = integratedTabs(safe).replace('integrated-tabs four', 'integrated-tabs four module-primary-tabs'), month = integratedMonthBar(safe === 'spending'); return `<div class="module-page-shell integrated-module-shell">${tabs}${month}<div class="stack">${content}</div></div>`; }
function bindScheduleTools() {
    $$('[data-card-plan-open]').forEach(b => b.onclick = () => openCardPlanDetail(b.dataset.cardPlanOpen || ''));
    $$('[data-card-plan-remove]').forEach(b => b.onclick = () => showDialog({ title: '이 구매 기록을 취소할까요?', message: '아직 납부하지 않은 구매와 할부 일정을 함께 삭제합니다.', confirmText: '구매 취소', cancelText: '유지' }, async () => { if ((await removeUnpaidCardInstallment(b.dataset.cardPlanRemove || ''))) {
        closeSheets({ all: true });
        render();
        toast('구매 기록을 취소했어요.');
    } }));
    $$('[data-card-plan-new]').forEach(b => b.onclick = () => openCardInstallmentForm());
    $$('[data-schedule-record]').forEach(b => b.onclick = () => openIntegratedTransactionDetail(b.dataset.scheduleRecord || ''));
    $$('[data-schedule-plan-edit]').forEach(b => b.onclick = () => openScheduleAmountForm(b.dataset.schedulePlanEdit || '', b.dataset.date || '', false));
    $$('[data-schedule-actual-edit]').forEach(b => b.onclick = () => openScheduleAmountForm(b.dataset.scheduleActualEdit || '', b.dataset.date || '', true));
}
function cardAccountHeading(account) {
    const name = account?.name || '기존 카드', last = account?.lastFour || '';
    return /^\d{4}$/.test(last) && !new RegExp('(^|\\D)' + last + '(\\D|$)').test(name) ? name + ' · ' + last : name;
}
function scheduleToolsMarkup(month) {
    const cards = financeSchedules().filter(s => s.cardPlan).map(s => ({ s, x: cardPlanSummary(s, month), monthly: cardMonthlyAmounts(s, month) })), active = cards.filter(({ x }) => !x.completed), completed = cards.filter(({ x }) => x.completed), groups = new Map(), sum = (key) => cards.reduce((n, c) => n + c.monthly[key], 0);
    for (const card of cards.filter(c => !c.x.completed || c.monthly.hasBill || c.monthly.estimated)) {
        const key = cardV2(card.s)?.cardId || 'legacy';
        groups.set(key, [...(groups.get(key) || []), card]);
    }
    const row = ({ s, x, monthly: m }) => `<div class="card-plan-row compact"><button class="card-plan-open" data-card-plan-open="${escapeHtml(s.id)}"><strong>${escapeHtml(integratedScheduleName(s))}</strong><span>상세 ›</span></button><div class="card-purchase-month"><span>${m.hasBill ? '확정 청구' : '예상 납부'} <b>${won(m.hasBill ? m.confirmed : m.estimated)}</b></span><span>${m.hasBill ? (m.unpaid ? '납부 전' : '납부 완료') : '청구 확인 전'}</span></div><small>${escapeHtml(integratedCardIdentity(String(s.id)).category)} · 남은 원금 ${won(x.remainingPrincipal)} · ${x.paidInstallments}/${x.totalInstallments}회 납부</small>${x.remainingPrincipal === x.purchaseAmount ? `<button class="diagnostic-action" data-card-plan-remove="${escapeHtml(s.id)}">구매 기록 취소</button>` : ''}</div>`;
    return `<section class="card schedule-card" id="integratedCardPlans" data-card-month="${escapeHtml(month)}"><div class="sectionhead"><h2>${escapeHtml(integratedMonthLabel(month))} 카드값</h2></div><div class="card-monthly-summary">${[['unpaid', '남은 납부액'], ['confirmed', '확정 청구'], ['paid', '납부 완료'], ['estimated', '청구 전 예상']].map(([key, label]) => `<div class="${escapeHtml(key === 'unpaid' ? 'card-monthly-primary' : '')}"><span>${label}</span><strong data-card-monthly="${escapeHtml(key)}">${won(sum(key))}</strong></div>`).join('')}</div><div class="card-principal-context"><span>전체 카드 남은 원금</span><strong data-card-principal-total>${won(cards.reduce((n, c) => n + c.x.remainingPrincipal, 0))}</strong></div><p class="source-note">청구·납부는 선택한 달 기준, 전체 원금은 현재 기록 기준이며 이자는 제외해요. 예상액은 확정 청구와 별도이고 납부 완료에는 포인트도 포함해요.</p>${[...groups].map(([key, list]) => { const account = cardAccounts().find(a => a.id === key), amount = (field) => list.reduce((n, c) => n + c.monthly[field], 0), ongoing = list.filter(c => !c.x.completed); return `<section class="card-issuer-group" data-card-group="${escapeHtml(key)}"><h3>${escapeHtml(cardAccountHeading(account))}</h3><div class="card-issuer-due">${escapeHtml([...new Set(list.flatMap(c => { const dates = (cardV2(c.s)?.bills || []).filter(b => b.dueDate.startsWith(month)).map(b => b.dueDate); return dates.length ? dates : scheduleOccurrences(month).filter(o => o.schedule.id === c.s.id).map(o => o.date); }))].sort().join(' · ') || (account?.paymentDay ? '매월 ' + String(account.paymentDay) + '일 결제' : '결제일은 구매 내역에서 확인'))}</div><div class="card-issuer-amounts"><span class="card-issuer-primary">남은 납부액 <b>${won(amount('unpaid'))}</b></span><span>확정 청구 <b>${won(amount('confirmed'))}</b></span>${amount('estimated') ? `<span>청구 전 예상 <b>${won(amount('estimated'))}</b></span>` : ''}</div><div class="card-principal-context"><span>전체 남은 원금</span><strong data-card-principal="${escapeHtml(key)}">${won(list.reduce((n, c) => n + c.x.remainingPrincipal, 0))}</strong></div>${ongoing.length ? `<details class="card-purchases"><summary>구매·할부 ${ongoing.length}건 보기</summary>${ongoing.map(row).join('')}</details>` : '<p class="source-note">납부 완료 · 아래 기록에서 확인할 수 있어요.</p>'}</section>`; }).join('')}${!cards.length ? '<div class="integrated-empty">카드 구매와 납부를 연결해 관리해요.</div>' : ''}${completed.length ? `<details class="schedule-fold card-completed"><summary>납부 완료 ${completed.length}건 · 기록 보기</summary>${completed.map(row).join('')}</details>` : ''}</section>`;
}
function refreshOpenCardOverview() {
    const previous = $('#detailSheet.open #integratedCardPlans');
    if (!previous?.dataset?.cardMonth)
        return;
    const sheet = $('#detailSheet'), body = $('#sheetBody'), scroll = sheet.scrollTop, bodyScroll = body.scrollTop, month = previous.dataset.cardMonth || integratedSelectedMonth(), expanded = new Set(Array.from(previous.querySelectorAll('.card-purchases[open]')).map(x => x.closest('[data-card-group]')?.dataset.cardGroup)), completed = !!previous.querySelector('.card-completed')?.open;
    previous.outerHTML = scheduleToolsMarkup(month);
    const next = $('#detailSheet.open #integratedCardPlans');
    next.querySelectorAll('.card-purchases').forEach(x => { x.open = expanded.has(x.closest('[data-card-group]')?.dataset.cardGroup); });
    const done = next.querySelector('.card-completed');
    if (done)
        done.open = completed;
    bindScheduleTools();
    sheet.scrollTop = scroll;
    body.scrollTop = bodyScroll;
}
function openCardPlansHub() { const month = integratedSelectedMonth(); $('#sheetEyebrow').textContent = '통합 · 카드'; $('#sheetTitle').textContent = '카드·할부'; $('#sheetBody').innerHTML = scheduleToolsMarkup(month); openSheet('#detailSheet'); bindScheduleTools(); }
function openCardPlanDetail(id) {
    const s = financeSchedules().find(x => x.id === id);
    if (!s?.cardPlan)
        return;
    const plan = s.cardPlan, month = integratedSelectedMonth(), summary = cardPlanSummary(s, month), first = plan.firstPaymentDate;
    const occurrences = Array.from({ length: plan.months }, (_, index) => { const cursor = new Date(Date.UTC(Number(first.slice(0, 4)), Number(first.slice(5, 7)) - 1 + index, 1)), key = cursor.toISOString().slice(0, 7), date = scheduleDateForMonth({ ...s, active: true }, key); return scheduleOccurrences(key).find(o => o.schedule.id === s.id && o.date === date); }).filter((o) => !!o);
    const nextPayment = occurrences.find(o => o.status !== 'done'), paid = occurrences.filter(o => o.status === 'done').length, purchase = integratedLedger().find(t => t.meta?.cardPlanId === id && t.meta?.cardPurchase), row = (o, index) => `<button class="schedule-row" data-fixed-cost-item="${escapeHtml(id)}" data-fixed-cost-date="${escapeHtml(o.date)}"><span class="schedule-copy"><strong>${index + 1}회 · ${escapeHtml(o.date)}</strong><small>예정 ${won(schedulePlannedAmount(s, o.date))}${o.status === 'done' ? ` · 실제 ${won(scheduleOccurrenceDisplayAmount(o))}` : ''}</small></span><strong class="schedule-amount">${won(scheduleOccurrenceDisplayAmount(o))}</strong><span class="schedule-status ${escapeHtml(o.status)}">${scheduleOccurrenceUiLabel(o)}</span></button>`;
    $('#sheetEyebrow').textContent = '통합';
    $('#sheetTitle').textContent = '카드·할부';
    $('#sheetBody').innerHTML = `<section class="card-detail-summary"><div class="card-detail-brand"><span class="card-detail-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18 M7 15h4"/></svg></span><h3>${escapeHtml(integratedScheduleName(s))}</h3><span class="card-detail-badge">${plan.interestMode === 'free' ? '무이자' : plan.interestMode === 'partial' ? '부분 무이자' : '유이자'}</span></div><small>${plan.months}개월 · ${plan.interestMode === 'free' ? '무이자' : plan.interestMode === 'partial' ? `처음 ${escapeHtml(plan.interestFreeMonths)}회 무이자 · 이후 이자` : '이자 있음'} · 구매 ${escapeHtml(plan.purchaseDate)}</small><div class="card-plan-values"><span>총 구매액<b>${won(summary.purchaseAmount)}</b></span><span>${escapeHtml(integratedMonthLabel(month))} 예정<b>${won(summary.plannedAmount)}</b></span><span>남은 원금<b>${won(summary.remainingPrincipal)}</b></span></div><div class="card-payment-progress"><div><span>납부 진행</span><strong>${paid} / ${plan.months}회</strong></div><progress max="${escapeHtml(plan.months)}" value="${escapeHtml(paid)}" aria-label="할부 납부 진행"></progress></div><small>이자 예상 ${won(summary.estimatedInterest)} · 실제 청구·납부 ${summary.actualAmount === null ? '미입력' : won(summary.actualAmount)}</small>${nextPayment ? `<button class="card-payment-primary" data-fixed-cost-item="${escapeHtml(id)}" data-fixed-cost-date="${escapeHtml(nextPayment.date)}">납부 확인 <span>›</span></button>` : (summary.completed ? '<div class="card-payment-complete">모든 회차 납부 완료 · 기록은 계속 보관해요.</div>' : '<div class="source-note">예정 회차는 끝났지만 남은 원금이 있어요. 아래 납부 기록을 확인해 주세요.</div>')}</section><section class="card-detail-list"><h3>회차별 납부</h3>${occurrences.slice(0, 3).map(row).join('')}${occurrences.length > 3 ? `<details class="entry-extra"><summary>전체 ${plan.months}회 보기</summary>${occurrences.slice(3).map((o, index) => row(o, index + 3)).join('')}</details>` : ''}</section>${purchase ? `<button class="diagnostic-action" data-schedule-record="${escapeHtml(purchase.id)}">연결된 구매 기록 보기</button>` : ''}<div class="source-note">카드 구매는 소비로 한 번 기록하고, 원금 납부는 부채에서 차감해요.</div>`;
    openSheet('#detailSheet');
    bindScheduleTools();
    $$('#sheetBody [data-fixed-cost-item]').forEach(b => b.onclick = async () => (await openScheduleDay(b.dataset.fixedCostDate || '', b.dataset.fixedCostItem || '')));
}
function spendingPeriodControls() { return `<div class="cardv2-segment spending-period" aria-label="소비 조회 기간">${[['month', '월'], ['quarter', '분기'], ['half', '반기'], ['year', '연간']].map(([key, label]) => `<button data-spending-period="${escapeHtml(key)}" class="${escapeHtml((setting().spendingPeriod === 'years' ? 'year' : String(setting().spendingPeriod || 'month')) === key ? 'active' : '')}">${label}</button>`).join('')}</div>`; }
function integratedConsumptionPreview(month) {
    const x = integratedSpendingAnalysis(month);
    return `<section class="card integrated-consumption-preview"><div class="integrated-consumption-head"><h2>${escapeHtml(integratedMonthLabel(month))} 소비</h2><button data-integrated-tab-go="spending">소비 분석 ›</button></div><div class="integrated-consumption-value">${won(x.total)}</div><div class="consumption-month-split"><span>고정비 <b>${won(x.fixedRows.reduce((n, r) => n + Number(r.amount || 0), 0))}</b></span><span>변동비 <b>${won(x.variableRows.reduce((n, r) => n + Number(r.amount || 0), 0))}</b></span></div><small>카드 원금 납부는 소비에 다시 더하지 않아요.</small></section>`;
}
function openScheduleAmountForm(id, date, actual = false) {
    const s = financeSchedules().find(x => x.id === id), o = scheduleOccurrences(date.slice(0, 7)).find(x => x.schedule.id === id && x.date === date);
    if (!s || !o)
        return;
    const loan = s.kind === 'loan', values = o.tx?.meta || {};
    $('#formEyebrow').textContent = '통합 · 일정';
    $('#formTitle').textContent = actual ? '실제 납부 수정' : '예정금액 수정';
    $('#formBody').innerHTML = `<form id="scheduleAmountForm" class="form"><div class="source-note">${escapeHtml(integratedScheduleName(s))} · ${escapeHtml(date)}</div>${actual && loan ? `<div class="form-grid"><div class="field"><label>실제 원금</label><input name="principal" type="number" inputmode="numeric" min="0" step="1" value="${escapeHtml(values.loanPrincipal || 0)}" required></div><div class="field"><label>실제 이자</label><input name="interest" type="number" inputmode="numeric" min="0" step="1" value="${escapeHtml(values.loanInterest || 0)}" required></div></div>` : `<div class="field"><label>${actual ? '실제 납부액' : '예정금액'}</label><input name="amount" type="number" inputmode="numeric" min="1" step="1" value="${escapeHtml(actual ? scheduleOccurrenceDisplayAmount(o) : schedulePlannedAmount(s, date))}" required></div>`}${actual ? '<div class="source-note">연결된 이번 납부 기록만 바뀝니다. 다음 일정의 예정금액은 유지해요.</div>' : '<div class="field"><label>변경 범위</label><select name="scope"><option value="once">이번 건만</option><option value="future">이번 건부터 앞으로</option></select></div><div class="source-note">이미 납부한 실제 기록은 바뀌지 않아요.</div>'}<button class="integrated-form-save" type="submit">수정 저장</button></form>`;
    openSheet('#formSheet', { mode: 'input' });
    const form = $('#scheduleAmountForm');
    form.onsubmit = async (e) => { e.preventDefault(); const d = new FormData(form), ok = actual ? (await updateScheduleActualPayment(id, date, Number(d.get('amount')), Number(d.get('principal')), Number(d.get('interest')))) : (await updateSchedulePlannedAmount(id, date, Number(d.get('amount')), String(d.get('scope')))); if (!ok)
        return; sheetDirty = false; closeSheets({ all: true }); render(); (await openScheduleDay(date, id)); toast('수정했어요.'); };
}
function openCardInstallmentForm() {
    $('#formEyebrow').textContent = '통합 · 카드·할부';
    $('#formTitle').textContent = '카드 구매 기록';
    $('#formBody').innerHTML = `<form id="cardInstallmentForm" class="form"><div class="field"><label>구매 이름</label><input name="name" maxlength="80" placeholder="예: TV · 국민카드" required></div><div class="field"><label>총 구매액</label><input name="purchaseAmount" type="number" inputmode="numeric" min="1" step="1" required></div><div class="form-grid"><div class="field"><label>구매일</label><input name="purchaseDate" type="date" value="${escapeHtml(localYmd())}" required></div><div class="field"><label>첫 납부일</label><input name="firstPaymentDate" type="date" required></div></div><div class="form-grid"><div class="field"><label>할부 기간</label><select name="months">${[1, 2, 3, 4, 5, 6, 10, 12, 18, 24, 30, 36, 48, 60].map(n => `<option value="${escapeHtml(n)}" ${n === 24 ? 'selected' : ''}>${n === 1 ? '일시불' : n + '개월'}</option>`).join('')}</select></div><div class="field"><label>이자</label><select name="interestMode"><option value="free">무이자</option><option value="paid">이자 있음</option><option value="partial">처음 N회 무이자</option></select></div></div><div class="field" data-card-free-months hidden><label>처음 무이자 회차 수</label><input name="interestFreeMonths" type="number" inputmode="numeric" min="1" max="23" step="1" value="3"><small>예: 6개월 중 처음 3회는 이자 0원, 4회부터 이자가 붙어요.</small></div><div class="field" data-card-rate hidden><label>연 이율 (%) · 예상 계산용</label><input name="annualRate" type="number" min="0" max="100" step="0.01" value="0"></div><div class="source-note">원금은 원 단위로 나누고 나머지는 마지막 회차에 더해 총 구매액과 맞춰요. 구매일에 소비와 카드 미납 원금을 기록해요. 원금을 납부할 때 소비로 다시 더하지 않습니다. 이자는 남은 원금 기준 예상액이며 실제 청구금액을 확인해 납부 기록을 입력해 주세요.</div><button class="integrated-form-save" type="submit">구매 기록 저장</button></form>`;
    openSheet('#formSheet', { mode: 'input' });
    const form = $('#cardInstallmentForm');
    const updateInterestFields = () => { const mode = form.elements.namedItem('interestMode').value, months = Number(form.elements.namedItem('months').value), free = form.elements.namedItem('interestFreeMonths'), rate = form.querySelector('[data-card-rate]'), partial = form.querySelector('[data-card-free-months]'); if (rate)
        rate.hidden = mode === 'free'; if (partial)
        partial.hidden = mode !== 'partial'; free.disabled = mode !== 'partial'; free.required = mode === 'partial'; free.max = String(Math.max(0, months - 1)); form.elements.namedItem('annualRate').disabled = mode === 'free'; };
    updateInterestFields();
    form.addEventListener('change', () => { updateInterestFields(); sheetDirty = true; });
    form.onsubmit = async (e) => { e.preventDefault(); const id = (await createCardInstallment(Object.fromEntries(new FormData(form).entries()))); if (!id)
        return; sheetDirty = false; closeSheets({ all: true }); nav('integrated', 'schedule'); toast('구매와 할부 일정을 저장했어요.'); };
}
;
/* asset-os source: ui-render.js */
"use strict";
'use strict';
function integratedUiType(t) { if (!t)
    return 'externalIncome'; if (t.type === 'expense')
    return 'lifeExpense'; if (['externalAssetIn', 'internalTransfer'].includes(t.type || '') && ['isa', 'pension', 'irp', 'deposit', 'savings'].includes(integratedStore().accounts.find(a => a.id === t.toAccountId)?.kind || ''))
    return 'savingInvestment'; if (['debtPrincipal', 'externalDebtPrincipal', 'debtInterest', 'debtInterestExternal'].includes(t.type || ''))
    return 'loanPayment'; return t.type || ''; }
function integratedDefaultCategory(uiType) { const categories = { externalIncome: '월급', lifeExpense: '생활비', savingInvestment: '저축·투자', loanPayment: '대출 납부' }; return categories[uiType] || ''; }
function integratedFormAccountOptions(selected = '') { const activeIds = new Set(activeFinancialProducts().map(p => p.id)); return integratedStore().accounts.filter(a => !['isa', 'pension', 'irp'].includes(a.kind) && (!a.productId || activeIds.has(a.productId))).map(a => `<option value="${escapeHtml(a.id)}" ${a.id === selected ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join(''); }
function integratedInvestmentTargetOptions(selected = '') { const activeIds = new Set(activeFinancialProducts().map(p => p.id)); return integratedStore().accounts.filter(a => ['isa', 'pension', 'irp', 'deposit', 'savings'].includes(a.kind) && (!a.productId || activeIds.has(a.productId))).map(a => `<option value="${escapeHtml(a.id)}" ${a.id === selected ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join(''); }
function integratedFormLiabilityOptions(selected = '') { return integratedStore().liabilities.filter(a => { const p = a.productId ? financialProduct(a.productId) : null; return !p || p.status === 'active'; }).map(a => `<option value="${escapeHtml(a.id)}" ${a.id === selected ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join(''); }
function integratedFormMarkup(tx = null, preset = {}) {
    const rawType = preset.uiType || integratedUiType(tx), common = ['externalIncome', 'lifeExpense', 'savingInvestment', 'loanPayment'].includes(rawType), uiType = common ? rawType : 'system', amount = Number(tx?.amount ?? preset.amount) || '', date = tx?.date || preset.date || ymd(), category = tx?.category || preset.category || integratedDefaultCategory(rawType), target = preset.toAccountId || tx?.toAccountId || 'pension-link', liability = preset.liabilityId || tx?.liabilityId || integratedStore().liabilities[0]?.id || '';
    if (!common) {
        return `<form id="integratedTxForm" class="form" data-edit-id="${escapeHtml(tx?.id || '')}" data-system-type="${escapeHtml(rawType)}"><div class="integrated-form-hint">이 항목은 상품 초기설정용 시스템 기록입니다.</div><div class="form-grid"><div class="field"><label>날짜</label><input name="date" type="date" value="${escapeHtml(date)}" required></div><div class="field"><label>금액</label><input name="amount" type="number" min="1" step="1" value="${escapeHtml(amount || '')}" required></div></div><div class="field"><label>분류</label><input name="category" value="${escapeHtml(category)}"></div>${rawType === 'openingAsset' ? `<div class="field"><label>대상</label><select name="toAccountId">${integratedFormAccountOptions(target)}</select></div>` : ''}${rawType === 'openingLiability' ? `<div class="field"><label>대출</label><select name="liabilityId">${integratedFormLiabilityOptions(liability)}</select></div>` : ''}<div class="field"><label>메모</label><input name="note" value="${escapeHtml(tx?.note || '')}"></div>${formValidationMarkup()}<button class="integrated-form-save">저장</button></form>`;
    }
    return `<form id="integratedTxForm" class="form integrated-entry" data-edit-id="${escapeHtml(tx?.id || '')}" data-pension-account-id="${escapeHtml(tx?.meta?.targetPensionAccountId || preset.targetPensionAccountId || '')}" data-isa-account-id="${escapeHtml(tx?.meta?.targetIsaAccountId || preset.targetIsaAccountId || '')}">
 <div class="field entry-amount" data-simple-field="amount"><label for="entryAmount">금액</label><div class="entry-amount-line"><input id="entryAmount" name="amount" type="number" inputmode="numeric" min="1" step="1" placeholder="0" value="${escapeHtml(amount)}" aria-label="금액"><output class="entry-amount-display" aria-hidden="true"></output><span>원</span></div></div>
 <div class="entry-type-buttons" role="group" aria-label="거래 종류">${[['externalIncome', '수입'], ['lifeExpense', '지출'], ['savingInvestment', '저축·투자'], ['loanPayment', '대출 납부']].map(([value, label]) => `<button type="button" data-entry-type="${escapeHtml(value)}" class="${escapeHtml(uiType === value ? 'active' : '')}" aria-pressed="${escapeHtml(uiType === value ? 'true' : 'false')}">${label}</button>`).join('')}</div>
 <div class="field entry-type-select"><label for="entryType">거래 종류</label><select id="entryType" name="uiType">${[['externalIncome', '수입'], ['lifeExpense', '지출'], ['savingInvestment', '저축·투자'], ['loanPayment', '대출 납부']].map(([value, label]) => `<option value="${escapeHtml(value)}" ${uiType === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div>
 ${!tx ? integratedEntryShortcutsMarkup() : ''}
 <div class="field" data-simple-field="target"><label for="entryTarget">넣을 계좌</label><select id="entryTarget" name="toAccountId">${integratedInvestmentTargetOptions(target)}</select></div>
 <div class="field hidden-field" data-simple-field="pensionTarget"><label>연금 납입 계좌</label><select name="targetPensionAccountId"></select></div>
 <div class="field hidden-field" data-simple-field="isaTarget"><label>ISA 납입 계좌</label><select name="targetIsaAccountId"></select></div>
 <div data-simple-field="loan"><div class="field"><label>대출</label><select name="liabilityId">${integratedFormLiabilityOptions(liability)}</select></div><div class="form-grid"><div class="field"><label>원금</label><input name="principal" type="number" inputmode="numeric" min="0" step="1" value="${escapeHtml(tx?.type === 'debtPrincipal' ? amount : preset.principal || '0')}"></div><div class="field"><label>이자</label><input name="interest" type="number" inputmode="numeric" min="0" step="1" value="${escapeHtml(tx?.type === 'debtInterest' ? amount : preset.interest || '0')}"></div></div></div>
 <div id="entryDateContext" class="entry-date-context" data-entry-date-context role="status">${escapeHtml(date === localYmd() ? `오늘 ${date} 기록` : `${date} 날짜로 기록합니다. 저장 전 날짜를 확인해 주세요.`)}</div><div class="field"><label for="entryDate">날짜</label><input id="entryDate" name="date" type="date" value="${escapeHtml(date)}" aria-describedby="entryDateContext" required></div>
 <div class="field" data-spending-item-field hidden><label for="entrySpendingItem">소비 항목 · 선택</label><input id="entrySpendingItem" name="spendingItem" maxlength="80" placeholder="예: 배달음식 · 카페 · 어머니용돈" value="${escapeHtml(tx?.meta?.spendingItem || '')}"></div>
 <div class="field" data-simple-field="category"><label for="entryCategory">분류</label><div class="entry-category-chips">${['식비', '교통', '생활용품', '급여', '연금 납입'].map(value => `<button type="button" class="${escapeHtml(category === value ? 'active' : '')}" data-entry-category="${escapeHtml(value)}">${escapeHtml(value)}</button>`).join('')}</div><input id="entryCategory" name="category" value="${escapeHtml(category)}" list="entryCategories" maxlength="80"><datalist id="entryCategories">${['식비', '교통', '생활용품', '급여', '보험료', '저축', '연금 납입'].map(value => `<option value="${escapeHtml(value)}">`).join('')}</datalist></div>
 <details class="entry-extra" ${tx?.note || preset.note ? 'open' : ''}><summary>메모·추가 정보</summary><div class="field"><label for="entryNote">메모</label><input id="entryNote" name="note" value="${escapeHtml(tx?.note || preset.note || '')}" maxlength="500" placeholder="필요할 때만 입력"></div>${!tx ? '<label class="entry-check"><input type="checkbox" name="saveFavorite">자주 쓰는 기록으로 저장</label>' : ''}</details>
 ${formValidationMarkup()}<div class="entry-save-actions">${!tx ? '<button class="entry-continue" type="submit" data-entry-continue>저장하고 계속</button>' : ''}<button class="integrated-form-save" type="submit">저장</button></div></form>`;
}
function syncIntegratedFormFields() { const f = $('#integratedTxForm'); if (!f || !f.elements.uiType)
    return; const type = f.elements.uiType.value, targetId = f.elements.toAccountId?.value || '', targetKind = integratedStore().accounts.find(a => a.id === targetId)?.kind || '', isPensionTarget = type === 'savingInvestment' && ['pension', 'irp'].includes(targetKind), isIsaTarget = type === 'savingInvestment' && targetKind === 'isa'; $$('[data-simple-field]').forEach(el => { const k = el.dataset.simpleField, show = k === 'loan' ? type === 'loanPayment' : k === 'target' ? type === 'savingInvestment' : k === 'pensionTarget' ? isPensionTarget : k === 'isaTarget' ? isIsaTarget : k === 'amount' ? type !== 'loanPayment' : k === 'category' ? type !== 'loanPayment' : true; el.classList.toggle('hidden-field', !show); }); const ps = f.elements.targetPensionAccountId; if (ps) {
    if (isPensionTarget) {
        const candidates = pensionAccountsForKind(targetKind, f.elements.date?.value || ymd()), prior = ps.value || f.dataset.pensionAccountId || '';
        ps.innerHTML = `<option value="">${candidates.length > 1 ? '계좌 선택' : '납입 계좌 없음'}</option>` + candidates.map(a => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.name)}</option>`).join('');
        if (candidates.some(a => a.id === prior))
            ps.value = prior;
        else if (candidates.length === 1)
            ps.value = candidates[0].id;
        else
            ps.value = '';
        ps.required = true;
    }
    else {
        ps.innerHTML = '';
        ps.required = false;
    }
} const isa = f.elements.targetIsaAccountId; if (isa) {
    if (isIsaTarget) {
        const candidates = isaAccountsForDate(f.elements.date?.value || ymd()), prior = isa.value || f.dataset.isaAccountId || '';
        isa.innerHTML = `<option value="">${candidates.length > 1 ? 'ISA 선택' : 'ISA 없음'}</option>` + candidates.map(a => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.name)}</option>`).join('');
        if (candidates.some(a => a.id === prior))
            isa.value = prior;
        else if (candidates.length === 1)
            isa.value = candidates[0].id;
        else
            isa.value = '';
        isa.required = true;
    }
    else {
        isa.innerHTML = '';
        isa.required = false;
    }
} const c = f.elements.category; if (c && (!c.value || c.dataset.auto === '1')) {
    c.value = integratedDefaultCategory(type);
    c.dataset.auto = '1';
} }
function placeholderPage(_root) { return `<div class="stack"><section class="modulehero"><div class="eyebrow">경로 확인 필요</div><h2>지원하지 않는 화면</h2><div class="modulebalance">화면 오류</div></section><section class="card placeholder"><div><strong>이 화면 경로를 찾지 못했습니다.</strong><span>하단 메뉴에서 다시 이동해 주세요.</span></div></section></div>`; }
function storageWarningMarkup() { const msg = state.system?.saveError || state.system?.loadWarning, usage = state.system?.storageUsage, capacity = usage?.level === 'critical' ? `저장공간을 ${Math.round((Number(usage.bytes) || 0) / 10000) / 100}MB 사용 중입니다. ZIP 백업과 데이터 상태를 확인해 주세요.` : usage?.level === 'warning' ? `저장공간을 ${Math.round((Number(usage.bytes) || 0) / 10000) / 100}MB 사용 중입니다. 여유 있을 때 ZIP 백업을 권장합니다.` : ''; return msg || capacity ? `<div class="warningbox" style="margin-bottom:12px"><strong>데이터 확인 필요</strong><br>${escapeHtml(msg || capacity)}</div>` : ''; }
function render() { integratedSelectedMonth(); const r = route(); document.body.dataset.root = r.root; $('#title').textContent = r.root === 'home' ? '홈' : r.root === 'isa' ? 'ISA' : r.root === 'pension' ? '개인연금' : '통합'; const page = r.root === 'home' ? home() : r.root === 'isa' ? isaPage(r.tab) : r.root === 'pension' ? pensionPage(r.tab) : r.root === 'integrated' ? integratedPage(r.tab) : placeholderPage(r.root); $('#main').innerHTML = storageWarningMarkup() + page + '<div id="globalScrollGuard" class="global-scroll-guard" aria-hidden="true"></div>'; $$('.nav').forEach(b => b.classList.toggle('active', b.dataset.root === r.root)); const bell = $('#alertBell'), badge = $('#alertBadge'); if (bell && badge) {
    const count = homeAlertCount();
    badge.hidden = count === 0;
    badge.textContent = count > 99 ? '99+' : String(count);
    bell.setAttribute('aria-label', count ? `검토·중요 알림 ${count}건` : '검토·중요 알림 없음');
} applyTheme(); bind(); bindTransactionSearch(); if (typeof refreshOpenCardOverview === 'function')
    refreshOpenCardOverview(); updateDiagnostics(); }
function bindTransactionSearch() { const integratedForm = $('[data-integrated-search-form]'); if (integratedForm)
    integratedForm.onsubmit = e => { e.preventDefault(); integratedLedgerSearch = String(new FormData(e.currentTarget).get('query') || '').trim(); integratedSearchDisplayLimit = 50; render(); }; $('[data-integrated-search-clear]')?.addEventListener('click', () => { integratedLedgerSearch = ''; integratedSearchDisplayLimit = 50; render(); }); $('[data-integrated-search-more]')?.addEventListener('click', () => { integratedSearchDisplayLimit += 50; renderKeepingScroll(); }); const pensionForm = $('[data-pension-search-form]'); if (pensionForm)
    pensionForm.onsubmit = e => { e.preventDefault(); pensionTransactionSearch = String(new FormData(e.currentTarget).get('query') || '').trim(); pensionTransactionDisplayLimit = 20; render(); }; $('[data-pension-search-clear]')?.addEventListener('click', () => { pensionTransactionSearch = ''; pensionTransactionDisplayLimit = 20; render(); }); }
function applyTheme() { const s = setting(); document.documentElement.dataset.theme = s.theme; document.documentElement.dataset.accent = s.accent; $('#themeToggle').checked = s.theme === 'dark'; $('#fabToggle').checked = false; $('#hapticToggle').checked = s.haptics; $('#fab').hidden = true; $$('#accentChoices .swatch').forEach(b => b.classList.toggle('active', b.dataset.value === s.accent)); }
function updateDiagnostics() { const h = state.accounts.reduce((sum, a) => sum + visibleHoldingCount(a), 0), d = state.accounts.reduce((sum, a) => sum + dividends(a).length, 0), current = state.accounts.filter(isCurrentAccount).length, past = state.accounts.filter(isPastAccount).length, integrity = typeof systemIntegrityIssues === 'function' ? systemIntegrityIssues().length : 0, usage = state.system?.storageUsage; if ($('#dataCounts'))
    $('#dataCounts').textContent = `${state.accounts.length} / ${h} / ${d}`; if ($('#accountMenuCount'))
    $('#accountMenuCount').textContent = `${state.accounts.length}개 계좌 · 현재 ${current}개 · 이전 ${past}개`; if ($('#errorCount')) {
    $('#errorCount').textContent = (runtimeErrors + integrity) + '건';
    $('#errorCount').className = `diagnostic-value ${runtimeErrors + integrity ? 'wait' : 'ok'}`;
} if ($('#storageUsageStatus')) {
    const mb = Math.round((Number(usage?.bytes) || 0) / 10000) / 100, pctUsed = Math.round((Number(usage?.bytes) || 0) / (Number(usage?.limit) || MAX_STATE_BYTES) * 100);
    $('#storageUsageStatus').textContent = usage ? `${mb}MB · 기기 DB` : '저장 후 계산';
    $('#storageUsageStatus').className = `diagnostic-value ${['warning', 'critical'].includes(usage?.level || '') ? 'wait' : 'ok'}`;
} if ($('#backupStatus'))
    $('#backupStatus').textContent = '준비됨'; }
async function selectAccount(id) { setting().selectedAccountId = id; rememberViewPreferences(); render(); haptic('light'); }
function bind() {
    $('[data-home-growth]')?.addEventListener('click', () => openFinancialGrowthAnalysis('3m'));
    $$('[data-route]').forEach(b => b.onclick = e => { e.stopPropagation(); if (b.dataset.tab === 'transactions')
        transactionDisplayLimit = 50; nav(b.dataset.route, b.dataset.tab || 'summary'); });
    $$('[data-integrated-tab]').forEach(b => b.onclick = () => nav('integrated', b.dataset.integratedTab));
    $$('[data-integrated-tab-go]').forEach(b => b.onclick = () => nav('integrated', b.dataset.integratedTabGo));
    $('[data-integrated-month-select]')?.addEventListener('change', async (e) => { const target = e.target; if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement))
        return; const month = target.value; if (!/^\d{4}-\d{2}$/.test(month))
        return; setting().integratedMonth = month; if (route().root === 'integrated' && route().tab === 'spending')
        clearSpendingSelection(); rememberViewPreferences(); render(); });
    $('[data-integrated-current-month]')?.addEventListener('click', async () => { setting().integratedMonth = localYmd().slice(0, 7); if (route().root === 'integrated' && route().tab === 'spending')
        clearSpendingSelection(); rememberViewPreferences(); render(); });
    $$('[data-integrated-month-shift]').forEach(b => b.onclick = async () => (await integratedShiftMonth(Number(b.dataset.integratedMonthShift) || 0)));
    $$('[data-integrated-category]').forEach(b => b.onclick = () => { setting().integratedLedgerCategory = b.dataset.integratedCategory || ''; rememberViewPreferences(); render(); });
    $$('[data-integrated-filter]').forEach(b => b.onclick = async () => { setting().integratedLedgerFilter = b.dataset.integratedFilter || ''; rememberViewPreferences(); render(); });
    $$('[data-integrated-new]').forEach(b => b.onclick = () => openIntegratedTransactionForm());
    $$('[data-integrated-tx]').forEach(b => b.onclick = () => openIntegratedTransactionDetail(b.dataset.integratedTx));
    $$('[data-integrated-month-detail]').forEach(b => b.onclick = () => openIntegratedMonthDetail(b.dataset.integratedMonthDetail));
    $$('[data-spending-detail]').forEach(b => b.onclick = () => openIntegratedSpendingDetail(b.dataset.spendingDetail, b.dataset.spendingKey || '', b.dataset.spendingMonth || integratedSelectedMonth()));
    $('[data-spending-new]')?.addEventListener('click', () => openIntegratedTransactionForm('', { uiType: 'lifeExpense' }));
    $('[data-household-income]')?.addEventListener('click', () => openIntegratedTransactionForm('', { uiType: 'externalIncome', category: '수입' }));
    $('[data-household-expense]')?.addEventListener('click', () => openIntegratedTransactionForm('', { uiType: 'lifeExpense' }));
    $('[data-cash-reconcile]')?.addEventListener('click', openCashReconcileForm);
    $('[data-spending-budget]')?.addEventListener('click', openMonthlyLivingBudgetForm);
    $$('[data-integrated-asset]').forEach(b => b.onclick = () => openIntegratedAsset(b.dataset.integratedAsset));
    $$('[data-fixed-cost-item]').forEach(b => b.onclick = async () => (await openScheduleDay(b.dataset.fixedCostDate, b.dataset.fixedCostItem)));
    $$('[data-schedule-day]').forEach(b => b.onclick = async () => (await openScheduleDay(b.dataset.scheduleDay)));
    $('[data-empty-new-isa]')?.addEventListener('click', () => openNewIsaAccount(policyGroup('isa').activePolicyId));
    $$('[data-detail]').forEach(b => b.onclick = e => { e.stopPropagation(); openDetail(b.dataset.detail); });
    $$('[data-account]').forEach(b => b.onclick = async () => (await selectAccount(b.dataset.account || '')));
    $$('[data-archive-open]').forEach(b => b.onclick = () => openArchivedAccountDetail(b.dataset.archiveOpen));
    $$('[data-isa-tab]').forEach(b => b.onclick = () => { if (b.dataset.isaTab === 'transactions')
        transactionDisplayLimit = 50; nav('isa', b.dataset.isaTab); });
    $$('[data-holding]').forEach(b => b.onclick = () => openHolding(b.dataset.holding));
    $$('[data-tx]').forEach(b => b.onclick = () => openTransactionDetail(b.dataset.tx));
    $$('[data-tx-filter]').forEach(b => b.onclick = async () => { setting().txFilter = b.dataset.txFilter || ''; transactionDisplayLimit = 50; rememberViewPreferences(); render(); });
    $('[data-tx-more]')?.addEventListener('click', () => { transactionDisplayLimit += 50; render(); });
    $$('[data-register]').forEach(b => b.onclick = openRegisterChoice);
    $$('[data-new-tx]').forEach(b => b.onclick = openTransactionChoice);
    $$('[data-inline-group],[data-inline-donut]').forEach(b => b.onclick = async () => { const group = b.dataset.inlineGroup || b.dataset.inlineDonut || '', next = setting().compositionFocus === group ? '' : group; setting().compositionGroup = next; setting().compositionFocus = next; rememberViewPreferences(); renderKeepingScroll(); });
    $('[data-isa-holdings-toggle]')?.addEventListener('click', e => { const panel = $('[data-isa-holdings-extra]'), guard = $('[data-isa-holdings-guard]'); isaHoldingsExpanded = !isaHoldingsExpanded; stableInlineToggle(e.currentTarget, panel, guard, isaHoldingsExpanded); e.currentTarget.textContent = isaHoldingsExpanded ? '숨기기 ∧' : '펼치기 ∨'; e.currentTarget.setAttribute('aria-expanded', isaHoldingsExpanded ? 'true' : 'false'); });
    $('[data-pension-holdings-toggle]')?.addEventListener('click', e => { const panel = $('[data-pension-holdings-extra]'), guard = $('[data-pension-holdings-guard]'); pensionHoldingsExpanded = !pensionHoldingsExpanded; stableInlineToggle(e.currentTarget, panel, guard, pensionHoldingsExpanded); e.currentTarget.textContent = pensionHoldingsExpanded ? '숨기기 ∧' : '펼치기 ∨'; e.currentTarget.setAttribute('aria-expanded', pensionHoldingsExpanded ? 'true' : 'false'); });
    $$('[data-dividend-analysis]').forEach(b => b.onclick = () => { dividendDisplayLimit = 50; openDividendAnalysis(b.dataset.period || ''); });
    $$('[data-alerts-center]').forEach(b => b.onclick = openAlertsCenter);
    bindIntegrityActions();
    $$('[data-account-selector]').forEach(b => b.onclick = openAccountSelector);
    $$('[data-history-route]').forEach(b => b.onclick = () => nav('isa', 'history'));
    $('[data-policy-view]')?.addEventListener('click', () => openPolicyReadonly('isa'));
    $('[data-tax-route]')?.addEventListener('click', () => nav('isa', 'tax'));
    $('[data-isa-lifecycle]')?.addEventListener('click', openIsaLifecycleForm);
    $('[data-isa-successor]')?.addEventListener('click', () => openNewIsaAccount(policyGroup('isa').activePolicyId));
    $('[data-maturity-edit]')?.addEventListener('click', openMaturityForm);
    $('[data-transfer-calc]')?.addEventListener('click', openTransferCalculator);
    $$('[data-pension-tab]').forEach(b => b.onclick = () => { if (b.dataset.pensionTab === 'transactions')
        pensionTransactionDisplayLimit = 20; nav('pension', b.dataset.pensionTab); });
    $('[data-pension-new-tx]')?.addEventListener('click', () => openPensionTradeForm());
    $('[data-pension-asset-trade]')?.addEventListener('click', () => openPensionTradeForm('', 'assets'));
    $('[data-pension-account-manage]')?.addEventListener('click', openPensionAccountManager);
    $('[data-pension-contribution-batch]')?.addEventListener('click', openPensionContributionBatchForm);
    $$('[data-pension-tx]').forEach(b => b.onclick = () => openPensionTransactionDetail(b.dataset.pensionTx));
    $('[data-pension-tx-more]')?.addEventListener('click', () => { pensionTransactionDisplayLimit += 20; renderKeepingScroll(); });
    $('[data-pension-future-settings]')?.addEventListener('click', openPensionSettings);
    $('[data-pension-goal-toggle]')?.addEventListener('click', async () => { setting().pensionGoalExpanded = !setting().pensionGoalExpanded; rememberViewPreferences(); render(); });
    $('[data-pension-months-toggle]')?.addEventListener('click', e => { const card = e.currentTarget.closest('[data-pension-monthly-card]'), guard = card?.nextElementSibling?.matches('[data-monthly-scroll-guard]') ? card.nextElementSibling : null; if (!card)
        return; const beforeY = window.scrollY, beforeH = card.getBoundingClientRect().height, expanding = !pensionMonthsExpanded; if (expanding)
        clearScrollGuard(guard); pensionMonthsExpanded = expanding; card.classList.toggle('expanded', expanding); e.currentTarget.textContent = expanding ? '접기' : '12개월 펼치기'; e.currentTarget.setAttribute('aria-expanded', expanding ? 'true' : 'false'); requestAnimationFrame(() => { const afterH = card.getBoundingClientRect().height; if (!expanding)
        holdScrollGuard(guard, Math.max(0, beforeH - afterH), beforeY); restoreScrollY(beforeY); }); });
    $('[data-integrated-assets-toggle]')?.addEventListener('click', e => { const card = e.currentTarget.closest('[data-integrated-assets-card]'), body = card?.querySelector('[data-integrated-assets-body]'), guard = $('[data-integrated-assets-guard]'); if (!card || !body)
        return; integratedAssetsExpanded = !integratedAssetsExpanded; stableInlineToggle(e.currentTarget, body, guard, integratedAssetsExpanded); card.classList.toggle('open', integratedAssetsExpanded); e.currentTarget.setAttribute('aria-expanded', integratedAssetsExpanded ? 'true' : 'false'); });
    $('[data-fixed-cost-toggle]')?.addEventListener('click', e => { const card = e.currentTarget.closest('[data-fixed-cost-card]'), body = card?.querySelector('[data-fixed-cost-body]'); if (!card || !body)
        return; integratedFixedCostsExpanded = !integratedFixedCostsExpanded; body.hidden = !integratedFixedCostsExpanded; card.classList.toggle('open', integratedFixedCostsExpanded); e.currentTarget.setAttribute('aria-expanded', integratedFixedCostsExpanded ? 'true' : 'false'); });
    $$('[data-pension-scope]').forEach(b => b.onclick = async () => { setting().pensionAssetScope = b.dataset.pensionScope || ''; setting().pensionAssetFocus = ''; pensionExpandedAssetGroup = ''; pensionHoldingsExpanded = false; pensionAnalysisScope = b.dataset.pensionScope || ''; pensionAnalysisSelectedKey = ''; rememberViewPreferences(); renderKeepingScroll(); });
    $$('[data-pension-group],[data-pension-donut]').forEach(b => b.onclick = async () => { const key = b.dataset.pensionGroup || b.dataset.pensionDonut || '', next = setting().pensionAssetFocus === key ? '' : key; setting().pensionAssetFocus = next; pensionExpandedAssetGroup = next; rememberViewPreferences(); renderKeepingScroll(); });
    $('[data-pension-group-toggle]')?.addEventListener('click', e => { const key = e.currentTarget.dataset.pensionGroupToggle || ''; pensionExpandedAssetGroup = pensionExpandedAssetGroup === key ? '' : key; renderKeepingScroll(); });
    $$('[data-pension-holding]').forEach(b => b.onclick = () => openPensionHoldingDetail(b.dataset.pensionHolding));
    $('[data-isa-asset-analysis]')?.addEventListener('click', openIsaAssetAnalysis);
    $('[data-pension-asset-analysis]')?.addEventListener('click', openPensionAssetAnalysis);
    $('[data-pension-income-analysis]')?.addEventListener('click', openPensionIncomeAnalysis);
    if (route().root === 'pension' && route().tab === 'future')
        bindPensionFutureSheet();
    $$('[data-current-month="true"]').forEach(b => b.onclick = async (e) => { e.stopPropagation(); setting().integratedMonth = localYmd().slice(0, 7); rememberViewPreferences(); nav(b.dataset.route, b.dataset.tab || 'summary'); });
}
;
/* asset-os source: integrated-forms.js */
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
    const itemField = form.querySelector('[data-spending-item-field]');
    const syncItem = () => { if (itemField)
        itemField.hidden = form.elements.uiType?.value !== 'lifeExpense'; };
    form.elements.uiType?.addEventListener('change', syncItem);
    syncItem();
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
    const date = String(data.get('date') || ymd()), note = String(data.get('note') || '').trim(), base = { ...(existing?.productId ? { productId: existing.productId, meta: clone(existing.meta || {}) } : {}), date, note, sequence: existing && String(existing.date) === date && Number.isFinite(Number(existing.sequence)) ? Number(existing.sequence) : nextIntegratedSequence(date), createdAt: existing?.createdAt || new Date().toISOString() };
    if (systemType) {
        const amount = Number(data.get('amount')), category = String(data.get('category') || systemType);
        if (systemType === 'openingAsset')
            return [{ ...base, id: form.dataset.editId || uid('igl'), type: 'openingAsset', amount, toAccountId: String(data.get('toAccountId') || ''), category }];
        if (systemType === 'openingLiability')
            return [{ ...base, id: form.dataset.editId || uid('igl'), type: 'openingLiability', amount, liabilityId: String(data.get('liabilityId') || ''), category }];
    }
    const type = String(data.get('uiType') || ''), amount = Number(data.get('amount')), category = String(data.get('category') || integratedDefaultCategory(type)).trim();
    if (type === 'externalIncome')
        return [{ ...base, id: editingId || uid('igl'), type: 'externalIncome', amount, toAccountId: existing?.type === 'externalIncome' ? existing.toAccountId : 'cash-main', category, ...(existing?.type === 'externalIncome' ? { productId: existing.productId, meta: clone(existing.meta || {}) } : {}) }];
    if (type === 'lifeExpense')
        return [{ ...base, id: editingId || uid('igl'), type: existing?.type === 'externalExpense' ? 'externalExpense' : 'expense', fixed: !!existing?.fixed, amount, fromAccountId: existing?.type === 'externalExpense' ? undefined : existing?.fromAccountId || 'cash-main', category, ...(existing?.productId ? { productId: existing.productId } : {}), meta: { ...clone(existing?.meta || {}), ...(data.get('spendingItem') !== null ? { spendingItem: String(data.get('spendingItem') || '').trim().slice(0, 80) } : {}) } }];
    if (type === 'savingInvestment') {
        const toAccountId = String(data.get('toAccountId') || ''), targetKind = integratedStore().accounts.find(a => a.id === toAccountId)?.kind || '', requested = String(data.get('targetPensionAccountId') || '');
        const candidates = ['pension', 'irp'].includes(targetKind) ? pensionAccountsForKind(targetKind, date) : [], resolved = requested && candidates.some(a => a.id === requested) ? requested : (candidates.length === 1 ? candidates[0].id : '');
        const isaRequested = String(data.get('targetIsaAccountId') || ''), isaCandidates = targetKind === 'isa' ? isaAccountsForDate(date) : [], isaResolved = isaRequested && isaCandidates.some(a => a.id === isaRequested) ? isaRequested : (isaCandidates.length === 1 ? isaCandidates[0].id : '');
        const routing = ['pension', 'irp'].includes(targetKind) ? { targetPensionAccountId: resolved, pensionRoutingRequired: !resolved } : targetKind === 'isa' ? { targetIsaAccountId: isaResolved, isaRoutingRequired: !isaResolved } : {};
        return [{ ...base, id: editingId || uid('igl'), type: 'internalTransfer', amount, fromAccountId: existing?.fromAccountId || 'cash-main', toAccountId, category: category || integratedAccountName(toAccountId), meta: { ...clone(existing?.meta || {}), ...routing } }];
    }
    if (type === 'loanPayment') {
        const principal = Number(data.get('principal')) || 0, interest = Number(data.get('interest')) || 0, liabilityId = String(data.get('liabilityId') || ''), rows = [];
        const principalId = editingId && existing?.type === 'debtPrincipal' ? editingId : uid('igl'), interestId = editingId && existing?.type === 'debtInterest' ? editingId : uid('igl');
        if (principal > 0)
            rows.push({ ...base, id: principalId, type: 'debtPrincipal', amount: principal, fromAccountId: 'cash-main', liabilityId, category: existing?.type === 'debtPrincipal' ? category : '대출 원금상환' });
        if (interest > 0)
            rows.push({ ...base, id: interestId, type: 'debtInterest', amount: interest, fromAccountId: 'cash-main', liabilityId, category: existing?.type === 'debtInterest' ? category : '대출 이자' });
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
    const rows = integratedCandidatesFromForm(form), editingId = form.dataset.editId || '', existing = integratedStore().ledger.find(t => t.id === editingId);
    if (existing?.productId && integratedUiType(existing) !== String(new FormData(form).get('uiType') || form.dataset.systemType || '')) {
        formShowError(form, '금융상품에 연결된 거래는 기존 유형을 유지해 주세요.');
        return;
    }
    if (existing?.productId && rows.some(row => row.toAccountId !== existing.toAccountId || row.fromAccountId !== existing.fromAccountId || row.liabilityId !== existing.liabilityId)) {
        formShowError(form, '금융상품에 연결된 계좌·대출은 해당 상품 화면에서 관리해 주세요.');
        return;
    }
    if (editingId)
        for (const event of state.financialProducts?.events || []) {
            if (event.meta?.ledgerId !== editingId)
                continue;
            const row = rows[0];
            if (!row)
                continue;
            const error = financeProductEventError({ ...event, date: row.date, amount: row.amount, note: row.note });
            if (error) {
                formShowError(form, error);
                return;
            }
        }
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
    const before = clone(integratedStore()), previousEvents = state.financialProducts ? clone(state.financialProducts.events) : null;
    if (editingId)
        integratedStore().ledger = integratedStore().ledger.filter(t => t.id !== editingId);
    if (editingId && state.financialProducts)
        for (const event of state.financialProducts.events) {
            if (event.meta?.ledgerId !== editingId)
                continue;
            const row = rows[0];
            event.date = row.date;
            event.amount = row.amount;
            event.note = row.note;
        }
    integratedStore().ledger.push(...rows);
    integratedStore().mode = 'live';
    integratedStore().label = '내 통합 거래기록';
    setting().integratedMonth = integratedMonthKey(rows[0].date || '');
    integratedLedgerSearch = '';
    integratedSearchDisplayLimit = 50;
    setting().integratedLedgerFilter = 'all';
    setting().integratedLedgerCategory = '';
    const entry = integratedFormEntryPreset(form), favorite = integratedFormEntryPreset(form, true);
    if (!editingId && !form.dataset.systemType && entry) {
        setting().integratedEntryLast = entry;
        if (new FormData(form).get('saveFavorite') && favorite) {
            const entries = integratedEntryFavorites().filter(item => JSON.stringify(item) !== JSON.stringify(favorite));
            setting().integratedEntryFavorites = [favorite, ...entries].slice(0, 8);
        }
    }
    if (!(await persist())) {
        state.integrated = before;
        if (state.financialProducts && previousEvents)
            state.financialProducts.events = previousEvents;
        return;
    }
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
    setting().integratedLedgerCategory = '';
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
    const linkedPayment = !!tx.meta?.scheduleId && !!tx.meta?.scheduleDate;
    const message = linkedPayment ? `${tx.date} · 연결된 이번 납부의 원금·이자를 함께 삭제하고 일정을 미완료로 되돌립니다. 다른 회차는 유지합니다.` : `${tx.date} · ${tx.category || integratedTxLabel(tx)} 기록을 삭제합니다. 관련 합계가 즉시 다시 계산됩니다.`;
    showDialog({ title: linkedPayment ? '이번 납부 기록을 삭제할까요?' : '이 거래를 삭제할까요?', message, confirmText: '삭제', cancelText: '취소', danger: true }, async () => {
        const store = integratedStore(), before = clone(store), events = state.financialProducts?.events, previousEvents = events ? clone(events) : null;
        const removed = store.ledger.filter(t => t.id === id || (linkedPayment && t.meta?.scheduleId === tx.meta?.scheduleId && t.meta?.scheduleDate === tx.meta?.scheduleDate)), ids = new Set(removed.map(t => t.id));
        store.ledger = store.ledger.filter(t => !ids.has(t.id));
        const issues = integratedCandidateIssues(store);
        if (issues.length) {
            state.integrated = before;
            toast('삭제하면 잔액이 맞지 않아 취소했습니다.');
            return;
        }
        if (state.financialProducts && events)
            state.financialProducts.events = events.filter(e => !ids.has(String(e.meta?.ledgerId || '')));
        store.mode = 'live';
        store.label = '내 통합 거래기록';
        if (!(await persist())) {
            state.integrated = before;
            if (state.financialProducts && previousEvents)
                state.financialProducts.events = previousEvents;
            return;
        }
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
    const classificationSource = integratedStore().ledger.find(x => x.id === (tx.type === 'refund' ? tx.meta?.refundOf : tx.id) && ['expense', 'externalExpense'].includes(x.type || ''));
    const display = integratedTransactionDisplay(tx);
    $('#sheetEyebrow').textContent = '통합 · 거래';
    $('#sheetTitle').textContent = display.item;
    const sourceBox = tx.meta?.cardPlanId ? '<div class="source-note">카드 구매·청구·납부에 연결된 기록입니다.</div><button class="diagnostic-action" data-linked-card>카드 구매·납부 보기</button>' : tx.readonly ? `<div class="source-note">${tx.sourceModule === 'isa' ? 'ISA' : '개인연금'}의 실제 기록을 자동으로 읽은 거래입니다. 통합에서 중복 수정하지 않습니다.</div><button class="diagnostic-action" data-linked-source="${escapeHtml(tx.sourceModule)}">원본 화면 열기</button>` : productLinkedManaged ? `<div class="source-note">금융상품과 연결된 거래입니다. 통합에서 따로 수정하면 상품 잔액과 어긋날 수 있어 상품 화면에서 관리합니다.</div><button class="diagnostic-action" data-linked-product="${escapeHtml(tx.productId)}">금융상품 열기</button>` : `<div class="integrated-detail-note">수정·삭제하면 통합 수치가 즉시 다시 계산됩니다.</div><div class="integrated-detail-actions"><button data-integrated-edit="${escapeHtml(tx.id || '')}">수정</button><button class="danger" data-integrated-delete-detail="${escapeHtml(tx.id || '')}">삭제</button></div>`;
    $('#sheetBody').innerHTML = `<div class="sheetrows"><div class="sheetrow"><span>분류</span><strong data-transaction-category>${escapeHtml(display.category)}</strong></div><div class="sheetrow"><span>날짜</span><strong>${escapeHtml(tx.date)}</strong></div><div class="sheetrow"><span>유형</span><strong>${escapeHtml(integratedTxLabel(tx))}</strong></div><div class="sheetrow"><span>금액</span><strong>${tx.type === 'adjustment' ? signed(Number(tx.delta) || 0) : won(tx.amount)}</strong></div>${integratedTxAccountsText(tx) ? `<div class="sheetrow"><span>계좌</span><strong>${escapeHtml(integratedTxAccountsText(tx))}</strong></div>` : ''}${tx.note ? `<div class="sheetrow"><span>메모</span><strong>${escapeHtml(tx.note)}</strong></div>` : ''}</div>${sourceBox}${classificationSource ? '<button class="diagnostic-action" data-transaction-classify>이름·분류 수정</button>' : ''}${integratedEntryPresetFromRecord(tx) ? '<button class="diagnostic-action" data-entry-copy>이 기록 복사</button>' : ''}${!tx.meta?.cardPlanId && ['expense', 'externalExpense'].includes(tx.type || '') ? `<button class="diagnostic-action" data-refund="${escapeHtml(tx.id || '')}">환불·부분취소</button>` : ''}`;
    openSheet('#detailSheet');
    $('[data-linked-card]')?.addEventListener('click', () => openCardLedgerDetail(String(tx.meta?.cardPlanId)));
    $('[data-transaction-classify]')?.addEventListener('click', () => { if (classificationSource)
        openSpendingClassification([String(classificationSource.id)], String(tx.date).slice(0, 7), String(tx.meta?.cardPlanId || '')); });
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
        setting().integratedLedgerCategory = '';
        integratedLedgerSearch = '';
        integratedSearchDisplayLimit = 50;
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
;
/* asset-os source: ui-sheets.js */
'use strict';
let lockedScrollY = 0;
let activeSheetId = '';
let sheetReturnTo = null;
let parentSheetId = '';
let parentSheetScrollTop = 0;
let sheetMode = 'view';
let sheetDirty = false;
let sheetHistoryActive = false;
let suppressSheetPop = false;
let pendingScrollRestore = null;
let sheetBackTimer;
let dialogConfirmAction = null;
let dialogCancelAction = null;
function lockPage() {
    if (document.body.classList.contains('sheet-open'))
        return;
    lockedScrollY = window.scrollY || 0;
    document.body.classList.add('sheet-open');
    document.body.style.position = 'fixed';
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
}
function unlockPage() {
    if (!document.body.classList.contains('sheet-open'))
        return;
    document.body.classList.remove('sheet-open');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    window.scrollTo(0, lockedScrollY);
}
try {
    history.scrollRestoration = 'manual';
}
catch { }
function showDialog({ title = '확인', message = '', confirmText = '확인', cancelText = '취소', danger = false, oneButton = false } = {}, onConfirm = null, onCancel = null) {
    dialogConfirmAction = onConfirm;
    dialogCancelAction = onCancel;
    $('#confirmTitle').textContent = title;
    $('#confirmMessage').textContent = message;
    $('#confirmOk').textContent = confirmText;
    $('#confirmOk').className = danger ? 'danger' : 'primary';
    $('#confirmCancel').textContent = cancelText;
    $('#confirmCancel').hidden = oneButton;
    $('#confirmActions').className = 'dialog-actions' + (oneButton ? ' one' : '');
    $('#dialogScrim').hidden = false;
    $('#confirmDialog').hidden = false;
    setTimeout(() => $('#confirmOk').focus(), 0);
}
function hideDialog(runCancel = false) {
    $('#dialogScrim').hidden = true;
    $('#confirmDialog').hidden = true;
    const cb = runCancel ? dialogCancelAction : null;
    dialogConfirmAction = null;
    dialogCancelAction = null;
    if (cb)
        cb();
}
function showNotice(title, message, onOk = null) {
    showDialog({ title, message, confirmText: '확인', oneButton: true }, onOk);
}
function requestCloseSheets(_reason = 'dismiss', fromPop = false) {
    if (!$$('.sheet.open').length)
        return;
    if (sheetMode === 'input' && sheetDirty) {
        showDialog({ title: '작성 내용을 닫을까요?', message: '저장하지 않은 변경사항이 사라집니다.', confirmText: '변경사항 버리기', cancelText: '계속 작성', danger: true }, () => {
            holdingRegistrationDraft = activeSheetId === '#registerSheet' ? null : holdingRegistrationDraft;
            closeSheets({ fromPop });
        }, () => {
            if (fromPop) {
                history.pushState({ assetOsSheet: true }, '', location.href);
                sheetHistoryActive = true;
            }
        });
        return;
    }
    closeSheets({ fromPop });
}
function resetSheetPosition(sheet) {
    sheet.classList.remove('dragging');
    sheet.style.transition = '';
    sheet.style.transform = '';
    $('#scrim').style.opacity = '';
}
function resetSheetScroll(sheet) {
    const top = () => {
        sheet.scrollTop = 0;
        try {
            sheet.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        }
        catch { }
    };
    top();
    requestAnimationFrame(() => { top(); requestAnimationFrame(top); });
}
let sheetInteractionVersion = 0;
function sheetInteractionToken() { return sheetInteractionVersion; }
function openSheet(id, options = {}) {
    sheetInteractionVersion++;
    sheetReturnTo = options.returnTo || null;
    const previous = activeSheetId, wasOpen = $$('.sheet.open').length > 0;
    if (previous === '#profileSheet' && id !== '#profileSheet') {
        parentSheetId = '#profileSheet';
        parentSheetScrollTop = $('#profileSheet').scrollTop;
    }
    $$('.sheet.open').forEach((sheet) => {
        sheet.classList.remove('open');
        sheet.setAttribute('aria-hidden', 'true');
        resetSheetPosition(sheet);
    });
    $('#scrim').hidden = false;
    lockPage();
    const sheet = $(id);
    sheet.dataset.variant = options.variant || '';
    sheet.classList.add('open');
    sheet.setAttribute('aria-hidden', 'false');
    resetSheetScroll(sheet);
    activeSheetId = id;
    sheetMode = options.mode || (['#formSheet', '#registerSheet'].includes(id) ? 'input' : 'view');
    sheetDirty = Boolean(options.dirty);
    if (!wasOpen && !sheetHistoryActive) {
        history.pushState({ assetOsSheet: true }, '', location.href);
        sheetHistoryActive = true;
    }
}
function closeSheets(options = {}) {
    sheetInteractionVersion++;
    const returnTo = sheetReturnTo;
    sheetReturnTo = null;
    if (returnTo && !options.all) {
        if (options.fromPop) {
            history.pushState({ assetOsSheet: true }, '', location.href);
            sheetHistoryActive = true;
        }
        sheetDirty = false;
        returnTo();
        return;
    }
    const had = $$('.sheet.open').length > 0, restoreY = lockedScrollY;
    if (parentSheetId && activeSheetId !== parentSheetId && !options.all) {
        $$('.sheet.open').forEach((sheet) => {
            sheet.classList.remove('open');
            sheet.setAttribute('aria-hidden', 'true');
            resetSheetPosition(sheet);
        });
        const parent = $(parentSheetId), scrollTop = parentSheetScrollTop;
        parentSheetId = '';
        parentSheetScrollTop = 0;
        parent.scrollTop = scrollTop;
        parent.dataset.variant = '';
        parent.classList.add('open');
        parent.setAttribute('aria-hidden', 'false');
        activeSheetId = '#profileSheet';
        sheetMode = 'view';
        sheetDirty = false;
        $('#scrim').hidden = false;
        if (options.fromPop) {
            history.pushState({ assetOsSheet: true }, '', location.href);
            sheetHistoryActive = true;
        }
        return;
    }
    $$('.sheet.open').forEach((sheet) => {
        sheet.classList.remove('open');
        sheet.setAttribute('aria-hidden', 'true');
        resetSheetPosition(sheet);
    });
    $('#scrim').hidden = true;
    activeSheetId = '';
    parentSheetId = '';
    parentSheetScrollTop = 0;
    sheetMode = 'view';
    sheetDirty = false;
    if (had)
        unlockPage();
    if (sheetHistoryActive && !options.fromPop) {
        sheetHistoryActive = false;
        suppressSheetPop = true;
        pendingScrollRestore = restoreY;
        clearTimeout(sheetBackTimer);
        sheetBackTimer = setTimeout(() => {
            sheetBackTimer = undefined;
            history.back();
        }, 0);
    }
    else if (options.fromPop) {
        sheetHistoryActive = false;
        requestAnimationFrame(() => window.scrollTo(0, restoreY));
    }
}
function cancelSheetBackForNavigation() {
    if (!sheetBackTimer)
        return;
    clearTimeout(sheetBackTimer);
    sheetBackTimer = undefined;
    suppressSheetPop = false;
    pendingScrollRestore = null;
    try {
        history.replaceState(null, '', location.href);
    }
    catch { }
}
function enableSheetDrag(sheet) {
    const zone = sheet.querySelector('.sheet-drag-zone');
    if (!zone)
        return;
    let active = false, startY = 0, lastY = 0, lastT = 0, delta = 0, velocity = 0;
    const begin = (y) => {
        if (!sheet.classList.contains('open') || sheet.scrollTop > 2)
            return;
        active = true;
        startY = lastY = y;
        lastT = performance.now();
        delta = 0;
    };
    const move = (y) => {
        if (!active)
            return false;
        const dy = y - startY;
        if (dy < 12)
            return false;
        sheet.classList.add('dragging');
        const now = performance.now();
        velocity = (y - lastY) / Math.max(1, now - lastT);
        lastY = y;
        lastT = now;
        delta = dy;
        sheet.style.transform = `translate3d(-50%,${dy}px,0)`;
        $('#scrim').style.opacity = String(Math.max(.28, 1 - dy / (innerHeight * .85)));
        return true;
    };
    const end = () => {
        if (!active)
            return;
        active = false;
        if (delta > 110 || velocity > .75) {
            resetSheetPosition(sheet);
            requestCloseSheets('drag');
            return;
        }
        resetSheetPosition(sheet);
    };
    zone.addEventListener('pointerdown', (event) => begin(event.clientY));
    zone.addEventListener('pointermove', (event) => { if (active && move(event.clientY))
        event.preventDefault(); });
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    zone.addEventListener('touchstart', (event) => begin(event.touches[0].clientY), { passive: true });
    zone.addEventListener('touchmove', (e) => { if (active && move(e.touches[0].clientY))
        e.preventDefault(); }, { passive: false });
    zone.addEventListener('touchend', end, { passive: true });
    zone.addEventListener('touchcancel', end, { passive: true });
}
$$('.sheet').forEach((sheet) => enableSheetDrag(sheet));
;
/* asset-os source: chart-financial-growth.js */
'use strict';
let financialGrowthPeriod = '6m', financialGrowthSelectedKey = '';
function financeCompactSigned(v) { const n = Number(v) || 0, s = n < 0 ? '-' : ''; return s + pensionCompactWon(Math.abs(n)); }
function financialDebtChangeView(reduction) { const n = Number(reduction) || 0; return n > 0 ? { label: '부채 감소', amount: n, negative: false } : n < 0 ? { label: '부채 증가', amount: Math.abs(n), negative: true } : { label: '부채 변동', amount: 0, negative: false }; }
function financeAxisRange(values) { const nums = values.map(Number).filter(Number.isFinite); if (!nums.length)
    return { min: -1, max: 1 }; let low = Math.min(...nums), high = Math.max(...nums); if (low === high) {
    const pad = Math.max(Math.abs(low) * .12, 1000);
    low -= pad;
    high += pad;
} const span = Math.max(1, high - low), pad = span * .15; return { min: low - pad, max: high + pad }; }
function financialGrowthChartModel(period) { const rows = financialGrowthSeries(period), W = 320, H = 166, L = 48, R = 9, T = 12, B = 25, CW = W - L - R, CH = H - T - B, axis = financeAxisRange(rows.map(x => x.netAssets)), range = Math.max(1, axis.max - axis.min), pts = rows.map((r, i) => ({ ...r, key: String(r.asOf || r.label || i), x: L + (rows.length <= 1 ? CW : i / (rows.length - 1) * CW), y: T + CH - ((r.netAssets - axis.min) / range) * CH, label: String(r.label || ''), netAssets: Number(r.netAssets) || 0 })); return { rows, W, H, L, R, T, B, CW, CH, axis, pts }; }
function financialGrowthChartMarkup(period) { const c = financialGrowthChartModel(period), selected = c.pts.find(p => p.key === financialGrowthSelectedKey) || c.pts.at(-1), path = `M ${c.pts.map((p, i) => `${i ? 'L' : ' '}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')}`, ticks = Array.from({ length: 4 }, (_, i) => c.axis.max - (c.axis.max - c.axis.min) * i / 3), xt = new Set([0, Math.floor((c.pts.length - 1) / 2), c.pts.length - 1]), zeroY = c.axis.min < 0 && c.axis.max > 0 ? c.T + c.CH - ((0 - c.axis.min) / (c.axis.max - c.axis.min)) * c.CH : null; financialGrowthSelectedKey = selected.key; return `<div class="finance-growth-focus"><span id="financialGrowthPointLabel">${escapeHtml(selected.label)}</span><strong id="financialGrowthPointValue">${won(selected.netAssets)}</strong><small>순금융자산</small></div><div class="finance-growth-chart-wrap"><svg id="financialGrowthChart" class="finance-growth-chart" viewBox="0 0 ${c.W} ${c.H}" role="img" aria-label="순금융자산 추이">${ticks.map((v, i) => { const y = c.T + c.CH * i / 3; return `<line class="finance-growth-gridline" x1="${escapeHtml(c.L)}" x2="${escapeHtml(c.W - c.R)}" y1="${escapeHtml(y)}" y2="${escapeHtml(y)}"></line><text class="finance-growth-axis" x="${escapeHtml(c.L - 5)}" y="${escapeHtml(y + 3)}" text-anchor="end">${financeCompactSigned(v)}</text>`; }).join('')}${zeroY != null ? `<line class="finance-growth-zero" x1="${escapeHtml(c.L)}" x2="${escapeHtml(c.W - c.R)}" y1="${escapeHtml(zeroY)}" y2="${escapeHtml(zeroY)}"></line>` : ''}<path class="finance-growth-line" d="${escapeHtml(path)}"></path>${c.pts.map((p, i) => xt.has(i) ? `<text class="finance-growth-axis" x="${escapeHtml(p.x)}" y="${escapeHtml(c.H - 5)}" text-anchor="${escapeHtml(i === 0 ? 'start' : i === c.pts.length - 1 ? 'end' : 'middle')}">${escapeHtml(p.label)}</text>` : '').join('')}<line id="financialGrowthMarkerLine" class="finance-growth-marker-line" x1="${escapeHtml(selected.x)}" x2="${escapeHtml(selected.x)}" y1="${escapeHtml(c.T)}" y2="${escapeHtml(c.T + c.CH)}"></line><circle id="financialGrowthMarkerDot" class="finance-growth-dot" cx="${escapeHtml(selected.x)}" cy="${escapeHtml(selected.y)}" r="4.5"></circle><rect class="finance-growth-track" data-growth-track x="${escapeHtml(c.L)}" y="${escapeHtml(c.T)}" width="${escapeHtml(c.CW)}" height="${escapeHtml(c.CH + 8)}" tabindex="0" role="slider" aria-label="기간별 순금융자산 확인"></rect></svg></div>`; }
function updateFinancialGrowthPoint(clientX) { const track = $('[data-growth-track]'); if (!track)
    return; const c = financialGrowthChartModel(financialGrowthPeriod), rect = track.getBoundingClientRect(), ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width))), pt = c.pts[Math.max(0, Math.min(c.pts.length - 1, Math.round(ratio * (c.pts.length - 1))))]; financialGrowthSelectedKey = pt.key; $('#financialGrowthMarkerLine')?.setAttribute('x1', pt.x.toFixed(1)); $('#financialGrowthMarkerLine')?.setAttribute('x2', pt.x.toFixed(1)); $('#financialGrowthMarkerDot')?.setAttribute('cx', pt.x.toFixed(1)); $('#financialGrowthMarkerDot')?.setAttribute('cy', pt.y.toFixed(1)); if ($('#financialGrowthPointLabel'))
    $('#financialGrowthPointLabel').textContent = pt.label; if ($('#financialGrowthPointValue'))
    $('#financialGrowthPointValue').textContent = won(pt.netAssets); }
function bindFinancialGrowthAnalysis() { const track = $('[data-growth-track]'); if (!track)
    return; let active = false, pointerId = null; const pick = (e) => { active = true; pointerId = e.pointerId; e.preventDefault(); e.stopPropagation(); try {
    track.setPointerCapture(pointerId);
}
catch { } updateFinancialGrowthPoint(e.clientX); }, move = (e) => { if (!active || e.pointerId !== pointerId)
    return; e.preventDefault(); e.stopPropagation(); updateFinancialGrowthPoint(e.clientX); }, end = (e) => { if (!active)
    return; updateFinancialGrowthPoint(e.clientX); active = false; try {
    track.releasePointerCapture(pointerId ?? e.pointerId);
}
catch { } pointerId = null; }; track.style.touchAction = 'none'; track.onpointerdown = pick; track.onpointermove = move; track.onpointerup = end; track.onpointercancel = end; track.onkeydown = (e) => { const c = financialGrowthChartModel(financialGrowthPeriod), i = Math.max(0, c.pts.findIndex(p => p.key === financialGrowthSelectedKey)), next = e.key === 'ArrowLeft' ? Math.max(0, i - 1) : e.key === 'ArrowRight' ? Math.min(c.pts.length - 1, i + 1) : -1; if (next < 0)
    return; e.preventDefault(); const rect = track.getBoundingClientRect(); updateFinancialGrowthPoint(rect.left + (c.pts[next].x - c.L) / Math.max(1, c.CW) * rect.width); }; }
function openFinancialGrowthAnalysis(period = financialGrowthPeriod) { const nextPeriod = ['3m', '6m', '1y', '3y', 'all'].includes(period) ? period : '6m'; if (nextPeriod !== financialGrowthPeriod)
    financialGrowthSelectedKey = ''; financialGrowthPeriod = nextPeriod; const end = localYmd(), start = financialAnalysisStart(financialGrowthPeriod, end), a = financialGrowthBreakdown(start, end), debtChange = financialDebtChangeView(a.debtReduction), labels = { '3m': '3개월', '6m': '6개월', '1y': '1년', '3y': '3년', 'all': '전체' }; $('#sheetEyebrow').textContent = '통합 · 자산분석'; $('#sheetTitle').textContent = '순금융자산 변화'; $('#sheetBody').innerHTML = `<div class="finance-growth-periods">${Object.entries(labels).map(([k, v]) => `<button class="${escapeHtml(financialGrowthPeriod === k ? 'active' : '')}" data-growth-period="${escapeHtml(k)}">${v}</button>`).join('')}</div><div class="finance-growth-grid"><div class="finance-growth-box primary"><span>순금융자산 변화</span><strong class="${escapeHtml(a.netChange < 0 ? 'negative' : 'positive')}">${a.comparable === false ? '비교 불가' : signed(a.netChange)}</strong></div><div class="finance-growth-box"><span>총금융자산 변화</span><strong class="${escapeHtml(a.assetChange < 0 ? 'negative' : 'positive')}">${a.comparable === false ? '비교 불가' : signed(a.assetChange)}</strong></div><div class="finance-growth-box"><span>${debtChange.label}</span><strong${debtChange.negative ? ' class="negative"' : ''}>${a.comparable === false ? '비교 불가' : won(debtChange.amount)}</strong></div><div class="finance-growth-box"><span>순자산 증가율</span><strong>${a.rate == null ? '기준 없음' : pct(a.rate)}</strong></div></div>${a.start && a.end ? `<div class="finance-growth-note">비교 기간 ${escapeHtml(a.start.asOf)} ~ ${escapeHtml(a.end.asOf)}${a.comparable === false ? ' · 비교할 기록이 부족합니다.' : ''}</div>` : ''}${financialGrowthChartMarkup(financialGrowthPeriod)}<div class="finance-growth-breakdown"><div class="finance-growth-breakdown-row"><span>외부 순유입·지출</span><strong>${a.comparable === false ? '비교 불가' : signed(a.externalNet)}</strong></div><div class="finance-growth-breakdown-row"><span>평가·기타 변동</span><strong>${a.comparable === false ? '비교 불가' : signed(a.residual)}</strong></div>${(a.adjustmentDetails || []).map(row => `<div class="finance-growth-breakdown-row"><span>${escapeHtml(row.label)}</span><strong>${signed(row.amount)}</strong></div>`).join('') || (Math.abs(a.adjustment) > .5 ? `<div class="finance-growth-breakdown-row"><span>잔액 조정</span><strong>${signed(a.adjustment)}</strong></div>` : '')}</div><div class="finance-growth-note">그래프를 좌우로 움직이면 시점별 순금융자산을 볼 수 있습니다.</div>`; openSheet('#detailSheet'); $$('[data-growth-period]').forEach(b => b.onclick = () => openFinancialGrowthAnalysis((b.dataset.growthPeriod || ''))); bindFinancialGrowthAnalysis(); }
function homeOutgoingGroupRows(group, activity) { const accounts = new Map(integratedStore().accounts.map(a => [a.id, a])), matches = group === 'living' ? (t) => ['expense', 'externalExpense'].includes(t.type) : group === 'saving' ? (t) => ['internalTransfer', 'externalAssetIn'].includes(t.type) && ['isa', 'pension', 'irp', 'deposit', 'savings'].includes(accounts.get(t.toAccountId || '')?.kind || '') : group === 'loan' ? (t) => ['debtInterest', 'debtInterestExternal', 'debtPrincipal', 'externalDebtPrincipal'].includes(t.type) : (t) => ['externalWithdrawal', 'externalAssetOut'].includes(t.type), map = new Map(); for (const t of activity.rows.filter(matches)) {
    const key = String(t.category || integratedTxLabel(t) || '기타'), row = map.get(key) || { name: key, amount: 0 };
    row.amount += Number(t.amount) || 0;
    map.set(key, row);
} return [...map.values()].sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'ko')); }
function bindHomeOutgoingSummary(activity) { $$('[data-home-outgoing-group]').forEach(b => b.onclick = () => openHomeOutgoingGroup((b.dataset.homeOutgoingGroup || '') || '', activity)); $('[data-home-outgoing-back]')?.addEventListener('click', () => openDetail('contribution')); }
function openHomeOutgoingGroup(group, activity = homeMonthActivity()) { const labels = { living: '생활비·고정지출', saving: '저축·투자', loan: '대출 원금·이자', other: '기타 출금', remaining: '남은 일정' }, rows = group === 'remaining' ? activity.remaining.map((o) => ({ name: o.schedule.name, amount: Number(o.schedule.amount) || 0 })) : homeOutgoingGroupRows(group, activity); $('#sheetEyebrow').textContent = '이번 달'; $('#sheetTitle').textContent = labels[group] || '이번 달 내역'; $('#sheetBody').innerHTML = `<div class="sheetrows">${rows.length ? rows.map((r) => `<div class="sheetrow"><span>${escapeHtml(r.name)}</span><strong>${won(r.amount)}</strong></div>`).join('') : '<div class="empty-state"><span>해당 내역이 없습니다.</span></div>'}</div><button class="diagnostic-action" data-home-outgoing-back>이달 요약으로</button>`; bindHomeOutgoingSummary(activity); }
function openDetail(type) { const a = currentAccount(), m = type === 'isa-home' ? activeMetrics() : { profit: 0, rate: 0, holdings: [] }; $('#sheetEyebrow').textContent = '상세'; $('#sheetTitle').textContent = type === 'total' ? '금융자산·부채 상세' : type === 'isa-home' ? 'ISA 투자손익' : type === 'pension' ? '개인연금 투자손익' : type === 'cash' ? '현금·예적금 상세' : '이번 달 지출·납입'; if (type === 'isa-home') {
    $('#sheetBody').innerHTML = `<div class="profitbox"><div class="metric"><span>평가손익</span><strong class="${escapeHtml(m.profit >= 0 ? 'positive' : '')}">${signed(m.profit)}</strong></div><div class="metric"><span>수익률</span><strong class="${escapeHtml(m.rate >= 0 ? 'positive' : '')}">${pct(m.rate)}</strong></div></div><div class="sheetrows"><div class="sheetrow"><span>현재 합산 ISA 평가액</span><strong>${won(m.value)}</strong></div><div class="sheetrow"><span>보유종목</span><strong>${m.holdings.length}개</strong></div><div class="sheetrow"><span>이전 ISA</span><strong>${state.accounts.filter(isPastAccount).length}개 회차</strong></div></div><button class="diagnostic-action" data-go-isa>ISA 열기</button>`;
    openSheet('#detailSheet');
    $('[data-go-isa]').onclick = () => nav('isa');
    return;
} const s = homeSample(); if (type === 'total')
    $('#sheetBody').innerHTML = `<div class="sheetrows"><div class="sheetrow"><span>보유 금융자산</span><strong>${won(s.total)}</strong></div><div class="sheetrow"><span>대출·부채 차감</span><strong>${s.debt > 0 ? '-' : ''}${won(s.debt)}</strong></div><div class="sheetrow total"><span>순금융자산</span><strong>${won(s.total - s.debt)}</strong></div></div>${homeChangeDetailMarkup()}<button class="diagnostic-action" data-financial-growth>순금융자산 변화 ›</button>`;
else if (type === 'pension') {
    const pm = pensionAssetMetrics('all'), income = pensionIncomeSummary('all'), proj = pensionProjection();
    $('#sheetBody').innerHTML = `<div class="profitbox"><div class="metric"><span>평가손익</span><strong class="${escapeHtml(pm.profit >= 0 ? 'positive' : '')}">${signed(pm.profit)}</strong></div><div class="metric"><span>수익률</span><strong class="${escapeHtml(pm.rate >= 0 ? 'positive' : '')}">${pct(pm.rate)}</strong></div></div><div class="sheetrows"><div class="sheetrow"><span>현재 평가자산</span><strong>${won(pm.value)}</strong></div><div class="sheetrow"><span>투자원금</span><strong>${won(pm.cost)}</strong></div><div class="sheetrow"><span>보유 종목</span><strong>${pm.holdings.length}개</strong></div><div class="sheetrow"><span>연금 계좌</span><strong>${pm.accounts}개</strong></div><div class="sheetrow"><span>올해 배당·이자</span><strong>${won(income.yearTotal)}</strong></div><div class="sheetrow"><span>${proj.retirementAge}세 예상 월연금</span><strong>${won(proj.monthlyPension)}</strong></div></div><div class="form-actions"><button type="button" class="form-btn" data-go-pension-assets>자산 보기</button><button type="button" class="form-btn primary" data-go-pension-future>미래연금</button></div>`;
    $('[data-go-pension-assets]')?.addEventListener('click', () => nav('pension', 'assets'));
    $('[data-go-pension-future]')?.addEventListener('click', () => nav('pension', 'future'));
}
else if (type === 'cash') {
    const f = integratedFinancialModel();
    $('#sheetBody').innerHTML = `<div class="sheetrows"><div class="sheetrow"><span>현금·입출금</span><strong>${won(f.cash)}</strong></div><div class="sheetrow"><span>예금</span><strong>${won(f.deposit)}</strong></div><div class="sheetrow"><span>적금</span><strong>${won(f.savings)}</strong></div></div><div class="source-note">조회 화면입니다. 상품 조건 변경은 프로필 → 제도·상품 관리에서만 합니다.</div><button class="diagnostic-action" data-go-integrated>통합에서 자세히 보기</button>`;
    $('[data-go-integrated]')?.addEventListener('click', () => nav('integrated', 'summary'));
}
else {
    const activity = s.activity;
    $('#sheetBody').innerHTML = `<div class="sheetrows home-outgoing-groups"><button class="sheetrow" data-home-outgoing-group="living"><span>생활비·고정지출</span><strong>${won(activity.living)} ›</strong></button><button class="sheetrow" data-home-outgoing-group="saving"><span>저축·투자</span><strong>${won(activity.saving)} ›</strong></button><button class="sheetrow" data-home-outgoing-group="loan"><span>대출 원금·이자</span><strong>${won(activity.loan)} ›</strong></button><button class="sheetrow" data-home-outgoing-group="other"><span>기타 출금</span><strong>${won(activity.other)} ›</strong></button><button class="sheetrow" data-home-outgoing-group="remaining"><span>남은 일정</span><strong>${activity.remaining.length}건 ›</strong></button><div class="sheetrow"><span>기록된 금액</span><strong>${won(activity.total)}</strong></div><div class="sheetrow"><span>남은 예정금액</span><strong>${won(activity.remainingAmount)}</strong></div><div class="sheetrow total"><span>이번 달 합계</span><strong>${won(activity.total + activity.remainingAmount)}</strong></div></div>`;
} openSheet('#detailSheet'); if (type === 'total')
    $('[data-financial-growth]')?.addEventListener('click', () => openFinancialGrowthAnalysis('6m')); if (type === 'contribution')
    bindHomeOutgoingSummary(s.activity); }
function openHolding(id) { const a = currentAccount(), h = getHolding(a, id), ds = dividends(a).filter((d) => d.holdingId === id), txs = a.transactions.filter((t) => t.holdingId === id).sort((x, y) => String(y.date || '').localeCompare(String(x.date || ''))).slice(0, 4), p = holdingCostValue(h), profit = h.marketValue - p, rate = p ? profit / p * 100 : 0; $('#sheetEyebrow').textContent = escapeHtml(h.assetClass); $('#sheetTitle').textContent = h.name; $('#sheetBody').innerHTML = `<div class="profitbox"><div class="metric"><span>평가금액</span><strong>${won(h.marketValue)}</strong></div><div class="metric"><span>평가손익</span><strong class="${escapeHtml(profit >= 0 ? 'positive' : '')}">${signed(profit)}</strong></div></div>${a.status === 'active' ? '<div class="form-actions"><button class="form-btn" data-h-buy>매수</button><button class="form-btn primary" data-h-sell>매도</button></div>' : `<div class="lock-note">${a.status === 'maturity_pending' ? '만기 처리 대기 중인 현재 종목입니다.' : '만기 완료 계좌의 보관 종목입니다.'} 새 거래는 입력할 수 없습니다.</div>`}<div class="sheetrows"><div class="sheetrow"><span>보유수량</span><strong>${holdingQuantityText(h)}</strong></div><div class="sheetrow"><span>평균단가</span><strong>${won(h.avgPrice)}${h.quantityUnit === 'face' ? ' / 액면 1만원' : ''}</strong></div><div class="sheetrow"><span>현재가</span><strong>${won(h.currentPrice)}${h.quantityUnit === 'face' ? ' / 액면 1만원' : ''}</strong></div><div class="sheetrow"><span>투자원금</span><strong>${won(p)}</strong></div><div class="sheetrow"><span>수익률</span><strong>${pct(rate)}</strong></div><div class="sheetrow"><span>받은 배당·이자</span><strong>${won(ds.reduce((s, d) => s + dividendNetAmount(d), 0))}</strong></div>${h.instrumentCode ? `<div class="sheetrow"><span>${h.quoteSource === 'kis' ? '시세 연결' : '종목코드'}</span><strong>${h.quoteSource === 'kis' ? 'KIS · ' : ''}${escapeHtml(h.instrumentCode)}</strong></div>` : ''}</div><section class="composition-holdings"><div class="sectionhead"><h2 style="font-size:15px">최근 거래</h2><button data-all-tx>전체 보기 ›</button></div><div class="transaction-list">${txs.map((t) => `<div class="transaction-row"><span class="rowcopy"><strong>${typeText(String(t.type || ''))}</strong><small>${formatDate(txDate(t))}</small></span>${transactionAmountMarkup(a, t)}</div>`).join('') || '<div class="empty-state"><span>거래내역이 없습니다.</span></div>'}</div></section>`; openSheet('#detailSheet'); $('[data-h-buy]')?.addEventListener('click', () => openTransactionForm('buy', null, id)); $('[data-h-sell]')?.addEventListener('click', () => openTransactionForm('sell', null, id)); $('[data-all-tx]').onclick = () => { closeSheets(); nav('isa', 'transactions'); }; }
;
/* asset-os source: isa-registration.js */
"use strict";
'use strict';
let holdingRegistrationDraft = null;
function emptyRegistrationItem() { return { id: uid('draft'), matchHoldingId: '', name: '', assetClass: '국내주식', qty: '', avg: '', price: '', instrumentCode: '', quoteType: 'stock', include: true }; }
function registrationDefaultMode(a) { return (a.holdings || []).length || (a.transactions || []).length ? 'cash' : 'baseline'; }
function registrationExistingHolding(item, a = currentAccount()) {
    if (item?.matchHoldingId) {
        const matched = a.holdings.find(h => h.id === item.matchHoldingId);
        if (matched)
            return matched;
    }
    const key = normalizeName(item?.name);
    return key ? a.holdings.find(h => normalizeName(h.name) === key) || null : null;
}
function openHoldingRegistration(options = {}) {
    const a = currentAccount();
    if (!isTradeableAccount(a))
        return toast(a.status === 'maturity_pending' ? '만기 처리 대기 중에는 보유내역을 변경할 수 없습니다.' : '종료된 ISA에는 보유내역을 등록할 수 없습니다.');
    if (!holdingRegistrationDraft || options.fresh !== false)
        holdingRegistrationDraft = { accountId: a.id, asOf: ymd(), mode: registrationDefaultMode(a), baselineCash: String(a.baselineCash || ''), baselineContribution: String(a.baselineContribution || ''), items: [], openedMetrics: accountMetrics(a) };
    if (options.addEmpty)
        holdingRegistrationDraft.items.push(emptyRegistrationItem());
    renderHoldingRegistration();
    openSheet('#registerSheet', { mode: 'input' });
    sheetDirty = holdingRegistrationDraft.items.length > 0;
}
function syncRegistrationDraft() {
    if (!holdingRegistrationDraft)
        return;
    const body = $('#registerBody');
    if (!body)
        return;
    holdingRegistrationDraft.asOf = body.querySelector('[name="registrationAsOf"]')?.value || holdingRegistrationDraft.asOf;
    holdingRegistrationDraft.mode = body.querySelector('[name="registrationMode"]')?.value || holdingRegistrationDraft.mode;
    holdingRegistrationDraft.baselineCash = body.querySelector('[name="baselineCash"]')?.value ?? holdingRegistrationDraft.baselineCash;
    holdingRegistrationDraft.baselineContribution = body.querySelector('[name="baselineContribution"]')?.value ?? holdingRegistrationDraft.baselineContribution;
    holdingRegistrationDraft.items = holdingRegistrationDraft.items.map(item => { const card = findDataElement(body, "data-registration-item", item.id); if (!card)
        return item; return { ...item, name: card.querySelector('[name="name"]')?.value || '', assetClass: card.querySelector('[name="assetClass"]')?.value || item.assetClass, qty: card.querySelector('[name="qty"]')?.value || '', avg: card.querySelector('[name="avg"]')?.value || '', price: card.querySelector('[name="price"]')?.value ?? '', instrumentCode: card.querySelector('[name="instrumentCode"]')?.value || '', quoteType: card.querySelector('[name="quoteType"]')?.value || '' }; });
}
function registrationSummary() {
    const a = currentAccount(), draft = holdingRegistrationDraft, items = draft.items.filter(x => String(x.name).trim()), classified = items.map(item => ({ item, existing: registrationExistingHolding(item, a) })), newItems = classified.filter(x => !x.existing).map(x => x.item), updates = classified.filter(x => x.existing).map(x => x.item), cost = newItems.reduce((sum, x) => sum + (Number(x.qty) || 0) * (Number(x.avg) || 0) / (x.quoteType === 'bond' || x.assetClass === '개별채권' ? 10000 : 1), 0), cash = draft.mode === 'baseline' ? (Number(draft.baselineCash) || 0) : accountMetrics(a).cash, valuationMissing = items.filter(x => String(x.price).trim() === '' && !registrationExistingHolding(x, a)?.currentPrice).length;
    return { items, newItems, updates, cost: draft.mode === 'baseline' ? 0 : cost, cash, valuationMissing };
}
function registrationSummaryMarkup() { const s = registrationSummary(); return `<div class="registration-summary"><div class="registration-summary-grid"><div><span>등록 항목</span><strong>${s.items.length}개</strong></div><div><span>신규 / 갱신</span><strong>${s.newItems.length} / ${s.updates.length}</strong></div><div><span>필요 현금</span><strong>${won(s.cost)}</strong></div></div><p>저장 후 예상 현금 ${won(s.cash - s.cost)} · 신규 종목만 현금을 사용하고 기존 종목 갱신은 잔고 조정으로 기록합니다.${s.valuationMissing ? ` 현재가 미입력 ${s.valuationMissing}개는 총평가액에 포함되지 않습니다.` : ''}</p></div>`; }
function updateRegistrationSummaryUI() {
    const current = $('#registerBody .registration-summary');
    if (!current)
        return;
    const wrap = document.createElement('div');
    wrap.innerHTML = registrationSummaryMarkup();
    if (wrap.firstElementChild)
        current.replaceWith(wrap.firstElementChild);
    const a = currentAccount();
    holdingRegistrationDraft.items.forEach(item => { const card = findDataElement($("#registerBody"), "data-registration-item", item.id), badge = card?.querySelectorAll('.registration-badge')?.[1]; if (!badge)
        return; const existing = registrationExistingHolding(item, a); badge.className = `registration-badge ${existing ? 'update' : 'new'}`; badge.textContent = existing ? '기존 종목 갱신' : '신규 종목'; });
}
function renderHoldingRegistration() {
    const d = holdingRegistrationDraft, a = currentAccount(), summary = registrationSummary();
    $('#registerBody').innerHTML = `<div class="registration-toolbar"><button class="primary" data-registration-add>＋ 직접 종목 추가</button></div><div class="source-note"><strong>보유내역 직접 등록</strong><br>초기 잔고는 현금·누적 납입금과 보유종목을 기준값으로 저장합니다.</div><div class="form-grid" style="margin-top:13px"><div class="field"><label>잔고 기준일</label><input name="registrationAsOf" type="date" value="${escapeHtml(d.asOf)}" required></div><div class="field"><label>입력 방식</label><select name="registrationMode"><option value="baseline" ${d.mode === 'baseline' ? 'selected' : ''}>초기 잔고</option><option value="cash" ${d.mode === 'cash' ? 'selected' : ''}>현재 현금으로 신규 매수</option></select></div></div>${d.mode === 'baseline' ? `<div class="form-grid"><div class="field"><label>계좌 현금</label><input name="baselineCash" type="number" min="0" step="1" value="${escapeHtml(d.baselineCash)}"></div><div class="field"><label>누적 납입원금</label><input name="baselineContribution" type="number" min="0" step="1" value="${escapeHtml(d.baselineContribution)}"></div></div>` : `<div class="source-note"><strong>계좌 현금 사용</strong><br>신규 종목 등록 원가를 ISA 현금에서 차감합니다. 현재 현금 <strong>${won(summary.cash)}</strong></div>`}${d.items.length ? `<div class="registration-list">${d.items.map((item, i) => { const bond = item.assetClass === '개별채권' || item.quoteType === 'bond'; return `<article class="registration-item" data-registration-item="${escapeHtml(item.id)}"><div class="registration-item-head"><div class="registration-badges"><span class="registration-badge">직접 입력</span><span class="registration-badge ${registrationExistingHolding(item, a) ? 'update' : 'new'}">${registrationExistingHolding(item, a) ? '기존 종목 갱신' : '신규 종목'}</span></div><button class="registration-remove" type="button" data-registration-remove="${escapeHtml(item.id)}" aria-label="${i + 1}번 항목 삭제">×</button></div><div class="registration-fields"><div class="field"><label>종목명</label><input name="name" value="${escapeHtml(item.name)}" placeholder="종목명" autocomplete="off"></div><div class="form-grid"><div class="field"><label>자산군</label><select name="assetClass">${['해외주식 ETF', '국내주식 ETF', '국내주식', '채권 ETF', '개별채권', '현금성 ETF'].map(x => `<option ${x === item.assetClass ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div class="field"><label>시세 유형</label><select name="quoteType"><option value="stock" ${item.quoteType === 'stock' ? 'selected' : ''}>주식·ETF 자동</option><option value="bond" ${item.quoteType === 'bond' ? 'selected' : ''}>개별채권 코드 보관</option><option value="" ${!item.quoteType ? 'selected' : ''}>자동조회 안 함</option></select></div></div><div class="field"><label>KIS 종목코드</label><input name="instrumentCode" value="${escapeHtml(item.instrumentCode || '')}" placeholder="주식 6자리 · 채권 ISIN 12자리" autocomplete="off"></div><div class="form-grid"><div class="field"><label>${bond ? '액면금액' : '수량'}</label><input name="qty" type="number" inputmode="decimal" min="0" step="0.000001" value="${escapeHtml(item.qty)}"></div><div class="field"><label>${bond ? '평균단가 (액면 1만원당)' : '평균단가'}</label><input name="avg" type="number" inputmode="decimal" min="0" step="0.000001" value="${escapeHtml(item.avg)}"></div></div><div class="field"><label>현재가 (선택${bond ? ' · 이자 포함 평가단가, 액면 1만원당' : ''})</label><input name="price" type="number" inputmode="decimal" min="1" step="0.000001" value="${escapeHtml(item.price)}" placeholder="비워두면 평가액 미반영"></div>${bond ? '<div class="source-note">개별채권은 공개 시세와 계좌 평가단가가 다를 수 있어 현재가는 수동으로 유지합니다.</div>' : ''}</div></article>`; }).join('')}</div>` : `<div class="registration-empty"><strong>등록할 종목이 없습니다.</strong><span>직접 종목 추가를 눌러 입력해 주세요.</span></div>`}${registrationSummaryMarkup()}<div class="registration-actions"><div class="form-actions"><button type="button" class="form-btn" data-registration-cancel>취소</button><button type="button" class="form-btn primary" data-registration-save>변경사항 저장</button></div></div>`;
    bindHoldingRegistration();
}
function bindHoldingRegistration() {
    const body = $('#registerBody');
    body.querySelector('[data-registration-add]')?.addEventListener('click', () => { syncRegistrationDraft(); holdingRegistrationDraft.items.push(emptyRegistrationItem()); sheetDirty = true; renderHoldingRegistration(); setTimeout(() => $('#registerSheet').scrollTo({ top: $('#registerSheet').scrollHeight, behavior: 'smooth' }), 20); });
    body.querySelectorAll('[data-registration-remove]').forEach((b) => b.onclick = () => { syncRegistrationDraft(); holdingRegistrationDraft.items = holdingRegistrationDraft.items.filter(x => x.id !== b.dataset.registrationRemove); sheetDirty = true; renderHoldingRegistration(); });
    body.oninput = () => { $$('#registerBody .registration-item').forEach(card => { card.classList.remove('has-error'); card.querySelector('.registration-error')?.remove(); }); sheetDirty = true; syncRegistrationDraft(); updateRegistrationSummaryUI(); };
    body.onchange = (e) => { if (['registrationMode', 'quoteType', 'assetClass'].includes(e.target?.name || '')) {
        syncRegistrationDraft();
        renderHoldingRegistration();
    } };
    body.querySelector('[data-registration-cancel]')?.addEventListener('click', () => requestCloseSheets('cancel'));
    body.querySelector('[data-registration-save]')?.addEventListener('click', saveHoldingRegistration);
}
async function applyHoldingRegistrationToAccount(account, draft) {
    const working = clone(account), seenNames = new Map(), seenTargets = new Map(), summary = { new: 0, updated: 0, matched: 0, valuationMissing: 0, cashUsed: 0 };
    if (draft.mode === 'baseline') {
        const cash = Number(draft.baselineCash), contribution = Number(draft.baselineContribution);
        if (!Number.isFinite(cash) || cash < 0 || !Number.isFinite(contribution) || contribution < 0)
            return { ok: false, error: '계좌 현금과 누적 납입원금을 확인해 주세요.' };
        working.baselineDate = draft.asOf;
        working.baselineCash = cash;
        working.cashOpening = cash;
        working.baseline = { date: draft.asOf, cash, contribution };
        working.baselineContribution = contribution;
    }
    for (let rowIndex = 0; rowIndex < draft.items.length; rowIndex++) {
        const raw = draft.items[rowIndex], name = String(raw.name || '').trim();
        if (!name)
            continue;
        const key = normalizeName(name);
        if (seenNames.has(key)) {
            const first = seenNames.get(key);
            return { ok: false, error: `${rowIndex + 1}번째 ${name}이(가) ${first.index + 1}번째 항목과 중복되어 있습니다.`, rowIds: [first.id, raw.id], rowIndex };
        }
        seenNames.set(key, { id: raw.id, index: rowIndex });
        const qty = Number(raw.qty), avg = Number(raw.avg);
        if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(avg) || avg < 0)
            return { ok: false, error: `${rowIndex + 1}번째 ${name}의 수량은 0보다 커야 하고 평균단가는 0 이상이어야 합니다.`, rowIds: [raw.id], rowIndex };
        const priceText = String(raw.price ?? '').trim();
        const existing = raw.matchHoldingId ? working.holdings.find(h => h.id === raw.matchHoldingId) : working.holdings.find(h => normalizeName(h.name) === key);
        if (existing) {
            if (seenTargets.has(existing.id)) {
                const first = seenTargets.get(existing.id);
                return { ok: false, error: `${rowIndex + 1}번째 항목이 ${first.index + 1}번째 항목과 같은 ${existing.name}에 연결돼 있습니다.`, rowIds: [first.id, raw.id], rowIndex };
            }
            seenTargets.set(existing.id, { id: raw.id, index: rowIndex });
            summary.matched++;
            const nameOwner = working.holdings.find(h => h.id !== existing.id && normalizeName(h.name) === key);
            if (nameOwner)
                return { ok: false, error: `${rowIndex + 1}번째 ${name}은(는) 다른 등록 종목과 이름이 겹칩니다.`, rowIds: [raw.id], rowIndex };
            const current = accountMetrics(working).holdings.find(h => h.id === existing.id);
            if (!current)
                return { ok: false, error: `${rowIndex + 1}번째 ${name}의 현재 보유내역을 계산하지 못했습니다.`, rowIds: [raw.id], rowIndex };
            let changed = false;
            if (existing.name !== name) {
                existing.name = name;
                existing.securityKey = key;
                changed = true;
            }
            const assetClass = String(raw.assetClass || existing.assetClass || '국내주식 ETF'), quoteType = ['stock', 'bond'].includes(raw.quoteType) ? raw.quoteType : '', instrumentCode = String(raw.instrumentCode || '').trim().toUpperCase(), individualBond = assetClass === '개별채권' || quoteType === 'bond', priceScale = individualBond ? 10000 : 1, quantityUnit = individualBond ? 'face' : 'share', quoteSource = quoteType === 'stock' && instrumentCode ? 'kis' : '';
            if (existing.assetClass !== assetClass) {
                existing.assetClass = assetClass;
                changed = true;
            }
            if (existing.quoteType !== quoteType || existing.instrumentCode !== instrumentCode || existing.priceScale !== priceScale || existing.quantityUnit !== quantityUnit || existing.quoteSource !== quoteSource) {
                Object.assign(existing, { quoteType, instrumentCode, priceScale, quantityUnit, quoteSource });
                changed = true;
            }
            if (priceText !== '') {
                const price = Number(priceText);
                if (!Number.isFinite(price) || price < 0)
                    return { ok: false, error: `${rowIndex + 1}번째 ${name}의 현재가를 확인해 주세요.`, rowIds: [raw.id], rowIndex };
                if (existing.currentPrice !== price || existing.valuationStatus !== 'confirmed') {
                    existing.currentPrice = price;
                    existing.valuationStatus = 'confirmed';
                    changed = true;
                }
            }
            else if (!existing.currentPrice) {
                existing.valuationStatus = 'missing';
                summary.valuationMissing++;
            }
            if (Math.abs(qty - current.qty) > 1e-8 || Math.abs(avg - current.avgPrice) > 1e-8) {
                const tx = { id: uid('tx'), type: 'adjustment', tradeDate: draft.asOf, date: draft.asOf, sequence: nextSequence(working, draft.asOf), createdAt: new Date().toISOString(), holdingId: existing.id, setQty: qty, setAvg: avg, reason: 'manual_balance_update', note: '보유내역 직접 갱신' };
                tx.idempotencyKey = stableTxKey(tx);
                working.transactions.push(tx);
                changed = true;
            }
            if (changed)
                summary.updated++;
        }
        else {
            if (priceText === '')
                summary.valuationMissing++;
            const r = (await registerHoldingFromBalance(working, { ...raw, name, qty, avg, price: priceText, asOf: draft.asOf, mode: draft.mode }));
            if (!r.ok)
                return { ...r, error: `${rowIndex + 1}번째 ${r.error}`, rowIds: [raw.id], rowIndex };
            seenTargets.set(r.holding.id, { id: raw.id, index: rowIndex });
            summary.new++;
            if (r.mode === 'cash')
                summary.cashUsed += holdingCostValue(r.holding, qty, avg);
        }
        const check = replay(working);
        if (!check.valid)
            return { ok: false, error: `${rowIndex + 1}번째 항목 반영 후 ${check.error}`, rowIds: [raw.id], rowIndex };
    }
    if (!summary.new && !summary.matched)
        return { ok: false, error: '저장할 종목을 추가해 주세요.' };
    if (!summary.new && !summary.updated)
        return { ok: false, error: '변경된 보유내역이 없습니다.' };
    rebuildLedgerIndexes(working);
    return { ok: true, account: working, summary };
}
function showRegistrationError(result) { $$('#registerBody .registration-item').forEach(card => { card.classList.remove('has-error'); card.querySelector('.registration-error')?.remove(); }); const ids = result.rowIds || []; for (const id of ids) {
    const card = findDataElement($("#registerBody"), "data-registration-item", id);
    if (!card)
        continue;
    card.classList.add('has-error');
    if (!card.querySelector('.registration-error'))
        card.insertAdjacentHTML('beforeend', `<div class="registration-error">${escapeHtml(result.error)}</div>`);
} const target = ids.length ? findDataElement($("#registerBody"), "data-registration-item", ids[0]) : null; target?.scrollIntoView({ behavior: 'smooth', block: 'center' }); toast(result.error || '거래 값을 확인해 주세요.'); }
async function saveHoldingRegistration() {
    syncRegistrationDraft();
    const result = (await applyHoldingRegistrationToAccount(currentAccount(), holdingRegistrationDraft));
    if (!result.ok) {
        showRegistrationError(result);
        return;
    }
    const index = state.accounts.findIndex(a => a.id === holdingRegistrationDraft.accountId), before = state.accounts[index];
    state.accounts[index] = result.account;
    if (!(await persist())) {
        state.accounts[index] = before;
        return;
    }
    sheetDirty = false;
    holdingRegistrationDraft = null;
    closeSheets();
    render();
    toast(`보유내역 저장 · 신규 ${result.summary.new} / 변경 ${result.summary.updated}`);
}
function openTransactionChoice() { const grid = $('#actionGrid'); $('#actionTitle').textContent = 'ISA 빠른 입력'; grid.className = 'actiongrid'; grid.innerHTML = `<div class="action-choice-sheet" style="grid-column:1/-1"><div class="source-note"><strong>납입은 통합에서만 기록합니다.</strong><br>여기서는 계좌 안에서 실제로 발생한 거래만 간단하게 입력합니다.</div><div class="action-choice-list"><button class="action-choice-item" data-t="buy"><div><strong>매수</strong><small>등록된 종목만 선택</small></div><span>›</span></button><button class="action-choice-item" data-t="sell"><div><strong>매도</strong><small>현재 보유수량이 있는 종목</small></div><span>›</span></button><button class="action-choice-item" data-t="distribution"><div><strong>ETF 분배금</strong><small>계좌 현금으로 받은 분배금</small></div><span>›</span></button><button class="action-choice-item" data-t="dividend"><div><strong>주식 배당</strong><small>개별 종목 배당금 기록</small></div><span>›</span></button><button class="action-choice-item" data-t="interest"><div><strong>예수금 이자</strong><small>종목 선택 없이 이자만 기록</small></div><span>›</span></button><button class="action-choice-item" data-t="withdrawal"><div><strong>일반 출금</strong><small>실제 ISA 외부출금 기록</small></div><span>›</span></button><button class="action-choice-item" data-register><div><strong>보유내역 등록</strong><small>직접 보유내역 입력</small></div><span>›</span></button></div></div>`; openSheet('#actionSheet'); $$('[data-t]').forEach((b) => b.onclick = () => openTransactionForm(b.dataset.t || '')); const registerButton = grid.querySelector('[data-register]'); if (registerButton)
    registerButton.onclick = openRegisterChoice; }
function openRegisterChoice() { openHoldingRegistration(); }
function eligibleHoldings(type) { const a = currentAccount(), m = accountMetrics(a); return m.holdings.filter(h => ['sell', 'dividend', 'distribution'].includes(type) ? h.qty > 0 : true); }
function nextSequence(a, date) { return Math.max(0, ...(a.transactions || []).filter(t => txDate(t) === date).map(t => txSequence(t))) + 1; }
function findDuplicateTransaction(a, tx, excludeId = '') { const key = stableTxKey(tx); return (a.transactions || []).find(t => t.id !== excludeId && t.status !== 'cancelled' && (t.idempotencyKey || stableTxKey(t)) === key); }
let openTransactionForm = function (type, editId = null, preHolding = null, sourceDividendId = null, template = null) {
    if (['deposit', 'internalTransferIn', 'depositReversal'].includes(type)) {
        toast('ISA 납입은 통합에서 기록해 주세요.');
        return nav('integrated', 'schedule');
    }
    const a = currentAccount();
    if (!isTradeableAccount(a))
        return toast(a.status === 'maturity_pending' ? '만기 처리 대기 중에는 거래를 입력·수정할 수 없습니다.' : '종료된 ISA 거래는 수정할 수 없습니다.');
    const old = editId ? a.transactions.find(t => t.id === editId) : null, sourceTx = old || template, needsHolding = ['buy', 'sell', 'dividend', 'distribution'].includes(type), hs = eligibleHoldings(type), reversibleSources = type === 'depositReversal' ? sortTxs(a.transactions || []).filter(t => ['deposit', 'internalTransferIn'].includes(t.type || '') && t.status !== 'cancelled').map((src) => { const reversed = (a.transactions || []).filter(r => r.type === 'depositReversal' && r.status !== 'cancelled' && r.id !== editId && r.reversesTransactionId === src.id).reduce((sum, r) => sum + (Number(r.amount) || 0), 0); return { ...src, remaining: Math.max(0, (Number(src.amount) || 0) - reversed) }; }).filter(src => (src.remaining || 0) > Number(a.reconciliationTolerance || 10)) : [];
    if (needsHolding && !hs.length)
        return toast('선택 가능한 보유종목이 없습니다.');
    if (type === 'depositReversal' && !reversibleSources.length)
        return toast('취소할 수 있는 원입금 거래가 없습니다.');
    $('#formEyebrow').textContent = editId ? '거래 수정' : template ? '거래 다시 만들기' : '새 거래';
    $('#formTitle').textContent = typeText(type);
    const selected = preHolding || sourceTx?.holdingId || hs[0]?.id || '', isTrade = ['buy', 'sell'].includes(type), isIncome = ['dividend', 'distribution', 'interest'].includes(type), dateValue = sourceTx ? txDate(sourceTx) : ymd();
    $('#formBody').innerHTML = `<form id="txForm" class="form">${needsHolding ? `<div class="field"><label>종목</label><select name="holdingId">${hs.map(h => `<option value="${escapeHtml(h.id)}" ${h.id === selected ? 'selected' : ''}>${escapeHtml(h.name)}${type === 'sell' ? ` · ${holdingQuantityText(h)}` : ''}</option>`).join('')}</select></div>` : ''}<div class="form-grid"><div class="field"><label>거래일</label><input name="tradeDate" type="date" value="${escapeHtml(dateValue)}" required></div><div class="field"><label>결제일 (선택)</label><input name="settlementDate" type="date" value="${escapeHtml(sourceTx?.settlementDate || '')}"></div></div>${type === 'depositReversal' ? `<div class="field"><label>취소할 원입금</label><select name="reversesTransactionId">${reversibleSources.map(src => `<option value="${escapeHtml(src.id)}" ${src.id === sourceTx?.reversesTransactionId ? 'selected' : ''}>${formatDate(txDate(src))} · ${typeText(src.type)} · 남은 ${won(src.remaining)}</option>`).join('')}</select></div>` : ''}${isTrade ? `<div class="form-grid"><div class="field"><label>수량</label><input name="qty" type="number" inputmode="decimal" min="0.000001" step="0.000001" value="${escapeHtml(sourceTx?.qty || '')}" required></div><div class="field"><label>단가</label><input name="price" type="number" inputmode="numeric" min="1" step="1" value="${escapeHtml(sourceTx?.price || '')}" required></div></div><div class="form-grid"><div class="field"><label>수수료</label><input name="fee" type="number" inputmode="numeric" min="0" step="1" value="${escapeHtml(sourceTx?.fee || 0)}"></div><div class="field"><label>세금</label><input name="tax" type="number" inputmode="numeric" min="0" step="1" value="${escapeHtml(sourceTx?.tax || 0)}"></div></div>` : `<div class="field"><label>${isIncome ? '세전 수령액' : '금액'}</label><input name="amount" type="number" inputmode="numeric" min="1" step="1" value="${escapeHtml(sourceTx?.amount || '')}" required></div>${isIncome ? `<div class="form-grid"><div class="field"><label>수수료</label><input name="fee" type="number" inputmode="numeric" min="0" step="1" value="${escapeHtml(sourceTx?.fee || 0)}"></div><div class="field"><label>원천징수·세금</label><input name="tax" type="number" inputmode="numeric" min="0" step="1" value="${escapeHtml(sourceTx?.tax || 0)}"></div></div>` : ''}`}<div class="field"><label>메모 (선택)</label><input name="note" value="${escapeHtml(sourceTx?.note || '')}"></div>${editId ? `<div class="field"><label>수정·취소 사유 (선택)</label><input name="changeReason" placeholder="비워두면 사용자 수정으로 기록"></div>` : ''}<div id="txPreview" class="form-preview">값을 입력하면 계산 결과를 보여줍니다.</div><div class="form-actions ${editId ? '' : 'one'}">${editId ? '<button type="button" class="form-btn danger" id="deleteTx">취소 처리</button>' : ''}<button class="form-btn primary">${editId ? '수정 저장' : '저장'}</button></div></form>`;
    openSheet('#formSheet', { mode: 'input' });
    const form = $('#txForm'), preview = $('#txPreview');
    const update = () => { const fd = new FormData(form), q = Number(fd.get('qty')) || 0, p = Number(fd.get('price')) || 0, f = Number(fd.get('fee')) || 0, tax = Number(fd.get('tax')) || 0, amount = Number(fd.get('amount')) || 0, holding = getHolding(a, String(fd.get('holdingId'))), trade = transactionPositionValue(holding, q, p); if (isTrade)
        preview.textContent = `${typeText(type)} ${won(type === 'buy' ? trade + f + tax : trade - f - tax)}${type === 'sell' ? ' · 실현손익은 해당 시점 평균단가로 다시 계산됩니다.' : ''}`;
    else if (isIncome)
        preview.textContent = `실수령 ${won(Math.max(0, amount - f - tax))} · 계좌 현금에 반영`;
    else
        preview.textContent = `기록 금액 ${won(amount)}`; };
    form.addEventListener('input', update);
    update();
    form.onsubmit = async (e) => { e.preventDefault(); const fd = new FormData(form), date = String(fd.get('tradeDate')), tx = { ...clone(old || {}), id: old?.id || uid('tx'), type, tradeDate: date, date, settlementDate: String(fd.get('settlementDate') || '') || null, sequence: old && txDate(old) === date && Number.isFinite(Number(old.sequence)) ? Number(old.sequence) : nextSequence(a, date), createdAt: old?.createdAt || new Date().toISOString(), note: String(fd.get('note') || ''), fee: Number(fd.get('fee')) || 0, tax: Number(fd.get('tax')) || 0, transferId: old?.transferId || (['internalTransferIn', 'internalTransferOut'].includes(type) ? uid('transfer') : null), revisions: clone(old?.revisions || []) }; if (old?.linkedBuyId)
        tx.linkedBuyId = old.linkedBuyId; if (old?.sourceDividendId)
        tx.sourceDividendId = old.sourceDividendId; if (sourceDividendId && type === 'buy')
        tx.sourceDividendId = sourceDividendId; if (needsHolding)
        tx.holdingId = String(fd.get('holdingId')); if (type === 'depositReversal')
        tx.reversesTransactionId = String(fd.get('reversesTransactionId') || ''); if (isTrade) {
        tx.qty = Number(fd.get('qty'));
        tx.price = Number(fd.get('price'));
    }
    else
        tx.amount = Number(fd.get('amount')); const dateError = isaTransactionDateError(a, date); if (dateError)
        return toast(dateError); const numericError = transactionNumericError(tx); if (numericError)
        return toast(numericError); if (editId)
        (tx.revisions ??= []).push(transactionRevision(old, tx, 'edit', fd.get('changeReason'))); tx.idempotencyKey = stableTxKey(tx); const dup = findDuplicateTransaction(a, tx, editId || ''); if (dup)
        return toast(`같은 거래가 이미 있습니다. ${formatDate(txDate(dup))} ${typeText(dup.type)}`); const candidate = editId ? a.transactions.map(t => t.id === editId ? tx : { ...t }) : [...a.transactions.map(t => ({ ...t })), tx]; if (tx.sourceDividendId && type === 'buy') {
        const source = candidate.find(t => t.id === tx.sourceDividendId);
        if (source)
            source.linkedBuyId = tx.id;
    } const result = replay(a, candidate); if (!result.valid)
        return toast(result.error || '거래 값을 확인해 주세요.'); const commit = async () => { const submitButton = form.querySelector('button[type="submit"],button:not([type])'); if (submitButton?.disabled)
        return; if (submitButton)
        submitButton.disabled = true; a.transactions = candidate; if (!(await persist())) {
        if (submitButton)
            submitButton.disabled = false;
        return;
    } sheetDirty = false; closeSheets(); render(); if (['dividend', 'distribution'].includes(type) && !editId)
        setTimeout(() => openDividendSaved(tx), 80);
    else
        toast(editId ? '거래를 수정했습니다.' : template ? '같은 내용으로 새 거래를 저장했습니다.' : '거래를 저장했습니다.'); }; if (type === 'buy' && transactionPositionValue(getHolding(a, tx.holdingId), Number(tx.qty) || 0, Number(tx.price) || 0) + (tx.fee || 0) + (tx.tax || 0) > accountMetrics(a).cash + 1e-8)
        return toast('ISA 계좌 현금이 부족합니다. 통합 납입 또는 현금 유입을 먼저 기록해 주세요.'); (await commit()); };
    if (editId)
        $('#deleteTx').onclick = () => showDialog({ title: '거래를 취소 처리할까요?', message: '원본은 남기고 취소 이력을 기록합니다. 이후 수량·손익·현금을 다시 계산합니다.', confirmText: '취소 처리', danger: true }, async () => { const reason = new FormData(form).get('changeReason'), candidate = a.transactions.map(t => { if (t.id !== editId)
            return { ...t }; const next = { ...t, status: 'cancelled', cancelledAt: new Date().toISOString(), revisions: clone(t.revisions || []) }; next.revisions.push(transactionRevision(t, next, 'cancel', reason)); return next; }), result = replay(a, candidate); if (!result.valid)
            return toast(result.error || '거래 값을 확인해 주세요.'); a.transactions = candidate; if (!(await persist()))
            return; sheetDirty = false; closeSheets(); render(); toast('거래를 취소 처리했습니다.'); });
};
function transactionSnapshotSummary(a, x) { if (!x)
    return '-'; const holding = x.holdingId ? getHolding(a, x.holdingId) : null, name = holding ? holding.name : typeText(x.type), date = formatDate(txDate(x)), settle = x.settlementDate ? ` · 결제 ${formatDate(x.settlementDate)}` : '', memo = ` · 메모 ${x.note || '-'}`, status = x.status === 'cancelled' ? ' · 취소됨' : ''; if (x.qty != null)
    return `${date}${settle} · ${name} · ${holdingQuantityText(holding, Number(x.qty))} × ${won(x.price || 0)} · 수수료 ${won(x.fee || 0)} · 세금 ${won(x.tax || 0)}${memo}${status}`; return `${date}${settle} · ${name} · ${won(x.amount || 0)} · 수수료 ${won(x.fee || 0)} · 세금 ${won(x.tax || 0)}${memo}${status}`; }
function openTransactionHistory(id, accountId = '') { const a = state.accounts.find(x => x.id === accountId) || currentAccount(), t = a.transactions.find(x => x.id === id); if (!t)
    return; const rs = [...(t.revisions || [])].sort((x, y) => String(y.changedAt || '').localeCompare(String(x.changedAt || ''))); $('#sheetEyebrow').textContent = '거래 감사 이력'; $('#sheetTitle').textContent = t.holdingId ? holdingName(a, t.holdingId) : typeText(t.type); $('#sheetBody').innerHTML = `<div class="lock-note">원본 거래를 지우지 않고 수정·취소 전후값을 보관합니다. 현재 계산에는 가장 최근 상태만 반영됩니다.</div><div class="revision-list">${rs.length ? rs.map((r, i) => `<article class="revision-card"><div class="revision-head"><div><strong>${rs.length - i}번째 ${revisionLabel(r)}</strong><small>${formatDateTime(r.changedAt)}</small></div><span class="revision-badge ${r.action === 'cancel' ? 'cancel' : ''}">${r.action === 'cancel' ? '취소' : '수정'}</span></div><div class="revision-reason">사유 · ${escapeHtml(r.reason || '-')}</div><div class="revision-change"><div class="revision-side"><span>변경 전</span><strong>${escapeHtml(transactionSnapshotSummary(a, r.before))}</strong></div><div class="revision-arrow">→</div><div class="revision-side"><span>변경 후</span><strong>${escapeHtml(transactionSnapshotSummary(a, r.after))}</strong></div></div></article>`).join('') : '<div class="empty-state"><strong>수정 이력이 없습니다.</strong><span>최초 저장 상태 그대로입니다.</span></div>'}</div>`; openSheet('#detailSheet'); }
function openTransactionDetail(id, accountId = '') { const a = state.accounts.find(x => x.id === accountId) || currentAccount(), t = a.transactions.find(x => x.id === id); if (!t)
    return; const facts = transactionFacts(a).get(t.id || '') || {}, linked = t.linkedBuyId ? a.transactions.find(x => x.id === t.linkedBuyId) : t.sourceDividendId ? a.transactions.find(x => x.id === t.sourceDividendId) : null, revisionCount = (t.revisions || []).length, canEdit = a.status === 'active' && t.status !== 'cancelled' && !['deposit', 'internalTransferIn', 'depositReversal'].includes(t.type || ''), canCopy = a.status === 'active' && t.status === 'cancelled', actions = [canEdit ? '<button class="primary" data-edit-tx>수정·취소</button>' : '', canCopy ? '<button class="primary" data-copy-tx>같은 내용으로 새 거래 만들기</button>' : '', revisionCount ? '<button data-tx-history>수정 이력 보기</button>' : ''].filter(Boolean); $('#sheetEyebrow').textContent = typeText(t.type); $('#sheetTitle').textContent = t.holdingId ? holdingName(a, t.holdingId) : typeText(t.type); $('#sheetBody').innerHTML = `<div class="sheetrows"><div class="sheetrow"><span>날짜</span><strong>${formatDate(txDate(t))}</strong></div>${t.qty ? `<div class="sheetrow"><span>수량</span><strong>${quantityNumber(t.qty)}주</strong></div><div class="sheetrow"><span>단가</span><strong>${won(t.price)}</strong></div>` : `<div class="sheetrow"><span>금액</span><strong>${won(t.amount || 0)}</strong></div>`}<div class="sheetrow"><span>메모</span><strong>${escapeHtml(t.note || '-')}</strong></div><div class="sheetrow total"><span>${t.type === 'sell' ? '매도대금' : t.type === 'buy' ? '매수금액' : ['dividend', 'distribution'].includes(t.type || '') ? '받은 배당금' : '기록금액'}</span><strong>${won(facts.tradeAmount ?? Math.abs(txAmount(t)))}</strong></div>${t.type === 'sell' && Number.isFinite(facts.realized) ? `<div class="sheetrow"><span>실현손익</span><strong class="${escapeHtml((facts.realized || 0) >= 0 ? 'positive' : '')}">${signed(facts.realized)}</strong></div>` : ''}${linked ? `<div class="sheetrow"><span>${['dividend', 'distribution'].includes(t.type || '') ? '연결된 매수' : '연결된 배당'}</span><strong>${formatDate(txDate(linked))} · ${['dividend', 'distribution'].includes(t.type || '') ? won(Number(linked.qty) * Number(linked.price)) : won(linked.amount)}</strong></div>` : ''}<div class="sheetrow"><span>수정·취소 이력</span><strong>${revisionCount}건</strong></div></div>${['dividend', 'distribution'].includes(t.type || '') ? '<div class="lock-note">배당금은 계좌 현금에 반영됩니다. 재투자는 별도 매수 기록으로 저장하고 필요할 때만 연결합니다.</div>' : ''}${t.status === 'cancelled' ? `<div class="lock-note">${formatDate(String(t.cancelledAt || '').slice(0, 10))} 취소 처리된 거래입니다. 원본은 유지되며 다시 입력할 때는 새 거래로 저장됩니다.</div>` : a.status === 'maturity_pending' ? '<div class="lock-note">만기 처리 대기 중인 ISA 거래입니다. 조회만 가능합니다.</div>' : isPastAccount(a) ? '<div class="lock-note">종료된 ISA의 과거 거래입니다.</div>' : ''}${actions.length ? `<div class="tx-action-grid ${actions.length === 1 ? 'one' : ''}">${actions.join('')}</div>` : ''}`; openSheet('#detailSheet'); $('[data-edit-tx]')?.addEventListener('click', () => openTransactionForm(t.type || '', t.id || '')); $('[data-copy-tx]')?.addEventListener('click', () => openTransactionForm(t.type || '', null, t.holdingId || '', null, t)); $('[data-tx-history]')?.addEventListener('click', () => openTransactionHistory(t.id || '', a.id)); }
function registerHoldingFromBalance(a, input) {
    const name = String(input.name || '').trim(), key = normalizeName(name);
    if (!name)
        return { ok: false, error: '종목명을 입력해 주세요.' };
    if (a.holdings.some(h => normalizeName(h.name) === key))
        return { ok: false, error: '같은 종목이 이미 등록돼 있습니다.' };
    const qty = Number(input.qty) || 0, avg = Number(input.avg) || 0, priceRaw = String(input.price ?? '').trim(), currentPrice = priceRaw === '' ? 0 : Number(priceRaw), quoteType = ['stock', 'bond'].includes(input.quoteType || '') ? input.quoteType : '', instrumentCode = String(input.instrumentCode || '').trim().toUpperCase(), assetClass = String(input.assetClass || '국내주식 ETF'), individualBond = quoteType === 'bond' || assetClass === '개별채권', priceScale = individualBond ? 10000 : 1, quantityUnit = individualBond ? 'face' : 'share', cost = qty * avg / priceScale, mode = String(input.mode || 'auto'), currentCash = replay(a).cash, tolerance = Number(a.reconciliationTolerance || 10);
    if (qty < 0 || avg < 0 || !Number.isFinite(currentPrice) || currentPrice < 0)
        return { ok: false, error: '수량·평균단가·현재가는 0 이상이어야 합니다.' };
    if (mode === 'cash' && cost > currentCash + 1e-8)
        return { ok: false, error: `계좌 현금이 ${won(cost - currentCash)} 부족합니다.` };
    const holding = { id: uid('holding'), name, securityKey: key, assetClass, baselineQty: 0, baselineAvg: 0, currentPrice, valuationStatus: priceRaw === '' ? 'missing' : 'confirmed', instrumentCode, quoteType, quoteSource: quoteType === 'stock' && instrumentCode ? 'kis' : '', priceScale, quantityUnit, order: a.holdings.length + 1, lifecycleStatus: 'active' };
    a.holdings.push(holding);
    const useCash = mode === 'cash' || (mode === 'auto' && qty > 0 && currentCash + 1e-8 >= cost);
    if (qty > 0 && useCash) {
        const date = String(input.asOf || ymd()), tx = { id: uid('tx'), type: 'openingAllocation', tradeDate: date, date, sequence: nextSequence(a, date), createdAt: new Date().toISOString(), holdingId: holding.id, qty, price: avg, fee: 0, tax: 0, note: '보유내역 등록 시 계좌 현금 사용' };
        tx.idempotencyKey = stableTxKey(tx);
        a.transactions.push(tx);
    }
    else {
        holding.baselineQty = qty;
        holding.baselineAvg = avg;
    }
    rebuildLedgerIndexes(a);
    return { ok: true, holding, mode: useCash ? 'cash' : 'baseline', valuationMissing: priceRaw === '' };
}
async function applyReconcileSnapshot(a, snapshot) {
    if (!a)
        return { ok: false, error: 'ISA 계좌를 찾지 못했습니다.' };
    const target = a;
    a = clone(a);
    const asOf = String(snapshot.asOf || ymd()), capturedAt = String(snapshot.capturedAt || new Date().toISOString()), items = Array.isArray(snapshot.holdings) ? snapshot.holdings : [], seenNames = new Set();
    for (const item of items) {
        const name = String(item.name || '').trim(), key = normalizeName(name), qty = Number(item.qty), avgText = String(item.avg ?? '').trim(), avg = avgText === '' ? 0 : Number(item.avg), priceText = String(item.price ?? '').trim(), price = priceText === '' ? 0 : Number(item.price);
        if (!name)
            return { ok: false, error: '종목명을 확인해 주세요.' };
        if (seenNames.has(key))
            return { ok: false, error: `${name}이(가) 가져온 잔고에 중복되어 있습니다.` };
        seenNames.add(key);
        if (!Number.isFinite(qty) || qty < 0 || !Number.isFinite(avg) || avg < 0 || !Number.isFinite(price) || price < 0)
            return { ok: false, error: `${name}의 수량·평균단가·현재가를 확인해 주세요.` };
    }
    const itemKey = items.map(x => `${normalizeName(x.name)}:${Number(x.qty || 0)}:${Number(x.avg || 0)}:${Number(x.price || 0)}`).sort().join('|'), cashKey = snapshot.cashVisible === true ? `cash:1:${Number(snapshot.cash || 0)}` : 'cash:0', key = snapshot.idempotencyKey || [a.id, asOf, itemKey, cashKey].join('|');
    if (a.reconciliations.some((r) => r.idempotencyKey === key))
        return { ok: false, duplicate: true, error: '같은 기준일의 동일 잔고가 이미 반영돼 있습니다.' };
    const result = { updated: 0, new: 0, missing: 0, adjustments: 0 };
    let metrics = accountMetrics(a);
    const seen = new Set();
    for (const item of items) {
        const nkey = normalizeName(item.name), existing = a.holdings.find(h => normalizeName(h.name) === nkey), priceText = String(item.price ?? '').trim(), avgText = String(item.avg ?? '').trim();
        if (existing) {
            seen.add(existing.id);
            const current = metrics.holdings.find(h => h.id === existing.id);
            if (priceText !== '') {
                existing.currentPrice = Number(item.price);
                existing.valuationStatus = 'confirmed';
            }
            const targetQty = Number(item.qty);
            if (Math.abs(targetQty - (current?.qty || 0)) > 1e-8 || avgText !== '' && Math.abs(Number(item.avg) - (current?.avgPrice || 0)) > 1e-8) {
                const tx = { id: uid('tx'), type: 'adjustment', tradeDate: asOf, date: asOf, sequence: nextSequence(a, asOf), createdAt: capturedAt, holdingId: existing.id, setQty: targetQty, setAvg: avgText !== '' ? Number(item.avg) : (current?.avgPrice || 0), reason: String(item.reason || 'reconciliation'), note: '잔고 대조 차이 조정', idempotencyKey: `${key}|${existing.id}` };
                a.transactions.push(tx);
                result.adjustments++;
            }
            result.updated++;
        }
        else {
            const r = (await registerHoldingFromBalance(a, { ...item, asOf, mode: String(snapshot.mode || 'baseline') }));
            if (!r.ok)
                return r;
            seen.add(r.holding.id);
            result.new++;
        }
        metrics = accountMetrics(a);
    }
    result.missing = a.holdings.filter(h => !seen.has(h.id) && (metrics.holdings.find(x => x.id === h.id)?.qty || 0) > 0).length;
    if (snapshot.cashVisible === true && Number.isFinite(Number(snapshot.cash))) {
        const delta = Number(snapshot.cash) - accountMetrics(a).cash;
        if (Math.abs(delta) > Number(a.reconciliationTolerance || 10)) {
            const tx = { id: uid('tx'), type: 'adjustment', tradeDate: asOf, date: asOf, sequence: nextSequence(a, asOf), createdAt: capturedAt, cashDelta: delta, reason: 'cash_reconciliation', note: '계좌 현금 대조', idempotencyKey: `${key}|cash` };
            a.transactions.push(tx);
            result.adjustments++;
        }
    }
    a.reconciliations.push({ id: uid('recon'), asOf, capturedAt, idempotencyKey: String(key), createdAt: new Date().toISOString(), cashVisible: snapshot.cashVisible === true, summary: result, tolerance: Number(a.reconciliationTolerance || 10) });
    rebuildLedgerIndexes(a);
    for (const k of Object.keys(target))
        delete target[k];
    Object.assign(target, a);
    return { ok: true, ...result };
}
function archivedIsaTransactionRows(account) { return [...sortTxs([...(account.transactions || []), ...centralIsaReplayRows(account, true)])].reverse(); }
function openArchivedAccountDetail(accountId, transactionLimit = 10, dividendLimit = 10) {
    const a = state.accounts.find(x => x.id === accountId && isPastAccount(x));
    if (!a)
        return toast('이전 ISA 기록을 찾지 못했습니다.');
    const txLimit = transactionLimit === true ? Number.MAX_SAFE_INTEGER : Math.max(10, Number(transactionLimit) || 10), divLimit = dividendLimit === true ? Number.MAX_SAFE_INTEGER : Math.max(10, Number(dividendLimit) || 10), m = accountMetrics(a), pastHoldings = m.holdings.filter(h => h.qty > 1e-8), ds = dividends(a), p = policy('isa', a), settlement = a.status === 'transferred' ? (a.maturity?.actualTransferAmount ?? m.value) : (a.maturity?.actualSettlement ?? m.value), decision = a.status === 'transferred' ? `연금 전환 · ${escapeHtml(a.maturity?.transferTarget || '연금계좌')}` : '일반 해지', allTx = archivedIsaTransactionRows(a), visibleTx = allTx.slice(0, txLimit), visibleDs = ds.slice(0, divLimit), txRemaining = Math.max(0, allTx.length - visibleTx.length), divRemaining = Math.max(0, ds.length - visibleDs.length), txToggle = allTx.length > 10 ? `<button data-archive-tx-toggle>${txRemaining ? `다음 ${Math.min(50, txRemaining)}건 보기` : '최근 10건만'}</button>` : '', divToggle = ds.length > 10 ? `<button data-archive-div-toggle>${divRemaining ? `다음 ${Math.min(50, divRemaining)}건 보기` : '최근 10건만'}</button>` : '';
    $('#sheetEyebrow').textContent = '이전 ISA · 읽기 전용';
    $('#sheetTitle').textContent = a.name;
    $('#sheetBody').innerHTML = `<div class="archive-hero"><span class="archive-state">${statusText(a.status)}</span><div class="archive-amount">${won(settlement)}</div><div class="archive-sub">${formatDate(a.openedAt)} ~ ${formatDate(a.closedAt || a.maturityAt)} · ${escapeHtml(a.broker || '금융회사 미입력')}</div><div class="readonly-banner"><b>현재 총자산 합산 제외</b><span>과거 회차 기록은 수정하지 않습니다.</span></div></div><div class="sheetrows"><div class="sheetrow"><span>종료 방식</span><strong>${decision}</strong></div><div class="sheetrow"><span>적용 제도</span><strong>${escapeHtml(p.name || '-')}</strong></div><div class="sheetrow"><span>실제 세금</span><strong>${won(a.maturity?.actualTax || 0)}</strong></div><div class="sheetrow"><span>실제 수령·전환액</span><strong>${won(a.status === 'transferred' ? (a.maturity?.actualTransferAmount || 0) : (a.maturity?.actualReceived || settlement))}</strong></div>${a.status === 'transferred' ? `<div class="sheetrow"><span>생활현금 수령액</span><strong>${won(a.maturity?.actualReceived || 0)}</strong></div>` : ''}</div><section class="archive-section"><div class="sectionhead"><h2>종료 시점 보유종목 ${pastHoldings.length}개</h2><span class="info-badge muted-badge">최종 잔고</span></div><div class="archive-list">${pastHoldings.map(h => `<div class="archive-row"><div><strong>${escapeHtml(h.name)}</strong><small>${escapeHtml(investmentRoleMeta(h))} · ${quantityNumber(h.qty)}주 · 평단 ${won(h.avgPrice)}</small></div><div class="right"><strong>${won(h.marketValue)}</strong><small>종료 기록가 ${won(h.currentPrice)}</small></div></div>`).join('') || '<div class="empty-state"><span>종료 시점 보유종목이 없습니다.</span></div>'}</div></section><section class="archive-section"><div class="sectionhead"><h2>전체 기간 거래 ${allTx.length}건</h2>${txToggle || `<span class="info-badge muted-badge">전체 표시</span>`}</div>${allTx.length > 10 ? `<div class="archive-list-status">${visibleTx.length}/${allTx.length}건 표시</div>` : ''}<div class="archive-list">${visibleTx.map(t => `<div class="archive-row"><div><strong>${typeText(t.type)} · ${escapeHtml(t.meta?.centralContribution ? '통합 납입' : holdingName(a, t.holdingId))}${t.status === 'cancelled' ? ' · 취소됨' : ''}</strong><small>${formatDate(txDate(t))} · ${escapeHtml(t.note || '메모 없음')}</small></div><div class="right"><strong>${t.amount != null ? won(t.amount) : t.qty != null ? `${quantityNumber(t.qty)}주` : '-'}</strong><small>${t.price != null ? won(t.price) : ''}</small></div></div>`).join('')}</div></section><section class="archive-section"><div class="sectionhead"><h2>전체 기간 배당 ${ds.length}건</h2>${divToggle || `<span class="info-badge muted-badge">누적 ${won(ds.reduce((sum, x) => sum + dividendNetAmount(x), 0))}</span>`}</div>${ds.length > 10 ? `<div class="archive-list-status">${visibleDs.length}/${ds.length}건 표시</div>` : ''}<div class="archive-list">${visibleDs.length ? visibleDs.map(t => `<div class="archive-row"><div><strong>${escapeHtml(holdingName(a, t.holdingId))}</strong><small>${formatDate(txDate(t))}</small></div><div class="right"><strong>${won(dividendNetAmount(t))}</strong></div></div>`).join('') : '<div class="empty-state"><span>배당 기록이 없습니다.</span></div>'}</div></section>`;
    openSheet('#detailSheet');
    $('[data-archive-tx-toggle]')?.addEventListener('click', () => openArchivedAccountDetail(accountId, txRemaining ? txLimit + 50 : 10, divLimit));
    $('[data-archive-div-toggle]')?.addEventListener('click', () => openArchivedAccountDetail(accountId, txLimit, divRemaining ? divLimit + 50 : 10));
}
function openAccountSelector() { const current = state.accounts.filter(isCurrentAccount), past = state.accounts.filter(isPastAccount); $('#sheetEyebrow').textContent = 'ISA 계좌'; $('#sheetTitle').textContent = '계좌 선택'; $('#sheetBody').innerHTML = `<div class="menulist">${current.map(a => `<button class="menurow" data-select-account="${escapeHtml(a.id)}"><span class="menuico">${a.status === 'active' ? '●' : '◐'}</span><span class="menucopy"><strong>${escapeHtml(a.name)}</strong><small>${escapeHtml(a.type)} · ${statusText(a.status)} · 만기 ${formatDate(a.maturityAt)}</small></span><span class="menugo">${a.id === currentAccount().id ? '✓' : '›'}</span></button>`).join('') || '<div class="empty-state"><span>현재 합산 중인 ISA가 없습니다.</span></div>'}</div><div class="sectionhead" style="margin-top:15px"><h2 style="font-size:15px">이전 ISA</h2><button data-open-history>${past.length}개 회차 ›</button></div><div class="menulist">${past.map(a => `<button class="menurow" data-archive-open="${escapeHtml(a.id)}"><span class="menuico">○</span><span class="menucopy"><strong>${escapeHtml(a.name)}</strong><small>${statusText(a.status)} · ${formatDate(a.closedAt || a.maturityAt)} · 읽기 전용</small></span><span class="menugo">›</span></button>`).join('') || '<div class="empty-state"><span>이전 ISA가 없습니다.</span></div>'}</div>`; openSheet('#detailSheet'); $$('[data-select-account]').forEach((b) => b.onclick = async () => { setting().selectedAccountId = b.dataset.selectAccount; setting().compositionGroup = ''; setting().compositionFocus = ''; setting().dividendKey = ''; transactionDisplayLimit = 50; dividendDisplayLimit = 50; rememberViewPreferences(); closeSheets(); nav('isa', 'summary'); }); $$('[data-archive-open]').forEach((b) => b.onclick = () => openArchivedAccountDetail(b.dataset.archiveOpen || '')); $('[data-open-history]')?.addEventListener('click', () => { closeSheets(); nav('isa', 'history'); }); }
function isaTradeCandidateFromForm(form, type, editId = '') { const data = new FormData(form), account = currentAccount(), old = editId ? account.transactions.find(t => t.id === editId) : null, date = String(data.get('tradeDate') || ''); const tx = { ...clone(old || {}), id: old?.id || 'isa-form-preview', type, tradeDate: date, date, settlementDate: String(data.get('settlementDate') || '') || null, sequence: old && txDate(old) === date && Number.isFinite(Number(old.sequence)) ? Number(old.sequence) : nextSequence(account, date), createdAt: old?.createdAt || new Date().toISOString(), note: String(data.get('note') || ''), fee: Number(data.get('fee')) || 0, tax: Number(data.get('tax')) || 0, revisions: clone(old?.revisions || []) }; if (['buy', 'sell', 'dividend', 'distribution'].includes(type))
    tx.holdingId = String(data.get('holdingId') || ''); if (['buy', 'sell'].includes(type)) {
    tx.qty = Number(data.get('qty'));
    tx.price = Number(data.get('price'));
}
else
    tx.amount = Number(data.get('amount')); return tx; }
function isaTradeFormError(form, type, editId = '', complete = false) { const data = new FormData(form), isTrade = ['buy', 'sell'].includes(type), required = isTrade ? ['qty', 'price'] : ['amount']; if (!complete && required.some(name => !String(data.get(name) || '')))
    return ''; const account = currentAccount(), tx = isaTradeCandidateFromForm(form, type, editId), dateError = isaTransactionDateError(account, tx.date || ''); if (dateError)
    return dateError; const numericError = transactionNumericError(tx); if (numericError)
    return numericError; tx.idempotencyKey = stableTxKey(tx); const duplicate = findDuplicateTransaction(account, tx, editId || ''); if (duplicate)
    return `같은 거래가 이미 있습니다. ${formatDate(txDate(duplicate))} ${typeText(duplicate.type)}`; const candidate = editId ? account.transactions.map(t => t.id === editId ? tx : { ...t }) : [...account.transactions.map(t => ({ ...t })), tx], result = replay(account, candidate); if (!result.valid)
    return result.error || '거래 값을 확인해 주세요.'; if (type === 'buy' && transactionPositionValue(getHolding(account, tx.holdingId), Number(tx.qty) || 0, Number(tx.price) || 0) + (tx.fee || 0) + (tx.tax || 0) > accountMetrics(account).cash + 1e-8)
    return 'ISA 계좌 현금이 부족합니다. 통합 납입 또는 현금 유입을 먼저 기록해 주세요.'; return ''; }
const openTransactionFormWithoutInlineValidation = openTransactionForm;
openTransactionForm = function (...args) { openTransactionFormWithoutInlineValidation(...args); const form = $('#txForm'); if (!form)
    return; const type = String(args[0] || ''), editId = String(args[1] || ''); form.querySelector('.form-actions')?.insertAdjacentHTML('beforebegin', formValidationMarkup()); const live = (event) => { if (!['qty', 'price', 'amount', 'fee', 'tax', 'tradeDate', 'holdingId'].includes(event.target?.name || ''))
    return; const error = isaTradeFormError(form, type, editId, false); if (error)
    formShowError(form, error);
else
    formClearError(form); }; form.addEventListener('input', live); form.addEventListener('change', live); const submit = form.onsubmit; form.onsubmit = (event) => { const error = isaTradeFormError(form, type, editId, true); if (error) {
    event.preventDefault();
    formShowError(form, error);
    toast(error);
    return;
} submit?.call(form, event); }; };
;
/* asset-os source: chart-dividends.js */
"use strict";
'use strict';
let dividendYearRange = '10y', dividendChartMode = 'bar';
function dividendPeriodData(a, period) {
    const d = dividendModel(a, true), year = localYmd().slice(0, 4), key = setting().dividendKey || '';
    if (period === 'month') {
        const entries = Array.from({ length: 12 }, (_, i) => { const k = `${year}-${String(i + 1).padStart(2, '0')}`, value = d.ds.filter(x => txDate(x).startsWith(k)).reduce((sum, x) => sum + (Number(x.amount) || 0), 0); return { key: k, label: String(i + 1) + '월', short: String(i + 1), value }; }), list = d.ds.filter(x => txDate(x).startsWith(key || year));
        return { title: `${year}년 월별`, entries, list, selected: key };
    }
    if (period === 'year') {
        const years = [...new Set(d.ds.map(x => txDate(x).slice(0, 4)).filter(Boolean))].sort(), entries = years.map(y => ({ key: y, label: y + '년', short: y.slice(2), value: d.ds.filter(x => txDate(x).startsWith(y)).reduce((sum, x) => sum + (Number(x.amount) || 0), 0) })), list = key ? d.ds.filter(x => txDate(x).startsWith(key)) : d.ds;
        return { title: '연도별', entries, list, selected: key };
    }
    return { title: '최근 배당내역', entries: [], list: d.ds, selected: '' };
}
function dividendAnalysisMarkup(a = currentAccount(), initialPeriod = '') {
    const period = ['month', 'year', 'recent'].includes(initialPeriod) ? initialPeriod : (setting().dividendPeriod || 'month'), model = dividendPeriodData(a, period);
    setting().dividendPeriod = period;
    const allYearPoints = period === 'year' ? model.entries : [], points = period === 'year' ? incomeYearRangePoints(model.entries, dividendYearRange) : model.entries, fallback = period === 'recent' ? null : points.filter(x => x.value > 0).at(-1), selected = period === 'recent' ? null : (points.find(x => x.key === model.selected) || fallback), yieldData = selected ? dividendYieldFor(a, selected.key, period, selected.value) : null, sorted = [...model.list].sort((x, y) => txDate(y).localeCompare(txDate(x)) || txSequence(y) - txSequence(x)), visible = period === 'recent' ? sorted.slice(0, 3) : [], recentHtml = `<div class="composition-holdings compact-income-detail"><div class="sectionhead"><h2 style="font-size:13px">최근 내역</h2><span class="count-pill">최대 3건</span></div><div class="dividend-list compact-dividend-list">${visible.length ? visible.map(x => `<button class="dividend-row" data-d-detail="${escapeHtml(x.id)}"><span class="rowcopy"><strong>${escapeHtml(holdingName(a, x.holdingId))}</strong><small>${formatDate(txDate(x))}${x.linkedBuyId ? '<span class="linked-tag">매수 연결됨</span>' : ''}</small></span><span class="rowamount positive">${won(x.amount)}</span></button>`).join('') : '<div class="empty-state"><span>배당내역이 없습니다.</span></div>'}</div></div>`;
    return commonIncomeAnalysisMarkup({ mode: period, points, selected, rate: yieldData?.rate ?? null, modeAttr: 'data-dividend-period', pointAttr: 'data-dividend-key', amountTerm: '배당금', rateTerm: '배당수익률', focusNote: selected ? (yieldData && yieldData.principal > 0 ? `${period === 'month' ? '월말' : '연말'} 투자원금 ${won(yieldData.principal)} 기준` : '해당 기간 투자원금 없음') : '', recentHtml, yearly: period === 'year', caption: period === 'year' && dividendChartMode === 'line' ? '연간 배당금의 장기 성장 흐름입니다. 점을 누르면 해당 연도를 확인합니다.' : '막대를 누르면 해당 기간 배당금과 배당수익률을 확인합니다.', yearRange: dividendYearRange, rangeAttr: 'data-dividend-range', chartMode: dividendChartMode, chartModeAttr: 'data-dividend-chart', totalYearCount: incomeRecordSpanYears(dividendAnalysisRecords(a)) });
}
function dividendAnalysisSheetMarkup(a = currentAccount(), initialPeriod = '') { const d = dividendModel(a, true), year = localYmd().slice(0, 4), yearTotal = d.ds.filter(x => txDate(x).startsWith(year)).reduce((n, x) => n + (Number(x.amount) || 0), 0), yearRate = dividendYieldFor(a, year, 'year', yearTotal).rate, latest = d.ds[0]; return `<div class="analysis-sheet-summary"><div class="dividend-metrics compact-four"><div class="dividend-metric emphasis"><span>누적 배당</span><strong>${won(d.total)}</strong></div><div class="dividend-metric"><span>${year}년 수령</span><strong>${won(yearTotal)}</strong></div><div class="dividend-metric"><span>${year} 배당률</span><strong>${yearRate == null ? '계산 전' : yearRate.toFixed(2) + '%'}</strong></div><div class="dividend-metric"><span>최근 수령</span><strong>${latest ? won(latest.amount) : '-'}</strong><small>${latest ? escapeHtml(holdingName(a, latest.holdingId)) : '내역 없음'}</small></div></div></div>${dividendAnalysisMarkup(a, initialPeriod)}`; }
function bindDividendAnalysisInline() { const rerender = (preferLatest = false) => { const body = $('#sheetBody'); if (!body)
    return; const saved = captureIncomeChartScroll(); body.innerHTML = dividendAnalysisSheetMarkup(currentAccount()); bindDividendAnalysisInline(); restoreIncomeChartScroll(saved, preferLatest); }, selectKey = async (key) => { setting().dividendKey = setting().dividendKey === key ? '' : key; dividendDisplayLimit = 50; rememberViewPreferences(); rerender(false); }; $$('[data-dividend-period]').forEach(b => b.onclick = async () => { setting().dividendPeriod = (b.dataset.dividendPeriod || ''); setting().dividendKey = ''; dividendDisplayLimit = 50; rememberViewPreferences(); rerender(true); }); $$('[data-dividend-range]').forEach(b => b.onclick = () => { dividendYearRange = ['5y', '10y', '20y', 'all'].includes((b.dataset.dividendRange || '')) ? (b.dataset.dividendRange || '') : '10y'; setting().dividendKey = ''; rerender(true); }); $$('[data-dividend-chart]').forEach(b => b.onclick = () => { dividendChartMode = (b.dataset.dividendChart || '') === 'line' ? 'line' : 'bar'; setting().dividendKey = ''; rerender(false); }); $$('[data-dividend-key]').forEach(b => { b.onclick = async () => (await selectKey((b.dataset.dividendKey || ''))); b.onkeydown = async (e) => { if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    (await selectKey((b.dataset.dividendKey || '')));
} }; }); $('[data-dividend-clear]')?.addEventListener('click', async () => { setting().dividendKey = ''; dividendDisplayLimit = 50; rememberViewPreferences(); rerender(false); }); $$('[data-d-detail]').forEach(b => b.onclick = () => openTransactionDetail((b.dataset.dDetail || ''))); }
function openDividendAnalysis(initialPeriod = '') { dividendDisplayLimit = 50; dividendYearRange = '10y'; dividendChartMode = 'bar'; if (['month', 'year', 'recent'].includes(initialPeriod))
    setting().dividendPeriod = initialPeriod; $('#sheetEyebrow').textContent = 'ISA'; $('#sheetTitle').textContent = '배당 분석'; $('#sheetBody').innerHTML = dividendAnalysisSheetMarkup(currentAccount(), initialPeriod); openSheet('#detailSheet', { variant: 'income-analysis' }); setTimeout(bindDividendAnalysisInline, 0); }
function openDividendSaved(tx) { $('#actionTitle').textContent = '배당 저장 완료'; $('#actionGrid').innerHTML = `<button class="action" data-dividend-done><strong>완료</strong><small>계좌 현금에 ${won(dividendNetAmount(tx))} 반영</small></button><button class="action" data-dividend-buy><strong>이어서 매수</strong><small>같은 종목의 매수 화면 열기</small></button>`; openSheet('#actionSheet'); $('[data-dividend-done]').onclick = () => { closeSheets(); toast('배당금을 저장했습니다.'); }; $('[data-dividend-buy]').onclick = () => openTransactionForm('buy', null, tx.holdingId, tx.id); }
;
/* asset-os source: isa-maturity-policy.js */
'use strict';
function isaDateAddDays(value, days) { const d = new Date(`${value}T12:00:00`); if (Number.isNaN(d.getTime()))
    return ''; d.setDate(d.getDate() + Number(days || 0)); return localYmd(d); }
function isaDateAddYears(value, years) { const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!match)
    return ''; const year = Number(match[1]) + Math.trunc(Number(years) || 0), month = Number(match[2]), day = Math.min(Number(match[3]), new Date(Date.UTC(year, month, 0)).getUTCDate()); return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`; }
function maturityActualValues(formData, transfer = false) { const actualSettlement = Number(formData.get('actualSettlement')), actualTax = Number(formData.get('actualTax')), actualResult = Number(formData.get(transfer ? 'actualTransferAmount' : 'actualReceived')), values = [actualSettlement, actualTax, actualResult]; if (values.some(value => !Number.isFinite(value) || value < 0))
    return { ok: false, error: '만기 실제값은 0원 이상의 숫자로 입력해 주세요.' }; if (actualTax > actualSettlement)
    return { ok: false, error: '실제 납부세금은 실제 정산금액을 초과할 수 없습니다.' }; if (actualResult + actualTax > actualSettlement)
    return { ok: false, error: transfer ? '실제 전환금액과 세금의 합은 실제 정산금액을 초과할 수 없습니다.' : '실제 수령액과 세금의 합은 실제 정산금액을 초과할 수 없습니다.' }; return { ok: true, actualSettlement, actualTax, ...(transfer ? { actualTransferAmount: actualResult } : { actualReceived: actualResult }) }; }
function openMaturityForm() { const a = currentAccount(), m = a.maturity; if (!m)
    return; if (m.linkedLedgerIds?.length)
    return toast('현금·연금에 연결된 정산입니다. 백업 후 연결 거래를 함께 확인해 주세요.'); const transfer = m.decision === 'transfer'; $('#formEyebrow').textContent = '만기 결과 수정'; $('#formTitle').textContent = transfer ? '연금전환 실제값' : '일반 해지 실제값'; $('#formBody').innerHTML = `<form id="maturityForm" class="form"><div class="field"><label>실제 정산금액</label><input name="actualSettlement" type="number" value="${escapeHtml(m.actualSettlement || 0)}"></div><div class="field"><label>실제 납부세금</label><input name="actualTax" type="number" value="${escapeHtml(m.actualTax || 0)}"></div>${transfer ? `<div class="field"><label>실제 전환금액</label><input name="actualTransferAmount" type="number" value="${escapeHtml(m.actualTransferAmount || 0)}"></div><div class="field"><label>전환 대상</label><select name="transferTarget"><option ${m.transferTarget === 'IRP' ? 'selected' : ''}>IRP</option><option ${m.transferTarget === '연금저축' ? 'selected' : ''}>연금저축</option></select></div>` : `<div class="field"><label>실제 수령액</label><input name="actualReceived" type="number" value="${escapeHtml(m.actualReceived || 0)}"></div>`}<div class="warningbox">예상값은 그대로 보관하고 실제값만 수정합니다. 비교 화면에서 둘 다 확인할 수 있습니다.</div><div class="form-actions one"><button class="form-btn primary">실제값 저장</button></div></form>`; openSheet('#formSheet'); $('#maturityForm').onsubmit = async (e) => { e.preventDefault(); const fd = new FormData(e.target), actual = maturityActualValues(fd, transfer); if (!actual.ok)
    return toast(actual.error); m.actualSettlement = actual.actualSettlement; m.actualTax = actual.actualTax; if (transfer) {
    m.actualTransferAmount = actual.actualTransferAmount;
    m.transferTarget = String(fd.get('transferTarget'));
}
else
    m.actualReceived = actual.actualReceived; if (!(await persist()))
    return; closeSheets(); render(); toast('만기 실제값을 수정했습니다.'); }; }
function openTransferCalculator() { const p = policy('isa', currentAccount()); $('#formEyebrow').textContent = '만기 연금전환'; $('#formTitle').textContent = '예상 절세 계산'; $('#formBody').innerHTML = `<form id="transferForm" class="form"><div class="field"><label>전환 예정금액</label><input name="amount" type="number" value="30000000"></div><div class="readonly-row"><span>적용 세액공제율</span><strong>${(p.taxCreditRate * 100).toFixed(1)}%</strong></div><div id="transferPreview" class="form-preview"></div><div class="lock-note">세율과 전환 규칙은 ISA 화면에서 수정할 수 없습니다. 설정 → 제도 관리에서 새 버전으로 변경합니다.</div><div class="form-actions one"><button type="button" class="form-btn primary" id="closeCalc">확인</button></div></form>`; openSheet('#formSheet'); const form = $('#transferForm'), preview = $('#transferPreview'); const calc = () => { const fd = new FormData(form), amount = Number(fd.get('amount')), base = Math.min(amount * p.transferDeductionRate, p.transferDeductionMax); preview.innerHTML = `추가 공제대상 한도 <strong>${won(base)}</strong><br>예상 추가 세액공제 <strong>${won(base * p.taxCreditRate)}</strong>`; }; form.oninput = calc; calc(); $('#closeCalc').onclick = closeSheets; }
function openPolicyReadonly(kind = 'isa', policyId = '') { const group = policyGroup(kind), p = policyId ? (group.versions.find((v) => v.id === policyId) || policy(kind)) : policy(kind), title = kind === 'isa' ? 'ISA 제도' : kind === 'pension' ? '연금저축 제도' : 'IRP 제도'; const rows = kind === 'isa' ? [['적용 제도', p.name], ['일반형 비과세', won(p.generalExemption)], ['서민형 비과세', won(p.lowIncomeExemption)], ['농어민형 비과세', won(p.farmerExemption)], ['초과분 표시세율', (p.taxRate * 100).toFixed(1) + '%'], ['연간 납입한도', won(p.annualLimit)], ['누적 납입한도', won(p.totalContributionLimit || 100000000)], ['미사용 한도 이월', p.carryoverEnabled === false ? '미적용' : '적용'], ['중도인출 후 한도', p.withdrawalRestoresLimit ? '복원' : '복원 안 됨'], ['의무기간', p.mandatoryYears + '년'], ['동시 보유 가능 계좌', Number(p.concurrentAccountLimit || 1) + '개'], ['기존 ISA와 동시 보유', p.coexistWithOtherIsa ? '가능' : '불가'], ['납입한도 적용', p.annualLimitScope === 'account' ? '계좌별' : '개인 합산'], ['ISA 만기 연금전환', `해지 후 ${Number(p.transferWindowDays) || 60}일 이내 · 전환액의 ${(p.transferDeductionRate * 100).toFixed(0)}% · 최대 ${won(p.transferDeductionMax)}`], ['기본 세액공제율', (p.taxCreditRate * 100).toFixed(1) + '%']] : kind === 'pension' ? [['적용 제도', p.name], ['연금계좌 연간 납입한도', won(p.annualContributionLimit || 18000000)], ['연금저축 공제한도', won(p.annualTaxCreditLimit)], ['연금계좌 합산한도', won(p.combinedTaxCreditLimit)], ['일반 공제율', (p.taxCreditRate * 100).toFixed(1) + '%'], ['저소득 구간 공제율', (p.lowIncomeTaxCreditRate * 100).toFixed(1) + '%']] : [['적용 제도', p.name], ['연금계좌 합산한도', won(p.combinedTaxCreditLimit)], ['위험자산 한도', (p.riskyAssetLimit * 100).toFixed(0) + '%'], ['일반 공제율', (p.taxCreditRate * 100).toFixed(1) + '%'], ['저소득 구간 공제율', (p.lowIncomeTaxCreditRate * 100).toFixed(1) + '%']]; $('#sheetEyebrow').textContent = '읽기 전용'; $('#sheetTitle').textContent = title; $('#sheetBody').innerHTML = `<div class="readonly-list">${rows.map(([l, v]) => `<div class="readonly-row"><span>${l}</span><strong>${escapeHtml(v)}</strong></div>`).join('')}</div><div class="source-note">${escapeHtml(p.sourceLabel)} 기준 · 적용 시작 ${formatDate(p.effectiveFrom)} · 확인 ${formatDate(p.verifiedAt)}<br>실제 금융회사 정산과 법령 개정에 따라 달라질 수 있습니다.</div><button class="diagnostic-action" data-open-policy-hub>설정의 제도 관리로 이동</button>`; openSheet('#detailSheet'); $('[data-open-policy-hub]')?.addEventListener('click', async () => (await openPolicyHub(kind))); }
function policyTitle(kind) { return kind === 'isa' ? 'ISA' : kind === 'pension' ? '개인연금' : 'IRP'; }
function policySummary(kind, p) { return kind === 'isa' ? [['비과세', `${won(p.generalExemption)} / ${won(p.lowIncomeExemption)}`], ['초과세율', `${(p.taxRate * 100).toFixed(1)}%`], ['연간한도', won(p.annualLimit)], ['누적한도', won(p.totalContributionLimit || 100000000)], ['미사용 이월', p.carryoverEnabled === false ? '미적용' : '적용'], ['의무기간', `${p.mandatoryYears}년`], ['동시계좌', `${Number(p.concurrentAccountLimit || 1)}개`], ['기존 ISA 동시', p.coexistWithOtherIsa ? '가능' : '불가']] : kind === 'pension' ? [['연간납입', won(p.annualContributionLimit || 18000000)], ['공제한도', won(p.annualTaxCreditLimit)], ['합산한도', won(p.combinedTaxCreditLimit)], ['공제율', `${(p.taxCreditRate * 100).toFixed(1)}%`], ['저소득', `${(p.lowIncomeTaxCreditRate * 100).toFixed(1)}%`]] : [['합산한도', won(p.combinedTaxCreditLimit)], ['위험자산', `${(p.riskyAssetLimit * 100).toFixed(0)}%`], ['공제율', `${(p.taxCreditRate * 100).toFixed(1)}%`], ['저소득', `${(p.lowIncomeTaxCreditRate * 100).toFixed(1)}%`]]; }
function openNewIsaAccount(policyId) {
    const p = policyGroup('isa').versions.find(v => v.id === policyId) || policy('isa', currentAccount()), opened = ymd(), maturity = addYears(opened, p.mandatoryYears || 3), active = state.accounts.filter(isCurrentAccount), limit = Number(p.concurrentAccountLimit || 1), blocked = active.length >= limit || (active.length && !p.coexistWithOtherIsa), blockMessage = active.length >= limit ? `현재 합산 중인 ISA가 ${active.length}개입니다. 이 제도는 동시 ${limit}개까지만 허용하도록 설정돼 있습니다.` : '이 제도는 기존 ISA와 동시 보유 불가로 설정돼 있습니다.';
    if (blocked) {
        showNotice('새 ISA 계좌를 만들 수 없습니다.', `${blockMessage}\n\n복수 ISA가 허용되는 새 제도를 별도로 만든 뒤 그 제도로 새 계좌를 생성해야 합니다.`);
        return;
    }
    $('#formEyebrow').textContent = 'ISA 계좌';
    $('#formTitle').textContent = '새 ISA 계좌 만들기';
    $('#formBody').innerHTML = `<form id="newIsaAccountForm" class="form"><div class="field"><label>계좌 이름</label><input name="name" value="새 ISA 계좌" required></div><div class="form-grid"><div class="field"><label>금융회사</label><input name="broker" value=""></div><div class="field"><label>계좌 유형</label><select name="type"><option>일반형</option><option>서민형</option><option>농어민형</option></select></div></div><div class="form-grid"><div class="field"><label>개설일</label><input name="openedAt" type="date" value="${escapeHtml(opened)}"></div><div class="field"><label>만기일</label><input name="maturityAt" type="date" value="${escapeHtml(maturity)}"></div></div><div class="source-note">적용 제도: <strong>${escapeHtml(p.name)}</strong><br>동시 보유 ${limit}개 · 기존 ISA 동시보유 ${p.coexistWithOtherIsa ? '가능' : '불가'}</div><div class="warningbox">실제 가입 가능 여부는 금융회사와 확정 제도를 확인해야 합니다. 앱의 제도 설정은 기록·검산용입니다.</div><div class="form-actions"><button type="button" class="form-btn" id="cancelNewIsa">취소</button><button class="form-btn primary">계좌 만들기</button></div></form>`;
    openSheet('#formSheet', { mode: 'input' });
    $('#cancelNewIsa').onclick = () => requestCloseSheets('cancel');
    $('#newIsaAccountForm').onsubmit = async (e) => { e.preventDefault(); const fd = new FormData(e.target), openedAt = String(fd.get('openedAt') || opened), maturityAt = String(fd.get('maturityAt') || maturity), openError = postedDateError(openedAt); if (openError)
        return toast(openError); if (!validYmdDate(maturityAt) || maturityAt <= openedAt)
        return toast('만기일은 개설일 이후의 올바른 날짜여야 합니다.'); const account = { id: uid('isa'), name: String(fd.get('name') || '새 ISA 계좌'), broker: String(fd.get('broker') || ''), type: String(fd.get('type') || '일반형'), status: 'active', openedAt, maturityAt, policyId: p.id, policyHistory: [{ policyId: p.id, effectiveFrom: openedAt, effectiveTo: null }], baselineDate: openedAt, baselineCash: 0, cashOpening: 0, annualContribution: 0, contributionBaseline: 0, contributionBaselineYear: String(businessYear()), carryoverLimit: 0, withdrawnPrincipal: 0, taxBreakdown: { gains: 0, losses: 0, dividends: 0, expenses: 0 }, holdings: [], transactions: [], maturity: null }; state.accounts.push(account); setting().selectedAccountId = account.id; if (!(await persist())) {
        state.accounts.pop();
        return;
    } sheetDirty = false; closeSheets(); nav('isa', 'summary'); toast('새 ISA 계좌를 만들었습니다.'); };
}
function assignPolicyToAccount(accountId, policyId, effectiveFrom = ymd()) {
    const a = state.accounts.find(x => x.id === accountId), target = policyGroup('isa').versions.find(v => v.id === policyId), applyDate = String(effectiveFrom || ymd());
    if (!a || !target)
        return { ok: false, error: '계좌 또는 제도를 찾지 못했습니다.' };
    if (a.status !== 'active')
        return { ok: false, error: '운영 중인 ISA 계좌에만 제도를 적용할 수 있습니다.' };
    if (['proposal', 'retired'].includes(String(target.status || '')))
        return { ok: false, error: '제안·폐기 상태의 제도는 계좌 계산에 적용할 수 없습니다.' };
    if (target.effectiveFrom && applyDate < String(target.effectiveFrom))
        return { ok: false, error: `이 제도는 ${formatDate(target.effectiveFrom)}부터 적용할 수 있습니다.` };
    if ((a.openedAt || a.baselineDate) && applyDate < String(a.openedAt || a.baselineDate))
        return { ok: false, error: '계좌 개설일보다 앞선 날짜로 제도를 적용할 수 없습니다.' };
    if (a.policyId === policyId)
        return { ok: false, error: '이미 이 계좌에 적용 중인 제도입니다.' };
    a.policyHistory = Array.isArray(a.policyHistory) ? a.policyHistory : [];
    const current = a.policyHistory.find((x) => !x.effectiveTo);
    if (current?.effectiveFrom && applyDate < String(current.effectiveFrom))
        return { ok: false, error: '현재 제도의 적용 시작일보다 앞선 날짜로 변경할 수 없습니다.' };
    if (current)
        current.effectiveTo = applyDate;
    a.policyHistory.push({ policyId, effectiveFrom: applyDate, effectiveTo: null });
    a.policyId = policyId;
    return { ok: true };
}
function openPolicyAssignment(id) {
    const group = policyGroup('isa'), target = group.versions.find((v) => v.id === id);
    if (!target)
        return toast('제도 버전을 찾지 못했습니다.');
    const active = state.accounts.filter(a => a.status === 'active');
    $('#sheetEyebrow').textContent = 'ISA 제도 적용';
    $('#sheetTitle').textContent = target.name;
    $('#sheetBody').innerHTML = `<div class="source-note">제도를 저장하는 것과 계좌에 적용하는 것은 분리됩니다. 적용할 계좌 하나를 선택하거나 새 계좌를 만드세요.</div><div class="policy-account-list">${active.map(a => { const current = policy('isa', a); return `<div class="policy-account-row"><div><strong>${escapeHtml(a.name)}</strong><small>현재 ${escapeHtml(current.name)}${a.policyId === target.id ? ' · 이미 적용됨' : ''}</small></div><button data-assign-policy="${escapeHtml(a.id)}" ${a.policyId === target.id ? 'disabled' : ''}>${a.policyId === target.id ? '적용 중' : '이 계좌에 적용'}</button></div>`; }).join('') || '<div class="empty-state"><span>운영 중 ISA 계좌가 없습니다.</span></div>'}</div><button class="diagnostic-action" data-new-account-policy="${escapeHtml(target.id)}">＋ 이 제도로 새 ISA 계좌 만들기</button>`;
    openSheet('#detailSheet');
    $$('[data-assign-policy]').forEach(b => b.onclick = () => { const a = state.accounts.find(x => x.id === b.dataset.assignPolicy); if (!a)
        return; showDialog({ title: '제도를 계좌에 적용할까요?', message: `${a.name}에 ${target.name}을 적용합니다. 과거 적용 이력은 보존됩니다.`, confirmText: '계좌에 적용' }, async () => { const result = (await assignPolicyToAccount(a.id, target.id)); if (!result.ok)
        return toast(result.error); if (!(await persist()))
        return; (await openPolicyHub('isa')); render(); toast('선택한 계좌에만 제도를 적용했습니다.'); }); });
    $('[data-new-account-policy]')?.addEventListener('click', () => openNewIsaAccount(target.id));
}
function applyPolicyVersion(kind, id) {
    const group = policyGroup(kind), target = group.versions.find((v) => v.id === id);
    if (!target)
        return toast('제도 버전을 찾지 못했습니다.');
    if (['proposal', 'retired'].includes(String(target.status || '')))
        return toast('제안·폐기 상태의 제도는 계좌에 적용할 수 없습니다.');
    if (target.effectiveFrom && ymd() < String(target.effectiveFrom))
        return toast(`${formatDate(target.effectiveFrom)}부터 적용할 수 있는 제도입니다.`);
    if (kind === 'isa')
        return openPolicyAssignment(id);
    showDialog({ title: '기본 제도로 적용할까요?', message: `${target.name}을 기본 적용 제도로 사용합니다.`, confirmText: '적용' }, async () => { const previous = group.versions.find((v) => v.id === group.activePolicyId); group.applicationHistory = Array.isArray(group.applicationHistory) ? group.applicationHistory : []; if (!group.applicationHistory.length && previous)
        group.applicationHistory.push({ policyId: previous.id, effectiveFrom: previous.effectiveFrom || '1900-01-01' }); group.applicationHistory.push({ policyId: id, effectiveFrom: ymd() }); group.activePolicyId = id; if (!(await persist()))
        return; (await openPolicyHub(kind)); render(); toast('기본 적용 제도를 변경했습니다.'); });
}
function recordIsaLifecycle(accountId, input) {
    const a = state.accounts.find(x => x.id === accountId);
    if (!a || !isCurrentAccount(a))
        return { ok: false, error: '운영 중인 ISA를 선택해 주세요.' };
    const date = String(input.date || ''), dateError = postedDateError(date);
    if (dateError)
        return { ok: false, error: dateError };
    if (date < String(a.openedAt || ''))
        return { ok: false, error: '개설일 이전에는 처리할 수 없습니다.' };
    const futureTransactions = [...(a.transactions || []), ...centralIsaReplayRows(a)].some(t => t.status !== 'cancelled' && txDate(t) > date);
    if (futureTransactions)
        return { ok: false, error: '처리일 이후 거래가 있습니다. 해당 거래를 먼저 확인해 주세요.' };
    if (input.action === 'extend') {
        const next = String(input.maturityAt || '');
        if (!validYmdDate(next) || next <= String(a.maturityAt || date) || next <= date)
            return { ok: false, error: '기존 만기일보다 늦은 새 만기일을 입력해 주세요.' };
        a.lifecycleHistory = [...(a.lifecycleHistory || []), { action: 'extend', date, previousMaturityAt: a.maturityAt, maturityAt: next }];
        a.maturityAt = next;
        a.status = 'active';
        return { ok: true };
    }
    if (input.action === 'pending') {
        if (date < String(a.maturityAt || ''))
            return { ok: false, error: '만기일부터 대기 상태로 기록할 수 있습니다.' };
        a.status = 'maturity_pending';
        a.lifecycleHistory = [...(a.lifecycleHistory || []), { action: 'pending', date }];
        return { ok: true };
    }
    if (!['close', 'transfer'].includes(input.action || ''))
        return { ok: false, error: '처리 유형을 선택해 주세요.' };
    if (input.action === 'transfer') {
        const terminationDate = String(input.terminationDate || date), eligibleFrom = [String(a.maturityAt || ''), isaDateAddYears(String(a.openedAt || ''), Number(policy('isa', a).mandatoryYears) || 3)].filter(Boolean).sort()[0] || '';
        if (!validYmdDate(terminationDate) || terminationDate > date)
            return { ok: false, error: 'ISA 해지일은 연금 이전일과 같거나 이전이어야 합니다.' };
        if (eligibleFrom && terminationDate < eligibleFrom)
            return { ok: false, error: 'ISA 만기 또는 의무가입기간 3년 경과 후 해지한 자금만 연금으로 전환할 수 있습니다.' };
        if (date > isaDateAddDays(terminationDate, Number(policy('isa', a).transferWindowDays) || 60))
            return { ok: false, error: 'ISA 해지일로부터 60일 이내에 이전한 금액만 기록할 수 있습니다.' };
    }
    const settlement = Number(input.settlement), tax = Number(input.tax), transfer = Number(input.transfer || 0);
    if ([settlement, tax, transfer].some(x => !Number.isFinite(x) || x < 0) || tax > settlement || transfer > settlement - tax)
        return { ok: false, error: '정산금액·세금·전환금액을 확인해 주세요.' };
    const target = input.action === 'transfer' ? pensionStore().accounts.find(p => p.id === input.targetAccountId && pensionAccountActiveOnDate(p, date)) : null;
    if (input.action === 'transfer' && (!target || transfer <= 0))
        return { ok: false, error: '전환할 연금계좌와 금액을 입력해 주세요.' };
    if (input.action === 'close' && transfer !== 0)
        return { ok: false, error: '일반 해지는 전환금액을 0원으로 입력해 주세요.' };
    const before = clone(state), linked = centralIsaContributionRows().filter(t => t.accountId === a.id).reduce((n, t) => n + Number(t.amount), 0), received = settlement - tax - transfer, rows = [], meta = { isaLifecycleAccountId: a.id };
    if (linked > 0)
        rows.push({ id: uid('isa-close'), date, type: 'externalAssetOut', amount: linked, fromAccountId: 'isa-link', category: 'ISA 원금 정산', meta });
    if (received > 0)
        rows.push({ id: uid('isa-close'), date, type: 'externalAssetIn', amount: received, toAccountId: 'cash-main', category: 'ISA 해지 수령', meta });
    if (transfer > 0)
        rows.push({ id: uid('isa-transfer'), date, type: 'externalAssetIn', amount: transfer, toAccountId: target.kind === 'irp' ? 'irp-link' : 'pension-link', category: 'ISA 만기 연금 이전', meta: { ...meta, isaTransfer: true, targetPensionAccountId: target.id } });
    const metrics = accountMetrics(a), appliedPolicy = policy('isa', a), taxDeductionBase = Math.min(transfer * (Number(appliedPolicy.transferDeductionRate) || 0), Number(appliedPolicy.transferDeductionMax) || 0);
    a.lifecycleHistory = [...(a.lifecycleHistory || []), { action: input.action, date, settlement, tax, transfer, received }];
    a.maturity = { decision: input.action === 'transfer' ? 'transfer' : 'close', actualSettlement: settlement, actualTax: tax, actualReceived: received, actualTransferAmount: transfer, transferTarget: target ? (target.kind === 'irp' ? 'IRP' : '연금저축') : '', transferTargetAccountId: target?.id || '', expectedSettlement: metrics.value, expectedTransferAmount: transfer, taxDeductionBase, expectedTaxCredit: taxDeductionBase * (Number(appliedPolicy.taxCreditRate) || 0), expectedTax: expectedTax(a), linkedLedgerIds: rows.map(t => t.id) };
    for (const h of a.holdings) {
        const snapshot = metrics.holdings.find(x => x.id === h.id);
        if (snapshot) {
            h.snapshotQty = snapshot.qty;
            h.snapshotAvg = snapshot.avgPrice;
            h.snapshotPrice = snapshot.currentPrice;
        }
    }
    a.cashSnapshot = metrics.cash;
    a.closedAt = date;
    a.status = input.action === 'transfer' ? 'transferred' : 'closed';
    integratedStore().ledger.push(...rows);
    for (const sc of financeSchedules())
        if (sc.targetIsaAccountId === a.id) {
            sc.active = false;
            sc.endDate = date;
        }
    const issues = [...integratedIssues(), ...(typeof integratedPolicyLimitIssues === 'function' ? integratedPolicyLimitIssues() : [])];
    if (issues.length) {
        state = before;
        return { ok: false, error: issues[0] };
    }
    return { ok: true };
}
function openIsaLifecycleForm() {
    const a = currentAccount();
    if (!isCurrentAccount(a))
        return;
    const targets = pensionStore().accounts.filter(p => p.status === 'active');
    $('#formEyebrow').textContent = 'ISA · 회차 관리';
    $('#formTitle').textContent = '연장·만기 결과 기록';
    $('#formBody').innerHTML = `<form id="isaLifecycleForm" class="form"><div class="field"><label>처리</label><select name="action"><option value="extend">만기 연장</option><option value="pending">만기 처리 대기</option><option value="close">해지 결과 기록</option><option value="transfer">해지 후 연금 이전 기록</option></select></div><div class="field"><label>실제 처리일 · 이전일</label><input name="date" type="date" value="${escapeHtml(localYmd())}" required></div><div class="field" data-life-extension><label>새 만기일</label><input name="maturityAt" type="date" value="${escapeHtml(a.maturityAt || '')}"></div><div data-life-settlement hidden><div class="field"><label>증권사 정산금액 · 세전</label><input name="settlement" type="number" min="0" value="${escapeHtml(Math.round(accountMetrics(a).value))}"></div><div class="field"><label>실제 세금</label><input name="tax" type="number" min="0" value="0"></div></div><div data-life-transfer hidden><div class="field"><label>ISA 실제 해지일</label><input name="terminationDate" type="date" value="${escapeHtml(localYmd())}"></div><div class="field"><label>연금 이전금액</label><input name="transfer" type="number" min="0" value="0"></div><div class="field"><label>이전 계좌</label><select name="targetAccountId">${targets.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join('')}</select></div><div class="source-note">만기 또는 가입 3년 경과 후 해지하고, 해지일로부터 60일 이내 이전한 경우만 추가공제를 계산합니다.</div></div><div class="source-note">금융회사에서 완료한 결과를 기록합니다. 세후 정산액 중 연금 이전액을 제외한 금액은 생활현금에 반영됩니다.</div><button class="form-btn primary">결과 저장</button></form>`;
    openSheet('#formSheet', { mode: 'input' });
    const form = $('#isaLifecycleForm');
    form.elements.action.onchange = () => { const action = form.elements.action.value; $('[data-life-extension]').hidden = action !== 'extend'; $('[data-life-settlement]').hidden = !['close', 'transfer'].includes(action); $('[data-life-transfer]').hidden = action !== 'transfer'; };
    form.onsubmit = async (e) => { e.preventDefault(); const d = Object.fromEntries(new FormData(form)); if (d.action !== 'transfer')
        d.transfer = 0; const before = clone(state), r = recordIsaLifecycle(a.id, d); if (!r.ok)
        return toast(r.error); if (!(await persist())) {
        state = before;
        return;
    } sheetDirty = false; closeSheets(); render(); toast('ISA 처리 결과를 저장했습니다.'); };
}
;
/* asset-os source: integrated-finance-ui.js */
"use strict";
'use strict';
async function openFinancialProductHub(filter = 'all') { setting().policyTab = 'finance'; rememberViewPreferences(); const products = financialProducts(), active = products.filter(p => p.status === 'active' && (filter === 'all' || p.type === filter)), ended = products.filter(p => p.status === 'ended' && (filter === 'all' || p.type === filter)), filters = [['all', '전체'], ['deposit', '예금'], ['savings', '적금·청약'], ['parking', '파킹·CMA'], ['loan', '대출']], card = (p) => { const bal = financeProductBalance(p), rate = Number(p.annualRate) || 0, term = p.maturityDate ? `만기 ${formatDate(p.maturityDate)}` : (p.termMonths ? `${p.termMonths}개월` : '만기 없음'), sub = financeSubtypeLabel(p), pay = financeContributionLabel(p); return `<button class="finance-product-card ${p.status === 'ended' ? 'ended' : ''}" data-finance-product="${escapeHtml(p.id)}"><div><strong>${escapeHtml(p.name)} <span class="finance-status-pill ${p.status === 'active' ? 'active' : ''}">${p.status === 'active' ? '진행' : '종료'}</span></strong><div class="finance-card-badges">${sub ? `<span class="finance-mini-badge accent">${escapeHtml(sub)}</span>` : ''}<span class="finance-mini-badge">${escapeHtml(financeRateTypeLabel(p))}</span>${pay ? `<span class="finance-mini-badge">${escapeHtml(pay)}</span>` : ''}</div><small>${escapeHtml(p.institution || financeProductTypeLabel(p.type))} · 현재 연 ${rate.toFixed(2)}% · ${term}<br>${p.type === 'loan' ? '남은 원금' : '현재 기록 잔액'} ${won(bal)}</small></div><b>›</b></button>`; }; $('#sheetEyebrow').textContent = '설정'; $('#sheetTitle').textContent = '제도·상품 관리'; $('#sheetBody').innerHTML = `<div class="policy-tabs">${[['isa', 'ISA'], ['pension', '개인연금'], ['irp', 'IRP'], ['finance', '금융상품']].map(([k, l]) => `<button class="policy-tab ${k === 'finance' ? 'active' : ''}" data-policy-tab="${escapeHtml(k)}">${l}</button>`).join('')}</div><div class="finance-toolbar"><strong>금융상품 설정</strong><button data-finance-new>＋ 상품 추가</button></div><div class="source-note">금리·기간·납입·상환 규칙은 여기서 관리하고, 실제 금액은 거래 기록으로 자동 계산합니다. 종료된 상품은 삭제하지 않고 보관합니다.</div><div class="finance-type-filter">${filters.map(([k, l]) => `<button class="${escapeHtml(filter === k ? 'active' : '')}" data-finance-filter="${escapeHtml(k)}">${l}</button>`).join('')}</div><div class="finance-product-list">${active.length ? active.map(card).join('') : '<div class="integrated-empty">진행 중인 상품이 없습니다.</div>'}</div><div class="finance-archive-title">종료된 상품 · ${ended.length}개</div><div class="finance-product-list">${ended.length ? ended.map(card).join('') : '<div class="integrated-empty">종료 보관함이 비어 있습니다.</div>'}</div>`; openSheet('#detailSheet'); $$('[data-policy-tab]').forEach(b => b.onclick = async () => (await openPolicyHub(b.dataset.policyTab || 'finance'))); $('[data-finance-new]')?.addEventListener('click', () => openFinancialProductForm()); $$('[data-finance-filter]').forEach(b => b.onclick = async () => (await openFinancialProductHub(b.dataset.financeFilter || 'all'))); $$('[data-finance-product]').forEach(b => b.onclick = () => openFinancialProductDetail(b.dataset.financeProduct || '')); }
function financialProductFormMarkup(p = null) { const type = p?.type || 'deposit', tax = p?.taxMode || 'unknown'; return `<form id="financialProductForm" class="form" data-product-id="${escapeHtml(p?.id || '')}"><div class="finance-form-note real">상품의 규칙만 저장합니다. 현재 금액은 기초잔액·납입·출금·상환 기록으로 자동 계산됩니다.</div><div class="field"><label>상품 종류</label><select name="type" ${p ? 'disabled' : ''}><option value="deposit" ${type === 'deposit' ? 'selected' : ''}>예금</option><option value="savings" ${type === 'savings' ? 'selected' : ''}>적금·청약</option><option value="parking" ${type === 'parking' ? 'selected' : ''}>파킹·CMA</option><option value="loan" ${type === 'loan' ? 'selected' : ''}>대출</option></select></div><div class="form-grid"><div class="field"><label>이름</label><input name="name" value="${escapeHtml(p?.name || '')}" placeholder="예: 상품명" required></div><div class="field"><label>금융기관</label><input name="institution" value="${escapeHtml(p?.institution || '')}" placeholder="선택"></div></div><div class="form-grid"><div class="field"><label>시작일</label><input name="startDate" type="date" value="${escapeHtml(p?.startDate || '')}"></div><div class="field"><label>만기일 <small>없으면 비움</small></label><input name="maturityDate" type="date" value="${escapeHtml(p?.maturityDate || '')}"></div></div><div class="form-grid"><div class="field"><label>기간 (개월)</label><input name="termMonths" type="number" min="0" value="${escapeHtml(Number(p?.termMonths) || '')}" placeholder="선택"></div><div class="field"><label>현재 적용금리 (%)</label><input name="annualRate" type="number" min="0" step="0.01" value="${escapeHtml(Number(p?.annualRate) || '')}" placeholder="예: 4.50"></div></div><div class="form-grid"><div class="field"><label>금리 방식</label><select name="rateType"><option value="unknown" ${p?.rateType === 'unknown' || !p ? 'selected' : ''}>미확인</option><option value="fixed" ${p?.rateType === 'fixed' ? 'selected' : ''}>고정</option><option value="variable" ${p?.rateType === 'variable' ? 'selected' : ''}>변동</option></select></div><div class="field" data-finance-field="interest"><label>이자 계산</label><select name="interestMethod"><option value="unknown" ${p?.interestMethod === 'unknown' || !p ? 'selected' : ''}>미확인</option><option value="simple" ${p?.interestMethod === 'simple' ? 'selected' : ''}>단리</option><option value="compound" ${p?.interestMethod === 'compound' ? 'selected' : ''}>복리</option></select></div></div><div class="form-grid" data-finance-field="tax"><div class="field"><label>과세</label><select name="taxMode"><option value="unknown" ${tax === 'unknown' ? 'selected' : ''}>미확인</option><option value="general" ${tax === 'general' ? 'selected' : ''}>일반과세</option><option value="taxfree" ${tax === 'taxfree' ? 'selected' : ''}>비과세</option><option value="custom" ${tax === 'custom' ? 'selected' : ''}>직접설정</option></select></div><div class="field"><label>이자 세율 (%)</label><input name="taxRate" type="number" min="0" step="0.1" value="${escapeHtml(Number(p?.taxRate) || '')}" placeholder="선택"></div></div><div class="form-grid" data-finance-field="saving"><div class="field"><label>납입 방식</label><select name="paymentStyle"><option value="monthly" ${p?.paymentStyle === 'monthly' ? 'selected' : ''}>정액</option><option value="free" ${p?.paymentStyle === 'free' ? 'selected' : ''}>자유</option><option value="lump" ${p?.paymentStyle === 'lump' ? 'selected' : ''}>일시</option></select></div><div class="field"><label>월 기준 납입액</label><input name="scheduledAmount" type="number" min="0" step="1" value="${escapeHtml(Number(p?.scheduledAmount) || '')}" placeholder="선택"></div></div><div class="form-grid" data-finance-field="saving"><div class="field"><label>납입일</label><input name="paymentDay" type="number" min="1" max="31" value="${escapeHtml(Number(p?.paymentDay) || '')}" placeholder="선택"></div><div class="field"><label>납입 상태</label><select name="contributionStatus"><option value="active" ${p?.contributionStatus === 'active' ? 'selected' : ''}>납입 중</option><option value="free" ${p?.contributionStatus === 'free' ? 'selected' : ''}>자유납입</option><option value="paused" ${p?.contributionStatus === 'paused' ? 'selected' : ''}>납입 중단</option></select></div></div><div data-finance-field="loan"><div class="field"><label>상환 방식</label><select name="repaymentMethod"><option value="unknown" ${p?.repaymentMethod === 'unknown' || !p ? 'selected' : ''}>미확인</option><option value="equalPayment" ${p?.repaymentMethod === 'equalPayment' ? 'selected' : ''}>원리금균등</option><option value="equalPrincipal" ${p?.repaymentMethod === 'equalPrincipal' ? 'selected' : ''}>원금균등</option><option value="bullet" ${p?.repaymentMethod === 'bullet' ? 'selected' : ''}>만기일시</option><option value="interestOnly" ${p?.repaymentMethod === 'interestOnly' ? 'selected' : ''}>이자만 납부</option><option value="custom" ${p?.repaymentMethod === 'custom' ? 'selected' : ''}>직접관리</option></select></div><details class="finance-extra"><summary>대출 추가 조건</summary><div class="form-grid"><div class="field"><label>최초 계약금액 <small>알면 입력</small></label><input name="contractPrincipal" type="number" min="0" step="1" value="${escapeHtml(Number(p?.contractPrincipal) || '')}"></div><div class="field"><label>거치기간 (개월)</label><input name="graceMonths" type="number" min="0" value="${escapeHtml(Number(p?.graceMonths) || '')}"></div></div><div class="form-grid"><div class="field"><label>변동주기 (개월)</label><input name="rateChangeMonths" type="number" min="0" value="${escapeHtml(Number(p?.rateChangeMonths) || '')}"></div><div class="field"><label>중도상환수수료 (%)</label><input name="prepaymentFeeRate" type="number" min="0" step="0.01" value="${escapeHtml(Number(p?.prepaymentFeeRate) || '')}"></div></div><div class="field"><label>중도상환수수료 종료일</label><input name="prepaymentFeeUntil" type="date" value="${escapeHtml(p?.prepaymentFeeUntil || '')}"></div></details></div><details class="finance-extra"><summary>메모·금리이력</summary><div class="field"><label>이번 금리 적용일</label><input name="rateEffectiveFrom" type="date" value="${escapeHtml(p?.rateHistory?.at(-1)?.effectiveFrom || p?.startDate || ymd())}"></div><div class="field"><label>메모</label><input name="memo" value="${escapeHtml(p?.memo || '')}"></div></details><button class="integrated-form-save" type="submit">${p ? '수정 저장' : '상품 저장'}</button></form>`; }
function syncFinancialProductForm() { const f = $('#financialProductForm'); if (!f)
    return; const type = f.elements.type.value, isLoan = type === 'loan', isSaving = type === 'savings'; $$('[data-finance-field="loan"]').forEach(x => x.classList.toggle('hidden-field', !isLoan)); $$('[data-finance-field="tax"],[data-finance-field="interest"]').forEach(x => x.classList.toggle('hidden-field', isLoan)); $$('[data-finance-field="saving"]').forEach(x => x.classList.toggle('hidden-field', !isSaving)); const tax = f.elements.taxMode; if (tax && f.elements.taxRate) {
    f.elements.taxRate.disabled = ['taxfree', 'unknown'].includes(tax.value);
    if (['taxfree', 'unknown'].includes(tax.value))
        f.elements.taxRate.value = '0';
    else if (tax.value === 'general' && Number(f.elements.taxRate.value) === 0)
        f.elements.taxRate.value = '15.4';
} }
function openFinancialProductForm(id = '') { const p = id ? financialProduct(id) : null; $('#formEyebrow').textContent = '설정 · 금융상품'; $('#formTitle').textContent = p ? '상품 수정' : '상품 추가'; $('#formBody').innerHTML = financialProductFormMarkup(p); openSheet('#formSheet', { mode: 'input' }); syncFinancialProductForm(); const f = $('#financialProductForm'); if (!p)
    f.elements.type.addEventListener('change', () => { syncFinancialProductForm(); sheetDirty = true; }); f.elements.taxMode?.addEventListener('change', () => { syncFinancialProductForm(); sheetDirty = true; }); f.addEventListener('input', () => sheetDirty = true); f.addEventListener('submit', async (e) => { e.preventDefault(); (await saveFinancialProduct(e.currentTarget)); }); }
async function saveFinancialProduct(form) { const d = new FormData(form), id = form.dataset.productId || uid('fp'), old = financialProduct(id), type = old?.type || String(d.get('type') || 'deposit'), name = String(d.get('name') || '').trim(), startDate = String(d.get('startDate') || ''), maturityDate = String(d.get('maturityDate') || ''); if (!name)
    return toast('상품 이름을 입력해 주세요.'); if (startDate && !validYmdDate(startDate))
    return toast('시작일을 확인해 주세요.'); if (maturityDate && !validYmdDate(maturityDate))
    return toast('만기일을 확인해 주세요.'); if (startDate && maturityDate && maturityDate < startDate)
    return toast('만기일은 시작일보다 빠를 수 없습니다.'); const rawRate = Number(d.get('annualRate')), annualRate = Number.isFinite(rawRate) ? Math.max(0, rawRate) : 0, rateEffectiveFrom = String(d.get('rateEffectiveFrom') || startDate || ymd()), rateHistory = old ? clone(old.rateHistory || []) : []; if (rateEffectiveFrom && !validYmdDate(rateEffectiveFrom))
    return toast('금리 적용일을 확인해 주세요.'); if (rateEffectiveFrom > ymd())
    return toast('현재 적용금리의 적용일은 미래일 수 없습니다.'); if (startDate && rateEffectiveFrom < startDate)
    return toast('금리 적용일은 상품 시작일보다 빠를 수 없습니다.'); const rateIndex = rateHistory.findIndex(r => r.effectiveFrom === rateEffectiveFrom); if (rateIndex >= 0)
    rateHistory[rateIndex] = { effectiveFrom: rateEffectiveFrom, rate: annualRate };
else
    rateHistory.push({ effectiveFrom: rateEffectiveFrom, rate: annualRate }); rateHistory.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)); const p = { ...(old || {}), id, type, name, institution: String(d.get('institution') || '').trim(), status: old?.status || 'active', startDate, maturityDate, termMonths: Math.max(0, Number(d.get('termMonths')) || 0), annualRate, rateType: String(d.get('rateType') || 'fixed'), interestMethod: String(d.get('interestMethod') || 'simple'), taxMode: String(d.get('taxMode') || 'unknown'), taxRate: Math.max(0, Number(d.get('taxRate')) || 0), paymentStyle: String(d.get('paymentStyle') || 'monthly'), scheduledAmount: Math.max(0, Number(d.get('scheduledAmount')) || 0), paymentDay: Math.min(31, Math.max(0, Number(d.get('paymentDay')) || 0)), contributionStatus: String(d.get('contributionStatus') || 'active'), repaymentMethod: String(d.get('repaymentMethod') || 'unknown'), contractPrincipal: Math.max(0, Number(d.get('contractPrincipal')) || 0), graceMonths: Math.max(0, Number(d.get('graceMonths')) || 0), rateChangeMonths: Math.max(0, Number(d.get('rateChangeMonths')) || 0), prepaymentFeeRate: Math.max(0, Number(d.get('prepaymentFeeRate')) || 0), prepaymentFeeUntil: String(d.get('prepaymentFeeUntil') || ''), memo: String(d.get('memo') || '').trim(), rateHistory }; if (old) {
    const idx = financialProducts().findIndex(x => x.id === id);
    state.financialProducts.items[idx] = p;
}
else
    state.financialProducts.items.push(p); syncFinancialProductStructures(state); if (!(await persist()))
    return; sheetDirty = false; closeSheets(); render(); setTimeout(async () => (await openFinancialProductHub(type)), 60); toast(old ? '상품 설정을 수정했습니다.' : '상품을 저장했습니다.'); }
function financeEventMarkup(p) { const events = financeProductEvents(p.id).slice(-5).reverse(); if (!events.length)
    return ''; return `<div class="finance-event-list">${events.map(e => { const err = financeProductEventError(e, p); return `<div class="finance-event-row"><span>${escapeHtml(e.label || e.type)}${err ? ' <span class="module-unverified">검토 필요</span>' : ''}<small>${escapeHtml(e.date || '날짜 없음')}${e.note ? ` · ${escapeHtml(e.note)}` : ''}${err ? ` · ${escapeHtml(err)}` : ''}</small></span><strong>${won(e.amount)}</strong></div>`; }).join('')}</div>`; }
function openFinancialProductDetail(id) { const p = financialProduct(id); if (!p)
    return toast('상품을 찾지 못했습니다.'); const bal = financeProductBalance(p), est = financeProductInterestEstimate(p, p.maturityDate || localYmd()), rates = p.rateHistory || [], benefit = financeProductBenefitBalance(p), recentInterest = financeProductRecentInterest(p), condition = p.type === 'loan' ? `상환 ${{ equalPayment: '원리금균등', equalPrincipal: '원금균등', bullet: '만기일시', interestOnly: '이자만 납부', custom: '직접관리', unknown: '미확인' }[String(p.repaymentMethod)] || '미확인'}` : `${financeInterestMethodLabel(p)} · ${financeTaxLabel(p)}`, sub = financeSubtypeLabel(p), pay = financeContributionLabel(p); $('#sheetEyebrow').textContent = `금융상품 · ${financeProductTypeLabel(p.type)}`; $('#sheetTitle').textContent = p.name; $('#sheetBody').innerHTML = `<div class="policy-card"><div class="policy-card-head"><div><strong>${escapeHtml(p.institution || financeProductTypeLabel(p.type))}</strong><small>${p.startDate ? formatDate(p.startDate) : '시작일 미확인'}${p.maturityDate ? ` → ${formatDate(p.maturityDate)}` : ' · 만기 없음'}</small><div class="finance-card-badges" style="margin-top:6px">${sub ? `<span class="finance-mini-badge accent">${escapeHtml(sub)}</span>` : ''}<span class="finance-mini-badge">${escapeHtml(financeRateTypeLabel(p))}</span>${pay ? `<span class="finance-mini-badge">${escapeHtml(pay)}</span>` : ''}</div></div><span class="finance-status-pill ${p.status === 'active' ? 'active' : ''}">${p.status === 'active' ? '진행 중' : financeEndReasonLabel(p.endReason)}</span></div><div class="finance-product-summary"><div><span>${p.type === 'loan' ? '남은 원금' : '현재 기록 잔액'}</span><strong>${won(bal)}</strong></div><div><span>현재 적용금리</span><strong>연 ${Number(p.annualRate || 0).toFixed(2)}%</strong></div><div><span>조건</span><strong>${escapeHtml(condition)}</strong></div><div><span>${p.type === 'loan' ? '최초 계약금액' : '예상 세후이자'}</span><strong class="${escapeHtml((!p.contractPrincipal && p.type === 'loan') || est.unknown ? 'finance-unknown' : '')}">${p.type === 'loan' ? (p.contractPrincipal ? won(p.contractPrincipal) : '미확인') : (est.unknown ? '조건 확인 후 계산' : won(est.net))}</strong></div>${benefit ? `<div class="wide"><span>정부기여금 누적 · 현재자산 미포함</span><strong>${won(benefit)}</strong></div>` : ''}${recentInterest ? `<div class="wide"><span>최근 확인 이자${recentInterest.meta?.periodStart ? ` · ${escapeHtml(recentInterest.meta.periodStart)}~${escapeHtml(recentInterest.meta.periodEnd || '')}` : ''}</span><strong>${won(recentInterest.amount)}</strong></div>` : ''}</div>${p.settlement ? `<div class="finance-settlement-box"><strong>${financeEndReasonLabel(p.endReason)} 완료</strong>${formatDate(p.settlement.date)} · ${p.type === 'loan' ? '대출 상환 완료' : `실제 수령 ${won(p.settlement.received || 0)}`}</div>` : ''}${rates.length > 1 ? `<div class="integrated-month-detail-group"><strong>금리 변경 이력</strong>${rates.map(r => `<div class="integrated-month-detail-row"><span>${escapeHtml(r.effectiveFrom)}</span><strong>${Number(r.rate).toFixed(2)}%</strong></div>`).join('')}</div>` : ''}${financeEventMarkup(p)}<div class="source-note">현재 잔액은 상품 설정값이 아니라 실제 기록에서 계산합니다. 미확인 조건은 임의로 추정하지 않습니다.</div></div>${p.status === 'active' ? `<div class="finance-detail-actions">${p.type === 'loan' ? `${bal <= 0.5 ? `<button class="primary" data-finance-action="openingLoan" data-product-id="${escapeHtml(p.id)}">시작 원금 기록</button>` : `<button class="primary" data-finance-action="repay" data-product-id="${escapeHtml(p.id)}">원금 상환</button><button data-finance-action="payoff" data-product-id="${escapeHtml(p.id)}">완납 처리</button>`}<button data-finance-action="interest" data-product-id="${escapeHtml(p.id)}">이자 기록</button>` : `<button class="primary" data-finance-action="deposit" data-product-id="${escapeHtml(p.id)}">납입 기록</button><button data-finance-action="withdraw" data-product-id="${escapeHtml(p.id)}">출금 기록</button><button data-finance-action="interestCredit" data-product-id="${escapeHtml(p.id)}">이자 입금</button>${p.governmentSupport ? `<button data-finance-action="support" data-product-id="${escapeHtml(p.id)}">정부기여금</button>` : ''}${bal > 0.5 ? `<button data-finance-action="settle" data-product-id="${escapeHtml(p.id)}">만기·해지 정산</button>` : `<button data-finance-action="openingAsset" data-product-id="${escapeHtml(p.id)}">기초잔액 기록</button>`}`}<button data-finance-edit="${escapeHtml(p.id)}">설정 수정</button>${bal <= 0.5 ? `<button class="danger" data-finance-end="${escapeHtml(p.id)}">종료 보관</button>` : ''}</div>` : ''}`; openSheet('#detailSheet'); $('[data-finance-edit]')?.addEventListener('click', (e) => openFinancialProductForm(e.currentTarget.dataset.financeEdit || '')); $('[data-finance-end]')?.addEventListener('click', (e) => endFinancialProduct(e.currentTarget.dataset.financeEnd || '')); $$('[data-finance-action]').forEach(b => b.onclick = () => openFinancialProductTransaction(b.dataset.productId || '', b.dataset.financeAction || '')); }
function openFinanceMovementForm(id, action, { amount = '', endAfter = false } = {}) { const p = financialProduct(id); if (!p)
    return; const isLoan = p.type === 'loan', labels = { deposit: '납입', withdraw: '출금', repay: '원금 상환', interest: '이자 납부', payoff: '완납' }, title = labels[action] || '거래'; $('#formEyebrow').textContent = `금융상품 · ${financeProductTypeLabel(p.type)}`; $('#formTitle').textContent = title; const trackedLabel = action === 'withdraw' ? '현금·입출금으로 받기' : '현금·입출금에서 지급', outsideLabel = action === 'withdraw' ? '앱 밖 계좌로 받기' : '앱 밖 계좌에서 지급'; $('#formBody').innerHTML = `<form id="financeMoveForm" class="form" data-product-id="${escapeHtml(id)}" data-action="${escapeHtml(action)}" data-end-after="${escapeHtml(endAfter ? '1' : '0')}"><div class="finance-form-note">실제 돈이 움직인 날과 금액을 기록합니다. 아직 생활계좌 잔액을 관리하지 않는다면 ‘앱 밖 계좌’를 선택할 수 있습니다.</div><div class="form-grid"><div class="field"><label>날짜</label><input name="date" type="date" value="${escapeHtml(ymd())}" required></div><div class="field"><label>금액</label><input name="amount" type="number" min="1" step="1" value="${escapeHtml(amount || '')}" required></div></div><div class="field"><label>자금 경로</label><div class="finance-source-choice"><label><input type="radio" name="source" value="outside" checked>${outsideLabel}</label><label><input type="radio" name="source" value="tracked">${trackedLabel}</label></div></div>${['repay', 'payoff'].includes(action) ? '<div class="field"><label>실제 중도상환 수수료 <small>없으면 0원</small></label><input name="repaymentFee" type="number" min="0" step="1" value="0"></div>' : ''}<div class="field"><label>메모 <small>선택</small></label><input name="note" value=""></div><button class="integrated-form-save">저장</button></form>`; openSheet('#formSheet', { mode: 'input' }); $('#financeMoveForm').onsubmit = async (e) => { e.preventDefault(); (await saveFinanceMovement(e.currentTarget)); }; }
async function saveFinanceMovement(form) { const id = form.dataset.productId || '', p = financialProduct(id); if (!p)
    return; const d = new FormData(form), action = form.dataset.action || '', date = String(d.get('date') || ymd()), amount = Number(d.get('amount')) || 0, source = String(d.get('source') || 'outside'), note = String(d.get('note') || '').trim(); if (amount <= 0)
    return toast('금액을 입력해 주세요.'); const asset = financeProductAccountId(id), debt = financeProductLiabilityId(id), base = { id: uid('igl'), date, amount, category: `${p.name} ${action === 'deposit' ? '납입' : action === 'withdraw' ? '출금' : action === 'interest' ? '이자' : action === 'payoff' ? '완납' : '원금상환'}`, note, productId: id, meta: { fundingSource: source } }; let tx; if (action === 'deposit')
    tx = source === 'tracked' ? { ...base, type: 'internalTransfer', fromAccountId: 'cash-main', toAccountId: asset } : { ...base, type: 'externalAssetIn', toAccountId: asset };
else if (action === 'withdraw')
    tx = source === 'tracked' ? { ...base, type: 'internalTransfer', fromAccountId: asset, toAccountId: 'cash-main' } : { ...base, type: 'externalAssetOut', fromAccountId: asset };
else if (['repay', 'payoff'].includes(action))
    tx = source === 'tracked' ? { ...base, type: 'debtPrincipal', fromAccountId: 'cash-main', liabilityId: debt } : { ...base, type: 'externalDebtPrincipal', liabilityId: debt };
else if (action === 'interest')
    tx = source === 'tracked' ? { ...base, type: 'debtInterest', fromAccountId: 'cash-main', liabilityId: debt } : { ...base, type: 'debtInterestExternal', liabilityId: debt };
else
    return; const fee = ['repay', 'payoff'].includes(action) ? Number(d.get('repaymentFee') || 0) : 0; if (!Number.isFinite(fee) || fee < 0)
    return toast('중도상환 수수료를 0원 이상 입력해 주세요.'); const err = integratedValidateCandidate(tx, ''); if (err)
    return toast(err); const ledger = integratedStore().ledger, originalLength = ledger.length; ledger.push(tx); if (fee > 0) {
    const feeTx = { id: uid('igl'), date, type: source === 'tracked' ? 'expense' : 'externalExpense', amount: fee, fromAccountId: source === 'tracked' ? 'cash-main' : undefined, fixed: false, category: `${p.name} 중도상환 수수료`, note, productId: id, meta: { fundingSource: source, repaymentOf: tx.id } };
    const feeError = integratedValidateCandidate(feeTx, '');
    if (feeError) {
        ledger.splice(originalLength);
        return toast(feeError);
    }
    ledger.push(feeTx);
} if (action === 'payoff' && financeProductBalance(p) <= 0.5) {
    p.status = 'ended';
    p.endedAt = date;
    p.endReason = 'paidOff';
    p.settlement = { date, received: 0 };
    closeFinanceProductSchedules(p.id, date);
} setting().integratedMonth = integratedMonthKey(date); setting().integratedLedgerFilter = 'all'; integratedLedgerSearch = ''; if (!(await persist()))
    return; sheetDirty = false; closeSheets(); render(); setTimeout(() => openFinancialProductDetail(id), 60); toast(action === 'payoff' ? '완납 기록을 저장했습니다.' : '거래를 저장했습니다.'); }
function openFinanceBenefitForm(id) { const p = financialProduct(id); if (!p)
    return; $('#formEyebrow').textContent = '금융상품 · 지원금'; $('#formTitle').textContent = '정부기여금 기록'; $('#formBody').innerHTML = `<form id="financeBenefitForm" class="form" data-product-id="${escapeHtml(id)}"><div class="finance-form-note">정부기여금은 납입원금과 분리해 누적합니다. 현재 총자산에는 자동 합산하지 않습니다.</div><div class="form-grid"><div class="field"><label>날짜</label><input name="date" type="date" value="${escapeHtml(ymd())}" required></div><div class="field"><label>기여금</label><input name="amount" type="number" min="1" step="1" required></div></div><div class="field"><label>메모</label><input name="note"></div><button class="integrated-form-save">저장</button></form>`; openSheet('#formSheet', { mode: 'input' }); $('#financeBenefitForm').onsubmit = async (e) => { e.preventDefault(); const d = new FormData(e.currentTarget), amount = Number(d.get('amount')) || 0, date = String(d.get('date') || ymd()); if (amount <= 0)
    return toast('기여금을 입력해 주세요.'); const dateError = financeEventDateError(p, date); if (dateError)
    return toast(dateError); state.financialProducts.events.push({ id: uid('finance-event'), productId: id, date, type: 'governmentContribution', amount, label: '정부기여금', note: String(d.get('note') || ''), meta: { includedInAsset: false } }); if (!(await persist()))
    return; sheetDirty = false; closeSheets(); render(); setTimeout(() => openFinancialProductDetail(id), 60); toast('정부기여금을 기록했습니다.'); }; }
function openFinanceInterestCreditForm(id) {
    const p = financialProduct(id);
    if (!p || p.type === 'loan')
        return;
    $('#formEyebrow').textContent = `금융상품 · ${financeProductTypeLabel(p.type)}`;
    $('#formTitle').textContent = '실제 이자 입금';
    $('#formBody').innerHTML = `<form id="financeInterestCreditForm" class="form" data-product-id="${escapeHtml(id)}"><div class="finance-form-note real">통장에 실제로 들어온 세후 이자를 기록합니다. 상품 잔액과 수입에는 반영하지만 외부 원금 유입으로 계산하지 않습니다.</div><div class="form-grid"><div class="field"><label>입금일</label><input name="date" type="date" value="${escapeHtml(ymd())}" required></div><div class="field"><label>세후 이자</label><input name="amount" type="number" min="1" step="1" required></div></div><details class="finance-extra"><summary>이자 계산 기간·메모</summary><div class="form-grid"><div class="field"><label>기간 시작</label><input name="periodStart" type="date"></div><div class="field"><label>기간 종료</label><input name="periodEnd" type="date"></div></div><div class="field"><label>메모</label><input name="note"></div></details><button class="integrated-form-save">이자 저장</button></form>`;
    openSheet('#formSheet', { mode: 'input' });
    $('#financeInterestCreditForm').onsubmit = async (event) => { event.preventDefault(); (await saveFinanceInterestCredit(event.currentTarget)); };
}
async function saveFinanceInterestCredit(form) {
    const id = form.dataset.productId || '', p = financialProduct(id);
    if (!p || p.type === 'loan')
        return;
    const data = new FormData(form), date = String(data.get('date') || ymd()), amount = Number(data.get('amount')) || 0, periodStart = String(data.get('periodStart') || ''), periodEnd = String(data.get('periodEnd') || ''), note = String(data.get('note') || '').trim();
    if (amount <= 0)
        return toast('실제 입금된 이자를 입력해 주세요.');
    const dateError = financeEventDateError(p, date);
    if (dateError)
        return toast(dateError);
    if (periodStart && !validYmdDate(periodStart))
        return toast('이자 기간 시작일을 확인해 주세요.');
    if (periodEnd && !validYmdDate(periodEnd))
        return toast('이자 기간 종료일을 확인해 주세요.');
    if (periodStart && periodEnd && periodEnd < periodStart)
        return toast('이자 기간 종료일은 시작일보다 빠를 수 없습니다.');
    const transaction = { id: uid('igl'), date, type: 'externalIncome', amount, toAccountId: financeProductAccountId(id), category: `${p.name} 이자`, note, productId: id, meta: { financeInterest: true } };
    const error = integratedValidateCandidate(transaction, '');
    if (error)
        return toast(error);
    const ledger = integratedStore().ledger, events = state.financialProducts.events, ledgerLength = ledger.length, eventLength = events.length;
    ledger.push(transaction);
    events.push({ id: uid('finance-event'), productId: id, date, type: 'interestObserved', amount, label: '실제 이자 입금', note, meta: { includedInAsset: true, ledgerId: transaction.id, periodStart, periodEnd } });
    setting().integratedMonth = integratedMonthKey(date);
    setting().integratedLedgerFilter = 'all';
    integratedLedgerSearch = '';
    if (!(await persist())) {
        ledger.splice(ledgerLength);
        events.splice(eventLength);
        return;
    }
    sheetDirty = false;
    closeSheets();
    render();
    setTimeout(() => openFinancialProductDetail(id), 60);
    toast('실제 이자를 반영했습니다.');
}
function openFinanceSettlementForm(id) { const p = financialProduct(id); if (!p)
    return; const bal = financeProductBalance(p); if (bal <= 0.5)
    return endFinancialProduct(id); $('#formEyebrow').textContent = `금융상품 · ${financeProductTypeLabel(p.type)}`; $('#formTitle').textContent = '만기·해지 정산'; $('#formBody').innerHTML = `<form id="financeSettlementForm" class="form" data-product-id="${escapeHtml(id)}"><div class="finance-form-note">실제로 받은 총액을 입력하면 원금은 현금으로 이동하고, 원금과의 차이는 이자·지원금 또는 해지차감으로 기록합니다.</div><div class="field"><label>종료 방식</label><select name="reason"><option value="maturity">만기수령</option><option value="earlyCancel">중도해지</option><option value="closed">해지</option></select></div><div class="form-grid"><div class="field"><label>정산일</label><input name="date" type="date" value="${escapeHtml(ymd())}" required></div><div class="field"><label>실제 받은 총액</label><input name="received" type="number" min="0" step="1" value="${escapeHtml(Math.round(bal))}" required></div></div><div class="finance-settlement-box"><strong>현재 기록 원금 ${won(bal)}</strong>정산 후 이 상품은 현재 자산에서 빠지고 종료 상품 보관함에 남습니다.</div><button class="integrated-form-save">정산·종료</button></form>`; openSheet('#formSheet', { mode: 'input' }); $('#financeSettlementForm').onsubmit = async (e) => { e.preventDefault(); (await saveFinanceSettlement(e.currentTarget)); }; }
async function saveFinanceSettlement(form) {
    const id = form.dataset.productId || '', p = financialProduct(id);
    if (!p)
        return;
    const d = new FormData(form), date = String(d.get('date') || ymd()), rawReceived = d.get('received'), received = Number(rawReceived), reason = String(d.get('reason') || 'closed');
    if (p.status !== 'active')
        return toast('이미 종료한 상품입니다.');
    const dateError = financeEventDateError(p, date);
    if (dateError)
        return toast(dateError);
    if (rawReceived === null || String(rawReceived).trim() === '' || !Number.isFinite(received) || received < 0)
        return toast('실제 받은 총액을 0원 이상 입력해 주세요.');
    const asset = financeProductAccountId(id), list = integratedStore().ledger;
    if (list.some((t) => String(t.date || '') > date && (t.productId === id || t.fromAccountId === asset || t.toAccountId === asset || t.accountId === asset)))
        return toast('정산일 이후 거래가 있습니다. 이후 거래를 먼저 확인해 주세요.');
    const bal = financeProductBalance(p), rows = [], diff = received - bal;
    if (bal > 0)
        rows.push({ id: uid('igl'), date, type: 'internalTransfer', amount: bal, fromAccountId: asset, toAccountId: 'cash-main', category: `${p.name} ${financeEndReasonLabel(reason)} 원금`, productId: id, note: '상품 종료 정산' });
    if (diff > 0.5)
        rows.push({ id: uid('igl'), date, type: 'externalIncome', amount: diff, toAccountId: 'cash-main', category: `${p.name} 이자·지원금 정산`, productId: id, note: '실제 수령액과 기록 원금의 차이' });
    else if (diff < -0.5)
        rows.push({ id: uid('igl'), date, type: 'expense', fixed: false, amount: Math.abs(diff), fromAccountId: 'cash-main', category: `${p.name} 해지차감`, productId: id, note: '실제 수령액과 기록 원금의 차이' });
    const originalLength = list.length;
    for (const row of rows) {
        const err = integratedValidateCandidate(row, '');
        if (err) {
            list.splice(originalLength);
            return toast(err);
        }
        list.push(row);
    }
    p.status = 'ended';
    p.endedAt = date;
    p.endReason = reason;
    p.settlement = { date, received, principal: bal, difference: diff };
    closeFinanceProductSchedules(p.id, date);
    setting().integratedMonth = integratedMonthKey(date);
    setting().integratedLedgerFilter = 'all';
    integratedLedgerSearch = '';
    if (!(await persist()))
        return;
    sheetDirty = false;
    closeSheets();
    render();
    setTimeout(() => openFinancialProductDetail(id), 60);
    toast(`${financeEndReasonLabel(reason)} 정산을 저장했습니다.`);
}
function openFinancialProductTransaction(id, action) { const p = financialProduct(id); if (!p)
    return; const asset = financeProductAccountId(id), debt = financeProductLiabilityId(id); if (action === 'deposit' || action === 'withdraw' || action === 'repay' || action === 'interest')
    return openFinanceMovementForm(id, action); if (action === 'payoff')
    return openFinanceMovementForm(id, 'payoff', { amount: Math.round(financeProductBalance(p)), endAfter: true }); if (action === 'support')
    return openFinanceBenefitForm(id); if (action === 'interestCredit')
    return openFinanceInterestCreditForm(id); if (action === 'settle')
    return openFinanceSettlementForm(id); if (action === 'openingLoan')
    return openIntegratedTransactionForm('', { uiType: 'openingLiability', liabilityId: debt, category: `${p.name} 시작 원금` }); if (action === 'openingAsset')
    return openIntegratedTransactionForm('', { uiType: 'openingAsset', toAccountId: asset, category: `${p.name} 기초잔액` }); }
function endFinancialProduct(id) { const p = financialProduct(id); if (!p || p.status !== 'active')
    return; const bal = financeProductBalance(p); if (bal > 0.5)
    return showNotice('아직 잔액이 남아 있습니다.', p.type === 'loan' ? `남은 원금 ${won(bal)}을 모두 상환한 뒤 종료할 수 있습니다.` : `${won(bal)}이 남아 있습니다. 만기·해지 정산을 이용해 주세요.`); showDialog({ title: '종료 상품으로 보관할까요?', message: '현재 계산 대상에서는 제외하고 종료된 상품 보관함에 계속 남깁니다.', confirmText: '종료 보관', cancelText: '취소' }, async () => { p.status = 'ended'; p.endedAt = ymd(); p.endReason = p.type === 'loan' ? 'paidOff' : 'closed'; p.settlement = p.settlement || { date: p.endedAt, received: 0 }; closeFinanceProductSchedules(p.id, p.endedAt || localYmd()); if (!(await persist()))
    return; closeSheets(); render(); setTimeout(async () => (await openFinancialProductHub(p.type)), 60); toast('종료된 상품으로 보관했습니다.'); }); }
;
/* asset-os source: ui-settings.js */
"use strict";
'use strict';
function openPolicyForm(kind = 'isa', mode = 'edit') { const group = policyGroup(kind), p = kind === 'isa' ? policy('isa', currentAccount()) : policy(kind, null), isNew = mode === 'new', label = policyTitle(kind); $('#formEyebrow').textContent = '설정 · 제도 관리'; $('#formTitle').textContent = isNew ? `새 ${label} 제도` : `${label} 제도 새 버전`; const suggested = isNew ? `${p.name} 새 제도` : `${p.name} 새 버전`, common = `<div class="form-grid"><div class="field"><label>제도명</label><input name="name" value="${escapeHtml(suggested)}" required></div><div class="field"><label>적용 시작일</label><input name="effectiveFrom" type="date" value="${escapeHtml(p.effectiveFrom || ymd())}"></div></div>`; let fields = kind === 'isa' ? `<div class="form-grid"><div class="field"><label>일반형 비과세</label><input name="general" type="number" value="${escapeHtml(p.generalExemption)}"></div><div class="field"><label>서민형 비과세</label><input name="low" type="number" value="${escapeHtml(p.lowIncomeExemption)}"></div></div><div class="form-grid"><div class="field"><label>농어민형 비과세</label><input name="farmer" type="number" value="${escapeHtml(p.farmerExemption)}"></div><div class="field"><label>초과분 표시세율 (%)</label><input name="taxRate" type="number" step="0.1" value="${escapeHtml(Number((p.taxRate * 100).toFixed(3)))}"></div></div><div class="form-grid"><div class="field"><label>연간 납입한도</label><input name="annual" type="number" value="${escapeHtml(p.annualLimit)}"></div><div class="field"><label>의무기간 (년)</label><input name="mandatory" type="number" value="${escapeHtml(p.mandatoryYears)}"></div></div><div class="form-grid"><div class="field"><label>동시 보유 가능 계좌 수</label><input name="concurrent" type="number" min="1" max="10" value="${escapeHtml(Number(p.concurrentAccountLimit || 1))}"></div><div class="field"><label>기존 ISA와 동시 보유</label><select name="coexist"><option value="no" ${p.coexistWithOtherIsa ? '' : 'selected'}>불가</option><option value="yes" ${p.coexistWithOtherIsa ? 'selected' : ''}>가능</option></select></div></div><div class="field"><label>납입한도 적용 방식</label><select name="limitScope"><option value="person" ${p.annualLimitScope !== 'account' ? 'selected' : ''}>개인 전체 합산</option><option value="account" ${p.annualLimitScope === 'account' ? 'selected' : ''}>계좌별 독립</option></select></div><div class="form-grid"><div class="field"><label>연금전환 추가한도율 (%)</label><input name="transferRate" type="number" step="0.1" value="${escapeHtml(Number((p.transferDeductionRate * 100).toFixed(3)))}"></div><div class="field"><label>추가한도 최대</label><input name="transferMax" type="number" value="${escapeHtml(p.transferDeductionMax)}"></div></div><div class="field"><label>기본 세액공제율 (%)</label><input name="creditRate" type="number" step="0.1" value="${escapeHtml(Number((p.taxCreditRate * 100).toFixed(3)))}"></div>` : kind === 'pension' ? `<div class="field"><label>연금계좌 연간 납입한도</label><input name="contributionLimit" type="number" value="${escapeHtml(p.annualContributionLimit || 18000000)}"></div><div class="form-grid"><div class="field"><label>연금저축 공제한도</label><input name="annualLimit" type="number" value="${escapeHtml(p.annualTaxCreditLimit)}"></div><div class="field"><label>연금계좌 합산한도</label><input name="combinedLimit" type="number" value="${escapeHtml(p.combinedTaxCreditLimit)}"></div></div><div class="form-grid"><div class="field"><label>일반 공제율 (%)</label><input name="rate" type="number" step="0.1" value="${escapeHtml(Number((p.taxCreditRate * 100).toFixed(3)))}"></div><div class="field"><label>저소득 구간 공제율 (%)</label><input name="lowRate" type="number" step="0.1" value="${escapeHtml(Number((p.lowIncomeTaxCreditRate * 100).toFixed(3)))}"></div></div>` : `<div class="form-grid"><div class="field"><label>연금계좌 합산한도</label><input name="combinedLimit" type="number" value="${escapeHtml(p.combinedTaxCreditLimit)}"></div><div class="field"><label>위험자산 한도 (%)</label><input name="riskLimit" type="number" step="1" value="${escapeHtml(Number((p.riskyAssetLimit * 100).toFixed(3)))}"></div></div><div class="form-grid"><div class="field"><label>일반 공제율 (%)</label><input name="rate" type="number" step="0.1" value="${escapeHtml(Number((p.taxCreditRate * 100).toFixed(3)))}"></div><div class="field"><label>저소득 구간 공제율 (%)</label><input name="lowRate" type="number" step="0.1" value="${escapeHtml(Number((p.lowIncomeTaxCreditRate * 100).toFixed(3)))}"></div></div>`; $('#formBody').innerHTML = `<form id="policyForm" class="form">${common}${fields}<div class="warningbox">${isNew ? '현재 제도를 복사해 별도 제도로 저장합니다.' : '현재 제도의 새 버전으로 저장합니다.'} 저장만 하며 기존 계좌에는 자동 적용하지 않습니다.</div><div class="form-actions"><button type="button" class="form-btn" id="resetPolicy">공식값 채우기</button><button class="form-btn primary">${isNew ? '새 제도 저장' : '새 버전 저장'}</button></div></form>`; openSheet('#formSheet'); $('#policyForm').onsubmit = async (e) => { e.preventDefault(); const fd = new FormData(e.target), base = { ...p, id: `${kind}-policy-user-${Date.now().toString(36)}`, policySetId: isNew ? uid(`${kind}-policy-set`) : (p.policySetId || p.id), name: String(fd.get('name') || suggested), version: '사용자', status: 'user', sourceLabel: '사용자 설정', verifiedAt: ymd(), userEdited: true, effectiveFrom: String(fd.get('effectiveFrom') || ymd()) }; if (kind === 'isa')
    Object.assign(base, { generalExemption: Number(fd.get('general')), lowIncomeExemption: Number(fd.get('low')), farmerExemption: Number(fd.get('farmer')), taxRate: Number(fd.get('taxRate')) / 100, annualLimit: Number(fd.get('annual')), mandatoryYears: Number(fd.get('mandatory')), concurrentAccountLimit: Math.max(1, Number(fd.get('concurrent')) || 1), coexistWithOtherIsa: fd.get('coexist') === 'yes', annualLimitScope: String(fd.get('limitScope') || 'person'), transferDeductionRate: Number(fd.get('transferRate')) / 100, transferDeductionMax: Number(fd.get('transferMax')), taxCreditRate: Number(fd.get('creditRate')) / 100 });
else if (kind === 'pension')
    Object.assign(base, { annualContributionLimit: Number(fd.get('contributionLimit')) || 18000000, annualTaxCreditLimit: Number(fd.get('annualLimit')), combinedTaxCreditLimit: Number(fd.get('combinedLimit')), taxCreditRate: Number(fd.get('rate')) / 100, lowIncomeTaxCreditRate: Number(fd.get('lowRate')) / 100 });
else
    Object.assign(base, { combinedTaxCreditLimit: Number(fd.get('combinedLimit')), riskyAssetLimit: Number(fd.get('riskLimit')) / 100, taxCreditRate: Number(fd.get('rate')) / 100, lowIncomeTaxCreditRate: Number(fd.get('lowRate')) / 100 }); group.versions.push(base); if (!(await persist()))
    return; closeSheets(); render(); setTimeout(async () => (await openPolicyHub(kind)), 70); toast(isNew ? '새 제도를 별도로 저장했습니다.' : '새 제도 버전을 별도로 저장했습니다.'); }; $('#resetPolicy').onclick = () => { const official = group.versions.find(v => !v.userEdited); if (!official)
    return toast('공식 기본값을 찾지 못했습니다.'); const form = $('#policyForm'), map = { generalExemption: 'general', lowIncomeExemption: 'low', farmerExemption: 'farmer', taxRate: 'taxRate', annualLimit: 'annual', mandatoryYears: 'mandatory', concurrentAccountLimit: 'concurrent', coexistWithOtherIsa: 'coexist', annualLimitScope: 'limitScope', transferDeductionRate: 'transferRate', transferDeductionMax: 'transferMax', taxCreditRate: kind === 'isa' ? 'creditRate' : 'rate', annualContributionLimit: 'contributionLimit', annualTaxCreditLimit: 'annualLimit', combinedTaxCreditLimit: 'combinedLimit', lowIncomeTaxCreditRate: 'lowRate', riskyAssetLimit: 'riskLimit' }; Object.entries(official).forEach(([k, v]) => { const name = map[k], el = name ? form.elements.namedItem(name) : null; if (!el)
    return; if (name === 'coexist')
    el.value = v ? 'yes' : 'no';
else if (name === 'limitScope')
    el.value = String(v || 'person');
else
    el.value = ['taxRate', 'transferRate', 'creditRate', 'rate', 'lowRate', 'riskLimit'].includes(name) ? String(Number((Number(v) * 100).toFixed(3))) : String(v); }); toast('공식값을 입력칸에 채웠습니다.'); }; }
async function openPolicyHub(initialKind = '', financeFilter = 'all') { if (initialKind === 'finance')
    return (await openFinancialProductHub(financeFilter)); const kind = ['isa', 'pension', 'irp'].includes(initialKind) ? initialKind : (['isa', 'pension', 'irp'].includes(setting().policyTab) ? setting().policyTab : 'isa'); setting().policyTab = kind; rememberViewPreferences(); const group = policyGroup(kind), p = kind === 'isa' ? policy('isa', currentAccount()) : policy(kind, null), title = policyTitle(kind), summary = policySummary(kind, p), versions = [...group.versions].sort((a, b) => String(b.effectiveFrom || '').localeCompare(String(a.effectiveFrom || ''))); $('#sheetEyebrow').textContent = '설정'; $('#sheetTitle').textContent = '제도·상품 관리'; const context = kind === 'isa' ? (currentAccount() ? `현재 선택 계좌 · ${escapeHtml(currentAccount().name)}` : '아직 ISA 계좌 없음') : '기본 적용 제도'; $('#sheetBody').innerHTML = `<div class="policy-tabs">${[['isa', 'ISA'], ['pension', '개인연금'], ['irp', 'IRP'], ['finance', '금융상품']].map(([k, l]) => `<button class="policy-tab ${kind === k ? 'active' : ''}" data-policy-tab="${escapeHtml(k)}">${l}</button>`).join('')}</div><div class="policy-toolbar"><strong>${title} 제도</strong><button class="policy-new" data-policy-new="${escapeHtml(kind)}">＋ 새 제도</button></div><div class="policy-card"><div class="policy-card-head"><div><strong>${escapeHtml(p.name)}</strong><small>${context} · 확인 ${formatDate(p.verifiedAt)}</small></div><span class="policy-status ${p.userEdited ? 'user' : ''}">${policyStatus(p)}</span></div><div class="policy-summary-grid">${summary.map(([l, v]) => `<div class="policy-summary"><span>${l}</span><strong>${v}</strong></div>`).join('')}</div><div class="policy-card-actions"><button data-policy-read="${escapeHtml(kind)}">상세 보기</button><button class="primary" data-policy-edit="${escapeHtml(kind)}">새 버전 만들기</button></div><div class="source-note">제도 저장과 계좌 적용은 분리됩니다.</div></div><div class="policy-toolbar"><strong>저장된 제도 ${versions.length}개</strong><span class="count-pill">별도 보관</span></div><div class="policy-version-list">${versions.map(v => { const usage = kind === 'isa' ? state.accounts.filter(a => a.policyId === v.id).length : (v.id === group.activePolicyId ? 1 : 0), selected = kind === 'isa' ? currentAccount()?.policyId === v.id : v.id === group.activePolicyId; return `<div class="policy-version-row"><div><strong>${escapeHtml(v.name)} ${selected ? '<span class="policy-current-mark">· 현재 선택</span>' : ''}${usage ? `<span class="policy-usage">사용 ${usage}</span>` : ''}</strong><small>${formatDate(v.effectiveFrom)} · ${policyStatus(v)} · ${escapeHtml(v.sourceLabel)}</small></div><div class="policy-version-actions"><button data-policy-version-read="${escapeHtml(v.id)}">보기</button><button class="primary" data-policy-apply="${escapeHtml(v.id)}">${kind === 'isa' ? '계좌 적용' : '적용'}</button></div></div>`; }).join('')}</div>`; openSheet('#detailSheet'); $$('[data-policy-tab]').forEach(b => b.onclick = async () => (await openPolicyHub(b.dataset.policyTab))); $('[data-policy-new]')?.addEventListener('click', () => openPolicyForm(kind, 'new')); $('[data-policy-read]')?.addEventListener('click', () => openPolicyReadonly(kind)); $('[data-policy-edit]')?.addEventListener('click', () => openPolicyForm(kind, 'edit')); $$('[data-policy-apply]').forEach(b => b.onclick = () => applyPolicyVersion(kind, b.dataset.policyApply || '')); $$('[data-policy-version-read]').forEach(b => b.onclick = () => openPolicyReadonly(kind, b.dataset.policyVersionRead)); }
function openAdvancedSettings() {
    $('#sheetEyebrow').textContent = '설정';
    $('#sheetTitle').textContent = '고급 설정';
    $('#sheetBody').innerHTML = `<div class="menulist"><button class="menurow" data-advanced-action="policies"><span class="menuico">§</span><span class="menucopy"><strong>제도·상품 관리</strong><small>ISA·연금 제도와 예금·적금·대출 조건</small></span><span class="menugo">›</span></button><button class="menurow" data-advanced-action="diagnostics"><span class="menuico">◇</span><span class="menucopy"><strong>시스템 진단</strong><small>앱 버전·데이터 구조·데이터 개수</small></span><span class="menugo">›</span></button></div><div class="source-note">자주 쓰지 않는 관리 기능만 모아 두었습니다.</div>`;
    openSheet('#detailSheet');
    $$('[data-advanced-action]').forEach(b => b.onclick = async () => { if (b.dataset.advancedAction === 'policies')
        (await openPolicyHub());
    else if (b.dataset.advancedAction === 'diagnostics')
        openSheet('#diagnosticsSheet'); });
}
let kisUiEmail = '', kisUiBusy = false, kisUiProgress = '';
let kisManualSyncQueue = Promise.resolve();
function runtimeBrokerKisApi() { if (typeof assetOsRuntimeApi !== 'undefined' && assetOsRuntimeApi?.brokerKis)
    return assetOsRuntimeApi.brokerKis; return typeof window !== 'undefined' ? window.__assetOS?.brokerKis || null : null; }
function kisDataElement(attribute, value) { const name = String(attribute || ''), kind = String(value || ''); if (!['data-kis-account', 'data-kis-history-start'].includes(name) || !['pension', 'irp'].includes(kind))
    return null; if (typeof document === 'undefined') {
    const selector = name === 'data-kis-account' ? (kind === 'pension' ? '[data-kis-account="pension"]' : '[data-kis-account="irp"]') : (kind === 'pension' ? '[data-kis-history-start="pension"]' : '[data-kis-history-start="irp"]');
    return $(selector);
} return [...document.querySelectorAll(`[${name}]`)].find(element => element.getAttribute(name) === kind) || null; }
const kisManualSyncPromises = new Map();
function kisErrorText(error) { const [code, stage, upstreamCode] = String(error || '').split('|'), stageText = { balance: '잔고', orders: '체결', rights: '권리', quote: '현재가' }[stage] || '계좌'; if (/email rate limit exceeded/i.test(code))
    return '메일 요청이 잠시 제한됐습니다. 잠시 후 한 번만 다시 눌러 주세요.'; if (code === 'KIS_UPSTREAM_FAILED')
    return `${stageText} 조회를 한국투자에서 처리하지 못했습니다.${upstreamCode ? ` (${upstreamCode})` : ''} 잠시 후 실패 계좌만 다시 눌러 주세요.`; return ({ BROKER_NOT_CONFIGURED: '연결 공개 설정이 아직 완료되지 않았습니다.', BROKER_AUTH_REQUIRED: '먼저 이메일 인증을 완료해 주세요.', BROKER_REQUEST_TIMEOUT: '응답 시간이 초과됐습니다. 잠시 후 다시 눌러 주세요.', BROKER_NETWORK_ERROR: '네트워크 연결을 확인한 뒤 다시 눌러 주세요.', BROKER_RESPONSE_CONTRACT_INVALID: '계좌 응답이 일치하지 않아 저장하지 않았습니다.', EMAIL_INVALID: '이메일 주소를 확인해 주세요.', OTP_INVALID: '인증번호를 확인해 주세요.', AUTH_REQUIRED: '로그인이 필요합니다.', OWNER_ONLY: '허용된 사용자만 연결할 수 있습니다.', ORIGIN_FORBIDDEN: '허용된 Asset OS 주소에서만 사용할 수 있습니다.', KIS_REQUEST_TIMEOUT: '한국투자 응답 시간이 초과됐습니다. 잠시 후 다시 눌러 주세요.', KIS_TOKEN_INVALID: '한국투자 인증을 다시 확인해 주세요.', KIS_BALANCE_INVALID: '잔고 응답이 불완전하여 기존 금액을 유지했습니다.', KIS_RESULT_TRUNCATED: '조회 건수가 많습니다. 기간을 줄여 다시 시도해 주세요.', KIS_ACCOUNT_LINK_MISMATCH: '선택한 계좌 구분이 맞지 않습니다.', KIS_HISTORY_RANGE_INVALID: '처음 거래한 날짜를 확인해 주세요.', KIS_HISTORY_NOT_STARTED: '과거자료 조회를 처음부터 다시 시작해 주세요.', PERSIST_FAILED: '조회 결과를 기기에 저장하지 못했습니다.' })[code] || `연결 오류: ${code || '알 수 없음'}`; }
function kisFailureCode(result, fallbackStage = '') { const code = String(result?.error || 'SYNC_FAILED'), stage = String(result?.stage || fallbackStage || ''), upstreamCode = String(result?.upstreamCode || ''); return [code, stage, upstreamCode].filter(Boolean).join('|'); }
function kisDateDaysAgo(days) { const d = new Date(); d.setDate(d.getDate() - days); return localYmd(d); }
function kisDateAddDays(value, days) { const d = new Date(`${value}T12:00:00`); d.setDate(d.getDate() + days); return localYmd(d); }
function kisHistoryCursor(history, key, startDate) { const through = String(history?.[key] || ''); return through && through >= startDate ? kisDateAddDays(through, 1) : startDate; }
function kisHistoryChunk(from, targetDate, days) { return { from, to: kisDateAddDays(from, days - 1) < targetDate ? kisDateAddDays(from, days - 1) : targetDate }; }
async function ensureKisLocalAccounts() { const created = [], accounts = pensionStore().accounts || []; for (const kind of ['pension', 'irp']) {
    if (accounts.some(a => a.kind === kind))
        continue;
    const result = createPensionAccount({ kind, name: kind === 'irp' ? '한국투자 IRP' : '한국투자 연금저축', provider: '한국투자증권', openedAt: localYmd() });
    if (result?.ok) {
        created.push(kind);
        state.brokerKis.connections[kind].accountId = result.account.id;
    }
} if (created.length)
    (await persist(false)); return created; }
async function syncNewKisAccounts(kinds) { for (const kind of kinds)
    await syncKisAccount(kind); }
function kisConnectionCard(kind) { const label = kind === 'irp' ? 'IRP' : '연금저축', accounts = pensionStore().accounts.filter(a => a.kind === kind && a.status === 'active'), connection = state.brokerKis?.connections?.[kind] || {}, history = state.brokerKis?.history?.[kind] || {}, selected = accounts.some(a => a.id === connection.accountId) ? connection.accountId : (accounts.length === 1 ? accounts[0].id : ''), completeAt = connection.lastCompleteSyncAt || '', historyText = history.status === 'complete' ? `${history.startDate} ~ ${history.targetDate} 저장 완료` : history.status === 'paused' ? `${history.orderThrough || history.startDate || '-'}까지 저장 · 이어받기 가능` : history.orderThrough || history.rightsThrough ? `체결 ${history.orderThrough || '-'} · 권리 ${history.rightsThrough || '-'}` : '아직 과거 전체 조회 안 함'; return `<section class="card kis-account-card"><div class="sectionhead"><h2>${label}</h2><span class="count-pill">읽기 전용</span></div>${accounts.length ? `<div class="field"><label>연결할 Asset OS 계좌</label><select data-kis-account="${escapeHtml(kind)}" ${kisUiBusy ? 'disabled' : ''}>${accounts.map(a => `<option value="${escapeHtml(a.id)}" ${a.id === selected ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}</select></div><div class="kis-sync-meta"><span>마지막 전체 갱신</span><strong>${completeAt ? formatDateTime(completeAt) : '아직 없음'}</strong></div>${connection.lastError ? `<div class="warningbox">최근 갱신 미완료 · ${escapeHtml(kisErrorText(connection.lastError))}</div>` : ''}<button class="diagnostic-action" data-kis-sync="${escapeHtml(kind)}" ${kisUiBusy ? 'disabled' : ''}>현재 잔고·누락 체결 확인</button><div class="field" style="margin-top:12px"><label>처음 거래한 날짜</label><input data-kis-history-start="${escapeHtml(kind)}" type="date" value="${escapeHtml(history.startDate || '')}" max="${escapeHtml(localYmd())}" ${kisUiBusy ? 'disabled' : ''}></div><div class="kis-sync-meta"><span>과거자료 저장</span><strong>${escapeHtml(historyText)}</strong></div><button class="diagnostic-action" data-kis-history="${escapeHtml(kind)}" ${kisUiBusy ? 'disabled' : ''}>과거 전체 체결·권리 가져오기</button>` : '<div class="warningbox">운영 중인 계좌가 없습니다. 개인연금 자산 화면에서 계좌를 먼저 추가해 주세요.</div>'}</section>`; }
async function openKisSettings() { syncBrokerKisSessionFromCloud(); const auth = brokerKisClient.authState(), configured = auth.configured, created = auth.signedIn ? (await ensureKisLocalAccounts()) : []; $('#sheetEyebrow').textContent = '설정 · 읽기 전용'; $('#sheetTitle').textContent = '한국투자 연결'; const authBody = auth.signedIn ? `<div class="kis-auth-state ok"><span>●</span><div><strong>Asset OS 인증 완료</strong><small>Google 로그인 세션으로 안전하게 연결됩니다.</small></div></div>` : `<form id="kisOtpRequestForm" class="form kis-auth-form"><div class="field"><label>Asset OS 소유자 이메일</label><input name="email" type="email" autocomplete="email" value="${escapeHtml(kisUiEmail)}" placeholder="초대받은 이메일" required></div><button class="form-btn primary" ${!configured || kisUiBusy ? 'disabled' : ''}>인증 링크 받기</button></form><div class="source-note">Google 세션을 확인하지 못한 경우에만 이메일 인증을 사용합니다.</div>`; $('#sheetBody').innerHTML = `<div class="kis-security-note"><strong>앱키·계좌번호는 이 화면에 저장하지 않습니다.</strong><span>Supabase가 한투를 조회하고, Asset OS에는 정리된 조회 결과만 저장합니다.</span></div>${!configured ? '<div class="warningbox">배포용 공개 연결 설정이 아직 필요합니다. 한투 비밀키와는 다른 공개용 값입니다.</div>' : ''}<section class="card kis-auth-card"><div class="sectionhead"><h2>사용자 인증</h2><span class="count-pill ${auth.signedIn ? 'positive' : ''}">${auth.signedIn ? '연결됨' : '미연결'}</span></div>${authBody}</section>${auth.signedIn ? `${kisUiProgress ? `<div class="warningbox">${escapeHtml(kisUiProgress)}</div>` : ''}${kisConnectionCard('pension')}${kisConnectionCard('irp')}<div class="source-note kis-ledger-note">현재 조회는 잔고와 마지막 저장일 이후 체결을 31일씩 나눠 누락 없이 확인합니다. 체결은 거래 화면의 읽기 전용 과거자료로 저장됩니다. 중간 실패 시 완료 구간 다음부터 이어받으며 현재 잔고에 매매금액을 다시 더하지 않습니다.</div>` : ''}`; openSheet('#detailSheet'); bindKisSettings(); if (created.length)
    (await syncNewKisAccounts(created)); }
function bindKisSettings() { const request = $('#kisOtpRequestForm'); request?.addEventListener('submit', async (e) => { e.preventDefault(); if (kisUiBusy)
    return; kisUiEmail = String(new FormData(e.currentTarget).get('email') || '').trim(); kisUiBusy = true; (await openKisSettings()); const result = await brokerKisClient.requestOtp(kisUiEmail); kisUiBusy = false; (await openKisSettings()); toast(result.ok ? '이메일로 인증 링크를 보냈습니다.' : kisErrorText(result.error)); }); $('[data-kis-signout]')?.addEventListener('click', async () => { brokerKisClient.signOut(); kisUiEmail = ''; (await openKisSettings()); toast('연결 인증을 해제했습니다.'); }); $$('[data-kis-sync]').forEach(button => button.onclick = async () => (await syncKisAccount(button.dataset.kisSync))); $$('[data-kis-history]').forEach(button => button.onclick = async () => (await syncKisHistory(button.dataset.kisHistory))); }
function kisAutomaticOrderStart(kind, targetDate = localYmd()) { const connection = state.brokerKis?.connections?.[kind] || {}, history = state.brokerKis?.history?.[kind] || {}, base = brokerKisDate(connection.orderSyncThrough) || brokerKisDate(history.orderThrough); if (!base)
    return kisDateDaysAgo(30); const overlap = kisDateAddDays(base, -2); return overlap > targetDate ? kisDateDaysAgo(30) : overlap; }
async function runKisCurrentSync(kind, accountId) { const api = runtimeBrokerKisApi(), fail = async (error) => { await api?.failSync?.(kind, accountId, error, new Date().toISOString()); return { ok: false, error }; }; const targetDate = localYmd(), balance = await brokerKisClient.sync('balance', kind, accountId, {}); if (!balance.ok)
    return fail(kisFailureCode(balance, 'balance')); let cursor = kisAutomaticOrderStart(kind, targetDate); while (cursor <= targetDate) {
    const range = kisHistoryChunk(cursor, targetDate, 31), result = await brokerKisClient.sync('orders', kind, accountId, range);
    if (!result.ok)
        return fail(kisFailureCode(result, 'orders'));
    cursor = kisDateAddDays(range.to, 1);
} const rights = await brokerKisClient.sync('rights', kind, accountId, { from: `${targetDate.slice(0, 4)}-01-01`, to: targetDate }); if (!rights.ok)
    return fail(kisFailureCode(rights, 'rights')); const completed = await api?.completeSync?.(kind, accountId, new Date().toISOString()); return completed?.ok === false ? { ok: false, error: completed.error || 'PERSIST_FAILED' } : { ok: true }; }
function kisConnectedAccount(kind) { const id = String(state.brokerKis?.connections?.[kind]?.accountId || ''); return pensionStore().accounts.find(a => a.id === id && a.kind === kind && a.status === 'active') || null; }
function refreshBrokerKisKind(kind) {
    if (kisManualSyncPromises.has(kind))
        return kisManualSyncPromises.get(kind);
    const run = kisManualSyncQueue.catch(() => { }).then(async () => { const account = kisConnectedAccount(kind); if (!account)
        return { ok: false, error: 'KIS_ACCOUNT_LINK_MISMATCH', kind }; const result = await runKisCurrentSync(kind, account.id); return { ...result, kind }; });
    kisManualSyncQueue = run.catch(() => { });
    kisManualSyncPromises.set(kind, run);
    const clear = () => { if (kisManualSyncPromises.get(kind) === run)
        kisManualSyncPromises.delete(kind); };
    run.then(clear, clear);
    return run;
}
async function refreshBrokerKisManually(kinds = ['pension', 'irp']) { const targets = [...new Set(kinds)].filter(k => ['pension', 'irp'].includes(k) && kisConnectedAccount(k)); if (!targets.length)
    return { ok: true, updated: 0, total: 0 }; if (!brokerKisClient.authState().signedIn)
    return { ok: false, error: 'BROKER_AUTH_REQUIRED', updated: 0, total: targets.length }; const results = await Promise.all(targets.map(refreshBrokerKisKind)); const updated = results.filter(result => result?.ok).length; if (updated && typeof renderKeepingScroll === 'function')
    renderKeepingScroll(); return { ok: updated === targets.length, updated, total: targets.length, results }; }
async function syncKisAccount(kind) {
    if (!kind)
        return;
    if (kisUiBusy)
        return;
    const select = kisDataElement("data-kis-account", kind), accountId = String(select?.value || '');
    if (!accountId)
        return toast('연결할 계좌를 선택해 주세요.');
    kisUiBusy = true;
    (await openKisSettings());
    const result = await runKisCurrentSync(kind, accountId);
    kisUiBusy = false;
    (await openKisSettings());
    toast(result.ok ? `${kind === 'irp' ? 'IRP' : '연금저축'} 잔고·체결을 저장했습니다.` : kisErrorText(result.error));
}
async function refreshPensionKisScope() { const kinds = ['pension', 'irp'], button = $('[data-pension-kis-refresh]'); if (button) {
    button.disabled = true;
    button.textContent = '조회 중';
} const result = await refreshBrokerKisManually(kinds); if (!result?.ok)
    toast('한투 조회를 확인해 주세요.');
else
    toast('연금 전체 잔고·체결을 저장했습니다.'); if (button?.isConnected) {
    button.disabled = false;
    button.textContent = '갱신';
} }
function investmentRefreshStatus() {
    const isaTimes = state.accounts.filter(isCurrentAccount).flatMap(a => (a.holdings || []).map(h => String(h.quoteUpdatedAt || ''))).filter(Boolean), pensionTimes = ['pension', 'irp'].map(k => String(state.brokerKis?.connections?.[k]?.lastCompleteSyncAt || '')).filter(Boolean), times = [...isaTimes, ...pensionTimes].filter(t => Number.isFinite(Date.parse(t))).sort((a, b) => Date.parse(a) - Date.parse(b)), saved = setting().investmentRefreshResult;
    const errors = [...new Set([...['pension', 'irp'].filter(k => state.brokerKis?.connections?.[k]?.lastError), ...Object.keys(saved?.errors || {})])];
    return { last: times.at(-1) || '', oldest: times[0] || '', errors, attempt: saved?.at || '', results: saved?.results || {}, accounts: [{ kind: 'isa', at: isaTimes.filter(t => Number.isFinite(Date.parse(t))).sort((a, b) => Date.parse(a) - Date.parse(b)).at(-1) || '' }, ...['pension', 'irp'].map(kind => ({ kind, at: String(state.brokerKis?.connections?.[kind]?.lastCompleteSyncAt || '') }))] };
}
let investmentRefreshPromise = null;
function updateInvestmentRefreshButtons(text = '전체 갱신', disabled = false) { $$('[data-investment-refresh-all],[data-investment-refresh-failed]').forEach(button => { button.disabled = disabled; button.textContent = text; }); }
function investmentRefreshIdleLabel() { return investmentRefreshStatus().errors.length ? '실패만 재시도' : '전체 갱신'; }
function investmentResultError(item) { return Number(item?.missing) > 0 ? 'QUOTE_PARTIAL' : item?.error || item?.results?.find(result => !result?.ok)?.error || 'SYNC_FAILED'; }
function finishInvestmentRefresh() { investmentRefreshPromise = null; const row = document.querySelector('.home-investment-refresh'); if (row && typeof homeInvestmentRefreshMarkup === 'function')
    row.outerHTML = homeInvestmentRefreshMarkup(); updateInvestmentRefreshButtons(investmentRefreshIdleLabel(), false); }
async function saveInvestmentRefreshResult(results, errors) { const prior = setting().investmentRefreshResult, mergedErrors = { ...(prior?.errors || {}) }; for (const key of Object.keys(results))
    if (results[key] !== 'skipped') {
        if (errors[key])
            mergedErrors[key] = errors[key];
        else
            delete mergedErrors[key];
    } setting().investmentRefreshResult = { at: new Date().toISOString(), results: { ...(prior?.results || {}), ...Object.fromEntries(Object.entries(results).filter(([, value]) => value !== 'skipped')) }, errors: mergedErrors }; (await persist(false)); }
function refreshAllInvestments() { if (investmentRefreshPromise)
    return investmentRefreshPromise; investmentRefreshPromise = (async () => { const results = { isa: 'skipped', pension: 'skipped', irp: 'skipped' }, errors = {}, account = currentAccount(), links = account ? isaQuoteLinks(account) : [], tasks = []; if (links.length)
    tasks.push({ key: 'isa', run: () => refreshIsaQuotes({ manual: false }) }); for (const kind of ['pension', 'irp'])
    if (kisConnectedAccount(kind))
        tasks.push({ key: kind, run: () => refreshBrokerKisManually([kind]) }); if (!tasks.length) {
    toast('갱신할 연결 계좌가 없습니다.');
    return { ok: true, results, errors };
} updateInvestmentRefreshButtons(`갱신 중 0/${tasks.length}`, true); for (let index = 0; index < tasks.length; index++) {
    const task = tasks[index];
    updateInvestmentRefreshButtons(`갱신 중 ${index + 1}/${tasks.length}`, true);
    try {
        const item = await task.run();
        results[task.key] = item?.ok && !(Number(item?.missing) > 0) ? 'ok' : 'failed';
        if (results[task.key] === 'failed')
            errors[task.key] = investmentResultError(item);
    }
    catch {
        results[task.key] = 'failed';
        errors[task.key] = 'SYNC_FAILED';
    }
} const failed = Object.keys(errors), names = { isa: 'ISA 시세', pension: '연금저축 잔고·내역', irp: 'IRP 잔고·내역' }; (await saveInvestmentRefreshResult(results, errors)); if (typeof renderKeepingScroll === 'function')
    renderKeepingScroll(); toast(failed.length ? `갱신 부분 완료 · ${failed.map(key => names[key] || key).join(' · ')} 확인` : `${Object.keys(results).filter(key => results[key] === 'ok').map(key => names[key] || key).join(' · ')} 갱신 완료`); return { ok: failed.length === 0, results, errors }; })().finally(finishInvestmentRefresh); return investmentRefreshPromise; }
function refreshFailedInvestments() { if (investmentRefreshPromise)
    return investmentRefreshPromise; const targets = investmentRefreshStatus().errors.filter(kind => kind === 'isa' ? !!currentAccount() && isaQuoteLinks(currentAccount()).length > 0 : ['pension', 'irp'].includes(kind) && kisConnectedAccount(kind)); if (!targets.length) {
    toast('다시 시도할 실패 계좌가 없습니다.');
    return Promise.resolve({ ok: true, results: {} });
} investmentRefreshPromise = (async () => { const results = {}, errors = {}; for (let index = 0; index < targets.length; index++) {
    const kind = targets[index];
    updateInvestmentRefreshButtons(`재시도 중 ${index + 1}/${targets.length}`, true);
    try {
        const item = await (kind === 'isa' ? refreshIsaQuotes({ manual: false }) : refreshBrokerKisManually([kind]));
        results[kind] = item?.ok && !(Number(item?.missing) > 0) ? 'ok' : 'failed';
        if (results[kind] === 'failed')
            errors[kind] = investmentResultError(item);
    }
    catch {
        results[kind] = 'failed';
        errors[kind] = 'SYNC_FAILED';
    }
} (await saveInvestmentRefreshResult(results, errors)); if (typeof renderKeepingScroll === 'function')
    renderKeepingScroll(); const failed = Object.keys(errors), names = { isa: 'ISA 시세', pension: '연금저축 잔고·내역', irp: 'IRP 잔고·내역' }; toast(failed.length ? `${failed.map(key => names[key] || key).join(' · ')} 재시도 실패 · 기존 자료 유지` : `${targets.map(key => names[key] || key).join(' · ')} 갱신 완료`); return { ok: failed.length === 0, results, errors }; })().finally(finishInvestmentRefresh); return investmentRefreshPromise; }
async function syncKisHistory(kind) {
    if (!kind)
        return;
    if (kisUiBusy)
        return;
    const select = kisDataElement("data-kis-account", kind), startInput = kisDataElement("data-kis-history-start", kind), accountId = String(select?.value || ''), startDate = String(startInput?.value || ''), targetDate = localYmd(), api = runtimeBrokerKisApi();
    if (!accountId)
        return toast('연결할 계좌를 선택해 주세요.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || startDate > targetDate)
        return toast('처음 거래한 날짜를 확인해 주세요.');
    if (!api?.beginHistory || !api?.updateHistory)
        return toast('과거자료 저장 모듈을 확인해 주세요.');
    const begun = await api.beginHistory({ accountKind: kind, accountId, startDate, targetDate, updatedAt: new Date().toISOString() });
    if (!begun.ok)
        return toast(kisErrorText(begun.error));
    kisUiBusy = true;
    let history = begun.history, error = '', inserted = 0, updated = 0;
    const saveProgress = async (patch) => { const result = await api.updateHistory({ accountKind: kind, ...patch, updatedAt: new Date().toISOString() }); if (result.ok)
        history = result.history; return result; };
    const run = async (action, range, throughKey) => { kisUiProgress = `${kind === 'irp' ? 'IRP' : '연금저축'} ${action === 'orders' ? '체결' : '권리'} ${range.from} ~ ${range.to} 조회 중`; (await openKisSettings()); const result = await brokerKisClient.sync(action, kind, accountId, range); if (!result.ok) {
        error = result.error || 'SYNC_FAILED';
        await saveProgress({ status: 'paused', lastError: error });
        return false;
    } inserted += Number(result.inserted) || 0; updated += Number(result.updated) || 0; const saved = await saveProgress({ status: 'running', lastError: '', [throughKey]: range.to }); if (!saved.ok) {
        error = saved.error || 'PERSIST_FAILED';
        return false;
    } return true; };
    const balanceResult = await brokerKisClient.sync('balance', kind, accountId, {});
    if (!balanceResult.ok) {
        error = balanceResult.error || 'SYNC_FAILED';
        await saveProgress({ status: 'paused', lastError: error });
    }
    let cursor = kisHistoryCursor(history, 'orderThrough', startDate);
    while (!error && cursor <= targetDate) {
        const range = kisHistoryChunk(cursor, targetDate, 31);
        if (!(await run('orders', range, 'orderThrough')))
            break;
        cursor = kisDateAddDays(range.to, 1);
    }
    cursor = kisHistoryCursor(history, 'rightsThrough', startDate);
    while (!error && cursor <= targetDate) {
        const range = kisHistoryChunk(cursor, targetDate, 365);
        if (!(await run('rights', range, 'rightsThrough')))
            break;
        cursor = kisDateAddDays(range.to, 1);
    }
    if (!error) {
        const completed = await saveProgress({ status: 'complete', lastError: '', completedAt: new Date().toISOString() });
        if (!completed.ok)
            error = completed.error || 'PERSIST_FAILED';
    }
    kisUiBusy = false;
    kisUiProgress = '';
    (await openKisSettings());
    toast(error ? `${kisErrorText(error)} 저장된 다음 구간부터 다시 이어집니다.` : `과거자료 저장 완료 · 신규 ${inserted}건 · 갱신 ${updated}건`);
}
function openPensionSettings() { const p = pensionProjection(); $('#sheetEyebrow').textContent = '개인연금 설정'; $('#sheetTitle').textContent = '계획 기준'; $('#sheetBody').innerHTML = `<section class="card pension-target-setting"><div class="sectionhead"><h2>미래연금 가정</h2><span class="count-pill">직접 저장</span></div><form id="pensionProjectionForm" class="form" style="margin-top:10px"><div class="form-grid"><div class="field"><label>출생연도</label><input name="birthYear" type="number" min="1900" max="${escapeHtml(businessYear())}" value="${escapeHtml(p.birthYear)}"></div><div class="field"><label>은퇴 목표 나이</label><input name="retirementAge" type="number" min="1" max="100" value="${escapeHtml(p.retirementAge)}"></div><div class="field"><label>월 예상 납입액</label><input name="monthlyContribution" type="number" min="0" step="10000" inputmode="numeric" value="${escapeHtml(p.monthly)}"></div></div><div class="pension-target-note">현재 나이는 출생연도와 현재 연도에서 자동 계산합니다. 월 예상 납입액은 현재월 거래와 별도로 고정 저장되어 미래연금 그래프에 사용됩니다.</div><div class="form-actions one"><button class="form-btn primary">기준 저장</button></div></form></section><section class="card pension-target-setting" style="margin-top:12px"><div class="sectionhead"><h2>현재 계산 가정</h2><span class="count-pill">${p.years}년 남음</span></div><div class="pension-target-row"><span>현재 나이</span><b>${p.currentAge}세 · 자동</b></div><div class="pension-target-row"><span>월 납입</span><b>${won(p.monthly)}</b></div><div class="pension-target-row"><span>연 수익률</span><b>${(p.annual * 100).toFixed(1)}%</b></div><div class="pension-target-row"><span>연 인출률</span><b>${(p.withdrawal * 100).toFixed(1)}%</b></div><div class="pension-target-row"><span>물가상승률</span><b>${(p.inflation * 100).toFixed(1)}%</b></div></section>`; openSheet('#detailSheet'); $('#pensionProjectionForm')?.addEventListener('submit', async (e) => { e.preventDefault(); const fd = new FormData(e.currentTarget), currentYear = businessYear(), birthYear = Math.round(Number(fd.get('birthYear')) || 0), retirementAge = Math.round(Number(fd.get('retirementAge')) || 0), monthlyContribution = Math.round(Number(fd.get('monthlyContribution')) || 0), currentAge = currentYear - birthYear; if (birthYear < 1900 || birthYear > currentYear)
    return toast('출생연도를 확인해 주세요.'); if (retirementAge < currentAge || retirementAge > 100)
    return toast('은퇴 목표 나이는 현재 나이 이상이어야 합니다.'); if (monthlyContribution < 0)
    return toast('월 예상 납입액을 확인해 주세요.'); state.pension.projection.birthYear = birthYear; state.pension.projection.retirementAge = retirementAge; state.pension.projection.monthlyContribution = monthlyContribution; state.pension.projection.currentAge = currentAge; state.pension.projection.yearsToRetire = retirementAge - currentAge; if (!(await persist()))
    return; closeSheets(); nav('pension', 'future'); toast('미래연금 기준을 저장했어요.'); haptic('success'); }); }
function actions() { if (route().root !== 'isa')
    return toast('현재 검토본은 ISA 입력만 연결했습니다.'); openTransactionChoice(); }
let lastHapticAt = 0, lastHapticKind = '';
function haptic(kind = 'light') { if (!setting().haptics || typeof navigator.vibrate !== 'function')
    return; const now = Date.now(); if (kind === lastHapticKind && now - lastHapticAt < 80)
    return; try {
    navigator.vibrate(kind === 'warning' ? [18, 40, 18] : kind === 'success' ? [10, 25, 14] : [8]);
    lastHapticAt = now;
    lastHapticKind = kind;
}
catch { } }
let toastTimer;
function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2100); }
function openPensionBalanceDetail(accountId) { const account = pensionAccount(accountId); if (!account)
    return; const view = pensionAccountView(account), detail = (view.snapshot?.cashDetail || {}), rows = [['조회 총액', view.total], ['종목 평가액 합계', view.holdingValue], ['조회 예수금', view.reportedCash]]; for (const [key, label] of [['settledCash', '가수도 정산금액'], ['nextDayCash', '익일 정산금액']])
    if (detail[key] !== null && detail[key] !== undefined && Number.isFinite(Number(detail[key])))
        rows.push([label, Number(detail[key])]); rows.push(['앱 자산 합계에 사용한 현금', view.cash], ['구성 합계와 조회 총액 차이', view.componentDelta]); $('#sheetEyebrow').textContent = '개인연금 · 조회 자료'; $('#sheetTitle').textContent = String(account.name || '조회 금액 확인'); $('#sheetBody').innerHTML = `<div class="sheetrows balance-comparison">${rows.map(([label, value]) => `<div class="sheetrow"><span>${escapeHtml(label)}</span><strong>${won(value)}</strong></div>`).join('')}</div><div class="source-note">${view.cashBasis === 'deposit' ? '조회 예수금을 사용합니다.' : '조회 총액과 종목 평가액에 일치하는 정산금액을 사용합니다.'} 원본 조회 값은 그대로 보관합니다.${view.componentDelta < -.5 ? ' 합계 기준은 추가 확인이 필요합니다.' : ''}</div><button class="diagnostic-action" data-pension-kis-refresh>다시 갱신</button>`; openSheet('#detailSheet'); $('[data-pension-kis-refresh]')?.addEventListener('click', async (event) => { event.stopPropagation(); await refreshPensionKisScope(); if ($('#sheetBody .balance-comparison'))
    openPensionBalanceDetail(accountId); }); }
;
/* asset-os source: policy-review-ui.js */
'use strict';
function policyReviewClass(review) { return review.code === 'needs-review' ? 'review-needed' : review.code === 'review-soon' ? 'review-soon' : 'review-ok'; }
function policySafeSourceUrl(value) { try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' ? url.href : '';
}
catch {
    return '';
} }
function renderPolicyReviewNotice(item) {
    const card = document.querySelector('#sheetBody .policy-card');
    if (!card)
        return;
    const review = policyReviewState(item, localYmd()), badge = card.querySelector('.policy-status');
    if (badge) {
        badge.textContent = review.label;
        badge.classList.remove('user', 'review-needed', 'review-soon', 'review-ok');
        badge.classList.add(policyReviewClass(review));
    }
    card.querySelector('.policy-review-notice')?.remove();
    if (review.code !== 'ok') {
        const notice = document.createElement('div');
        notice.className = `policy-review-notice ${policyReviewClass(review)}`;
        notice.textContent = review.code === 'needs-review' ? `정책값 재확인이 필요합니다 · ${review.reason}` : `${formatDate(review.reviewAt)}까지 정책값을 다시 확인하세요.`;
        card.querySelector('.policy-summary-grid')?.before(notice);
    }
    const note = card.querySelector('.source-note'), url = policySafeSourceUrl(item.sourceUrl);
    if (note) {
        note.textContent = `다음 재검토 ${formatDate(review.reviewAt)} · 계산은 현재 저장값을 계속 사용합니다.`;
        if (url) {
            const link = document.createElement('a');
            link.href = url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = ' 출처 열기';
            note.appendChild(link);
        }
    }
}
const openPolicyHubWithoutReview = openPolicyHub;
openPolicyHub = function (initialKind = '', financeFilter = 'all') {
    const result = openPolicyHubWithoutReview(initialKind, financeFilter);
    if (initialKind === 'finance')
        return result;
    const kind = ['isa', 'pension', 'irp'].includes(initialKind) ? initialKind : (['isa', 'pension', 'irp'].includes(setting().policyTab || '') ? String(setting().policyTab) : 'isa'), item = kind === 'isa' ? policy('isa', currentAccount()) : policy(kind, null);
    renderPolicyReviewNotice(item);
    return result;
};
const openPolicyReadonlyWithoutReview = openPolicyReadonly;
openPolicyReadonly = function (kind = 'isa', policyId = '') {
    const result = openPolicyReadonlyWithoutReview(kind, policyId), group = policyGroup(kind), item = policyId ? (group.versions.find(version => version.id === policyId) || policy(kind)) : policy(kind), review = policyReviewState(item, localYmd()), note = document.querySelector('#sheetBody .source-note'), url = policySafeSourceUrl(item.sourceUrl);
    if (note) {
        note.textContent = `${item.sourceLabel} · 적용 ${formatDate(item.effectiveFrom)} · 확인 ${formatDate(item.verifiedAt)} · ${review.label}`;
        if (url) {
            const link = document.createElement('a');
            link.href = url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = ' · 출처 열기';
            note.appendChild(link);
        }
    }
    return result;
};
;
/* asset-os source: release-v069.js */
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
;
/* asset-os source: card-management-ui.js */
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
function cardUiForm(title, body, save, returnTo) {
    $('#formEyebrow').textContent = '통합 · 카드';
    $('#formTitle').textContent = title;
    $('#formBody').innerHTML = `<form id="cardLedgerForm" class="form">${body}<div class="warningbox" data-card-form-error hidden role="alert"></div><button type="submit" class="integrated-form-save">저장</button></form>`;
    openSheet('#formSheet', { mode: 'input', returnTo });
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
openCardPlansHub = function () { cardPreviousHub(); $('#sheetBody').insertAdjacentHTML('afterbegin', cardUiButton('카드 관리', 'manage-cards')); bindCardManagement(); };
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
function openSpendingPeriodPicker() {
    const mode = spendingPeriodMode(), anchor = integratedSelectedMonth(), year = anchor.slice(0, 4), size = mode === 'quarter' ? 3 : mode === 'half' ? 6 : 12, count = 12 / size, current = Math.ceil(Number(anchor.slice(5)) / size);
    $('#sheetEyebrow').textContent = '통합 · 소비';
    $('#sheetTitle').textContent = '조회 기간 선택';
    $('#sheetBody').innerHTML = `<form data-spending-period-form class="form"><div class="field"><label for="spending-picker-year">연도</label><input id="spending-picker-year" name="year" type="number" inputmode="numeric" min="1900" max="9998" step="1" value="${escapeHtml(year)}" required></div>${count > 1 ? `<div class="field"><label for="spending-picker-part">${mode === 'quarter' ? '분기' : '반기'}</label><select id="spending-picker-part" name="part">${Array.from({ length: count }, (_, i) => `<option value="${escapeHtml(i + 1)}" ${current === i + 1 ? 'selected' : ''}>${mode === 'quarter' ? (i + 1) + '분기' : i === 0 ? '상반기' : '하반기'}</option>`).join('')}</select></div>` : ''}<button type="submit" class="integrated-form-save">조회</button></form>`;
    openSheet('#detailSheet');
    const form = $('[data-spending-period-form]');
    form.onsubmit = e => { e.preventDefault(); if (!form.reportValidity())
        return; const data = new FormData(form), nextYear = Number(data.get('year')), part = Number(data.get('part') || 1); if (!Number.isInteger(nextYear) || nextYear < 1900 || nextYear > 9998 || !Number.isInteger(part) || part < 1 || part > count)
        return; setting().integratedMonth = `${nextYear}-${String((part - 1) * size + 1).padStart(2, '0')}`; clearSpendingSelection(); rememberViewPreferences(); closeSheets({ all: true }); render(); };
}
function selectSpendingChartPoint(chart, button) {
    if (button.getAttribute('aria-pressed') === 'true')
        return;
    if (chart.hasAttribute('data-spending-linked')) {
        setting().spendingChartContext = spendingViewContext();
        setting().spendingChartPeriod = button.dataset.spendingSelect;
        rememberViewPreferences();
    }
    chart.querySelectorAll('[data-spending-select]').forEach(x => { const active = x === button; x.setAttribute('aria-pressed', String(active)); x.querySelector('i')?.classList.toggle('current', active); });
    const label = chart.querySelector('[data-spending-selected-label]'), amount = chart.querySelector('[data-spending-selected-amount]'), detail = chart.querySelector('[data-spending-selected-detail]'), picker = chart.querySelector('[data-spending-day-picker]');
    if (label)
        label.textContent = spendingPeriodLabel(button.dataset.spendingSelect || '');
    if (amount)
        amount.textContent = won(Number(button.dataset.spendingAmount));
    if (detail)
        detail.dataset.spendingSelectedDetail = button.dataset.spendingSelect;
    if (picker)
        picker.value = button.dataset.spendingSelect || '';
}
function bindSpendingChartDrag(chart) {
    const track = chart.querySelector('.spending-trend');
    if (!track)
        return;
    const points = Array.from(track.querySelectorAll('[data-spending-select]'));
    let pointer = null, startX = 0, startY = 0, dragging = false;
    const pick = (x) => { let nearest = points[0], distance = Infinity; for (const point of points) {
        const rect = point.getBoundingClientRect(), d = Math.abs(x - (rect.left + rect.width / 2));
        if (d < distance) {
            nearest = point;
            distance = d;
        }
    } if (nearest)
        selectSpendingChartPoint(chart, nearest); };
    // Vertical gestures remain native page scrolling; horizontal gestures keep the same DOM and pointer capture.
    track.style.touchAction = 'pan-y';
    track.onpointerdown = e => { if (pointer !== null || !e.isPrimary || e.pointerType === 'mouse' && e.button !== 0)
        return; pointer = e.pointerId; startX = e.clientX; startY = e.clientY; dragging = false; try {
        track.setPointerCapture(pointer);
    }
    catch { } };
    track.onpointermove = e => { if (e.pointerId !== pointer)
        return; const dx = Math.abs(e.clientX - startX), dy = Math.abs(e.clientY - startY); if (!dragging) {
        if (dy > dx && dy > 6) {
            pointer = null;
            try {
                track.releasePointerCapture(e.pointerId);
            }
            catch { }
            return;
        }
        if (dx < 6)
            return;
        dragging = true;
    } e.preventDefault(); pick(e.clientX); };
    track.onpointerup = e => { if (e.pointerId !== pointer)
        return; if (dragging) {
        e.preventDefault();
        pick(e.clientX);
    }
    else
        pick(e.clientX); pointer = null; try {
        track.releasePointerCapture(e.pointerId);
    }
    catch { } };
    track.onpointercancel = () => { pointer = null; dragging = false; };
    track.onlostpointercapture = () => { pointer = null; };
    // A drag can end over another button; do not let its compatibility click override the selected point.
    track.onclick = e => { if (dragging) {
        e.preventDefault();
        e.stopPropagation();
        dragging = false;
    } }, track.onkeydown = e => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key))
        return; const active = Math.max(0, points.findIndex(x => x.getAttribute('aria-pressed') === 'true')), index = e.key === 'Home' ? 0 : e.key === 'End' ? points.length - 1 : Math.max(0, Math.min(points.length - 1, active + (e.key === 'ArrowRight' ? 1 : -1))); if (points[index]) {
        e.preventDefault();
        selectSpendingChartPoint(chart, points[index]);
        points[index].focus();
    } };
}
function spendingName(row) { return String(row.meta?.spendingItem || row.category || '미분류'); }
function spendingCategoryIcon(category) {
    const key = category.includes('보험') ? 'insurance' : category.includes('식비') ? 'food' : category.includes('게임') ? 'game' : category.includes('가전') ? 'device' : category.includes('용돈') ? 'gift' : category.includes('쇼핑') ? 'bag' : category.includes('주거') ? 'home' : category.includes('교통') ? 'car' : category.includes('미분류') ? 'unknown' : 'receipt';
    const paths = { insurance: 'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3ZM8 12l3 3 5-6', food: 'M6 3v7m-3-7v5a3 3 0 0 0 6 0V3M6 11v10M17 3c-3 2-3 7 0 8h2M19 3v18', game: 'M7 8h10c3 0 5 9 3 10-2 1-4-3-5-3H9c-1 0-3 4-5 3C2 17 4 8 7 8ZM7 10v4M5 12h4M16 11h.01M18 13h.01', device: 'M3 5h18v12H3zM8 21h8M12 17v4', gift: 'M3 8h18v4H3zM5 12v9h14v-9M12 8v13M12 8C5 8 6 2 9 3c2 0 3 5 3 5Zm0 0c7 0 6-6 3-5-2 0-3 5-3 5Z', bag: 'M5 7h14l1 14H4L5 7ZM8 8V6a4 4 0 0 1 8 0v2', home: 'm3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7', car: 'm4 10 2-6h12l2 6M3 10h18v9H3zM6 19v2M18 19v2M6 14h1M17 14h1', unknown: 'M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 4M12 18h.01', receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3ZM9 8h6M9 12h6' };
    return `<span class="spending-icon spending-icon-${key}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${key === 'unknown' ? '<circle cx="12" cy="12" r="10"/>' : ''}<path d="${escapeHtml(paths[key])}"/></svg></span>`;
}
function spendingChartMoney(amount) { const value = Math.abs(amount), sign = amount < 0 ? '−' : ''; return sign + (value >= 100000000 ? (value / 100000000).toFixed(1) + '억' : value >= 10000 ? Number((value / 10000).toFixed(1)) + '만' : value.toLocaleString('ko-KR')); }
function spendingTrendMarkup(analysis, item = '', linked = false) {
    const saved = linked && setting().spendingChartContext === spendingViewContext() ? String(setting().spendingChartPeriod || '') : '', selected = analysis.trend.find(x => x.month === (saved || analysis.month)) || (linked ? analysis.trend.find(x => x.month === integratedSelectedMonth()) : null) || analysis.trend.findLast(x => x.amount !== 0) || analysis.trend.at(-1);
    if (!selected)
        return '';
    const values = analysis.trend.map(x => x.amount), high = Math.max(1, ...values), low = Math.min(0, ...values), span = high - low, y = (amount) => (high - amount) / span * 100, zero = y(0), period = selected.month, daily = period.length === 10, today = localYmd(), last = analysis.trend.length - 1;
    const guides = [0, 50, 100].map(v => `<line x1="0" x2="600" y1="${escapeHtml(v)}" y2="${escapeHtml(v)}"/>`).join(''), line = daily ? `<polyline points="${escapeHtml(analysis.trend.map((x, i) => x.month > today && !x.amount ? '' : `${(i + .5) / analysis.trend.length * 600},${y(x.amount)}`).filter(Boolean).join(' '))}"/>` : '';
    const axis = daily ? [0, 9, 19, last].filter((x, i, a) => a.indexOf(x) === i).map(i => `<span style="left:${(i + .5) / analysis.trend.length * 100}%">${i + 1}일</span>`).join('') : '';
    return `<div class="spending-chart ${daily ? 'spending-chart-daily' : analysis.trend.length >= 10 || period.length === 4 ? 'spending-chart-dense' : ''}" ${linked ? 'data-spending-linked="true"' : ''}><div class="spending-chart-canvas"><div class="spending-value-axis" aria-hidden="true"><span>${spendingChartMoney(high)}</span><span>${spendingChartMoney((high + low) / 2)}</span><span>${spendingChartMoney(low)}</span></div><div class="spending-trend" style="--spending-columns:${analysis.trend.length};--spending-zero:${zero}%"><svg class="spending-chart-lines" viewBox="0 0 600 100" preserveAspectRatio="none" aria-hidden="true">${guides}${line}</svg>${analysis.trend.map(x => { const future = x.month > today.slice(0, x.month.length) && !x.amount; return `<button data-spending-select="${escapeHtml(x.month)}" data-spending-amount="${escapeHtml(x.amount)}" class="${escapeHtml(future ? 'spending-future' : '')}" aria-pressed="${escapeHtml(x.month === period)}" aria-label="${escapeHtml(spendingPeriodLabel(x.month) + ' 순소비 ' + won(x.amount) + (future ? ' · 아직 오지 않은 기간' : ''))}"><span class="spending-bar"><i class="${escapeHtml(x.month === period ? 'current' : '')}" style="top:${Math.min(zero, y(x.amount))}%;height:${Math.abs(x.amount) / span * 100}%;${daily ? `--point-top:${y(x.amount)}%;` : ''}${x.amount < 0 ? 'background:var(--down)' : ''}"></i>${daily ? `<em class="spending-line-point" style="top:${y(x.amount)}%"></em>` : ''}</span><strong>${daily ? '' : escapeHtml(analysis.trend.length >= 10 ? x.label.replace('월', '') : x.month.length === 4 ? x.month : x.label)}</strong>${!daily ? `<small>${future ? '미도래' : x.amount ? spendingChartMoney(x.amount) : '0'}</small>` : ''}</button>`; }).join('')}${daily ? `<div class="spending-day-axis" aria-hidden="true">${axis}</div>` : ''}</div></div><div class="spending-chart-selection" aria-live="polite"><span data-spending-selected-label>${escapeHtml(spendingPeriodLabel(period))}</span><strong data-spending-selected-amount>${won(selected.amount)}</strong><button class="tinybtn" data-spending-selected-detail="${escapeHtml(period)}" data-spending-selected-item="${escapeHtml(item)}">${item ? '거래 내역' : '분류별 내역'} <span aria-hidden="true">›</span></button></div>${daily ? `<label class="spending-day-picker">날짜 선택<select data-spending-day-picker aria-label="소비 날짜 선택">${analysis.trend.map(x => `<option value="${escapeHtml(x.month)}" ${x.month === period ? 'selected' : ''}>${Number(x.month.slice(-2))}일 · ${won(x.amount)}${x.month > today && !x.amount ? ' · 미도래' : ''}</option>`).join('')}</select></label>` : ''}</div>`;
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
    return `<div class="spending-review"><section class="spending-hero"><div class="spending-hero-head"><span>${escapeHtml(spendingPeriodLabel(period))} 총 소비</span><button data-spending-new>＋ 지출</button></div><strong>${won(analysis.total)}</strong><small class="${escapeHtml(analysis.change < 0 ? 'spending-decrease' : '')}">${analysis.previousTotal ? `${escapeHtml(spendingPeriodLabel(analysis.previousMonth))} 대비 ${analysis.change > 0 ? '+' : analysis.change < 0 ? '−' : ''}${won(Math.abs(analysis.change))} · ${Math.abs(analysis.changeRate || 0).toFixed(1)}%` : '이전 기간 비교 기록 없음'}</small>${['year', 'years'].includes(spendingPeriodMode()) ? `<div class="spending-year-views" aria-label="연간 그래프 보기"><button data-spending-year-view="year" aria-pressed="${escapeHtml(spendingPeriodMode() === 'year')}">월별 추이</button><button data-spending-period="years" aria-pressed="${escapeHtml(spendingPeriodMode() === 'years')}">연도 비교</button></div>` : ''}<p class="spending-chart-window">${spendingPeriodMode() === 'month' ? '일별 소비 · 날짜를 선택해 금액 확인' : spendingPeriodMode() === 'years' ? '연도별 합계 비교' : spendingPeriodMode() === 'year' ? '월별 소비 · 1~12월' : '월별 소비 · ' + spendingPeriodLabel(period)}</p>${spendingTrendMarkup(windowAnalysis, '', true)}<small>구매일 기준 · 카드 원금 납부는 제외</small></section><section class="card spending-split"><button data-spending-detail="fixed" data-spending-month="${escapeHtml(period)}"><span>고정비</span><strong>${won(analysis.rows.filter(x => x.fixed).reduce((n, x) => n + Number(x.amount || 0), 0))}</strong></button><button data-spending-detail="variable" data-spending-month="${escapeHtml(period)}"><span>변동비</span><strong>${won(analysis.rows.filter(x => !x.fixed).reduce((n, x) => n + Number(x.amount || 0), 0))}</strong></button></section><div class="cardv2-segment spending-view" aria-label="소비 보기"><button data-spending-view="categories" class="${escapeHtml(view === 'categories' ? 'active' : '')}">카테고리별</button><button data-spending-view="items" class="${escapeHtml(view === 'items' ? 'active' : '')}">항목별</button></div>${view === 'categories' ? `<section class="card spending-card"><div class="sectionhead"><h2>카테고리별 소비</h2><button class="tinybtn" data-spending-category-manage>분류 관리</button></div><div class="spending-distribution">${categoryList}</div>${unclassified ? `<button class="spending-unclassified" data-spending-category-filter="미분류">${spendingCategoryIcon('미분류')}<span>미분류 ${unclassified}건</span><strong>분류하기 ›</strong></button>` : ''}<details class="spending-top-items"><summary>많이 쓴 항목 TOP 5</summary>${spendingItemRows(analysis.items.slice(0, 5), true, period)}</details></section>` : `<div class="cardv2-filters"><button data-spending-category-filter="" class="${escapeHtml(!selected ? 'active' : '')}">전체</button>${analysis.categories.map(x => `<button data-spending-category-filter="${escapeHtml(x.key)}" class="${escapeHtml(selected === x.key ? 'active' : '')}">${escapeHtml(x.key)}</button>`).join('')}</div><section class="card spending-card"><div class="sectionhead"><h2>${escapeHtml(selected || '소비 항목')}</h2><span>${items.length}개</span></div>${spendingItemRows(items, false, period)}</section>`}${/^\d{4}-\d{2}$/.test(period) ? `<button class="card spending-budget-card" data-spending-budget><span>${budget ? '월 생활비 목표' : '생활비 목표 설정'}</span><strong>${budget ? won(budget) : '선택 사항 ›'}</strong>${budget ? `<small>사용 ${won(analysis.total)} · ${budget - analysis.total >= 0 ? '남음' : '초과'} ${won(Math.abs(budget - analysis.total))}</small>` : ''}</button>` : ''}</div>`;
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
    const form = cardUiForm('항목 이름·분류 수정', `${cardUiInput('item', '항목 이름', first.item)}${cardUiCategoryField(first.category)}<p class="source-note">선택한 구매 ${rows.length}건의 표시 이름과 분류를 바꿉니다. 구매·청구·납부 원본과 금액은 그대로 유지돼요.</p>`, async (data) => { if (await saveSpendingClassifications(rows.map(x => x.id), String(data.category), String(data.item))) {
        if (sheetInteractionToken() !== token || !form.isConnected || !$('#formSheet').classList.contains('open')) {
            renderKeepingScroll();
            return;
        }
        sheetDirty = false;
        renderKeepingScroll();
        if (cardId)
            openCardLedgerDetail(cardId);
        else
            openSpendingItemDetail(String(data.item), period, 'summary', String(data.category));
        toast('이름과 분류를 저장했어요.');
    } }, () => { if (cardId)
        openCardLedgerDetail(cardId);
    else
        openSpendingItemDetail(first.item, period, 'summary', first.category); });
    const token = sheetInteractionToken();
}
function bindSpendingReview() {
    $$('[data-spending-period-picker]').forEach(b => b.onclick = openSpendingPeriodPicker);
    $$('[data-integrated-filter-reset]').forEach(b => b.onclick = () => { setting().integratedLedgerFilter = 'all'; setting().integratedLedgerCategory = ''; rememberViewPreferences(); render(); });
    if (route().root === 'integrated' && route().tab === 'spending')
        $$('[data-integrated-month-shift]').forEach(b => b.onclick = () => { const step = spendingPeriodMode() === 'quarter' ? 3 : spendingPeriodMode() === 'half' ? 6 : ['year', 'years'].includes(spendingPeriodMode()) ? 12 : 1; setting().integratedMonth = integratedSpendingMonthShift(integratedSelectedMonth(), step * Number(b.dataset.integratedMonthShift)); clearSpendingSelection(); rememberViewPreferences(); render(); });
    $$('[data-spending-period],[data-spending-year-view]').forEach(b => b.onclick = async () => { setting().spendingPeriod = b.dataset.spendingPeriod || b.dataset.spendingYearView; clearSpendingSelection(); rememberViewPreferences(); render(); });
    $$('[data-spending-view]').forEach(b => b.onclick = async () => { setting().spendingView = b.dataset.spendingView; setting().spendingCategoryFilter = ''; rememberViewPreferences(); render(); });
    $$('[data-spending-category-filter]').forEach(b => b.onclick = async () => { setting().spendingView = 'items'; setting().spendingCategoryFilter = b.dataset.spendingCategoryFilter || ''; rememberViewPreferences(); render(); });
    $$('[data-spending-item]').forEach(b => b.onclick = () => openSpendingItemDetail(b.dataset.spendingItem || '', spendingPeriodKey(), 'summary', b.dataset.spendingItemCategory || ''));
    $$('[data-spending-category-manage]').forEach(b => b.onclick = () => openSpendingCategoryManagement());
    $$('[data-spending-transaction]').forEach(b => b.onclick = () => openIntegratedTransactionDetail(b.dataset.spendingTransaction || ''));
    $$('[data-spending-item-tab]').forEach(b => b.onclick = () => openSpendingItemDetail(b.dataset.itemKey || '', b.dataset.itemPeriod, b.dataset.spendingItemTab, b.closest('[data-item-category]')?.dataset.itemCategory));
    $$('[data-spending-item-period]').forEach(b => b.onclick = () => openSpendingItemDetail(b.dataset.itemKey || '', b.dataset.spendingItemPeriod === 'year' ? String(b.dataset.itemPeriod || integratedSelectedMonth()).slice(0, 4) : (/^\d{4}-\d{2}$/.test(String(b.dataset.itemPeriod || '')) ? b.dataset.itemPeriod : String(b.dataset.itemPeriod || integratedSelectedMonth()).slice(0, 4) + '-' + integratedSelectedMonth().slice(5, 7)), b.dataset.itemTab, b.closest('[data-item-category]')?.dataset.itemCategory));
    $$('[data-spending-classify]').forEach(b => b.onclick = () => openSpendingClassification([b.dataset.spendingClassify || ''], spendingPeriodKey(), b.dataset.classifyCard));
    $$('[data-spending-classify-item]').forEach(b => b.onclick = () => { const period = b.dataset.classifyPeriod || spendingPeriodKey(), rows = integratedSpendingAnalysis(period).rows.filter(x => spendingName(x) === b.dataset.spendingClassifyItem && x.category === b.closest('[data-item-category]')?.dataset.itemCategory); openSpendingClassification([...new Set(rows.map(x => String(x.type === 'refund' ? x.meta?.refundOf : x.id)))], period); });
    $$('[data-spending-select]').forEach(b => b.onclick = () => { const chart = b.closest('.spending-chart'); if (chart)
        selectSpendingChartPoint(chart, b); });
    $$('.spending-chart').forEach(bindSpendingChartDrag);
    $$('[data-spending-day-picker]').forEach(p => p.onchange = () => { const chart = p.closest('.spending-chart'); chart?.querySelectorAll('[data-spending-select]').forEach(b => { if (b.dataset.spendingSelect === p.value)
        b.click(); }); });
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
