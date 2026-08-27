import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Braces, Cable, Cpu, Server, Terminal } from "lucide-react";

const transport = [
  { label: "Next.js", detail: "browser", icon: Braces },
  { label: "FastAPI", detail: "gateway", icon: Server },
  { label: "COM1", detail: "TCP :4555", icon: Cable },
  { label: "x86 kernel", detail: "QEMU guest", icon: Cpu },
];

const kernelFacts = [
  ["BOOT", "Multiboot1 / i386"],
  ["SERIAL", "COM1 · 0x3F8 · 38400 baud"],
  ["DISPLAY", "VGA text mode · 80×25"],
];

export default function KernelBridgeSection() {
  return (
    <section className="mx-auto mt-14 max-w-7xl border-y border-white/10 py-10 md:py-14">
      <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-7">
          <div className="overflow-hidden rounded-lg border border-emerald-300/20 bg-black shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
            <div className="flex h-9 items-center justify-between border-b border-white/10 bg-[#101211] px-3">
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase text-zinc-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                QEMU i386 · VGA framebuffer
              </div>
              <span className="text-[9px] font-mono text-zinc-600">720 × 400</span>
            </div>
            <div className="scanlines relative aspect-[9/5] bg-black">
              <Image
                src="/aaos-kernel.png"
                alt="Actual AAOS kernel VGA output captured from QEMU after a COM1 message round trip"
                fill
                sizes="(max-width: 1024px) 100vw, 58vw"
                className="object-contain"
                style={{ imageRendering: "pixelated" }}
              />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-white/10 bg-white/10 md:grid-cols-4">
            {transport.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.label} className="relative flex min-h-20 items-center gap-3 bg-[#080a0b] px-3 py-3">
                  <Icon size={16} className="shrink-0 text-emerald-300/75" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-zinc-200">{step.label}</p>
                    <p className="mt-0.5 text-[9px] font-mono uppercase text-zinc-600">{step.detail}</p>
                  </div>
                  {index < transport.length - 1 && (
                    <span className="absolute -right-[5px] top-1/2 z-10 hidden -translate-y-1/2 text-emerald-300/50 md:block">›</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="mb-5 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.22em] text-emerald-300/70">
            <Terminal size={14} />
            Kernel-backed local mode
          </div>
          <h2 className="max-w-lg text-2xl font-semibold text-white md:text-3xl">
            A real x86 kernel in the message path.
          </h2>
          <p className="mt-5 text-sm leading-7 text-zinc-300">
            Built a custom 32-bit x86 kernel in C and Assembly, booted in QEMU and linked to an LLM through a Python COM1 serial bridge.
          </p>
          <p className="mt-4 text-sm leading-7 text-zinc-500">
            The public Vercel experience uses the same research interface with a direct cloud route. In local mode, AAOS sends each browser prompt from Next.js to FastAPI, through QEMU&apos;s virtual serial port, and into the kernel. The kernel verifies the request and displays the returned model response on VGA; inference still runs on the host or cloud provider.
          </p>

          <dl className="mt-7 border-y border-white/10">
            {kernelFacts.map(([term, value]) => (
              <div key={term} className="grid grid-cols-[86px_1fr] border-b border-white/10 py-3 last:border-b-0">
                <dt className="text-[9px] font-mono tracking-[0.18em] text-zinc-600">{term}</dt>
                <dd className="text-xs font-mono text-zinc-300">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="https://github.com/georgexu1118-ctrl/aaos/tree/main/src"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-emerald-300/25 bg-emerald-300/10 px-4 py-2.5 text-sm font-medium text-emerald-100 transition hover:bg-emerald-300/15"
            >
              Explore the kernel <ArrowUpRight size={15} />
            </Link>
            <Link
              href="https://github.com/georgexu1118-ctrl/aaos#kernel-backed-web-mode"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-white/10 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.04]"
            >
              How it connects <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
