Make a wrapper around `@convex-dev/workflow` that integrates it with Effect and allows it to be used in Confect.

## Docs

https://confect.dev/llms.txt
https://effect.website/llms.txt
https://docs.convex.dev/llms.txt
https://github.com/get-convex/workflow

## Requirements

- Fit the Confect spec/impl model
  - See https://confect.dev/concepts/spec-impl-model.md
- Respect the Confect project structure
  - See https://confect.dev/concepts/project-structure.md
- Assume `@convex-dev/workflow` is installed in `convex/convex.config.ts`
- Use Confect v3 plain Convex function support as the base layer
  - See https://confect.dev/server/plain-convex-functions
- Use Effect Schema as the source of truth for workflow args and returns
- Expose wrapper-specific Effect services for workflow runtime access
  - `WorkflowContext` for workflow handlers
  - `WorkflowManager` services for query/mutation call sites
- Register workflow definitions through the normal Confect registration pipeline
  - No custom registry items
  - No custom registered-function maker
  - No custom generated `registeredFunctions` override
- Keep workflow definitions as first-class plain internal mutations in Confect
  - `workflowSpec({ name, args, returns })` creates the workflow's plain Convex internal mutation spec
  - `defineWorkflow(component, workflowSpec, { handler, workpoolOptions? })` creates the upstream workflow mutation
  - app code uses normal `FunctionImpl.make(...)` to register the workflow
- Preserve schema-aware behavior at wrapper boundaries even though plain Convex provenance is schema-blind
  - decode workflow args before the Effect handler runs
  - encode workflow returns before returning to Convex
  - encode workflow args in `WorkflowManager.start`
  - encode/decode workflow refs in `WorkflowContext.runWorkflow`

## Implemented Design

- `confect-workflow/src/Workflow.ts` is the wrapper entry point
  - `workflowSpec({ name, args, returns })`
  - `defineWorkflow(component, workflowSpec, { handler, workpoolOptions? })`
- Wrapper-owned schema metadata is attached to the workflow spec
  - this preserves schema-aware bridging while keeping the Confect spec as the source of truth
- `WorkflowContext` wraps the upstream workflow ctx and exposes:
  - `runQuery`
  - `runMutation`
  - `runAction`
  - `runWorkflow`
  - `awaitEvent`
- `WorkflowContext.runQuery` / `runMutation` / `runAction` support both:
  - Confect refs, with normal Confect provenance-aware bridging
  - raw Convex refs, passed through unchanged
- `WorkflowManagerRequiresQuery` and `WorkflowManagerRequiresMutation` expose Effect-returning wrappers around the upstream manager
- The example app defines its workflow spec in `confect/workflows.spec.ts`, defines the runtime workflow in `confect/workflows.ts`, and registers it in `confect/workflows.impl.ts`

## Goal

The initial version lives as a vendored module in `confect-workflow`, can be imported into the `confect` folder to define workflows alongside normal Confect functions, is covered by Vitest tests in `confect-workflow/test`, and is wired into the example app so the workflow can be exercised manually from the frontend.
