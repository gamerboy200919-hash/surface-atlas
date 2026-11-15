'use strict';

window.makeNisarTracker = function (map) {
  const source = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=65053&FORMAT=tle';
  const byId = id => document.getElementById(id);
  const track = L.layerGroup();
  const path = L.layerGroup().addTo(track);
  const marker = L.circleMarker([0,0],{radius:7,weight:3,color:'#fff',fillColor:'#c2442d',fillOpacity:1})
    .bindTooltip('NISAR',{permanent:true,direction:'top',className:'marker-label'});
  let model, epoch, current, lastFetch=0, lastPath=0, timer, request;

  function position(at) {
    const result = satellite.propagate(model,at);
    if (!result?.position) return null;
    const point = satellite.eciToGeodetic(result.position,satellite.gstime(at));
    const lat = satellite.degreesLat(point.latitude);
    const lng = satellite.degreesLong(point.longitude);
    return [lat,lng,point.height].every(Number.isFinite) ? {lat,lng,height:point.height} : null;
  }

  function drawPath(now) {
    const segments = [[]];
    for(let minutes=0;minutes<=100;minutes++){
      const point=position(new Date(now+minutes*60000));
      if(!point) continue;
      let segment=segments.at(-1);
      if(segment.length&&Math.abs(segment.at(-1)[1]-point.lng)>180){
        segment=[];
        segments.push(segment);
      }
      segment.push([point.lat,point.lng]);
    }
    path.clearLayers();
    for(const segment of segments)if(segment.length>1){
      L.polyline(segment,{color:'#fff',weight:4,dashArray:'6 5',opacity:.87,interactive:false}).addTo(path);
      L.polyline(segment,{color:'#a53423',weight:2,dashArray:'6 5',opacity:1,interactive:false}).addTo(path);
    }
    lastPath=now;
  }

  function update(){
    if(!model)return;
    const now=Date.now();
    const point=position(new Date(now));
    if(!point)return;
    current=[point.lat,point.lng];
    marker.setLatLng(current);
    if(now-lastPath>60000){
      drawPath(now);
      if(track.hasLayer(marker))marker.bringToFront();
    }
    if(!track.hasLayer(marker))marker.addTo(track);
    byId('orbit-find').disabled=false;
    const coordinates=Math.abs(point.lat).toFixed(2)+'° '+(point.lat<0?'S':'N')+', '+
      Math.abs(point.lng).toFixed(2)+'° '+(point.lng<0?'W':'E');
    byId('orbit-position').textContent=coordinates;
    byId('orbit-altitude').textContent=Math.round(point.height).toLocaleString()+' km';
    byId('orbit-time').textContent=new Date(now).toISOString().slice(11,19)+' UTC';
    if(byId('orbit-follow').checked)map.panTo([point.lat,point.lng],{animate:false});
  }

  async function refresh(){
    if(request)return;
    const pending=new AbortController();
    request=pending;
    const status=byId('orbit-status');
    status.textContent='Checking CelesTrak for orbital data…';
    try {
      const response=await fetch(source,{signal:AbortSignal.any([pending.signal,AbortSignal.timeout(12000)])});
      if(!response.ok)throw new Error('Orbit feed unavailable');
      const lines=(await response.text()).trim().split(/\r?\n/);
      const line1=lines.find(line=>line.startsWith('1 65053U'));
      const line2=lines.find(line=>line.startsWith('2 65053 '));
      if(!line1||!line2)throw new Error('NISAR orbital elements missing');
      const next=satellite.twoline2satrec(line1,line2);
      const nextEpoch=new Date((next.jdsatepoch-2440587.5)*86400000);
      if(!Number.isFinite(nextEpoch.getTime())||Math.abs(Date.now()-nextEpoch.getTime())>7*86400000){
        throw new Error('Orbital elements out of date');
      }
      if(pending.signal.aborted)return;
      model=next;epoch=nextEpoch;lastFetch=Date.now();lastPath=0;
      byId('orbit-epoch').textContent=epoch.toISOString().slice(0,16).replace('T',' ')+' UTC';
      status.textContent='Updating position every second.';
      update();
    } catch(error){
      if(!pending.signal.aborted)status.textContent=model?'Feed unavailable. Using the last orbital data received.':'Orbital data unavailable. Try Refresh orbit.';
    } finally {if(request===pending)request=null;}
  }

  function start(){
    track.addTo(map);
    if(!model||Date.now()-lastFetch>15*60000)refresh();
    else{
      byId('orbit-status').textContent='Updating position every second.';
      update();
    }
    timer=setInterval(()=>{
      if(document.hidden)return;
      update();
      if(Date.now()-Math.max(lastFetch,lastAttempt)>15*60000)check();
    },1000);
  }
  let lastAttempt=Date.now();
  function check(){
    lastAttempt=Date.now();
    refresh();
  }
  function stop(){
    clearInterval(timer);
    request?.abort();
    request=null;
    track.remove();
  }
  byId('orbit-refresh').addEventListener('click',check);
  byId('orbit-follow').addEventListener('change',update);
  byId('orbit-find').addEventListener('click',()=>{
    if(current)map.setView(current,Math.max(map.getZoom(),3.5),{animate:false});
  });
  byId('orbit-path').addEventListener('change',event=>{
    if(event.target.checked){
      path.addTo(track);
      if(track.hasLayer(marker))marker.bringToFront();
    }else path.removeFrom(track);
  });
  return {start,stop};
};
