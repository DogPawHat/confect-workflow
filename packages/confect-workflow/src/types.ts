import type * as FunctionProvenance from "@confect/core/FunctionProvenance";
import type * as FunctionSpec from "@confect/core/FunctionSpec";
import type * as RuntimeAndFunctionType from "@confect/core/RuntimeAndFunctionType";
import type { RegisteredMutation } from "convex/server";
import type { Schema } from "effect";

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
> = RegisteredMutation<"internal", Args["Encoded"], Promise<Returns["Encoded"]>>;

export type WorkflowFunctionSpec<
  Args extends Schema.Schema.AnyNoContext,
  Returns extends Schema.Schema.AnyNoContext,
  Name extends string = string,
> = FunctionSpec.FunctionSpec<
  RuntimeAndFunctionType.ConvexMutation,
  "internal",
  Name,
  FunctionProvenance.Convex<Args["Encoded"], Promise<Returns["Encoded"]>>
> &
  WorkflowMetadataCarrier<Args, Returns>;
