# Validation and Evals

## Validation Layers

## 1) Static Validation
Required checks:
- `SKILL.md` exists.
- YAML frontmatter parses.
- Required fields present.
- Name format and length valid.
- Directory layout valid.

## 2) Semantic Lint
Required checks:
- Description includes both what and when.
- Ambiguity detector for vague terms.
- Step ordering consistency.
- Progressive disclosure compliance.
- Duplicate content detector between `SKILL.md` and `references/`.

## 3) Behavioral Evals
### Trigger Tests
- Positive set: prompts that MUST trigger.
- Negative set: prompts that MUST NOT trigger.

### Execution Tests
- Verify workflow steps execute in expected order.
- Verify outputs match required format and location.
- Verify edge-case paths behave as defined.

## Benchmark Design (`SkillBench`)
Minimum baseline:
- 20 video resources.
- 20 web/doc resources.
- 10 multi-source synthesis cases.

Each benchmark item MUST include:
- Expected trigger signals.
- Expected workflow skeleton.
- Expected output contract.
- Edge-case expectations.

## Regression Policy
On any extraction/prompt/template change:
1. Run full benchmark suite.
2. Compare with previous baseline.
3. Block release on material regression in precision, workflow pass rate, or approval rate.

## CI Gate Recommendation
A release candidate SHOULD fail CI if:
- Any hard-fail condition appears.
- Weighted median score drops by >= 5 points.
- Trigger precision drops below threshold.

## Required Reports
- Static validation report.
- Semantic lint report.
- Behavioral eval report.
- Regression diff report.