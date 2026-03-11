import { WorkflowManager, type WorkflowId } from "@convex-dev/workflow";
import { Effect, Schema } from "effect";
import type { FunctionReference, GenericDataModel, GenericMutationCtx } from "convex/server";

type AnySchema = Schema.Schema.AnyNoContext;
type WorkflowMutation = ReturnType<WorkflowManager["define"]>;
type WorkflowSchemaType<SchemaType extends AnySchema> = Schema.Schema.Type<SchemaType>;
type WorkflowSchemaEncoded<SchemaType extends AnySchema> = Schema.Schema.Encoded<SchemaType>;

export type WorkflowRuntime = {
  readonly workflowId: WorkflowId;
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
  ) => Effect.Effect<WorkflowSchemaType<ReturnsSchema>>;
};

export type DefinedWorkflow<ArgsSchema extends AnySchema, ReturnsSchema extends AnySchema> = {
  readonly args: ArgsSchema;
  readonly returns: ReturnsSchema;
  readonly mutation: WorkflowMutation;
  readonly encodeArgs: (args: WorkflowSchemaType<ArgsSchema>) => WorkflowSchemaEncoded<ArgsSchema>;
};

export type WorkflowBindings = ReturnType<typeof bindWorkflow>;

type WorkflowComponent = ConstructorParameters<typeof WorkflowManager>[0];
type MutationCtx = GenericMutationCtx<GenericDataModel>;

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
        const result = await Effect.runPromise(
          definition.handler(
            {
              workflowId: workflow.workflowId,
            },
            args,
          ),
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
      catch: (error) => (error instanceof Error ? error : new Error(String(error))),
    });
  }

  return {
    define,
    start,
  };
}
