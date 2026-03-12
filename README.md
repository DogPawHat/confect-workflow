# confect-workflow

Effect-native adapter bindings for an already-installed `@convex-dev/workflow` component.

This package does not replace the Workflow runtime. It binds to your generated workflow component reference and gives you:

- `define(...)` for Effect-based workflow handlers
- `start(...)` to start workflows from Confect/Convex server code
- `status(...)`, `cancel(...)`, `restart(...)`, and `cleanup(...)`
- `sendEvent(...)` for resuming workflows waiting on external events
- a workflow runtime with `workflowId`, `runQuery`, `runMutation`, `runAction`, `runChildWorkflow`, and `awaitEvent`

## Status

The current implementation covers:

- simple workflow definition and execution
- typed query and mutation workflow steps
- typed action and child-workflow steps
- event waiting and event sending
- scheduling and retry option translation
- workflow status, cancel, restart, and cleanup operations

## Install

This repo uses `pnpm`.

```bash
pnpm add effect
pnpm add convex @convex-dev/workflow
```

Your Convex app must already have the Workflow component installed and generated.

## Basic usage

```ts
import { Effect, Schema } from "effect";
import { bindWorkflow, defineEvent } from "confect-workflow";

const adapter = bindWorkflow(components.workflow);

const approvalEvent = defineEvent({
  name: "hello/approved",
  payload: Schema.Struct({
    greeting: Schema.String,
  }),
});

const helloWorkflow = adapter.define({
  args: Schema.Struct({
    name: Schema.String,
  }),
  returns: Schema.String,
  handler: (workflow, args) =>
    workflow.awaitEvent(approvalEvent).pipe(
      Effect.map((event) => `${event.greeting}, ${args.name}!`),
    ),
});
```

Start and manage it from Convex server code:

```ts
await Effect.runPromise(
  adapter.start(ctx, helloWorkflow, helloWorkflowReference, {
    name: "Ada",
  }),
);

await Effect.runPromise(adapter.status(ctx, helloWorkflow, workflowId));
await Effect.runPromise(adapter.cancel(ctx, workflowId));
await Effect.runPromise(adapter.restart(ctx, workflowId));
await Effect.runPromise(adapter.cleanup(ctx, workflowId));

await Effect.runPromise(
  adapter.sendEvent(ctx, {
    workflowId,
    event: approvalEvent,
    value: { greeting: "Welcome" },
  }),
);
```

## Manual testing

The quickest reference is [test/fixtures/hello.ts](./test/fixtures/hello.ts). It shows the current end-to-end shape for:

- binding `components.workflow`
- defining workflows
- starting workflows
- checking status
- sending an event
- cancel, restart, and cleanup

Useful commands in this repo:

```bash
pnpm test
pnpm typecheck
```

For local manual testing in a real Convex app, mirror the fixture module structure from `test/fixtures/hello.ts` inside your app, then:

1. Start a simple workflow and verify `status(...)` returns `completed`.
2. Start the waiting workflow, verify it remains `inProgress`, then send the event and confirm completion.
3. Start a long-running workflow and verify `cancel(...)`.
4. Verify `restart(...)` on a failed workflow.
5. Verify `cleanup(...)` after cancellation or completion.

## Current gaps

The package is implemented and tested, but the current test suite is still light on:

- schema failure-path coverage
- end-to-end retry semantics
- end-to-end scheduled execution semantics

Those are good candidates for follow-up work after manual testing.
