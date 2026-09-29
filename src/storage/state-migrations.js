'use strict';
function migrationRecord(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function migrationRows(value) { return Array.isArray(value) ? value : []; }
function migrationClone(value) { return JSON.parse(JSON.stringify(migrationRecord(value))); }
function migrationMutate(data, apply) { apply(data); return data; }
const STATE_MIGRATIONS = [
    { from: 4, to: 5, name: 'initialize pension and integrated collections', migrate: data => migrationMutate(data, next => { next.settings = migrationRecord(next.settings); next.pension = migrationRecord(next.pension); for (const key of ['accounts', 'contributions', 'transactions', 'holdings', 'incomes', 'assetSnapshots'])
            next.pension[key] = migrationRows(next.pension[key]); next.integrated = migrationRecord(next.integrated); for (const key of ['accounts', 'liabilities', 'ledger'])
            next.integrated[key] = migrationRows(next.integrated[key]); }) },
    { from: 5, to: 6, name: 'initialize financial product collections', migrate: data => migrationMutate(data, next => { next.financialProducts = migrationRecord(next.financialProducts); next.financialProducts.items = migrationRows(next.financialProducts.items); next.financialProducts.events = migrationRows(next.financialProducts.events); }) },
    { from: 6, to: 7, name: 'initialize finance schedules', migrate: data => migrationMutate(data, next => { next.financeSchedules = migrationRecord(next.financeSchedules); next.financeSchedules.items = migrationRows(next.financeSchedules.items); }) },
    { from: 7, to: 8, name: 'initialize insurance policies', migrate: data => migrationMutate(data, next => { next.insurance = migrationRecord(next.insurance); next.insurance.policies = migrationRows(next.insurance.policies); }) },
    { from: 8, to: 9, name: 'initialize source archives', migrate: data => migrationMutate(data, next => { next.sourceArchives = migrationRecord(next.sourceArchives); next.sourceArchives.records = migrationRows(next.sourceArchives.records); }) },
    { from: 9, to: 10, name: 'initialize module verification', migrate: data => migrationMutate(data, next => { next.moduleVerification = { isa: false, pension: false, irp: false, ...migrationRecord(next.moduleVerification) }; }) },
    { from: 10, to: 11, name: 'initialize ISA account collections', migrate: data => migrationMutate(data, next => { for (const account of migrationRows(next.accounts)) {
            account.holdings = migrationRows(account.holdings);
            account.transactions = migrationRows(account.transactions);
            account.assetSnapshots = migrationRows(account.assetSnapshots);
        } }) },
    { from: 11, to: 12, name: 'initialize policies and system state', migrate: data => migrationMutate(data, next => { next.policies = migrationRecord(next.policies); next.system = migrationRecord(next.system); }) },
    { from: 12, to: 13, name: 'initialize KIS collections', migrate: data => migrationMutate(data, next => { next.brokerKis = migrationRecord(next.brokerKis); for (const key of ['balanceSnapshots', 'orders', 'rights'])
            next.brokerKis[key] = migrationRows(next.brokerKis[key]); }) },
    { from: 13, to: 14, name: 'initialize reconciliation collections', migrate: data => migrationMutate(data, next => { for (const account of migrationRows(next.accounts)) {
            account.reconciliations = migrationRows(account.reconciliations);
            account.corporateActions = migrationRows(account.corporateActions);
        } }) },
    { from: 14, to: 15, name: 'initialize transaction revisions', migrate: data => migrationMutate(data, next => { for (const account of migrationRows(next.accounts))
            for (const tx of migrationRows(account.transactions))
                tx.revisions = migrationRows(tx.revisions); }) },
    { from: 15, to: 16, name: 'initialize account policy history', migrate: data => migrationMutate(data, next => { for (const account of migrationRows(next.accounts))
            account.policyHistory = migrationRows(account.policyHistory); }) },
    { from: 16, to: 17, name: 'initialize pension projection and goal', migrate: data => migrationMutate(data, next => { next.pension = migrationRecord(next.pension); next.pension.projection = migrationRecord(next.pension.projection); next.pension.goal = migrationRecord(next.pension.goal); }) },
    { from: 17, to: 18, name: 'initialize tax and risk settings', migrate: data => migrationMutate(data, next => { next.settings = migrationRecord(next.settings); next.settings.pensionTaxProfile = migrationRecord(next.settings.pensionTaxProfile); next.settings.irpRiskClassifications = migrationRecord(next.settings.irpRiskClassifications); }) },
    { from: 18, to: 19, name: 'initialize integrated ledger metadata', migrate: data => migrationMutate(data, next => { next.integrated = migrationRecord(next.integrated); for (const row of migrationRows(next.integrated.ledger))
            row.meta = migrationRecord(row.meta); }) },
    { from: 19, to: 20, name: 'initialize integrated ledger filter', migrate: data => migrationMutate(data, next => { next.settings = migrationRecord(next.settings); if (typeof next.settings.integratedLedgerFilter !== 'string')
            next.settings.integratedLedgerFilter = 'all'; }) },
    { from: 20, to: 21, name: 'initialize storage diagnostics', migrate: data => migrationMutate(data, next => { next.system = migrationRecord(next.system); if (typeof next.system.loadWarning !== 'string')
            next.system.loadWarning = ''; if (typeof next.system.saveError !== 'string')
            next.system.saveError = ''; }) }
];
const STATE_MIGRATION_BY_VERSION = new Map(STATE_MIGRATIONS.map(step => [step.from, step]));
function stateMigrationPlan(fromVersion, toVersion = SCHEMA_VERSION) {
    const source = Number(fromVersion), target = Number(toVersion);
    if (!Number.isInteger(source) || !Number.isInteger(target) || source < 4 || target > SCHEMA_VERSION || source > target)
        throw new Error(`지원하지 않는 저장 형식 ${fromVersion}`);
    const plan = [];
    for (let version = source; version < target; version++) {
        const step = STATE_MIGRATION_BY_VERSION.get(version);
        if (!step || step.to !== version + 1)
            throw new Error(`누락된 데이터 마이그레이션 ${version}→${version + 1}`);
        plan.push({ from: step.from, to: step.to, name: step.name });
    }
    return plan;
}
function migrateStateData(data, fromVersion, toVersion = SCHEMA_VERSION) {
    const plan = stateMigrationPlan(fromVersion, toVersion), next = migrationClone(data), applied = [];
    for (const descriptor of plan) {
        const step = STATE_MIGRATION_BY_VERSION.get(descriptor.from);
        if (!step)
            throw new Error(`누락된 데이터 마이그레이션 ${descriptor.from}→${descriptor.to}`);
        step.migrate(next);
        applied.push(step.to);
    }
    return { data: next, applied };
}
