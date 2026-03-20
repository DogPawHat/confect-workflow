# Confect Workflow Test Plan

## Purpose

This plan closes the gap between the workflow wrapper spec in `docs/CONFECT_WORKFLOW_SPEC.md`, the implementation summary in `docs/CONFECT_WORKFLOW_IMPLEMENTATION_SUMMARY.md`, and the tests currently present in `confect-workflow/test`.

The focus is not generic coverage. The focus is proving that the implementation matches the intended contract of the wrapper:

- normal Confect spec/impl registration
- schema-aware boundaries around workflows
- correct ref bridging inside `WorkflowContext`
- correct manager behavior at query and mutation call sites
- correct example-app wiring

## Current Test Harness

The current setup matters for where new tests should live:

- `pnpm test` runs `pnpm run typecheck && vitest run` from the root `package.json`.
- Root Vitest config only includes the `confect-workflow` project in `vite.config.ts`.
- The `confect-workflow` project only includes `test/**/*.test.ts` under `confect-workflow/vitest.config.ts`.

Implication:

- New workflow-wrapper and example-app conformance tests should be added under `confect-workflow/test/**/*.test.ts` unless the Vitest project setup is expanded.
- Root-level `confect/*.spec.ts` files are not test files for Vitest in the current setup.
- Type-level guarantees should continue to be enforced by the existing `typecheck` script rather than Vitest's experimental typechecker.

## Existing Coverage

Current tests already cover:

- metadata preservation from `Workflow.define(...)` to `Workflow.spec(...)`
- registration through `RegisteredConvexFunction.make`
- workflow arg encoding in `WorkflowManagerRequiresMutation.start(...)`
- `WorkflowContext` access to `workflowId`
- `awaitEvent(...)` delegation
- raw Convex mutation pass-through
- workflow arg/return bridging in `runWorkflow(...)`

These are useful smoke tests, but they do not yet prove the full contract from the spec.

## Priority 1: Workflow Boundary Semantics

Add tests for `confect-workflow/src/Workflow.ts`.

### Tests

1. `Workflow.define` decodes args before handler execution
- Use an arg schema with a transformation such as `Schema.NumberFromString`.
- Call the generated workflow handler with encoded input.
- Assert the handler receives the decoded value.

2. `Workflow.define` encodes returns before returning upstream
- Use a return schema with a transformation such as `Schema.NumberFromString`.
- Assert the upstream-visible result is encoded, not the decoded internal value.

3. Invalid encoded args fail before the handler runs
- Pass invalid input to the workflow handler.
- Assert the handler spy is not called.

4. Invalid handler returns fail at the wrapper boundary
- Return a value that does not satisfy the declared return schema.
- Assert the wrapper fails before returning to Convex.

5. `workpoolOptions` are forwarded when defining a workflow
- Mock or spy on upstream `WorkflowManager` construction.
- Assert options are passed through unchanged.

### Why this matters

These tests directly enforce the spec requirement that Effect Schema remains the source of truth for workflow args and returns.

## Priority 2: `WorkflowContext` Ref Bridging

Expand tests for `confect-workflow/src/services/WorkflowContext.ts`.

### Tests

1. Confect query refs encode args and decode returns
- Use a Confect ref whose schema transforms input and output.
- Assert upstream receives encoded args.
- Assert caller receives decoded output.

2. Confect mutation refs encode args and decode returns
- Same shape as the query test, but through `runMutation(...)`.

3. Confect action refs encode args and decode returns
- There is currently no direct `runAction(...)` coverage.

4. Raw Convex query refs pass through unchanged
- Mirror the existing raw mutation test for `runQuery(...)`.

5. Raw Convex action refs pass through unchanged
- Mirror the existing raw mutation test for `runAction(...)`.

6. Non-Confect refs with no real string function name are not coerced through Confect bridging
- This protects the documented regression fix.

7. `runWorkflow(...)` rejects refs without workflow metadata
- Assert the failure is explicit and points back to supported workflow refs.

### Why this matters

The highest-risk branch logic in the wrapper lives here. This is where the raw Convex vs Confect distinction can silently regress.

## Priority 3: `WorkflowManager` Surface Coverage

Expand tests for `confect-workflow/src/services/WorkflowManager.ts`.

### Query service tests

1. `status(...)` delegates and returns an `Effect`
2. `list(...)` delegates and preserves options
3. `listByName(...)` delegates and preserves name and options
4. `listSteps(...)` delegates and preserves workflow id and options

### Mutation service tests

1. `restart(...)` delegates and preserves restart options
2. `cleanup(...)` delegates and returns the upstream boolean
3. `sendEvent(...)` delegates for value payloads
4. `sendEvent(...)` delegates for error payloads
5. `createEvent(...)` delegates and returns the created event id
6. `start(...)` rejects refs without workflow metadata

### Why this matters

The docs describe these wrappers as the Effect-facing public manager services. Most of that public surface is currently untested.

## Priority 4: Registration and Metadata Failure Modes

Add tests around `confect-workflow/src/internal/workflowMetadata.ts` and the `Workflow.spec(...)` boundary.

### Tests

1. `Workflow.spec(...)` rejects non-workflow values
- Prevent accidental use with plain internal mutations.

2. Metadata survives the `define -> spec -> refs` path
- This is mostly covered already, but keep this as an explicit invariant.

3. Metadata survives the `define -> spec -> FunctionImpl -> RegisteredFunctions` path
- Also largely covered already, but it should remain part of the intended contract.

4. Missing workflow metadata produces a clear error in both:
- `WorkflowManager.start(...)`
- `WorkflowContext.runWorkflow(...)`

### Why this matters

The entire wrapper relies on attached metadata instead of Confect provenance. If metadata handling breaks, most schema-aware workflow behavior breaks with it.

## Priority 5: Example-App Conformance Tests

Add tests that exercise the real app wiring in:

- `confect/workflows.ts`
- `confect/workflows.spec.ts`
- `confect/workflows.impl.ts`
- `convex/workflows.ts`

These should still be placed under `confect-workflow/test` to fit the current Vitest project layout.

### Tests

1. `generateTaggedNote` is exposed through normal registration
- Assert it is registered as a standard Confect function through generated registered functions.

2. `startGenerateTaggedNote` starts the real workflow ref
- Assert it calls `WorkflowManagerRequiresMutation.start(...)` with `refs.internal.workflows.generateTaggedNote`.

3. `sendApprovalEvent` sends the expected event name and payload
- Assert the event name is `"approval"` and payload shape is `{ approved }`.

4. `cleanupWorkflow` delegates directly to manager cleanup
- Assert return value is forwarded.

5. Real workflow handler uses raw Convex mutation refs safely
- Exercise `generateTaggedNote` with a mocked workflow context.
- Assert it calls `api.notesAndRandom.notes.insert` unchanged.

6. Real workflow handler waits for approval before completing
- Assert note insertion occurs before `awaitEvent({ name: "approval" })`.

### Why this matters

The spec explicitly treats the example app structure and registration path as part of the intended architecture, not just demo code.

## Suggested File Layout

To stay aligned with the current Vitest setup, add tests in:

- `confect-workflow/test/workflow-runtime-boundary.test.ts`
- `confect-workflow/test/workflow-context-bridging.test.ts`
- `confect-workflow/test/workflow-manager-services.test.ts`
- `confect-workflow/test/workflow-metadata-failure-modes.test.ts`
- `confect-workflow/test/example-workflows-integration.test.ts`

Keeping the new tests in `confect-workflow/test` means they will be discovered by the existing `vitest run` command without further config changes.

## Execution Order

Recommended implementation order:

1. Add workflow runtime boundary tests.
2. Add missing `WorkflowContext` branch tests.
3. Add the rest of the `WorkflowManager` surface tests.
4. Add metadata failure-mode tests.
5. Add example-app conformance tests.

This order starts with the highest-risk wrapper semantics and ends with broader integration coverage.

## Success Criteria

The test plan is complete when:

- every explicit behavior in `docs/CONFECT_WORKFLOW_SPEC.md` has at least one direct test
- every behavior claimed in `docs/CONFECT_WORKFLOW_IMPLEMENTATION_SUMMARY.md` has a matching test or an intentional note explaining why it is not directly testable
- `pnpm test` remains green under the current harness
- the suite continues to rely on explicit `tsc` typechecking instead of Vitest's experimental typecheck path
