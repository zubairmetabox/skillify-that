# Plan V2: Skill Extraction Engine (Video + Web + Docs)

## 1. Outcome We Are Optimizing For
Build a repeatable extraction process that converts one or many raw resources into high-quality, testable `SKILL.md` drafts, then improves itself over time through evaluation, logging, and revision loops.

Success means:
- The generated skill triggers when it should, and does not trigger when it should not.
- The skill instructions are executable and produce consistent outputs.
- The process can absorb new source types without redesign.
- Each run creates data that makes the next run better.

## 2. Research Synthesis (Local + Online)

### 2.1 What your local materials strongly confirm
- Skills are packageable procedural knowledge, not just prompts.
- `name` and `description` are mission-critical because they drive triggering.
- Description quality must include both what the skill does and when to use it.
- Progressive disclosure is core: keep `SKILL.md` focused, move heavy detail to `references/`, operational logic to `scripts/`, and output artifacts to `assets/`.
- Predictable workflows need explicit step ordering, edge-case handling, and clear skip conditions.
- Skills should be evaluated in two layers:
- Static/best-practice checks (frontmatter, concision, structure).
- Behavioral checks (real tasks, expected outputs, human feedback).

### 2.2 What official external docs add
- Agent Skills spec tooling provides a clear conversion and validation flow (`skill.toml` <-> `SKILL.md`, validate, eval).
- GitHub Copilot skills documentation reinforces required `SKILL.md` structure, location conventions, and the distinction between skills vs always-on custom instructions.
- YouTube captions API requires authorization tied to the video owner/editor role, so public-video ingestion must include fallback transcription strategy.
- Groq supports audio transcription and structured outputs, which is useful for schema-constrained extraction.
- Anthropic guidance reinforces XML-tagged structure and long-context prompt hygiene for extraction reliability.

## 3. Process V2 (Decision-Complete)

### Phase A: Source Intake Contract
Define a strict intake object per resource:
- `source_id`
- `source_type` (`youtube`, `web`, `pdf`, `audio`, `repo`, `notes`)
- `uri`
- `ingestion_method` (`caption`, `stt`, `html_parse`, `pdf_parse`)
- `language`
- `license_notes`
- `timestamp`

Rules:
- Reject unsupported/private sources early with explicit reason.
- Store immutable raw snapshots for reproducibility.

### Phase B: Resource-Specific Extraction

Video path:
1. Attempt caption retrieval first.
2. If captions unavailable/low quality, run STT fallback.
3. Segment transcript into semantic chunks by topic boundaries.
4. Preserve evidence pointers (`start_time`, `end_time`, quote span).

Web/docs path:
1. Extract main content and headings.
2. Remove boilerplate and navigation noise.
3. Chunk by section semantics (`h1/h2/h3` + paragraph windows).
4. Preserve citation anchors (URL + section heading).

General rule:
- Every extracted claim must keep provenance to source location.

### Phase C: Skill Atom Extraction (Structured)
Run model extraction into a strict JSON schema called `SkillAtoms`:
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
- Use structured output mode (schema-constrained).
- Each atom needs confidence score + evidence pointers.
- Drop or flag atoms below confidence threshold.

### Phase D: Skill Synthesis
Convert validated `SkillAtoms` to draft skill package:
1. Generate `SKILL.md` frontmatter (`name`, `description`) with trigger-safe wording.
2. Generate body with explicit workflow, edge cases, and tool usage.
3. Apply progressive disclosure policy:
- Move long variant details to `references/*`.
- Move deterministic transformations to `scripts/*`.
- Move output templates to `assets/*`.
4. Generate optional `agents/openai.yaml` metadata draft.

Mandatory synthesis checks:
- `description` includes what + when.
- Step ordering is executable.
- No duplicated instructions between `SKILL.md` and references.

### Phase E: Validation Gates
Gate 1: Static validation
- Frontmatter keys and naming rules.
- Length/format checks.
- Path conventions and folder structure.

Gate 2: Semantic linting
- Trigger clarity score.
- Ambiguity detector (vague verbs, missing conditions).
- Progressive disclosure compliance.

Gate 3: Behavioral evals
- Positive triggers: prompts that should invoke the skill.
- Negative triggers: prompts that should not invoke the skill.
- Workflow fidelity: resulting output follows required sequence.
- Output correctness against expected artifacts.

### Phase F: Human Review and Approval
Review form for each draft:
- Trigger precision (1-5)
- Instruction executability (1-5)
- Concision/context efficiency (1-5)
- Reusability across projects (1-5)
- Safety/risk notes

Approval policy:
- Auto-approve only if all gates pass and reviewer score >= threshold.
- Otherwise mark as `needs_revision` with machine + human failure reasons.

### Phase G: Improvement Loop (Core Requirement)
Persist run telemetry:
- Source metadata
- Prompt/version used
- Extracted atoms
- Validation outputs
- Human scores
- Production outcome signals

Weekly optimization cycle:
1. Cluster failures by category.
2. Update extraction prompts/templates for top categories.
3. Re-run regression suite on previous benchmark set.
4. Promote only if quality improves without regression.

## 4. Benchmark and Evaluation Design

Create `SkillBench` dataset with:
- 20 video resources
- 20 documentation/web resources
- 10 mixed multi-source projects

For each benchmark item store:
- gold `trigger_signals`
- gold workflow skeleton
- expected output contract
- edge-case expectations

Track these KPIs per release:
- Trigger precision
- Trigger recall
- Workflow pass rate
- Human approval rate
- Revision cycles to approval
- Average token footprint of final skill
- Regression rate against previous release

## 5. Implementation Sequence for Your App

Milestone 1: Offline pipeline prototype
- Build CLI pipeline for one-source extraction to `SkillAtoms` + `SKILL.md`.
- Add static and semantic validation.
- Run on 5 local resources from your folder.

Milestone 2: Multi-source synthesis
- Support combining multiple resources into one coherent draft.
- Add conflict resolution policy for contradictory sources.
- Add provenance panel for every generated section.

Milestone 3: Webapp integration (Next.js)
- Upload/URL ingestion UI.
- Pipeline job orchestration and status tracking.
- Draft review UI with scorecards and approve/revise actions.

Milestone 4: Continuous improvement system
- Evaluation dashboard.
- Prompt/template versioning.
- Automated weekly regression run.

## 6. Concrete Standards to Lock In Now
- Keep `SKILL.md` concise and operational.
- Put exhaustive detail into references and only load when needed.
- Use deterministic scripts for fragile repeated operations.
- Never accept extracted claims without provenance.
- Treat evals as first-class product features, not post-processing.

## 7. Risks and Mitigations
- Risk: weak/incorrect transcript quality.
- Mitigation: caption-first, STT fallback, confidence thresholds, human spot checks.
- Risk: overfitted skills that trigger too often.
- Mitigation: negative-trigger test set and trigger precision KPI.
- Risk: giant source files inflate noisy instructions.
- Mitigation: chunking + atom confidence pruning + progressive disclosure.
- Risk: model/provider changes alter extraction behavior.
- Mitigation: adapter interface + benchmark regression gate before rollout.

## 8. Sources Used
- Local materials:
- `C:\dev\skillify-that\How to build skill resources\Agent Skills with anthropic\*.txt`
- `C:\dev\skillify-that\How to build skill resources\Creating agent skills for GitHub Copilot.html`
- `C:\dev\skillify-that\How to build skill resources\AndrewNGAICourse\*.txt`
- Agent Skills standard and docs:
- https://agentskills.io/spec
- https://agentskills.io/what-are-skills
- https://agentskills.io/evaluating-skills
- https://github.com/agentskills/skills/tree/main/skills/.system/skills-ref
- GitHub official docs:
- https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/create-skills
- https://docs.github.com/en/copilot/concepts/agents/about-agent-skills
- YouTube official API docs:
- https://developers.google.com/youtube/v3/docs/captions/list
- https://developers.google.com/youtube/v3/docs/captions/download
- Provider docs:
- https://console.groq.com/docs/speech-to-text
- https://console.groq.com/docs/structured-outputs
- https://inference-docs.cerebras.ai
- Prompting/context guidance:
- https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/use-xml-tags
- https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/long-context-tips