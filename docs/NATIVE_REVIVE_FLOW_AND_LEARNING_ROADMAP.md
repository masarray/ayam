# Native Revive Flow and Learning Roadmap

## Fixed flow

The revive loop must never stack the regular Game Over card with the revive offer. The intended flow is:

```txt
First hit -> reserve heart consumed -> respawn -> play continues
Second hit -> short pending dim -> revive offer card -> player chooses
Choose quiz -> one question -> correct revive / wrong explanation
Choose restart -> start new run
```

## Product direction

The learning system should move toward math-as-power rather than math-as-punishment. The safest roadmap is:

1. Keep revive quiz as the primary recovery mechanic.
2. Add optional math power-up items after the revive flow is stable.
3. Add bar-model / tape-diagram visual explanations for word problems.
4. Add coins, skins, and local top scores as long-term retention rewards.

## Guardrails

- Do not show questions before the player chooses revive.
- Do not render Game Over under a revive offer.
- Do not interrupt active gameplay with mandatory multi-question quizzes.
- Keep BGM lazy/context-aware and SFX higher priority than music.
