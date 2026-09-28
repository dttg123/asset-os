'use strict';
function cloudRpcResult(data) {
    const value = Array.isArray(data) ? data[0] : data;
    return value && typeof value === 'object' ? value : null;
}
function cloudPendingWriteFor(current, fingerprint, baseRevision, createRequestId) {
    if (current && current.fingerprint === fingerprint)
        return current;
    return { fingerprint, requestId: createRequestId(), expectedRevision: Number(baseRevision) || 0 };
}
function cloudSaveRpcArguments(pending, payload) {
    return { p_expected_revision: pending.expectedRevision, p_payload: payload, p_request_id: pending.requestId };
}
