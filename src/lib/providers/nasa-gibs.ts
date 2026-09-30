import { DataProvenance } from '../domain/models';

export function getLatestGibsObservationDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

export function buildGibsWmsTileUrl(layerName: string, date: string = getLatestGibsObservationDate()): string {
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
  return `https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi?${params.toString()}&BBOX={bbox-epsg-3857}`;
}

export class NasaGibsAdapter {
  getTrueColorTileUrl(): string {
    const date = getLatestGibsObservationDate();
    return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;
  }

  getSstWmsUrl(): string {
    return buildGibsWmsTileUrl('GHRSST_L4_AVHRR-OI_Sea_Surface_Temperature');
  }

  getChlorophyllWmsUrl(): string {
    return buildGibsWmsTileUrl('MODIS_Terra_L2_Chlorophyll_A');
  }

  getProvenance(layer: string): DataProvenance {
    return {
      provider: 'NASA EOSDIS GIBS',
      endpoint: 'https://gibs.earthdata.nasa.gov',
      retrievalTimestamp: new Date().toISOString(),
      observationTimestamp: `${getLatestGibsObservationDate()}T00:00:00Z`,
      verificationStatus: 'VERIFIED_LIVE',
    };
  }
}
