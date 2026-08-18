import { z } from "zod";
import { getOrRefreshSession } from "../auth/sessionProvider.js";
import type { ValidatedConfig } from "../config/schema.js";

export const getSessionInputSchema = z.object({
  app: z.string().describe("Name of the app as defined in agentiam.config.yaml"),
  role: z.string().describe("Name of the role/test user to authenticate as, e.g. \"admin\""),
});

export const getSessionToolDefinition = {
  name: "get_session",
  description:
    "Get a valid auth token/session for a configured test role on a configured app. " +
    "Returns a cached session if still fresh, otherwise logs in fresh. " +
    "Use this instead of asking the human for a token.",
  inputSchema: {
    type: "object" as const,
    properties: {
      app: { type: "string", description: "Name of the app as defined in agentiam.config.yaml" },
      role: { type: "string", description: "Name of the role/test user, e.g. \"admin\"" },
    },
    required: ["app", "role"],
  },
};

export async function handleGetSession(config: ValidatedConfig, args: unknown) {
  const { app, role } = getSessionInputSchema.parse(args);
  const session = await getOrRefreshSession(config, app, role);

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            app: session.app,
            role: session.role,
            token: session.token,
            headerName: session.headerName,
            expiresAt: new Date(session.expiresAt).toISOString(),
            cached: session.cached,
          },
          null,
          2
        ),
      },
    ],
  };
}
