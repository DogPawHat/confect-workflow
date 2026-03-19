import { Effect, Schema } from "effect";
import { describe, expect, it, vi } from "vite-plus/test";
import { Workflow } from "../src/Workflow";
import { makeWorkflowManagerMutationService } from "../src/services/WorkflowManager";

describe("WorkflowManagerRequiresMutation", () => {
  it("encodes workflow args before delegating start to upstream", async () => {
    const workflow = Workflow.define({} as any, {
      args: Schema.Struct({ count: Schema.NumberFromString }),
      returns: Schema.NumberFromString,
      handler: ({ count }) => Effect.succeed(count + 1),
    });

    const workflowRef = {
      "@confect/core/api/HiddenFunctionSpecKey": Workflow.spec(workflow, "countWorkflow"),
      "@confect/core/api/HiddenConvexFunctionNameKey": "workflows:countWorkflow",
    } as any;

    const upstream = {
      start: vi.fn().mockResolvedValue("workflow-id"),
      restart: vi.fn(),
      cleanup: vi.fn(),
      sendEvent: vi.fn(),
      createEvent: vi.fn(),
    } as any;

    const service = makeWorkflowManagerMutationService(upstream, {
      db: {},
      auth: {},
      scheduler: {},
      storage: {},
    });

    const result = await Effect.runPromise(service.start(workflowRef, { count: 41 }));

    expect(result).toBe("workflow-id");
    expect(upstream.start).toHaveBeenCalledOnce();
    expect(upstream.start).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { count: "41" },
      undefined,
    );
  });
});
