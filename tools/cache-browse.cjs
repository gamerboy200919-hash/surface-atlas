const fs=require('node:fs/promises');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const curl=promisify(execFile);
const path='data/catalog.js';
global.window={};
require('./'+path);
const catalog=window.atlasCatalog;
const targets=Object.entries(catalog).filter(([key])=>key!=='venezuela').map(([area,data])=>[area,data.GCOV.records[0],'composite']);
const sample=catalog.amazon.GCOV.records.find(record=>record.id==='G4406142430-ASF');
for(const channel of ['composite','HH','HV'])targets.push(['amazon',sample,channel]);
const pngSignature='89504e470d0a1a0a';
async function save([area,record,channel]){
  const url=record?.browse?.[channel];
  if(!url)return;
  const filename=area+'-'+record.id.toLowerCase()+'-'+channel.toLowerCase()+'.png';
  try {
    const {stdout}=await curl('curl.exe',['-fLsS','--max-time','16',url],{encoding:'buffer',maxBuffer:6000000});
    if(stdout.subarray(0,8).toString('hex')!==pngSignature) throw new Error('Source was not PNG');
    await fs.writeFile('data/'+filename,stdout);
    (record.localBrowse??={})[channel]='data/'+filename;
    console.log(area,record.id,channel,stdout.length);
  } catch(error) { console.error(area,record.id,channel,error.message.split('\n')[0]); }
}
(async()=>{
  await Promise.all(targets.map(save));
  await fs.writeFile(path,'window.atlasCatalog = '+JSON.stringify(catalog)+';\n');
})().catch(error=>{console.error(error);process.exitCode=1;});
