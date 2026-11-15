# Surface Atlas

Surface Atlas shows how Earth changes using NASA–ISRO NISAR radar observations. Open the live Hostinger site at https://moccasin-rabbit-527352.hostingersite.com/.

## Edit or preview

- Edit the homepage in `index.html`, the map in `map.html`, and shared styles in `atlas.css`.
- From the repository root, run `python -m http.server 8000` and open http://127.0.0.1:8000/. Live orbit, NASA catalog refresh, and map tiles use public feeds over the internet.
- The files at the repository root can be served as a static website. To publish an update manually, upload the site files to the existing Hostinger document root. The bundled ZIP is a snapshot of the original release.
## Venezuela

The three signed relative line-of-sight (LOS) displacement layers are NASA JPL/Caltech and NISAR Operations Science Team exports from NASA's Disasters Mapping Portal. Original catalog item:
https://gis.earthdata.nasa.gov/portal/home/item.html?id=1d972eab2bbd4098af71c0c61db083fc

The map uses all 1600 × 800 pixels in each exported grid, with the source LERC validity mask. The exported cell size is 325 projected meters in EPSG:3857. The viewer encodes source values to 0.1 cm, which describes display precision, not measurement accuracy. The map legend uses the source sign and a common ±60 cm display range. The three pairs straddle the same earthquakes and have different viewing geometries and relative references. Measurements are preliminary according to the provider. Missing pixels are blank.

The ImageServer exportImage parameters were bbox=-7750000,1010000,-7230000,1270000; bboxSR=3857; imageSR=3857; size=1600,800; format=lerc; lercVersion=2; compressionTolerance=0; pixelType=F32; interpolation=RSP_NearestNeighbor; f=image; mosaicRule locking the requested raster ID. Raster 1 is June 13–25, raster 2 is June 18–30, and raster 3 is June 17–29, 2026. There were 468088, 77490, and 453067 valid source samples respectively. To regenerate, store the exports as pair-1.lerc, pair-2.lerc, and pair-3.lerc, run npm install --prefix audit-deps lerc@4.0.4, then run node tools/build-los.cjs.

The home-page Venezuela image is a NASA Earth Observatory visualization by Lauren Dauphin. Its published color and sign convention applies only to that image.
https://science.nasa.gov/earth/earth-observatory/where-venezuelas-earthquakes-shifted-the-ground/

## Hubbard Glacier

Two NASA Earth Observatory false-color NISAR composites by Lauren Dauphin are dated November 26 and December 8, 2025. They are presented visually without a per-pixel measurement.
https://science.nasa.gov/earth/earth-observatory/landslide-and-avalanche-debris-litter-hubbard-glacier/

## NISAR archive

Regional archive footprints, acquisition timestamps, product IDs, and published browse links come from NASA CMR. The included November 15, 2026 snapshot queries NISAR_L2_GCOV_V1 and NISAR_L2_GUNW_PROVISIONAL_V1 by geographic bounding box. Use node tools/build-catalog.cjs to refresh. Scene outlines indicate the catalog footprint and may include invalid pixels or overlap neighboring sites. Each available polarization choice opens the corresponding frequency-A browse image link supplied by ASF. A browse image is for visual inspection, and quantitative analysis requires the original HDF5 product.
https://cmr.earthdata.nasa.gov/search/site/docs/search/api.html
https://nisar-docs.asf.alaska.edu/gcov/
https://nisar-docs.asf.alaska.edu/gunw/

## Basemap and code

Geographic maps use the online Esri World Topographic Map and World Imagery basemaps, with Esri place labels on the satellite view. Regional reference images remain available beneath the tiles. The map shows each source credit in its attribution bar. The 0BSD license applies to the original atlas code. Leaflet is bundled under its own license. Imagery and data remain subject to the source providers' terms.



## Live data

The scene browser checks NASA CMR about once per minute while the page is visible. The saved catalog is available if the request fails. NASA publication and acquisition dates are distinct. Archived browse previews are for visual inspection, and the footprint describes the published scene extent.

The orbit view fetches NISAR's public two-line elements from CelesTrak (NORAD 65053). Satellite.js propagates that orbit to estimate the current position and the next 100 minutes of ground track. The timestamp next to each reading is the time of the estimate. The epoch identifies the source orbital data.
https://celestrak.org/Norad/elements/table.php?FORMAT=tle&GROUP=sar
https://cmr.earthdata.nasa.gov/search/site/docs/search/api.html
