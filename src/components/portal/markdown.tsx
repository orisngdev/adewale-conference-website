import React from "react";
import CopyCode from "@/components/portal/copy-code";

// Minimal, dependency-free markdown for admin-authored lesson notes. Supports
// headings (#, ##, ###), bullet + ordered lists, **bold**, *italic*, `code`,
// and [links](url). Output is built as React elements (never
// dangerouslySetInnerHTML), so it is XSS-safe by construction — unrecognised
// syntax renders as plain text.

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = new RegExp(INLINE);
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyPrefix}-${i++}`;
    if (tok.startsWith("**")) {
      nodes.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("`")) {
      nodes.push(
        <code key={key} className="px-1 py-0.5 rounded bg-foreground/6 text-[0.9em]">
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (tok.startsWith("*")) {
      nodes.push(<em key={key}>{tok.slice(1, -1)}</em>);
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok);
      if (link) {
        const href = link[2];
        const external = /^https?:\/\//.test(href);
        nodes.push(
          <a
            key={key}
            href={href}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            className="text-primary underline underline-offset-2"
          >
            {link[1]}
          </a>,
        );
      } else {
        nodes.push(tok);
      }
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

// Render a run of prose (no fenced code) — headings, lists, paragraphs.
function renderProse(text: string, keyBase: string): React.ReactNode[] {
  return text
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((block, bi) => {
      const key = `${keyBase}-${bi}`;
      const lines = block.split("\n");

      const heading = /^(#{1,3})\s+(.*)$/.exec(block);
      if (heading && lines.length === 1) {
        const level = heading[1].length;
        const inner = renderInline(heading[2], key);
        if (level === 1) return <h3 key={key} className="font-bebas text-2xl text-foreground">{inner}</h3>;
        if (level === 2) return <h4 key={key} className="font-bebas text-xl text-foreground">{inner}</h4>;
        return <h5 key={key} className="font-bold text-foreground">{inner}</h5>;
      }

      if (lines.every((l) => /^[-*]\s+/.test(l))) {
        return (
          <ul key={key} className="list-disc pl-5 space-y-1">
            {lines.map((l, li) => (
              <li key={li}>{renderInline(l.replace(/^[-*]\s+/, ""), `${key}-${li}`)}</li>
            ))}
          </ul>
        );
      }

      if (lines.every((l) => /^\d+\.\s+/.test(l))) {
        return (
          <ol key={key} className="list-decimal pl-5 space-y-1">
            {lines.map((l, li) => (
              <li key={li}>{renderInline(l.replace(/^\d+\.\s+/, ""), `${key}-${li}`)}</li>
            ))}
          </ol>
        );
      }

      return (
        <p key={key}>
          {lines.map((l, li) => (
            <React.Fragment key={li}>
              {li > 0 ? <br /> : null}
              {renderInline(l, `${key}-${li}`)}
            </React.Fragment>
          ))}
        </p>
      );
    });
}

export function Markdown({ source, className = "" }: { source: string; className?: string }) {
  // Split into fenced code blocks (```) and prose runs. Fences are pulled out
  // first because a code block can itself contain the blank lines that the
  // prose renderer treats as paragraph breaks.
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const segments: ({ code: string } | { prose: string })[] = [];
  let prose: string[] = [];
  const flush = () => {
    if (prose.length) segments.push({ prose: prose.join("\n") });
    prose = [];
  };
  for (let i = 0; i < lines.length; ) {
    if (/^\s*```/.test(lines[i])) {
      flush();
      i++;
      const code: string[] = [];
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) code.push(lines[i++]);
      i++; // skip the closing fence
      segments.push({ code: code.join("\n") });
    } else {
      prose.push(lines[i++]);
    }
  }
  flush();

  return (
    <div className={`space-y-3 text-sm leading-relaxed text-foreground/90 ${className}`}>
      {segments.map((seg, si) =>
        "code" in seg ? (
          <CopyCode key={si} code={seg.code} />
        ) : (
          <React.Fragment key={si}>{renderProse(seg.prose, `s${si}`)}</React.Fragment>
        ),
      )}
    </div>
  );
}
