'use strict';
function migrationRecord(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function migrationRows(value) { return Array.isArray(value) ? value : []; }
function migrationClone(value) { return JSON.parse(JSON.stringify(migrationRecord(value))); }
function migrateStateStep(data, fromVersion) {
    const next = data;
    if (fromVersion === 4) {
        next.settings = migrationRecord(next.settings);
        next.pension = migrationRecord(next.pension);
        for (const key of ['accounts', 'contributions', 'transactions', 'holdings', 'incomes', 'assetSnapshots'])
            next.pension[key] = migrationRows(next.pension[key]);
        next.integrated = migrationRecord(next.integrated);
        for (const key of ['accounts', 'liabilities', 'ledger'])
            next.integrated[key] = migrationRows(next.integrated[key]);
    }
    if (fromVersion === 5) {
        next.financialProducts = migrationRecord(next.financialProducts);
        next.financialProducts.items = migrationRows(next.financialProducts.items);
        next.financialProducts.events = migrationRows(next.financialProducts.events);
    }
    if (fromVersion === 6) {
        next.financeSchedules = migrationRecord(next.financeSchedules);
        next.financeSchedules.items = migrationRows(next.financeSchedules.items);
    }
    if (fromVersion === 7) {
        next.insurance = migrationRecord(next.insurance);
        next.insurance.policies = migrationRows(next.insurance.policies);
    }
    if (fromVersion === 8) {
        next.sourceArchives = migrationRecord(next.sourceArchives);
        next.sourceArchives.records = migrationRows(next.sourceArchives.records);
    }
    if (fromVersion === 9)
        next.moduleVerification = { isa: false, pension: false, irp: false, ...migrationRecord(next.moduleVerification) };
    if (fromVersion === 10)
        for (const account of migrationRows(next.accounts)) {
            account.holdings = migrationRows(account.holdings);
            account.transactions = migrationRows(account.transactions);
            account.assetSnapshots = migrationRows(account.assetSnapshots);
        }
    if (fromVersion === 11) {
        next.policies = migrationRecord(next.policies);
        next.system = migrationRecord(next.system);
    }
    if (fromVersion === 12) {
        next.brokerKis = migrationRecord(next.brokerKis);
        for (const key of ['balanceSnapshots', 'orders', 'rights'])
            next.brokerKis[key] = migrationRows(next.brokerKis[key]);
    }
    if (fromVersion === 13)
        for (const account of migrationRows(next.accounts)) {
            account.reconciliations = migrationRows(account.reconciliations);
            account.corporateActions = migrationRows(account.corporateActions);
        }
    if (fromVersion === 14)
        for (const account of migrationRows(next.accounts))
            for (const tx of migrationRows(account.transactions))
                tx.revisions = migrationRows(tx.revisions);
    if (fromVersion === 15)
        for (const account of migrationRows(next.accounts))
            account.policyHistory = migrationRows(account.policyHistory);
    if (fromVersion === 16) {
        next.pension = migrationRecord(next.pension);
        next.pension.projection = migrationRecord(next.pension.projection);
        next.pension.goal = migrationRecord(next.pension.goal);
    }
    if (fromVersion === 17) {
        next.settings = migrationRecord(next.settings);
        next.settings.pensionTaxProfile = migrationRecord(next.settings.pensionTaxProfile);
        next.settings.irpRiskClassifications = migrationRecord(next.settings.irpRiskClassifications);
    }
    if (fromVersion === 18) {
        next.integrated = migrationRecord(next.integrated);
        for (const row of migrationRows(next.integrated.ledger))
            row.meta = migrationRecord(row.meta);
    }
    if (fromVersion === 19) {
        next.settings = migrationRecord(next.settings);
        if (typeof next.settings.integratedLedgerFilter !== 'string')
            next.settings.integratedLedgerFilter = 'all';
    }
    if (fromVersion === 20) {
        next.system = migrationRecord(next.system);
        if (typeof next.system.loadWarning !== 'string')
            next.system.loadWarning = '';
        if (typeof next.system.saveError !== 'string')
            next.system.saveError = '';
    }
    return next;
}
function migrateStateData(data, fromVersion, toVersion = SCHEMA_VERSION) {
    const source = Number(fromVersion), target = Number(toVersion);
    if (!Number.isInteger(source) || !Number.isInteger(target) || source < 4 || target > SCHEMA_VERSION || source > target)
        throw new Error(`지원하지 않는 저장 형식 ${fromVersion}`);
    const next = migrationClone(data), applied = [];
    for (let version = source; version < target; version++) {
        migrateStateStep(next, version);
        applied.push(version + 1);
    }
    return { data: next, applied };
}
