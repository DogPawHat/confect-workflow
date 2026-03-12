/// <reference types="vite/client" />

import { WorkflowManager, type WorkflowId } from "@convex-dev/workflow";
import { Effect, Schema } from "effect";
import {
  type FunctionReference,
  componentsGeneric,
  internalMutationGeneric,
  internalQueryGeneric,
  makeFunctionReference,
} from "convex/server";
import { v } from "convex/values";
import { bindWorkflow, defineEvent } from "../../src/index.js";

type WorkflowComponent = ConstructorParameters<typeof WorkflowManager>[0];

const components = componentsGeneric() as unknown as {
  workflow: WorkflowComponent;
};

const adapter = bindWorkflow(components.workflow);

const helloWorkflowDefinition = adapter.define({
  args: Schema.Struct({
    name: Schema.String,
  }),
  returns: Schema.String,
  handler: (_workflow, args) => Effect.succeed(`Hello, ${args.name}!`),
});
const helloApprovalEvent = defineEvent({
  name: "hello/approved",
  payload: Schema.Struct({
    greeting: Schema.String,
  }),
});
const waitingHelloWorkflowDefinition = adapter.define({
  args: Schema.Struct({
    name: Schema.String,
  }),
  returns: Schema.String,
  handler: (workflow, args) =>
    workflow
      .awaitEvent(helloApprovalEvent)
      .pipe(Effect.map((event) => `${event.greeting}, ${args.name}!`)),
});
const helloWorkflowReference = makeFunctionReference<
  "mutation",
  {
    fn: "You should not call this directly, call workflow.start instead";
    args: {
      name: string;
    };
  },
  string
>("hello:helloWorkflow") as unknown as FunctionReference<"mutation", "internal">;
const waitingHelloWorkflowReference = makeFunctionReference<
  "mutation",
  {
    fn: "You should not call this directly, call workflow.start instead";
    args: {
      name: string;
    };
  },
  string
>("hello:waitingHelloWorkflow") as unknown as FunctionReference<"mutation", "internal">;

export const helloWorkflow = helloWorkflowDefinition.mutation;
export const waitingHelloWorkflow = waitingHelloWorkflowDefinition.mutation;

export const startHello = internalMutationGeneric({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    return await Effect.runPromise(
      adapter.start(ctx, helloWorkflowDefinition, helloWorkflowReference, args),
    );
  },
});

export const getHelloStatus = internalQueryGeneric({
  args: {
    workflowId: v.string(),
  },
  handler: async (ctx, args) => {
    return await Effect.runPromise(
      adapter.status(ctx, helloWorkflowDefinition, args.workflowId as WorkflowId),
    );
  },
});

export const startWaitingHello = internalMutationGeneric({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    return await Effect.runPromise(
      adapter.start(ctx, waitingHelloWorkflowDefinition, waitingHelloWorkflowReference, args),
    );
  },
});

export const getWaitingHelloStatus = internalQueryGeneric({
  args: {
    workflowId: v.string(),
  },
  handler: async (ctx, args) => {
    return await Effect.runPromise(
      adapter.status(ctx, waitingHelloWorkflowDefinition, args.workflowId as WorkflowId),
    );
  },
});

export const sendWaitingHelloApproval = internalMutationGeneric({
  args: {
    workflowId: v.string(),
    greeting: v.string(),
  },
  handler: async (ctx, args) => {
    return await Effect.runPromise(
      adapter.sendEvent(ctx, {
        workflowId: args.workflowId as WorkflowId,
        event: helloApprovalEvent,
        value: {
          greeting: args.greeting,
        },
      }),
    );
  },
});

export const getFailingHelloStatus = internalQueryGeneric({
  args: {
    workflowId: v.string(),
  },
  handler: async (ctx, args) => {
    return await Effect.runPromise(
      adapter.status(ctx, helloWorkflowDefinition, args.workflowId as WorkflowId),
    );
  },
});

export const cancelHello = internalMutationGeneric({
  args: {
    workflowId: v.string(),
  },
  handler: async (ctx, args) => {
    await Effect.runPromise(adapter.cancel(ctx, args.workflowId as WorkflowId));
  },
});

export const restartFailingHello = internalMutationGeneric({
  args: {
    workflowId: v.string(),
  },
  handler: async (ctx, args) => {
    await Effect.runPromise(adapter.restart(ctx, args.workflowId as WorkflowId));
  },
});

export const cleanupHello = internalMutationGeneric({
  args: {
    workflowId: v.string(),
  },
  handler: async (ctx, args) => {
    return await Effect.runPromise(adapter.cleanup(ctx, args.workflowId as WorkflowId));
  },
});
