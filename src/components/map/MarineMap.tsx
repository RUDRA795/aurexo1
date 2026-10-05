'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl, { Map as MapLibreMap, Popup } from 'maplibre-gl';
import { SatelliteLayerId, GeoCoordinate, MapMarkerAction } from '@/lib/types/domain';
import { MarineVessel } from '@/lib/types/vessel';
import { PointIntelligence } from '@/lib/domain/models';
import { SATELLITE_LAYERS, buildGibsWmsUrl } from '@/lib/tools/satellite-layers';
import { LayerController } from './LayerController';
import { Legend } from './Legend';

interface MarineMapProps {
  onCoordinateClick?: (coord: GeoCoordinate) => void;
  onAskOrca?: (coord: GeoCoordinate, initialQuery?: string) => void;
  onAskAurexo?: (coord: GeoCoordinate, initialQuery?: string) => void;
  selectedCoordinate?: GeoCoordinate | null;
  mapCenter?: [number, number]; // [lng, lat]
  mapZoom?: number;
  highlightGeometry?: GeoJSON.Geometry | null;
  markerAction?: MapMarkerAction | null;
  className?: string;
  activeLayerOverride?: SatelliteLayerId;
}

export function MarineMap({
  onCoordinateClick,
  onAskOrca,
  onAskAurexo,
  selectedCoordinate,

  mapCenter,
  mapZoom,
  highlightGeometry,
  markerAction,
  className,
  activeLayerOverride,
}: MarineMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const agentMarkerRef = useRef<maplibregl.Marker | null>(null);
  const pointPopupRef = useRef<maplibregl.Popup | null>(null);
  const onAskOrcaHandler = onAskOrca || onAskAurexo;
  const onAskOrcaRef = useRef(onAskOrcaHandler);

  useEffect(() => {
    onAskOrcaRef.current = onAskOrcaHandler;
  }, [onAskOrcaHandler]);


  const [activeLayer, setActiveLayer] = useState<SatelliteLayerId>('none');
  const [showBoundaries, setShowBoundaries] = useState<boolean>(true);
  const [showMPAs, setShowMPAs] = useState<boolean>(true);
  const [showPFZSectors, setShowPFZSectors] = useState<boolean>(true);
  const [showVessels, setShowVessels] = useState<boolean>(true);
  const [vessels, setVessels] = useState<MarineVessel[]>([]);
  const [isMapLoaded, setIsMapLoaded] = useState<boolean>(false);

  // Sync external layer override if provided
  useEffect(() => {
    if (activeLayerOverride) {
      setActiveLayer(activeLayerOverride);
    }
  }, [activeLayerOverride]);

  // Load vessels from registry API
  useEffect(() => {
    fetch('/api/vessels')
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('Failed to load fleet');
      })
      .then((data: MarineVessel[]) => {
        if (Array.isArray(data)) {
          setVessels(data);
        }
      })
      .catch((err) => console.warn('Vessel registry sync notice:', err.message));
  }, []);

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          'esri-satellite': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            attribution: 'Esri World Imagery',
            maxzoom: 19,
          },
        },
        layers: [
          {
            id: 'base-satellite-layer',
            type: 'raster',
            source: 'esri-satellite',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [75.5, 16.5], // Centered on Arabian Sea & Indian Peninsula
      zoom: 4.8,
      minZoom: 3,
      maxZoom: 16,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');

    map.on('load', () => {
      mapRef.current = map;
      setIsMapLoaded(true);

      // 1. Add NASA GIBS TrueColor Raster Source & Layer
      map.addSource('gibs-truecolor', {
        type: 'raster',
        tiles: [SATELLITE_LAYERS.truecolor.tileUrl!],
        tileSize: 256,
      });
      map.addLayer({
        id: 'layer-truecolor',
        type: 'raster',
        source: 'gibs-truecolor',
        layout: { visibility: 'none' },
        paint: { 'raster-opacity': 0.85 },
      });

      // 2. Add NASA GIBS SST WMS Source & Layer
      const sstWmsUrl = buildGibsWmsUrl(SATELLITE_LAYERS.sst.wmsLayerName!);
      map.addSource('gibs-sst', {
        type: 'raster',
        tiles: [sstWmsUrl],
        tileSize: 256,
      });
      map.addLayer({
        id: 'layer-sst',
        type: 'raster',
        source: 'gibs-sst',
        layout: { visibility: 'none' },
        paint: { 'raster-opacity': 0.8 },
      });

      // 3. Add NASA GIBS Chlorophyll WMS Source & Layer
      const chlWmsUrl = buildGibsWmsUrl(SATELLITE_LAYERS.chlorophyll.wmsLayerName!);
      map.addSource('gibs-chlorophyll', {
        type: 'raster',
        tiles: [chlWmsUrl],
        tileSize: 256,
      });
      map.addLayer({
        id: 'layer-chlorophyll',
        type: 'raster',
        source: 'gibs-chlorophyll',
        layout: { visibility: 'none' },
        paint: { 'raster-opacity': 0.8 },
      });

      // 3b. Add INCOIS Coral Reefs WMS Source & Layer
      if (SATELLITE_LAYERS.incois_coral.tileUrl) {
        map.addSource('incois-coral', {
          type: 'raster',
          tiles: [SATELLITE_LAYERS.incois_coral.tileUrl],
          tileSize: 256,
        });
        map.addLayer({
          id: 'layer-incois_coral',
          type: 'raster',
          source: 'incois-coral',
          layout: { visibility: 'none' },
          paint: { 'raster-opacity': 0.85 },
        });
      }

      // 3c. Add INCOIS PFZ Advisories WMS Source & Layer
      if (SATELLITE_LAYERS.incois_pfz.tileUrl) {
        map.addSource('incois-pfz', {
          type: 'raster',
          tiles: [SATELLITE_LAYERS.incois_pfz.tileUrl],
          tileSize: 256,
        });
        map.addLayer({
          id: 'layer-incois_pfz',
          type: 'raster',
          source: 'incois-pfz',
          layout: { visibility: 'none' },
          paint: { 'raster-opacity': 0.85 },
        });
      }

      // 4. Load EEZ & IMBL Boundaries GeoJSON
      map.addSource('maritime-boundaries', {
        type: 'geojson',
        data: '/data/india_eez_imbl.geojson',
      });
      map.addLayer({
        id: 'eez-lines',
        type: 'line',
        source: 'maritime-boundaries',
        filter: ['==', ['get', 'type'], 'EEZ'],
        paint: {
          'line-color': '#38bdf8',
          'line-width': 1.8,
          'line-dasharray': [4, 2],
          'line-opacity': 0.75,
        },
      });
      map.addLayer({
        id: 'imbl-lines',
        type: 'line',
        source: 'maritime-boundaries',
        filter: ['==', ['get', 'type'], 'IMBL'],
        paint: {
          'line-color': '#f59e0b',
          'line-width': 2.5,
          'line-opacity': 0.9,
        },
      });

      // 5. Load Marine Protected Areas (MPAs) GeoJSON
      map.addSource('marine-protected-areas', {
        type: 'geojson',
        data: '/data/marine_protected_areas.geojson',
      });
      map.addLayer({
        id: 'mpas-fill',
        type: 'fill',
        source: 'marine-protected-areas',
        paint: {
          'fill-color': '#10b981',
          'fill-opacity': 0.25,
        },
      });
      map.addLayer({
        id: 'mpas-outline',
        type: 'line',
        source: 'marine-protected-areas',
        paint: {
          'line-color': '#10b981',
          'line-width': 1.5,
          'line-dasharray': [2, 1],
        },
      });

      // 6. Load INCOIS PFZ Reference Sectors GeoJSON
      map.addSource('pfz-sectors', {
        type: 'geojson',
        data: '/data/incois_pfz_sectors.geojson',
      });
      map.addLayer({
        id: 'pfz-points',
        type: 'circle',
        source: 'pfz-sectors',
        paint: {
          'circle-radius': 6,
          'circle-color': '#0ea5e9',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.9,
        },
      });

      // 7. Dynamic Highlight Geometry Source for Agent routes or inspection zones
      map.addSource('agent-highlight', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });
      map.addLayer({
        id: 'agent-highlight-line',
        type: 'line',
        source: 'agent-highlight',
        paint: {
          'line-color': '#38bdf8',
          'line-width': 3.5,
          'line-opacity': 0.9,
        },
      });

      // 8. Vessel Fleet GeoJSON Source & Layers
      map.addSource('vessel-fleet', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      map.addLayer({
        id: 'vessel-points',
        type: 'circle',
        source: 'vessel-fleet',
        paint: {
          'circle-radius': 6.5,
          'circle-color': [
            'match',
            ['get', 'type'],
            'RESEARCH', '#06b6d4',
            'COAST_GUARD', '#f59e0b',
            'FISHING', '#10b981',
            'CARGO', '#6366f1',
            'TANKER', '#f43f5e',
            '#3b82f6',
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.95,
        },
      });

      // Vessel Click Popup
      map.on('click', 'vessel-points', (e) => {
        if (!e.features || !e.features[0]) return;
        const feature = e.features[0];
        const geom = feature.geometry as GeoJSON.Point;
        const coords = geom.coordinates.slice() as [number, number];
        const p = feature.properties || {};

        new Popup({ offset: 12, closeButton: true, className: 'orca-vessel-popup' })
          .setLngLat(coords)
          .setHTML(`
            <div style="font-family: inherit; font-size: 11px; color: #1e293b; padding: 4px; line-height: 1.4;">
              <div style="font-weight: 700; font-size: 12px; color: #0284c7; margin-bottom: 2px;">
                ⚓ ${p.name || 'Vessel'}
              </div>
              <div><b>Type:</b> ${p.type}</div>
              <div><b>MMSI:</b> ${p.mmsi}</div>
              <div><b>Speed:</b> ${p.speedKnots} kts | <b>Heading:</b> ${p.headingDegrees}°</div>
              <div><b>Destination:</b> ${p.destination || 'N/A'}</div>
              <div style="margin-top: 4px; font-size: 9px; color: #64748b; font-family: monospace;">
                Source: ${p.sourceStatus}
              </div>
            </div>
          `)
          .addTo(map);
      });

      map.on('mouseenter', 'vessel-points', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'vessel-points', () => {
        map.getCanvas().style.cursor = '';
      });
    });

    // Handle Map Clicks (only when not clicking a vessel)
    map.on('click', (e) => {
      // Check if clicked feature was a vessel
      const features = map.queryRenderedFeatures(e.point, { layers: ['vessel-points'] });
      if (features.length > 0) return;

      const coord: GeoCoordinate = {
        latitude: parseFloat(e.lngLat.lat.toFixed(4)),
        longitude: parseFloat(e.lngLat.lng.toFixed(4)),
      };

      if (onCoordinateClick) {
        onCoordinateClick(coord);
      }

      // Display real-time point intelligence popup anchored to clicked coordinate
      if (pointPopupRef.current) {
        pointPopupRef.current.remove();
        pointPopupRef.current = null;
      }

      const popup = new Popup({
        offset: 14,
        closeButton: true,
        closeOnClick: false,
        className: 'orca-intel-popup',
      }).setLngLat([coord.longitude, coord.latitude]);

      // 1. Initial loading container
      const loadingContainer = document.createElement('div');
      loadingContainer.style.cssText = 'font-family: inherit; font-size: 11px; color: #1e293b; padding: 2px; min-width: 240px;';
      loadingContainer.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px;">
          <div style="font-weight: 700; font-size: 11px; color: #0284c7; letter-spacing: 0.05em;">TARGET POINT</div>
          <div style="font-family: monospace; font-size: 10px; color: #64748b;">${coord.latitude.toFixed(4)}°N, ${coord.longitude.toFixed(4)}°E</div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; padding: 12px 0; justify-content: center; color: #0369a1; font-size: 11px; font-weight: 500;">
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #0284c7; box-shadow: 0 0 8px #0284c7;"></span>
          Querying Live Marine & Atmospheric Sensors...
        </div>
      `;
      popup.setDOMContent(loadingContainer).addTo(map);
      pointPopupRef.current = popup;

      // 2. Fetch verified point intelligence
      fetch(`/api/marine/point?lat=${coord.latitude}&lon=${coord.longitude}`)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data: PointIntelligence) => {
          if (!pointPopupRef.current || pointPopupRef.current !== popup) return;

          const content = document.createElement('div');
          content.style.cssText = 'font-family: inherit; font-size: 11px; color: #1e293b; padding: 2px; min-width: 260px; line-height: 1.4;';

          const riskColor =
            data.safety.riskLevel === 'Critical Danger'
              ? '#e11d48'
              : data.safety.riskLevel === 'Hazardous'
              ? '#ea580c'
              : data.safety.riskLevel === 'Caution'
              ? '#d97706'
              : '#059669';

          const riskBg =
            data.safety.riskLevel === 'Critical Danger'
              ? '#ffe4e6'
              : data.safety.riskLevel === 'Hazardous'
              ? '#ffedd5'
              : data.safety.riskLevel === 'Caution'
              ? '#fef3c7'
              : '#d1fae5';

          const weatherHtml = data.weather.status === 'UNAVAILABLE'
            ? `<div style="color: #64748b; font-style: italic; font-size: 10px; margin-bottom: 6px;">Atmospheric data unavailable</div>`
            : `
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; background: #f8fafc; padding: 6px; border-radius: 6px; border: 1px solid #f1f5f9; margin-bottom: 6px;">
                <div><b>Temp:</b> ${data.weather.temperatureCelsius != null ? `${data.weather.temperatureCelsius}°C` : '—'}</div>
                <div><b>Wind:</b> ${data.weather.windSpeedKmh != null ? `${data.weather.windSpeedKmh} km/h` : '—'}</div>
                <div><b>Humidity:</b> ${data.weather.relativeHumidityPercent != null ? `${data.weather.relativeHumidityPercent}%` : '—'}</div>
                <div><b>Gusts:</b> ${data.weather.windGustsKmh != null ? `${data.weather.windGustsKmh} km/h` : '—'}</div>
              </div>
            `;

          const marineHtml = data.marine.status === 'UNAVAILABLE'
            ? `<div style="color: #64748b; font-style: italic; font-size: 10px; margin-bottom: 6px;">Marine data unavailable</div>`
            : `
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; background: #f8fafc; padding: 6px; border-radius: 6px; border: 1px solid #f1f5f9; margin-bottom: 6px;">
                <div><b>Wave:</b> ${data.marine.waveHeightMeters != null ? `${data.marine.waveHeightMeters}m` : '—'} <span style="font-size: 9px; color: #64748b;">(${data.marine.waveCategory ?? ''})</span></div>
                <div><b>Period:</b> ${data.marine.wavePeriodSeconds != null ? `${data.marine.wavePeriodSeconds}s` : '—'}</div>
                <div><b>SST:</b> ${data.marine.seaSurfaceTemperatureCelsius != null ? `${data.marine.seaSurfaceTemperatureCelsius}°C` : '—'}</div>
                <div><b>Current:</b> ${data.marine.currentVelocityKmh != null ? `${data.marine.currentVelocityKmh} km/h` : '—'}</div>
              </div>
            `;

          const aisHtml = data.vessels.status === 'LIVE'
            ? `<div style="color: #0284c7; font-weight: 600;">⚓ ${data.vessels.nearbyCount} live AIS vessel(s) within 60 km</div>`
            : data.vessels.status === 'NO_LIVE_DATA'
            ? `<div style="color: #64748b; font-style: italic;">No live AIS vessel traffic in 60 km radius</div>`
            : `<div style="color: #94a3b8; font-style: italic;">AIS telemetry stream offline</div>`;

          content.innerHTML = `
            <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px;">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <div style="font-weight: 700; font-size: 12px; color: #0284c7;">${data.location.regionName}</div>
                <span style="background: ${riskBg}; color: ${riskColor}; font-weight: 700; font-size: 9px; padding: 2px 6px; border-radius: 9999px; text-transform: uppercase;">
                  ${data.safety.riskLevel}
                </span>
              </div>
              <div style="font-size: 10px; color: #64748b; font-family: monospace; margin-top: 1px;">
                ${coord.latitude.toFixed(4)}°N, ${coord.longitude.toFixed(4)}°E • ${data.location.sea ?? 'Coastal Waters'}
              </div>
            </div>

            <div style="font-size: 10px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 2px; letter-spacing: 0.05em;">Atmospheric Weather</div>
            ${weatherHtml}

            <div style="font-size: 10px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 2px; letter-spacing: 0.05em;">Sea State & Marine</div>
            ${marineHtml}

            <div style="display: flex; flex-direction: column; gap: 3px; font-size: 10px; border-top: 1px solid #f1f5f9; padding-top: 6px; margin-bottom: 8px;">
              <div><b>Border:</b> ${data.spatial.distanceToIMBLKm} km to ${data.spatial.nearestNeighborCountry} IMBL</div>
              ${aisHtml}
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 9px; color: #64748b; margin-bottom: 8px; font-family: monospace;">
              <span>Status: <b style="color: #059669;">VERIFIED REAL</b></span>
              <span>Open-Meteo • AIS</span>
            </div>

            <button id="btn-ask-orca-point" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; background: linear-gradient(135deg, #0284c7, #0369a1); color: #ffffff; font-weight: 700; font-size: 11px; padding: 6px 12px; border-radius: 6px; border: none; cursor: pointer; box-shadow: 0 2px 4px rgba(2, 132, 199, 0.3); transition: all 0.2s;">
              ⚡ ASK ORCA ABOUT THIS LOCATION
            </button>
          `;

          const btn = content.querySelector('#btn-ask-orca-point');
          if (btn) {
            btn.addEventListener('click', () => {
              if (onAskOrcaRef.current) {
                onAskOrcaRef.current(
                  coord,
                  `Analyze the current marine conditions, weather, nearby vessels, and navigational safety at this selected coordinate: ${coord.latitude}°N, ${coord.longitude}°E (${data.location.regionName}).`
                );
              }
            });
          }

          popup.setDOMContent(content);
        })
        .catch((err) => {
          if (!pointPopupRef.current || pointPopupRef.current !== popup) return;
          const errDiv = document.createElement('div');
          errDiv.style.cssText = 'font-family: inherit; font-size: 11px; color: #b91c1c; padding: 6px; min-width: 240px;';
          errDiv.innerHTML = `
            <div style="font-weight: 700; margin-bottom: 4px;">Point Telemetry Notice</div>
            <div style="font-size: 10px; color: #475569;">Selected point: ${coord.latitude.toFixed(4)}°N, ${coord.longitude.toFixed(4)}°E</div>
            <div style="margin-top: 4px; font-size: 9px; color: #ef4444;">Live telemetry temporarily unavailable: ${err.message}</div>
            <button id="btn-ask-orca-point-err" style="margin-top: 8px; width: 100%; background: #0284c7; color: white; border: none; padding: 5px 8px; border-radius: 4px; font-size: 10px; cursor: pointer;">
              ⚡ Ask ORCA Copilot
            </button>
          `;
          const errBtn = errDiv.querySelector('#btn-ask-orca-point-err');
          if (errBtn) {
            errBtn.addEventListener('click', () => {
              if (onAskOrcaRef.current) {
                onAskOrcaRef.current(coord, `What is the situation at coordinate ${coord.latitude}°N, ${coord.longitude}°E?`);
              }
            });
          }
          popup.setDOMContent(errDiv);
        });
    });


    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [onCoordinateClick]);

  // Update active satellite layer visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    const layers: SatelliteLayerId[] = ['truecolor', 'sst', 'chlorophyll', 'incois_coral', 'incois_pfz'];
    layers.forEach((layerId) => {
      const fullLayerId = `layer-${layerId}`;
      if (map.getLayer(fullLayerId)) {
        map.setLayoutProperty(
          fullLayerId,
          'visibility',
          layerId === activeLayer ? 'visible' : 'none'
        );
      }
    });
  }, [activeLayer, isMapLoaded]);

  // Update Boundary layers visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;
    const visibility = showBoundaries ? 'visible' : 'none';
    if (map.getLayer('eez-lines')) map.setLayoutProperty('eez-lines', 'visibility', visibility);
    if (map.getLayer('imbl-lines')) map.setLayoutProperty('imbl-lines', 'visibility', visibility);
  }, [showBoundaries, isMapLoaded]);

  // Update MPA layers visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;
    const visibility = showMPAs ? 'visible' : 'none';
    if (map.getLayer('mpas-fill')) map.setLayoutProperty('mpas-fill', 'visibility', visibility);
    if (map.getLayer('mpas-outline')) map.setLayoutProperty('mpas-outline', 'visibility', visibility);
  }, [showMPAs, isMapLoaded]);

  // Update PFZ sectors visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;
    const visibility = showPFZSectors ? 'visible' : 'none';
    if (map.getLayer('pfz-points')) map.setLayoutProperty('pfz-points', 'visibility', visibility);
  }, [showPFZSectors, isMapLoaded]);

  // Update Vessels GeoJSON data & visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    const source = map.getSource('vessel-fleet') as maplibregl.GeoJSONSource;
    if (source && vessels.length > 0) {
      source.setData({
        type: 'FeatureCollection',
        features: vessels.map((v) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [v.coordinates.longitude, v.coordinates.latitude],
          },
          properties: {
            id: v.id,
            name: v.name,
            type: v.vesselType,
            mmsi: v.mmsi,
            speedKnots: v.speedKnots,
            headingDegrees: v.headingDegrees,
            destination: v.destination ?? 'Sector Patrol',
            sourceStatus: v.sourceStatus,
          },
        })),
      });
    }

    if (map.getLayer('vessel-points')) {
      map.setLayoutProperty('vessel-points', 'visibility', showVessels ? 'visible' : 'none');
    }
  }, [vessels, showVessels, isMapLoaded]);

  // Update selected coordinate marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    if (!selectedCoordinate) {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      return;
    }

    if (!markerRef.current) {
      const el = document.createElement('div');
      el.className = 'w-5 h-5 rounded-full border-2 border-white bg-marine-500 shadow-pearl-md animate-pulse cursor-pointer';
      markerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([selectedCoordinate.longitude, selectedCoordinate.latitude])
        .addTo(map);
    } else {
      markerRef.current.setLngLat([selectedCoordinate.longitude, selectedCoordinate.latitude]);
    }
  }, [selectedCoordinate, isMapLoaded]);

  // Update Agent Target Marker (MapMarkerAction)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    if (!markerAction) {
      if (agentMarkerRef.current) {
        agentMarkerRef.current.remove();
        agentMarkerRef.current = null;
      }
      return;
    }

    if (agentMarkerRef.current) {
      agentMarkerRef.current.remove();
      agentMarkerRef.current = null;
    }

    const el = document.createElement('div');
    el.className = 'flex items-center justify-center w-7 h-7 rounded-full border-2 border-white bg-rose-500 text-white shadow-pearl-md cursor-pointer animate-bounce';
    el.innerHTML = markerAction.variant === 'vessel' ? '🚢' : '📍';

    const popup = new Popup({ offset: 16 }).setHTML(`
      <div style="font-family: inherit; font-size: 11px; padding: 2px;">
        <div style="font-weight: 700; color: #e11d48;">${markerAction.title}</div>
        ${markerAction.description ? `<div style="color: #64748b; font-size: 10px;">${markerAction.description}</div>` : ''}
      </div>
    `);

    agentMarkerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat([markerAction.coordinates.longitude, markerAction.coordinates.latitude])
      .setPopup(popup)
      .addTo(map);

    popup.addTo(map);
  }, [markerAction, isMapLoaded]);

  // Update map camera when mapCenter or mapZoom changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded || !mapCenter) return;

    map.flyTo({
      center: mapCenter,
      zoom: mapZoom ?? map.getZoom(),
      essential: true,
      duration: 1600,
    });
  }, [mapCenter, mapZoom, isMapLoaded]);

  // Update highlight geometry from Agent tools (e.g. route or search zone)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    const source = map.getSource('agent-highlight') as maplibregl.GeoJSONSource;
    if (!source) return;

    if (!highlightGeometry) {
      source.setData({
        type: 'FeatureCollection',
        features: [],
      });
      return;
    }

    source.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: highlightGeometry,
        },
      ],
    });
  }, [highlightGeometry, isMapLoaded]);

  const handleSelectLayer = useCallback((layer: SatelliteLayerId) => {
    setActiveLayer(layer);
  }, []);

  return (
    <div className={`relative h-full w-full overflow-hidden ${className ?? ''}`}>
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Floating Layer Controls & Legend Dock (Positioned at Bottom Right to prevent ChatDrawer & Evaluator collision) */}
      <div className="absolute bottom-16 right-4 z-10 flex flex-col items-end gap-2 pointer-events-auto">
        <Legend activeLayer={activeLayer} />
        <LayerController
          activeLayer={activeLayer}
          onSelectLayer={handleSelectLayer}
          showBoundaries={showBoundaries}
          onToggleBoundaries={() => setShowBoundaries((prev) => !prev)}
          showMPAs={showMPAs}
          onToggleMPAs={() => setShowMPAs((prev) => !prev)}
          showPFZSectors={showPFZSectors}
          onTogglePFZSectors={() => setShowPFZSectors((prev) => !prev)}
          showVessels={showVessels}
          onToggleVessels={() => setShowVessels((prev) => !prev)}
        />
      </div>
    </div>
  );
}
