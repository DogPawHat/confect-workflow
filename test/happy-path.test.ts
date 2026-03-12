/// <reference types="vite/client" />

import workflowTest from "@convex-dev/workflow/test";
import workpoolTest from "@convex-dev/workpool/test";
import { convexTest } from "convex-test";
import { defineSchema, makeFunctionReference } from "convex/server";
import { afterEach, describe, expect, test } from "vitest";

const modules = import.meta.glob("./fixtures/**/*.ts");
const originalDate = globalThis.Date;
const originalSetTimeout = globalThis.setTimeout;
const originalSetInterval = globalThis.setInterval;

const startHello = makeFunctionReference<
  "mutation",
  {
    name: string;
  },
  string
>("hello:startHello");

const getHelloStatus = makeFunctionReference<
  "query",
  {
    workflowId: string;
  },
  {
    type: "inProgress" | "completed" | "canceled" | "failed";
    result?: string;
    error?: string;
  }
>("hello:getHelloStatus");
const startWaitingHello = makeFunctionReference<
  "mutation",
  {
    name: string;
  },
  string
>("hello:startWaitingHello");
const getWaitingHelloStatus = makeFunctionReference<
  "query",
  {
    workflowId: string;
  },
  {
    type: "inProgress" | "completed" | "canceled" | "failed";
    result?: string;
    error?: string;
  }
>("hello:getWaitingHelloStatus");
const sendWaitingHelloApproval = makeFunctionReference<
  "mutation",
  {
    workflowId: string;
    greeting: string;
  },
  string
>("hello:sendWaitingHelloApproval");
const runWaitingHelloWorkflow = makeFunctionReference<
  "mutation",
  {
    workflowId: string;
    generationNumber: number;
  },
  null
>("hello:waitingHelloWorkflow");

const cancelHello = makeFunctionReference<
  "mutation",
  {
    workflowId: string;
  },
  null
>("hello:cancelHello");

const cleanupHello = makeFunctionReference<
  "mutation",
  {
    workflowId: string;
  },
  boolean
>("hello:cleanupHello");

const getFailingHelloStatus = makeFunctionReference<
  "query",
  {
    workflowId: string;
  },
  {
    type: "inProgress" | "completed" | "canceled" | "failed";
    result?: string;
    error?: string;
  }
>("hello:getFailingHelloStatus");

const restartFailingHello = makeFunctionReference<
  "mutation",
  {
    workflowId: string;
  },
  null
>("hello:restartFailingHello");

function initTest() {
  const t = convexTest(defineSchema({}), modules);
  workflowTest.register(t);
  workpoolTest.register(t, "workflow/workpool");
  return t;
}

describe("bindWorkflow", () => {
  afterEach(() => {
    globalThis.Date = originalDate;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.setInterval = originalSetInterval;
  });

  test("starts and completes a hello workflow through the public adapter", async () => {
    const t = initTest();

    const workflowId = await t.mutation(startHello, {
      name: "Ada",
    });
    const status = await t.query(getHelloStatus, {
      workflowId,
    });

    expect(status).toEqual({
      type: "completed",
      result: "Hello, Ada!",
    });
  });

  test("reports status and can cancel a running workflow through the public adapter", async () => {
    const t = initTest();

    const workflowId = await (t as any).runInComponent("workflow", async (ctx: any) => {
      return await ctx.db.insert("workflows", {
        name: "hello:startAsyncHello",
        workflowHandle: "function://;hello:helloWorkflow",
        args: { name: "Grace" },
        generationNumber: 0,
      });
    });
    const beforeCancel = await t.query(getHelloStatus, {
      workflowId,
    });

    expect(beforeCancel).toEqual({
      type: "inProgress",
      running: [],
    });

    await t.mutation(cancelHello, {
      workflowId,
    });

    const afterCancel = await t.query(getHelloStatus, {
      workflowId,
    });
    expect(afterCancel).toEqual({
      type: "canceled",
    });
  });

  test("waits for a typed event and resumes through the public adapter", async () => {
    const t = initTest();

    try {
      const workflowId = await t.mutation(startWaitingHello, {
        name: "Ada",
      });
      const beforeEvent = await t.query(getWaitingHelloStatus, {
        workflowId,
      });

      expect(beforeEvent).toEqual({
        type: "inProgress",
        running: expect.any(Array),
      });

      globalThis.setTimeout = (() => 0) as unknown as typeof globalThis.setTimeout;
      await t.mutation(sendWaitingHelloApproval, {
        workflowId,
        greeting: "Welcome",
      });
      globalThis.setTimeout = originalSetTimeout;
      await t.mutation(runWaitingHelloWorkflow, {
        workflowId,
        generationNumber: 0,
      });

      const afterEvent = await t.query(getWaitingHelloStatus, {
        workflowId,
      });

      expect(afterEvent).toEqual({
        type: "completed",
        result: "Welcome, Ada!",
      });
    } finally {
      globalThis.Date = originalDate;
      globalThis.setTimeout = originalSetTimeout;
      globalThis.setInterval = originalSetInterval;
    }
  });

  test("restarts a failed workflow through the public adapter", async () => {
    const t = initTest();

    const workflowId = await (t as any).runInComponent("workflow", async (ctx: any) => {
      return await ctx.db.insert("workflows", {
        name: "hello:startAsyncFailingHello",
        workflowHandle: "function://;hello:helloWorkflow",
        args: { name: "restart-once" },
        generationNumber: 0,
        runResult: {
          kind: "failed",
          error: "Workflow failed for restart-once",
        },
      });
    });

    const failedStatus = await t.query(getFailingHelloStatus, {
      workflowId,
    });
    expect(failedStatus).toEqual({
      type: "failed",
      error: "Workflow failed for restart-once",
    });

    await t.mutation(restartFailingHello, {
      workflowId,
    });

    const restartedStatus = await t.query(getFailingHelloStatus, {
      workflowId,
    });
    expect(restartedStatus).toEqual({
      type: "completed",
      result: "Hello, restart-once!",
    });
  });

  test("cleans up a canceled workflow through the public adapter", async () => {
    const t = initTest();

    const workflowId = await (t as any).runInComponent("workflow", async (ctx: any) => {
      return await ctx.db.insert("workflows", {
        name: "hello:startAsyncHello",
        workflowHandle: "function://;hello:helloWorkflow",
        args: { name: "Linus" },
        generationNumber: 0,
      });
    });

    await t.mutation(cancelHello, {
      workflowId,
    });

    const cleaned = await t.mutation(cleanupHello, {
      workflowId,
    });
    expect(cleaned).toBe(true);
  });
});
