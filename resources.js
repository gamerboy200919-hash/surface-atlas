const resourceGroups = {
  'NASA & ASF': [
    ['NASA Venezuela displacement rasters','https://gis.earthdata.nasa.gov/portal/home/item.html?id=1d972eab2bbd4098af71c0c61db083fc'],
    ['NASA Hubbard Glacier imagery','https://science.nasa.gov/earth/earth-observatory/landslide-and-avalanche-debris-litter-hubbard-glacier/'],
    ['NASA Earthdata Search', 'https://search.earthdata.nasa.gov/search'],
    ['ASF Data Search Vertex', 'https://search.asf.alaska.edu/'],
    ['NISAR Data User Guide', 'https://nisar-docs.asf.alaska.edu/'],
    ['Intro to Remote Sensing', 'https://www.earthdata.nasa.gov/learn/earth-observation-data-basics/remote-sensing'],
    ['Intro to Synthetic Aperture Radar', 'https://www.earthdata.nasa.gov/learn/earth-observation-data-basics/sar'],
    ['NASA ARSET Trainings', 'https://appliedsciences.nasa.gov/get-involved/training'],
    ['NISAR StoryMaps', 'https://nisar.jpl.nasa.gov/applications/arcgis-storymaps/'],
    ['NISAR Applications White Papers', 'https://nisar.jpl.nasa.gov/applications/societal-benefit/'],
    ['UAVSAR Postcards', 'https://uavsar.jpl.nasa.gov/education/postcards.html'],
  ],
  'Canadian Space Agency': [
    ['RADARSAT Constellation Mission data', 'https://donnees-data.asc-csa.gc.ca/en/dataset/rcm'],
    ['SAR Python tutorial', 'https://github.com/asc-csa/Synthetic_Aperture_Radar_Tutorial'],
    ['RADARSAT-1 open data', 'https://donnees-data.asc-csa.gc.ca/en/dataset/radarsat1'],
  ],
  'Argentina’s CONAE': [
    ['SAOCOM Catalogue', 'https://catalogos.conae.gov.ar/catalogo/catalogoSatSaocomInfo.html'],
    ['SAOCOM Catalogue Registration', 'https://www.argentina.gob.ar/noticias/la-informacion-saocom-cada-vez-mas-accesible'],
  ],
};
for (const [title, links] of Object.entries(resourceGroups)) {
  const group = document.createElement('article');
  group.className = 'resource-group';
  const heading = document.createElement('h3');
  heading.textContent = title;
  const list = document.createElement('ul');
  for (const [name, url] of links) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = name + ' ↗';
    item.append(link);
    list.append(item);
  }
  group.append(heading, list);
  document.getElementById('resource-list').append(group);
}
