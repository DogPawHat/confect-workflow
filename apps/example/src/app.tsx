import { useAction, useMutation, useQuery } from "@confect/react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import * as React from "react";

import refs from "../confect/_generated/refs.js";

const NoteList = React.lazy(() => import("./components/note-list.js"));
const WorkflowPanel = React.lazy(() => import("./components/workflow-panel.js"));
const HttpEndpoints = React.lazy(() => import("./components/http-endpoints.js"));
export function App() {
  const convexClient = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

  return (
    <ConvexProvider client={convexClient}>
      <React.Suspense fallback={<p>Loading sections…</p>}>
        <Page />
      </React.Suspense>
    </ConvexProvider>
  );
}

const useRetrevedRandomNumber = () => {
  const [randomNumber, setRandomNumber] = React.useState<number | null>(null);
  const getRandom = useAction(refs.public.notesAndRandom.random.getNumber);

  const retrieveRandomNumber = React.useCallback(() => {
    void getRandom({}).then(setRandomNumber);
  }, [getRandom]);

  React.useEffect(() => {
    void getRandom({}).then(setRandomNumber);
  }, []);

  return [randomNumber, retrieveRandomNumber] as const;
};

const Page = () => {
  const [note, setNote] = React.useState("");
  const insertNote = useMutation(refs.public.notesAndRandom.notes.insert);

  const [randomNumber, retrieveRandomNumber] = useRetrevedRandomNumber();

  const [emailStatus, setEmailStatus] = React.useState<string | null>(null);
  const sendEmail = useAction(refs.public.node.email.send);

  const testEmail = () => {
    setEmailStatus("Sending…");
    void sendEmail({
      to: "test@example.com",
      subject: "Test email",
      body: "Test email body",
    })
      .then(() => setEmailStatus("Sent!"))
      .catch((error) => setEmailStatus(`Error: ${String(error)}`));
  };

  const envVar = useQuery(refs.public.env.readEnvVar, {});

  return (
    <div>
      <h1>Confect Example</h1>

      <div>
        <span style={{ fontFamily: "monospace" }}>TEST_ENV_VAR: </span>
        {envVar === undefined ? "Loading…" : envVar}
      </div>

      <br />

      <div>
        Random number: {randomNumber ? randomNumber : "Loading…"}
        <br />
        <button type="button" onClick={retrieveRandomNumber}>
          Get new random number
        </button>
      </div>

      <br />

      <div>
        <button type="button" onClick={testEmail}>
          Test email send
        </button>
        {emailStatus && <span style={{ marginLeft: 8 }}>{emailStatus}</span>}
      </div>

      <br />

      <textarea rows={4} cols={50} value={note} onChange={(e) => setNote(e.target.value)} />
      <br />
      <button type="button" onClick={() => void insertNote({ text: note }).then(() => setNote(""))}>
        Insert note
      </button>

      <NoteList />
      <WorkflowPanel />
      <HttpEndpoints />
    </div>
  );
};
