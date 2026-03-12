/// <reference types="vite/client" />

import workflowTest from "@convex-dev/workflow/test";
import { convexTest } from "convex-test";
import { defineSchema, makeFunctionReference } from "convex/server";
import { describe, expect, test } from "vitest";

const modules = import.meta.glob("./fixtures/**/*.ts");

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
  return t;
}

describe("bindWorkflow", () => {
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
