"use client";
import { User, Globe, TrendingUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Multiple screenshots attached to a single user turn. */
  imageUrls?: string[];
  /** @deprecated use imageUrls */
  imageUrl?: string;
  toolCalls?: { tool: string; args: Record<string, unknown> }[];
  streaming?: boolean;
}

function ToolBadge({ tool, args }: { tool: string; args: Record<string, unknown> }) {
  const isStock = tool === "get_stock";
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono
      bg-violet-950/60 border border-violet-700/40 text-violet-300 mr-1 mb-1">
      {isStock ? <TrendingUp size={10} /> : <Globe size={10} />}
      {isStock ? `$${args.symbol}` : `"${String(args.query).slice(0, 32)}…"`}
    </span>
  );
}

function isStandaloneEquation(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.startsWith("$$") || trimmed.endsWith("$$")) return false;

  const expression = trimmed.replace(/^(?:[-*]\s+|\d+[.)]\s+)/, "");
  if (!expression.includes("=") || !/(?:\\(?:frac|sqrt|binom|sum|int|prod|lim|left|choose|over)|\^|_)/.test(expression)) return false;

  const withoutCommands = expression
    .replace(/\$/g, "")
    .replace(/\\[A-Za-z]+/g, "")
    .replace(/\b(?:sin|cos|tan|log|ln|max|min)\b/g, "");

  return !/\b[A-Za-z]{2,}\b/.test(withoutCommands);
}

function normalizeOutsideMath(text: string): string {
  const parts = text.split(/(\$\$(?:(?!\n\s*\n)[\s\S])*?\$\$|\$[^$\n]*\$)/g);
  return parts.map((part, index) => {
    if (index % 2 === 1) return part;
    return part.replace(
      /(?<![:/])\b([A-Za-z0-9]{1,3}\^\{?[A-Za-z0-9+\-]+\}?)/g,
      (_match, expression) => `$${expression}$`
    );
  }).join("");
}

// All LaTeX display-math environment names that need $$...$$ wrapping.
const DISPLAY_ENV_RE = /align(?:ed|\*)?|equation\*?|gather(?:ed|\*)?|multline\*?|cases/;
// Maps each environment to the KaTeX-safe inner env name.
function targetEnv(env: string): string {
  if (/^align/.test(env)) return "aligned";
  if (/^gather/.test(env)) return "gathered";
  return env; // equation, cases, multline → keep as-is (KaTeX supports them inside $$)
}

function normalizeDisplayEnvironments(text: string): string {
  // Unified pattern: matches \begin{ENV}...\end{ENV} where ENV is any display env.
  // Strips surrounding $/$$ delimiters (whatever the model used) and rewraps uniformly.
  return text.replace(
    new RegExp(
      `\\$?\\$?\\s*\\\\begin\\{(${DISPLAY_ENV_RE.source})\\}([\\s\\S]*?)` +
      `(?:\\\\end\\{(?:${DISPLAY_ENV_RE.source})\\}|(?=\\n\\s*\\n|$))\\s*\\$?\\$?`,
      "g"
    ),
    (_match, env, body) => {
      const inner = targetEnv(env);
      return `\n$$\n\\begin{${inner}}\n${body.trim()}\n\\end{${inner}}\n$$\n`;
    }
  );
}

// Fix lone \ used as a row separator inside \begin{cases}...\end{cases}.
// Kimi K2 and GPT-OSS sometimes emit "\ " (single backslash + space/newline)
// instead of the correct LaTeX row separator "\\" (two backslashes).
// Repaired before normalizeDisplayEnvironments wraps the block in $$.
function normalizeCasesLineBreaks(text: string): string {
  return text.replace(
    /\\begin\{cases\}([\s\S]*?)\\end\{cases\}/g,
    (_match, body) => {
      // \(?!\) matches a lone \ not already doubled; (\s) captures whitespace after.
      const fixed = body.replace(/\\(?!\\)(\s)/g, "\\\\$1");
      return `\\begin{cases}${fixed}\\end{cases}`;
    }
  );
}

function isLikelyMath(content: string): boolean {
  const trimmed = content.trim();
  if (trimmed.length === 0) return false;
  // Single letter or letter-number variable like n, x, y, i, j, x1, t0
  if (/^[a-zA-Z](\d+)?$/.test(trimmed)) return true;
  // Simple function notation like H(f), Q(x), or h_1(t)
  if (/^[a-zA-Z](?:_\{?[a-zA-Z0-9]+\}?|\d+)?\([a-zA-Z0-9_{}+\-/]+\)$/.test(trimmed)) return true;
  // Standard LaTeX commands like \frac, \alpha, etc.
  if (/\\(?:[a-zA-Z]+)/.test(trimmed)) return true;
  // Common math symbols or operations
  if (/[\^_*={}\[\]<>~+\-/]/.test(trimmed)) return true;
  return false;
}

function escapeNonMathDollars(text: string): string {
  const codeParts = text.split(/(```[\s\S]*?```|`[^`]+`)/g);
  return codeParts.map((part, index) => {
    if (index % 2 === 1) return part; // inside code block/span — leave untouched
    
    // Split by display math $$...$$ first to preserve display math blocks
    const displayParts = part.split(/(\$\$(?:(?!\n\s*\n)[\s\S])*?\$\$)/g);
    return displayParts.map((dispPart, dispIndex) => {
      if (dispIndex % 2 === 1) return dispPart; // inside display math — leave untouched
      
      // Process line by line to escape lone / plain text dollar signs
      const lines = dispPart.split("\n");
      const processedLines = lines.map(line => {
        const dollarIndices: number[] = [];
        for (let i = 0; i < line.length; i++) {
          if (line[i] === '$') {
            let backslashCount = 0;
            let j = i - 1;
            while (j >= 0 && line[j] === '\\') {
              backslashCount++;
              j--;
            }
            if (backslashCount % 2 === 0) {
              dollarIndices.push(i);
            }
          }
        }

        if (dollarIndices.length === 0) return line;

        let result = "";
        let lastIdx = 0;
        
        for (let k = 0; k < dollarIndices.length; k += 2) {
          if (k + 1 < dollarIndices.length) {
            const idx1 = dollarIndices[k];
            const idx2 = dollarIndices[k + 1];
            const content = line.slice(idx1 + 1, idx2);
            
            const isMath = isLikelyMath(content);
            
            result += line.slice(lastIdx, idx1);
            if (isMath) {
              result += "$" + content + "$";
            } else {
              result += "\\$" + content + "\\$";
            }
            lastIdx = idx2 + 1;
          } else {
            const idx = dollarIndices[k];
            result += line.slice(lastIdx, idx) + "\\$";
            lastIdx = idx + 1;
          }
        }
        result += line.slice(lastIdx);
        return result;
      });
      return processedLines.join("\n");
    }).join("");
  }).join("");
}

function hasStrongMathSignals(str: string): boolean {
  return /[\^_*+=\-/]/.test(str) || /\\(?:[a-zA-Z]+)/.test(str);
}

function normalizeLooseDisplayDelimiters(text: string): string {
  return text.replace(
    /(^|\n)([ \t]*)\$\$[ \t]*\n([\s\S]*?)[ \t]*\$\$/g,
    (match, lead, indent, body) => {
      const cleaned = body.replace(/\n[ \t]*\n+/g, "\n").trim();
      if (!hasStrongMathSignals(cleaned)) return match;
      return `${lead}${indent}$$\n${cleaned}\n${indent}$$`;
    }
  );
}

function normalizeMismatchedDisplayDelimiters(text: string): string {
  return text.replace(
    /(^|[^\$])\$\$[ \t]*([^$\n]*?(?:\\[a-zA-Z]+|[\^_={}\[\]+\-/*])[^$\n]*?)[ \t]*\$(?!\$)/g,
    (match, lead, body) => {
      const cleaned = body.trim();
      if (!hasStrongMathSignals(cleaned)) return match;
      return `${lead}\n$$\n${cleaned}\n$$\n`;
    }
  );
}

function normalizeEscapedMathDelimiters(text: string): string {
  const codeParts = text.split(/(```[\s\S]*?```|`[^`]+`)/g);
  return codeParts.map((part, index) => {
    if (index % 2 === 1) return part;
    return part.replace(/\\\$([^$\n]+?)\\\$/g, (match, body) => {
      const cleaned = body.trim();
      if (!isLikelyMath(cleaned)) return match;
      return `$${cleaned}$`;
    });
  }).join("");
}

export function normalizeMath(text: string): string {
  text = text.replace(/(^|\n)\$[ \t]+(?=where\b)/gim, "$1");

  // Kimi K2 sometimes emits display math with a blank line after the opener:
  // "$$\n\nI_D = ... V_{DS}$$". remark-math treats that as plain text, so
  // compact it before dollar escaping sees the orphaned delimiter.
  text = normalizeLooseDisplayDelimiters(text);
  // Kimi also emits "$$ equation $" and escaped inline math like "\$H(f)\$".
  text = normalizeMismatchedDisplayDelimiters(text);
  text = normalizeEscapedMathDelimiters(text);

  // Pre-step 0: Fix unmatched closing $$ following an inline or itemized formula, like:
  // "- For $ p = 3 $:\n p^2 + 2 = 3^2 + 2 = 11 \quad \text{(prime)}\n $$"
  text = text.replace(
    /^([ \t]*-?[ \t]*(?:For|for)[ \t]*\$[ \t]*[a-zA-Z][ \t]*=[ \t]*\d+[ \t]*\$:[ \t]*)\n([ \t]*[^\n$]+?[ \t]*)\n([ \t]*\$\$[ \t]*)$/gim,
    (match, prefix, bareEq) => {
      return `${prefix}\n$$\n${bareEq.trim()}\n$$\n`;
    }
  );

  // Pre-step: Detect/fix missing opening display math delimiters ($$)
  // E.g., lines starting with math and ending with $$ or followed by \n$$
  text = text.replace(
    /^(?<!\$)([ \t]*)([a-zA-Z0-9\s=+\-*/^\\{}()\[\]_<>~,;|!&:]+?)[ \t]*\$\$[ \t]*(?=[^\n$]|$)/gm,
    (match, space, body) => {
      if (hasStrongMathSignals(body)) {
        return `${space}$$\n${space}${body.trim()}\n$$\n`;
      }
      return match;
    }
  );

  text = text.replace(
    /^(?<!\$)([ \t]*)([a-zA-Z0-9\s=+\-*/^\\{}()\[\]_<>~,;|!&:]+?)\n[ \t]*\$\$[ \t]*$/gm,
    (match, space, body) => {
      if (hasStrongMathSignals(body)) {
        return `${space}$$\n${space}${body.trim()}\n$$\n`;
      }
      return match;
    }
  );

  // First, escape any lone or plain-text dollar signs to avoid confusing the markdown parser
  text = escapeNonMathDollars(text);

  // ── Step 1: Rescue LaTeX mistakenly wrapped in fenced code blocks ──────────
  text = text.replace(/```(?:[a-z]*\n)?([\s\S]*?)```/g, (match, body) => {
    const trimmed = body.trim();
    const hasLatex = /\\(?:frac|binom|sqrt|sum|int|prod|cdot|dots|left|right|begin|end|alpha|beta|gamma|delta|theta|lambda|mu|pi|sigma|phi|infty|partial|times|leq|geq|neq|approx|equiv|to|forall|exists|mathbb|mathrm|text|hat|bar|vec|over|choose)\b/.test(trimmed);
    const hasCode = /(?:^|\n)\s*(?:def |function |class |import |from |const |let |var |return\b|if\s*[({\w]|for\s*[({\w]|while\s*\(|print\s*\(|console\.|#include|public |private |static |void )/m.test(trimmed);
    if (hasLatex && !hasCode) {
      const cleaned = trimmed.replace(/^\$\$\s*/, "").replace(/\s*\$\$$/, "").trim();
      return `\n$$\n${cleaned}\n$$\n`;
    }
    return match;
  });

  // ── Step 1a: Fix lone \\ row separators inside \\begin{cases} ─────────────────
  // Must run before normalizeDisplayEnvironments so the body is clean when wrapped.
  text = normalizeCasesLineBreaks(text);

  // ── Step 1b: Fix display environments with bad/missing delimiters ───────────
  // Covers: bare \begin{aligned}, single-$ wrapped, or already $$-wrapped (idempotent).
  // Must run BEFORE the $$ mid-line fixer so we don't double-process.
  text = normalizeDisplayEnvironments(text);

  // ── Step 1c: Upgrade single-$ inline math that contains \\ (line breaks) ───
  // Inline math never legitimately needs \\; it means the model mis-wrapped a
  // multi-line block as inline. Upgrade to display $$.
  text = text.replace(/(?<!\$)\$([^$]+\\\\[^$]+)\$(?!\$)/g,
    (_m, inner) => `\n$$\n${inner.trim()}\n$$\n`
  );

  // ── Step 1d: Upgrade single-$ inline math that contains & alignment ops ────
  // & inside math signals an aligned expression; must be display math.
  text = text.replace(/(?<!\$)\$([^$]*&[=<>\s\\|][^$]*)\$(?!\$)/g,
    (_m, inner) => `\n$$\n${inner.trim()}\n$$\n`
  );

  // ── Step 1e: Rescue orphaned \end{aligned/align} with no matching \begin{} ──
  // Happens when the model outputs $\begin{aligned}…\end{aligned}$ but the
  // \begin{} line was on a prior chunk, leaving content + \end{aligned} $ as
  // raw visible text. Two guards prevent false positives:
  //   • [ \t]* instead of \s* — can't jump lines to reach \end{}
  //   • lookback check — skip if \begin{aligned} already appeared nearby
  text = text.replace(
    /((?:[^\n$]*(?:&(?:[=<>|]|\\[a-zA-Z]+)|\\\\)[^\n$]*)+)[ \t]*\\end\{(align(?:ed|\*)?)\}[ \t]*\$?(?!\$)/g,
    function(_m, body, _env, offset, str) {
      const lookback = str.slice(Math.max(0, offset - 500), offset);
      if (/\\begin\{align/.test(lookback)) return _m; // already paired — leave it
      return `\n$$\n\\begin{aligned}\n${body.trim()}\n\\end{aligned}\n$$\n`;
    }
  );

  // ── Step 1f: "$ formula" at line-start → $$ display block ────────────────
  // A single $ followed by a space at the start of a line is the model's
  // mis-use of inline delimiters for display math.  KaTeX/remark-math rejects
  // it (space after $ breaks inline parsing), so it leaks as raw text.
  // Require at least one display-math command before upgrading, so plain
  // prose that starts with a $ symbol (prices, variables) is never touched.
  text = text.replace(
    /^[ \t]*\$(?!\$) ([^$\n]+?)\$?[ \t]*$/gm,
    (_m, inner) => {
      const content = inner.trim();
      if (!/\\(?:frac|left|right|quad|displaystyle|sum|int|prod|lim|binom|begin|sqrt|over|text|cdot|times|infty|partial|nabla)\b/.test(content)) return _m;
      return `$$\n${content}\n$$`;
    }
  );

  // ── Step 1g: Fix "- $$ formula" — list items with $$ but no closing $$ ─────
  // A list item that starts with $$ (e.g. "- $$ \binom{...}") has an unclosed
  // display-math block. An unclosed $$ swallows all following content until the
  // next $$ in the document, breaking every subsequent equation.
  // Fix: convert to inline $formula$ — fractions/binomials render fine inline
  // and the list structure is preserved.  Handles both open-only and open+close.
  text = text.replace(
    /^([ \t]*(?:[-*]|\d+[.)]) ?)\$\$[ \t]*([^$\n]+?)[ \t]*(?:\$\$)?[ \t]*$/gm,
    (_m, listPrefix, formula) => `${listPrefix}$${formula.trim()}$`
  );

  // ── Step 2: Fix $$ glued to surrounding prose on the same line ─────────────
  // e.g. "…formula $$ 2. Next section" → "…formula\n$$\n2. Next section"
  // Don't touch $$ that are already the only thing on a line.
  // 2a. $$ in the middle of a line (text before AND after)
  text = text.replace(/([^\n$])[ \t]*\$\$[ \t]*(?=[^\n$])/g, "$1\n$$\n");
  // 2b. $$ at the very end of a line with text before it: "formula $$"
  text = text.replace(/([^\n$])[ \t]*\$\$[ \t]*$/gm, "$1\n$$");
  // 2c. $$ at the very start of a line followed by space + text: "$$ more text"
  text = text.replace(/^[ \t]*\$\$[ \t]+([^\n$])/gm, "$$\n$1");

  // ── Step 3: Original delimiter + code-fence-skipping normalization ──────────
  const codeParts = text.split(/(```[\s\S]*?```|`[^`]+`)/g);
  return codeParts.map((part, index) => {
    if (index % 2 === 1) return part; // inside code fence/span — leave untouched

    const normalizedDelimiters = part
      .replace(/\\\[([\s\S]*?)\\\]/g, (_match, body) => `\n$$${body}$$\n`)
      .replace(/\\\(([\s\S]*?)\\\)/g, (_match, body) => `$${body}$`);

    return normalizeDisplayEnvironments(normalizedDelimiters)
      .split(/(\$\$(?:(?!\n\s*\n)[\s\S])*?\$\$)/g)
      .map((segment, segmentIndex) => {
        if (segmentIndex % 2 === 1) return segment;
        return segment
          .split("\n")
          .map(line => {
            if (isStandaloneEquation(line)) {
              const listPrefix = line.match(/^(\s*(?:[-*]|\d+[.)])\s+)(.*)$/);
              const prefix = listPrefix?.[1] ?? "";
              const expression = (listPrefix?.[2] ?? line)
                .replace(/\$\s+\$/g, " \\\\\n")
                .replace(/(\d)\s+\$(?=[A-Za-z(])/g, "$1 \\\\\n$")
                .replace(/\$/g, "")
                .trim();
              return `${prefix}$$\n${expression}\n$$`;
            }
            return normalizeOutsideMath(line);
          })
          .join("\n");
      })
      .join("");
  }).join("");
}

function NeptuneAvatar({ size, id }: { size: number; id: string }) {
  const neptuneGradId = `neptuneGrad-${id}`;
  const specularGradId = `specularGrad-${id}`;
  const shadowGradId = `shadowGrad-${id}`;

  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 relative">
      <defs>
        {/* Base planetary body gradient */}
        <radialGradient id={neptuneGradId} cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="25%" stopColor="#2563eb" />
          <stop offset="60%" stopColor="#1d4ed8" />
          <stop offset="85%" stopColor="#1e3a8a" />
          <stop offset="100%" stopColor="#0b1329" />
        </radialGradient>
        
        {/* Specular highlighting layer */}
        <radialGradient id={specularGradId} cx="25%" cy="25%" r="35%">
          <stop offset="0%" stopColor="#ebf8ff" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#ebf8ff" stopOpacity="0" />
        </radialGradient>

        {/* 3D Terminator Shadow */}
        <radialGradient id={shadowGradId} cx="70%" cy="70%" r="55%">
          <stop offset="0%" stopColor="#000000" stopOpacity="0" />
          <stop offset="65%" stopColor="#000000" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.95" />
        </radialGradient>
      </defs>

      {/* Base sphere */}
      <circle cx="16" cy="16" r="15" fill={`url(#${neptuneGradId})`} />

      {/* Rotating atmospheric details */}
      <g className="animate-neptune-spin-slow" style={{ transformOrigin: "16px 16px" }}>
        {/* Atmospheric banded structures */}
        <path d="M 1 12 Q 16 16 31 12" stroke="#3b82f6" strokeWidth="1.2" opacity="0.35" />
        <path d="M 1 15 Q 16 19 31 15" stroke="#1d4ed8" strokeWidth="1.5" opacity="0.4" />
        <path d="M 2 20 Q 16 23 30 20" stroke="#bae6fd" strokeWidth="0.8" opacity="0.25" />
        <path d="M 3 24 Q 16 26 29 24" stroke="#1d4ed8" strokeWidth="1" opacity="0.3" />

        {/* Great Dark Spot */}
        <ellipse cx="10" cy="14" rx="3.5" ry="2.2" fill="#040a1c" opacity="0.85" />
        <ellipse cx="10" cy="14" rx="2" ry="1" fill="#000000" opacity="0.5" />

        {/* Scooter cloud */}
        <ellipse cx="21" cy="17" rx="1.8" ry="0.8" fill="#e0f2fe" opacity="0.75" />
        <path d="M 18 18 Q 22 17 25 18" stroke="#bae6fd" strokeWidth="0.5" opacity="0.6" />
      </g>

      {/* Stationary highlights and shadows to lock the light source direction */}
      {/* Specular light spot */}
      <circle cx="11" cy="11" r="8" fill={`url(#${specularGradId})`} />

      {/* 3D sphere spherical terminator shadow overlay */}
      <circle cx="16" cy="16" r="15.2" fill={`url(#${shadowGradId})`} pointerEvents="none" />
    </svg>
  );
}

export default function ChatMessage({ msg, model }: { msg: Message; model?: string }) {
  const isUser = msg.role === "user";
  const isNousCoder = model === "nouscoder-14b";

  return (
    <div className={`msg-enter flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"} mb-4`}>
      {/* Avatar */}
      {isUser ? (
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-violet-700/40 border border-violet-600/50">
          <User size={13} className="text-violet-300" />
        </div>
      ) : (
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center relative select-none">
          {/* Inner breathing halo around the planet */}
          <div className="absolute inset-0 rounded-full bg-indigo-500/10 filter blur-[4px] scale-[1.3] pulse-glow animate-pulse" />
          <NeptuneAvatar size={32} id={msg.id} />
        </div>
      )}

      {/* Bubble */}
      <div className={`min-w-0 max-w-[75%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        {msg.toolCalls && msg.toolCalls.length > 0 && (
          <div className="flex flex-wrap">
            {msg.toolCalls.map((tc, i) => (
              <ToolBadge key={i} tool={tc.tool} args={tc.args} />
            ))}
          </div>
        )}

        {/* Multi-image thumbnails */}
        {(() => {
          const imgs = msg.imageUrls?.length ? msg.imageUrls : msg.imageUrl ? [msg.imageUrl] : [];
          if (!imgs.length) return null;
          return (
            <div className={`flex flex-wrap gap-2 mb-1 ${isUser ? "justify-end" : "justify-start"}`}>
              {imgs.map((src, i) => (
                <div key={i} className="rounded-xl overflow-hidden border border-violet-500/30 flex-shrink-0"
                  style={{ maxWidth: 220 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Attached screenshot ${i + 1}`} className="w-full h-auto object-cover" />
                </div>
              ))}
            </div>
          );
        })()}

        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed glass markdown-body
          ${isUser
            ? "rounded-tr-sm border-violet-600/30 text-violet-100 whitespace-pre-wrap"
            : "rounded-tl-sm border-indigo-500/20 text-indigo-100"
          }
          ${!isUser && isNousCoder ? "code-green" : ""}
          ${!msg.content && (msg.imageUrl || msg.imageUrls?.length) ? "hidden" : ""}`}>
          {isUser ? (
            <>
              {msg.content}
              {msg.streaming && <span className="cursor-blink" />}
            </>
          ) : msg.streaming ? (
            // Plain text while streaming — avoids ReactMarkdown/KaTeX re-parsing
            // every token, which causes visible flicker and layout shifts.
            // Snaps to full formatted output once the stream completes.
            <span className="whitespace-pre-wrap">{msg.content}<span className="cursor-blink" /></span>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[[rehypeKatex, { throwOnError: false }]]}>
              {normalizeMath(msg.content)}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  );
}
