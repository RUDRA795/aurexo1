export type AgentName =
  | 'Supervisor'
  | 'Ocean'
  | 'WeatherHazard'
  | 'SpatialSentinel'
  | 'Vessel'
  | 'BlueEconomy';

export interface AgentStep {
  agentName: AgentName;
  action: string;
  status: 'executing' | 'completed' | 'flagged';
  detail: string;
  timestamp: string;
}

export interface AgentSwarmTrace {
  steps: AgentStep[];
  consensusSummary: string;
  durationMs: number;
}
