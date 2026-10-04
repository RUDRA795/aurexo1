import { SatelliteLayerConfig, SatelliteLayerId } from '../types/domain';
import { NasaGibsAdapter } from '../providers/nasa-gibs';
import { IncoisAdapter } from '../providers/incois';

export class SatelliteService {
  private gibsAdapter = new NasaGibsAdapter();
  private incoisAdapter = new IncoisAdapter();

  getAllLayerConfigs(): Record<SatelliteLayerId, SatelliteLayerConfig> {
    return {
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
        tileUrl: this.gibsAdapter.getTrueColorTileUrl(),
        attribution: 'NASA EOSDIS GIBS / Terra MODIS',
      },
      sst: {
        id: 'sst',
        name: 'Sea Surface Temperature',
        description: 'Daily satellite-derived GHRSST Level-4 sea surface temperature observation layer',
        layerType: 'satellite-derived layer',
        wmsLayerName: 'GHRSST_L4_AVHRR-OI_Sea_Surface_Temperature',
        tileUrl: this.gibsAdapter.getSstWmsUrl(),
        attribution: 'NASA JPL / GHRSST / NOAA AVHRR',
        legend: {
          min: '22°C',
          max: '32°C',
          unit: '°C',
          gradient:
            'linear-gradient(to right, #313695, #4575b4, #74add1, #abd9e9, #fee090, #fdae61, #f46d43, #d73027)',
        },
      },
      chlorophyll: {
        id: 'chlorophyll',
        name: 'Ocean Chlorophyll-A',
        description: 'Satellite-derived ocean color & surface chlorophyll-a concentration layer',
        layerType: 'satellite-derived layer',
        wmsLayerName: 'MODIS_Terra_L2_Chlorophyll_A',
        tileUrl: this.gibsAdapter.getChlorophyllWmsUrl(),
        attribution: 'NASA Ocean Biology Processing Group / Terra MODIS',
        legend: {
          min: '0.05',
          max: '10.0',
          unit: 'mg/m³',
          gradient:
            'linear-gradient(to right, #081d58, #253494, #225ea8, #1d91c0, #41b6c4, #7fcdbb, #c7e9b4, #ffffcc)',
        },
      },
      incois_coral: {
        id: 'incois_coral',
        name: 'INCOIS Coral Reefs',
        description: 'Official INCOIS marine atlas coral reef distribution & conservation areas',
        layerType: 'satellite-derived layer',
        wmsLayerName: 'EnergyAtlas:CORAL_AREAS',
        tileUrl: this.incoisAdapter.coralReefsWmsUrl,
        attribution: 'Indian National Centre for Ocean Information Services (INCOIS)',
      },
      incois_pfz: {
        id: 'incois_pfz',
        name: 'INCOIS PFZ Advisories',
        description: 'Official INCOIS Potential Fishing Zone advisory demarcation lines',
        layerType: 'satellite-derived layer',
        wmsLayerName: 'PFZ_Automation:pfzlines',
        tileUrl: this.incoisAdapter.pfzLinesWmsUrl,
        attribution: 'Ministry of Earth Sciences / INCOIS PFZ Mission',
      },
    };
  }

  getLayerConfig(id: SatelliteLayerId): SatelliteLayerConfig {
    return this.getAllLayerConfigs()[id];
  }
}

// Singleton instance
const GLOBAL_SATELLITE_SERVICE_KEY = '__orca_satellite_service__';
export function getSatelliteService(): SatelliteService {
  const g = globalThis as unknown as Record<string, SatelliteService | undefined>;
  if (!g[GLOBAL_SATELLITE_SERVICE_KEY]) {
    g[GLOBAL_SATELLITE_SERVICE_KEY] = new SatelliteService();
  }
  return g[GLOBAL_SATELLITE_SERVICE_KEY]!;
}
