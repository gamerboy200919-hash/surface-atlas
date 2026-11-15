const fs=require('node:fs/promises');
const {feature}=require('../audit-deps/node_modules/topojson-client');
const countries=require('../audit-deps/node_modules/world-atlas/land-110m.json');
const areas={amazon:[-10.42,-63.18],greenland:[69.16,-49.85],california:[37.5,-120.65],hawaii:[19.41,-155.28]};
const project=([lat,lon])=>[6378137*lon*Math.PI/180,6378137*Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))];
const bounds={};
async function download(url,path){
  const res=await fetch(url,{signal:AbortSignal.timeout(12000)});
  if(!res.ok||!res.headers.get('content-type')?.startsWith('image/'))throw Error('Expected image, got '+res.status);
  await fs.writeFile(path,Buffer.from(await res.arrayBuffer()));
}
(async()=>{
  await fs.writeFile('data/land.js','window.atlasLand='+JSON.stringify(feature(countries,countries.objects.land))+';\n');
  const downloads=await Promise.allSettled(Object.entries(areas).map(async ([key,center])=>{
    const [x,y]=project(center);
    const bbox=[x-350000,y-210000,x+350000,y+210000];
    const params=new URLSearchParams({bbox:bbox.join(','),bboxSR:'3857',imageSR:'3857',size:'1400,840',format:'png32',f:'image'});
    await download('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/export?'+params,'data/'+key+'-base.png');
    bounds[key]=bbox;
  }));
  console.log(downloads.map(x=>x.status));
  await fs.writeFile('data/base-bounds.js','window.atlasBaseBounds='+JSON.stringify(bounds)+';\n');
})().catch(error=>{console.error(error);process.exitCode=1;});
