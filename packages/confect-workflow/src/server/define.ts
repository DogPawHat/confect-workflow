import { SchemaToValidator } from "@confect/server";
import {
  WorkflowManager as UpstreamWorkflowManager,
  type WorkflowDefinition,
} from "@convex-dev/workflow";
import type { WorkpoolOptions } from "@convex-dev/workpool";
import { Effect, Schema } from "effect";

import { getWorkflowMetadataOrThrow } from "../internal/workflow-metadata.js";
import type { WorkflowFunctionSpec, WorkflowMutation } from "../types.js";
import { WorkflowContext } from "./services/workflow-context.js";

type WorkflowComponent = ConstructorParameters<typeof UpstreamWorkflowManager>[0];

export function defineWorkflow<
  Args extends Schema.Schema.AnyNoContext,
  Returns extends Schema.Schema.AnyNoContext,
  E = never,
>(
  component: WorkflowComponent,
  workflowSpec: WorkflowFunctionSpec<Args, Returns>,
  {
    handler,
    workpoolOptions,
  }: {
    handler: (args: Args["Type"]) => Effect.Effect<Returns["Type"], E, WorkflowContext>;
    workpoolOptions?: WorkpoolOptions;
  },
): WorkflowMutation<Args, Returns> {
  const { args, returns } = getWorkflowMetadataOrThrow(workflowSpec, "workflow spec");
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

  return manager.define(definition) as WorkflowMutation<Args, Returns>;
}
