import { GroupSpec, Ref, Refs, Spec } from "@confect/core";
import { Effect, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { defineWorkflow } from "../src/server.js";
import { isWorkflowSpec } from "./utils.js";
import { workflowSpec } from "../src/spec.js";

describe("Workflow metadata failure modes", () => {
  it("Workflow.spec rejects non-workflow values", () => {
    expect(() => workflowSpec({} as any, "notAWorkflow")).toThrow(
      "Expected workflow definition 'notAWorkflow' to carry workflow schema metadata. Only values created via Workflow.define/Workflow.spec are supported.",
    );
  });

  it("metadata survives the define -> spec -> refs path", () => {
    const workflow = defineWorkflow({} as any, {
      args: Schema.Struct({ count: Schema.NumberFromString }),
      returns: Schema.NumberFromString,
      handler: ({ count }) => Effect.succeed(count + 1),
    });

    const spec = Spec.make().add(
      GroupSpec.make("workflows").addFunction(
        workflowSpec(workflow, "countWorkflow"),
      ),
    );
    const refs = Refs.make(spec);

    expect(
      isWorkflowSpec(
        Ref.getFunctionSpec(refs.internal.workflows.countWorkflow),
      ),
    ).toBe(true);
  });
});
