"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import Image from "next/image";

function LinkedInIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  );
}

function GitHubIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
    </svg>
  );
}

const NAV: { href: string; label: string; external?: boolean }[] = [
  { href: "/", label: "Research" },
  { href: "/chat", label: "Chat" },
];

export default function Navbar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 inset-x-0 z-50 glass border-b"
      style={{ borderColor: "rgba(120,60,240,0.15)" }}>
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          {/* Galileo moon engraving — tinted violet to blend with cosmic theme */}
          <div className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0"
            style={{
              boxShadow: "0 0 10px rgba(139,92,246,0.45), 0 0 20px rgba(124,58,237,0.20)",
              border: "1px solid rgba(139,92,246,0.45)",
            }}>
            <Image
              src="/galileo-moon.webp"
              alt="AAOS"
              width={32}
              height={32}
              className="w-full h-full object-cover object-top"
              style={{
                filter: "sepia(1) hue-rotate(222deg) saturate(2.2) brightness(0.72) contrast(1.25)",
                transform: "scale(1.08)",
              }}
              priority
            />
            {/* Subtle violet overlay to deepen blend */}
            <div className="absolute inset-0 rounded-full pointer-events-none"
              style={{ background: "rgba(88,28,235,0.18)", mixBlendMode: "multiply" }} />
          </div>
          <span className="text-sm font-bold tracking-[0.15em] uppercase text-gradient">
            AAOS
          </span>
          <span className="text-sm font-light tracking-widest text-violet-400/60 uppercase hidden sm:inline">
            Research
          </span>
        </Link>

        {/* Desktop links + social buttons */}
        <div className="hidden md:flex items-center gap-1">
          {NAV.map(n => {
            const active = path === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`px-4 py-1.5 rounded-lg text-[13px] tracking-wide transition-all duration-200
                  ${active
                    ? "text-violet-200 bg-violet-800/30 border border-violet-600/30"
                    : "text-violet-400/70 hover:text-violet-200 hover:bg-violet-900/30"
                  }`}
              >
                {n.label}
              </Link>
            );
          })}

          <div className="w-px h-4 bg-violet-700/40 mx-1" />

          <a href="https://www.linkedin.com/in/georgexu1118"
            target="_blank" rel="noopener noreferrer"
            title="LinkedIn"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium
              text-blue-300/70 hover:text-blue-200 hover:bg-blue-900/25
              border border-transparent hover:border-blue-700/30
              transition-all duration-200">
            <LinkedInIcon size={13} />
            <span className="hidden lg:inline">LinkedIn</span>
          </a>

          <a href="https://github.com/georgxzh"
            target="_blank" rel="noopener noreferrer"
            title="GitHub"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium
              text-zinc-300/70 hover:text-zinc-100 hover:bg-zinc-800/40
              border border-transparent hover:border-zinc-600/30
              transition-all duration-200">
            <GitHubIcon size={13} />
            <span className="hidden lg:inline">GitHub</span>
          </a>
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden text-violet-300" onClick={() => setOpen(o => !o)}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden glass border-t px-4 py-3 flex flex-col gap-1"
          style={{ borderColor: "rgba(120,60,240,0.12)" }}>
          {NAV.map(n => (
            <Link key={n.href} href={n.href}
              onClick={() => setOpen(false)}
              className="px-3 py-2 rounded-lg text-sm text-violet-300 hover:bg-violet-900/30 transition-colors">
              {n.label}
            </Link>
          ))}
          <div className="h-px bg-violet-700/30 my-1" />
          <a href="https://www.linkedin.com/in/georgexu1118"
            target="_blank" rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-blue-300/80 hover:bg-blue-900/25 transition-colors">
            <LinkedInIcon size={14} /> LinkedIn
          </a>
          <a href="https://github.com/georgxzh"
            target="_blank" rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-300/80 hover:bg-zinc-800/40 transition-colors">
            <GitHubIcon size={14} /> GitHub
          </a>
        </div>
      )}
    </nav>
  );
}
