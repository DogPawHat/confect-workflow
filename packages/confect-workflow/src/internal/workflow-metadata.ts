import { Ref } from "@confect/core";
import { Predicate, Schema } from "effect";

import type { WorkflowMetadata, WorkflowMetadataCarrier } from "../types.js";

const WorkflowMetadataKey = "@confect-workflow/WorkflowMetadata";

export const attachWorkflowMetadata = <
  Value extends object,
  Args extends Schema.Schema.AnyNoContext,
  Returns extends Schema.Schema.AnyNoContext,
>(
  value: Value,
  metadata: WorkflowMetadata<Args, Returns>,
): Value & WorkflowMetadataCarrier<Args, Returns> => {
  Object.defineProperty(value, WorkflowMetadataKey, {
    value: metadata,
    enumerable: false,
    configurable: false,
    writable: false,
  });

  return value as Value & WorkflowMetadataCarrier<Args, Returns>;
};

export const hasWorkflowMetadata = (value: unknown): value is WorkflowMetadataCarrier =>
  Predicate.hasProperty(value, WorkflowMetadataKey);

export const getWorkflowMetadataOrThrow = (
  value: unknown,
  label = "workflow value",
): WorkflowMetadata => {
  if (!hasWorkflowMetadata(value)) {
    throw new Error(
      `Expected ${label} to carry workflow schema metadata. Only values created via Workflow.define/Workflow.spec are supported.`,
    );
  }

  return (value as WorkflowMetadataCarrier)[WorkflowMetadataKey];
};

export const getWorkflowMetadataFromRef = (ref: Ref.Any): WorkflowMetadata =>
  getWorkflowMetadataOrThrow(
    Ref.getFunctionSpec(ref),
    `workflow ref '${Ref.getConvexFunctionName(ref)}'`,
  );
