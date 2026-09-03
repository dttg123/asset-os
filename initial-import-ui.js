'use strict';
const openBackupHubWithoutInitialImport=openBackupHub;
openBackupHub=function(){openBackupHubWithoutInitialImport();setTimeout(()=>{const grid=$('#sheetBody .backup-grid');if(!grid||grid.querySelector('[data-initial-import]'))return;const button=document.createElement('button');button.className='backup-action';button.dataset.initialImport='';button.innerHTML='<strong>확정 초기자료 병합</strong><small>기존 원장과 KIS를 유지하고 같은 ID만 갱신합니다.</small>';button.onclick=()=>$('#initialImportInput').click();grid.appendChild(button)},0)};
