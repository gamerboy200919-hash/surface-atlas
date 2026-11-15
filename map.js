'use strict';

const byId = id => document.getElementById(id);
const areas = {
  venezuela: { name:'Northern Venezuela', kind:'MEASURED DISPLACEMENT', center:[10.45,-67.45], zoom:8,
    description:'Three NISAR image pairs span the June 24, 2026 earthquakes. Select a point to compare line-of-sight measurements.',
    source:'https://gis.earthdata.nasa.gov/portal/home/item.html?id=1d972eab2bbd4098af71c0c61db083fc' },
  hubbard: { name:'Hubbard Glacier', kind:'OBSERVED RADAR IMAGERY', center:[60.2,-139.5], zoom:8,
    description:'NISAR imaged Alaska and Yukon before and after the December 6, 2025 St. Elias earthquake.',
    source:'https://science.nasa.gov/earth/earth-observatory/landslide-and-avalanche-debris-litter-hubbard-glacier/' },
  amazon: { name:'Amazon Basin', kind:'NISAR ARCHIVE', center:[-10.42,-63.18], zoom:8, description:'Browse radar acquisitions over Rondônia and the Madeira basin in Brazil.' },
  greenland: { name:'Jakobshavn Glacier', kind:'NISAR ARCHIVE', center:[69.16,-49.85], zoom:8, description:'Find acquisitions around Greenland’s Ilulissat Icefjord and Jakobshavn Glacier.' },
  california: { name:'Central Valley', kind:'NISAR ARCHIVE', center:[37.5,-120.65], zoom:8, description:'Browse acquisitions over California’s agricultural Central Valley.' },
  hawaii: { name:'Kīlauea', kind:'NISAR ARCHIVE', center:[19.41,-155.28], zoom:9, description:'Explore acquisition footprints around Kīlauea on Hawaiʻi Island.' },
  orbit: { name:'NISAR live orbit', kind:'LIVE ORBIT ESTIMATE', center:[0,0], zoom:2, description:'Follow the estimated spacecraft position. The dashed line shows its predicted path over Earth for the next 100 minutes. Radar scenes are published separately after processing.',source:'https://celestrak.org/NORAD/elements/gp.php?CATNR=65053&FORMAT=tle' },
  world: { name:'World overview', kind:'STUDY AREAS', center:[19,0], zoom:2, description:'Choose a study-area marker to open observations or browse the mission archive.' },
};
const pairs = ['Jun 13–25','Jun 17–29','Jun 18–30'];
const glacierDates = ['Nov 26, 2025','Dec 8, 2025'];
const glacierFiles = ['data/hubbard-20251126.jpg','data/hubbard-20251208.jpg'];
const landmarks = {'Morón':[10.489,-68.20], 'Puerto Cabello':[10.474,-68.011], 'La Guaira':[10.604,-66.934], 'Caracas':[10.49,-66.88]};
const rasterSource = window.atlasLOS;
const geo = L.map('geo',{ zoomControl:false, minZoom:0,maxZoom:16, zoomSnap:.25, scrollWheelZoom:true, maxBounds:[[-85,-180],[85,180]], attributionControl:true });
L.control.zoom({position:'topright'}).addTo(geo);
L.control.scale({position:'bottomright', imperial:false,maxWidth:100}).addTo(geo);
geo.attributionControl.setPrefix(false);
geo.createPane('reference').style.zIndex='150';
geo.createPane('mapLabels').style.zIndex='240';
const esri='https://server.arcgisonline.com/ArcGIS/rest/services/';
const tileBounds=L.latLngBounds([[-85,-179.999],[85,179.999]]);
function tiles(service, attribution, options={}){
  return L.tileLayer(esri+service+'/MapServer/tile/{z}/{y}/{x}',{
    noWrap:true, bounds:tileBounds, attribution, ...options
  });
}
const basemaps={
  terrain:tiles('World_Topo_Map','Tiles © Esri · Garmin, USGS, Esri Community Maps',{minNativeZoom:2}),
  satellite:tiles('World_Imagery','Imagery © Esri, Vantor, Earthstar Geographics, and the GIS User Community')
};
const satelliteLabels=tiles('Reference/World_Boundaries_and_Places','Place labels © Esri',{pane:'mapLabels',maxNativeZoom:15});
let activeBasemap;
function selectBasemap(key){
  const next=basemaps[key]??basemaps.terrain;
  if(activeBasemap===next)return;
  activeBasemap?.remove();
  satelliteLabels.remove();
  activeBasemap=next.addTo(geo);
  if(key==='satellite')satelliteLabels.addTo(geo);
  byId('geo').dataset.basemap=key;
  byId('tile-status').hidden=true;
  if(isArchive()&&archiveView==='coverage')renderCatalog();
}
for(const layer of Object.values(basemaps)){
  let loaded=0, failed=0;
  layer.on('loading',()=>{loaded=0;failed=0;});
  layer.on('tileload',()=>{loaded++;});
  layer.on('tileerror',()=>{failed++;});
  layer.on('load',()=>{
    if(activeBasemap===layer)byId('tile-status').hidden=byId('geo').hidden||loaded>0||failed===0;
  });
}
geo.createPane('radar').style.zIndex='405';
const extraBase = L.layerGroup();
const regionalBase=L.imageOverlay('data/venezuela-base.png', projectedBounds([-7840000,960000,-7140000,1380000]),{pane:'reference',interactive:false});
const placesLayer=L.layerGroup();
const coverage=L.layerGroup().addTo(geo);
const observations=L.layerGroup().addTo(geo);
const markOptions={radius:4,color:'#204b3e',fillColor:'#fff',fillOpacity:1,weight:2};
const rasterCache=new Map();
const rasterOverlays=[];
let area='venezuela', frame=0, comparing=false, timer, point=null, pointMarker=null, viewSummary='';
let imageZoom=1, imageX=0, imageY=0, dragging=null;
let archiveView='image', activeBrowse='', archiveRequest=0;
const initialUrl=new URLSearchParams(location.search);
const isArchive=()=>!['venezuela','hubbard','world','orbit'].includes(area);
const tracker=window.makeNisarTracker(geo);
const catalogChecks=new Map();
let catalogRequest;

function projectedBounds([west,south,east,north]){
  const unproject=(x,y)=>L.CRS.EPSG3857.unproject(L.point(x,y));
  return L.latLngBounds(unproject(west,south),unproject(east,north));
}
function element(tag, content, className){
  const node=document.createElement(tag);
  if(content!==undefined) node.textContent=content;
  if(className) node.className=className;
  return node;
}
function externalLink(text,url){
  const link=element('a',text);
  link.href=url;link.target='_blank';link.rel='noopener';
  return link;
}
function signed(value){
  return value===null?'No data':(value>0?'+':'')+value.toFixed(1)+' cm';
}
function date(value){
  return value?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(value)):'Date unavailable';
}
function coords(latlng){
  return Math.abs(latlng.lat).toFixed(3)+'° '+(latlng.lat<0?'S':'N')+', '+Math.abs(latlng.lng).toFixed(3)+'° '+(latlng.lng<0?'W':'E');
}
function getRaster(index){
  if(rasterCache.has(index)) return rasterCache.get(index);
  const encoded=rasterSource.layers[index];
  const bytes=Uint8Array.fromBase64 ? Uint8Array.fromBase64(encoded) : Uint8Array.from(atob(encoded), code=>code.charCodeAt(0));
  const result={view:new DataView(bytes.buffer)};
  rasterCache.set(index,result);
  return result;
}
function rasterImage(index){
  const raster=getRaster(index);
  if(raster.url) return raster.url;
  const canvas=document.createElement('canvas');
  canvas.width=rasterSource.width;canvas.height=rasterSource.height;
  const context=canvas.getContext('2d');
  const image=context.createImageData(canvas.width,canvas.height);
  for(let i=0;i<canvas.width*canvas.height;i++){
    const sample=raster.view.getInt16(i*2,true);
    if(sample===-32768)continue;
    const fraction=Math.min(1,Math.abs(sample)/600);
    const dark=sample<0?[34,99,161]:[191,84,47];
    const offset=i*4;
    image.data[offset]=246+(dark[0]-246)*fraction;
    image.data[offset+1]=240+(dark[1]-240)*fraction;
    image.data[offset+2]=217+(dark[2]-217)*fraction;
    image.data[offset+3]=255;
  }
  context.putImageData(image,0,0);
  raster.url=canvas.toDataURL();
  return raster.url;
}
function readPixel(index, latlng){
  if(!rasterSource)return null;
  const position=L.CRS.EPSG3857.project(latlng);
  const [west,south,east,north]=rasterSource.extent;
  const x=Math.floor((position.x-west)/(east-west)*rasterSource.width);
  const y=Math.floor((north-position.y)/(north-south)*rasterSource.height);
  if(x<0||x>=rasterSource.width||y<0||y>=rasterSource.height)return null;
  const raw=getRaster(index).view.getInt16((y*rasterSource.width+x)*2,true);
  return raw===-32768?null:raw/10;
}
function removeRasters(){
  rasterOverlays.splice(0).forEach(layer=>layer.remove());
}
function renderRasters(){
  removeRasters();
  if(!rasterSource||!byId('heat').checked)return;
  const bounds=projectedBounds(rasterSource.extent);
  const indices=comparing?[frame,Number(byId('secondary').value)]:[frame];
  for(const index of indices){
    const overlay=L.imageOverlay(rasterImage(index),bounds,{pane:'radar',opacity:Number(byId('opacity').value)/100,alt:'NISAR line-of-sight displacement raster'}).addTo(geo);
    rasterOverlays.push(overlay);
  }
  clipLayers();
}
function clipLayers(){
  const fraction=Number(byId('swipe').value)/100;
  byId('swipe-controls').style.setProperty('--split',fraction*100+'%');
  if(!comparing)return;
  const stageRect=byId('stage').getBoundingClientRect();
  const divider=stageRect.left+stageRect.width*fraction;
  const clip=(img,side)=>{
    const rect=img.getBoundingClientRect();
    if(!rect.width)return;
    const pct=Math.max(0,Math.min(100,(divider-rect.left)/rect.width*100));
    img.style.clipPath=side==='left'?'inset(0 '+(100-pct)+'% 0 0)':'inset(0 0 0 '+pct+'%)';
  };
  if(area==='venezuela'&&rasterOverlays.length===2){
    clip(rasterOverlays[0].getElement(),'left');
    clip(rasterOverlays[1].getElement(),'right');
  }else if(area==='hubbard')clip(byId('image-b'),'right');
}
geo.on('move zoom resize',clipLayers);
function setPoint(latlng){
  point=latlng;
  if(pointMarker)pointMarker.setLatLng(latlng);
  else pointMarker=L.circleMarker(latlng,{radius:6,weight:2,color:'#183829',fillColor:'#fff',fillOpacity:1,interactive:false}).addTo(observations);
  renderPoint();
}
function renderPoint(){
  if(!point)return;
  const values=pairs.map((_,index)=>readPixel(index,point));
  const info=byId('inspection');
  info.replaceChildren(element('p',signed(values[frame]),'inspected-value'),element('p',coords(point),'muted'));
  const chart=byId('chart');
  chart.hidden=false;
  const bars=element('div',undefined,'bars');
  for(const [index,value] of values.entries()){
    const row=element('div',undefined,'bar-row'+(index===frame?' active':''));
    const track=element('span',undefined,'bar-track');
    if(value!==null){
      const bar=element('i');
      const width=Math.min(50,Math.abs(value)/60*50);
      bar.style.width=width+'%';
      bar.style.left=(value<0?50-width:50)+'%';
      bar.style.background=value<0?'var(--blue)':'var(--red)';
      track.append(bar);
    }
    track.ariaHidden='true';
    row.append(element('span',pairs[index]),track,element('strong',value===null?'—':signed(value)));
    bars.append(row);
  }
  chart.replaceChildren(element('h3','Same point, three pairs'),bars,element('p','Relative samples in centimeters. Bars clip at ±60 cm. Each pair has its own reference.','muted'));
  viewSummary='Northern Venezuela · '+coords(point)+'\nNISAR relative LOS displacement\n'+pairs.map((name,i)=>name+', 2026: '+signed(values[i])).join('\n')+'\n'+areas.venezuela.source;
}
function buildPlaces(){
  placesLayer.clearLayers();
  byId('jumps').replaceChildren();
  for(const [name,latlng] of Object.entries(landmarks)){
    const side = name==='Morón' ? 'left' : name==='Puerto Cabello' || name==='Caracas' ? 'right' : 'top';
    const marker=L.circleMarker(latlng,markOptions).bindTooltip(name,{permanent:true,direction:side,offset:[0,-2],className:'marker-label'});
    marker.on('click',()=>setPoint(marker.getLatLng())).addTo(placesLayer);
    const button=element('button',name);
    button.type='button';
    button.addEventListener('click',()=>{geo.setView(latlng,10);setPoint(L.latLng(latlng));});
    byId('jumps').append(button);
  }
}
buildPlaces();
function filteredCatalog(){
  const data=window.atlasCatalog?.[area]?.[byId('product').value];
  return data??{records:[],hits:0};
}
function showArchiveStatus(text, url){
  byId('archive-status-text').textContent=text;
  byId('archive-status').hidden=!text;
  const link=byId('open-archive-image');
  link.hidden=!url;
  if(url)link.href=url;
}
function renderArchiveImage(record){
  const channel=byId('channel').value;
  const source=record?.browse?.[channel];
  const url=record?.localBrowse?.[channel]??source;
  const img=byId('archive-image');
  if(!url){
    activeBrowse='';
    archiveRequest++;
    img.hidden=true;
    img.removeAttribute('src');
    showArchiveStatus(record?'ASF lists no browse image for this acquisition. Try another date or product.':'No acquisitions match this product in this region.');
    return;
  }
  if(activeBrowse===url)return;
  activeBrowse=url;
  const request=++archiveRequest;
  fitImage();
  img.hidden=true;
  img.alt=areas[area].name+' · '+date(record.start)+' · '+(channel==='composite'?'published radar preview':channel+' radar preview');
  showArchiveStatus('Loading the ASF radar image…');
  img.onload=()=>{
    if(request!==archiveRequest)return;
    img.hidden=false;
    showArchiveStatus('');
  };
  img.onerror=()=>{
    if(request!==archiveRequest)return;
    activeBrowse='';
    img.hidden=true;
    showArchiveStatus('The radar image could not load here. Open it directly at ASF or try another scene.',source);
  };
  img.src=url;
}
function fitRegion(){
  geo.invalidateSize({pan:false});
  const region=areas[area];
  if(area==='world'||area==='orbit'){
    const bounds=area==='orbit'?[[-84,-179],[84,179]]:[[-58,-179],[78,179]]; geo.fitBounds(bounds,{padding:[12,12],animate:false});
  }else if(isArchive()){
    const selected=filteredCatalog().records[frame];
    const bounds=L.latLngBounds([region.center]);
    for(const polygon of selected?.polygons??[]){
      const footprint=L.latLngBounds(polygon);
      if(!footprint.isValid()||footprint.getEast()-footprint.getWest()>180)continue;
      bounds.extend(footprint);
    }
    if(bounds.getSouthWest().equals(bounds.getNorthEast())){
      geo.setView(region.center,region.zoom,{animate:false});
    }else{
      geo.fitBounds(bounds.pad(.28),{padding:[32,32],maxZoom:10,animate:false});
    }
  }else{
    const zoom=geo.getSize().x<610?7.5:8.25;
    geo.setView(region.center,zoom,{animate:false});
  }
}
function setGeographicView(visible){
  byId('geo').hidden=!visible;
  byId('geo-tools').hidden=!visible;
  if(!visible)byId('tile-status').hidden=true;
}
function setArchiveView(view){
  archiveView=view;
  const showImage=archiveView==='image';
  setGeographicView(!showImage);
  byId('image-stage').hidden=!showImage;
  byId('image-a').hidden=true;
  byId('image-b').hidden=true;
  byId('footprint-control').hidden=showImage;
  byId('footprint-legend').hidden=showImage||!byId('footprints').checked;
  byId('browse-credit').hidden=!showImage;
  byId('radar-view').setAttribute('aria-pressed',String(showImage));
  byId('coverage-view').setAttribute('aria-pressed',String(!showImage));
  if(!showImage)fitRegion();
  if(showImage && byId('archive-status').hidden && byId('archive-image').hidden)activeBrowse='';
  setFrame(frame);
}
function syncArchiveSelection(records){
  const select=byId('scene-select');
  if(select.options.length!==records.length||select.options[0]?.value!==records[0]?.id){
    select.replaceChildren(...records.map((entry,i)=>new Option(
      date(entry.start)+' · scene '+(i+1),entry.id)));
  }
  select.disabled=records.length===0;
  if(records[frame])select.value=records[frame].id;
}
function showCatalogStatus(key){
  const entry=catalogChecks.get(key);
  const status=byId('catalog-status');
  if(catalogRequest?.key===key)status.textContent='Checking NASA Earthdata…';
  else if(entry?.error)status.textContent='NASA could not be reached. Showing saved results.';
  else if(entry)status.textContent='NASA checked at '+new Date(entry.time).toISOString().slice(11,16)+' UTC. Checks repeat every minute.';
  else status.textContent='Showing the saved archive while NASA is checked.';
  byId('catalog-refresh').disabled=catalogRequest?.key===key;
}
async function refreshCatalog(force=false){
  if(!isArchive())return;
  const region=area;
  const product=byId('product').value;
  const key=region+'-'+product;
  if(catalogRequest?.key===key){showCatalogStatus(key);return;}
  catalogRequest?.controller.abort();
  catalogRequest=null;
  if(!force&&Date.now()-(catalogChecks.get(key)?.time??0)<55000){showCatalogStatus(key);return;}
  const controller=new AbortController();
  const pending={key,controller};
  catalogRequest=pending;
  showCatalogStatus(key);
  try{
    const result=await atlasCatalogClient.search(region,product,AbortSignal.any([controller.signal,AbortSignal.timeout(15000)]));
    if(controller.signal.aborted)return;
    const previous=filteredCatalog();
    const selected=previous.records[frame];
    const old=new Map(previous.records.map(record=>[record.id,record]));
    for(const record of result.records){
      const local=old.get(record.id)?.localBrowse;
      if(local)record.localBrowse=local;
    }
    if(selected&&!result.records.some(record=>record.id===selected.id))result.records.push(selected);
    window.atlasCatalog[region][product]=result;
    catalogChecks.set(key,{time:Date.now()});
    setFrame(Math.max(0,result.records.findIndex(record=>record.id===selected?.id)));
  }catch(error){
    if(!controller.signal.aborted)catalogChecks.set(key,{time:Date.now(),error:true});
  }finally{
    if(catalogRequest===pending){
      catalogRequest=null;
      showCatalogStatus(key);
    }
  }
}
function renderCatalog(){
  const {records,hits}=filteredCatalog();
  coverage.clearLayers();
  const record=records[frame];
  syncArchiveSelection(records);
  if(archiveView==='image'&&!record)renderArchiveImage();
  byId('catalog-count').textContent=records.length
    ? 'Showing '+records.length+' recent scenes of '+hits+' matching archive records.' : 'No records in this snapshot.';
  const view=byId('inspection');
  const product=byId('product').value;
  if(!record){
    view.replaceChildren(element('p','Try the other product or open Earthdata Search.','muted'));
    viewSummary=areas[area].name+' · '+product+' · No catalog record on display.';
    return;
  }
  if(archiveView==='coverage'&&byId('footprints').checked){
    records.forEach((entry,index)=>{
      for(const polygon of entry.polygons){
        const active=index===frame;
        const satellite=activeBasemap===basemaps.satellite;
        const color=satellite?(active?'#ffc667':'#f0f6eb'):(active?'#15534d':'#396861');
        const layer=L.polygon(polygon,{color,weight:active?3:1,opacity:active?1:.7,fillOpacity:active?.13:0});
        layer.bindTooltip(date(entry.start),{sticky:true}).on('click',()=>setFrame(index));
        coverage.addLayer(layer);
      }
    });
  }
  const select=byId('channel');
  for(const option of select.options)option.disabled=option.value!=='composite'&&!record.browse?.[option.value];
  if(select.selectedOptions[0]?.disabled)select.value='composite';
  const recordUrl='https://cmr.earthdata.nasa.gov/search/concepts/'+encodeURIComponent(record.id)+'.umm_json';
  view.replaceChildren(element('p',date(record.start),'inspected-value'),element('p',record.name,'granule'));
  const preview=record.browse?.[select.value];
  if(archiveView==='image')renderArchiveImage(record);
  if(!preview)view.append(element('p','ASF lists no browse image in this record.','muted'));
  const links=element('div',undefined,'granule-links');
  if(preview)links.append(externalLink('ASF image ↗',preview));
  links.append(externalLink('NASA record ↗',recordUrl));
  if(record.download)links.append(externalLink('HDF5 ↗',record.download));
  view.append(links);
  viewSummary=areas[area].name+' · NISAR '+product+'\n'+date(record.start)+'\n'+record.name+'\n'+recordUrl;
}
function imageTransform(){
  byId('image-plane').style.transform='translate('+imageX+'px,'+imageY+'px) scale('+imageZoom+')';
  clipLayers();
}
function fitImage(){
  imageZoom=1;imageX=0;imageY=0;imageTransform();
}
function renderGlacier(){
  const imageA=byId('image-a'),imageB=byId('image-b');
  const first=comparing?0:frame;
  imageA.hidden=false;
  imageA.src=glacierFiles[first];
  imageA.alt='NASA Earth Observatory radar composite, '+glacierDates[first];
  imageB.hidden=!comparing;
  imageB.style.clipPath='';
  if(comparing){imageB.src=glacierFiles[1];imageB.alt='NASA Earth Observatory radar composite, December 8, 2025';}
  clipLayers();
  const view=byId('inspection');
  view.replaceChildren(element('p',comparing?'Before / after':glacierDates[frame],'inspected-value'),element('p','NASA Earth Observatory / Lauren Dauphin','muted'));
  viewSummary='Hubbard Glacier · NISAR false-color imagery\nNovember 26 and December 8, 2025 · St. Elias earthquake\n'+areas.hubbard.source;
}
function ensureSecondary(){
  const secondary=byId('secondary');
  if(secondary.options[frame])secondary.options[frame].disabled=true;
  for(const [i,option] of Array.from(secondary.options).entries())option.disabled=i===frame;
  if(Number(secondary.value)===frame||secondary.value==='')secondary.value=String((frame+1)%pairs.length);
}
function frames(){
  if(area==='venezuela')return pairs;
  if(area==='hubbard')return glacierDates;
  if(area==='world'||area==='orbit')return [];
  return filteredCatalog().records.map(record=>date(record.start));
}
function setFrame(index){
  const labels=frames();
  frame=Math.max(0,Math.min(index,labels.length-1));
  byId('frame').max=String(Math.max(0,labels.length-1));
  byId('frame').value=String(frame);
  byId('frame').disabled=labels.length<2;
  byId('play').disabled=labels.length<2;
  byId('frame-value').textContent=labels[frame]??'No acquisitions';
  const choices=byId('frame-choices');
  if(choices.childElementCount!==labels.length&&labels.length<=3) {
    choices.replaceChildren(...labels.map((label,i)=>{
      const button=element('button',label);
      button.type='button';button.addEventListener('click',()=>{stop();if(area==='hubbard'&&comparing)toggleCompare(false);setFrame(i);});
      return button;
    }));
  }
  if(labels.length>3)choices.replaceChildren();
  Array.from(choices.children).forEach((button,i)=>button.setAttribute('aria-pressed',String(i===frame)));
  if(area==='venezuela'){
    ensureSecondary();renderRasters();renderPoint();
    byId('scene-title').textContent='NISAR GUNW · '+pairs[frame]+', 2026';
    byId('label-left').textContent=pairs[frame];
    byId('label-right').textContent=pairs[Number(byId('secondary').value)];
  }else if(area==='hubbard'){
    renderGlacier();
    byId('scene-title').textContent='NISAR · Hubbard Glacier';
    byId('label-left').textContent=glacierDates[0];
    byId('label-right').textContent=glacierDates[1];
  }else if(isArchive()){
    renderCatalog();
    const d=areas[area];
    const product=byId('product').value;
    const record=filteredCatalog().records[frame];
    const channel=byId('channel').value;
    byId('scene-title').textContent=archiveView==='coverage'?d.name+' · '+product+' coverage':
      d.name+' · '+(channel==='composite'?product:channel)+(record?' · '+date(record.start):'');
  }
}
function stop(){
  clearInterval(timer);timer=undefined;
  byId('play').setAttribute('aria-pressed','false');byId('play').innerHTML='▶ <span>Play</span>';
}
function toggleCompare(enabled){
  comparing=enabled;
  byId('compare').setAttribute('aria-pressed',String(enabled));
  byId('swipe-controls').hidden=!enabled;
  byId('compare-pick').hidden=!(enabled&&area==='venezuela');
  if(enabled)byId('swipe').value='50';
  setFrame(frame);
}
function archiveUrl(){
  return 'https://search.earthdata.nasa.gov/search?q=NISAR_L2_GCOV_V1';
}
function showRegion(key, options=new URLSearchParams()){
  if(!Object.hasOwn(areas,key))key='venezuela';
  stop();tracker.stop();catalogRequest?.controller.abort();catalogRequest=null;
  area=key;frame=0;point=null;pointMarker=null;comparing=false;viewSummary='';
  archiveView=options.get('view')==='coverage'?'coverage':'image';
  activeBrowse='';archiveRequest++;byId('archive-image').hidden=true;
  byId('archive-image').removeAttribute('src');showArchiveStatus('');
  byId('image-a').hidden=true;byId('image-b').hidden=true;
  removeRasters();coverage.clearLayers();observations.clearLayers();placesLayer.remove();regionalBase.remove();extraBase.clearLayers();
  byId('frame-choices').replaceChildren();
  byId('chart').hidden=true;byId('copy-status').textContent='';
  const d=areas[key],los=key==='venezuela',image=key==='hubbard',world=key==='world',orbit=key==='orbit';
  byId('geo').dataset.extent=world||orbit?'world':'region';
  byId('fit-region').textContent=world||orbit?'Fit world':'Fit area';
  byId('area').value=key;byId('region').textContent=d.name;byId('kind').textContent=d.kind;byId('description').textContent=d.description;
  const source=byId('source');source.href=d.source??(world?'https://search.earthdata.nasa.gov/search':archiveUrl());
  source.textContent=orbit?'CelesTrak orbital data ↗':los?'NASA data and methods ↗':image?'NASA image source ↗':'Open Earthdata Search ↗';
  const archive=isArchive();
  const archiveImage=archive&&archiveView==='image';
  setGeographicView(!image&&!archiveImage);byId('image-stage').hidden=!image&&!archiveImage;
  byId('archive-views').hidden=!archive;
  byId('browse-credit').hidden=!archiveImage;
  byId('legend').hidden=!los||!byId('heat').checked;
  byId('orbit-controls').hidden=!orbit;byId('orbit-legend').hidden=!orbit;
  byId('footprint-legend').hidden=true;byId('inspector').hidden=orbit;
  byId('layers').hidden=world||orbit;byId('timeline').hidden=world||orbit;byId('los-controls').hidden=!los;byId('hubbard-controls').hidden=!image;byId('catalog-controls').hidden=!archive;
  byId('compare').hidden=!los&&!image;byId('copy').hidden=world;byId('compare-pick').hidden=true;
  byId('inspect-title').textContent=los?'Point inspector':image?'Image details':world?'Study areas':'Scene inspector';
  byId('inspect-note').textContent=los?'Click the map or focus it and press Enter at the center.':image?'Compare the two published false-color images.':world?'Choose a labeled marker.':'Pick an acquisition and an available radar channel. Coverage map shows where the scene was acquired.';
  byId('inspection').replaceChildren();
  byId('frame-label').textContent=los?'Radar acquisition pair · June 2026':image?'Radar observation date':'Archive scene';
  byId('swipe-controls').hidden=true;byId('compare').setAttribute('aria-pressed','false');
  if(los){
    byId('secondary').replaceChildren(...pairs.map((label,i)=>new Option(label,String(i))));
    regionalBase.addTo(geo);
    if(byId('vectors').checked)placesLayer.addTo(geo);
  }
  if(image)fitImage();
  else{
    if(archive&&window.atlasBaseBounds?.[key]) {
      L.imageOverlay('data/'+key+'-base.png',projectedBounds(window.atlasBaseBounds[key]),{pane:'reference',interactive:false,attribution:'© Esri · regional reference'}).addTo(extraBase);
      extraBase.addTo(geo);
    }
    if(!archive)fitRegion();
  }
  if(los && rasterSource) setPoint(L.latLng(landmarks['Morón']));
  if(orbit){
    byId('scene-title').textContent='NISAR · Estimated spacecraft position';
    tracker.start();
  }else if(world){
    byId('scene-title').textContent='NISAR · Study areas';
    for(const [id,entry] of Object.entries(areas)){
      if(id==='world'||id==='orbit')continue;
      L.circleMarker(entry.center,{...markOptions,radius:6}).bindTooltip(entry.name,{direction:'top',className:'marker-label'})
        .on('click',()=>navigate(id)).addTo(coverage);
    }
  }else if(archive){
    const product=options.get('product');
    byId('product').value=product==='GUNW'?'GUNW':'GCOV';
    const records=filteredCatalog().records;
    const match=records.findIndex(record=>record.id===options.get('scene'));
    frame=Math.max(0,match);
    for(const option of byId('channel').options) option.disabled=false;
    const channel=options.get('channel');
    byId('channel').value=['HH','HV','VV','VH'].includes(channel)?channel:'composite';
    fitImage();
    setArchiveView(archiveView);
    refreshCatalog();
  }else setFrame(0);
}
function navigate(key){
  const url=new URL(location.href);
  url.searchParams.set('area',key);
  for(const param of ['scene','channel','view','product'])url.searchParams.delete(param);
  history.replaceState({},'',url);
  showRegion(key);
}
geo.on('click',event=>{if(area==='venezuela')setPoint(event.latlng);});
byId('geo').addEventListener('keydown',event=>{
  if(area==='venezuela'&&event.key==='Enter'&&event.target===byId('geo')){
    event.preventDefault();setPoint(geo.getCenter());
  }
});
byId('area').addEventListener('change',event=>navigate(event.target.value));
byId('compare').addEventListener('click',()=>{stop();toggleCompare(!comparing);});
byId('wide').addEventListener('click',event=>{
  const wide=byId('workspace').classList.toggle('expanded');
  event.currentTarget.setAttribute('aria-expanded',String(!wide));
  event.currentTarget.querySelector('span').textContent=wide?'Show layers':'Expand map';
  if(!byId('geo').hidden)geo.invalidateSize({pan:false});
  clipLayers();
});
byId('swipe').addEventListener('input',clipLayers);
byId('secondary').addEventListener('change',()=>setFrame(frame));
byId('heat').addEventListener('change',event=>{byId('legend').hidden=!event.target.checked;renderRasters();});
byId('vectors').addEventListener('change',event=>event.target.checked?placesLayer.addTo(geo):placesLayer.remove());
byId('opacity').addEventListener('input',event=>{
  byId('opacity-value').textContent=event.target.value+'%';
  rasterOverlays.forEach(layer=>layer.setOpacity(Number(event.target.value)/100));
});
byId('footprints').addEventListener('change',event=>{
  byId('footprint-legend').hidden=!event.target.checked;
  renderCatalog();
});
byId('catalog-refresh').addEventListener('click',()=>refreshCatalog(true));
setInterval(()=>{if(!document.hidden)refreshCatalog();},60000);
byId('product').addEventListener('change',()=>{stop();byId('channel').value='composite';setFrame(0);refreshCatalog();});
byId('channel').addEventListener('change',()=>setFrame(frame));
byId('scene-select').addEventListener('change',event=>{
  stop();
  const index=filteredCatalog().records.findIndex(record=>record.id===event.target.value);
  setFrame(index);
});
byId('radar-view').addEventListener('click',()=>setArchiveView('image'));
byId('coverage-view').addEventListener('click',()=>setArchiveView('coverage'));
byId('frame').addEventListener('input',event=>{
  stop();if(area==='hubbard'&&comparing)toggleCompare(false);setFrame(Number(event.target.value));
});
byId('play').addEventListener('click',()=>{
  if(timer){stop();return;}
  if(area==='hubbard'&&comparing)toggleCompare(false);
  const labels=frames();
  if(labels.length<2)return;
  byId('play').setAttribute('aria-pressed','true');byId('play').innerHTML='Ⅱ <span>Pause</span>';
  setFrame((frame+1)%labels.length);
  timer=setInterval(()=>setFrame((frame+1)%labels.length),1350);
});
byId('copy').addEventListener('click',async()=>{
  const text=viewSummary||(area==='venezuela'?'Northern Venezuela · NISAR June 2026\n'+areas.venezuela.source:'');
  try{
    await navigator.clipboard.writeText(text);
    byId('copy-status').textContent='Copied.';
  }catch{
    const field=element('textarea');
    field.value=text;field.setAttribute('aria-label','Copy map insights');
    byId('copy-status').replaceChildren(field);
    field.select();
  }
});
function scaleImage(increment){
  imageZoom=Math.max(1,Math.min(4,imageZoom+increment));
  if(imageZoom===1)fitImage();
  else imageTransform();
}
byId('fit-image').addEventListener('click',fitImage);
byId('image-fit').addEventListener('click',fitImage);
byId('image-plus').addEventListener('click',()=>scaleImage(.5));
byId('image-minus').addEventListener('click',()=>scaleImage(-.5));
const imageStage=byId('image-stage');
imageStage.addEventListener('pointerdown',event=>{
  if(imageZoom===1||event.target.closest('button'))return;
  imageStage.setPointerCapture(event.pointerId);dragging=[event.clientX-imageX,event.clientY-imageY];
});
imageStage.addEventListener('pointermove',event=>{
  if(!dragging)return;
  imageX=event.clientX-dragging[0];imageY=event.clientY-dragging[1];imageTransform();
});
['pointerup','pointercancel','lostpointercapture'].forEach(type=>imageStage.addEventListener(type,()=>{dragging=null;}));
byId('image-b').addEventListener('load',clipLayers);
new ResizeObserver(()=>{
  if(!byId('geo').hidden)geo.invalidateSize({pan:false});
  clipLayers();
}).observe(byId('stage'));
byId('basemap').addEventListener('change',event=>selectBasemap(event.target.value));
byId('fit-region').addEventListener('click',()=>{
  if(area==='orbit')byId('orbit-follow').checked=false;
  fitRegion();
});
selectBasemap('terrain');
showRegion(initialUrl.get('area')??'venezuela',initialUrl);
