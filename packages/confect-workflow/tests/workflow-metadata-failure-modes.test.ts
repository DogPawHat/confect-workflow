import { GroupSpec, Ref, Refs, Spec } from "@confect/core";
import { Effect, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { defineWorkflow } from "../src/server.js";
import { isWorkflowSpec } from "./utils.js";
import { workflowSpec } from "../src/spec.js";

describe("Workflow metadata failure modes", () => {
  it("Workflow.define rejects non-workflow specs", () => {
    expect(() =>
      defineWorkflow({} as any, {} as any, {
        handler: () => Effect.succeed(null),
      }),
    ).toThrow(
      "Expected workflow spec to carry workflow schema metadata. Only values created via workflowSpec(...) are supported.",
    );
  });

  it("metadata survives the define -> spec -> refs path", () => {
    const countWorkflow = workflowSpec({
      name: "countWorkflow",
      args: Schema.Struct({ count: Schema.NumberFromString }),
      returns: Schema.NumberFromString,
    });
    defineWorkflow({} as any, countWorkflow, {
      handler: ({ count }) => Effect.succeed(count + 1),
    });

    const spec = Spec.make().add(GroupSpec.make("workflows").addFunction(countWorkflow));
    const refs = Refs.make(spec);

    expect(isWorkflowSpec(Ref.getFunctionSpec(refs.internal.workflows.countWorkflow))).toBe(true);
  });
});
