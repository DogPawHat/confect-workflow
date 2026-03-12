import { DateTime, Duration, Effect, Schema } from "effect";
import { makeFunctionReference } from "convex/server";
import { describe, expect, test, vi } from "vitest";
import { createWorkflowRuntime, defineEvent } from "../src/index.js";

describe("workflow step service", () => {
  test("preserves the host process while awaiting an event", async () => {
    const originalProcess = globalThis.process;
    const awaitEvent = vi.fn(async () => ({
      total: "42",
    }));
    const workflow = createWorkflowRuntime({
      workflowId: "workflow-123" as never,
      runQuery: vi.fn(),
      runMutation: vi.fn(),
      runAction: vi.fn(),
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
    expect(globalThis.process).toBe(originalProcess);
  });

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
      runAction: vi.fn(),
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
    expect(runQuery).toHaveBeenCalledWith(
      buildGreeting,
      {
        name: "Ada",
      },
      undefined,
    );
    expect(runMutation).toHaveBeenCalledWith(
      recordGreeting,
      {
        workflowId: "workflow-123",
        greeting: "Hello, Ada!",
        shoutCount: "2",
      },
      undefined,
    );
  });

  test("translates scheduling and retry options for supported step types", async () => {
    const runQuery = vi.fn(async () => ({
      value: "scheduled",
    }));
    const runMutation = vi.fn(async () => ({
      value: "mutated",
    }));
    const runAction = vi.fn(async () => ({
      value: "retried",
    }));
    const workflow = createWorkflowRuntime({
      workflowId: "workflow-123" as never,
      runQuery,
      runMutation,
      runAction,
      awaitEvent: vi.fn(),
    });
    const scheduledAt = DateTime.unsafeMake("2026-03-12T10:30:00.000Z");
    const stepDefinition = {
      args: Schema.Struct({
        input: Schema.String,
      }),
      returns: Schema.Struct({
        value: Schema.String,
      }),
    };
    const buildGreeting = makeFunctionReference<
      "query",
      {
        input: string;
      },
      {
        value: string;
      }
    >("steps:buildGreeting");
    const saveGreeting = makeFunctionReference<
      "mutation",
      {
        input: string;
      },
      {
        value: string;
      }
    >("steps:saveGreeting");
    const sendGreeting = makeFunctionReference<
      "action",
      {
        input: string;
      },
      {
        value: string;
      }
    >("steps:sendGreeting");

    const queryResult = await Effect.runPromise(
      workflow.runQuery(buildGreeting, stepDefinition, { input: "Ada" }, { runAt: scheduledAt }),
    );
    const mutationResult = await Effect.runPromise(
      workflow.runMutation(
        saveGreeting,
        stepDefinition,
        { input: "Ada" },
        { runAfter: Duration.seconds(5) },
      ),
    );
    const actionResult = await Effect.runPromise(
      workflow.runAction(
        sendGreeting,
        stepDefinition,
        { input: "Ada" },
        {
          runAfter: Duration.seconds(2),
          retry: {
            maxAttempts: 4,
            initialBackoff: Duration.millis(250),
            backoffFactor: 3,
          },
        },
      ),
    );

    expect(queryResult).toEqual({ value: "scheduled" });
    expect(mutationResult).toEqual({ value: "mutated" });
    expect(actionResult).toEqual({ value: "retried" });
    expect(runQuery).toHaveBeenCalledWith(
      buildGreeting,
      { input: "Ada" },
      { runAt: DateTime.toDateUtc(scheduledAt).getTime() },
    );
    expect(runMutation).toHaveBeenCalledWith(saveGreeting, { input: "Ada" }, { runAfter: 5000 });
    expect(runAction).toHaveBeenCalledWith(
      sendGreeting,
      { input: "Ada" },
      {
        runAfter: 2000,
        retry: {
          maxAttempts: 4,
          initialBackoffMs: 250,
          base: 3,
        },
      },
    );
  });

  test("validates awaited events at the adapter boundary", async () => {
    const awaitEvent = vi.fn(async () => ({
      total: "42",
    }));
    const workflow = createWorkflowRuntime({
      workflowId: "workflow-123" as never,
      runQuery: vi.fn(),
      runMutation: vi.fn(),
      runAction: vi.fn(),
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
