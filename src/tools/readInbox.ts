// v2 — not implemented yet.
// Planned: project-scoped disposable inbox (run-<id>@project.agentiam.dev)
// that create_identity can use to receive and read confirmation
// links / OTP codes during signup verification.

export const readInboxToolDefinition = {
  name: "read_inbox",
  description: "[NOT YET IMPLEMENTED — planned for v2] Read a disposable, project-scoped inbox for verification emails/codes.",
  inputSchema: {
    type: "object" as const,
    properties: {
      inboxId: { type: "string" },
    },
    required: ["inboxId"],
  },
};

export async function handleReadInbox() {
  return {
    content: [
      {
        type: "text" as const,
        text: "read_inbox is not implemented in v1. See the AgentIAm product spec for the v2 plan.",
      },
    ],
    isError: true,
  };
}
