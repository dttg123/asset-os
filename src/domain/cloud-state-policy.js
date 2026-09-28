'use strict';
function cloudObject(value) { return value && typeof value === 'object' ? value : {}; }
function cloudCollectionLength(value) { const length = cloudObject(value).length; return typeof length === 'number' ? length : typeof value === 'string' ? value.length : 0; }
function cloudCanonicalValue(value) {
    if (Array.isArray(value))
        return value.map(cloudCanonicalValue);
    if (value && typeof value === 'object') {
        const source = value, result = {};
        for (const key of Object.keys(source).sort()) {
            const item = cloudCanonicalValue(source[key]);
            if (item !== undefined)
                result[key] = item;
        }
        return result;
    }
    return value;
}
function cloudEnvelopeFingerprint(envelope) { try {
    return JSON.stringify(cloudCanonicalValue(envelope?.data || {}));
}
catch {
    return '';
} }
function cloudEnvelopeTime(envelope) { const time = Date.parse(String(envelope?.savedAt || '')); return Number.isFinite(time) ? time : 0; }
function cloudPayloadValid(payload) { const source = cloudObject(payload); return !!(payload && typeof payload === 'object' && source.data && typeof source.data === 'object'); }
function cloudDataHasMeaningfulRecords(data) {
    const source = cloudObject(data), pension = cloudObject(source.pension), integrated = cloudObject(source.integrated), products = cloudObject(source.financialProducts), schedules = cloudObject(source.financeSchedules);
    return !!(cloudCollectionLength(source.accounts) || cloudCollectionLength(pension.accounts) || cloudCollectionLength(pension.contributions) || cloudCollectionLength(pension.transactions) || cloudCollectionLength(pension.holdings) || cloudCollectionLength(pension.incomes) || cloudCollectionLength(products.items) || cloudCollectionLength(products.events) || cloudCollectionLength(schedules.items) || cloudCollectionLength(integrated.ledger));
}
function cloudReconcilePlan(local, row, force = 'auto') {
    const remote = row?.payload;
    if (!cloudPayloadValid(remote))
        return { action: 'reject-invalid' };
    const localMeaningful = !!local?.stored && cloudDataHasMeaningfulRecords(local.envelope?.data);
    const remoteMeaningful = cloudDataHasMeaningfulRecords(remote.data);
    if (!localMeaningful && remoteMeaningful)
        return { action: 'pull', notify: false };
    if (localMeaningful && !remoteMeaningful && force !== 'push')
        return { action: 'protect-empty' };
    const localTime = local?.stored ? cloudEnvelopeTime(local.envelope) : 0, remoteTime = cloudEnvelopeTime(remote);
    if (force === 'pull' || !local?.stored || remoteTime > localTime)
        return { action: 'pull', notify: true };
    if (force === 'push' || localTime > remoteTime)
        return { action: 'push' };
    if (cloudEnvelopeFingerprint(local?.envelope) !== cloudEnvelopeFingerprint(remote))
        return { action: 'conflict' };
    return { action: 'synced' };
}
