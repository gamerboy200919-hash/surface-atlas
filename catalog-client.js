'use strict';

(function () {
  const areas = {
    amazon: [-64.3,-11.3,-62.1,-9.4],
    greenland: [-51.4,68.8,-48.6,69.6],
    california: [-121.7,36.4,-119.5,38.6],
    hawaii: [-155.65,19.15,-154.8,19.65],
    venezuela: [-69,9.6,-66,11.15],
  };

  async function search(area, product, signal) {
    const bbox = areas[area];
    const collection = {
      GCOV:'NISAR_L2_GCOV_V1',
      GUNW:'NISAR_L2_GUNW_PROVISIONAL_V1',
    }[product];
    if (!bbox || !collection) throw new Error('Unknown region or radar product');
    const url = new URL('https://cmr.earthdata.nasa.gov/search/granules.umm_json');
    url.search = new URLSearchParams({short_name:collection,bounding_box:bbox.join(','),page_size:'24',sort_key:'-start_date'});
    const response = await fetch(url, {signal});
    if (!response.ok) throw new Error('NASA catalog status '+response.status);
    const data = await response.json();
    const seen = new Set();
    const records = [];
    for (const {umm,meta} of data.items) {
      const id = meta['concept-id'];
      const name = umm.GranuleUR;
      if (seen.has(name)) continue;
      seen.add(name);
      const geometry = umm.SpatialExtent?.HorizontalSpatialDomain?.Geometry;
      const polygons = (geometry?.GPolygons ?? []).map(poly=>
        poly.Boundary.Points.map(({Latitude,Longitude})=>[Latitude,Longitude]));
      const range = umm.TemporalExtent?.RangeDateTime;
      const links = (umm.RelatedUrls ?? []).filter(link=>link.URL?.startsWith('https://'));
      const browse = {};
      for (const link of links) {
        if (link.Type!=='GET RELATED VISUALIZATION') continue;
        const polarization=link.URL.match(/_NATIVE_A_(HHHH|HVHV|VVVV|VHVH)\.png$/i)?.[1];
        if(polarization) browse[polarization.slice(0,2)]=link.URL;
        else if(/(?:_NATIVE|_unw(?:rapped)?(?:_phase)?)\.png$/i.test(link.URL)) browse.composite=link.URL;
      }
      records.push({id,name,polygons,browse,start:range?.BeginningDateTime??umm.TemporalExtent?.SingleDateTime,
        end:range?.EndingDateTime,download:links.find(link=>link.Type==='GET DATA')?.URL});
    }
    return {hits:data.hits,records};
  }

  const client = {areas,search};
  if(typeof module==='object'&&module.exports)module.exports=client;
  else window.atlasCatalogClient=client;
})();
