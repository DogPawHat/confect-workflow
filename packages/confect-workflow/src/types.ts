import type { RegisteredMutation } from "convex/server";
import { Schema } from "effect";

export interface WorkflowMetadata<
  Args extends Schema.Schema.AnyNoContext = Schema.Schema.AnyNoContext,
  Returns extends Schema.Schema.AnyNoContext = Schema.Schema.AnyNoContext,
> {
  readonly args: Args;
  readonly returns: Returns;
}

export interface WorkflowMetadataCarrier<
  Args extends Schema.Schema.AnyNoContext = Schema.Schema.AnyNoContext,
  Returns extends Schema.Schema.AnyNoContext = Schema.Schema.AnyNoContext,
> {
  readonly ["@confect-workflow/WorkflowMetadata"]: WorkflowMetadata<Args, Returns>;
}

export type WorkflowMutation<
  Args extends Schema.Schema.AnyNoContext,
  Returns extends Schema.Schema.AnyNoContext,
> = RegisteredMutation<"internal", Args["Type"], Returns["Type"]> &
  WorkflowMetadataCarrier<Args, Returns>;
