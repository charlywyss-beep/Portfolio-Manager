import { useState } from 'react';
import { Moon, Sun, LayoutDashboard, Wallet, Calculator } from 'lucide-react';
import { cn } from './utils';
import { PortfolioProvider } from './context/PortfolioContext';
import { ExchangeRateProvider } from './context/ExchangeRateContext';

import { Dashboard } from './pages/Dashboard';
import { Portfolio } from './pages/Portfolio';
import { DividendCalculator } from './pages/DividendCalculator';

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'portfolio' | 'calculator'>('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(true);

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
      case 'dashboard': return <Dashboard />;
      case 'portfolio': return <Portfolio />;
      case 'calculator': return <DividendCalculator />;
      default: return <Dashboard />;
    }
  };

  return (
    <ExchangeRateProvider>
      <PortfolioProvider>
        <div className="flex h-screen w-full bg-background text-foreground transition-colors duration-300">
          {/* Sidebar */}
          <aside className="w-64 border-r border-border bg-card shadow-lg flex flex-col">
            <div className="p-6 border-b border-border">
              <div className="flex items-center gap-2 mb-1">
                <div className="size-8 rounded-lg bg-primary flex items-center justify-center">
                  <Wallet className="text-primary-foreground size-5" />
                </div>
                <h1 className="text-xl font-bold tracking-tight">Portfolio</h1>
              </div>
              <div className="text-xs text-muted-foreground ml-10">v1.2.6</div>
            </div>

            <nav className="flex-1 p-4 space-y-2">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all",
                  activeTab === 'dashboard'
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <LayoutDashboard className="size-5" />
                <span>Übersicht</span>
              </button>

              <button
                onClick={() => setActiveTab('portfolio')}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all",
                  activeTab === 'portfolio'
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Wallet className="size-5" />
                <span>Depot</span>
              </button>

              <button
                onClick={() => setActiveTab('calculator')}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all",
                  activeTab === 'calculator'
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Calculator className="size-5" />
                <span>Dividenden Planer</span>
              </button>
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
            <header className="h-16 border-b border-border flex items-center justify-between px-8 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
              <h2 className="text-lg font-semibold capitalize">
                {activeTab === 'dashboard' && 'Portfolio Übersicht'}
                {activeTab === 'portfolio' && 'Meine Aktien'}
                {activeTab === 'calculator' && 'Dividenden Rechner'}
              </h2>
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
