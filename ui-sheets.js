'use strict';
let lockedScrollY = 0;
let activeSheetId = '';
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
function openSheet(id, options = {}) {
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
