import { FetchHttpClient, HttpApiClient } from "@effect/platform";
import { Effect, Exit } from "effect";
import * as React from "react";

import { Api } from "../../confect/path-prefix.http.js";

const ApiClient = HttpApiClient.make(Api, {
  baseUrl: import.meta.env.VITE_CONVEX_URL.replace("convex.cloud", "convex.site"),
});

const getFirst = ApiClient.pipe(
  Effect.andThen((client) => client.notes.getFirst()),
  Effect.scoped,
  Effect.provide(FetchHttpClient.layer),
);

function HttpEndpoints() {
  const [getResponse, setGetResponse] = React.useState<Exit.Exit<any, any> | null>(null);

  return (
    <div>
      <button
        type="button"
        onClick={() => getFirst.pipe(Effect.runPromiseExit).then((exit) => setGetResponse(exit))}
      >
        HTTP GET /path-prefix/get-first
      </button>
      <p>
        {getResponse
          ? Exit.match(getResponse, {
              onSuccess: (value) => JSON.stringify(value),
              onFailure: (error) => JSON.stringify(error),
            })
          : "No response yet"}
      </p>
    </div>
  );
}

export default HttpEndpoints;
