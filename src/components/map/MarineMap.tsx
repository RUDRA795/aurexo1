'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl, { Map as MapLibreMap } from 'maplibre-gl';
import { SatelliteLayerId, GeoCoordinate } from '@/lib/types/domain';
import { SATELLITE_LAYERS, buildGibsWmsUrl } from '@/lib/tools/satellite-layers';
import { LayerController } from './LayerController';
import { Legend } from './Legend';

interface MarineMapProps {
  onCoordinateClick?: (coord: GeoCoordinate) => void;
  selectedCoordinate?: GeoCoordinate | null;
  mapCenter?: [number, number]; // [lng, lat]
  mapZoom?: number;
  highlightGeometry?: GeoJSON.Geometry | null;
  className?: string;
  activeLayerOverride?: SatelliteLayerId;
}

export function MarineMap({
  onCoordinateClick,
  selectedCoordinate,
  mapCenter,
  mapZoom,
  highlightGeometry,
  className,
  activeLayerOverride,
}: MarineMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  const [activeLayer, setActiveLayer] = useState<SatelliteLayerId>('none');
  const [showBoundaries, setShowBoundaries] = useState<boolean>(true);
  const [showMPAs, setShowMPAs] = useState<boolean>(true);
  const [showPFZSectors, setShowPFZSectors] = useState<boolean>(true);
  const [isMapLoaded, setIsMapLoaded] = useState<boolean>(false);

  // Sync external layer override if provided
  useEffect(() => {
    if (activeLayerOverride) {
      setActiveLayer(activeLayerOverride);
    }
  }, [activeLayerOverride]);

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
    });

    // Handle Map Clicks
    map.on('click', (e) => {
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

    const layers: SatelliteLayerId[] = ['truecolor', 'sst', 'chlorophyll'];
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
        />
      </div>
    </div>
  );
}
