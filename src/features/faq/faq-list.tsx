"use client";

import { useState } from "react";

export interface FaqItem {
  q: string;
  a: string;
}
export interface FaqGroup {
  title: string;
  items: FaqItem[];
}

export default function FaqList({ groups }: { groups: FaqGroup[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-12">
      {groups.map((group) => (
        <div key={group.title}>
          <h2 className="font-bebas text-3xl text-foreground mb-5 flex items-center gap-3">
            <span className="block w-6 h-px bg-[#E8A020]" />
            {group.title}
          </h2>
          <div className="space-y-4">
            {group.items.map((item, idx) => {
              const key = `${group.title}-${idx}`;
              const isOpen = open === key;
              return (
                <div
                  key={key}
                  className="border border-[#E8EAF0] hover:border-[#E8A020] transition-colors duration-300"
                >
                  <button
                    onClick={() => setOpen(isOpen ? null : key)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between p-5 md:p-6 text-left hover:bg-[#FAF7F0] transition-colors duration-300"
                  >
                    <span className="font-medium text-foreground text-base md:text-lg">
                      {item.q}
                    </span>
                    <span
                      className={`text-2xl text-primary transition-transform duration-300 flex-shrink-0 ml-4 ${
                        isOpen ? "rotate-45" : ""
                      }`}
                    >
                      +
                    </span>
                  </button>
                  {isOpen ? (
                    <div className="px-5 md:px-6 pb-5 md:pb-6 text-sm md:text-base text-[#555870] leading-relaxed border-t border-[#E8EAF0]">
                      {item.a}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
