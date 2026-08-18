// v3 — not implemented yet.
// Planned: delete a previously created test identity and its data,
// and log the teardown for the per-run audit trail. Prevents test
// data from accumulating in staging databases over time.

export const teardownIdentityToolDefinition = {
  name: "teardown_identity",
  description: "[NOT YET IMPLEMENTED — planned for v3] Delete a test identity created by create_identity and log the teardown.",
  inputSchema: {
    type: "object" as const,
    properties: {
      app: { type: "string" },
      identityId: { type: "string" },
    },
    required: ["app", "identityId"],
  },
};

export async function handleTeardownIdentity() {
  return {
    content: [
      {
        type: "text" as const,
        text: "teardown_identity is not implemented in v1. See the AgentIAm product spec for the v3 plan.",
      },
    ],
    isError: true,
  };
}
