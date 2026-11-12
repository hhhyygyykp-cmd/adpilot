import assert from "node:assert/strict";
import { test } from "node:test";
import { sanitizeDrawtext } from "../src/lib/media/compose-video.ts";

test("video overlay text cannot inject extra FFmpeg filters", () => {
  const injected = sanitizeDrawtext("Sale;[malicious]scale=1,movie=/etc/passwd");
  assert.equal(injected.includes(";"), false);
  assert.equal(injected.includes("["), false);
  assert.equal(injected.includes("]"), false);
  assert.equal(injected.includes(","), false);
  assert.equal(injected.includes("="), false);
  assert.equal(injected.includes("'"), false);
  assert.match(injected, /Sale/);

  const quotes = sanitizeDrawtext("It's 50% off: buy now");
  assert.equal(quotes.includes("'"), false);
  assert.equal(quotes.includes(":"), false);
  assert.match(quotes, /50\\%/);

  const control = sanitizeDrawtext("Hello\nWorld\u0000[v]");
  assert.equal(control.includes("\n"), false);
  assert.equal(control.includes("["), false);
  assert.equal(control.length <= 80, true);
});
