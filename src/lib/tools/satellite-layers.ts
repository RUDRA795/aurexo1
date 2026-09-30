import { SatelliteLayerConfig, SatelliteLayerId } from '../types/domain';

/**
 * Returns today's or yesterday's date in YYYY-MM-DD format for NASA GIBS temporal queries.
 * NASA satellite-derived daily composites are typically finalized within 24-48 hours.
 */
export function getLatestObservationDate(): string {
  const d = new Date();
  // Use yesterday's date to guarantee processed composite availability
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

export const SATELLITE_LAYERS: Record<SatelliteLayerId, SatelliteLayerConfig> = {
  none: {
    id: 'none',
    name: 'Satellite Basemap',
    description: 'High-resolution natural color satellite base layer',
    layerType: 'satellite imagery',
    attribution: 'Esri, Maxar, Earthstar Geographics',
  },
  truecolor: {
    id: 'truecolor',
    name: 'NASA MODIS TrueColor',
    description: 'Daily satellite imagery composite (Corrected Reflectance)',
    layerType: 'satellite imagery',
    tileUrl: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${getLatestObservationDate()}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
    attribution: 'NASA EOSDIS GIBS / Terra MODIS',
  },
  sst: {
    id: 'sst',
    name: 'Sea Surface Temperature',
    description: 'Daily satellite-derived GHRSST Level-4 sea surface temperature observation layer',
    layerType: 'satellite-derived layer',
    wmsLayerName: 'GHRSST_L4_AVHRR-OI_Sea_Surface_Temperature',
    attribution: 'NASA JPL / GHRSST / NOAA AVHRR',
    legend: {
      min: '22°C',
      max: '32°C',
      unit: '°C',
      gradient: 'linear-gradient(to right, #313695, #4575b4, #74add1, #abd9e9, #fee090, #fdae61, #f46d43, #d73027)',
    },
  },
  chlorophyll: {
    id: 'chlorophyll',
    name: 'Ocean Chlorophyll-A',
    description: 'Satellite-derived ocean color & surface chlorophyll-a concentration layer',
    layerType: 'satellite-derived layer',
    wmsLayerName: 'MODIS_Terra_L2_Chlorophyll_A',
    attribution: 'NASA Ocean Biology Processing Group / Terra MODIS',
    legend: {
      min: '0.05',
      max: '10.0',
      unit: 'mg/m³',
      gradient: 'linear-gradient(to right, #081d58, #253494, #225ea8, #1d91c0, #41b6c4, #7fcdbb, #c7e9b4, #ffffcc)',
    },
  },
  incois_coral: {
    id: 'incois_coral',
    name: 'INCOIS Coral Reefs',
    description: 'Official INCOIS marine atlas coral reef distribution & conservation areas',
    layerType: 'satellite-derived layer',
    wmsLayerName: 'EnergyAtlas:CORAL_AREAS',
    tileUrl: 'https://incois.gov.in/geoserver/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=true&LAYERS=EnergyAtlas:CORAL_AREAS&SRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}',
    attribution: 'Indian National Centre for Ocean Information Services (INCOIS)',
  },
  incois_pfz: {
    id: 'incois_pfz',
    name: 'INCOIS PFZ Advisories',
    description: 'Official INCOIS Potential Fishing Zone advisory demarcation lines',
    layerType: 'satellite-derived layer',
    wmsLayerName: 'PFZ_Automation:pfzlines',
    tileUrl: 'https://incois.gov.in/geoserver/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=true&LAYERS=PFZ_Automation:pfzlines&SRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}',
    attribution: 'Ministry of Earth Sciences / INCOIS PFZ Mission',
  },
};

/**
 * Builds standard WMS 1.3.0 GetMap tile URL for MapLibre raster source.
 * In MapLibre GL, {bbox-epsg-3857} is interpolated into minX,minY,maxX,maxY.
 */
export function buildGibsWmsUrl(layerName: string, date: string = getLatestObservationDate()): string {
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: 'GetMap',
    FORMAT: 'image/png',
    TRANSPARENT: 'TRUE',
    LAYERS: layerName,
    WIDTH: '256',
    HEIGHT: '256',
    CRS: 'EPSG:3857',
    TIME: date,
  });

  // MapLibre requires literal {bbox-epsg-3857} placeholder
  return `https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi?${params.toString()}&BBOX={bbox-epsg-3857}`;
}
