/**
 * ORCA Context Distillation Engine
 * Compresses raw multi-thousand-token tool telemetry into high-signal,
 * factual domain summaries for local LLM prompt evaluation.
 * Prevents GPU/CPU PCIe memory bus thrashing on 4GB VRAM hardware.
 */

export function distillToolContextForLLM(toolData: Record<string, any>): string {
  const lines: string[] = [];

  // 1. Location & Region
  const loc = toolData.location ?? toolData.locationName ?? toolData.conditions?.locationName;
  if (loc) {
    lines.push(`• Location: ${loc}`);
  }

  // 1b. Inland Territory & Maritime Gateways
  if (toolData.inlandData) {
    const inland = toolData.inlandData;
    lines.push(`• Inland Territory: ${inland.name} (${inland.state}) - ${inland.context}`);
    if (Array.isArray(inland.nearestPorts)) {
      const portSummary = inland.nearestPorts
        .map((p: any) => `${p.name} (~${p.distanceKm} km, ${p.sector})`)
        .join('; ');
      lines.push(`• Nearest Maritime Gateways & Ports: ${portSummary}`);
    }
    lines.push(`• Maritime Platform Scope: AUREXO / ORCA is an oceanographic and maritime boundary intelligence engine for India's 7,516 km coastline, EEZ, and high seas.`);
  }

  // 1c. International Territory & Strategic Sea Lanes
  if (toolData.internationalData) {
    const intl = toolData.internationalData;
    lines.push(`• International Sovereign Territory / Foreign Partner: ${intl.name} (${intl.maritimeZone})`);
    lines.push(`• Strategic Maritime Corridors: ${intl.keyShippingCorridors}`);
    if (Array.isArray(intl.indianGatewayPorts)) {
      lines.push(`• Primary Indian Connecting Gateway Ports: ${intl.indianGatewayPorts.join(', ')}`);
    }
    lines.push(`• Operational Scope Note: ${intl.platformScope}`);
  }

  // 1d. Conversational Orientation
  if (toolData.conversational) {
    lines.push(`• Platform Identity: AUREXO / ORCA (ISRO-standard maritime intelligence copilot)`);
    lines.push(`• Active Capabilities: Real-time ocean observations (waves, currents, SST), weather alerts, AIS vessel tracking, IMBL/EEZ geofencing, Potential Fishing Zones (PFZ), navigational routing.`);
  }

  // 1e. Oceanographic Concept Knowledge
  if (toolData.conceptQuery) {
    lines.push(`• Oceanographic Concept Focus: ${toolData.conceptQuery.topic}`);
  }

  // 2. Weather conditions
  const w = toolData.weather ?? toolData.pointIntelligence?.weather;
  const cond = toolData.conditions ?? toolData.pointIntelligence?.marine;
  const wind = w?.wind ?? cond?.wind;

  const tempStr =
    w?.temperature2mCelsius != null
      ? `${w.temperature2mCelsius}°C`
      : w?.temperatureCelsius != null
      ? `${w.temperatureCelsius}°C`
      : cond?.temperatureCelsius != null
      ? `${cond.temperatureCelsius}°C`
      : null;

  const windStr =
    wind?.speedKmh != null
      ? `${wind.speedKmh} km/h (${wind.beaufortDescription ?? 'Normal'})`
      : null;

  const humidityStr =
    w?.relativeHumidityPercent != null ? `${w.relativeHumidityPercent}%` : null;

  const gustsStr =
    wind?.gustsKmh != null ? `${wind.gustsKmh} km/h` : null;

  const weatherParts: string[] = [];
  if (tempStr) weatherParts.push(`Air Temp: ${tempStr}`);
  if (windStr) weatherParts.push(`Wind: ${windStr}`);
  if (humidityStr) weatherParts.push(`Humidity: ${humidityStr}`);
  if (gustsStr) weatherParts.push(`Gusts: ${gustsStr}`);

  if (weatherParts.length > 0) {
    lines.push(`• Weather: ${weatherParts.join(', ')}`);
  }

  // 3. Marine / Sea State conditions
  const wave = cond?.wave;
  const waveStr =
    wave?.heightMeters != null
      ? `${wave.heightMeters}m (${wave.category ?? 'Normal'})`
      : null;

  const periodStr = wave?.periodSeconds != null ? `${wave.periodSeconds}s` : null;
  const sstStr =
    cond?.seaSurfaceTemperatureCelsius != null
      ? `${cond.seaSurfaceTemperatureCelsius}°C`
      : null;
  const currentStr =
    cond?.currents?.velocityKmh != null
      ? `${cond.currents.velocityKmh} km/h`
      : null;

  const marineParts: string[] = [];
  if (waveStr) marineParts.push(`Waves: ${waveStr}`);
  if (periodStr) marineParts.push(`Period: ${periodStr}`);
  if (sstStr) marineParts.push(`Sea Surface Temp: ${sstStr}`);
  if (currentStr) marineParts.push(`Currents: ${currentStr}`);

  if (marineParts.length > 0) {
    lines.push(`• Sea State: ${marineParts.join(', ')}`);
  }

  // 4. Boundaries & Geofence
  const geo = toolData.geofence ?? toolData.pointIntelligence?.spatial;
  if (geo) {
    const imblStr =
      geo.distanceToIMBLKm != null
        ? `${geo.distanceToIMBLKm} km to ${geo.nearestNeighborCountry ?? 'international'} IMBL`
        : null;
    const mpaStr = geo.isInsideMarineProtectedArea
      ? `INSIDE ${geo.protectedAreaName ?? 'Marine Sanctuary'}`
      : 'Clear of MPAs';
    const statusStr = geo.riskStatus ?? 'Safe';

    lines.push(`• Boundaries & Geofence: ${[imblStr, mpaStr, `Status: ${statusStr}`].filter(Boolean).join(' | ')}`);
  }

  // 5. Vessels / AIS Traffic
  const vessels = toolData.vesselData?.vessels ?? toolData.pointIntelligence?.vessels;
  if (toolData.vesselData?.matchedVessel) {
    const v = toolData.vesselData.matchedVessel;
    lines.push(`• Target Vessel: ${v.name} (${v.vesselType}, MMSI: ${v.mmsi}) at speed ${v.speedKnots} kts heading ${v.headingDegrees}°`);
  } else if (toolData.vesselData?.nearestVessel) {
    const nv = toolData.vesselData.nearestVessel;
    lines.push(`• Nearest Vessel: ${nv.vessel.name} (${nv.vessel.vesselType}) located ${nv.distanceKm} km away`);
  } else if (vessels?.nearbyCount != null) {
    lines.push(`• AIS Traffic: ${vessels.nearbyCount} live AIS vessel(s) within ${vessels.searchRadiusKm ?? 60} km`);
  }

  // 6. Deterministic Safety Assessment
  const safety = toolData.safetyAssessment ?? toolData.pointIntelligence?.safety;
  if (safety) {
    const scoreStr = safety.compositeRiskScore != null ? `Score ${safety.compositeRiskScore}/100` : '';
    const levelStr = safety.riskLevel ?? '';
    const factorStr = safety.primaryRiskFactor ? `Primary Factor: ${safety.primaryRiskFactor}` : '';
    const directiveStr = safety.recommendedAction ?? safety.actionableDirectives?.[0] ?? '';

    lines.push(`• Safety Evaluation: ${[levelStr, scoreStr, factorStr].filter(Boolean).join(' | ')}`);
    if (directiveStr) {
      lines.push(`• Recommended Directive: ${directiveStr}`);
    }
  }

  // 7. Route Passage & Voyage Corridor
  const route = toolData.route;
  if (route) {
    lines.push(`• Navigation Route: ${route.originName} to ${route.destinationName} (${route.totalDistanceKm} km, ~${route.estimatedTravelTimeHours} hrs) - Status: ${route.overallSafety}`);
    if (route.advisory) {
      lines.push(`• Corridor Navigational Advisory: ${route.advisory}`);
    }
  }

  // 7b. Multi-Point Route Weather
  if (toolData.routeWeather) {
    const rw = toolData.routeWeather;
    lines.push(`• Voyage Passage Weather (${rw.corridorName}):`);
    if (rw.originObservation) {
      lines.push(`  - Departure (${rw.originName}): Waves ${rw.originObservation.wave?.heightMeters ?? '?'}m, Wind ${rw.originObservation.wind?.speedKmh ?? '?'} km/h, SST ${rw.originObservation.seaSurfaceTemperatureCelsius ?? '?'}°C`);
    }
    if (rw.midObservation) {
      lines.push(`  - Mid-Corridor Waypoint: Waves ${rw.midObservation.wave?.heightMeters ?? '?'}m, Wind ${rw.midObservation.wind?.speedKmh ?? '?'} km/h`);
    }
    if (rw.destinationObservation) {
      lines.push(`  - Destination (${rw.destName}): Waves ${rw.destinationObservation.wave?.heightMeters ?? '?'}m, Wind ${rw.destinationObservation.wind?.speedKmh ?? '?'} km/h`);
    }
    if (rw.routeSafety) {
      lines.push(`  - Navigational Safety Level: ${rw.routeSafety}`);
    }
  }

  // 8. Regional Warnings Summary
  const regWarnings = toolData.regionalWarnings ?? toolData.regions;
  if (Array.isArray(regWarnings)) {
    const rough = regWarnings.filter((r: any) => r.isSeaRough || r.activeWarningsCount > 0);
    if (rough.length === 0) {
      lines.push(`• Regional Scan: All ${regWarnings.length} Indian coastal sectors report normal, favorable sea states.`);
    } else {
      const summary = rough
        .map((r: any) => {
          const name = r.regionName ?? r.region?.name ?? r.name ?? 'Sector';
          const waveHeight =
            r.representativeObservation?.waveHeightMeters ??
            r.observation?.wave?.heightMeters ??
            '?';
          return `${name} (${waveHeight}m waves)`;
        })
        .join(', ');
      lines.push(`• Regional Warnings: ${rough.length} sector(s) with elevated sea state: ${summary}`);
    }
  }

  // Fallback if no specific fields were parsed
  if (lines.length === 0) {
    return JSON.stringify(toolData);
  }

  return lines.join('\n');
}
