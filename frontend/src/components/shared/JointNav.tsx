"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const links = [
  { href: "/war-room",          icon: "⚔",  label: "War Room"        },
  { href: "/countdown",         icon: "⏳", label: "Countdown"       },
  { href: "/momentum",          icon: "💪", label: "Momentum"        },
  { href: "/shared-debts",      icon: "⛓",  label: "Shared Debts"    },
  { href: "/payment-warnings",  icon: "⚠",  label: "Payments"        },
  { href: "/payment-history",   icon: "📋", label: "History"         },
  { href: "/contributions",     icon: "📊", label: "Contributions"   },
  { href: "/shared-budget",     icon: "💰", label: "Budget"          },
  { href: "/boundaries",        icon: "🗂",  label: "Boundaries"      },
  { href: "/shared-forecast",   icon: "🔮", label: "Forecast"        },
  { href: "/shared-goals",      icon: "🎯", label: "Goals"           },
  { href: "/shared-growth",     icon: "🌱", label: "Growth"          },
  { href: "/shared-investments",icon: "📈", label: "Investments"     },
  { href: "/sacrifice-log",     icon: "✊", label: "Sacrifice Log"   },
  { href: "/safe-space",        icon: "💬", label: "Safe Space"      },
  { href: "/planning-session",  icon: "📅", label: "Planning"        },
  { href: "/members",           icon: "👥", label: "Members"         },
  { href: "/notifications",     icon: "🔔", label: "Notifications"   },
  { href: "/joint-settings",    icon: "⚙",  label: "Settings"        },
];

const mobileLinks = [
  { href: "/war-room",         icon: "⚔",  label: "War Room"  },
  { href: "/shared-debts",     icon: "⛓",  label: "Debts"     },
  { href: "/payment-warnings", icon: "⚠",  label: "Payments"  },
  { href: "/safe-space",       icon: "💬", label: "Space"     },
  { href: "/members",          icon: "👥", label: "More"      },
];

export default function JointNav() {
  const pathname = usePathname();
  const { logout, user } = useAuth();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-slate-700 bg-slate-900 h-screen sticky top-0 overflow-y-auto">
        <div className="px-4 py-5 border-b border-slate-700">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mb-0.5">Joint Account</p>
          <p className="text-lg font-bold text-purple-400">War Room</p>
          {user && <p className="text-xs text-slate-500 mt-1 truncate">{user.full_name}</p>}
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {links.map(({ href, icon, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                pathname === href
                  ? "bg-purple-500/20 text-purple-400 font-medium"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
              )}
            >
              <span className="text-base">{icon}</span>
              {label}
            </Link>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-slate-700 space-y-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300"
          >
            <span>👤</span> Switch to Personal
          </Link>
          <button
            onClick={logout}
            className="w-full text-left text-xs text-slate-500 hover:text-red-400 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-700 bg-slate-900 flex">
        {mobileLinks.map(({ href, icon, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 py-2 text-xs transition-colors",
              pathname === href ? "text-purple-400" : "text-slate-500 hover:text-slate-300"
            )}
          >
            <span className="text-lg leading-none">{icon}</span>
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
