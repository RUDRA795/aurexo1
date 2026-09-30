import { AgentResponse, GeoCoordinate, SessionContext } from '../types/domain';

export interface OrchestratorInput {
  prompt: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  sessionContext?: SessionContext;
  userCoordinates?: GeoCoordinate;
}

/**
 * Canonical mission orchestration contract.
 * Decouples the multi-agent reasoning core from the HTTP gateway and front-end.
 * Allows seamless replacement with LangGraph or Google ADK without touching front-end contracts.
 */
export interface MissionOrchestrator {
  dispatch(input: OrchestratorInput): Promise<AgentResponse>;
}
