'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ChevronDown, Mail, Calculator } from 'lucide-react';

const TOOLS = [
  {
    name: 'Cancel Subscription',
    description: 'Free 3-step email sequence',
    href: '/tools/cancel-subscription',
    icon: Mail,
  },
  {
    name: 'Deposit Deadline Calculator',
    description: 'Check your state\u2019s return deadline',
    href: '/tools/deposit-deadline',
    icon: Calculator,
  },
];

export function ToolsDropdown() {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function handleEnter() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  }

  function handleLeave() {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  }

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-1 text-[13px] text-[#5F5F5F] transition-colors hover:text-[#111]"
      >
        Tools
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 rounded-xl border border-[#E8E8E5] bg-white p-2 shadow-premium-lg">
          {TOOLS.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              onClick={() => setOpen(false)}
              className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-[#F7F7F5]"
            >
              <tool.icon className="mt-0.5 h-4 w-4 shrink-0 text-[#8A8A8A]" />
              <div>
                <p className="text-[13px] font-medium text-[#111]">{tool.name}</p>
                <p className="text-[11px] text-[#8A8A8A]">{tool.description}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
