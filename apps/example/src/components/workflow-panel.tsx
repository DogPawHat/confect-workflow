import { useMutation, useQuery } from "@confect/react";
import { useState } from "react";

import refs from "../../confect/_generated/refs.js";

function WorkflowPanel() {
  const [workflowText, setWorkflowText] = useState("Hello from workflow");
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const startWorkflow = useMutation(refs.public.workflows.startGenerateTaggedNote);
  const sendApproval = useMutation(refs.public.workflows.sendApprovalEvent);
  const cleanup = useMutation(refs.public.workflows.cleanupWorkflow);

  const handleStart = () => {
    void startWorkflow({ text: workflowText }).then((id) => {
      setWorkflowId(id);
    });
  };

  const handleApprove = () => {
    if (!workflowId) return;
    void sendApproval({ workflowId, approved: true });
  };

  const handleCleanup = () => {
    if (!workflowId) return;
    void cleanup({ workflowId }).then(() => {
      setWorkflowId(null);
    });
  };

  return (
    <div>
      <h2>Workflow Control Panel</h2>
      <input
        type="text"
        value={workflowText}
        onChange={(e) => setWorkflowText(e.target.value)}
        placeholder="Note text for workflow"
      />
      <button type="button" onClick={handleStart}>
        Start Workflow
      </button>
      {workflowId && (
        <div>
          <p>Workflow ID: {workflowId}</p>
          <WorkflowStatus workflowId={workflowId} />
          <button type="button" onClick={handleApprove}>
            Send Approval
          </button>
          <button type="button" onClick={handleCleanup}>
            Cleanup
          </button>
        </div>
      )}
    </div>
  );
}

const WorkflowStatus = ({ workflowId }: { workflowId: string }) => {
  const status = useQuery(refs.public.workflows.getWorkflowStatus, {
    workflowId,
  });

  return <p>Status: {status ? JSON.stringify(status) : "Loading..."}</p>;
};

export default WorkflowPanel;
