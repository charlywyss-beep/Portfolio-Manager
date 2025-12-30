import { useState, useEffect } from 'react';
import { Routes, Route, useLocation, NavLink, Link } from 'react-router-dom';
import { Moon, Sun, LayoutDashboard, Wallet, Calculator, TrendingUp, Settings as SettingsIcon, Eye, Menu, X, ArrowLeftRight, Landmark } from 'lucide-react';
import { cn } from './utils';
import { PortfolioProvider } from './context/PortfolioContext';
import { ExchangeRateProvider } from './context/ExchangeRateContext';

import { Dashboard } from './pages/Dashboard';
import { Portfolio } from './pages/Portfolio';
import { DividendPlanner } from './pages/DividendPlanner';
import { EditDividendPage } from './pages/EditDividendPage';
import { DividendCalculator } from './pages/DividendCalculator';
import { Settings } from './pages/Settings';
import { Watchlist } from './pages/Watchlist';
import { StockDetail } from './pages/StockDetail';
import { ExchangeRates } from './pages/ExchangeRates';
import { MortgageCalculator } from './pages/MortgageCalculator';

function App() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth >= 1024);

  const location = useLocation();

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    // document.documentElement.classList.toggle('dark'); // Handled by effect
  };

  // Dark Mode Effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const getPageTitle = (pathname: string) => {
    if (pathname === '/') return 'Portfolio Übersicht';
    if (pathname === '/portfolio') return 'Positionen';
    if (pathname === '/watchlist') return 'Watchlist';
    if (pathname === '/calculator') return 'Kauf / Verkauf';
    if (pathname === '/dividends') return 'Dividenden';
    if (pathname === '/mortgage') return 'Hypotheken Rechner';
    if (pathname === '/exchange-rates') return 'Wechselkurse';
    if (pathname === '/settings') return 'Einstellungen';
    if (pathname.startsWith('/stock/')) return 'Aktien Details';
    return 'Portfolio Manager';
  };

  const NavItem = ({ to, icon: Icon, label }: { to: string, icon: any, label: string }) => {
    const location = useLocation();

    // Custom active logic: Check if we're on /dividends/edit with from=watchlist
    const isCustomActive = () => {
      const isOnDividendEdit = location.pathname.startsWith('/dividends/edit');
      if (!isOnDividendEdit) return false;

      const searchParams = new URLSearchParams(location.search);
      const fromWatchlist = searchParams.get('from') === 'watchlist';
      const fromPortfolio = searchParams.get('from') === 'portfolio';

      // If editing from watchlist, highlight Watchlist
      if (to === '/watchlist' && fromWatchlist) {
        return true;
      }
      // If editing from portfolio, highlight Portfolio
      if (to === '/portfolio' && fromPortfolio) {
        return true;
      }

      // Don't highlight Dividenden if we're editing from watchlist OR portfolio
      if (to === '/dividends' && (fromWatchlist || fromPortfolio)) {
        return false;
      }

      return false;
    };

    return (
      <NavLink
        to={to}
        onClick={() => {
          if (window.innerWidth < 1024) setIsSidebarOpen(false);
        }}
        className={({ isActive }) => {
          // Override isActive for /dividends/edit when from=watchlist
          const isOnDividendEdit = location.pathname.startsWith('/dividends/edit');
          const searchParams = new URLSearchParams(location.search);
          const fromWatchlist = searchParams.get('from') === 'watchlist';
          const fromPortfolio = searchParams.get('from') === 'portfolio';

          // If we're on dividend edit from watchlist/portfolio and this is the Dividenden nav item, don't highlight
          if (to === '/dividends' && isOnDividendEdit && (fromWatchlist || fromPortfolio)) {
            return cn(
              "flex items-center gap-6 px-4 py-2.5 rounded-md transition-all whitespace-nowrap mx-2 mb-1",
              "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
            );
          }

          return cn(
            "flex items-center gap-6 px-4 py-2.5 rounded-md transition-all whitespace-nowrap mx-2 mb-1",
            (isActive || isCustomActive())
              ? "bg-primary text-primary-foreground shadow-sm"
              : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
          );
        }}
      >
        <Icon className="size-5 shrink-0" />
        <span className="font-medium">{label}</span>
      </NavLink>
    );
  };

  return (
    <ExchangeRateProvider>
      <PortfolioProvider>
        <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans antialiased text-sm">
          {/* Mobile Sidebar Overlay */}
          {isSidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-[2px]"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          <aside className={cn(
            "border-r border-border bg-card shadow-lg flex flex-col transition-all duration-300 ease-in-out overflow-hidden",
            "fixed lg:relative z-50 h-full",
            isSidebarOpen
              ? "translate-x-0 w-fit"
              : "-translate-x-full w-fit lg:translate-x-0 lg:w-0 lg:border-r-0"
          )}>
            <Link
              to="/portfolio"
              className="flex flex-col cursor-pointer group p-6 border-b border-border hover:bg-muted/50 transition-colors"
              title="Gehe zu Positionen"
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="size-8 rounded-lg bg-primary flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm">
                  <Wallet className="text-primary-foreground size-5" />
                </div>
                <h1 className="text-xl font-bold tracking-tight group-hover:text-primary transition-colors">Portfolio</h1>
              </div>
            </Link>
            <div
              className="px-6 pb-4 cursor-pointer w-fit"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // Force Hard Reload by appending unique timestamp
                const url = new URL(window.location.href);
                url.searchParams.set('v', Date.now().toString());
                window.location.href = url.toString();
              }}
              title="App neu laden (Cache leeren)"
            >
              <div className="text-[10px] text-foreground font-bold font-mono flex items-center gap-1 group/version">
                <span>v3.11.406</span>
                <span className="opacity-0 group-hover/version:opacity-100 transition-opacity text-[8px] text-muted-foreground ml-1">RELOAD</span>
              </div>
            </div>

            <nav className="flex-1 p-4 space-y-2 w-fit">
              <NavItem to="/" icon={LayoutDashboard} label="Übersicht" />
              <NavItem to="/portfolio" icon={Wallet} label="Positionen" />
              <NavItem to="/dividends" icon={TrendingUp} label="Dividenden" />
              <NavItem to="/watchlist" icon={Eye} label="Watchlist" />
              <NavItem to="/calculator" icon={Calculator} label="Kauf / Verkauf" />
              <NavItem to="/mortgage" icon={Landmark} label="Hypotheken" />



              <div className="pt-4 mt-4 border-t border-border">
                <NavItem to="/exchange-rates" icon={ArrowLeftRight} label="Wechselkurse" />
                <NavItem to="/settings" icon={SettingsIcon} label="Einstellungen" />
              </div>
            </nav>

            <div className="p-4 border-t border-border">
              <button
                onClick={toggleDarkMode}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {isDarkMode ? <Sun className="size-4" /> : <Moon className="size-4" />}
                <span>{isDarkMode ? "Light Mode" : "Dark Mode"}</span>
              </button>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 overflow-auto bg-background transition-all duration-300">
            <header className="h-16 border-b border-border flex items-center justify-between px-4 md:px-8 bg-card sticky top-0 z-[200]">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="p-2 hover:bg-accent rounded-md transition-colors relative z-50"
                  aria-label="Toggle menu"
                >
                  {isSidebarOpen ? <X className="size-5" /> : <Menu className="size-5" />}
                </button>
                <button
                  onClick={() => {
                    const url = new URL(window.location.href);
                    url.searchParams.set('v', Date.now().toString());
                    window.location.href = url.toString();
                  }}
                  className="text-xs font-semibold text-foreground/90 hover:text-primary transition-colors bg-secondary/20 hover:bg-secondary/40 px-2 py-0.5 rounded"
                  title="Klicken zum Neuladen (Cache leeren)"
                >
                  v3.11.406
                </button>
                <h2 className="text-lg font-semibold capitalize">
                  {getPageTitle(location.pathname)}
                </h2>
              </div>
            </header>

            <div>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/portfolio" element={<Portfolio />} />
                <Route path="/watchlist" element={<Watchlist />} />
                <Route path="/calculator" element={<DividendCalculator />} />
                <Route path="/dividends" element={<DividendPlanner />} />
                <Route path="/dividends/add" element={<EditDividendPage />} />
                <Route path="/dividends/edit/:stockId" element={<EditDividendPage />} />
                <Route path="/stock/:id" element={<StockDetail />} />
                <Route path="/mortgage" element={<MortgageCalculator />} />
                <Route path="/exchange-rates" element={<ExchangeRates />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </div>
          </main>
        </div>
      </PortfolioProvider >
    </ExchangeRateProvider >
  );
}

export default App;

