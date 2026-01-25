import { useState, useEffect } from 'react';
import { Routes, Route, useLocation, NavLink, Link } from 'react-router-dom';
import { FairValueCalculator } from './pages/FairValueCalculator';
import { Moon, Sun, LayoutDashboard, Wallet, Calculator, TrendingUp, Settings as SettingsIcon, Eye, ArrowLeftRight, Landmark, Telescope } from 'lucide-react';


import { cn } from './utils';
import { PortfolioProvider } from './context/PortfolioContext';
import { ExchangeRateProvider } from './context/ExchangeRateContext';
import { Header } from './components/Header';
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

interface NavItemProps {
  to: string;
  icon: any;
  label: string;
  onClick?: () => void;
}

const NavItem = ({ to, icon: Icon, label, onClick }: NavItemProps) => {
  const location = useLocation();

  // Custom active logic: Check if we're on /dividends/edit with from=watchlist
  const isCustomActive = () => {
    const isOnDividendEdit = location.pathname.startsWith('/dividends/edit');
    if (!isOnDividendEdit) return false;

    const searchParams = new URLSearchParams(location.search);
    const fromWatchlist = searchParams.get('from') === 'watchlist';
    const fromPortfolio = searchParams.get('from') === 'portfolio';

    if (to === '/watchlist' && fromWatchlist) return true;
    if (to === '/portfolio' && fromPortfolio) return true;
    if (to === '/dividends' && (fromWatchlist || fromPortfolio)) return false;

    return false;
  };

  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) => {
        const isOnDividendEdit = location.pathname.startsWith('/dividends/edit');
        const searchParams = new URLSearchParams(location.search);
        const fromWatchlist = searchParams.get('from') === 'watchlist';
        const fromPortfolio = searchParams.get('from') === 'portfolio';

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

function App() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth >= 1024);

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
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  return (
    <ExchangeRateProvider>
      <PortfolioProvider>
        <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans antialiased text-sm">
          {/* Mobile Sidebar Overlay */}
          {isSidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-[1000] lg:hidden backdrop-blur-[2px]"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          <aside className={cn(
            "border-r border-border bg-card shadow-lg flex flex-col transition-all duration-300 ease-in-out overflow-hidden",
            "fixed lg:relative z-[1001] h-full",
            isSidebarOpen
              ? "translate-x-0 w-fit"
              : "-translate-x-full w-fit lg:translate-x-0 lg:w-0 lg:border-r-0"
          )}>
            <Link
              to="/portfolio"
              className="flex flex-col cursor-pointer group p-6 border-b border-border hover:bg-muted/50 transition-colors"
              onClick={closeSidebarOnMobile}
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
                const url = new URL(window.location.href);
                url.searchParams.set('v', Date.now().toString());
                window.location.href = url.toString();
              }}
              title="App neu laden (Cache leeren)"
            >
              <span className="text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">v{packageJson.version}</span>
            </div>

            <nav className="flex-1 p-4 space-y-2 w-fit">
              <NavItem to="/" icon={LayoutDashboard} label="Übersicht" onClick={closeSidebarOnMobile} />
              <NavItem to="/portfolio" icon={Wallet} label="Positionen" onClick={closeSidebarOnMobile} />
              <NavItem to="/dividends" icon={TrendingUp} label="Dividenden" onClick={closeSidebarOnMobile} />
              <NavItem to="/watchlist" icon={Eye} label="Watchlist" onClick={closeSidebarOnMobile} />
              <NavItem to="/calculator" icon={Calculator} label="Kauf / Verkauf" onClick={closeSidebarOnMobile} />
              <NavItem to="/fair-value" icon={Telescope} label="Fairer Wert" onClick={closeSidebarOnMobile} />
              <NavItem to="/mortgage" icon={Landmark} label="Budget" onClick={closeSidebarOnMobile} />

              <div className="pt-4 mt-4 border-t border-border">
                <NavItem to="/exchange-rates" icon={ArrowLeftRight} label="Wechselkurse" onClick={closeSidebarOnMobile} />
                <NavItem to="/settings" icon={SettingsIcon} label="Einstellungen" onClick={closeSidebarOnMobile} />
              </div>
            </nav>

            <div className="p-4 border-t border-border">
              <button
                onClick={toggleDarkMode}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full px-4"
              >
                {isDarkMode ? <Sun className="size-4" /> : <Moon className="size-4" />}
                <span>{isDarkMode ? "Light Mode" : "Dark Mode"}</span>
              </button>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background transition-all duration-300">
            <Header isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />

            <div>
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
                <Route path="/exchange-rates" element={<ExchangeRates />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </div>
          </main>
        </div>
      </PortfolioProvider>
    </ExchangeRateProvider >
  );
}

export default App;
