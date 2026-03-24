import {
  WorkflowManager as UpstreamWorkflowManager,
  type WorkflowDefinition,
} from "@convex-dev/workflow";
import { Effect, Schema } from "effect";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { defineWorkflow } from "../src/server.js";

describe("Workflow runtime boundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const captureDefinition = () => {
    let capturedDefinition: WorkflowDefinition<any, any> | undefined;
    let capturedOptions: { workpoolOptions: unknown } | undefined;

    vi.spyOn(UpstreamWorkflowManager.prototype, "define").mockImplementation(
      function (this: any, definition) {
        capturedDefinition = definition;
        capturedOptions = this.options as
          | { workpoolOptions: unknown }
          | undefined;
        return vi.fn() as any;
      },
    );

    return {
      get definition() {
        expect(capturedDefinition).toBeDefined();
        return capturedDefinition!;
      },
      get options() {
        return capturedOptions;
      },
    };
  };

  it("Workflow.define decodes args before the handler runs", async () => {
    const capture = captureDefinition();
    const handler = vi.fn(({ count }: { count: number }) =>
      Effect.succeed(count + 1),
    );

    defineWorkflow({} as any, {
      args: Schema.Struct({ count: Schema.NumberFromString }),
      returns: Schema.NumberFromString,
      handler,
    });

    const result = await capture.definition.handler(
      { workflowId: "wf-1" } as any,
      { count: "41" },
    );

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ count: 41 });
    expect(result).toBe("42");
  });

  it("Workflow.define encodes returns before returning upstream", async () => {
    const capture = captureDefinition();

    defineWorkflow({} as any, {
      args: Schema.Struct({ count: Schema.NumberFromString }),
      returns: Schema.NumberFromString,
      handler: ({ count }) => Effect.succeed(count + 1),
    });

    const result = await capture.definition.handler(
      { workflowId: "wf-1" } as any,
      { count: "41" },
    );

    expect(result).toBe("42");
  });

  it("Workflow.define fails invalid encoded args before the handler runs", async () => {
    const capture = captureDefinition();
    const handler = vi.fn(() => Effect.succeed(42));

    defineWorkflow({} as any, {
      args: Schema.Struct({ count: Schema.NumberFromString }),
      returns: Schema.NumberFromString,
      handler,
    });

    await expect(
      capture.definition.handler({ workflowId: "wf-1" } as any, {
        count: "not-a-number",
      }),
    ).rejects.toThrow();

    expect(handler).not.toHaveBeenCalled();
  });

  it("Workflow.define fails invalid handler returns at the wrapper boundary", async () => {
    const capture = captureDefinition();

    defineWorkflow({} as any, {
      args: Schema.Struct({ count: Schema.NumberFromString }),
      returns: Schema.NumberFromString,
      handler: () => Effect.succeed("wrong-shape" as any),
    });

    await expect(
      capture.definition.handler({ workflowId: "wf-1" } as any, {
        count: "41",
      }),
    ).rejects.toThrow();
  });

  it("Workflow.define forwards workpoolOptions to the upstream manager", () => {
    const capture = captureDefinition();
    const workpoolOptions = {
      maxParallelism: 3,
      retryActionsByDefault: true,
    };

    defineWorkflow({} as any, {
      args: Schema.Struct({}),
      returns: Schema.Null,
      handler: () => Effect.succeed(null),
      workpoolOptions,
    });

    expect(capture.options).toEqual({ workpoolOptions });
  });
});
