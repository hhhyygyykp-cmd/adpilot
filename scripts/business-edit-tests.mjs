import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBusinessEdit } from "../src/lib/conversation/business-edit.ts";

test("business edits name a field and a new value", () => {
  assert.deepEqual(parseBusinessEdit("Change the location to Dubai Marina"), {
    key: "location",
    value: "Dubai Marina",
  });
  assert.deepEqual(parseBusinessEdit("products are hoodies and caps"), {
    key: "productsServices",
    value: "hoodies and caps",
  });
  assert.deepEqual(parseBusinessEdit("We are based in Abu Dhabi"), {
    key: "location",
    value: "Abu Dhabi",
  });
  assert.equal(parseBusinessEdit("hello there"), null);
});
