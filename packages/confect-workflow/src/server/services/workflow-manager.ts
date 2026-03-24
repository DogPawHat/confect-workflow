import { Ref } from "@confect/core";
import { MutationCtx, QueryCtx } from "@confect/server";
import {
  WorkflowManager as UpstreamWorkflowManager,
  type WorkflowId,
  type WorkflowStatus,
  type EventId,
  type WorkflowStep,
  type CallbackOptions,
} from "@convex-dev/workflow";
import type { WorkpoolOptions } from "@convex-dev/workpool";
import {
  makeFunctionReference,
  type PaginationOptions,
  type PaginationResult,
} from "convex/server";
import type { Validator } from "convex/values";
import { Context, Effect, Layer, Schema } from "effect";
import { getWorkflowMetadataFromRef } from "../../internal/workflow-metadata.ts";

type WorkflowComponent = ConstructorParameters<
  typeof UpstreamWorkflowManager
>[0];
type PublicWorkflow = Awaited<
  ReturnType<UpstreamWorkflowManager["list"]>
>["page"][number];

export type WorkflowManagerRequiresQueryType = {
  readonly status: (
    workflowId: WorkflowId,
  ) => Effect.Effect<WorkflowStatus, never, never>;

  readonly list: (opts?: {
    order?: "asc" | "desc";
    paginationOpts?: PaginationOptions;
  }) => Effect.Effect<PaginationResult<PublicWorkflow>, never, never>;

  readonly listByName: (
    name: string,
    opts?: {
      order?: "asc" | "desc";
      paginationOpts?: PaginationOptions;
    },
  ) => Effect.Effect<PaginationResult<PublicWorkflow>, never, never>;

  readonly listSteps: (
    workflowId: WorkflowId,
    opts?: {
      order?: "asc" | "desc";
      paginationOpts?: PaginationOptions;
    },
  ) => Effect.Effect<PaginationResult<WorkflowStep>, never, never>;
};

const InnerWorkflowManager = Context.GenericTag<UpstreamWorkflowManager>(
  "@confect-workflow/InnerWorkflowManager",
);

export class WorkflowManagerRequiresQuery extends Context.Tag(
  "@confect-workflow/WorkflowManagerRequriesQuery",
)<WorkflowManagerRequiresQuery, WorkflowManagerRequiresQueryType>() {
  static readonly layer = Layer.effect(
    WorkflowManagerRequiresQuery,
    Effect.gen(function* () {
      const upstream = yield* InnerWorkflowManager;
      const queryCtx = yield* QueryCtx.QueryCtx<any>();
      return makeWorkflowManagerQueryService(upstream, queryCtx);
    }),
  );
}

export class WorkflowManagerRequiresMutation extends Context.Tag(
  "@confect-workflow/WorkflowManagerRequiresMutation",
)<
  WorkflowManagerRequiresMutation,
  {
    readonly start: <Workflow extends Ref.AnyMutation>(
      workflow: Workflow,
      args: Ref.Args<Workflow>,
      options?: CallbackOptions & { startAsync?: boolean },
    ) => Effect.Effect<WorkflowId, never, never>;

    readonly restart: (
      workflowId: WorkflowId,
      options?: { from?: number | string; startAsync?: boolean },
    ) => Effect.Effect<void, never, never>;

    readonly cleanup: (
      workflowId: WorkflowId,
    ) => Effect.Effect<boolean, never, never>;

    readonly sendEvent: <T = null, Name extends string = string>(
      args: (
        | { workflowId: WorkflowId; name: Name; id?: EventId<Name> }
        | { workflowId?: undefined; name?: Name; id: EventId<Name> }
      ) &
        (
          | { validator?: undefined; value?: T }
          | { validator: Validator<T, any, any>; value: T }
          | { error: string; value?: undefined }
        ),
    ) => Effect.Effect<EventId<Name>, never, never>;

    readonly createEvent: <Name extends string>(args: {
      name: Name;
      workflowId: WorkflowId;
    }) => Effect.Effect<EventId<Name>, never, never>;
  }
>() {
  static readonly layer = Layer.effect(
    WorkflowManagerRequiresMutation,
    Effect.gen(function* () {
      const upstream = yield* InnerWorkflowManager;
      const mutationCtx = yield* MutationCtx.MutationCtx<any>();
      return makeWorkflowManagerMutationService(upstream, mutationCtx);
    }),
  );
}

export function makeWorkflowManagerQueryService(
  upstream: UpstreamWorkflowManager,
  queryCtx: any,
): WorkflowManagerRequiresQuery["Type"] {
  return {
    status: (workflowId) =>
      Effect.promise(() => upstream.status(queryCtx, workflowId)),

    list: (opts) => Effect.promise(() => upstream.list(queryCtx, opts)),

    listByName: (name, opts) =>
      Effect.promise(() => upstream.listByName(queryCtx, name, opts)),

    listSteps: (workflowId, opts) =>
      Effect.promise(() => upstream.listSteps(queryCtx, workflowId, opts)),
  };
}

export function makeWorkflowManagerMutationService(
  upstream: UpstreamWorkflowManager,
  mutationCtx: any,
): WorkflowManagerRequiresMutation["Type"] {
  return {
    start: (workflow, args, startOptions) => {
      const functionName = Ref.getConvexFunctionName(workflow);
      const functionRef = makeFunctionReference<"mutation">(
        functionName,
      ) as any;
      const workflowMetadata = getWorkflowMetadataFromRef(workflow);

      return Schema.encode(workflowMetadata.args)(args).pipe(
        Effect.orDie,
        Effect.andThen((encodedArgs) =>
          Effect.promise(() =>
            upstream.start(mutationCtx, functionRef, encodedArgs, startOptions),
          ),
        ),
      );
    },

    restart: (workflowId, restartOptions) =>
      Effect.promise(() =>
        upstream.restart(mutationCtx, workflowId, restartOptions),
      ),

    cleanup: (workflowId) =>
      Effect.promise(() => upstream.cleanup(mutationCtx, workflowId)),

    sendEvent: (args) =>
      Effect.promise(() => upstream.sendEvent(mutationCtx, args as any)) as any,

    createEvent: (args) =>
      Effect.promise(() => upstream.createEvent(mutationCtx, args)),
  };
}

export function makeWorkflowManagerLayers(
  component: WorkflowComponent,
  options?: { workpoolOptions: WorkpoolOptions },
) {
  const innerWfManagerLayer = Layer.effect(
    InnerWorkflowManager,
    Effect.try(() => new UpstreamWorkflowManager(component, options)),
  );

  return {
    queryLayer: Layer.provide(
      WorkflowManagerRequiresQuery.layer,
      innerWfManagerLayer,
    ),
    mutationLayer: Layer.provide(
      WorkflowManagerRequiresMutation.layer,
      innerWfManagerLayer,
    ),
  };
}
