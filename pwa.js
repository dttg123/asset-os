'use strict';
let assetInstallPrompt=null;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();assetInstallPrompt=event});
window.addEventListener('appinstalled',()=>{assetInstallPrompt=null});
async function installAssetOs(){if(!assetInstallPrompt){toast('브라우저 메뉴의 홈 화면에 추가를 이용해 주세요.');return false}assetInstallPrompt.prompt();const result=await assetInstallPrompt.userChoice;assetInstallPrompt=null;return result?.outcome==='accepted'}
if('serviceWorker'in navigator)window.addEventListener('load',async()=>{try{const reg=await navigator.serviceWorker.register('./service-worker.js?v=0.4.26',{scope:'./',updateViaCache:'none'});await reg.update();let refreshing=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(refreshing)return;refreshing=true;const key='asset-os-sw-reload-0.4.26';if(sessionStorage.getItem(key))return;sessionStorage.setItem(key,'1');location.reload()})}catch{}});
