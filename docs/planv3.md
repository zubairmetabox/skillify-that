# Plan V3: Expert-to-Skill Atlas (Person-Wide Skill Extraction)

## 1. Goal
Build a system that can take one expert (example: Grant Cardone) and generate a high-quality **Skill Atlas** for a chosen domain (example: sales) by:
- discovering that expert's public content,
- extracting reusable skill primitives,
- synthesizing validated skill packages,
- improving quality continuously over time.

Important framing:
- We are extracting **observable, evidence-backed procedural expertise from content**, not claiming total human knowledge.
- "All skills" is interpreted as "all detectable skills in accessible, permitted sources within defined scope."

## 2. What Changes from Plan V2
Plan V2 solved source -> skill extraction.
Plan V3 adds:
1. **Expert-wide content discovery** across many sources.
2. **Identity resolution** (aliases, profiles, channels).
3. **Skill Atlas generation** (many skills + taxonomy from one expert).
4. **Authority and provenance scoring** to separate direct expertise from third-party commentary.
5. **Compliance orchestration** per source (robots/TOS/API-first).

## 3. Product Outcome
For each expert + domain, produce:
- `expert-profile.json` (identity + source map)
- `domain-taxonomy.json` (skill map for domain)
- `skills/` folder containing multiple validated skills
- `atlas-report.md` (coverage, confidence, gaps, conflicts)

## 4. End-to-End Pipeline

## Phase A: Expert Identity Resolution
Input:
- `person_name`
- optional `domain`
- optional known URLs

Process:
1. Create canonical expert record.
2. Resolve aliases, handles, brands, and official channels.
3. Build `sameAs` graph (official site, YouTube channel, socials, books, podcasts, etc.).
4. Human-confirm high-impact ambiguities (same-name people).

Output:
- `expert_id`, `canonical_name`, `aliases`, `official_sources`, `candidate_sources`.

## Phase B: Source Discovery and Prioritization
Discovery tiers:
1. Official properties (site, newsletters, verified channels).
2. First-party publishing platforms (YouTube, podcast feeds, course portals).
3. High-signal secondary sources (interviews, long-form transcripts).
4. Low-trust tertiary sources (summaries, reposts) used only for discovery hints.

Prioritization score per source:
- authority (official/verified)
- relevance to target domain
- content depth (long-form > short snippets)
- recency
- extraction feasibility
- legal/compliance status

Output:
- ranked crawl plan with budget and connector per source.

## Phase C: Compliance Gate (Hard Requirement)
Before ingesting any source:
1. Check source policy profile (API allowed, robots, TOS constraints).
2. Prefer official APIs/feeds over raw scraping.
3. If policy disallows automated access, skip source and log reason.
4. Store compliance decision for audit.

Rules:
- API-first policy.
- robots-aware crawling.
- rate-limit adherence.
- attribution retention.
- content retention policy by source license.

## Phase D: Content Acquisition
Connectors (MVP order):
1. YouTube channel content map (videos, metadata).
2. Public web pages (official site/blog).
3. RSS/newsletters.
4. Podcast episode pages/transcripts (where available).

Acquisition outputs:
- normalized content records
- transcript/text chunks
- provenance pointers (URL, section, timestamp)
- ingestion quality/confidence

## Phase E: Skill Signal Mining
Convert chunks into candidate `SkillAtoms` using schema-constrained extraction.

Add expert-specific attribution fields:
- `attribution_level`:
  - `L1_DIRECT`: direct speech/text from expert
  - `L2_FIRST_PARTY`: expert team/org official content
  - `L3_SECONDARY`: interviews/summaries by others
- `evidence_strength` (0-1)
- `domain_relevance` (0-1)

Filter rules:
- Keep L1/L2 by default.
- L3 only when corroborated by L1/L2 or clearly labeled as secondary.

## Phase F: Domain Taxonomy Construction
For each domain (ex: sales), build a hierarchical map:
- principles
- frameworks
- tactics
- scripts
- objections
- diagnostics
- workflows

Then cluster atoms into candidate skills:
- `sales-discovery-calls`
- `sales-objection-handling`
- `sales-closing`
- `sales-follow-up-sequences`
- etc. (domain dependent)

## Phase G: Skill Package Synthesis
For each cluster:
1. Generate `SKILL.md` with precise trigger description.
2. Materialize `references/` for long examples and transcripts.
3. Materialize `scripts/` only when deterministic operations are needed.
4. Include anti-overclaim notes where evidence is thin.

Output:
- Multiple skills plus atlas index file linking all skill packages.

## Phase H: Validation and Release
Run constitution-aligned gates:
1. Static checks.
2. Semantic lint.
3. Behavioral evals.
4. Human review.

Atlas-level checks:
- duplication across skills
- trigger collisions between skills
- contradictory guidance detection
- source coverage score

Release states:
- `draft`
- `reviewed`
- `approved`
- `deprecated`

## 5. Data Model Additions
Add these entities beyond V2:
- `Expert`
- `ExpertAlias`
- `SourceEndpoint`
- `SourcePolicyProfile`
- `ContentRecord`
- `EvidencePointer`
- `SkillAtom`
- `SkillCluster`
- `SkillPackage`
- `SkillAtlas`
- `CoverageReport`

Key relations:
- Expert -> many SourceEndpoints
- SourceEndpoint -> many ContentRecords
- ContentRecord -> many SkillAtoms
- SkillAtoms -> one SkillCluster
- SkillCluster -> one SkillPackage
- SkillPackages -> one SkillAtlas

## 6. API Surface (Plan V3)
- `POST /api/experts` create expert profile
- `POST /api/experts/:id/discover` run source discovery
- `POST /api/experts/:id/ingest` ingest approved sources
- `POST /api/experts/:id/mine-atoms` extract skill atoms
- `POST /api/experts/:id/build-atlas` cluster + synthesize skills
- `POST /api/atlas/:id/validate` run all validation gates
- `GET /api/atlas/:id/report` coverage + confidence report
- `GET /api/atlas/:id/export` export atlas package

## 7. Quality and Safety Constraints
1. Never attribute secondary claims as direct expert guidance.
2. Every major instruction in generated skills must link to evidence.
3. Enforce negative-trigger tests to prevent overfiring skills.
4. Detect and label outdated guidance by publication date.
5. Track uncertainty explicitly; avoid false certainty.

## 8. Compliance and Risk Handling
Primary risks:
- policy violations from indiscriminate scraping
- copyrighted content misuse
- misattribution of guidance
- contradiction across time/content

Mitigations:
- source policy engine + allowlist connectors
- API-first ingestion
- provenance + attribution level fields
- date-aware conflict resolver
- human review for high-impact skills

## 9. Milestones (Execution)

## Milestone 1: Expert Discovery MVP
- Create expert profile
- Resolve official source graph
- Produce ranked source plan with compliance status

## Milestone 2: Ingestion + Atom Mining
- Ingest top approved sources
- Extract normalized chunks + SkillAtoms
- Generate initial domain taxonomy

## Milestone 3: Atlas Synthesis
- Cluster atoms into multiple skills
- Generate skill packages + atlas report
- Run validation gates and reviewer workflow

## Milestone 4: Continuous Update Engine
- Schedule recrawls for new content
- Recompute affected skills only
- Run regression and publish delta report

## 10. Metrics
- Source coverage (approved/total discovered)
- L1/L2 evidence ratio
- Trigger precision and recall
- Skill approval rate
- Contradiction rate
- Mean revisions to approval
- Time to produce first approved atlas

## 11. MVP Boundaries
In scope:
- single expert
- single domain per atlas run
- English-first
- public web + YouTube + RSS where compliant

Out of scope (v3 MVP):
- private paywalled acquisition bypass
- impersonation/persona simulation
- legal determination automation
- cross-language full parity

## 12. Concrete First Use Case
Pilot case:
- Expert: Grant Cardone (example seed)
- Domain: Sales
- Goal: produce first `sales-skill-atlas` with 5-10 validated skills.

Pilot acceptance criteria:
- >= 5 approved skills
- trigger precision >= 0.80 on test set
- every skill includes provenance-backed key steps
- compliance report generated for all considered sources

## 13. External Research Incorporated
- YouTube captions and authorization model:
  - https://developers.google.com/youtube/v3/docs/captions/list
- YouTube API policy and compliance requirements:
  - https://developers.google.com/youtube/terms/developer-policies
  - https://developers.google.com/youtube/terms/developer-policies-guide
- YouTube quota constraints for large-scale channel ingestion:
  - https://developers.google.com/youtube/v3/determine_quota_cost
  - https://developers.google.com/youtube/v3/getting-started
- Channel/uploads traversal primitives:
  - https://developers.google.com/youtube/v3/docs/channels
  - https://developers.google.com/youtube/v3/docs/playlistItems
- Crawl etiquette baseline:
  - https://www.rfc-editor.org/rfc/rfc9309.html
- Site URL discovery standards:
  - https://www.sitemaps.org/protocol.html
- Entity identity graph hints:
  - https://schema.org/Person
  - https://schema.org/sameAs