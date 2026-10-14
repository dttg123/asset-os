'use strict';
if ('serviceWorker' in navigator)
    window.addEventListener('load', async () => { const hadController = !!navigator.serviceWorker.controller; try {
        const reg = await navigator.serviceWorker.register('./service-worker.js?v=0.6.17&build=20261014-2', { scope: './', updateViaCache: 'none' });
        await reg.update();
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => { if (!hadController || refreshing)
            return; refreshing = true; const key = 'asset-os-sw-reload-0.6.17-build20261014-2'; if (sessionStorage.getItem(key))
            return; sessionStorage.setItem(key, '1'); location.reload(); });
    }
    catch { } });
