import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkUploadConfiguration,
  providerUploadError,
  UploadError,
} from "./uploads.js";

test("upload configuration validates every Cloudinary variable", () => {
  const names = [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ];
  const original = names.map((n) => process.env[n]);
  try {
    names.forEach((n) => (process.env[n] = "test"));
    for (const name of names) {
      process.env[name] = " ";
      assert.throws(
        checkUploadConfiguration,
        (e: unknown) =>
          e instanceof UploadError &&
          e.status === 503 &&
          e.message.includes(name),
      );
      process.env[name] = "test";
    }
    assert.doesNotThrow(checkUploadConfiguration);
  } finally {
    names.forEach((n, i) => {
      if (original[i] === undefined) delete process.env[n];
      else process.env[n] = original[i];
    });
  }
});
test("provider failures return actionable errors without leaking provider messages", () => {
  const cases: [unknown, number][] = [
    [{ http_code: 401, message: "invalid key private-value" }, 503],
    [{ http_code: 400, message: "Invalid Signature private-value" }, 503],
    [{ http_code: 400, message: "unsupported file" }, 400],
    [{ http_code: 429 }, 503],
    [{ code: "ETIMEDOUT" }, 504],
    [new Error("private-value"), 502],
  ];
  for (const [source, status] of cases) {
    const result = providerUploadError(source);
    assert.equal(result.status, status);
    assert.equal(result.message.includes("private-value"), false);
  }
});
