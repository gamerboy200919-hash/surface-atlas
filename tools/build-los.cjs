const fs = require('node:fs/promises');
const Lerc = require('../audit-deps/node_modules/lerc');
const extent = [-7750000, 1010000, -7230000, 1270000];
async function convert(id) {
  const { width, height, pixels, mask } = Lerc.decode(await fs.readFile('pair-'+id+'.lerc'));
  if (width !== 1600 || height !== 800 || !mask || pixels.length !== 1) throw Error('Missing source validity mask or unexpected grid');
  const raw = Buffer.alloc(width * height * 2);
  let valid = 0, zero = 0, min = Infinity, max = -Infinity, invalid = 0;
  for (let i = 0; i < width * height; i++) {
    const value = pixels[0][i];
    if (mask[i] && Number.isFinite(value) && Math.abs(value) < 3276) {
      valid++;
      if (value === 0) zero++;
      min = Math.min(min, value);
      max = Math.max(max, value);
      raw.writeInt16LE(Math.round(value * 10), i * 2);
    } else {
      invalid++;
      raw.writeInt16LE(-32768, i * 2);
    }
  }
  if (!valid || !invalid || min > 0 || max < 0) throw Error('Unexpected data range or mask');
  console.log({id,valid,invalid,zero,min,max});
  return raw.toString('base64');
}
(async()=>{
  await Lerc.load();
  const layers = await Promise.all([1,3,2].map(convert));
  await fs.writeFile('data/los.js','window.atlasLOS = '+JSON.stringify({width:1600,height:800,extent,layers})+';\n');
})().catch(error=>{console.error(error);process.exitCode=1;});
