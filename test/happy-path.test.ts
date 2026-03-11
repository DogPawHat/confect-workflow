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
  }
>("hello:getHelloStatus");

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
});
