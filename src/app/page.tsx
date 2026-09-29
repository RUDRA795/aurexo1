'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { MarineHUD } from '@/components/telemetry/MarineHUD';
import { ChatDrawer } from '@/components/chat/ChatDrawer';
import { AgentInspector } from '@/components/chat/AgentInspector';
import {
  GeoCoordinate,
  MarineObservation,
  AgentResponse,
  SatelliteLayerId,
  GeofenceCheckResult,
  MapMarkerAction,
} from '@/lib/types/domain';
import { AgentSwarmTrace } from '@/lib/types/agents';

// Dynamically load MapLibre GL to avoid WebGL / window SSR evaluation
const MarineMap = dynamic(
  () => import('@/components/map/MarineMap').then((mod) => mod.MarineMap),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center bg-slate-950 text-xs font-mono text-slate-400">
        Initializing Marine Geospatial Canvas...
      </div>
    ),
  }
);

// Dynamically load startup cinematic overlay without SSR evaluation
const AurexoIntro = dynamic(
  () => import('@/components/intro/AurexoIntro').then((mod) => mod.AurexoIntro),
  { ssr: false }
);

export default function AurexoApp() {
  const [selectedCoordinate, setSelectedCoordinate] = useState<GeoCoordinate>({
    latitude: 18.95,
    longitude: 72.80,
  });

  const [currentObservation, setCurrentObservation] = useState<MarineObservation | null>(null);
  const [geofence, setGeofence] = useState<GeofenceCheckResult | null>(null);
  const [isLoadingConditions, setIsLoadingConditions] = useState<boolean>(false);

  // Map Camera & Layer Synchronization
  const [mapCenter, setMapCenter] = useState<[number, number]>([72.80, 18.95]);
  const [mapZoom, setMapZoom] = useState<number>(6.5);
  const [activeLayerOverride, setActiveLayerOverride] = useState<SatelliteLayerId>('none');
  const [highlightGeometry, setHighlightGeometry] = useState<GeoJSON.Geometry | null>(null);
  const [markerAction, setMarkerAction] = useState<MapMarkerAction | null>(null);
  const [activeProvider, setActiveProvider] = useState<string>('gemini-3.8-flash');

  // Multi-Agent Swarm Telemetry Inspector
  const [swarmTrace, setSwarmTrace] = useState<AgentSwarmTrace | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(false);

  // Fetch verified marine conditions whenever the selected coordinate changes
  const loadConditions = useCallback(async (coord: GeoCoordinate) => {
    setIsLoadingConditions(true);
    try {
      const res = await fetch(`/api/marine/conditions?lat=${coord.latitude}&lon=${coord.longitude}`);
      if (res.ok) {
        const data: MarineObservation = await res.json();
        setCurrentObservation(data);
      }
    } catch (err) {
      console.error('Failed to load marine conditions:', err);
    } finally {
      setIsLoadingConditions(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadConditions(selectedCoordinate);
  }, [loadConditions, selectedCoordinate]);

  // Handle map clicks
  const handleCoordinateClick = useCallback(
    (coord: GeoCoordinate) => {
      setSelectedCoordinate(coord);
      setMapCenter([coord.longitude, coord.latitude]);
      loadConditions(coord);
    },
    [loadConditions]
  );

  // Handle Agent tool output synchronization (bi-directional sync!)
  const handleAgentResponse = useCallback((res: AgentResponse) => {
    // 1. Update map center and zoom if recommended by agent
    if (res.mapActions?.center) {
      setMapCenter(res.mapActions.center);
    }
    if (res.mapActions?.zoom) {
      setMapZoom(res.mapActions.zoom);
    }

    // 2. Update active satellite layer (e.g. SST or Chlorophyll)
    if (res.mapActions?.activeLayer) {
      setActiveLayerOverride(res.mapActions.activeLayer);
    }

    // 3. Update route or corridor highlight geometry
    if (res.mapActions?.highlightGeometry) {
      setHighlightGeometry(res.mapActions.highlightGeometry);
    } else {
      setHighlightGeometry(null);
    }

    // 4. Update dynamic marker action (pin or vessel highlight)
    if (res.mapActions?.marker) {
      setMarkerAction(res.mapActions.marker);
    } else {
      setMarkerAction(null);
    }

    // 5. Update HUD geofence status
    if (res.evidence?.geofence) {
      setGeofence(res.evidence.geofence);
    }

    // 6. Update multi-agent swarm trace
    if (res.swarmTrace) {
      setSwarmTrace(res.swarmTrace);
    }

    // 7. Update provider telemetry badge
    if (res.llmMetadata?.model) {
      setActiveProvider(`${res.llmMetadata.provider.toUpperCase()} (${res.llmMetadata.model})`);
    }
  }, []);

  const handleInspectSwarm = useCallback((trace: AgentSwarmTrace) => {
    setSwarmTrace(trace);
    setIsInspectorOpen(true);
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-950 font-sans">
      {/* 0. Startup Cinematic Overlay */}
      <AurexoIntro />

      {/* 1. Fullscreen Map Surface */}
      <MarineMap
        selectedCoordinate={selectedCoordinate}
        onCoordinateClick={handleCoordinateClick}
        mapCenter={mapCenter}
        mapZoom={mapZoom}
        activeLayerOverride={activeLayerOverride}
        highlightGeometry={highlightGeometry}
        markerAction={markerAction}
        className="absolute inset-0 z-0"
      />

      {/* 2. Top Floating Marine HUD */}
      <div className="pointer-events-none absolute left-0 right-0 top-4 z-20 flex justify-center px-4">
        <div className="pointer-events-auto w-full max-w-6xl">
          <MarineHUD
            currentObservation={currentObservation}
            geofence={geofence}
            isLoadingConditions={isLoadingConditions}
            activeProvider={activeProvider}
            onToggleInspector={() => setIsInspectorOpen((prev) => !prev)}
            isInspectorOpen={isInspectorOpen}
            swarmStepsCount={swarmTrace?.steps.length}
          />
        </div>
      </div>

      {/* 3. Left Floating Command Copilot Drawer */}
      <div className="absolute left-6 top-20 z-20">
        <ChatDrawer
          selectedCoordinate={selectedCoordinate}
          onAgentResponse={handleAgentResponse}
          onInspectSwarm={handleInspectSwarm}
        />
      </div>

      {/* 4. Right Floating Multi-Agent Swarm Telemetry Inspector */}
      <AgentInspector
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        trace={swarmTrace}
      />
    </div>
  );
}
