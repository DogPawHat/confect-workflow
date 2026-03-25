# confect-workflow

`confect-workflow` integrates `@convex-dev/workflow` with Confect and Effect.

It keeps workflows inside the normal Confect spec/impl pipeline:

- define workflows with Effect handlers
- use `effect/Schema` for workflow args and returns
- register workflows as normal Confect internal mutations
- start and manage workflows from normal Confect functions

## Requirements

- `@convex-dev/workflow` installed in your Convex app
- a Confect project using the usual spec/impl structure
- workflow args and returns defined with `effect/Schema`

Enable the Convex workflow component in `convex/convex.config.ts`:

```ts
import workflow from "@convex-dev/workflow/convex.config.js";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(workflow);

export default app;
```

## Entry Points

The package mirrors Confect's split between spec and implementation code.

### `confect-workflow/spec`

Use this only from `*.spec.ts` files.

- depends on spec-side Confect concepts
- keeps workflow registration in the normal `GroupSpec` flow
- does not expose runtime services

Exports:

- `workflowSpec({ name, args, returns })`
- `WorkflowFunctionSpec` type
- `WorkflowMutation` type

### `confect-workflow/server`

Use this from workflow definitions and `*.impl.ts` files.

- defines workflows
- exposes runtime services for workflow handlers
- exposes workflow manager services for query and mutation call sites

Exports:

- `defineWorkflow(...)`
- `WorkflowContext`
- `WorkflowManagerRequiresMutation`
- `WorkflowManagerRequiresQuery`
- `makeWorkflowManagerLayers(...)`

## Usage

### 1. Define the workflow

```ts
import { Effect, Schema } from "effect";
import { api, components } from "../convex/_generated/api";
import { defineWorkflow, WorkflowContext } from "confect-workflow/server";
import { generateTaggedNote } from "./workflows.spec";

export const generateTaggedNoteWorkflow = defineWorkflow(components.workflow, generateTaggedNote, {
  handler: ({ text }) =>
    Effect.gen(function* () {
      const ctx = yield* WorkflowContext;

      yield* ctx.runMutation(api.notesAndRandom.notes.insert, { text });
      yield* ctx.awaitEvent({ name: "approval" });

      return null;
    }),
});
```

`defineWorkflow(...)` creates the upstream workflow mutation from a workflow spec and preserves schema-aware behavior at the wrapper boundary.

### 2. Add it to your Confect spec

```ts
import { GroupSpec } from "@confect/core";
import { Schema } from "effect";
import { workflowSpec } from "confect-workflow/spec";

export const generateTaggedNote = workflowSpec({
  name: "generateTaggedNote",
  args: Schema.Struct({ text: Schema.String }),
  returns: Schema.Null,
});

export const workflows = GroupSpec.make("workflows").addFunction(generateTaggedNote);
```

`workflowSpec(...)` is the spec-side source of truth. It keeps workflow registration aligned with normal Confect spec composition without importing runtime workflow code into the client-visible spec.

### 3. Register it and start it from server code

```ts
import { FunctionImpl } from "@confect/server";
import { Effect } from "effect";
import { components } from "../convex/_generated/api";
import api from "./_generated/api";
import refs from "./_generated/refs";
import {
  makeWorkflowManagerLayers,
  WorkflowManagerRequiresMutation,
} from "confect-workflow/server";
import { generateTaggedNoteWorkflow } from "./workflows";

const workflowManagerLayers = makeWorkflowManagerLayers(components.workflow);

export const generateTaggedNoteImpl = FunctionImpl.make(
  api,
  "workflows",
  "generateTaggedNote",
  generateTaggedNoteWorkflow,
);

export const startGenerateTaggedNote = FunctionImpl.make(
  api,
  "workflows",
  "startGenerateTaggedNote",
  ({ text }) =>
    Effect.gen(function* () {
      const workflowManager = yield* WorkflowManagerRequiresMutation;
      return yield* workflowManager.start(refs.internal.workflows.generateTaggedNote, { text });
    }).pipe(Effect.provide(workflowManagerLayers.mutationLayer), Effect.orDie),
);
```

## Runtime Services

`WorkflowContext` is available inside workflow handlers and exposes:

- `workflowId`
- `runQuery`
- `runMutation`
- `runAction`
- `runWorkflow`
- `awaitEvent`

`WorkflowManagerRequiresMutation` exposes:

- `start`
- `restart`
- `cleanup`
- `sendEvent`
- `createEvent`

`WorkflowManagerRequiresQuery` exposes:

- `status`
- `list`
- `listByName`
- `listSteps`

The wrapper encodes and decodes workflow args and returns with Effect Schema at the workflow boundary.

## Structure

Recommended layout:

- `confect/workflows.spec.ts` for `workflowSpec(...)`
- `confect/workflows.ts` for workflow definitions that consume the spec
- `confect/workflows.impl.ts` for `FunctionImpl.make(...)` and workflow manager usage

This is the same pattern used in the example app:

- [apps/example/confect/workflows.ts](/home/dogpawhat/Development/confect-workflow-workspace/confect-workflow/apps/example/confect/workflows.ts)
- [apps/example/confect/workflows.spec.ts](/home/dogpawhat/Development/confect-workflow-workspace/confect-workflow/apps/example/confect/workflows.spec.ts)
- [apps/example/confect/workflows.impl.ts](/home/dogpawhat/Development/confect-workflow-workspace/confect-workflow/apps/example/confect/workflows.impl.ts)

## Development

```bash
vp install
vp test
vp pack
```
