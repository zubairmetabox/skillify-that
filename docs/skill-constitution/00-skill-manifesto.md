# Skill Manifesto

## Purpose
Build skills that are precise, reusable, and auditable.

A skill is not a generic prompt. A skill is operational knowledge that another agent can execute reliably across real tasks, under real constraints, with minimal ambiguity.

## Mission
Convert expert knowledge from videos, web pages, docs, and other sources into production-grade skill packages that:
- Trigger correctly.
- Produce predictable outcomes.
- Improve over time through evidence and evaluation.

## Non-Negotiables
1. Trigger precision over breadth.
2. Clear execution over clever phrasing.
3. Provenance for every important claim.
4. Progressive disclosure for context efficiency.
5. Deterministic scripts for fragile repeated operations.
6. Explicit edge-case handling.
7. Repeatable validation before release.
8. Human review for high-impact ambiguity.
9. Continuous regression testing after changes.
10. Cross-platform compatibility where possible.

## Principles
1. Skills are contracts.
Define inputs, process, outputs, and failure behavior.

2. Descriptions are routing logic.
`name` and `description` determine if and when a skill activates. Weak frontmatter causes misrouting.

3. Concision is performance.
Use short, high-signal instructions in `SKILL.md`; move details into `references/`.

4. Structure enables reliability.
Use `scripts/` for deterministic logic and `assets/` for output artifacts.

5. Evaluation is part of authoring.
A skill is incomplete until it passes static checks, semantic checks, and behavioral evals.

6. Improvement is required.
Every extraction run should produce data that improves the next run.

## What We Refuse
- Vague skills that trigger too often.
- Unverifiable claims without source pointers.
- One-off manual drafting with no test harness.
- Bloated files that duplicate content across body and references.
- Publishing skills without clear approval criteria.

## Definition of Success
We succeed when a new contributor can take a raw resource, follow the constitution, and produce a validated skill package without ad-hoc decisions.