import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";
import { workflowSpec } from "@dogpawhat/confect-workflow/spec";
import { generateTaggedNote } from "./workflows";

export const workflows = GroupSpec.make("workflows")
  .addFunction(workflowSpec(generateTaggedNote, "generateTaggedNote"))
  .addFunction(
    FunctionSpec.publicMutation({
      name: "startGenerateTaggedNote",
      args: Schema.Struct({ text: Schema.String }),
      returns: Schema.String,
    }),
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getWorkflowStatus",
      args: Schema.Struct({ workflowId: Schema.String }),
      returns: Schema.Any,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "sendApprovalEvent",
      args: Schema.Struct({
        workflowId: Schema.String,
        approved: Schema.Boolean,
      }),
      returns: Schema.Null,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "cleanupWorkflow",
      args: Schema.Struct({ workflowId: Schema.String }),
      returns: Schema.Boolean,
    }),
  );
