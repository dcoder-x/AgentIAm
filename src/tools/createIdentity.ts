// v2 — not implemented yet.
// Planned: infer the signup flow from the target codebase (routes,
// DTOs/schemas, validation rules), construct a valid signup request,
// retry using server validation errors, and confirm via read_inbox
// if the flow requires email/OTP verification.
//
// Deliberately stubbed rather than half-built: creation is the
// highest engineering-risk piece of AgentIAm (see product spec,
// "Development Strategy") and should only be built once v1 has
// real external usage.

export const createIdentityToolDefinition = {
  name: "create_identity",
  description: "[NOT YET IMPLEMENTED — planned for v2] Create a new test identity by inferring the app's signup flow.",
  inputSchema: {
    type: "object" as const,
    properties: {
      app: { type: "string" },
    },
    required: ["app"],
  },
};

export async function handleCreateIdentity() {
  return {
    content: [
      {
        type: "text" as const,
        text: "create_identity is not implemented in v1. See the AgentIAm product spec for the v2 plan.",
      },
    ],
    isError: true,
  };
}
