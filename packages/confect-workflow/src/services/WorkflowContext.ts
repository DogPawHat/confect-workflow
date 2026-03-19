import { Ref } from "@confect/core";
import type { WorkflowCtx, WorkflowId } from "@convex-dev/workflow";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
  FunctionVisibility,
} from "convex/server";
import { makeFunctionReference } from "convex/server";
import { Context, Effect, Layer, Schema } from "effect";
import { getWorkflowMetadataFromRef } from "../internal/workflowMetadata";

export interface WorkflowContextShape {
  readonly workflowId: WorkflowId;

  readonly runQuery: {
    <Query extends Ref.AnyQuery>(
      query: Query,
      args: Ref.Args<Query>,
    ): Effect.Effect<Ref.Returns<Query>>;
    <Query extends FunctionReference<"query", FunctionVisibility>>(
      query: Query,
      args: FunctionArgs<Query>["args"],
    ): Effect.Effect<FunctionReturnType<Query>>;
  };

  readonly runMutation: {
    <Mutation extends Ref.AnyMutation>(
      mutation: Mutation,
      args: Ref.Args<Mutation>,
    ): Effect.Effect<Ref.Returns<Mutation>>;
    <Mutation extends FunctionReference<"mutation", FunctionVisibility>>(
      mutation: Mutation,
      args: FunctionArgs<Mutation>["args"],
    ): Effect.Effect<FunctionReturnType<Mutation>>;
  };

  readonly runAction: {
    <Action extends Ref.AnyAction>(
      action: Action,
      args: Ref.Args<Action>,
    ): Effect.Effect<Ref.Returns<Action>>;
    <Action extends FunctionReference<"action", FunctionVisibility>>(
      action: Action,
      args: FunctionArgs<Action>["args"],
    ): Effect.Effect<FunctionReturnType<Action>>;
  };

  readonly runWorkflow: <Workflow extends Ref.AnyMutation>(
    workflow: Workflow,
    args: Ref.Args<Workflow>,
  ) => Effect.Effect<Ref.Returns<Workflow>>;

  readonly awaitEvent: <T = unknown, Name extends string = string>(event: {
    name: Name;
  }) => Effect.Effect<T>;
}

export class WorkflowContext extends Context.Tag("confect-workflow/src/WorkflowContext")<
  WorkflowContext,
  WorkflowContextShape
>() {
  static make = (ctx: WorkflowCtx) =>
    Layer.succeed(WorkflowContext, {
      workflowId: ctx.workflowId,

      runQuery: (
        query: Ref.AnyQuery | FunctionReference<"query", FunctionVisibility>,
        args: unknown,
      ) => bridgeFunction(ctx, "runQuery", query, args),

      runMutation: (
        mutation: Ref.AnyMutation | FunctionReference<"mutation", FunctionVisibility>,
        args: unknown,
      ) => bridgeFunction(ctx, "runMutation", mutation, args),

      runAction: (
        action: Ref.AnyAction | FunctionReference<"action", FunctionVisibility>,
        args: unknown,
      ) => bridgeFunction(ctx, "runAction", action, args),

      runWorkflow: (workflow, args) => bridgeWorkflowRef(ctx, workflow, args),

      awaitEvent: (event) => Effect.promise(() => ctx.awaitEvent(event)) as any,
    });

  static readonly layer = WorkflowContext.make;
}

export const layer = WorkflowContext.make;

const bridgeRef = <Ref_ extends Ref.Any>(
  ctx: WorkflowCtx,
  method: "runQuery" | "runMutation" | "runAction",
  ref: Ref_,
  args: Ref.Args<Ref_>,
): Effect.Effect<Ref.Returns<Ref_>> => {
  const functionSpec = Ref.getFunctionSpec(ref);
  const functionName = Ref.getConvexFunctionName(ref);
  const functionRef = makeFunctionReference(functionName) as any;
  const provenance = functionSpec.functionProvenance;

  if (provenance._tag !== "Confect") {
    return Effect.promise(() => (ctx as any)[method](functionRef, args)) as Effect.Effect<
      Ref.Returns<Ref_>
    >;
  }

  return Schema.encode(provenance.args)(args).pipe(
    Effect.orDie,
    Effect.andThen((encodedArgs) =>
      Effect.promise(() => (ctx as any)[method](functionRef, encodedArgs)),
    ),
    Effect.andThen((encodedReturns) =>
      Schema.decode(provenance.returns)(encodedReturns).pipe(Effect.orDie),
    ),
  ) as Effect.Effect<Ref.Returns<Ref_>>;
};

const bridgeFunction = (
  ctx: WorkflowCtx,
  method: "runQuery" | "runMutation" | "runAction",
  ref: Ref.Any | FunctionReference<any, any>,
  args: unknown,
) => {
  const functionName = Ref.getConvexFunctionName(ref as Ref.Any);

  if (typeof functionName !== "string") {
    return Effect.promise(() => (ctx as any)[method](ref, args as any));
  }

  return bridgeRef(ctx, method, ref as Ref.Any, args as any);
};

const bridgeWorkflowRef = <Workflow extends Ref.AnyMutation>(
  ctx: WorkflowCtx,
  workflow: Workflow,
  args: Ref.Args<Workflow>,
): Effect.Effect<Ref.Returns<Workflow>> => {
  const functionName = Ref.getConvexFunctionName(workflow);
  const functionRef = makeFunctionReference<"mutation">(functionName) as any;
  const workflowMetadata = getWorkflowMetadataFromRef(workflow);

  return Schema.encode(workflowMetadata.args)(args).pipe(
    Effect.orDie,
    Effect.andThen((encodedArgs) =>
      Effect.promise(() => ctx.runWorkflow(functionRef, encodedArgs)),
    ),
    Effect.andThen((encodedReturns) =>
      Schema.decode(workflowMetadata.returns)(encodedReturns).pipe(Effect.orDie),
    ),
  ) as Effect.Effect<Ref.Returns<Workflow>>;
};
