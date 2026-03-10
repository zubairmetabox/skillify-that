import {
  Expert,
  ExpertAlias,
  SourceEndpoint,
  SourcePolicyProfile,
  DiscoveryRun,
  ExpertStatus,
  SourceType,
  SourceTier,
  ComplianceStatus,
  DiscoveryStatus,
} from "@prisma/client";

export type {
  Expert,
  ExpertAlias,
  SourceEndpoint,
  SourcePolicyProfile,
  DiscoveryRun,
  ExpertStatus,
  SourceType,
  SourceTier,
  ComplianceStatus,
  DiscoveryStatus,
};

export type ExpertWithRelations = Expert & {
  aliases: ExpertAlias[];
  sourceEndpoints: (SourceEndpoint & {
    policyProfile: SourcePolicyProfile | null;
  })[];
  discoveryRuns: DiscoveryRun[];
};

export type DiscoveredSource = {
  url: string;
  label: string;
  sourceType: SourceType;
  tier: SourceTier;
  authorityScore: number;
  relevanceScore: number;
  priorityScore: number;
  complianceStatus: ComplianceStatus;
  complianceNote?: string;
  robotsAllowed?: boolean;
};

// SkillAtom schema (used in Milestone 2+)
export type SkillAtom = {
  intent: string;
  trigger_signals: string[];
  non_triggers: string[];
  inputs_required: string[];
  outputs_expected: string[];
  workflow_steps: string[];
  decision_points: string[];
  edge_cases: string[];
  tools_and_dependencies: string[];
  script_candidates: string[];
  reference_candidates: string[];
  asset_candidates: string[];
  quality_constraints: string[];
  open_questions: string[];
  confidence: number;
  evidence_pointers: EvidencePointer[];
};

export type EvidencePointer = {
  source_url: string;
  section?: string;
  quote?: string;
  timestamp?: string;
  attribution_level: "L1_DIRECT" | "L2_FIRST_PARTY" | "L3_SECONDARY";
};
