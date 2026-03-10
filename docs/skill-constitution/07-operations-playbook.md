# Operations Playbook

## Weekly Cadence
1. Review all completed extraction runs.
2. Cluster failures by category:
- Trigger mismatch.
- Missing workflow detail.
- Weak edge-case handling.
- Provenance gaps.
- Overlong/bloated instruction sets.
3. Prioritize top two failure clusters.
4. Update prompts/templates/checks.
5. Run regression suite and compare KPIs.

## Monthly Cadence
1. Rebalance benchmark dataset with new real-world examples.
2. Retire flaky evals and add stronger replacements.
3. Review constitution gaps and propose updates.

## KPI Definitions
- Trigger Precision: correct triggers / total triggers.
- Trigger Recall: captured intended triggers / total intended triggers.
- Workflow Pass Rate: passing execution tests / total execution tests.
- Human Approval Rate: approved drafts / reviewed drafts.
- Mean Revisions to Approval: total revision rounds / approved drafts.

## Release Checklist
- Static validation passes.
- Semantic lint passes.
- Behavioral eval thresholds pass.
- No hard-fail conditions.
- Human review threshold met.
- Regression report accepted.
- Governance records updated.

## Incident Response (Bad Skill Released)
1. Mark skill as blocked.
2. Record failure mode and impact.
3. Roll back to last stable version.
4. Add a permanent regression test for the incident.
5. Re-release only after passing all gates.

## Data Retention for Improvement
Each run SHOULD store:
- Source manifest.
- Extraction prompt/version.
- SkillAtoms output.
- Validation reports.
- Human feedback.
- Final decision.

## Ownership
- Maintainer owns weekly quality review.
- Reviewer rotation owns approval consistency.
- Contributors own remediation PRs for assigned failure clusters.