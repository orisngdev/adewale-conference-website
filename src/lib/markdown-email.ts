// The email-side twin of src/components/portal/markdown.tsx. That component
// builds React elements, so it is XSS-safe by construction and cannot produce
// the HTML string an email body needs. This module produces that string — which
// makes it the ONE place where admin-authored text becomes raw HTML, so it
// escapes first and only then adds markup, and it is the most heavily tested
// function in the module.
//
// Supports the same subset the portal renderer does: headings (#, ##, ###),
// bullet + ordered lists, **bold**, *italic*, `code` and [links](url).
// Everything else survives as literal text. Styles are inline because email
// clients treat <style> blocks inconsistently.

const TEXT = "#4A4E5C";
const INK = "#0A0F1E";

const P_STYLE = `margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:${TEXT};`;
const H1_STYLE = `margin:22px 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;line-height:28px;color:${INK};`;
const H2_STYLE = `margin:20px 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:bold;line-height:26px;color:${INK};`;
const H3_STYLE = `margin:18px 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;line-height:24px;color:${INK};`;
const LIST_STYLE = `margin:0 0 14px;padding-left:22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:${TEXT};`;
const LI_STYLE = "margin:0 0 6px;";
const CODE_STYLE = `font-family:monospace;font-size:14px;background:#F0EAD8;padding:1px 4px;color:${INK};`;
const PRE_STYLE = `margin:0 0 14px;padding:12px;background:#F0EAD8;font-family:monospace;font-size:13px;line-height:20px;color:${INK};white-space:pre-wrap;`;
const LINK_STYLE = "color:#8A5E0E;text-decoration:underline;";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Only http(s) and mailto links become anchors. A javascript:, data: or vbscript:
 * href renders as plain text instead — the link label is kept so the reader still
 * sees what was written.
 */
function safeHref(href: string): string | null {
  const trimmed = href.trim();
  if (!/^(https?:|mailto:)/i.test(trimmed)) return null;
  // Reject anything with control characters or quotes that could break out of
  // the attribute even after escaping.
  if (/[\s"'<>]/.test(trimmed)) return null;
  return trimmed;
}

// Matches the inline tokens the portal renderer supports. Runs against the
// ALREADY-ESCAPED string, so the literal characters here are safe.
const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

function renderInline(escaped: string): string {
  return escaped.replace(INLINE, (token) => {
    if (token.startsWith("**")) {
      return `<strong style="color:${INK};">${token.slice(2, -2)}</strong>`;
    }
    if (token.startsWith("`")) {
      return `<code style="${CODE_STYLE}">${token.slice(1, -1)}</code>`;
    }
    if (token.startsWith("*")) {
      return `<em>${token.slice(1, -1)}</em>`;
    }
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
    if (!link) return token;
    // The href was escaped along with everything else; &amp; must go back to a
    // bare & inside the attribute value's URL, which we then re-escape.
    const rawHref = link[2].replace(/&amp;/g, "&");
    const href = safeHref(rawHref);
    if (!href) return link[1];
    return `<a href="${escapeHtml(href)}" style="${LINK_STYLE}">${link[1]}</a>`;
  });
}

function renderProse(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n");
      const escapedLines = lines.map(escapeHtml);

      const heading = /^(#{1,3})\s+(.*)$/.exec(block);
      if (heading && lines.length === 1) {
        const inner = renderInline(escapeHtml(heading[2]));
        const level = heading[1].length;
        if (level === 1) return `<h3 style="${H1_STYLE}">${inner}</h3>`;
        if (level === 2) return `<h4 style="${H2_STYLE}">${inner}</h4>`;
        return `<h5 style="${H3_STYLE}">${inner}</h5>`;
      }

      if (lines.every((line) => /^[-*]\s+/.test(line))) {
        const items = escapedLines
          .map((line) => line.replace(/^[-*]\s+/, ""))
          .map((line) => `<li style="${LI_STYLE}">${renderInline(line)}</li>`)
          .join("");
        return `<ul style="${LIST_STYLE}">${items}</ul>`;
      }

      if (lines.every((line) => /^\d+\.\s+/.test(line))) {
        const items = escapedLines
          .map((line) => line.replace(/^\d+\.\s+/, ""))
          .map((line) => `<li style="${LI_STYLE}">${renderInline(line)}</li>`)
          .join("");
        return `<ol style="${LIST_STYLE}">${items}</ol>`;
      }

      const body = escapedLines.map((line) => renderInline(line)).join("<br />");
      return `<p style="${P_STYLE}">${body}</p>`;
    })
    .join("");
}

/**
 * Render admin-authored markdown as an email-safe HTML fragment. Returns "" for
 * empty or whitespace-only input, so a caller can drop the section entirely.
 */
export function markdownToEmailHtml(source: string | null | undefined): string {
  const text = (source ?? "").replace(/\r\n/g, "\n");
  if (!text.trim()) return "";

  // Pull fenced code blocks out first: a fence can contain the blank lines the
  // prose renderer treats as paragraph breaks.
  const lines = text.split("\n");
  const out: string[] = [];
  let prose: string[] = [];
  const flush = () => {
    if (prose.length) out.push(renderProse(prose.join("\n")));
    prose = [];
  };

  for (let i = 0; i < lines.length; ) {
    if (/^\s*```/.test(lines[i])) {
      flush();
      i++;
      const code: string[] = [];
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) code.push(lines[i++]);
      i++; // skip the closing fence
      out.push(`<pre style="${PRE_STYLE}">${escapeHtml(code.join("\n"))}</pre>`);
    } else {
      prose.push(lines[i++]);
    }
  }
  flush();

  return out.join("");
}
