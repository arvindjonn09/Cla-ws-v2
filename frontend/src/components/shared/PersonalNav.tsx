"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { accountApi } from "@/lib/api";
import { cn, saveAccountMemberships, saveJointAccountMeta } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const links = [
  { href: "/dashboard",       icon: "⚡", label: "Dashboard"     },
  { href: "/debts",           icon: "⛓",  label: "Debts"         },
  { href: "/budget",          icon: "📊", label: "Budget"        },
  { href: "/goals",           icon: "🎯", label: "Goals"         },
  { href: "/investments",     icon: "📈", label: "Investments"   },
  { href: "/net-worth",       icon: "💎", label: "Net Worth"     },
  { href: "/emergency-fund",  icon: "🛡",  label: "Emergency"     },
  { href: "/subscriptions",   icon: "🔁", label: "Subscriptions" },
  { href: "/bills",           icon: "🧾", label: "Bills"         },
  { href: "/transactions",    icon: "📋", label: "Transactions"  },
  { href: "/forecast",        icon: "🔮", label: "Forecast"      },
  { href: "/growth",          icon: "🌱", label: "Growth"        },
  { href: "/journal",         icon: "📓", label: "Journal"       },
  { href: "/settings",        icon: "⚙",  label: "Settings"      },
];

// Bottom tabs shown on mobile (most-used 5)
const mobileLinks = [
  { href: "/dashboard",   icon: "⚡", label: "Home"    },
  { href: "/debts",       icon: "⛓",  label: "Debts"   },
  { href: "/budget",      icon: "📊", label: "Budget"  },
  { href: "/goals",       icon: "🎯", label: "Goals"   },
  { href: "/settings",    icon: "⚙",  label: "More"    },
];

export default function PersonalNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuth();
  const [hasJointAccount, setHasJointAccount] = useState(false);
  const [creatingJoint, setCreatingJoint] = useState(false);
  const [jointError, setJointError] = useState("");

  useEffect(() => {
    accountApi.listMine()
      .then((memberships) => {
        saveAccountMemberships(memberships);
        setHasJointAccount(memberships.some((m) => m.account.type === "joint" && m.status === "active"));
      })
      .catch(() => setHasJointAccount(false));
  }, []);

  async function createJointAccount() {
    setCreatingJoint(true);
    setJointError("");
    try {
      const account = await accountApi.createJoint({
        name: "Joint Account",
        base_currency: "USD",
      });
      saveJointAccountMeta(account.id, "member", true);
      const memberships = await accountApi.listMine().catch(() => []);
      saveAccountMemberships(memberships);
      setHasJointAccount(true);
      router.push("/war-room");
    } catch (err) {
      setJointError(err instanceof Error ? err.message : "Failed to create joint account");
    } finally {
      setCreatingJoint(false);
    }
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-slate-700 bg-slate-900 h-screen sticky top-0 overflow-y-auto">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-slate-700">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mb-0.5">Financial</p>
          <p className="text-lg font-bold text-blue-400">Command Center</p>
          {user && <p className="text-xs text-slate-500 mt-1 truncate">{user.full_name}</p>}
        </div>

        {/* Links */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {links.map(({ href, icon, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                pathname === href || pathname.startsWith(href + "/")
                  ? "bg-blue-500/20 text-blue-400 font-medium"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
              )}
            >
              <span className="text-base">{icon}</span>
              {label}
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-slate-700 space-y-2">
          {hasJointAccount ? (
            <Link
              href="/war-room"
              className="flex items-center gap-2 text-xs text-purple-400 hover:text-purple-300"
            >
              <span>🤝</span> Switch to Joint
            </Link>
          ) : (
            <button
              type="button"
              onClick={createJointAccount}
              disabled={creatingJoint}
              className="flex items-center gap-2 text-xs text-purple-400 hover:text-purple-300 disabled:opacity-50"
            >
              <span>🤝</span> {creatingJoint ? "Creating Joint..." : "Create Joint"}
            </button>
          )}
          {jointError && <p className="text-xs text-red-400">{jointError}</p>}
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
              pathname === href
                ? "text-blue-400"
                : "text-slate-500 hover:text-slate-300"
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
