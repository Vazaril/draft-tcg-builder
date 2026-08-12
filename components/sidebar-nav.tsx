'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, Layers, Search, Library } from 'lucide-react';
import { Button } from '@/components/ui/button';

const NAV_ITEMS = [
  { name: 'Profile', href: '/protected/profile', icon: User },
  { name: 'Deck Creation', href: '/protected/deck-creation', icon: Layers },
  { name: 'My Decklist', href: '/protected/my-decks', icon: Library },
  { name: 'Search Decks', href: '/protected/search', icon: Search },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-2">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href || pathname.endsWith(`${item.href}`);

        return (
          <Button key={item.name} variant={isActive ? 'sidebarActive' : 'sidebar'} asChild>
            <Link href={item.href}>
              <item.icon className="mr-3 h-4 w-4" />
              {item.name}
            </Link>
          </Button>
        );
      })}
    </div>
  );
}
