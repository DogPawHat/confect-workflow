import { Effect, Schema } from "effect";
import { makeFunctionReference } from "convex/server";
import { describe, expect, test, vi } from "vitest";
import { createWorkflowRuntime, defineEvent } from "../src/index.js";

describe("workflow step service", () => {
  test("validates query and mutation steps at the adapter boundary", async () => {
    const runQuery = vi.fn(async (_reference, args: Record<string, unknown>) => ({
      greeting: `Hello, ${String(args.name)}!`,
      shoutCount: "2",
    }));
    const runMutation = vi.fn(async (_reference, args: Record<string, unknown>) => ({
      workflowId: args.workflowId,
      savedGreeting: args.greeting,
      shoutCount: args.shoutCount,
    }));
    const workflow = createWorkflowRuntime({
      workflowId: "workflow-123" as never,
      runQuery,
      runMutation,
      awaitEvent: vi.fn(),
    });
    const buildGreeting = makeFunctionReference<
      "query",
      {
        name: string;
      },
      {
        greeting: string;
        shoutCount: string;
      }
    >("steps:buildGreeting");
    const recordGreeting = makeFunctionReference<
      "mutation",
      {
        workflowId: string;
        greeting: string;
        shoutCount: string;
      },
      {
        workflowId: string;
        savedGreeting: string;
        shoutCount: string;
      }
    >("steps:recordGreeting");

    const result = await Effect.runPromise(
      workflow
        .runQuery(
          buildGreeting,
          {
            args: Schema.Struct({
              name: Schema.String,
            }),
            returns: Schema.Struct({
              greeting: Schema.String,
              shoutCount: Schema.NumberFromString,
            }),
          },
          {
            name: "Ada",
          },
        )
        .pipe(
          Effect.flatMap(({ greeting, shoutCount }) =>
            workflow.runMutation(
              recordGreeting,
              {
                args: Schema.Struct({
                  workflowId: Schema.String,
                  greeting: Schema.String,
                  shoutCount: Schema.NumberFromString,
                }),
                returns: Schema.Struct({
                  workflowId: Schema.String,
                  savedGreeting: Schema.String,
                  shoutCount: Schema.NumberFromString,
                }),
              },
              {
                workflowId: workflow.workflowId,
                greeting,
                shoutCount,
              },
            ),
          ),
        ),
    );

    expect(result).toEqual({
      workflowId: "workflow-123",
      savedGreeting: "Hello, Ada!",
      shoutCount: 2,
    });
    expect(runQuery).toHaveBeenCalledWith(buildGreeting, {
      name: "Ada",
    });
    expect(runMutation).toHaveBeenCalledWith(recordGreeting, {
      workflowId: "workflow-123",
      greeting: "Hello, Ada!",
      shoutCount: "2",
    });
  });

  test("validates awaited events at the adapter boundary", async () => {
    const awaitEvent = vi.fn(async () => ({
      total: "42",
    }));
    const workflow = createWorkflowRuntime({
      workflowId: "workflow-123" as never,
      runQuery: vi.fn(),
      runMutation: vi.fn(),
      awaitEvent,
    });
    const orderApproved = defineEvent({
      name: "order/approved",
      payload: Schema.Struct({
        total: Schema.NumberFromString,
      }),
    });

    const result = await Effect.runPromise(workflow.awaitEvent(orderApproved));

    expect(result).toEqual({
      total: 42,
    });
    expect(awaitEvent).toHaveBeenCalledWith({
      name: "order/approved",
    });
  });
});
