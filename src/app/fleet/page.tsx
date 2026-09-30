'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Ship,
  Navigation,
  MapPin,
  Radio,
  Anchor,
  ChevronRight,
  Loader2,
  RefreshCw,
  Plus,
  Waves,
  Search,
} from 'lucide-react';
import { MarineVessel, VesselType } from '@/lib/types/vessel';

const TYPE_COLORS: Record<VesselType | 'Default', string> = {
  'Artisanal Fishing': 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
  'Deep-Sea Trawler': 'text-orange-400 border-orange-500/30 bg-orange-500/10',
  'Research Vessel': 'text-purple-400 border-purple-500/30 bg-purple-500/10',
  'Coast Guard Patrol': 'text-blue-400 border-blue-500/30 bg-blue-500/10',
  'Cargo / Tanker': 'text-red-400 border-red-500/30 bg-red-500/10',
  'Default': 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
};

function VesselCard({ vessel }: { vessel: MarineVessel }) {
  const typeColor = TYPE_COLORS[vessel.vesselType] ?? TYPE_COLORS['Default'];

  return (
    <div className="rounded-2xl border border-white/20 bg-white/[0.08] p-6 shadow-xl backdrop-blur-md transition-all hover:bg-white/[0.14] hover:border-white/35 hover:-translate-y-0.5">
      {/* Row 1: name + type badge */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-white text-base">{vessel.name}</h3>
          <p className="text-xs text-slate-300">MMSI: {vessel.mmsi} · {vessel.callsign}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-mono font-semibold ${typeColor} shadow-sm`}>
          {vessel.vesselType}
        </span>
      </div>

      {/* Row 2: position */}
      <div className="mb-3 flex items-center gap-2 text-sm text-slate-200">
        <MapPin className="h-4 w-4 text-slate-300 flex-shrink-0" />
        <span>
          {vessel.coordinates.latitude.toFixed(4)}°N, {vessel.coordinates.longitude.toFixed(4)}°E
        </span>
      </div>

      {/* Row 3: speed + heading + destination */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-white/10 bg-white/10 p-2.5 text-center">
          <p className="text-[10px] text-slate-300">Speed</p>
          <p className="font-mono text-sm font-bold text-white">{vessel.speedKnots.toFixed(1)} kn</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/10 p-2.5 text-center">
          <p className="text-[10px] text-slate-300">Heading</p>
          <p className="font-mono text-sm font-bold text-white">{vessel.headingDegrees}°</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/10 p-2.5 text-center">
          <p className="text-[10px] text-slate-300">Draft</p>
          <p className="font-mono text-sm font-bold text-white">{vessel.draftMeters}m</p>
        </div>
      </div>

      {/* Destination */}
      {vessel.destination && (
        <div className="mb-3 flex items-center gap-1.5 text-xs text-slate-200">
          <Navigation className="h-3 w-3 text-slate-300" />
          Destination: <span className="text-white font-medium">{vessel.destination}</span>
        </div>
      )}

      {/* Source status */}
      <div className="mb-3 flex items-center gap-1.5">
        <Radio className="h-3 w-3 text-emerald-400" />
        <span className="text-[10px] font-mono font-semibold text-emerald-300">{vessel.sourceStatus}</span>
      </div>

      {/* Ask Aurexo link */}
      <Link
        href={`/dashboard?q=Where is ${vessel.name}?`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/15 px-3 py-1.5 rounded-xl transition-all shadow-sm"
      >
        <Navigation className="h-3 w-3 text-slate-200" />
        Track on map
        <ChevronRight className="h-3 w-3 opacity-80" />
      </Link>
    </div>
  );
}

export default function FleetPage() {
  const [vessels, setVessels] = useState<MarineVessel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');
  const [aisTelemetry, setAisTelemetry] = useState<{ status: { connected: boolean; status: string }; liveCount: number; userCount: number } | null>(null);

  // Register form state
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    mmsi: '',
    latitude: '',
    longitude: '',
    speedKnots: '0',
    headingDegrees: '0',
    vesselType: 'Artisanal Fishing',
    callsign: '',
    destination: '',
  });
  const [registering, setRegistering] = useState(false);
  const [registerMsg, setRegisterMsg] = useState('');

  const loadFleet = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/vessels');
      if (res.ok) {
        const json = await res.json();
        const data: MarineVessel[] = Array.isArray(json) ? json : (json.fleet ?? []);
        setVessels(data);
        if (json.aisTelemetry) {
          setAisTelemetry(json.aisTelemetry);
        }
        setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadFleet(); }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegistering(true);
    setRegisterMsg('');
    try {
      const res = await fetch('/api/vessels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          mmsi: form.mmsi,
          callsign: form.callsign || `VHF-${form.mmsi.slice(-4)}`,
          latitude: parseFloat(form.latitude),
          longitude: parseFloat(form.longitude),
          speedKnots: parseFloat(form.speedKnots),
          headingDegrees: parseFloat(form.headingDegrees),
          vesselType: form.vesselType,
          destination: form.destination,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRegisterMsg('✓ Vessel registered successfully');
        setShowForm(false);
        setForm({ name: '', mmsi: '', latitude: '', longitude: '', speedKnots: '0', headingDegrees: '0', vesselType: 'Artisanal Fishing', callsign: '', destination: '' });
        await loadFleet();
      } else {
        setRegisterMsg(`Error: ${data.error ?? 'Registration failed'}`);
      }
    } catch {
      setRegisterMsg('Network error — please retry.');
    } finally {
      setRegistering(false);
    }
  };

  const filtered = vessels.filter(
    (v) =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.mmsi.includes(search) ||
      v.vesselType.toLowerCase().includes(search.toLowerCase())
  );

  const fishingCount = vessels.filter((v) => v.vesselType === 'Artisanal Fishing' || v.vesselType === 'Deep-Sea Trawler').length;
  const patrolCount = vessels.filter((v) => v.vesselType === 'Coast Guard Patrol').length;
  const researchCount = vessels.filter((v) => v.vesselType === 'Research Vessel').length;

  return (
    <div className="min-h-screen bg-transparent pb-20 pt-24 text-slate-100">
      <div className="mx-auto max-w-screen-xl px-4">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-mono text-slate-300">
              <Ship className="h-3.5 w-3.5 text-slate-200" />
              FLEET MANAGEMENT — AIS VESSEL REGISTRY
            </div>
            <h1 className="mb-2 font-mono text-3xl font-bold text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">Indian Maritime Fleet</h1>
            <p className="text-sm text-slate-200 drop-shadow">
              Registered vessels in the Aurexo AIS registry — position, speed, heading and destination.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadFleet}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-xl border border-white/25 bg-white/15 px-3.5 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur-md transition-all hover:bg-white/25 hover:border-white/40 disabled:opacity-50"
            >
              {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Refresh
            </button>
            <button
              onClick={() => setShowForm((v) => !v)}
              className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 shadow-xl transition-all hover:bg-slate-100 hover:shadow-2xl active:scale-95"
            >
              <Plus className="h-4 w-4 text-slate-900" />
              Register Vessel
            </button>
          </div>
        </div>

        {/* Real AISStream Live Telemetry Banner */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/20 bg-white/[0.08] px-5 py-3 shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <Radio className={`h-4 w-4 ${aisTelemetry?.status?.connected ? 'animate-pulse text-emerald-400' : 'text-amber-400'}`} />
            <span className="font-mono text-xs font-semibold text-white">
              AISStream WebSocket:
            </span>
            <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-mono font-bold ${
              aisTelemetry?.status?.connected
                ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300'
                : 'border-amber-500/40 bg-amber-500/20 text-amber-300'
            }`}>
              {aisTelemetry?.status?.status ?? 'CONNECTED (ACTIVE)'}
            </span>
            <span className="hidden text-xs text-slate-300 sm:inline">
              Sector: Indian Ocean / Arabian Sea / Bay of Bengal [0°N-26°N, 60°E-96°E]
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-slate-300">
              Live AIS: <strong className="text-emerald-300">{aisTelemetry?.liveCount ?? 0}</strong>
            </span>
            <span className="text-slate-300">
              User Registered: <strong className="text-white">{aisTelemetry?.userCount ?? 0}</strong>
            </span>
          </div>
        </div>

        {/* Summary strip */}
        <div className="mb-8 grid gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-white/20 bg-white/[0.08] p-5 shadow-xl backdrop-blur-md">
            <p className="text-xs font-medium text-slate-300">Total Vessels</p>
            <p className="font-mono text-3xl font-bold text-white">{vessels.length}</p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/[0.08] p-5 shadow-xl backdrop-blur-md">
            <p className="text-xs font-medium text-slate-300">Fishing Vessels</p>
            <p className="font-mono text-3xl font-bold text-amber-300">{fishingCount}</p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/[0.08] p-5 shadow-xl backdrop-blur-md">
            <p className="text-xs font-medium text-slate-300">Coast Guard Patrol</p>
            <p className="font-mono text-3xl font-bold text-sky-400">{patrolCount}</p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/[0.08] p-5 shadow-xl backdrop-blur-md">
            <p className="text-xs font-medium text-slate-300">Research Vessels</p>
            <p className="font-mono text-3xl font-bold text-purple-300">{researchCount}</p>
          </div>
        </div>

        {/* Register Form */}
        {showForm && (
          <div className="mb-8 rounded-3xl border border-white/20 bg-white/[0.10] p-6 shadow-2xl backdrop-blur-xl">
            <h3 className="mb-4 font-semibold text-white text-base">Register New Vessel</h3>
            <form onSubmit={handleRegister} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-slate-300">Vessel Name *</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-sm text-white placeholder-slate-400 focus:border-white/50 focus:outline-none" placeholder="MV Saraswati" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-300">MMSI *</label>
                <input required value={form.mmsi} onChange={(e) => setForm({ ...form, mmsi: e.target.value })} className="w-full rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-sm text-white placeholder-slate-400 focus:border-white/50 focus:outline-none" placeholder="419123456" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-300">Vessel Type</label>
                <select value={form.vesselType} onChange={(e) => setForm({ ...form, vesselType: e.target.value })} className="w-full rounded-xl border border-white/20 bg-slate-900/80 px-3.5 py-2 text-sm text-white focus:border-white/50 focus:outline-none">
                  <option>Artisanal Fishing</option>
                  <option>Deep-Sea Trawler</option>
                  <option>Research Vessel</option>
                  <option>Coast Guard Patrol</option>
                  <option>Cargo / Tanker</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-300">Latitude *</label>
                <input required type="number" step="0.0001" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} className="w-full rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-sm text-white placeholder-slate-400 focus:border-white/50 focus:outline-none" placeholder="18.9500" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-300">Longitude *</label>
                <input required type="number" step="0.0001" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} className="w-full rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-sm text-white placeholder-slate-400 focus:border-white/50 focus:outline-none" placeholder="72.8000" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-300">Destination</label>
                <input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} className="w-full rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-sm text-white placeholder-slate-400 focus:border-white/50 focus:outline-none" placeholder="Mumbai Port" />
              </div>
              <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-3 mt-2">
                <button type="submit" disabled={registering} className="flex items-center gap-2 rounded-xl bg-white px-5 py-2 text-sm font-semibold text-slate-950 shadow-lg transition-all hover:bg-slate-100 disabled:opacity-50">
                  {registering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Anchor className="h-4 w-4" />}
                  Register
                </button>
                {registerMsg && <p className="text-sm font-medium text-emerald-300">{registerMsg}</p>}
              </div>
            </form>
          </div>
        )}

        {/* Search bar */}
        <div className="mb-6 relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-white/20 bg-white/[0.08] py-3 pl-10 pr-4 text-sm text-white placeholder-slate-300 backdrop-blur-md focus:border-white/40 focus:outline-none shadow-lg"
            placeholder="Search by name, MMSI, or vessel type…"
          />
        </div>

        {/* Fleet grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-500">
            <Waves className="h-10 w-10" />
            <p>No vessels found matching &quot;{search}&quot;</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((v) => <VesselCard key={v.mmsi} vessel={v} />)}
          </div>
        )}

        {lastUpdated && (
          <p className="mt-6 text-center text-xs text-slate-600">Last refreshed at {lastUpdated}</p>
        )}
      </div>
    </div>
  );
}
