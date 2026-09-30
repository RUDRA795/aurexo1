'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl, { Map as MapLibreMap, Popup } from 'maplibre-gl';
import { SatelliteLayerId, GeoCoordinate, MapMarkerAction } from '@/lib/types/domain';
import { MarineVessel } from '@/lib/types/vessel';
import { SATELLITE_LAYERS, buildGibsWmsUrl } from '@/lib/tools/satellite-layers';
import { LayerController } from './LayerController';
import { Legend } from './Legend';

interface MarineMapProps {
  onCoordinateClick?: (coord: GeoCoordinate) => void;
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

        new Popup({ offset: 12, closeButton: true, className: 'aurexo-vessel-popup' })
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

      {/* Floating Layer Controls Dock (Bottom Left) */}
      <div className="absolute bottom-6 left-6 z-10 flex flex-col gap-2">
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
