"use client";
import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { Zap, ArrowLeft, RotateCcw, Sparkles } from "lucide-react";
import ChatMessage, { type Message } from "@/components/ChatMessage";
import ChatInput, { type PdfAttachment } from "@/components/ChatInput";
import NebulaLayers from "@/components/NebulaLayers";
import FlashcardDeck from "@/components/FlashcardDeck";

const StarField = dynamic(() => import("@/components/StarField"), { ssr: false });

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

const SUGGESTED = [
  "What is AAOI trading at right now?",
  "Latest news on Anthropic or OpenAI?",
  "Find all primes p such that p² + 2 is prime.",
  "Compare AAOI vs NVDA YTD performance",
  "What are the biggest tech stories today?",
  "How does gravitational lensing work?",
];

const MODELS = [
  {
    id: "gpt-4o-mini",
    label: "Kimi K2",
    role: "Reasoning",
    desc: "Moonshot AI · 1T-param MoE · deep reasoning, technical Q&A, analysis, and live research",
    accent: "violet",
  },
  {
    id: "gpt-oss-20b",
    label: "GPT-OSS 20B",
    role: "Educational",
    desc: "Our flagship model · step-by-step tutoring, olympiad math, screenshots, PDFs, and flashcards",
    accent: "emerald",
  },
  {
    id: "nouscoder-14b",
    label: "NousCoder 14B",
    role: "Coding",
    desc: "NousResearch code model · generation, analysis, refactors, and debugging",
    accent: "blue",
  },
] as const;

type ModelId = typeof MODELS[number]["id"];

function ChatPage() {
  const searchParams = useSearchParams();
  const initialModel = (MODELS.find(m => m.id === searchParams.get("model"))?.id ?? "gpt-4o-mini") as ModelId;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => uuidv4());
  const [model, setModel] = useState<ModelId>(initialModel);
  const [flashcardsOpen, setFlashcardsOpen] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [pdf, setPdf] = useState<PdfAttachment | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLElement>(null);
  const stickToBottomRef = useRef(true);

  // Only auto-scroll when the user is already near the bottom — prevents
  // streaming tokens from yanking the viewport while the user is reading higher up.
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      stickToBottomRef.current =
        el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    // Instant scroll prevents the jitter caused by overlapping smooth scrolls
    // during token streaming.
    bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [messages]);

  const send = useCallback(async (question?: string) => {
    const q = (question ?? input).trim();
    if ((!q && !images.length) || loading) return;
    setInput("");
    const sentImages = images;
    setImages([]);

    const userMsg: Message = {
      id: uuidv4(), role: "user", content: q,
      imageUrls: sentImages.length ? sentImages : undefined,
    };
    const aiId = uuidv4();
    const aiMsg: Message = { id: aiId, role: "assistant", content: "", streaming: true };

    setMessages(prev => [...prev, userMsg, aiMsg]);
    setLoading(true);

    try {
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));

      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          session_id: sessionId,
          model,
          // Send as array; backend accepts both `image` (legacy) and `images[]`
          images: sentImages.length ? sentImages : undefined,
          image: sentImages.length === 1 ? sentImages[0] : undefined,
          pdfText: pdf?.text,
          pdfName: pdf?.name,
        }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      const toolCalls: Message["toolCalls"] = [];
      let buffer = "";

      const processLine = (line: string) => {
        if (!line.startsWith("data: ")) return;
        try {
          const ev = JSON.parse(line.slice(6));
          if (ev.type === "text") {
            setMessages(prev => prev.map(m =>
              m.id === aiId ? { ...m, content: m.content + ev.text } : m
            ));
          } else if (ev.type === "tool_call") {
            toolCalls.push({ tool: ev.tool, args: ev.args });
            setMessages(prev => prev.map(m =>
              m.id === aiId ? { ...m, toolCalls: [...toolCalls] } : m
            ));
          } else if (ev.type === "done") {
            setMessages(prev => prev.map(m =>
              m.id === aiId
                ? { ...m, content: typeof ev.text === "string" ? ev.text : m.content, streaming: false }
                : m
            ));
          } else if (ev.type === "error") {
            setMessages(prev => prev.map(m =>
              m.id === aiId ? { ...m, content: ev.message ?? "Something went wrong.", streaming: false } : m
            ));
          } else if (ev.type === "kernel") {
            setMessages(prev => prev.map(m =>
              m.id === aiId ? { ...m, kernelTransit: true } : m
            ));
          }
        } catch { /* incomplete line remains buffered until the next read */ }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += dec.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) processLine(line);
      }

      buffer += dec.decode();
      if (buffer) processLine(buffer);
      setMessages(prev => prev.map(m =>
        m.id === aiId && m.streaming ? { ...m, streaming: false } : m
      ));
    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === aiId
          ? { ...m, content: `[error: ${err instanceof Error ? err.message : "unknown"}]`, streaming: false }
          : m
      ));
    } finally {
      setLoading(false);
    }
  }, [input, images, pdf, loading, messages, sessionId, model]);

  const isEmpty = messages.length === 0;

  return (
    <div className="relative flex flex-col h-screen overflow-hidden">
      <StarField />
      <NebulaLayers />

      {/* Header */}
      <header className="relative z-10 glass border-b px-4 py-3 flex items-center justify-between flex-shrink-0"
        style={{ borderColor: "rgba(120,60,240,0.15)" }}>
        <div className="flex items-center gap-3">
          <Link href="/"
            className="p-1.5 rounded-lg text-violet-500/50 hover:text-violet-300
              hover:bg-violet-900/30 transition-colors">
            <ArrowLeft size={14} />
          </Link>
          <div className="relative w-7 h-7 rounded-full overflow-hidden flex-shrink-0"
            style={{
              boxShadow: "0 0 8px rgba(139,92,246,0.5), 0 0 16px rgba(124,58,237,0.2)",
              border: "1px solid rgba(139,92,246,0.45)",
            }}>
            <Image
              src="/galileo-moon.webp"
              alt="AAOS"
              width={28} height={28}
              className="w-full h-full object-cover object-top"
              style={{ filter: "sepia(1) hue-rotate(222deg) saturate(2.2) brightness(0.72) contrast(1.25)", transform: "scale(1.08)" }}
            />
          </div>
          <div>
            <h1 className="text-xs font-bold tracking-[0.15em] text-gradient uppercase">
              AAOS Research
            </h1>
            <p className="text-[9px] text-violet-500/60 tracking-widest">
              Autonomous AI OS
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => setFlashcardsOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
              bg-emerald-700/30 border border-emerald-500/40 text-emerald-200
              text-[11px] font-mono tracking-wider cursor-pointer
              hover:bg-emerald-700/50 transition-colors"
            title="Generate exam flashcards">
            <Sparkles size={11} /> Flashcards
          </button>

          <div className="hidden sm:flex items-center gap-1 text-[10px] text-violet-400/50">
            <Zap size={10} />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
            live
          </div>
          {!isEmpty && (
            <button
              onClick={() => setMessages([])}
              className="p-1.5 rounded-lg text-violet-500/50 hover:text-violet-300
                hover:bg-violet-900/30 transition-colors cursor-pointer"
              title="Clear conversation">
              <RotateCcw size={13} />
            </button>
          )}
        </div>
      </header>

      {/* ── MODEL SELECTOR ───── */}
      <div className="relative z-10 px-4 md:px-8 pt-4 pb-3 flex-shrink-0">
        <div className="max-w-3xl mx-auto">
          <p className="text-center text-[10px] font-mono tracking-[0.25em] text-violet-400/70 uppercase mb-3">
            Choose your model
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
            {MODELS.map(m => {
              const active = model === m.id;
              const accent = m.accent;
              const isEdu = accent === "emerald";
              const orderClass = m.id === "nouscoder-14b" ? "lg:order-2" : m.id === "gpt-oss-20b" ? "lg:order-3" : "lg:order-1";
              const styles = isEdu
                ? { bg: "bg-emerald-900/40", border: "border-emerald-500/60", shadow: "shadow-emerald-900/30",
                    badgeBg: "bg-emerald-700/40", badgeText: "text-emerald-200", badgeBorder: "border-emerald-500/30",
                    dot: "bg-emerald-400" }
                : accent === "blue"
                  ? { bg: "bg-blue-900/40", border: "border-blue-500/60", shadow: "shadow-blue-900/30",
                      badgeBg: "bg-blue-700/40", badgeText: "text-blue-200", badgeBorder: "border-blue-500/30",
                      dot: "bg-blue-400" }
                  : { bg: "bg-violet-900/40", border: "border-violet-500/60", shadow: "shadow-violet-900/30",
                      badgeBg: "bg-violet-700/40", badgeText: "text-violet-200", badgeBorder: "border-violet-500/30",
                      dot: "bg-violet-400" };
              return (
                <button key={m.id}
                  onClick={() => setModel(m.id)}
                  disabled={loading}
                  className={`relative rounded-xl p-3 md:p-4 text-left transition-all duration-200
                    cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 overflow-hidden
                    ${orderClass}
                    ${active
                      ? `${styles.bg} ${styles.border} shadow-lg ${styles.shadow}`
                      : "glass border-violet-700/20 hover:border-violet-500/40"}
                    border-2`}>
                  <div className="flex items-start">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-sm md:text-base font-bold text-white tracking-tight">
                          {m.label}
                        </span>
                        <span className={`text-[9px] font-mono tracking-widest uppercase px-1.5 py-0.5 rounded
                          ${styles.badgeBg} ${styles.badgeText} border ${styles.badgeBorder}`}>
                          {m.role}
                        </span>
                      </div>
                      {m.id === "gpt-oss-20b" ? (
                        <p className="text-[11px] text-violet-300/70 leading-snug">
                          OpenAI open weights · ~1000 tok/s · schoolwork,{" "}
                          <span className="font-bold text-blue-300">SCREENSHOT</span>{" "}
                          problem solving, flashcards
                        </p>
                      ) : (
                        <p className="text-[11px] text-violet-300/70 leading-snug">
                          {m.desc}
                        </p>
                      )}
                    </div>
                    {active && (
                      <div className={`absolute top-2 right-2 w-2 h-2 rounded-full animate-pulse ${styles.dot}`} />
                    )}
                  </div>

                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Messages */}
      <main ref={scrollContainerRef} className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 md:px-8 min-h-0">
        <div className="max-w-3xl mx-auto">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center min-h-[55vh] text-center gap-8">

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl animate-fade-in-delay-1">
                {SUGGESTED.map(s => (
                  <button key={s} onClick={() => send(s)}
                    className="glass glow-hover rounded-xl px-4 py-3 text-left text-xs
                      text-violet-300/80 hover:text-violet-200 transition-all duration-200
                      border-violet-700/20 cursor-pointer">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map(msg => <ChatMessage key={msg.id} msg={msg} model={model} />)
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* Input */}
      <footer className="relative z-10 glass border-t px-4 py-4 md:px-8 flex-shrink-0"
        style={{ borderColor: "rgba(120,60,240,0.15)" }}>
        <div className="max-w-3xl mx-auto">
          <ChatInput
            value={input}
            onChange={setInput}
            onSubmit={() => send()}
            loading={loading}
            images={images}
            onImagesChange={setImages}
            pdf={pdf}
            onPdfChange={setPdf}
          />
          <p className="text-center text-[9px] text-violet-500/30 mt-2 tracking-widest uppercase">
            AAOS Research · Kimi K2 · GPT-OSS 20B · NousCoder 14B ·{" "}
            <span className="font-bold text-blue-300">Screenshots</span> · Flashcards · Live Web
          </p>
        </div>
      </footer>

      <FlashcardDeck open={flashcardsOpen} onClose={() => setFlashcardsOpen(false)} model={model} />
    </div>
  );
}

export default function ChatPageWrapper() {
  return (
    <Suspense fallback={null}>
      <ChatPage />
    </Suspense>
  );
}
