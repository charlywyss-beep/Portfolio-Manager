import { useState, useEffect } from 'react';
import { Routes, Route, useLocation, NavLink } from 'react-router-dom';
import { Moon, Sun, LayoutDashboard, Wallet, Calculator, TrendingUp, Settings as SettingsIcon, Eye, Menu, X } from 'lucide-react';
import { cn } from './utils';
import { PortfolioProvider } from './context/PortfolioContext';
import { ExchangeRateProvider } from './context/ExchangeRateContext';

import { Dashboard } from './pages/Dashboard';
import { Portfolio } from './pages/Portfolio';
import { DividendPlanner } from './pages/DividendPlanner';
import { DividendCalculator } from './pages/DividendCalculator';
import { Settings } from './pages/Settings';
import { Watchlist } from './pages/Watchlist';
import { StockDetail } from './pages/StockDetail';

function App() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth >= 640);
  // const navigate = useNavigate(); // Unused
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
    if (pathname === '/portfolio') return 'Meine Positionen';
    if (pathname === '/watchlist') return 'Watchlist';
    if (pathname === '/calculator') return 'Performance-Rechner';
    if (pathname === '/dividends') return 'Dividenden Planer';
    if (pathname === '/settings') return 'Einstellungen';
    if (pathname.startsWith('/stock/')) return 'Aktien Details';
    return 'Portfolio Manager';
  };

  const NavItem = ({ to, icon: Icon, label }: { to: string, icon: any, label: string }) => (
    <NavLink
      to={to}
      onClick={() => {
        if (window.innerWidth < 640) setIsSidebarOpen(false);
      }}
      className={({ isActive }) => cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all whitespace-nowrap",
        isActive
          ? "bg-primary text-primary-foreground shadow-sm"
          : "hover:bg-accent hover:text-accent-foreground"
      )}
    >
      <Icon className="size-5" />
      <span>{label}</span>
    </NavLink>
  );

  return (
    <ExchangeRateProvider>
      <PortfolioProvider>
        <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans antialiased text-sm">
          {/* Sidebar */}
          <aside className={cn(
            "border-r border-border bg-card shadow-lg flex flex-col transition-all duration-300 ease-in-out overflow-hidden",
            "fixed sm:relative z-50 h-full",
            isSidebarOpen
              ? "translate-x-0 w-64"
              : "-translate-x-full w-64 sm:translate-x-0 sm:w-0 sm:border-r-0"
          )}>
            <div className="p-6 border-b border-border min-w-[16rem]">
              <div className="flex items-center gap-2 mb-1">
                <div className="size-8 rounded-lg bg-primary flex items-center justify-center">
                  <Wallet className="text-primary-foreground size-5" />
                </div>
                <h1 className="text-xl font-bold tracking-tight">Portfolio</h1>
              </div>
              <div className="text-xs text-muted-foreground ml-10">v3.8.20</div>
            </div>

            <nav className="flex-1 p-4 space-y-2 min-w-[16rem]">
              <NavItem to="/" icon={LayoutDashboard} label="Übersicht" />
              <NavItem to="/portfolio" icon={Wallet} label="Meine Positionen" />
              <NavItem to="/dividends" icon={TrendingUp} label="Dividenden Planer" />
              <NavItem to="/watchlist" icon={Eye} label="Watchlist" />
              <NavItem to="/calculator" icon={Calculator} label="Performance-Rechner" />

              <div className="pt-4 mt-4 border-t border-border">
                <NavItem to="/settings" icon={SettingsIcon} label="Einstellungen" />
              </div>
            </nav>

            <div className="p-4 border-t border-border min-w-[16rem]">
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
            <header className="h-16 border-b border-border flex items-center justify-between px-4 md:px-8 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="p-2 hover:bg-accent rounded-md transition-colors relative z-50"
                  aria-label="Toggle menu"
                >
                  {isSidebarOpen ? <X className="size-5" /> : <Menu className="size-5" />}
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
                <Route path="/settings" element={<Settings />} />
                <Route path="/stock/:id" element={<StockDetail />} />
              </Routes>
            </div>
          </main>
        </div>
      </PortfolioProvider>
    </ExchangeRateProvider>
  );
}

export default App;
