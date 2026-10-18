'use strict';
const LOCAL_DATABASE_FORMAT = 1;
let localDatabase = null, localDatabaseRevision = 0, localDatabaseEnvelope = null;
let localDatabaseRows = new Map(), localDatabaseReady = false;
let localDatabaseSync = null;
const LOCAL_DATABASE_NAME = `asset-os-ledger-${APP_ENV}`;
function localDbRequest(request) { return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error || new Error('기기 저장 요청 실패')); }); }
function localDbDone(tx) { return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error || new Error('기기 저장이 취소됐습니다.')); tx.onerror = () => { }; }); }
function localDbTransaction(stores, mode) { if (!localDatabase)
    throw new Error('기기 저장소가 준비되지 않았습니다.'); return localDatabase.transaction(stores, mode, mode === 'readwrite' ? { durability: 'strict' } : undefined); }
async function localDbOpen() {
    if (localDatabase)
        return localDatabase;
    if (typeof indexedDB === 'undefined')
        throw new Error('이 브라우저에서 기기 데이터베이스를 사용할 수 없습니다. 브라우저 저장 권한을 확인해 주세요.');
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(LOCAL_DATABASE_NAME, LOCAL_DATABASE_FORMAT);
        let expired = false;
        const timer = setTimeout(() => { expired = true; reject(new Error('저장소 열기가 지연되고 있습니다. 같은 앱의 다른 탭을 닫고 다시 열어 주세요.')); }, 10000);
        request.onupgradeneeded = () => { const db = request.result; db.createObjectStore('meta'); const rows = db.createObjectStore('records', { keyPath: 'key' }); rows.createIndex('collection', 'collection'); rows.createIndex('period', ['collection', 'date', 'ordinal']); db.createObjectStore('recovery', { keyPath: 'key' }); };
        request.onerror = () => { clearTimeout(timer); reject(request.error || new Error('기기 저장소를 열지 못했습니다.')); };
        request.onsuccess = () => { clearTimeout(timer); if (expired) {
            request.result.close();
            return;
        } localDatabase = request.result; localDatabase.onversionchange = () => { localDatabase?.close(); localDatabase = null; localDatabaseReady = false; }; resolve(localDatabase); };
    });
}
async function localDbChecksum(raw) { if (!globalThis.crypto?.subtle)
    throw new Error('안전한 저장 검증을 위해 HTTPS 연결이 필요합니다.'); const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)); return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join(''); }
function localDbRecord(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
function localDbPack(envelope) {
    const header = JSON.parse(JSON.stringify(envelope)), arrays = [], rows = [];
    const walk = (value, path) => {
        if (!localDbRecord(value))
            return;
        for (const [key, item] of Object.entries(value)) {
            const next = [...path, key];
            if (Array.isArray(item)) {
                if (next.join('/') === 'data/accounts') {
                    item.forEach((account, index) => walk(account, [...next, String(index)]));
                    continue;
                }
                const collection = JSON.stringify(next), ids = new Set();
                arrays.push({ path: next, count: item.length });
                item.forEach((row, ordinal) => { const proposed = localDbRecord(row) && typeof row.id === 'string' ? `id:${row.id}` : `position:${ordinal}`, identity = ids.has(proposed) ? `duplicate:${ordinal}` : proposed; ids.add(identity); rows.push({ key: JSON.stringify([collection, identity]), collection, ordinal, date: localDbRecord(row) ? String(row.date || row.tradeDate || row.asOf || '').slice(0, 10) : '', value: row }); });
                value[key] = [];
            }
            else
                walk(item, next);
        }
    };
    walk(header, []);
    return { envelope: header, arrays, rows };
}
function localDbUnpack(head, rows) {
    const envelope = JSON.parse(JSON.stringify(head.envelope)), groups = new Map();
    for (const row of rows) {
        const list = groups.get(row.collection) || [];
        list.push(row);
        groups.set(row.collection, list);
    }
    for (const spec of head.arrays) {
        const list = (groups.get(JSON.stringify(spec.path)) || []).sort((a, b) => a.ordinal - b.ordinal);
        if (list.length !== spec.count || list.some((row, index) => row.ordinal !== index))
            throw new Error('저장된 기록의 개수 또는 순서가 일치하지 않습니다. 원본을 보존하고 복구를 중단했습니다.');
        let target = envelope;
        for (const key of spec.path.slice(0, -1))
            target = target[key];
        if (!localDbRecord(target) && !Array.isArray(target))
            throw new Error('저장 데이터 경로 검증 실패');
        target[spec.path[spec.path.length - 1]] = list.map(row => row.value);
        groups.delete(JSON.stringify(spec.path));
    }
    if (groups.size)
        throw new Error('연결되지 않은 저장 기록을 발견했습니다.');
    return envelope;
}
async function localDbRead() {
    await localDbOpen();
    const tx = localDbTransaction(['meta', 'records', 'recovery'], 'readonly'), done = localDbDone(tx);
    const [head, rows, sync, legacy] = await Promise.all([localDbRequest(tx.objectStore('meta').get('head')), localDbRequest(tx.objectStore('records').getAll()), localDbRequest(tx.objectStore('meta').get('sync')), localDbRequest(tx.objectStore('recovery').get('before-migration'))]);
    await done;
    if (legacy?.legacyKey) {
        const old = localStorage.getItem(legacy.legacyKey);
        if (old && old !== legacy.raw)
            throw new Error('이전 버전에서 원장을 수정한 기록이 있습니다. 두 원본을 보존하고 자동 덮어쓰기를 중단했습니다. 이전 탭을 닫고 자료를 확인해 주세요.');
    }
    localDatabaseSync = sync || null;
    if (!head) {
        if (rows.length)
            throw new Error('저장소에 원장 정보가 없는 기록이 있습니다. 자동 초기화를 중단했습니다.');
        localDatabaseRevision = 0;
        localDatabaseRows.clear();
        localDatabaseEnvelope = null;
        localDatabaseReady = true;
        return null;
    }
    if (head.format !== LOCAL_DATABASE_FORMAT)
        throw new Error('새 버전 앱에서 저장한 자료입니다. 앱을 업데이트해 주세요.');
    const envelope = localDbUnpack(head, rows);
    if (await localDbChecksum(JSON.stringify(envelope)) !== head.checksum)
        throw new Error('저장 데이터 검증값이 일치하지 않습니다. 자동 덮어쓰기를 중단했습니다.');
    localDatabaseRevision = head.revision;
    localDatabaseRows = new Map(rows.map(row => [row.key, JSON.stringify(row)]));
    localDatabaseEnvelope = envelope;
    localDatabaseReady = true;
    return envelope;
}
async function localDbCommit(envelope, { recovery, damagedSource, legacyKey = KEY, expectedRevision = localDatabaseRevision } = {}) {
    if (!localDatabaseReady)
        throw new Error('기기 저장소를 다시 열어 확인해 주세요.');
    const raw = JSON.stringify(envelope), packed = localDbPack(envelope), checksum = await localDbChecksum(raw), currentRows = new Map(packed.rows.map(row => [row.key, JSON.stringify(row)])), changed = packed.rows.filter(row => currentRows.get(row.key) !== localDatabaseRows.get(row.key)), removed = [...localDatabaseRows.keys()].filter(key => !currentRows.has(key));
    const head = { format: 1, revision: expectedRevision + 1, envelope: packed.envelope, arrays: packed.arrays, checksum, bytes: new TextEncoder().encode(raw).length, updatedAt: new Date().toISOString() }, tx = localDbTransaction(['meta', 'records', 'recovery'], 'readwrite'), done = localDbDone(tx), meta = tx.objectStore('meta');
    let conflict = false, writeError = null;
    const request = meta.get('head');
    request.onsuccess = () => { try {
        const prior = request.result;
        if ((prior?.revision || 0) !== expectedRevision) {
            conflict = true;
            tx.abort();
            return;
        }
        for (const row of changed)
            tx.objectStore('records').put(row);
        for (const key of removed)
            tx.objectStore('records').delete(key);
        if (recovery)
            tx.objectStore('recovery').put({ key: 'before-migration', raw: recovery, legacyKey, createdAt: head.updatedAt });
        if (damagedSource)
            tx.objectStore('recovery').put({ key: 'before-repair', raw: damagedSource, createdAt: head.updatedAt });
        meta.put(head, 'head');
    }
    catch (error) {
        writeError = error;
        tx.abort();
    } };
    try {
        await done;
    }
    catch (error) {
        if (writeError)
            throw writeError;
        if (conflict)
            throw new Error('다른 화면에서 원장이 변경됐습니다. 작성 중인 내용은 유지됩니다. 최신 원장을 확인한 뒤 다시 저장해 주세요.');
        throw error;
    }
    localDatabaseRevision = head.revision;
    localDatabaseRows = currentRows;
    localDatabaseEnvelope = JSON.parse(raw);
    try {
        localStorage.setItem(`${KEY}-database-change`, JSON.stringify({ revision: head.revision, at: head.updatedAt }));
    }
    catch { }
}
async function localDbRecovery(key, raw) { await localDbOpen(); const tx = localDbTransaction(['recovery'], 'readwrite'), done = localDbDone(tx); const store = tx.objectStore('recovery'), createdAt = new Date().toISOString(), scan = store.getAll(); scan.onsuccess = () => { const prior = scan.result.filter(row => row.key !== 'before-migration' && row.key !== 'before-repair' && row.key !== key); prior.push({ key, createdAt }); prior.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.key.localeCompare(a.key)); for (const old of prior.slice(3))
    store.delete(old.key); store.put({ key, raw, createdAt }); }; await done; const read = localDbTransaction(['recovery'], 'readonly'), readDone = localDbDone(read), result = await localDbRequest(read.objectStore('recovery').get(key)); await readDone; if (result?.raw !== raw)
    throw new Error('복구용 사본 검증 실패'); return true; }
async function localDbSaveSync(value) { const tx = localDbTransaction(['meta'], 'readwrite'), done = localDbDone(tx); tx.objectStore('meta').put(value, 'sync'); await done; localDatabaseSync = JSON.parse(JSON.stringify(value)); }
async function localDbUsage() { const estimate = await navigator.storage?.estimate?.(); return { usage: Number(estimate?.usage) || 0, quota: Number(estimate?.quota) || 0, persistent: !!(await navigator.storage?.persisted?.()) }; }
async function localDbProbe() { try {
    const key = 'storage-probe', value = crypto.randomUUID(), tx = localDbTransaction(['meta'], 'readwrite'), done = localDbDone(tx);
    tx.objectStore('meta').put(value, key);
    await done;
    const read = localDbTransaction(['meta'], 'readwrite'), readDone = localDbDone(read), request = read.objectStore('meta').get(key);
    let matched = false;
    request.onsuccess = () => { matched = request.result === value; read.objectStore('meta').delete(key); };
    await readDone;
    return matched;
}
catch {
    return false;
} }
async function localDbRescue(userId) {
    if (APP_ENV !== 'qa' && !userId)
        throw new Error('기존 계정으로 로그인한 뒤 복구해 주세요.');
    await localDbOpen();
    const tx = localDbTransaction(['meta', 'records', 'recovery'], 'readonly'), done = localDbDone(tx);
    const [head, rows, copies, sync] = await Promise.all([localDbRequest(tx.objectStore('meta').get('head')), localDbRequest(tx.objectStore('records').getAll()), localDbRequest(tx.objectStore('recovery').getAll()), localDbRequest(tx.objectStore('meta').get('sync'))]);
    await done;
    if (APP_ENV !== 'qa' && sync?.userId && sync.userId !== userId)
        throw new Error('이 원장을 저장했던 계정으로 로그인해 주세요.');
    return { head, rows, copies, sync };
}
async function localDbRepair(envelope, userId, expectedRevision) {
    const source = await localDbRescue(userId), head = source.head;
    if (head && (head.format !== LOCAL_DATABASE_FORMAT || Number(head.envelope?.schemaVersion) > SCHEMA_VERSION || !Number.isSafeInteger(head.revision) || head.revision < 0))
        throw new Error('현재 버전에서 복구할 수 없는 원장입니다. 원본을 내려받아 확인해 주세요.');
    if ((head?.revision || 0) !== expectedRevision)
        throw new Error('복구 준비 중 다른 화면에서 원장이 변경됐습니다. 다시 확인해 주세요.');
    const legacy = source.copies.find(copy => copy.key === 'before-migration');
    if (legacy?.legacyKey) {
        const old = localStorage.getItem(legacy.legacyKey);
        if (old && old !== legacy.raw)
            throw new Error('이전 버전에서 수정한 원본이 있습니다. 원본을 내려받아 두 자료를 먼저 확인해 주세요.');
    }
    localDatabaseRevision = expectedRevision;
    localDatabaseRows = new Map(source.rows.map(row => [row.key, JSON.stringify(row)]));
    localDatabaseReady = true;
    try {
        await localDbCommit(envelope, { expectedRevision, damagedSource: JSON.stringify({ head: source.head, rows: source.rows }) });
        await localDbRead();
    }
    catch (error) {
        localDatabaseReady = false;
        throw error;
    }
}
const assetLocalDatabase = { rescue: localDbRescue, repair: localDbRepair, read: localDbRead, commit: localDbCommit, recovery: localDbRecovery, saveSync: localDbSaveSync, usage: localDbUsage, probe: localDbProbe, get envelope() { return localDatabaseEnvelope; }, get revision() { return localDatabaseRevision; }, get sync() { return localDatabaseSync; } };
