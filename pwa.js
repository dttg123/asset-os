'use strict';
if ('serviceWorker' in navigator)
    window.addEventListener('load', async () => { const hadController = !!navigator.serviceWorker.controller; try {
        const reg = await navigator.serviceWorker.register('./service-worker.js?v=0.7.10&build=20261024-5', { scope: './', updateViaCache: 'none' });
        await reg.update();
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => { if (!hadController || refreshing)
            return; refreshing = true; const key = 'asset-os-sw-reload-0.7.10-build20261024-5'; if (sessionStorage.getItem(key))
            return; sessionStorage.setItem(key, '1'); location.reload(); });
    }
    catch { } });
