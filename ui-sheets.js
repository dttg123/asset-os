'use strict';
let lockedScrollY=0;
function lockPage(){if(document.body.classList.contains('sheet-open'))return;lockedScrollY=window.scrollY||0;document.body.classList.add('sheet-open');document.body.style.position='fixed';document.body.style.top=`-${lockedScrollY}px`;document.body.style.left='0';document.body.style.right='0';document.body.style.width='100%'}
function unlockPage(){if(!document.body.classList.contains('sheet-open'))return;document.body.classList.remove('sheet-open');document.body.style.position='';document.body.style.top='';document.body.style.left='';document.body.style.right='';document.body.style.width='';window.scrollTo(0,lockedScrollY)}
let activeSheetId='',sheetMode='view',sheetDirty=false,sheetHistoryActive=false,suppressSheetPop=false,pendingScrollRestore=null,dialogConfirmAction=null,dialogCancelAction=null;
try{history.scrollRestoration='manual'}catch{}
function showDialog({title='확인',message='',confirmText='확인',cancelText='취소',danger=false,oneButton=false}={},onConfirm=null,onCancel=null){
 dialogConfirmAction=onConfirm;dialogCancelAction=onCancel;$('#confirmTitle').textContent=title;$('#confirmMessage').textContent=message;$('#confirmOk').textContent=confirmText;$('#confirmOk').className=danger?'danger':'primary';$('#confirmCancel').textContent=cancelText;$('#confirmCancel').hidden=oneButton;$('#confirmActions').className='dialog-actions'+(oneButton?' one':'');$('#dialogScrim').hidden=false;$('#confirmDialog').hidden=false;setTimeout(()=>$('#confirmOk').focus(),0)
}
function hideDialog(runCancel=false){$('#dialogScrim').hidden=true;$('#confirmDialog').hidden=true;const cb=runCancel?dialogCancelAction:null;dialogConfirmAction=null;dialogCancelAction=null;if(cb)cb()}
function showNotice(title,message,onOk=null){showDialog({title,message,confirmText:'확인',oneButton:true},onOk)}
function requestCloseSheets(reason='dismiss',fromPop=false){
 if(!$$('.sheet.open').length)return;if(sheetMode==='input'&&sheetDirty){showDialog({title:'작성 내용을 닫을까요?',message:'저장하지 않은 변경사항이 사라집니다.',confirmText:'변경사항 버리기',cancelText:'계속 작성',danger:true},()=>{holdingRegistrationDraft=activeSheetId==='#registerSheet'?null:holdingRegistrationDraft;closeSheets({fromPop})},()=>{if(fromPop){history.pushState({assetOsSheet:true},'',location.href);sheetHistoryActive=true}});return}closeSheets({fromPop})
}
function resetSheetPosition(sheet){sheet.classList.remove('dragging');sheet.style.transition='';sheet.style.transform='';$('#scrim').style.opacity=''}
function openSheet(id,options={}){
 const wasOpen=$$('.sheet.open').length>0;$$('.sheet.open').forEach(s=>{s.classList.remove('open');s.setAttribute('aria-hidden','true');resetSheetPosition(s)});$('#scrim').hidden=false;lockPage();const sheet=$(id);sheet.scrollTop=0;sheet.classList.add('open');sheet.setAttribute('aria-hidden','false');activeSheetId=id;sheetMode=options.mode||(['#formSheet','#registerSheet'].includes(id)?'input':'view');sheetDirty=Boolean(options.dirty);if(!wasOpen&&!sheetHistoryActive){history.pushState({assetOsSheet:true},'',location.href);sheetHistoryActive=true}
}
function closeSheets(options={}){
 const had=$$('.sheet.open').length>0,restoreY=lockedScrollY;$$('.sheet.open').forEach(s=>{s.classList.remove('open');s.setAttribute('aria-hidden','true');resetSheetPosition(s)});$('#scrim').hidden=true;activeSheetId='';sheetMode='view';sheetDirty=false;if(had)unlockPage();if(sheetHistoryActive&&!options.fromPop){sheetHistoryActive=false;suppressSheetPop=true;pendingScrollRestore=restoreY;history.back()}else if(options.fromPop){sheetHistoryActive=false;requestAnimationFrame(()=>window.scrollTo(0,restoreY))}
}
function enableSheetDrag(sheet){
 const zone=sheet.querySelector('.sheet-drag-zone');if(!zone)return;let active=false,startY=0,lastY=0,lastT=0,delta=0,velocity=0;const begin=y=>{if(!sheet.classList.contains('open')||sheet.scrollTop>2)return;active=true;startY=lastY=y;lastT=performance.now();delta=0};const move=y=>{if(!active)return;const dy=Math.max(0,y-startY);if(dy<12)return;sheet.classList.add('dragging');const now=performance.now();velocity=(y-lastY)/Math.max(1,now-lastT);lastY=y;lastT=now;delta=dy;sheet.style.transform=`translate3d(-50%,${dy}px,0)`;$('#scrim').style.opacity=String(Math.max(.28,1-dy/(innerHeight*.85)))};const end=()=>{if(!active)return;active=false;if(delta>110||velocity>.75){resetSheetPosition(sheet);requestCloseSheets('drag');return}resetSheetPosition(sheet)};zone.addEventListener('pointerdown',e=>begin(e.clientY));zone.addEventListener('pointermove',e=>{if(active){move(e.clientY);e.preventDefault()}});zone.addEventListener('pointerup',end);zone.addEventListener('pointercancel',end);zone.addEventListener('touchstart',e=>begin(e.touches[0].clientY),{passive:true});zone.addEventListener('touchmove',e=>{if(active){move(e.touches[0].clientY);e.preventDefault()}},{passive:false});zone.addEventListener('touchend',end,{passive:true})
}
$$('.sheet').forEach(enableSheetDrag);
