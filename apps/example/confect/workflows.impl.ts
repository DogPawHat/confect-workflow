import { FunctionImpl, GroupImpl } from "@confect/server";
import type { WorkflowId } from "@convex-dev/workflow";
import { Effect, Layer } from "effect";
import { components } from "../convex/_generated/api";
import api from "./_generated/api";
import refs from "./_generated/refs";
import {
  makeWorkflowManagerLayers,
  WorkflowManagerRequiresMutation,
  WorkflowManagerRequiresQuery,
} from "@dogpawhat/confect-workflow";
import { generateTaggedNote } from "./workflows";

const workflowManagerLayers = makeWorkflowManagerLayers(components.workflow);

const generateTaggedNoteImpl = FunctionImpl.make(
  api,
  "workflows",
  "generateTaggedNote",
  generateTaggedNote,
);

const startGenerateTaggedNote = FunctionImpl.make(
  api,
  "workflows",
  "startGenerateTaggedNote",
  ({ text }) =>
    Effect.gen(function* () {
      const workflowManager = yield* WorkflowManagerRequiresMutation;
      return yield* workflowManager.start(refs.internal.workflows.generateTaggedNote, { text });
    }).pipe(Effect.provide(workflowManagerLayers.mutationLayer), Effect.orDie),
);

const getWorkflowStatus = FunctionImpl.make(
  api,
  "workflows",
  "getWorkflowStatus",
  ({ workflowId }) =>
    Effect.gen(function* () {
      const workflowManager = yield* WorkflowManagerRequiresQuery;
      return yield* workflowManager.status(workflowId as unknown as WorkflowId);
    }).pipe(Effect.provide(workflowManagerLayers.queryLayer), Effect.orDie),
);

const sendApprovalEvent = FunctionImpl.make(
  api,
  "workflows",
  "sendApprovalEvent",
  ({ workflowId, approved }) =>
    Effect.gen(function* () {
      const workflowManager = yield* WorkflowManagerRequiresMutation;
      yield* workflowManager.sendEvent({
        workflowId: workflowId as unknown as WorkflowId,
        name: "approval",
        value: { approved },
      });
      return null;
    }).pipe(Effect.provide(workflowManagerLayers.mutationLayer), Effect.orDie),
);

const cleanupWorkflow = FunctionImpl.make(api, "workflows", "cleanupWorkflow", ({ workflowId }) =>
  Effect.gen(function* () {
    const workflowManager = yield* WorkflowManagerRequiresMutation;
    return yield* workflowManager.cleanup(workflowId as unknown as WorkflowId);
  }).pipe(Effect.provide(workflowManagerLayers.mutationLayer), Effect.orDie),
);

export const workflows = GroupImpl.make(api, "workflows").pipe(
  Layer.provide(generateTaggedNoteImpl),
  Layer.provide(startGenerateTaggedNote),
  Layer.provide(getWorkflowStatus),
  Layer.provide(sendApprovalEvent),
  Layer.provide(cleanupWorkflow),
);
