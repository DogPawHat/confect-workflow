import { Effect, Schema } from "effect";
import { api, components } from "../convex/_generated/api";
import { defineWorkflow, WorkflowContext } from "@dogpawhat/confect-workflow";

export const generateTaggedNote = defineWorkflow(components.workflow, {
  args: Schema.Struct({ text: Schema.String }),
  returns: Schema.Null,
  handler: ({ text }) =>
    Effect.gen(function* () {
      const ctx = yield* WorkflowContext;

      yield* ctx.runMutation(api.notesAndRandom.notes.insert, {
        text,
      });

      yield* ctx.awaitEvent({ name: "approval" });
      return null;
    }),
});
