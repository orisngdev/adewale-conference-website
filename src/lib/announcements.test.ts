import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_INLINE_ATTACHMENT_BYTES,
  announcementPath,
  isAllowedAnnouncementFile,
  mapAnnouncement,
  selectInlineAttachments,
  type AnnouncementRow,
} from "./announcements";

const MB = 1024 * 1024;

describe("isAllowedAnnouncementFile", () => {
  it("accepts documents and images with a plausible, empty or generic MIME", () => {
    assert.equal(isAllowedAnnouncementFile("guide.pdf", "application/pdf"), true);
    assert.equal(
      isAllowedAnnouncementFile(
        "notes.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
      true,
    );
    assert.equal(isAllowedAnnouncementFile("flyer.png", "image/png"), true);
    assert.equal(isAllowedAnnouncementFile("flyer.jpg", "image/jpeg"), true);
    // Browsers report these inconsistently, so an empty or generic MIME is fine.
    assert.equal(isAllowedAnnouncementFile("deck.pptx", ""), true);
    assert.equal(isAllowedAnnouncementFile("sheet.xlsx", "application/octet-stream"), true);
  });

  it("rejects executables, SVG and files with no extension", () => {
    assert.equal(isAllowedAnnouncementFile("payload.exe", "application/octet-stream"), false);
    // SVG can carry script, so it stays out even though it is an image.
    assert.equal(isAllowedAnnouncementFile("logo.svg", "image/svg+xml"), false);
    assert.equal(isAllowedAnnouncementFile("README", ""), false);
    assert.equal(isAllowedAnnouncementFile("", ""), false);
  });

  it("rejects a document extension paired with an obviously different MIME", () => {
    assert.equal(isAllowedAnnouncementFile("report.pdf", "text/html"), false);
  });

  it("ignores the case of the extension", () => {
    assert.equal(isAllowedAnnouncementFile("GUIDE.PDF", "application/pdf"), true);
  });
});

describe("selectInlineAttachments", () => {
  const file = (id: string, sizeBytes: number) => ({
    id,
    fileName: `${id}.pdf`,
    sizeBytes,
  });

  it("keeps everything inline when it fits both caps", () => {
    const { inline, linkOnly } = selectInlineAttachments([file("a", MB), file("b", 2 * MB)]);
    assert.deepEqual(
      inline.map((f) => f.id),
      ["a", "b"],
    );
    assert.deepEqual(linkOnly, []);
  });

  it("leaves an oversized file for portal download and keeps the rest inline", () => {
    const { inline, linkOnly } = selectInlineAttachments([
      file("big", 8 * MB),
      file("small", MB),
    ]);
    assert.deepEqual(
      inline.map((f) => f.id),
      ["small"],
    );
    assert.deepEqual(
      linkOnly.map((f) => f.id),
      ["big"],
    );
  });

  it("stops going inline once the running total is spent, in the given order", () => {
    const { inline, linkOnly } = selectInlineAttachments([
      file("one", 5 * MB),
      file("two", 5 * MB),
      file("three", 5 * MB),
    ]);
    assert.deepEqual(
      inline.map((f) => f.id),
      ["one", "two"],
    );
    assert.deepEqual(
      linkOnly.map((f) => f.id),
      ["three"],
    );
  });

  it("treats a file exactly at the per-file cap as inline", () => {
    const { inline } = selectInlineAttachments([file("edge", MAX_INLINE_ATTACHMENT_BYTES)]);
    assert.equal(inline.length, 1);
  });

  it("treats a zero-byte or unknown-size file as portal-only rather than attaching nothing", () => {
    const { inline, linkOnly } = selectInlineAttachments([file("empty", 0)]);
    assert.deepEqual(inline, []);
    assert.equal(linkOnly.length, 1);
  });

  it("loses nothing: every file lands in exactly one bucket", () => {
    const files = [file("a", MB), file("b", 9 * MB), file("c", 0), file("d", 4 * MB)];
    const { inline, linkOnly } = selectInlineAttachments(files);
    assert.equal(inline.length + linkOnly.length, files.length);
    const ids = [...inline, ...linkOnly].map((f) => f.id).sort();
    assert.deepEqual(ids, ["a", "b", "c", "d"]);
  });

  it("handles an empty list", () => {
    assert.deepEqual(selectInlineAttachments([]), { inline: [], linkOnly: [] });
  });
});

describe("announcementPath", () => {
  it("is the one spelling shared by the notification link and its cleanup", () => {
    assert.equal(announcementPath("abc-123"), "/portal/announcements/abc-123");
  });
});

describe("mapAnnouncement", () => {
  function row(over: Partial<AnnouncementRow> = {}): AnnouncementRow {
    return {
      id: "a1",
      title: "Venue change",
      body: "The zonal finals have moved.",
      channels: "both",
      target_role: "all",
      edition_year: 2026,
      status: "sent",
      sent_at: "2026-09-01T10:00:00Z",
      sent_by: "admin-1",
      recipient_count: 12,
      email_sent_count: 12,
      email_failed_count: 0,
      notified_count: 9,
      created_at: "2026-08-31T10:00:00Z",
      updated_at: "2026-09-01T10:00:00Z",
      ...over,
    };
  }

  it("keeps a missing edition year as null rather than coercing it to 0", () => {
    assert.equal(mapAnnouncement(row({ edition_year: null })).editionYear, null);
  });

  it("defaults a missing attachment list to an empty array", () => {
    assert.deepEqual(mapAnnouncement(row()).attachments, []);
    assert.deepEqual(mapAnnouncement(row({ announcement_attachments: null })).attachments, []);
  });

  it("falls back to safe defaults for unrecognised channel and target values", () => {
    const mapped = mapAnnouncement(row({ channels: "carrier-pigeon", target_role: "nobody" }));
    assert.equal(mapped.channels, "both");
    assert.equal(mapped.targetRole, "all");
  });

  it("treats anything other than 'sent' as a draft", () => {
    assert.equal(mapAnnouncement(row({ status: "draft", sent_at: null })).status, "draft");
    assert.equal(mapAnnouncement(row({ status: "weird" })).status, "draft");
  });

  it("defaults every null counter to 0", () => {
    const mapped = mapAnnouncement(
      row({
        recipient_count: null,
        email_sent_count: null,
        email_failed_count: null,
        notified_count: null,
      }),
    );
    assert.equal(mapped.recipientCount, 0);
    assert.equal(mapped.emailSentCount, 0);
    assert.equal(mapped.emailFailedCount, 0);
    assert.equal(mapped.notifiedCount, 0);
  });

  it("maps attachments to camelCase with a numeric size", () => {
    const mapped = mapAnnouncement(
      row({
        announcement_attachments: [
          { id: "f1", file_name: "guide.pdf", content_type: "application/pdf", size_bytes: null },
        ],
      }),
    );
    assert.deepEqual(mapped.attachments, [
      { id: "f1", fileName: "guide.pdf", contentType: "application/pdf", sizeBytes: 0 },
    ]);
  });
});
