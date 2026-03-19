import { FunctionSpec, GroupSpec, Ref, Refs, Spec } from "@confect/core";
import {
  Api,
  DatabaseSchema,
  FunctionImpl,
  GroupImpl,
  Impl,
  RegisteredConvexFunction,
  RegisteredFunctions,
} from "@confect/server";
import { Effect, Layer, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { Workflow } from "../src/Workflow";
import { isWorkflowSpec } from "../src/internal/workflowMetadata";

describe("Workflow", () => {
  it("creates plain convex internal mutation specs and preserves workflow metadata on refs", () => {
    const workflow = Workflow.define({} as any, {
      args: Schema.Struct({ count: Schema.NumberFromString }),
      returns: Schema.NumberFromString,
      handler: ({ count }) => Effect.succeed(count + 1),
    });

    const workflowGroup = GroupSpec.make("workflows").addFunction(
      Workflow.spec(workflow, "countWorkflow"),
    );
    const spec = Spec.make().add(workflowGroup);
    const refs = Refs.make(spec);
    const workflowRef = refs.internal.workflows.countWorkflow;
    const workflowSpec = Ref.getFunctionSpec(workflowRef);

    expect(workflowSpec.runtimeAndFunctionType.functionType).toBe("mutation");
    expect(workflowSpec.functionVisibility).toBe("internal");
    expect(workflowSpec.functionProvenance._tag).toBe("Convex");
    expect(isWorkflowSpec(workflowSpec)).toBe(true);
  });

  it("registers workflow definitions through RegisteredConvexFunction without a custom maker", () => {
    const workflow = Workflow.define({} as any, {
      args: Schema.Struct({ count: Schema.NumberFromString }),
      returns: Schema.NumberFromString,
      handler: ({ count }) => Effect.succeed(count + 1),
    });

    const workflowGroup = GroupSpec.make("workflows").addFunction(
      Workflow.spec(workflow, "countWorkflow"),
    );
    const notesGroup = GroupSpec.make("notes").addFunction(
      FunctionSpec.publicMutation({
        name: "insert",
        args: Schema.Struct({ text: Schema.String }),
        returns: Schema.String,
      }),
    );

    const spec = Spec.make().add(workflowGroup).add(notesGroup);
    const schema = DatabaseSchema.make();
    const api = Api.make(schema, spec);

    const workflowImpl = FunctionImpl.make(api, "workflows", "countWorkflow", workflow);
    const noteImpl = FunctionImpl.make(api, "notes", "insert", ({ text }: { text: string }) =>
      Effect.succeed(text).pipe(Effect.orDie),
    );

    const impl = Impl.make(api).pipe(
      Layer.provide(
        Layer.mergeAll(
          GroupImpl.make(api, "workflows").pipe(Layer.provide(workflowImpl)),
          GroupImpl.make(api, "notes").pipe(Layer.provide(noteImpl)),
        ),
      ),
      Impl.finalize,
    );

    const registeredFunctions = RegisteredFunctions.make(impl, RegisteredConvexFunction.make);

    expect((registeredFunctions as any).workflows.countWorkflow).toBe(workflow);
    expect((registeredFunctions as any).notes.insert).toBeDefined();
  });
});
