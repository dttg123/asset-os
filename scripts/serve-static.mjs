import {createReadStream,statSync} from 'node:fs';
import {createServer} from 'node:http';
import {extname,join,normalize,resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const port=Number(process.env.ASSET_OS_QA_PORT)||4173;
/** @type {Record<string,string>} */
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'};
createServer((request,response)=>{
 const url=new URL(request.url||'/',`http://${request.headers.host||'127.0.0.1'}`);
 const relative=normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/,'')||'index.html';
 const file=join(root,relative);
 if(!file.startsWith(`${root}/`)){response.writeHead(403).end('Forbidden');return}
 try{
  const target=statSync(file).isDirectory()?join(file,'index.html'):file;
  response.setHeader('content-type',types[extname(target)]||'application/octet-stream');
  response.setHeader('cache-control','no-store');
  createReadStream(target).on('error',()=>response.writeHead(404).end('Not found')).pipe(response);
 }catch{response.writeHead(404).end('Not found')}
}).listen(port,'127.0.0.1',()=>console.log(`Asset OS QA server: http://127.0.0.1:${port}`));
