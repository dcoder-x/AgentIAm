import { describe, it, expect } from "vitest";
import { renderBodyTemplate, renderDefaultBody, contentTypeFor } from "../src/auth/bodyTemplate.js";

const values = { identifier: "admin@test.local", secret: "s3cret" };

describe("renderDefaultBody", () => {
  it("reproduces the legacy JSON shape when no template is given", () => {
    expect(renderDefaultBody(values, "json")).toBe(
      JSON.stringify({ identifier: values.identifier, secret: values.secret })
    );
  });

  it("produces URLSearchParams-equivalent encoding for form-urlencoded", () => {
    const body = renderDefaultBody(values, "form-urlencoded");
    expect(body).toBe(
      new URLSearchParams({ identifier: values.identifier, secret: values.secret }).toString()
    );
  });
});

describe("renderBodyTemplate — json", () => {
  it("substitutes placeholders into a custom template", () => {
    const template = `{"email":"{{identifier}}","password":"{{secret}}"}`;
    const rendered = renderBodyTemplate(template, values, "json");
    expect(JSON.parse(rendered)).toEqual({ email: values.identifier, password: values.secret });
  });

  it("escapes quotes, backslashes, and newlines so the result stays valid JSON", () => {
    const trickyValues = { identifier: 'ad"min\\test\n', secret: 'p"a\\ss\n' };
    const template = `{"email":"{{identifier}}","password":"{{secret}}"}`;
    const rendered = renderBodyTemplate(template, trickyValues, "json");
    expect(() => JSON.parse(rendered)).not.toThrow();
    expect(JSON.parse(rendered)).toEqual({
      email: trickyValues.identifier,
      password: trickyValues.secret,
    });
  });

  it("throws a clear error when the template produces invalid JSON", () => {
    // placeholder not wrapped in quotes -- author error
    const badTemplate = `{"email":{{identifier}},"password":"{{secret}}"}`;
    expect(() => renderBodyTemplate(badTemplate, values, "json")).toThrow(
      /did not produce valid JSON/
    );
  });
});

describe("renderBodyTemplate — form-urlencoded", () => {
  it("substitutes placeholders into a custom template", () => {
    const template = "grant_type=password&username={{identifier}}&password={{secret}}";
    const rendered = renderBodyTemplate(template, values, "form-urlencoded");
    const parsed = new URLSearchParams(rendered);
    expect(parsed.get("username")).toBe(values.identifier);
    expect(parsed.get("password")).toBe(values.secret);
    expect(parsed.get("grant_type")).toBe("password");
  });

  it("percent-encodes ampersands and equals signs so values cannot inject extra fields", () => {
    const trickyValues = { identifier: "a&b=c", secret: "x&y=z" };
    const template = "username={{identifier}}&password={{secret}}";
    const rendered = renderBodyTemplate(template, trickyValues, "form-urlencoded");
    const parsed = new URLSearchParams(rendered);
    expect(parsed.get("username")).toBe(trickyValues.identifier);
    expect(parsed.get("password")).toBe(trickyValues.secret);
    // exactly two fields, not more
    expect([...parsed.keys()]).toEqual(["username", "password"]);
  });
});

describe("contentTypeFor", () => {
  it("returns application/json for json encoding", () => {
    expect(contentTypeFor("json")).toBe("application/json");
  });

  it("returns application/x-www-form-urlencoded for form-urlencoded encoding", () => {
    expect(contentTypeFor("form-urlencoded")).toBe("application/x-www-form-urlencoded");
  });
});
