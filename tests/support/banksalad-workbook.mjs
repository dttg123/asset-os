import {crc32,deflateRawSync} from 'node:zlib';

export function banksaladWorkbook(data){
 const headers=['날짜','시간','타입','대분류','소분류','내용','금액','화폐','결제수단','메모'];
 const xmlText=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 const rows=[headers,...data].map((row,index)=>'<row r="'+(index+1)+'">'+row.map((value,column)=>{
  const ref=String.fromCharCode(65+column)+(index+1);
  return typeof value==='number'?'<c r="'+ref+'"><v>'+value+'</v></c>':
   '<c r="'+ref+'" t="inlineStr"><is><t>'+xmlText(value)+'</t></is></c>';
 }).join('')+'</row>').join('');
 const files={
  'xl/workbook.xml':'<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="가계부 내역" r:id="rId2"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels':'<Relationships><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>',
  'xl/worksheets/sheet2.xml':'<worksheet><sheetData>'+rows+'</sheetData></worksheet>'
 };
 const local=[],central=[];
 let offset=0;
 for(const [name,xml] of Object.entries(files)){
  const filename=Buffer.from(name),content=Buffer.from(xml),packed=deflateRawSync(content),crc=crc32(content);
  const header=Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(8,8);
  header.writeUInt32LE(crc,14);header.writeUInt32LE(packed.length,18);header.writeUInt32LE(content.length,22);
  header.writeUInt16LE(filename.length,26);
  const directory=Buffer.alloc(46);
  directory.writeUInt32LE(0x02014b50);directory.writeUInt16LE(20,6);directory.writeUInt16LE(8,10);
  directory.writeUInt32LE(crc,16);directory.writeUInt32LE(packed.length,20);directory.writeUInt32LE(content.length,24);
  directory.writeUInt16LE(filename.length,28);directory.writeUInt32LE(offset,42);
  local.push(header,filename,packed);central.push(directory,filename);
  offset+=header.length+filename.length+packed.length;
 }
 const end=Buffer.alloc(22);
 end.writeUInt32LE(0x06054b50);end.writeUInt16LE(3,8);end.writeUInt16LE(3,10);
 end.writeUInt32LE(Buffer.concat(central).length,12);end.writeUInt32LE(offset,16);
 return {name:'가계부.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.concat([...local,...central,end])};
}
