'use strict';
if ('serviceWorker' in navigator)
    window.addEventListener('load', async () => {
        let controller = navigator.serviceWorker.controller, refreshing = false, pending = false, timer;
        const applyUpdate = () => {
            if (!pending || refreshing || document.visibilityState === 'hidden' || document.querySelector('.sheet.open,dialog[open],[data-storage-saving]'))
                return;
            refreshing = true;
            if (timer)
                clearInterval(timer);
            location.reload();
        };
        // Listen before registration/update: a fast worker may activate before update() resolves.
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            const next = navigator.serviceWorker.controller;
            if (next === controller)
                return;
            const hadController = !!controller;
            controller = next;
            if (!hadController)
                return;
            pending = true;
            applyUpdate();
            if (!refreshing && !timer)
                timer = setInterval(applyUpdate, 1000);
        });
        try {
            const reg = await navigator.serviceWorker.register('./service-worker.js?v=0.7.14&build=20261026-2', { scope: './', updateViaCache: 'none' });
            let checking = false;
            const check = async () => { if (checking || document.visibilityState === 'hidden')
                return; checking = true; try {
                await reg.update();
            }
            catch { }
            finally {
                checking = false;
                applyUpdate();
            } };
            window.addEventListener('focus', () => { void check(); });
            document.addEventListener('visibilitychange', () => { void check(); });
            await check();
        }
        catch { }
    });
