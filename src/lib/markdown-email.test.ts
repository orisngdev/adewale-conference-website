import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { markdownToEmailHtml } from "./markdown-email";

// This is the only place admin-authored text becomes raw HTML, so the escaping
// tests matter more than the formatting ones.
describe("markdownToEmailHtml escaping", () => {
  it("neutralises a script tag", () => {
    const html = markdownToEmailHtml("<script>alert(1)</script>");
    assert.ok(!html.includes("<script"), "no live script tag");
    assert.ok(html.includes("&lt;script&gt;"), "rendered as text instead");
  });

  it("neutralises an event-handler attribute", () => {
    const html = markdownToEmailHtml('<img src=x onerror="alert(1)">');
    // The handler text survives — but only as escaped body text, with no tag
    // around it for a client to hang the handler on.
    assert.ok(!html.includes("<img"), "no live img tag");
    assert.ok(html.includes("&lt;img"), "the tag is escaped into text");
    assert.ok(html.includes("&quot;alert(1)&quot;"), "its quotes are escaped too");
  });

  it("escapes every dangerous character", () => {
    const html = markdownToEmailHtml(`5 < 6 & 7 > 2 "quoted" 'single'`);
    assert.ok(html.includes("&lt;"));
    assert.ok(html.includes("&gt;"));
    assert.ok(html.includes("&amp;"));
    assert.ok(html.includes("&quot;"));
    assert.ok(html.includes("&#39;"));
  });

  it("refuses a javascript: link but keeps its label", () => {
    const html = markdownToEmailHtml("[click me](javascript:alert(1))");
    assert.ok(!html.includes("href"), "no anchor at all");
    assert.ok(html.includes("click me"), "label survives as text");
  });

  it("refuses a data: link", () => {
    const html = markdownToEmailHtml("[x](data:text/html,<script>alert(1)</script>)");
    assert.ok(!html.includes("href"));
    assert.ok(!html.includes("<script"));
  });

  it("refuses a vbscript: link", () => {
    const html = markdownToEmailHtml("[x](vbscript:msgbox)");
    assert.ok(!html.includes("href"));
  });

  it("escapes markup inside a link label", () => {
    const html = markdownToEmailHtml("[<b>bold</b>](https://example.com)");
    assert.ok(html.includes('href="https://example.com"'));
    assert.ok(!html.includes("<b>"));
  });
});

describe("markdownToEmailHtml formatting", () => {
  it("renders the three heading levels with inline styles", () => {
    assert.match(markdownToEmailHtml("# Title"), /<h3 style="[^"]+">Title<\/h3>/);
    assert.match(markdownToEmailHtml("## Sub"), /<h4 style="[^"]+">Sub<\/h4>/);
    assert.match(markdownToEmailHtml("### Small"), /<h5 style="[^"]+">Small<\/h5>/);
  });

  it("renders a bullet list", () => {
    const html = markdownToEmailHtml("- one\n- two");
    assert.match(html, /<ul style="[^"]+">/);
    assert.equal(html.match(/<li /g)?.length, 2);
    assert.ok(html.includes("one"));
    assert.ok(html.includes("two"));
  });

  it("renders an ordered list", () => {
    const html = markdownToEmailHtml("1. first\n2. second");
    assert.match(html, /<ol style="[^"]+">/);
    assert.equal(html.match(/<li /g)?.length, 2);
  });

  it("renders bold, italic and code", () => {
    assert.match(markdownToEmailHtml("**loud**"), /<strong style="[^"]+">loud<\/strong>/);
    assert.match(markdownToEmailHtml("*soft*"), /<em>soft<\/em>/);
    assert.match(markdownToEmailHtml("`code`"), /<code style="[^"]+">code<\/code>/);
  });

  it("renders an http link with an inline style", () => {
    const html = markdownToEmailHtml("[ASC](https://adewaleconference.org)");
    assert.match(html, /<a href="https:\/\/adewaleconference\.org" style="[^"]+">ASC<\/a>/);
  });

  it("renders a mailto link", () => {
    const html = markdownToEmailHtml("[write us](mailto:hello@adewaleconference.org)");
    assert.ok(html.includes('href="mailto:hello@adewaleconference.org"'));
  });

  it("keeps a query string intact in a link", () => {
    const html = markdownToEmailHtml("[go](https://example.com/a?b=1&c=2)");
    assert.ok(html.includes('href="https://example.com/a?b=1&amp;c=2"'));
  });

  it("splits paragraphs on blank lines and keeps single newlines as breaks", () => {
    const html = markdownToEmailHtml("one\ntwo\n\nthree");
    assert.equal(html.match(/<p /g)?.length, 2);
    assert.ok(html.includes("<br />"));
  });

  it("renders a fenced code block without treating its blank lines as paragraphs", () => {
    const html = markdownToEmailHtml("```\nline one\n\nline two\n```");
    assert.equal(html.match(/<pre /g)?.length, 1);
    assert.ok(html.includes("line one"));
    assert.ok(html.includes("line two"));
  });

  it("leaves unrecognised syntax as literal text", () => {
    const html = markdownToEmailHtml("a ~~strike~~ and a | table |");
    assert.ok(html.includes("~~strike~~"));
    assert.ok(html.includes("| table |"));
  });

  it("returns an empty string for empty or whitespace-only input", () => {
    assert.equal(markdownToEmailHtml(""), "");
    assert.equal(markdownToEmailHtml("   \n\n  "), "");
    assert.equal(markdownToEmailHtml(null), "");
    assert.equal(markdownToEmailHtml(undefined), "");
  });

  it("never emits an unclosed or stray tag for ordinary prose", () => {
    const html = markdownToEmailHtml("Hello there.\n\n- a\n- b\n\n## End");
    // Tag names can carry a digit (h4), so the patterns must allow one.
    const opens = html.match(/<(?!\/)[a-z][a-z0-9]*/g)?.length ?? 0;
    // Every tag we emit is paired except the <br /> self-closer.
    const closes = html.match(/<\/[a-z][a-z0-9]*>/g)?.length ?? 0;
    const selfClosing = html.match(/<br \/>/g)?.length ?? 0;
    assert.equal(opens - selfClosing, closes);
  });
});
