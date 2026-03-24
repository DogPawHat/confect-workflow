import { FunctionSpec } from "@confect/core";
import { attachWorkflowMetadata, getWorkflowMetadataOrThrow } from "./internal/workflow-metadata";
import type { WorkflowMutation } from "./types.js";
export type { WorkflowMutation } from "./types.js";

export function workflowSpec<
  Workflow extends WorkflowMutation<any, any>,
  const Name extends string,
>(workflow: Workflow, name: Name) {
  return attachWorkflowMetadata(
    FunctionSpec.convexInternalMutation<typeof workflow>()(name),
    getWorkflowMetadataOrThrow(workflow, `workflow definition '${name}'`),
  );
}
