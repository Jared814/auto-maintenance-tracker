'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Car, LayoutDashboard, Settings, LogOut, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/vehicles', label: 'Vehicles', icon: Car },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-56 md:flex-col md:fixed md:inset-y-0 border-r border-border bg-sidebar z-10">
        <div className="flex h-14 items-center gap-2 px-4 border-b border-sidebar-border">
          <Wrench className="size-5 text-sidebar-primary" />
          <span className="font-semibold text-sm text-sidebar-foreground">AutoMaint</span>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2.5 py-2 rounded-lg text-sm transition-colors border-l-2',
                  active
                    ? 'bg-white/10 text-white font-medium border-sidebar-primary pl-[10px] pr-3'
                    : 'text-sidebar-foreground/80 hover:bg-white/8 hover:text-white border-transparent pl-3 pr-3'
                )}
              >
                <item.icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-2 border-t border-sidebar-border">
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm w-full text-sidebar-foreground/80 hover:bg-white/8 hover:text-white transition-colors"
          >
            <LogOut className="size-4 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 md:ml-56">
        <div className="pb-16 md:pb-0">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 border-t border-border bg-background z-10 flex">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex-1 flex flex-col items-center gap-0.5 py-2 text-xs text-muted-foreground"
        >
          <LogOut className="size-5" />
          Sign out
        </button>
      </nav>
    </div>
  );
}
