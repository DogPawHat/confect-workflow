import { FunctionSpec } from "@confect/core";
import { hasWorkflowMetadata } from "../src/internal/workflow-metadata.js";

export const isWorkflowSpec = (
  functionSpec: FunctionSpec.AnyWithProps,
): boolean => hasWorkflowMetadata(functionSpec);
