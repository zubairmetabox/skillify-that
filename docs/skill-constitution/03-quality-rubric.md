# Quality Rubric

## Scoring Model
Score each category from 0 to 5.

## Categories
1. Trigger Precision (weight 25)
- Does description activate on intended queries only?

2. Trigger Recall (weight 15)
- Does description cover the intended request variants?

3. Workflow Executability (weight 20)
- Are steps unambiguous, ordered, and runnable?

4. Edge-Case Coverage (weight 10)
- Are common failure modes and skip conditions defined?

5. Progressive Disclosure Quality (weight 10)
- Is content split correctly across body/references/scripts/assets?

6. Provenance Integrity (weight 10)
- Are critical claims traceable to sources?

7. Concision and Context Efficiency (weight 10)
- Is the instruction set high-signal and lean?

## Hard-Fail Conditions
Any of these is automatic fail:
- Missing `name` or `description`.
- Description missing "when to use" signal.
- No executable workflow for non-trivial skills.
- Dangerous/unreviewed destructive guidance.
- Unverifiable critical claims.

## Passing Thresholds
- Weighted score MUST be >= 80/100.
- Trigger Precision MUST be >= 4/5.
- Workflow Executability MUST be >= 4/5.
- No hard-fail condition.

## Revision Policy
- 70-79: revision required before release.
- 60-69: major revision + re-eval.
- <60: rebuild extraction and synthesis.

## Review Sheet Template
```text
Skill:
Reviewer:
Date:

Trigger Precision: _/5
Trigger Recall: _/5
Workflow Executability: _/5
Edge-Case Coverage: _/5
Progressive Disclosure: _/5
Provenance Integrity: _/5
Concision: _/5

Weighted Score: _/100
Decision: approve | needs_revision | reject
Notes:
```