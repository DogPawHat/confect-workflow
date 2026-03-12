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
import { bindWorkflow } from "../../src/index.js";

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

export const helloWorkflow = helloWorkflowDefinition.mutation;

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
