import type { SupportedPublicLanguage } from '../public-language.ts';
import type {
  ClarificationResolution,
  HousekeepingPendingRequest,
  HousekeepingRequest,
} from '../assistant-tools/types.ts';
import type { NormalizedAssistantMessage } from './normalize.ts';

export type AssistantRouteCategory =
  | 'deterministic'
  | 'capability'
  | 'clarification'
  | 'classification'
  | 'ai';

export type AssistantResolutionPath =
  | 'deterministic'
  | 'direct_ai'
  | 'classifier_to_capability'
  | 'classifier_to_ai'
  | 'classifier_failed_to_ai';

export interface AssistantUsageTrace {
  resolutionPath: AssistantResolutionPath;
  classifierCalls: 0 | 1;
  fullAiCalls: 0 | 1;
  totalUpstreamCalls: 0 | 1 | 2;
}

export type ClassifiedAssistantIntent =
  | 'human_handoff'
  | 'reception_contact'
  | 'housekeeping_contact'
  | 'housekeeping_request_towels'
  | 'housekeeping_request_room_cleaning'
  | 'hotel_information'
  | 'flight_information'
  | 'tourism'
  | 'sales'
  | 'general_chat'
  | 'unknown';

export interface AssistantClassification {
  intent: ClassifiedAssistantIntent;
  confidence: number;
  detectedLanguage: SupportedPublicLanguage | null;
}

export type AssistantStrongIntentName =
  | 'emergency'
  | 'human_handoff'
  | 'housekeeping_request'
  | 'reception_contact'
  | 'housekeeping_contact';

interface AssistantRouteDecisionBase {
  assistantRoute: AssistantRouteCategory;
  message: NormalizedAssistantMessage;
  contactDeclinedLanguage?: SupportedPublicLanguage;
}

export type AssistantRouteDecision =
  | (AssistantRouteDecisionBase & {
      mode: 'capability';
      assistantRoute: 'capability';
      capability: 'human_handoff' | 'reception_contact' | 'housekeeping_contact';
      detectedLanguage: SupportedPublicLanguage | null;
    })
  | (AssistantRouteDecisionBase & {
      mode: 'capability';
      assistantRoute: 'capability';
      capability: 'housekeeping_request';
      detectedLanguage: SupportedPublicLanguage | null;
      request: HousekeepingRequest;
    })
  | (AssistantRouteDecisionBase & {
      mode: 'clarification';
      assistantRoute: 'clarification';
      resolution: Extract<ClarificationResolution, { kind: 'resolved' | 'retry' }>;
      detectedLanguage: SupportedPublicLanguage;
    })
  | (AssistantRouteDecisionBase & {
      mode: 'deterministic';
      assistantRoute: 'deterministic';
      outcome:
        | 'clarification_cancelled'
        | 'housekeeping_cancellation_unavailable'
        | 'contact_declined';
      detectedLanguage: SupportedPublicLanguage | null;
    })
  | (AssistantRouteDecisionBase & {
      mode: 'classification';
      assistantRoute: 'classification';
      uiLanguage: SupportedPublicLanguage;
    })
  | (AssistantRouteDecisionBase & {
      mode: 'ai';
      assistantRoute: 'ai';
      reason: 'general_chat' | 'open_question' | 'ambiguous';
    })
  | (AssistantRouteDecisionBase & {
      mode: 'tourism';
      assistantRoute: 'ai';
      reason: 'open_tourism';
    });

export interface AssistantRouterInput {
  message: string;
  uiLanguage: SupportedPublicLanguage;
  pendingRequest?: HousekeepingPendingRequest;
}
