import { FunctionSpec, Ref } from "@confect/core";
import type { WorkflowId } from "@convex-dev/workflow";
import { Effect, Schema } from "effect";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  makeWorkflowManagerMutationService,
  makeWorkflowManagerQueryService,
} from "../src/services/workflow-manager.js";

describe("WorkflowManager services", () => {
  it("status delegates and returns the upstream status", async () => {
    const upstream = {
      status: vi.fn().mockResolvedValue({ type: "completed", result: 42 }),
    } as any;
    const queryCtx = {};
    const service = makeWorkflowManagerQueryService(upstream, queryCtx);

    const result = await Effect.runPromise(service.status("wf-1" as unknown as WorkflowId));

    expect(result).toEqual({ type: "completed", result: 42 });
    expect(upstream.status).toHaveBeenCalledWith(queryCtx, "wf-1");
  });

  it("list delegates and preserves options", async () => {
    const upstreamResult = { page: [], isDone: true, continueCursor: "next" };
    const upstream = {
      list: vi.fn().mockResolvedValue(upstreamResult),
    } as any;
    const queryCtx = {};
    const service = makeWorkflowManagerQueryService(upstream, queryCtx);
    const options = {
      order: "desc" as const,
      paginationOpts: { cursor: null, numItems: 10 },
    };

    const result = await Effect.runPromise(service.list(options));

    expect(result).toBe(upstreamResult);
    expect(upstream.list).toHaveBeenCalledWith(queryCtx, options);
  });

  it("listByName delegates and preserves name and options", async () => {
    const upstreamResult = {
      page: [],
      isDone: false,
      continueCursor: "cursor",
    };
    const upstream = {
      listByName: vi.fn().mockResolvedValue(upstreamResult),
    } as any;
    const queryCtx = {};
    const service = makeWorkflowManagerQueryService(upstream, queryCtx);
    const options = {
      order: "asc" as const,
      paginationOpts: { cursor: "cursor-1", numItems: 5 },
    };

    const result = await Effect.runPromise(service.listByName("generateTaggedNote", options));

    expect(result).toBe(upstreamResult);
    expect(upstream.listByName).toHaveBeenCalledWith(queryCtx, "generateTaggedNote", options);
  });

  it("listSteps delegates and preserves workflow id and options", async () => {
    const upstreamResult = { page: [], isDone: true, continueCursor: null };
    const upstream = {
      listSteps: vi.fn().mockResolvedValue(upstreamResult),
    } as any;
    const queryCtx = {};
    const service = makeWorkflowManagerQueryService(upstream, queryCtx);
    const options = {
      order: "desc" as const,
      paginationOpts: { cursor: null, numItems: 20 },
    };

    const result = await Effect.runPromise(service.listSteps("wf-9" as any, options));

    expect(result).toBe(upstreamResult);
    expect(upstream.listSteps).toHaveBeenCalledWith(queryCtx, "wf-9", options);
  });

  it("restart delegates and preserves restart options", async () => {
    const upstream = {
      restart: vi.fn().mockResolvedValue(undefined),
    } as any;
    const mutationCtx = {};
    const service = makeWorkflowManagerMutationService(upstream, mutationCtx);
    const options = { from: 3, startAsync: true };

    await Effect.runPromise(service.restart("wf-2" as any, options));

    expect(upstream.restart).toHaveBeenCalledWith(mutationCtx, "wf-2", options);
  });

  it("cleanup delegates and returns the upstream boolean", async () => {
    const upstream = {
      cleanup: vi.fn().mockResolvedValue(true),
    } as any;
    const mutationCtx = {};
    const service = makeWorkflowManagerMutationService(upstream, mutationCtx);

    const result = await Effect.runPromise(service.cleanup("wf-3" as any));

    expect(result).toBe(true);
    expect(upstream.cleanup).toHaveBeenCalledWith(mutationCtx, "wf-3");
  });

  it("sendEvent delegates value payloads", async () => {
    const upstream = {
      sendEvent: vi.fn().mockResolvedValue("evt-1"),
    } as any;
    const mutationCtx = {};
    const service = makeWorkflowManagerMutationService(upstream, mutationCtx);
    const args = {
      workflowId: "wf-4" as unknown as WorkflowId,
      name: "approval",
      value: { approved: true },
    };

    const result = await Effect.runPromise(service.sendEvent(args));

    expect(result).toBe("evt-1");
    expect(upstream.sendEvent).toHaveBeenCalledWith(mutationCtx, args);
  });

  it("sendEvent delegates error payloads", async () => {
    const upstream = {
      sendEvent: vi.fn().mockResolvedValue("evt-2"),
    } as any;
    const mutationCtx = {};
    const service = makeWorkflowManagerMutationService(upstream, mutationCtx);
    const args = {
      id: "evt-2" as any,
      error: "workflow failed",
    };

    const result = await Effect.runPromise(service.sendEvent(args as any));

    expect(result).toBe("evt-2");
    expect(upstream.sendEvent).toHaveBeenCalledWith(mutationCtx, args);
  });

  it("createEvent delegates and returns the created event id", async () => {
    const upstream = {
      createEvent: vi.fn().mockResolvedValue("evt-3"),
    } as any;
    const mutationCtx = {};
    const service = makeWorkflowManagerMutationService(upstream, mutationCtx);
    const args = {
      name: "approval",
      workflowId: "wf-5" as unknown as WorkflowId,
    };

    const result = await Effect.runPromise(service.createEvent(args));

    expect(result).toBe("evt-3");
    expect(upstream.createEvent).toHaveBeenCalledWith(mutationCtx, args);
  });

  it("start rejects refs that do not carry workflow metadata", async () => {
    const upstream = {
      start: vi.fn(),
      restart: vi.fn(),
      cleanup: vi.fn(),
      sendEvent: vi.fn(),
      createEvent: vi.fn(),
    } as any;
    const service = makeWorkflowManagerMutationService(upstream, {});
    const plainMutationRef = Ref.make(
      "notes:testMutation",
      FunctionSpec.internalMutation({
        name: "testMutation",
        args: Schema.Struct({ count: Schema.Number }),
        returns: Schema.String,
      }),
    );

    expect(() => service.start(plainMutationRef, { count: 1 } as any)).toThrow(
      "Expected workflow ref 'notes:testMutation' to carry workflow schema metadata. Only values created via Workflow.define/Workflow.spec are supported.",
    );
  });
});
