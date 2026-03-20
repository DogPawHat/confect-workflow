import { FunctionSpec } from "@confect/core";
import {
  attachWorkflowMetadata,
  getWorkflowMetadataOrThrow,
  type WorkflowMutation,
} from "./internal/workflow-metadata";

export function workflowSpec<
  Workflow extends WorkflowMutation<any, any>,
  const Name extends string,
>(workflow: Workflow, name: Name) {
  return attachWorkflowMetadata(
    FunctionSpec.convexInternalMutation<typeof workflow>()(name),
    getWorkflowMetadataOrThrow(workflow, `workflow definition '${name}'`),
  );
}
