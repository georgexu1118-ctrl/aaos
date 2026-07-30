"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Box,
  Brain,
  Code2,
  Search,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import NebulaLayers from "@/components/NebulaLayers";
import FloatingChat from "@/components/FloatingChat";
import NeptuneMuseum from "@/components/NeptuneMuseum";

const StarField = dynamic(() => import("@/components/StarField"), { ssr: false });
const FloatingAaoiTicker = dynamic(() => import("@/components/FloatingAaoiTicker"), { ssr: false });

const filters = [
  { label: "All Models", icon: Box, active: true },
  { label: "Reasoning", icon: Brain },
  { label: "Coding", icon: Code2 },
  { label: "Educational", icon: BookOpen },
  { label: "Research", icon: Search },
];

const labs = [
  {
    title: "Reasoning Model",
    description: "Deep reasoning, technical Q&A, analysis, and live research — powered by Kimi K2, a 1T-parameter frontier model.",
    button: "Open Model",
    href: "/chat?model=gpt-4o-mini",
    tone: "blue",
    badge: "Kimi K2",
    mobileOrder: "order-1",
  },
  {
    title: "Coding Model",
    description: "NousCoder-14B for code generation, analysis, debugging, and precise developer workflows.",
    button: "Open Model",
    href: "/chat?model=nouscoder-14b",
    tone: "emerald",
    badge: "NousCoder-14B",
    mobileOrder: "order-2",
  },
  {
    title: "Educational Model",
    description: "Our flagship model — step-by-step tutoring, olympiad math, screenshots, PDFs, and study flashcards.",
    button: "Open Model",
    href: "/chat?model=gpt-oss-20b",
    tone: "violet",
    badge: "GPT-OSS 20B",
    featured: true,
    mobileOrder: "order-3",
  },
];

function TutorMascot({ className = "" }: { className?: string }) {
  return (
    <div
      className={className}
      style={{
        maskImage: "linear-gradient(to bottom, transparent 22%, black 40%), radial-gradient(ellipse 85% 80% at 62% 62%, black 30%, transparent 68%)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent 22%, black 40%), radial-gradient(ellipse 85% 80% at 62% 62%, black 30%, transparent 68%)",
        maskComposite: "intersect",
        WebkitMaskComposite: "destination-in",
      }}
    >
      <Image
        src="/baby-yoda.png"
        alt="Grogu"
        width={180}
        height={200}
        className="w-full h-auto object-contain"
        priority
      />
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#050607] text-white">
      <StarField />
      <NebulaLayers />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(80,120,255,0.16),transparent_28%),radial-gradient(circle_at_86%_72%,rgba(124,58,237,0.18),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.035),transparent_24%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.55) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.55) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />

      <Navbar />

      <main className="relative z-10 px-5 pb-14 pt-24 md:px-9 lg:px-12">
        <section className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,.9)]" />
                AAOS model lab
              </div>

              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white md:text-5xl">
                Welcome to AAOS Research
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400 md:text-base">
                Frontier models for reasoning, software engineering, and education — with live research built in.
              </p>
            </div>

          </div>

          <div className="mt-9 flex flex-wrap gap-3">
            {filters.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  className={`inline-flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-xs font-medium transition ${
                    item.active
                      ? "border-white/10 bg-white/[0.07] text-white shadow-2xl shadow-black/20"
                      : "border-transparent bg-transparent text-zinc-400 hover:border-white/10 hover:bg-white/[0.04] hover:text-zinc-200"
                  }`}
                >
                  <Icon size={16} className={item.active ? "text-zinc-100" : "text-zinc-500"} />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="mt-7 grid gap-5 lg:grid-cols-12">
            {labs.map(card => (
              <article
                key={card.title}
                className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-[#0c0e10]/80 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-white/20 ${
                  card.featured ? "lg:col-span-6" : "lg:col-span-3"
                } ${card.mobileOrder} lg:order-none`}
              >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.08),transparent_28%)] opacity-0 transition group-hover:opacity-100" />
                <div className="relative z-10 flex h-full min-h-[250px] flex-col">
                  <span className="mb-5 w-fit rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[9px] font-mono uppercase tracking-[0.18em] text-zinc-500">
                    {card.badge}
                  </span>

                  <h2 className="text-xl font-semibold tracking-[-0.03em] text-white">
                    {card.title}
                  </h2>
                  {card.featured ? (
                    <p className="mt-3 max-w-sm text-sm leading-6 text-zinc-400">
                      Step-by-step tutoring, olympiad math,{" "}
                      <span className="font-bold text-blue-300">SCREENSHOTS</span>, PDFs, and study flashcards.
                    </p>
                  ) : (
                    <p className="mt-3 max-w-sm text-sm leading-6 text-zinc-400">
                      {card.description}
                    </p>
                  )}

                  {card.featured && (
                    <div className="pointer-events-none absolute bottom-0 right-0">
                      <TutorMascot className="w-32 md:w-52" />
                    </div>
                  )}

                  <Link
                    href={card.href}
                    className={`mt-auto inline-flex w-full items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                      card.tone === "blue"
                        ? "border-blue-400/25 bg-blue-500/10 text-blue-100 hover:bg-blue-500/20"
                        : card.tone === "emerald"
                          ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20"
                          : "border-violet-400/25 bg-violet-500/15 text-violet-100 hover:bg-violet-500/25"
                    }`}
                  >
                    {card.button}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-10 max-w-7xl">
          <div className="grid gap-5 lg:grid-cols-12">
            <article className="relative overflow-hidden rounded-2xl border border-cyan-300/15 bg-[#0c0e10]/80 shadow-2xl shadow-black/30 backdrop-blur-xl lg:col-span-7">
              <div className="relative">
                <Image
                  src="/aaoi-chart.png"
                  alt="AAOI stock chart showing YTD performance"
                  width={900}
                  height={480}
                  className="h-[240px] w-full object-cover object-top opacity-90 md:h-[280px]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0c0e10] via-[#0c0e10]/20 to-transparent" />
                <p className="absolute bottom-3 left-3 text-[10px] font-mono text-zinc-400/70">
                  nfa / traded this multiple times, I don&apos;t hold
                </p>
              </div>
            </article>

            <article className="rounded-2xl border border-white/10 bg-[#0c0e10]/80 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl lg:col-span-5">
              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-cyan-300/70">
                Origin Signal
              </p>
              <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-white">
                AAOI stays part of the lab.
              </h2>
              <p className="mt-4 text-sm leading-6 text-zinc-400">
                AAOS keeps live market intelligence close to the model workspace, including the AAOI story that inspired the project name.
              </p>
              <Link
                href="/chat"
                className="mt-8 inline-flex items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20"
              >
                Ask about AAOI <ArrowRight size={16} />
              </Link>
            </article>
          </div>
        </section>

        <NeptuneMuseum />
      </main>

      <FloatingChat />
      <FloatingAaoiTicker />
    </div>
  );
}
