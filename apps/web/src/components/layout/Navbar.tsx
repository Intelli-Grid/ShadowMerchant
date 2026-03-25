"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Search, Menu, Bell, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SignInButton, UserButton, useAuth } from '@clerk/nextjs';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const q = (e.target as HTMLInputElement).value.trim();
      if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
    }
  };

  const navLinks = [
    { label: 'Top Deals', href: '/deals' },
    { label: 'Pro Exclusives', href: '/pro' },
    { label: 'Store Pick', href: '/store/amazon' },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full bg-[#0A0A0F]/80 backdrop-blur-xl border-b border-[#2A2A35]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center gap-2 cursor-pointer">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-[#FF6B00] to-[#FF9900] flex items-center justify-center font-black text-black shadow-lg shadow-[#FF6B00]/20">
              SM
            </div>
            <Link href="/" className="font-extrabold text-xl tracking-tight text-white hidden sm:block">
              Shadow<span className="text-[#FF6B00]">Merchant</span>
            </Link>
          </div>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link 
                key={link.href} 
                href={link.href}
                className={cn(
                  "text-sm font-semibold transition-colors duration-200",
                  pathname === link.href ? "text-[#FF6B00]" : "text-gray-400 hover:text-white"
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Search & Actions */}
          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center bg-[#13131A] border border-[#2A2A35] rounded-full px-3 py-1.5 focus-within:border-[#FF6B00] focus-within:ring-1 focus-within:ring-[#FF6B00] transition-all">
              <Search className="w-4 h-4 text-gray-500" />
              <input 
                type="text" 
                placeholder="Search deals, brands..." 
                onKeyDown={handleSearch}
                className="bg-transparent border-none text-sm text-white focus:outline-none w-48 px-2 placeholder-gray-600"
              />
            </div>

            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white md:hidden">
              <Search className="w-5 h-5" />
            </Button>

            {isLoaded && isSignedIn && (
              <>
                <Link href="/dashboard">
                  <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                    <Bell className="w-5 h-5" />
                  </Button>
                </Link>
                <UserButton appearance={{
                  elements: { avatarBox: "w-8 h-8 border-2 border-[#2A2A35] hover:border-[#FF6B00] transition-colors" }
                }}/>
              </>
            )}
            
            {isLoaded && !isSignedIn && (
              <>
                <SignInButton mode="modal">
                  <Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-[#1A1A24] font-semibold">
                    Log in
                  </Button>
                </SignInButton>
                <SignInButton mode="modal">
                  <Button className="bg-white text-black hover:bg-gray-200 font-bold hidden sm:flex">
                    Sign up
                  </Button>
                </SignInButton>
              </>
            )}

            {/* Mobile Menu Toggle */}
            <Button variant="ghost" size="icon" className="md:hidden text-white">
              <Menu className="w-6 h-6" />
            </Button>

          </div>
        </div>
      </div>
    </nav>
  );
}
