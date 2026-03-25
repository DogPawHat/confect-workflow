import { FunctionSpec } from "@confect/core";
import type { Schema } from "effect";
import { attachWorkflowMetadata } from "./internal/workflow-metadata";
import type { WorkflowFunctionSpec, WorkflowMutation } from "./types.js";
export type { WorkflowFunctionSpec, WorkflowMutation } from "./types.js";

export function workflowSpec<
  Args extends Schema.Schema.AnyNoContext,
  Returns extends Schema.Schema.AnyNoContext,
  const Name extends string,
>({
  name,
  args,
  returns,
}: {
  name: Name;
  args: Args;
  returns: Returns;
}): WorkflowFunctionSpec<Args, Returns, Name> {
  return attachWorkflowMetadata(
    FunctionSpec.convexInternalMutation<WorkflowMutation<Args, Returns>>()(name),
    { args, returns },
  ) as WorkflowFunctionSpec<Args, Returns, Name>;
}
