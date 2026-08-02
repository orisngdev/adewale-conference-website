import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { clampPage, filterFormQuery, pageBounds, parsePage } from "./list-controls";

describe("portal list pagination helpers", () => {
  it("parses invalid page params as page 1", () => {
    assert.equal(parsePage(undefined), 1);
    assert.equal(parsePage("0"), 1);
    assert.equal(parsePage("-3"), 1);
    assert.equal(parsePage("2.5"), 1);
    assert.equal(parsePage("abc"), 1);
    assert.equal(parsePage("3"), 3);
  });

  it("clamps requested pages to the available range", () => {
    assert.equal(clampPage(999, 4), 4);
    assert.equal(clampPage(2, 4), 2);
    assert.equal(clampPage(0, 4), 1);
    assert.equal(clampPage(3, 0), 1);
  });

  it("calculates inclusive Supabase ranges for one-based pages", () => {
    assert.deepEqual(pageBounds(1, 20), { from: 0, to: 19 });
    assert.deepEqual(pageBounds(3, 20), { from: 40, to: 59 });
  });

  it("builds clean filter queries from form submissions", () => {
    const formData = new FormData();
    formData.set("edition", "2026");
    formData.set("q", " Remo ");
    formData.set("status", "");
    formData.set("activation", " pending ");
    formData.set("page", "4");

    assert.equal(filterFormQuery(formData), "?edition=2026&q=Remo&activation=pending");
  });

  it("omits the query string when every filter is empty", () => {
    const formData = new FormData();
    formData.set("q", "");
    formData.set("role", "");
    formData.set("page", "2");

    assert.equal(filterFormQuery(formData), "");
  });

  it("drops whitespace-only filter values", () => {
    const formData = new FormData();
    formData.set("q", "   ");
    formData.set("role", " student ");

    assert.equal(filterFormQuery(formData), "?role=student");
  });
});
