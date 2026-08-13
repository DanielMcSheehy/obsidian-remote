import { useState } from "react";
import { IconCheck, IconCopy } from "@tabler/icons-react";

export function CodeBlock({ language, children }: { language?: string; children: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  }
  return (
    <div className="code-block">
      <div className="code-block-bar">
        <span className="code-block-lang">{language || "text"}</span>
        <button type="button" className="code-block-copy" onClick={copy} aria-label="Copy">
          {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>
        <code>{children}</code>
      </pre>
    </div>
  );
}
