# Client 001 Production ESLint Baseline

## Purpose

VENTIQ uses a ratchet baseline for pre-existing production-source ESLint debt during the controlled Client 001 pilot. ESLint remains active; rules are not disabled.

## Accepted baseline

CR-P1.1C v2 established:

- Total production-source ESLint errors: 127
- Total warnings at capture: 42
- @typescript-eslint/no-explicit-any: 79
- @next/next/no-html-link-for-pages: 23
- react-hooks/set-state-in-effect: 19
- react-hooks/immutability: 2
- react-hooks/preserve-manual-memoization: 1
- react-hooks/purity: 1
- prefer-const: 1
- react/no-unescaped-entities: 1

## Release rule

The commercial release gate fails if any production file/rule error count rises above this captured baseline or if a new production file/rule error appears.

Existing debt may remain flat or decrease. It must not grow silently.

## Scope

The ratchet covers production-facing source only:

- app
- components
- lib
- next.config.ts
- proxy.ts
- instrumentation.ts
- instrumentation-client.ts

Historical QA/regression scripts are preserved and are not part of production lint gating.

## Follow-up

After Client 001 stabilization, reduce the baseline as lint debt is remediated. Never increase the baseline merely to make a release pass without explicit engineering review.
