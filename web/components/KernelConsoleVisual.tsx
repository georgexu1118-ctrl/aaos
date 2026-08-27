"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const protocolFrames = [
  {
    direction: "TX",
    frame: "> How does AAOS connect the kernel to AI?",
    detail: "Browser request enters COM1",
    color: "text-cyan-300",
  },
  {
    direction: "RX",
    frame: "? How does AAOS connect the kernel to AI?",
    detail: "Kernel echo verified",
    color: "text-emerald-300",
  },
  {
    direction: "TX",
    frame: "< Response returned to the VGA console",
    detail: "Model output crosses COM1",
    color: "text-amber-300",
  },
];

export default function KernelConsoleVisual() {
  const [activeFrame, setActiveFrame] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveFrame(current => (current + 1) % protocolFrames.length);
    }, 2200);
    return () => window.clearInterval(timer);
  }, []);

  const current = protocolFrames[activeFrame];

  return (
    <div
      className="overflow-hidden rounded-lg border border-emerald-300/20 bg-black shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
      aria-label="Animated replay of the AAOS kernel COM1 protocol"
    >
      <div className="flex h-9 items-center justify-between border-b border-white/10 bg-[#101211] px-3">
        <div className="flex min-w-0 items-center gap-2 text-[9px] font-mono uppercase text-zinc-500 sm:text-[10px]">
          <span className="kernel-status-pulse h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
          <span className="truncate">QEMU i386 · protocol replay</span>
        </div>
        <span className="ml-2 shrink-0 text-[9px] font-mono text-zinc-600">720 × 400</span>
      </div>

      <div className="scanlines group relative aspect-[9/5] overflow-hidden bg-black">
        <Image
          src="/aaos-kernel.png"
          alt="Actual AAOS kernel VGA output captured from QEMU after a COM1 message round trip"
          fill
          sizes="(max-width: 1024px) 100vw, 58vw"
          className="kernel-screen-image object-contain transition-transform duration-700 group-hover:scale-[1.015]"
          style={{ imageRendering: "pixelated" }}
          priority={false}
        />

        <div className="kernel-scan-beam absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-transparent via-emerald-300/[0.06] to-transparent" />

        <div className="absolute inset-x-3 bottom-3 overflow-hidden rounded border border-emerald-300/15 bg-black/90 px-3 py-2 backdrop-blur-sm sm:inset-x-4 sm:bottom-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[9px] font-mono uppercase tracking-[0.16em] text-zinc-600">
                COM1 frame · {current.detail}
              </p>
              <p key={current.frame} className={`kernel-frame-enter mt-1 truncate text-[10px] font-mono sm:text-xs ${current.color}`}>
                {current.direction} {current.frame}
              </p>
            </div>
            <div className="flex shrink-0 gap-1" aria-hidden="true">
              {protocolFrames.map((frame, index) => (
                <span
                  key={frame.detail}
                  className={`h-1 w-4 rounded-sm transition-colors duration-300 ${
                    index === activeFrame ? "bg-emerald-300" : "bg-zinc-800"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
