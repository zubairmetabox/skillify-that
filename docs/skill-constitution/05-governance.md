# Governance

## Roles
- Maintainer: owns constitution quality and release policy.
- Reviewer: performs quality reviews and approvals.
- Contributor: proposes changes and drafts updates.

## Versioning
Use semantic versioning for the constitution pack:
- MAJOR: breaking policy changes.
- MINOR: new sections/checks without breaking existing policy.
- PATCH: clarifications, typo fixes, non-breaking edits.

## Change Process
1. Submit change proposal with rationale and impact.
2. Map impacted files and validation criteria.
3. Review by at least one maintainer and one reviewer.
4. Run benchmark/regression checks.
5. Approve and publish with version bump.

## Required Change Proposal Fields
- Problem statement.
- Current behavior.
- Proposed behavior.
- Risks.
- Migration plan.
- Rollback plan.

## Policy Exceptions
Exceptions are allowed only when:
- There is a blocker with no safe compliant path.
- Exception is time-bound.
- Exception is documented with owner and expiry date.

## Deprecation Policy
When replacing a rule/template:
1. Mark as deprecated.
2. Define replacement.
3. Provide migration window.
4. Remove only after window expires.

## Audit Trail
Every approved change MUST record:
- Version.
- Author.
- Reviewers.
- Date.
- Summary.
- Test/eval evidence links.