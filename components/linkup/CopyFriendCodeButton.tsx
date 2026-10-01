"use client";

import { useState } from "react";

type Props = { code: string };

export default function CopyFriendCodeButton({ code }: Props) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" onClick={copyCode} className="nightly-btn-secondary min-h-10 rounded-full px-3 text-xs">
      {copied ? "Copied" : "Copy code"}
    </button>
  );
}
