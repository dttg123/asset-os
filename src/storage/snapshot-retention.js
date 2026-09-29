'use strict';
const SNAPSHOT_DAILY_KEEP_MONTHS = 6;
function snapshotDate(row) { const value = String(row?.date || '').slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    return ''; const parsed = new Date(value + 'T00:00:00Z'); return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? '' : value; }
function snapshotMonthSerial(value) { const match = /^(\d{4})-(\d{2})/.exec(String(value || '')), month = match ? Number(match[2]) : 0; return match && month >= 1 && month <= 12 ? Number(match[1]) * 12 + month - 1 : null; }
function compactAutomaticSnapshots(list, { referenceDate = localYmd(), automatic = () => false, group = () => '', freshness = row => `${snapshotDate(row)}|${String(row?.fetchedAt || '')}`, compactHistorical = row => row } = {}) {
    const rows = Array.isArray(list) ? list : [], referenceMonth = snapshotMonthSerial(referenceDate), cutoff = referenceMonth === null ? null : referenceMonth - SNAPSHOT_DAILY_KEEP_MONTHS + 1, keep = new Set(), monthly = new Map(), historical = new Set();
    let protectedCount = 0;
    rows.forEach((row, index) => { const date = snapshotDate(row), serial = snapshotMonthSerial(date); if (!automatic(row) || !date || serial === null || cutoff === null) {
        keep.add(index);
        protectedCount++;
        return;
    } if (serial >= cutoff) {
        keep.add(index);
        return;
    } const key = `${group(row)}|${date.slice(0, 7)}`, prior = monthly.get(key), rank = `${freshness(row)}|${String(index).padStart(12, '0')}`; if (!prior || rank > prior.rank)
        monthly.set(key, { index, rank }); });
    for (const selected of monthly.values()) {
        keep.add(selected.index);
        historical.add(selected.index);
    }
    return { rows: rows.flatMap((row, index) => keep.has(index) ? [historical.has(index) ? compactHistorical(row) : row] : []), removed: rows.length - keep.size, protected: protectedCount };
}
function compactStateSnapshots(input, referenceDate = localYmd()) {
    const target = input && typeof input === 'object' ? input : {}, report = { referenceDate, dailyMonths: SNAPSHOT_DAILY_KEEP_MONTHS, isaRemoved: 0, kisRemoved: 0, protected: 0 };
    for (const account of Array.isArray(target.accounts) ? target.accounts : []) {
        const result = compactAutomaticSnapshots(account.assetSnapshots, { referenceDate, automatic: row => row?.meta?.autoSnapshot === true && !row?.meta?.qaFixture, group: () => String(account.id || ''), compactHistorical: row => ({ ...row, meta: { autoSnapshot: true, grain: 'month', valueBasis: row.meta?.valueBasis || 'securities', totalValueBasis: row.meta?.totalValueBasis || 'securities_plus_cash', verified: row.meta?.verified === true } }) });
        account.assetSnapshots = result.rows;
        report.isaRemoved += result.removed;
        report.protected += result.protected;
    }
    const broker = target.brokerKis;
    if (broker && Array.isArray(broker.balanceSnapshots)) {
        const latest = new Map();
        for (const row of broker.balanceSnapshots) {
            const key = `${row.accountKind || ''}|${row.accountId || ''}`, rank = `${snapshotDate(row)}|${String(row?.fetchedAt || '')}`, prior = latest.get(key);
            if (!prior || rank > prior.rank)
                latest.set(key, { row, rank });
        }
        const result = compactAutomaticSnapshots(broker.balanceSnapshots, { referenceDate, automatic: row => row?.source === 'kis', group: row => `${row.accountKind || ''}|${row.accountId || ''}`, freshness: row => `${snapshotDate(row)}|${String(row?.fetchedAt || '')}`, compactHistorical: row => latest.get(`${row.accountKind || ''}|${row.accountId || ''}`)?.row === row ? row : { id: row.id, source: 'kis', summaryOnly: true, authoritative: row.authoritative === true, accountKind: row.accountKind, accountId: row.accountId, date: row.date, fetchedAt: row.fetchedAt, cash: Number(row.cash) || 0, securitiesValue: Number(row.securitiesValue) || 0, totalValue: Number(row.totalValue) || 0, holdings: [] } });
        broker.balanceSnapshots = result.rows;
        report.kisRemoved = result.removed;
        report.protected += result.protected;
    }
    return report;
}
const MAX_STATE_BYTES = 4000000;
const STORAGE_NOTICE_BYTES = Math.round(MAX_STATE_BYTES * .7), STORAGE_WARNING_BYTES = Math.round(MAX_STATE_BYTES * .85), STORAGE_CRITICAL_BYTES = Math.round(MAX_STATE_BYTES * .95);
function storageUsageLevel(bytes) { return bytes >= STORAGE_CRITICAL_BYTES ? 'critical' : bytes >= STORAGE_WARNING_BYTES ? 'warning' : bytes >= STORAGE_NOTICE_BYTES ? 'notice' : 'ok'; }
function stateEnvelopeJson(data = state) { const payload = QA_MODE && typeof qaStorageState === 'function' ? qaStorageState(data) : data; return JSON.stringify({ schemaVersion: SCHEMA_VERSION, appVersion: APP_VERSION, environment: APP_ENV, savedAt: new Date().toISOString(), data: payload }); }
function stateEnvelopeBytes(raw) { return typeof TextEncoder === 'function' ? new TextEncoder().encode(raw).length : raw.length * 2; }
