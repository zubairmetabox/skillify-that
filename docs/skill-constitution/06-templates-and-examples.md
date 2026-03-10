# Templates and Examples

## Canonical SKILL.md Template
```markdown
---
name: <skill-name>
description: <what the skill does>. Use when <specific trigger situations>.
---

# <Title>

## Overview
<1-2 sentence operational summary>

## Workflow
1. <Step 1>
2. <Step 2>
3. <Step 3>

## Edge Cases
- <Condition>: <Action>
- <Condition>: <Action>

## Output Contract
- <Output file/path/format>
- <Quality constraints>

## References
- Read `references/<file>.md` when <condition>.

## Scripts
- Run `scripts/<script>.py` when <condition>.
```

## Description Quality Examples
Good:
- `Guide for debugging failing CI workflows. Use when asked to investigate failing GitHub Actions jobs, summarize root causes, and propose fixes.`

Bad:
- `Helps with CI.`

Good:
- `Create structured learning plans for open-source tools. Use when the request asks for staged onboarding from docs, code examples, and community resources.`

Bad:
- `Learning skill for many things.`

## SkillAtoms Minimal Template
```json
{
  "intent": "",
  "trigger_signals": [],
  "non_triggers": [],
  "inputs_required": [],
  "outputs_expected": [],
  "workflow_steps": [],
  "decision_points": [],
  "edge_cases": [],
  "tools_and_dependencies": [],
  "script_candidates": [],
  "reference_candidates": [],
  "asset_candidates": [],
  "quality_constraints": [],
  "open_questions": []
}
```

## Extraction Prompt Skeleton
```text
Task: Extract SkillAtoms from the provided source chunks.
Rules:
- Keep only operationally useful knowledge.
- Include confidence and source pointers for each critical claim.
- Exclude unsupported claims.
Output: Valid JSON matching SkillAtoms schema.
```

## Synthesis Prompt Skeleton
```text
Task: Convert validated SkillAtoms into a skill package.
Rules:
- Frontmatter must optimize triggering precision.
- Keep SKILL.md concise.
- Move long details to references and deterministic tasks to scripts.
- Include edge cases and output contract.
Output: SKILL.md draft (+ optional resource file stubs).
```