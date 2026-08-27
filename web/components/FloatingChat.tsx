"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { MessageCircle, X, Send, Loader2, Cpu, ExternalLink } from "lucide-react";
import Link from "next/link";

interface Msg { id: string; role: "user" | "assistant"; content: string; streaming?: boolean; }

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

const DEMO_HINTS = [
  "What is AAOI trading at?",
  "Help me study mitosis vs meiosis",
  "How does a black hole form?",
];

const GREETING: Msg = {
  id: "greeting",
  role: "assistant",
  content: "Hi, I'm AAOS — intelligence from beyond the silicon horizon. Ask me about stocks, current events, or anything in the cosmos.",
};

export default function FloatingChat() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => uuidv4());
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  // Track whether the user is at the bottom so streaming doesn't fight a manual scroll.
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      stickToBottomRef.current =
        el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [open]);

  useEffect(() => {
    if (!open || !stickToBottomRef.current) return;
    // Instant scroll (behavior: "auto") prevents the jitter caused by overlapping
    // smooth scrolls during token-by-token streaming.
    bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [msgs, open]);

  const send = useCallback(async (question?: string) => {
    const q = (question ?? input).trim();
    if (!q || loading) return;
    setInput("");

    const userMsg: Msg = { id: uuidv4(), role: "user", content: q };
    const aiId = uuidv4();
    setMsgs(prev => [...prev, userMsg, { id: aiId, role: "assistant", content: "", streaming: true }]);
    setLoading(true);

    try {
      const history = [...msgs, userMsg]
        .filter(m => m.id !== "greeting")
        .map(m => ({ role: m.role, content: m.content }));

      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, model: "gpt-4o-mini", session_id: sessionId }),
      });

      if (!res.ok || !res.body) throw new Error(`Server error ${res.status}`);

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      // Buffer accumulates across TCP chunk boundaries so partial SSE lines aren't dropped
      let buf = "";

      const processLine = (line: string) => {
        if (!line.startsWith("data: ")) return;
        try {
          const ev = JSON.parse(line.slice(6));
          if (ev.type === "text") {
            setMsgs(prev => prev.map(m => m.id === aiId ? { ...m, content: m.content + ev.text } : m));
          } else if (ev.type === "done") {
            setMsgs(prev => prev.map(m => m.id === aiId ? { ...m, streaming: false } : m));
          } else if (ev.type === "error") {
            setMsgs(prev => prev.map(m =>
              m.id === aiId ? { ...m, content: ev.message ?? "Something went wrong.", streaming: false } : m
            ));
          }
        } catch { /* incomplete JSON fragment — will be reassembled next chunk */ }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n");
        // Last element may be an incomplete line — keep it in the buffer
        buf = parts.pop() ?? "";
        for (const line of parts) processLine(line);
      }

      // Flush any remaining buffered line
      if (buf) processLine(buf);

      // Guarantee message is never stuck in streaming state
      setMsgs(prev => prev.map(m => m.id === aiId && m.streaming ? { ...m, streaming: false } : m));

    } catch (e) {
      setMsgs(prev => prev.map(m =>
        m.id === aiId ? { ...m, content: `⚠️ ${e instanceof Error ? e.message : "Connection error"}`, streaming: false } : m
      ));
    } finally {
      setLoading(false);
    }
  }, [input, loading, msgs, sessionId]);

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Open AAOS chat"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full
          flex items-center justify-center cursor-pointer
          btn-shimmer shadow-lg transition-transform duration-200
          hover:scale-105 active:scale-95 animate-pulse-glow"
        style={{ border: "1px solid rgba(167,139,250,0.4)" }}>
        {open
          ? <X size={20} className="text-white" />
          : <MessageCircle size={20} className="text-white" />
        }
      </button>

      {/* Chat panel */}
      <div
        className={`fixed bottom-24 right-6 z-50 w-[360px] max-h-[520px]
          glass-hi rounded-2xl flex flex-col overflow-hidden
          shadow-2xl transition-all duration-300 origin-bottom-right
          ${open ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"}`}
        style={{ boxShadow: open ? "0 0 60px rgba(124,58,237,0.25), 0 20px 60px rgba(0,0,0,0.6)" : "none" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: "rgba(120,60,240,0.2)" }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-violet-800/60 border border-violet-500/40
              flex items-center justify-center animate-pulse-glow">
              <Cpu size={12} className="text-violet-300" />
            </div>
            <div>
              <p className="text-xs font-bold tracking-wider text-gradient">AAOS</p>
              <p className="text-[9px] text-violet-500/60 tracking-widest">Research Preview</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/chat" target="_blank"
              className="p-1.5 rounded-lg hover:bg-violet-900/40 text-violet-400/50
                hover:text-violet-300 transition-colors">
              <ExternalLink size={13} />
            </Link>
            <button onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg hover:bg-violet-900/40 text-violet-400/50
                hover:text-violet-300 transition-colors cursor-pointer">
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
          {msgs.map(m => (
            <div key={m.id}
              className={`msg-enter flex gap-2 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
              <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px]
                ${m.role === "user"
                  ? "bg-violet-700/50 text-violet-200"
                  : "bg-indigo-900/70 text-indigo-300"}`}>
                {m.role === "user" ? "U" : "A"}
              </div>
              <div className={`max-w-[80%] rounded-xl px-3 py-2 text-[11px] leading-relaxed whitespace-pre-wrap
                ${m.role === "user"
                  ? "bg-violet-800/40 border border-violet-700/30 text-violet-100"
                  : "bg-indigo-950/50 border border-indigo-800/30 text-indigo-100"}`}>
                {m.content}
                {m.streaming && <span className="cursor-blink" />}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Hint chips */}
        {msgs.length <= 2 && (
          <div className="px-3 pb-2 flex flex-wrap gap-1">
            {DEMO_HINTS.map(h => (
              <button key={h} onClick={() => send(h)}
                className="px-2 py-1 rounded-full text-[10px] glass glow-hover
                  text-violet-300/80 hover:text-violet-200 cursor-pointer transition-colors">
                {h}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="p-3 border-t flex gap-2" style={{ borderColor: "rgba(120,60,240,0.18)" }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask AAOS anything…"
            disabled={loading}
            className="flex-1 bg-transparent text-[11px] text-violet-100
              placeholder-violet-500/50 outline-none"
          />
          <button onClick={() => send()} disabled={loading || !input.trim()}
            className="w-7 h-7 rounded-lg bg-violet-700 hover:bg-violet-600
              disabled:opacity-40 flex items-center justify-center transition-colors cursor-pointer
              disabled:cursor-not-allowed flex-shrink-0">
            {loading
              ? <Loader2 size={12} className="text-white animate-spin" />
              : <Send size={12} className="text-white" />}
          </button>
        </div>
      </div>
    </>
  );
}
