# Research Brief: Effect-Friendly Confect Bindings over Convex Workflow

## Objectives

1. Enable Convex Workflow to be used ergonomically from Confect code.
2. Make the workflow authoring experience **Effect-native**, not Promise-first.
3. Preserve the existing `@convex-dev/workflow` durable execution model rather than reimplementing it.
4. Keep the integration package as a **normal TypeScript package**, not a new Convex component.
5. Fit the design into Confect's existing mental model: **spec/impl + generated services + Effect layers**.
6. Give Codex enough direction to implement a first pass without accidentally creating a second workflow runtime.

## Requirements

### Packaging and installation

- The package should **not** be a Convex component.
- Users should install and register the existing Convex Workflow component in `convex/convex.config.ts` using the normal Convex component flow.
- The new package should live on the Confect side and wrap the installed workflow component with an Effect-friendly interface.
- The package should work with Confect's generated `components.workflow` reference rather than owning component lifecycle itself.

### Runtime architecture

- Reuse the durable runtime already provided by `@convex-dev/workflow`.
- Do not fork or duplicate Workflow's journal, step execution, event waiting, restart, cancel, cleanup, or status logic unless there is no alternative.
- The main Promise boundary should remain at the outer Convex function boundary; the workflow body itself should be authored as `Effect`.
- The integration should provide **Effect services / layers** inside workflow execution.

### Confect alignment

- The Confect-facing API should feel like Confect, not like a wrapped async manager with `Effect.promise(...)` added ad hoc.
- The design should respect Confect's spec/impl model, where specs declare interfaces and impls are built from layers.
- The package should use Effect tags / services / layers for workflow capabilities where possible.
- The package should avoid leaking low-level implementation details into service interfaces when layers can hide them.

### Workflow authoring

- Workflow bodies should be written in `Effect.gen(...)` or other normal Effect style.
- Workflow step primitives should be effectful equivalents of Workflow's existing capabilities:
  - `runQuery`
  - `runMutation`
  - `runAction`
  - `runWorkflow`
  - `awaitEvent`
  - access to `workflowId`
- Parallel workflow steps should compose naturally via Effect combinators rather than `Promise.all`.

### Non-goals for v1

- Do not replace the underlying Workflow component.
- Do not try to turn Workflow itself into a new component managed by Confect.
- Do not expose a raw, unopinionated manager-only wrapper and call that the final design.
- Do not make workflow handlers directly depend on arbitrary raw Convex context unless there is a very strong reason.

---

## Insights That Should Steer the Design

### 1. The package boundary should be a normal library over the existing component

This is the most important packaging decision.

Confect's own docs say Convex components are configured in `convex/convex.config.ts`, and that this file is one of the `convex/` files Confect does **not** manage. It explicitly tells users to configure and use components using the vanilla Convex API. That strongly supports the design direction of:

- installing Workflow normally in `convex/convex.config.ts`
- importing a helper from this new package in `confect/`
- wrapping the generated `components.workflow` reference there

This means the new work should be a **Confect integration package**, not a second component.

**Implication:** the package should feel like `@confect/workflow` or similar, and should accept `components.workflow` from the app's generated API.

### 2. Confect's main value is not just bindings; it is its service and spec/impl model

Confect is not just "Effect wrappers for Convex APIs." Its docs frame it around:

- spec/impl separation
- generated Effect services
- writing function implementations as `Effect`
- providing capabilities through layers

That means a thin wrapper around `new WorkflowManager(components.workflow)` is probably **insufficient** as the long-term public API.

A manager wrapper may still exist internally, but the public surface should be designed to feel native to Confect.

**Implication:** the package should likely expose both:

1. a control-plane API for starting / canceling / checking status / restarting workflows
2. Effect services for code running *inside* a workflow body

### 3. Workflow already has the durable runtime; the new package should adapt the authoring model, not rebuild execution

Convex Workflow already provides the durable execution behavior that matters:

- long-running durable workflows
- survival across restarts
- step retries
- delays and scheduled steps
- workflow status / cancel / restart / cleanup
- event waiting and delivery

The integration package should therefore avoid rebuilding the workflow runtime. The most promising approach is to adapt the **handler boundary** and the **step API surface**, not the storage/execution internals.

**Implication:** prefer an adapter architecture over a rewrite.

### 4. Workflow's authoring surface is Promise-based today

Workflow's documented step API is async/await oriented, with examples showing:

- `step.runQuery(...)`
- `step.runMutation(...)`
- `step.runAction(...)`
- `step.runWorkflow(...)`
- `ctx.awaitEvent(...)`
- parallelism through `Promise.all(...)`

The package exists precisely because the desired workflow authoring style is different: handlers should be **Effect values**, not Promise-returning functions.

**Implication:** the package should define a new effectful surface instead of asking users to manually wrap every workflow step with `Effect.promise`.

### 5. Effect wants a single outer runtime boundary, which fits the adapter approach well

Effect docs recommend running effects at the outermost boundary, typically via `Effect.runPromise(...)` or `Effect.runFork(...)`.

Confect's own server implementation follows this pattern already: it builds layers for Convex capabilities, decodes args, runs the handler effect, encodes the return value, and finally uses `Effect.runPromise` at the Convex handler boundary.

This is a very good fit for the Workflow integration:

- decode args at the Convex/workflow boundary
- provide workflow services as layers
- run the workflow body effect with `Effect.runPromise(...)`

**Implication:** the package should not attempt to make Convex or Workflow itself natively understand Effect; it should preserve one clean outer boundary.

### 6. Confect's services model is the natural place to expose workflow capabilities

Confect already exposes Effect services for Convex capabilities like:

- `QueryRunner`
- `MutationRunner`
- `ActionRunner`
- `DatabaseReader`
- `DatabaseWriter`
- `Scheduler`
- raw `QueryCtx`, `MutationCtx`, `ActionCtx`

This strongly suggests that workflow integration should follow the same shape.

A plausible design is a dedicated `WorkflowStep` service (or a small set of services) provided only while a workflow body is running.

Possible capabilities:

- `workflowId`
- `runQuery`
- `runMutation`
- `runAction`
- `runWorkflow`
- `awaitEvent`

**Implication:** a service-oriented design is a better fit than a callback-style wrapper.

### 7. Workflow step APIs are richer than Confect's current function runners

Confect's current `QueryRunner` / `MutationRunner` / `ActionRunner` model is essentially:

- take a function ref
- encode args
- invoke Convex
- decode the return value
- return an `Effect`

That is a useful pattern, but Workflow step calls also need step-specific options such as:

- step name
- scheduling options
- retry behavior
- workflow nesting
- event waiting

So Workflow cannot be modeled as "just reuse the current runners unchanged." It needs a richer workflow-specific service surface.

**Implication:** create dedicated workflow services rather than forcing Workflow concepts into the existing runner interfaces.

### 8. Confect's `Scheduler` service provides a strong hint for the preferred API shape

Confect's scheduling docs already wrap Convex scheduling using Effect-native types:

- `Duration` for delays
- `DateTime` for timestamps

That is a strong precedent.

Workflow step options currently use scheduling data in the Workflow runtime. The new package should likely mirror Confect's existing style and accept `Duration` / `DateTime` in the public API, converting internally to Workflow's scheduling format.

**Implication:** public step options should be Effect-native where practical.

### 9. The package probably needs two distinct surfaces: control plane vs in-workflow services

There are really two different usage contexts:

#### A. Outside a workflow body

Regular Confect functions may need to:

- define workflows
- start workflows
- cancel workflows
- query status
- restart failed workflows
- send events
- clean up storage

This is a control-plane API.

#### B. Inside a workflow body

Workflow logic itself needs step-local execution primitives:

- run a query step
- run a mutation step
- run an action step
- run a child workflow
- await an event
- access workflow metadata

This is a step-local service environment.

**Implication:** do not try to force both concerns into one object.

### 10. A manager wrapper alone is not enough, but a manager wrapper is still useful internally

The user's proposed direction is right on packaging, but there is one important pushback:

A package that simply says "here is a wrapped `WorkflowManager`" will probably feel foreign inside Confect.

However, a manager-style wrapper can still be the right *implementation substrate* for the control plane. The missing part is that the package should also provide the Effect-native workflow authoring surface.

**Implication:** use the existing Workflow manager where useful, but do not expose only that.

### 11. Parallelism should become `Effect.all(...)`, not `Promise.all(...)`

Workflow docs currently show running steps in parallel with `Promise.all(...)`.

In an Effect-native package, the natural equivalent is building multiple workflow step effects and combining them with `Effect.all(...)` or related concurrency combinators.

This is not just aesthetic:

- it matches the rest of Confect
- it enables richer Effect composition later
- it avoids sending the message that users should keep dropping down to raw Promises inside workflow logic

**Implication:** examples and docs for the package should demonstrate Effect concurrency rather than Promise concurrency.

### 12. The package should avoid leaking lower-level dependencies into workflow service interfaces

Effect's docs on services and layers are clear: if a service depends on other services or machinery, that should generally be handled through layers rather than exposed in the service interface.

This matters here because a workflow step service may internally depend on:

- the underlying Workflow sender/channel
- Workflow step context
- Confect function refs / encoders / decoders
- scheduling conversion helpers
- parse/validation machinery

Users should not need to care.

**Implication:** hide the implementation graph behind layers.

### 13. A first pass should likely prefer a dedicated workflow service over exposing raw Convex ctx inside workflows

Confect exposes raw `QueryCtx`, `MutationCtx`, and `ActionCtx` in the corresponding function environments.

That does **not** automatically mean raw context should be provided inside workflow bodies. A workflow handler is a different environment with durability constraints and step semantics. Exposing raw context too eagerly could blur the difference between:

- durable workflow steps
- immediate non-durable platform calls

A safer v1 is to expose only workflow-safe step-backed capabilities unless a strong use case demands more.

**Implication:** start with a narrow, explicit workflow service surface.

### 14. There is a credible implementation path that stays small

The package does not need to change every layer of either project.

A realistic first implementation can likely be built by:

1. accepting a Workflow component reference
2. providing a wrapper for workflow definition / control operations
3. creating a workflow-specific service layer for handler execution
4. running the effectful handler with `Effect.runPromise(...)` at the outer boundary
5. encoding/decoding args and returns similarly to Confect's existing server runtime

That is important because it means the work is substantial but not enormous.

**Implication:** this looks implementable as an incremental package rather than a large fork.

---

## Recommended Design Direction

### Package shape

A likely package shape is:

```ts
import { makeWorkflowBindings } from "@confect/workflow";
import { components } from "../convex/_generated/api";

export const workflow = makeWorkflowBindings(components.workflow);
```

This package should be imported from the `confect/` side, while Workflow itself remains installed in `convex/convex.config.ts`.

### Public surface

The package should probably expose:

#### 1. Control-plane bindings

Something like:

- `define(...)`
- `start(...)`
- `cancel(...)`
- `status(...)`
- `restart(...)`
- `cleanup(...)`
- `sendEvent(...)`

#### 2. In-workflow services

Something like a `WorkflowStep` service with methods such as:

- `workflowId`
- `runQuery(ref, args, opts?)`
- `runMutation(ref, args, opts?)`
- `runAction(ref, args, opts?)`
- `runWorkflow(ref, args, opts?)`
- `awaitEvent(event)`

### Public option style

Prefer Effect-native options where it improves ergonomics and matches Confect precedent:

- delay options as `Duration`
- timestamps as `DateTime`
- a structured step options type

### Internal strategy

Internally, the package can:

- delegate workflow orchestration to the existing Workflow runtime
- reuse Confect-style schema encode/decode at the boundary
- construct workflow services via layers
- run the workflow body with one outer `Effect.runPromise(...)`

---

## Suggested v1 API Sketch

This is not final API design. It is a sketch to anchor implementation.

```ts
import { Context, DateTime, Duration, Effect } from "effect";

export class WorkflowStep extends Context.Tag("@confect/workflow/WorkflowStep")<
  WorkflowStep,
  {
    readonly workflowId: string;

    readonly runQuery: <Ref>(
      ref: Ref,
      args: unknown,
      opts?: {
        name?: string;
        runAfter?: Duration.Duration;
        runAt?: DateTime.DateTime;
      },
    ) => Effect.Effect<unknown, unknown>;

    readonly runMutation: <Ref>(
      ref: Ref,
      args: unknown,
      opts?: {
        name?: string;
        runAfter?: Duration.Duration;
        runAt?: DateTime.DateTime;
      },
    ) => Effect.Effect<unknown, unknown>;

    readonly runAction: <Ref>(
      ref: Ref,
      args: unknown,
      opts?: {
        name?: string;
        retry?: boolean | {
          maxAttempts: number;
          initialBackoffMs: number;
          base?: number;
        };
        runAfter?: Duration.Duration;
        runAt?: DateTime.DateTime;
      },
    ) => Effect.Effect<unknown, unknown>;

    readonly runWorkflow: <Ref>(
      ref: Ref,
      args: unknown,
      opts?: {
        name?: string;
        runAfter?: Duration.Duration;
        runAt?: DateTime.DateTime;
      },
    ) => Effect.Effect<unknown, unknown>;

    readonly awaitEvent: <A>(event: {
      name?: string;
      id?: string;
      schema?: unknown;
    }) => Effect.Effect<A, unknown>;
  }
>() {}
```

And a definition helper along these lines:

```ts
const myWorkflow = workflow.define({
  name: "myWorkflow",
  args: Schema.Struct({ userId: Users.Id }),
  returns: Schema.Struct({ ok: Schema.Boolean }),
  handler: ({ userId }) =>
    Effect.gen(function* () {
      const step = yield* WorkflowStep;

      const profile = yield* step.runQuery(api.users.getProfile, { userId });

      const [a, b] = yield* Effect.all([
        step.runAction(api.jobs.doOneThing, { userId }),
        step.runAction(api.jobs.doAnotherThing, { userId }),
      ]);

      yield* step.runMutation(api.audit.logWorkflowResult, {
        userId,
        a,
        b,
      });

      return { ok: true };
    }),
});
```

---

## Risks and Failure Modes to Watch

1. **Accidentally rebuilding Workflow internals**
   - This would increase maintenance cost sharply.
   - Prefer delegation wherever possible.

2. **Exposing too much raw Convex context inside workflows**
   - This could undercut durability semantics and blur safe usage boundaries.

3. **Making the public API too manager-centric**
   - This would make the package feel unlike the rest of Confect.

4. **Trying to squeeze Workflow into existing runner interfaces unchanged**
   - Workflow steps have richer semantics than plain function invocation.

5. **Over-designing v1 around full codegen integration before proving the runtime model**
   - It may be better to land a solid runtime + service model first.

---

## Questions Still To Answer

### API and product questions

1. Should workflows become first-class citizens in Confect's spec/impl model, or should v1 stay as a lighter integration that is adjacent to spec/impl rather than fully generated from it?
2. What should a workflow reference look like from the Confect side?
3. Should `workflow.define(...)` produce something that integrates with Confect's existing ref/codegen patterns, or is an internal Convex workflow ref enough for v1?
4. What should the naming and import ergonomics be: `@confect/workflow`, `@confect/server/workflow`, or something else?

### Service-surface questions

5. Should there be one `WorkflowStep` service or several smaller services such as `WorkflowQueryRunner`, `WorkflowMutationRunner`, `WorkflowActionRunner`, and `WorkflowEvents`?
6. Should the in-workflow services reuse Confect function refs directly, or accept native Convex refs, or both?
7. Should raw Convex context be available inside workflow handlers at all?
8. Should direct database/storage services be intentionally omitted inside workflow bodies in v1?

### Type and schema questions

9. How should `awaitEvent` validation be modeled: Effect `Schema`, Convex validator, or both?
10. How should workflow return schemas be declared and encoded so they align with both Confect and Workflow expectations?
11. How should parse / decode failures surface in error channels: typed errors, defects via `orDie`, or package-specific error wrappers?

### Scheduling and options questions

12. Should scheduling options in the public API be Effect-native (`Duration`, `DateTime`) everywhere, with internal conversion to Workflow scheduler options?
13. Should retry behavior mirror Workflow's existing shape exactly, or should the package introduce a more Effect-friendly alias layer?
14. How much of Workflow's step option surface should be in v1 versus added later?

### Control-plane questions

15. Which control-plane operations are required in v1: just `define` and `start`, or also `status`, `cancel`, `restart`, `cleanup`, and `sendEvent`?
16. Should those operations be plain methods returning `Effect`, standalone services, or both?
17. How should restart-from-step addressing be modeled in a type-safe way?

### Implementation questions

18. Where exactly should the package hook into Workflow's handler execution path?
19. Can the adapter layer be implemented without patching Workflow upstream, or is a small upstream extension point needed?
20. Does v1 need a managed runtime abstraction, or is a direct `Effect.runPromise(...)` boundary enough?
21. What is the minimum viable test matrix for confidence:
   - simple workflow
   - nested workflow
   - parallel steps
   - retries
   - scheduled steps
   - event waiting
   - cancel / restart
   - schema decode failures

---

## Practical Recommendation for the First Implementation

If the goal is to get a useful first version into Codex quickly, the most practical path is:

1. Build a **normal package** that accepts an installed Workflow component reference.
2. Implement a **control-plane wrapper** first.
3. Implement a **workflow execution layer** that provides a `WorkflowStep` Effect service.
4. Keep the workflow body Effect-native and terminate it with one outer `Effect.runPromise(...)`.
5. Do **not** expose raw DB or raw Convex ctx inside workflow handlers in v1 unless forced by a concrete use case.
6. Prefer `Duration` / `DateTime` in the public API where scheduling is exposed.
7. Delay deeper codegen/spec integration until the runtime and service surface feel correct.

This should produce a package that is:

- aligned with Confect
- respectful of Workflow's durability model
- small enough to maintain
- good enough to iterate on

---

## Sources Consulted

1. Confect introduction: <https://confect.dev/getting-started/introduction>
2. Confect components docs: <https://confect.dev/server/components>
3. Confect spec/impl model: <https://confect.dev/concepts/spec-impl-model>
4. Confect services docs: <https://confect.dev/concepts/services>
5. Confect scheduling docs: <https://confect.dev/server/scheduling>
6. Convex Workflow repository/docs: <https://github.com/get-convex/workflow>
7. Workflow source (`workflowContext.ts`): <https://raw.githubusercontent.com/get-convex/workflow/main/src/client/workflowContext.ts>
8. Effect services docs: <https://effect.website/docs/requirements-management/services/>
9. Effect layers docs: <https://effect.website/docs/requirements-management/layers/>
10. Effect runtime / running effects docs: <https://effect.website/docs/getting-started/running-effects/>
11. Confect server source (`RegisteredConvexFunction.ts`): <https://raw.githubusercontent.com/rjdellecese/confect/main/packages/server/src/RegisteredConvexFunction.ts>
12. Confect server source (`QueryRunner.ts`): <https://raw.githubusercontent.com/rjdellecese/confect/main/packages/server/src/QueryRunner.ts>
