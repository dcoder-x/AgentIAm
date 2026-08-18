export type ErrorKind = "config" | "target_app";

/**
 * Base for errors that originate from get_session's login flow, tagged
 * with a kind so callers (MCP tool handlers) can classify a failure
 * without regexing the message.
 */
export class AgentIAmError extends Error {
  readonly kind: ErrorKind;

  constructor(kind: ErrorKind, message: string) {
    super(message);
    this.name = "AgentIAmError";
    this.kind = kind;
  }
}

/** User/config mistakes: unknown app/role, unsupported auth type, bad URL. */
export class TargetConfigError extends AgentIAmError {
  constructor(message: string) {
    super("config", message);
    this.name = "TargetConfigError";
  }
}

/** The target app itself misbehaved: non-2xx response, timeout, network failure, token not found at path. */
export class TargetAppError extends AgentIAmError {
  constructor(message: string) {
    super("target_app", message);
    this.name = "TargetAppError";
  }
}
