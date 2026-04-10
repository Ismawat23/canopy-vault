import { ReactNode, useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Lock, 
  History,
  Wallet,
  PieChart,
  Timer,
  Droplets,
  ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import logoUrl from "/canopy-vault-logo.png";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [walletOpen, setWalletOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Portfolio", href: "/portfolio", icon: PieChart },
    { name: "Vaults", href: "/vaults", icon: Lock },
    { name: "Vesting", href: "/vesting", icon: Timer },
    { name: "Liquidity", href: "/liquidity", icon: Droplets },
  ];

  const walletMenuItems = [
    { name: "Wallets", href: "/wallets", icon: Wallet },
    { name: "Transactions", href: "/transactions", icon: History },
  ];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setWalletOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isWalletActive = walletMenuItems.some(
    (item) => location === item.href || location.startsWith(item.href)
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Header */}
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6 sticky top-0 z-50">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <img src={logoUrl} alt="Canopy Vault Logo" className="w-9 h-9 object-contain" />
          <div>
            <h1 className="font-bold text-base tracking-tight leading-none">Canopy Vault</h1>
            <p className="text-[11px] text-muted-foreground">DeFi Security</p>
          </div>
        </div>

        {/* Wallet Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setWalletOpen((v) => !v)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border transition-colors",
              isWalletActive || walletOpen
                ? "bg-primary/10 text-primary border-primary/30"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Wallet className="w-4 h-4" />
            Wallet
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", walletOpen && "rotate-180")} />
          </button>

          {walletOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-md border border-border bg-card shadow-lg z-50 overflow-hidden">
              {walletMenuItems.map((item) => {
                const isActive = location === item.href || location.startsWith(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setWalletOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 border-r border-border bg-card flex flex-col h-[calc(100vh-56px)] sticky top-14">
          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0"></div>
              Mainnet Connected
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 md:p-10 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
