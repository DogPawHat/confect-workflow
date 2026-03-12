import {
  WorkflowManager,
  type WorkflowId,
  type WorkflowStatus as ManagerWorkflowStatus,
} from "@convex-dev/workflow";
import { Effect, Schema } from "effect";
import type {
  FunctionReference,
  FunctionVisibility,
  GenericDataModel,
  GenericMutationCtx,
  GenericQueryCtx,
} from "convex/server";

type AnySchema = Schema.Schema.AnyNoContext;
type WorkflowMutation = ReturnType<WorkflowManager["define"]>;
type WorkflowSchemaType<SchemaType extends AnySchema> = Schema.Schema.Type<SchemaType>;
type WorkflowSchemaEncoded<SchemaType extends AnySchema> = Schema.Schema.Encoded<SchemaType>;
export type WorkflowStepDefinition<
  ArgsSchema extends AnySchema,
  ReturnsSchema extends AnySchema,
> = {
  readonly args: ArgsSchema;
  readonly returns: ReturnsSchema;
};
export type WorkflowEventDefinition<Name extends string, PayloadSchema extends AnySchema> = {
  readonly name: Name;
  readonly payload: PayloadSchema;
};
const hostProcess = typeof process === "undefined" ? undefined : process;
const hostDate = globalThis.Date;
const hostSetTimeout = globalThis.setTimeout;
const hostSetInterval = globalThis.setInterval;
export type WorkflowEventId = Awaited<ReturnType<WorkflowManager["sendEvent"]>>;

export type WorkflowRuntime = {
  readonly workflowId: WorkflowId;
  readonly runQuery: <
    Query extends FunctionReference<"query", FunctionVisibility>,
    ArgsSchema extends AnySchema,
    ReturnsSchema extends AnySchema,
  >(
    reference: Query,
    definition: WorkflowStepDefinition<ArgsSchema, ReturnsSchema>,
    args: WorkflowSchemaType<ArgsSchema>,
  ) => Effect.Effect<WorkflowSchemaType<ReturnsSchema>, Error>;
  readonly runMutation: <
    Mutation extends FunctionReference<"mutation", FunctionVisibility>,
    ArgsSchema extends AnySchema,
    ReturnsSchema extends AnySchema,
  >(
    reference: Mutation,
    definition: WorkflowStepDefinition<ArgsSchema, ReturnsSchema>,
    args: WorkflowSchemaType<ArgsSchema>,
  ) => Effect.Effect<WorkflowSchemaType<ReturnsSchema>, Error>;
  readonly awaitEvent: <Name extends string, PayloadSchema extends AnySchema>(
    event: WorkflowEventDefinition<Name, PayloadSchema>,
  ) => Effect.Effect<WorkflowSchemaType<PayloadSchema>, Error>;
};

export type WorkflowDefinitionInput<
  ArgsSchema extends AnySchema,
  ReturnsSchema extends AnySchema,
> = {
  readonly args: ArgsSchema;
  readonly returns: ReturnsSchema;
  readonly handler: (
    workflow: WorkflowRuntime,
    args: WorkflowSchemaType<ArgsSchema>,
  ) => Effect.Effect<WorkflowSchemaType<ReturnsSchema>, Error>;
};

export type DefinedWorkflow<ArgsSchema extends AnySchema, ReturnsSchema extends AnySchema> = {
  readonly args: ArgsSchema;
  readonly returns: ReturnsSchema;
  readonly mutation: WorkflowMutation;
  readonly encodeArgs: (args: WorkflowSchemaType<ArgsSchema>) => WorkflowSchemaEncoded<ArgsSchema>;
};
export type WorkflowStatus<ReturnsSchema extends AnySchema> =
  | Extract<ManagerWorkflowStatus, { type: "inProgress" }>
  | Extract<ManagerWorkflowStatus, { type: "canceled" }>
  | Extract<ManagerWorkflowStatus, { type: "failed" }>
  | {
      readonly type: "completed";
      readonly result: WorkflowSchemaType<ReturnsSchema>;
    };
export type WorkflowRestartOptions = NonNullable<Parameters<WorkflowManager["restart"]>[2]>;

export type WorkflowBindings = ReturnType<typeof bindWorkflow>;

type WorkflowComponent = ConstructorParameters<typeof WorkflowManager>[0];
type MutationCtx = GenericMutationCtx<GenericDataModel>;
type QueryCtx = GenericQueryCtx<GenericDataModel>;

function normalizeError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}

function runWorkflowEffect<A>(effect: Effect.Effect<A, Error>) {
  return Effect.runPromise(effect).catch((error) => {
    throw normalizeError(error);
  });
}

async function withHostWorkflowGlobals<A>(operation: () => Promise<A>) {
  const global = globalThis as Record<string, unknown>;
  const hadProcess = Object.prototype.hasOwnProperty.call(global, "process");
  const previousProcess = global.process;
  const previousDate = global.Date;
  const previousSetTimeout = global.setTimeout;
  const previousSetInterval = global.setInterval;

  if (hostProcess !== undefined) {
    global.process = hostProcess;
  }
  global.Date = hostDate;
  global.setTimeout = hostSetTimeout;
  global.setInterval = hostSetInterval;

  try {
    return await operation();
  } finally {
    if (hadProcess) {
      global.process = previousProcess;
    } else if (hostProcess === undefined) {
      delete global.process;
    } else {
      global.process = hostProcess;
    }
    global.Date = previousDate ?? hostDate;
    global.setTimeout = previousSetTimeout ?? hostSetTimeout;
    global.setInterval = previousSetInterval ?? hostSetInterval;
  }
}

function runStep<ArgsSchema extends AnySchema, ReturnsSchema extends AnySchema>(
  execute: (args: WorkflowSchemaEncoded<ArgsSchema>) => Promise<unknown>,
  definition: WorkflowStepDefinition<ArgsSchema, ReturnsSchema>,
  args: WorkflowSchemaType<ArgsSchema>,
) {
  const encodeArgs = Schema.encodeSync(definition.args);
  const decodeResult = Schema.decodeUnknownSync(definition.returns);

  return Effect.try({
    try: () => encodeArgs(args),
    catch: normalizeError,
  }).pipe(
    Effect.flatMap((encodedArgs) =>
      Effect.tryPromise({
        try: () => withHostWorkflowGlobals(() => execute(encodedArgs)),
        catch: normalizeError,
      }),
    ),
    Effect.flatMap((result) =>
      Effect.try({
        try: () => decodeResult(result),
        catch: normalizeError,
      }),
    ),
  );
}

type WorkflowStepExecutor = {
  readonly workflowId: WorkflowId;
  readonly runQuery: (
    reference: FunctionReference<"query", FunctionVisibility>,
    args: Record<string, unknown>,
  ) => Promise<unknown>;
  readonly runMutation: (
    reference: FunctionReference<"mutation", FunctionVisibility>,
    args: Record<string, unknown>,
  ) => Promise<unknown>;
  readonly awaitEvent: (event: { readonly name: string }) => Promise<unknown>;
};

export function createWorkflowRuntime(workflow: WorkflowStepExecutor): WorkflowRuntime {
  return {
    workflowId: workflow.workflowId,
    runQuery: (reference, definition, args) =>
      runStep(
        (encodedStepArgs) => workflow.runQuery(reference, encodedStepArgs as never),
        definition,
        args,
      ),
    runMutation: (reference, definition, args) =>
      runStep(
        (encodedStepArgs) => workflow.runMutation(reference, encodedStepArgs as never),
        definition,
        args,
      ),
    awaitEvent: (event) => {
      const decodePayload = Schema.decodeUnknownSync(event.payload);

      return Effect.tryPromise({
        try: () => withHostWorkflowGlobals(() => workflow.awaitEvent({ name: event.name })),
        catch: normalizeError,
      }).pipe(
        Effect.flatMap((payload) =>
          Effect.try({
            try: () => decodePayload(payload),
            catch: normalizeError,
          }),
        ),
      );
    },
  };
}

export function defineEvent<Name extends string, PayloadSchema extends AnySchema>(
  definition: WorkflowEventDefinition<Name, PayloadSchema>,
): WorkflowEventDefinition<Name, PayloadSchema> {
  return definition;
}

export function bindWorkflow(component: WorkflowComponent) {
  const workflowManager = new WorkflowManager(component);

  function define<ArgsSchema extends AnySchema, ReturnsSchema extends AnySchema>(
    definition: WorkflowDefinitionInput<ArgsSchema, ReturnsSchema>,
  ): DefinedWorkflow<ArgsSchema, ReturnsSchema> {
    const decodeArgs = Schema.decodeUnknownSync(definition.args);
    const encodeArgs = Schema.encodeSync(definition.args);
    const encodeResult = Schema.encodeSync(definition.returns);

    const mutation = workflowManager.define({
      handler: async (workflow, encodedArgs) => {
        const args = decodeArgs(encodedArgs);
        const result = await runWorkflowEffect(
          definition.handler(createWorkflowRuntime(workflow), args),
        );
        return encodeResult(result);
      },
    });

    return {
      args: definition.args,
      returns: definition.returns,
      mutation,
      encodeArgs,
    };
  }

  function start<ArgsSchema extends AnySchema, ReturnsSchema extends AnySchema>(
    ctx: MutationCtx,
    workflow: DefinedWorkflow<ArgsSchema, ReturnsSchema>,
    reference: FunctionReference<"mutation", "internal">,
    args: WorkflowSchemaType<ArgsSchema>,
  ) {
    return Effect.tryPromise({
      try: () => workflowManager.start(ctx, reference, workflow.encodeArgs(args) as never),
      catch: normalizeError,
    });
  }

  function status<ArgsSchema extends AnySchema, ReturnsSchema extends AnySchema>(
    ctx: QueryCtx,
    workflow: DefinedWorkflow<ArgsSchema, ReturnsSchema>,
    workflowId: WorkflowId,
  ): Effect.Effect<WorkflowStatus<ReturnsSchema>, Error> {
    const decodeResult = Schema.decodeUnknownSync(workflow.returns);

    return Effect.tryPromise({
      try: () => workflowManager.status(ctx, workflowId),
      catch: normalizeError,
    }).pipe(
      Effect.flatMap((currentStatus): Effect.Effect<WorkflowStatus<ReturnsSchema>, Error> => {
        if (currentStatus.type !== "completed") {
          return Effect.succeed(currentStatus as WorkflowStatus<ReturnsSchema>);
        }

        return Effect.try({
          try: () => ({
            type: "completed" as const,
            result: decodeResult(currentStatus.result),
          }),
          catch: normalizeError,
        }) as Effect.Effect<WorkflowStatus<ReturnsSchema>, Error>;
      }),
    );
  }

  function cancel(ctx: MutationCtx, workflowId: WorkflowId) {
    return Effect.tryPromise({
      try: () => workflowManager.cancel(ctx, workflowId),
      catch: normalizeError,
    });
  }

  function restart(ctx: MutationCtx, workflowId: WorkflowId, options?: WorkflowRestartOptions) {
    return Effect.tryPromise({
      try: () => workflowManager.restart(ctx, workflowId, options),
      catch: normalizeError,
    });
  }

  function cleanup(ctx: MutationCtx, workflowId: WorkflowId) {
    return Effect.tryPromise({
      try: () => workflowManager.cleanup(ctx, workflowId),
      catch: normalizeError,
    });
  }

  function sendEvent<Name extends string, PayloadSchema extends AnySchema>(
    ctx: MutationCtx,
    args: {
      readonly workflowId: WorkflowId;
      readonly event: WorkflowEventDefinition<Name, PayloadSchema>;
    } & (
      | {
          readonly value: WorkflowSchemaType<PayloadSchema>;
          readonly error?: undefined;
        }
      | {
          readonly value?: undefined;
          readonly error: string;
        }
    ),
  ) {
    return (
      "error" in args
        ? Effect.tryPromise({
            try: () =>
              workflowManager.sendEvent(ctx, {
                workflowId: args.workflowId,
                name: args.event.name,
                error: args.error,
              }),
            catch: normalizeError,
          })
        : Effect.try({
            try: () => Schema.encodeSync(args.event.payload)(args.value),
            catch: normalizeError,
          }).pipe(
            Effect.flatMap((value) =>
              Effect.tryPromise({
                try: () =>
                  workflowManager.sendEvent(ctx, {
                    workflowId: args.workflowId,
                    name: args.event.name,
                    value,
                  }),
                catch: normalizeError,
              }),
            ),
          )
    ) as Effect.Effect<WorkflowEventId, Error>;
  }

  return {
    define,
    start,
    status,
    cancel,
    restart,
    cleanup,
    sendEvent,
  };
}
