export type BodyEncoding = "json" | "form-urlencoded";

export interface BodyTemplateValues {
  identifier: string;
  secret: string;
}

const PLACEHOLDER_RE = /\{\{(identifier|secret)\}\}/g;

function jsonEscape(value: string): string {
  // JSON.stringify produces a fully quoted, escaped JSON string literal
  // (e.g. `"a\"b"`); slicing off the outer quotes leaves only the safely
  // escaped inner content, to be substituted between the quotes the
  // template author already wrote around the placeholder.
  return JSON.stringify(value).slice(1, -1);
}

function formUrlEscape(value: string): string {
  return encodeURIComponent(value);
}

/**
 * Substitutes {{identifier}}/{{secret}} placeholders into a login request
 * body template, escaping each value for the target encoding so values
 * containing quotes, backslashes, ampersands, etc. cannot break the
 * resulting structure or inject extra fields.
 *
 * The template author is responsible for surrounding JSON placeholders
 * with their own quotes, e.g. `{"email":"{{identifier}}"}`.
 */
export function renderBodyTemplate(
  template: string,
  values: BodyTemplateValues,
  encoding: BodyEncoding
): string {
  const escape = encoding === "json" ? jsonEscape : formUrlEscape;
  const rendered = template.replace(PLACEHOLDER_RE, (_match, key: keyof BodyTemplateValues) =>
    escape(values[key])
  );

  if (encoding === "json") {
    try {
      JSON.parse(rendered);
    } catch (err) {
      throw new Error(
        `bodyTemplate did not produce valid JSON after substituting identifier/secret: ` +
        `${(err as Error).message}. Check that placeholders are inside quotes.`
      );
    }
  }

  return rendered;
}

/** Builds the legacy (pre-bodyTemplate) request body for backward compat. */
export function renderDefaultBody(values: BodyTemplateValues, encoding: BodyEncoding): string {
  if (encoding === "form-urlencoded") {
    return new URLSearchParams({ identifier: values.identifier, secret: values.secret }).toString();
  }
  return JSON.stringify({ identifier: values.identifier, secret: values.secret });
}

export function contentTypeFor(encoding: BodyEncoding): string {
  return encoding === "form-urlencoded"
    ? "application/x-www-form-urlencoded"
    : "application/json";
}
