import { useState } from 'react';
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

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'portfolio' | 'watchlist' | 'calculator' | 'dividends' | 'settings'>('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  // Initial Dark Mode check
  useState(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    }
  });

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard onNavigate={(tab) => setActiveTab(tab as any)} />;
      case 'portfolio': return <Portfolio />;

      case 'watchlist': return <Watchlist />;
      case 'calculator': return <DividendCalculator />;
      case 'dividends': return <DividendPlanner />;
      case 'settings': return <Settings />;
      default: return <Dashboard onNavigate={(tab) => setActiveTab(tab as any)} />;
    }
  };

  return (
    <ExchangeRateProvider>
      <PortfolioProvider>
        <div className="flex h-screen w-full bg-background text-foreground transition-colors duration-300">
          {/* Mobile Overlay */}
          {isSidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          <aside className={cn(
            "w-64 border-r border-border bg-card shadow-lg flex flex-col transition-transform duration-300 ease-in-out",
            "fixed md:relative z-50 h-full",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          )}>
            <div className="p-6 border-b border-border">
              <div className="flex items-center gap-2 mb-1">
                <div className="size-8 rounded-lg bg-primary flex items-center justify-center">
                  <Wallet className="text-primary-foreground size-5" />
                </div>
                <h1 className="text-xl font-bold tracking-tight">Portfolio</h1>
              </div>
              <div className="text-xs text-muted-foreground ml-10">v3.5.7</div>
            </div>

            <nav className="flex-1 p-4 space-y-2">
              <button
                onClick={() => {
                  setActiveTab('dashboard');
                  setIsSidebarOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all whitespace-nowrap",
                  activeTab === 'dashboard'
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <LayoutDashboard className="size-5" />
                <span>Übersicht</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('portfolio');
                  setIsSidebarOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all whitespace-nowrap",
                  activeTab === 'portfolio'
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Wallet className="size-5" />
                <span>Meine Positionen</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('dividends');
                  setIsSidebarOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all whitespace-nowrap",
                  activeTab === 'dividends'
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <TrendingUp className="size-5" />
                <span>Dividenden Planer</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('watchlist');
                  setIsSidebarOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all whitespace-nowrap",
                  activeTab === 'watchlist'
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Eye className="size-5" />
                <span>Watchlist</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('calculator');
                  setIsSidebarOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all whitespace-nowrap",
                  activeTab === 'calculator'
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Calculator className="size-5" />
                <span>Performance-Rechner</span>
              </button>



              <div className="pt-4 mt-4 border-t border-border">
                <button
                  onClick={() => {
                    setActiveTab('settings');
                    setIsSidebarOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all whitespace-nowrap",
                    activeTab === 'settings'
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <SettingsIcon className="size-5" />
                  <span>Einstellungen</span>
                </button>
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
          <main className="flex-1 overflow-auto bg-background">
            <header className="h-16 border-b border-border flex items-center justify-between px-4 md:px-8 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
              <div className="flex items-center gap-4">
                {/* Mobile Hamburger Menu */}
                <button
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="md:hidden p-2 hover:bg-accent rounded-md transition-colors"
                  aria-label="Toggle menu"
                >
                  {isSidebarOpen ? <X className="size-5" /> : <Menu className="size-5" />}
                </button>
                <h2 className="text-lg font-semibold capitalize">
                  {activeTab === 'dashboard' && 'Portfolio Übersicht'}
                  {activeTab === 'portfolio' && 'Meine Positionen'}
                  {activeTab === 'watchlist' && 'Watchlist'}
                  {activeTab === 'calculator' && 'Performance-Rechner'}
                  {activeTab === 'dividends' && 'Dividenden Planer'}
                  {activeTab === 'settings' && 'Einstellungen'}
                </h2>
              </div>
              <div className="flex items-center gap-4">
                {/* Placeholder for User Profile or other actions */}
                <div className="size-8 rounded-full bg-accent/50 border border-border" />
              </div>
            </header>

            <div className="p-8">
              {renderContent()}
            </div>
          </main>
        </div>
      </PortfolioProvider>
    </ExchangeRateProvider>
  );
}

export default App;
