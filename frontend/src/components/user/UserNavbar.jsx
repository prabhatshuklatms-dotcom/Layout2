'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function UserNavbar() {
  const [isScrolled, setIsScrolled] = useState(false);

  // Add shadow on scroll
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-[#f4f2ef] border-zinc-200/60 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-[88px] flex items-center justify-between">
          
          {/* LEFT: Logo */}
          <div className="flex items-center">
            <Link href="/projects" className="flex items-center gap-4 group transition-transform duration-300 hover:scale-[1.02]">
              <img 
                src="/DELAWALA GROUP Logo.png" 
                alt="Delawala Icon" 
                className="h-16 w-auto object-contain" 
                onError={(e) => {
                  e.target.onerror = null; 
                  e.target.style.display = 'none';
                }}
              />
              <div className="flex flex-col justify-center">
                <span className="text-[28px] md:text-[34px] font-bold text-[#3f5777] leading-none" style={{ fontFamily: 'Georgia, serif' }}>
                  DELAWALA
                </span>
                <span className="text-[11px] md:text-[13px] font-semibold text-[#d4af37] tracking-[0.45em] uppercase mt-1">
                  G R O U P
                </span>
              </div>
            </Link>
          </div>

        </div>
      </div>
    </nav>
  );
}
