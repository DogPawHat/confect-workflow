import { FunctionSpec } from "@confect/core";
import { SchemaToValidator } from "@confect/server";
import {
  WorkflowManager as UpstreamWorkflowManager,
  type WorkflowDefinition,
} from "@convex-dev/workflow";
import type { WorkpoolOptions } from "@convex-dev/workpool";
import { Effect, Schema } from "effect";
import {
  attachWorkflowMetadata,
  getWorkflowMetadataOrThrow,
  type WorkflowMutation,
} from "./internal/workflowMetadata";
import { WorkflowContext } from "./services/WorkflowContext";

type WorkflowComponent = ConstructorParameters<typeof UpstreamWorkflowManager>[0];

export function define<
  Args extends Schema.Schema.AnyNoContext,
  Returns extends Schema.Schema.AnyNoContext,
  E = never,
>(
  component: WorkflowComponent,
  {
    args,
    returns,
    handler,
    workpoolOptions,
  }: {
    args: Args;
    returns: Returns;
    handler: (args: Args["Type"]) => Effect.Effect<Returns["Type"], E, WorkflowContext>;
    workpoolOptions?: WorkpoolOptions;
  },
): WorkflowMutation<Args, Returns> {
  const manager = new UpstreamWorkflowManager(
    component,
    workpoolOptions ? { workpoolOptions } : undefined,
  );

  const definition: WorkflowDefinition<any, any> = {
    args: SchemaToValidator.compileArgsSchema(args),
    returns: SchemaToValidator.compileReturnsSchema(returns),
    handler: async (step, encodedArgs) =>
      Effect.runPromise(
        Schema.decode(args)(encodedArgs).pipe(
          Effect.orDie,
          Effect.andThen((decodedArgs) =>
            handler(decodedArgs).pipe(Effect.provide(WorkflowContext.make(step))),
          ),
          Effect.andThen((workflowReturns) => Schema.encode(returns)(workflowReturns)),
          Effect.orDie,
        ),
      ),
  };

  return attachWorkflowMetadata(manager.define(definition), {
    args,
    returns,
  }) as WorkflowMutation<Args, Returns>;
}

export function spec<Workflow extends WorkflowMutation<any, any>, const Name extends string>(
  workflow: Workflow,
  name: Name,
) {
  return attachWorkflowMetadata(
    FunctionSpec.convexInternalMutation<typeof workflow>()(name),
    getWorkflowMetadataOrThrow(workflow, `workflow definition '${name}'`),
  );
}

export const Workflow = {
  define,
  spec,
} as const;
