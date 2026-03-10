# Extraction Protocol

## Objective
Convert one or more resources into a validated skill package with traceable evidence.

## Inputs
Each source MUST be represented as:
- `source_id`
- `source_type` (`youtube`, `web`, `pdf`, `audio`, `repo`, `notes`)
- `uri`
- `ingestion_method`
- `language`
- `license_notes`
- `ingested_at`

## Phase 0: Preflight
1. Verify source access and license constraints.
2. Reject unsupported/private sources with explicit error.
3. Persist immutable raw snapshot metadata.

## Phase 1: Ingestion
### Video
1. Attempt caption ingestion first.
2. If missing/poor, run STT fallback.
3. Preserve timestamp boundaries for each segment.

### Web/Docs
1. Extract main article/body content.
2. Remove nav, footer, and boilerplate.
3. Preserve URL and section anchors.

## Phase 2: Normalization
1. Segment content into semantic chunks.
2. Label chunk topic, confidence, and source pointer.
3. Remove duplicates and near-duplicates.

## Phase 3: SkillAtoms Extraction
Extract structured atoms into this schema:
- `intent`
- `trigger_signals`
- `non_triggers`
- `inputs_required`
- `outputs_expected`
- `workflow_steps`
- `decision_points`
- `edge_cases`
- `tools_and_dependencies`
- `script_candidates`
- `reference_candidates`
- `asset_candidates`
- `quality_constraints`
- `open_questions`

Rules:
- Every atom MUST include confidence.
- Every atom SHOULD include evidence pointers.
- Atoms below confidence threshold MUST be dropped or flagged.

## Phase 4: Synthesis
1. Generate `SKILL.md` frontmatter from extracted intent/trigger atoms.
2. Generate concise body with ordered execution steps.
3. Materialize `scripts/`, `references/`, and `assets/` by progressive disclosure policy.
4. Generate optional `agents/openai.yaml` metadata draft.

## Phase 5: Conflict Resolution (Multi-Source)
When sources disagree:
1. Prefer primary sources over commentary.
2. Prefer newest dated source when time-sensitive.
3. Mark unresolved conflicts in `open_questions`.
4. Do not synthesize unresolvable contradictions as facts.

## Phase 6: Validation
Run all gates in order:
1. Static checks.
2. Semantic lint.
3. Behavioral evals.
4. Human review.

## Phase 7: Release Decision
- Approve only if all required gates pass.
- Otherwise route to revision with categorized failure reasons.

## Required Artifacts per Run
- Source manifest.
- SkillAtoms JSON.
- Draft package.
- Validation report.
- Human review form.
- Final decision log.