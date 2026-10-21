import { useState, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate, NavLink, Link } from 'react-router-dom';
import { FairValueCalculator } from './pages/FairValueCalculator';
import { Moon, Sun, LayoutDashboard, Wallet, Calculator, TrendingUp, Settings as SettingsIcon, Eye, ArrowLeftRight, Landmark, Telescope, Menu, X, BarChart2, Cloud, Globe } from 'lucide-react';
import { CloudSyncModal } from './components/CloudSyncModal';


import { cn } from './utils';
import { PortfolioProvider } from './context/PortfolioContext';
import { ExchangeRateProvider } from './context/ExchangeRateContext';
import packageJson from '../package.json';

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
import { SeasonalityPage } from './pages/SeasonalityPage';
import { MarketOverviewPage } from './pages/MarketOverviewPage';

interface NavItemProps {
  to: string;
  icon: any;
  label: string;
  onClick?: () => void;
}

const NavItem = ({ to, icon: Icon, label, onClick }: NavItemProps) => {
  const location = useLocation();

  // Pass current stock context when switching from Stock Edit or Stock Detail to Kauf/Verkauf or Fairer Wert
  const getTargetUrl = () => {
    let activeStockParam: string | null = null;
    if (location.pathname.startsWith('/dividends/edit/')) {
      activeStockParam = location.pathname.split('/dividends/edit/')[1]?.split('/')[0] || null;
    } else if (location.pathname.startsWith('/stock/')) {
      activeStockParam = location.pathname.split('/stock/')[1]?.split('/')[0] || null;
    }
    if (activeStockParam && (to === '/calculator' || to === '/fair-value')) {
      return `${to}?stock=${encodeURIComponent(activeStockParam)}`;
    }
    return to;
  };

  // Custom active logic: Check if we're on /dividends/edit
  const isCustomActive = () => {
    const isOnDividendEdit = location.pathname.startsWith('/dividends/edit');
    if (!isOnDividendEdit) return false;

    const searchParams = new URLSearchParams(location.search);
    const fromWatchlist = searchParams.get('from') === 'watchlist';
    const fromPortfolio = searchParams.get('from') === 'portfolio';

    if (to === '/watchlist' && fromWatchlist) return true;
    if (to === '/portfolio' && fromPortfolio) return true;

    return false;
  };

  return (
    <NavLink
      to={getTargetUrl()}
      onClick={onClick}
      className={({ isActive }) => {
        const isOnDividendEdit = location.pathname.startsWith('/dividends/edit');
        const searchParams = new URLSearchParams(location.search);
        const fromDividends = searchParams.get('from') === 'dividends';

        const active = (to === '/dividends' && isOnDividendEdit && !fromDividends)
          ? false
          : (isActive || isCustomActive());

        return cn(
          "flex items-center gap-3 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap text-sm font-medium",
          active
            ? "bg-primary text-primary-foreground shadow-sm"
            : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
        );
      }}
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{label}</span>
    </NavLink>
  );
};

function App() {
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isCloudSyncOpen, setIsCloudSyncOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (window.innerWidth < 1280) {
      return false;
    }
    const saved = localStorage.getItem('sidebar_open');
    if (saved !== null) {
      return saved === 'true';
    }
    return true;
  });

  // Persist sidebar state
  useEffect(() => {
    localStorage.setItem('sidebar_open', String(isSidebarOpen));
  }, [isSidebarOpen]);

  // Prevent body scroll on mobile/tablet when sidebar is open so drawer scrolling is smooth and uninterrupted
  useEffect(() => {
    if (isSidebarOpen && window.innerWidth < 1280) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isSidebarOpen]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  // Dark Mode Effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const closeSidebarOnMobile = () => {
    if (window.innerWidth < 1280) setIsSidebarOpen(false);
  };

  return (
    <ExchangeRateProvider>
      <PortfolioProvider>
        <div className="flex h-screen h-[100dvh] bg-background text-foreground font-sans antialiased text-sm">
          {/* Mobile Hamburger Menu Button (visible when sidebar is closed) */}
          {!isSidebarOpen && (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="fixed top-3 left-3 z-[1100] p-2 bg-card/90 backdrop-blur-sm border border-border rounded-lg shadow-lg xl:hidden hover:bg-accent transition-colors active:scale-95"
              aria-label="Menü öffnen"
            >
              <Menu className="size-5" />
            </button>
          )}

          {/* Mobile Sidebar Overlay */}
          {isSidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-[1000] xl:hidden backdrop-blur-[2px]"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          <aside className={cn(
            "border-r border-border bg-card shadow-lg flex flex-col transition-all duration-300 ease-in-out",
            "fixed xl:relative z-[1001] h-full max-h-[100dvh] w-64 xl:w-60 shrink-0",
            isSidebarOpen
              ? "translate-x-0"
              : "-translate-x-full xl:translate-x-0"
          )}>
            {/* Header: Title + Close Button */}
            <div className="pt-[max(env(safe-area-inset-top),0.75rem)] px-3.5 pb-2.5 border-b border-border shrink-0">
              <div className="flex items-center justify-between">
                <Link
                  to="/portfolio"
                  className="flex items-center gap-2.5 cursor-pointer group hover:opacity-85 transition-opacity"
                  onClick={closeSidebarOnMobile}
                >
                  <div className="size-7 rounded-lg bg-primary flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm shrink-0">
                    <Wallet className="text-primary-foreground size-4" />
                  </div>
                  <h1 className="text-lg font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">Portfolio</h1>
                </Link>

                {/* Close Button (Mobile / Tablet) */}
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1.5 -mr-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors xl:hidden active:scale-95"
                  aria-label="Menü schließen"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Version & Cloud Sync Badges */}
              <div className="mt-2 flex items-center gap-2">
                <span
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const url = new URL(window.location.href);
                    url.searchParams.set('v', Date.now().toString());
                    window.location.href = url.toString();
                  }}
                  className="text-[11px] font-bold bg-blue-600/40 text-white px-2.5 py-0.5 rounded-full hover:bg-blue-600/60 transition-colors border border-blue-400/50 cursor-pointer shadow-sm"
                  title="App neu laden (Cache leeren)"
                >
                  v{packageJson.version}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    closeSidebarOnMobile();
                    setIsCloudSyncOpen(true);
                  }}
                  className="flex items-center gap-1.5 text-[11px] font-bold bg-blue-600/40 hover:bg-blue-600/60 text-white px-2.5 py-0.5 rounded-full transition-all border border-blue-400/50 shadow-sm"
                  title="☁️ GitHub Cloud-Sync"
                >
                  <Cloud className="size-3 text-white" />
                  <span>Cloud-Sync</span>
                </button>
              </div>
            </div>

            {/* Navigation links: uniform spacing, perfectly sized, scrollable with touch momentum */}
            <nav
              className="flex-1 px-2.5 py-2 flex flex-col gap-1 overflow-y-auto overscroll-contain scroller-none touch-pan-y"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <NavItem to="/" icon={LayoutDashboard} label="Übersicht" onClick={closeSidebarOnMobile} />
              <NavItem to="/portfolio" icon={Wallet} label="Positionen" onClick={closeSidebarOnMobile} />
              <NavItem to="/dividends" icon={TrendingUp} label="Dividenden" onClick={closeSidebarOnMobile} />
              <NavItem to="/watchlist" icon={Eye} label="Watchlist" onClick={closeSidebarOnMobile} />
              <NavItem to="/calculator" icon={Calculator} label="Kauf / Verkauf" onClick={closeSidebarOnMobile} />
              <NavItem to="/fair-value" icon={Telescope} label="Fairer Wert" onClick={closeSidebarOnMobile} />
              <NavItem to="/mortgage" icon={Landmark} label="Budget" onClick={closeSidebarOnMobile} />
              <NavItem to="/seasonality" icon={BarChart2} label="Saisonalität" onClick={closeSidebarOnMobile} />
              <NavItem to="/market-overview" icon={Globe} label="Marktübersicht" onClick={closeSidebarOnMobile} />

              <div className="my-1 border-t border-border/80" />

              <NavItem to="/exchange-rates" icon={ArrowLeftRight} label="Finanz Rechner" onClick={closeSidebarOnMobile} />
              <NavItem to="/settings" icon={SettingsIcon} label="Einstellungen" onClick={closeSidebarOnMobile} />
            </nav>

            {/* Footer with Dark Mode Toggle */}
            <div className="p-2 border-t border-border mt-auto shrink-0 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
              <button
                onClick={toggleDarkMode}
                className="flex items-center gap-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors w-full px-3 py-1.5 rounded-lg"
              >
                {isDarkMode ? <Sun className="size-4 shrink-0" /> : <Moon className="size-4 shrink-0" />}
                <span>{isDarkMode ? "Light Mode" : "Dark Mode"}</span>
              </button>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-background transition-all duration-300 flex flex-col">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/watchlist" element={<Watchlist />} />
              <Route path="/calculator" element={<DividendCalculator />} />
              <Route path="/fair-value" element={<FairValueCalculator />} />
              <Route path="/dividends" element={<DividendPlanner />} />
              <Route path="/dividends/add" element={<EditDividendPage />} />
              <Route path="/dividends/edit/:stockId" element={<EditDividendPage />} />
              <Route path="/stock/:id" element={<StockDetail />} />
              <Route path="/mortgage" element={<MortgageCalculator />} />
              <Route path="/seasonality" element={<SeasonalityPage />} />
              <Route path="/seasonality/:symbol" element={<SeasonalityPage />} />
              <Route path="/market-overview" element={<MarketOverviewPage />} />
              <Route path="/exchange-rates" element={<ExchangeRates />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>

          <CloudSyncModal
            isOpen={isCloudSyncOpen}
            onClose={() => setIsCloudSyncOpen(false)}
            onOpenSettings={() => {
              navigate('/settings');
              closeSidebarOnMobile();
            }}
          />
        </div>
      </PortfolioProvider>
    </ExchangeRateProvider >
  );
}

export default App;
