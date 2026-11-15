const fs = require('node:fs/promises');
const {areas,search}=require('../catalog-client.js');

(async()=>{
  const catalog={};
  await Promise.all(Object.keys(areas).flatMap(area=>{
    catalog[area]={};
    return ['GCOV','GUNW'].map(async product=>{
      const result=await search(area,product,AbortSignal.timeout(30000));
      catalog[area][product]=result;
      console.log(area,product,result.hits,result.records.length);
    });
  }));
  await fs.writeFile('data/catalog.js','window.atlasCatalog = '+JSON.stringify(catalog)+';\n');
})().catch(error=>{console.error(error);process.exitCode=1;});
