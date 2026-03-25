import { Effect } from "effect";
import { api, components } from "../convex/_generated/api";
import { defineWorkflow, WorkflowContext } from "confect-workflow/server";
import { generateTaggedNote as generateTaggedNoteSpec } from "./workflows.spec";

export const generateTaggedNote = defineWorkflow(components.workflow, generateTaggedNoteSpec, {
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
