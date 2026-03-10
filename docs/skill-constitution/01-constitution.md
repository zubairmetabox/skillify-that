# Skill Constitution

## Scope
This constitution governs how skills are extracted, authored, validated, reviewed, and improved in this project.

## Terminology
- MUST: mandatory requirement.
- SHOULD: strong recommendation; deviations need a reason.
- MAY: optional.

## Canonical Skill Package
A skill package MUST follow this structure:

```text
<skill-name>/
  SKILL.md
  scripts/      (optional)
  references/   (optional)
  assets/       (optional)
  agents/       (optional)
```

## Frontmatter Rules
`SKILL.md` frontmatter MUST include:
- `name`
- `description`

`name` MUST:
- Be lowercase hyphen-case.
- Match `^[a-z0-9-]+$`.
- Be <= 64 characters.

`description` MUST:
- State what the skill does.
- State when to use it.
- Include trigger context keywords.
- Be concise and unambiguous.

`description` SHOULD:
- Include non-trigger boundaries when confusion risk is high.

## Body Rules
`SKILL.md` body MUST:
- Use imperative execution instructions.
- Define ordered workflow steps for non-trivial tasks.
- Specify edge-case handling and skip conditions.
- Define output expectations.
- Reference extra files by relative path when needed.

`SKILL.md` body SHOULD:
- Stay under 500 lines.
- Avoid explanatory bloat.

`SKILL.md` body MUST NOT:
- Duplicate long content from `references/`.
- Include unrelated onboarding/process notes.

## Resource Rules
### scripts/
- MUST contain deterministic, runnable helpers for repeated fragile operations.
- MUST include basic error handling.
- SHOULD be testable independently.

### references/
- MUST contain long-form context not needed on every invocation.
- SHOULD include sectioned headings for selective loading.

### assets/
- MUST contain output artifacts/templates, not explanatory docs.

## Triggering Rules
- Frontmatter is the primary trigger surface.
- Broad descriptions that over-trigger MUST be rejected.
- Missing trigger terms for expected queries MUST be rejected.

## Provenance Rules
- Extracted claims used in a skill MUST have source pointers.
- Low-confidence claims MUST be flagged or excluded.

## Validation Rules
A skill MUST pass:
1. Static validation.
2. Semantic lint checks.
3. Behavioral evals.
4. Human review threshold.

## Safety Rules
Skills MUST:
- Avoid destructive actions without explicit confirmation.
- Declare assumptions when source ambiguity exists.
- Avoid irreversible operations by default.

## Violation Severity
- P0: dangerous, invalid, or severely misrouting behavior. Block release.
- P1: major reliability gaps. Block release.
- P2: quality gaps. Release only with explicit waiver.
- P3: style/clarity issues. Track for next revision.