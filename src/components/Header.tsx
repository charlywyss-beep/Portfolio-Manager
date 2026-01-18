import { useLocation, matchPath } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import packageJson from '../../package.json';

interface HeaderProps {
    isSidebarOpen: boolean;
    setIsSidebarOpen: (isOpen: boolean) => void;
}

export function Header({ isSidebarOpen, setIsSidebarOpen }: HeaderProps) {
    const location = useLocation();
    const { stocks } = usePortfolio();

    const getPageTitle = (pathname: string) => {
        if (pathname === '/') return 'Portfolio Übersicht';
        if (pathname === '/portfolio') return 'Positionen';
        if (pathname === '/watchlist') return 'Watchlist';
        if (pathname === '/calculator') return 'Kauf / Verkauf';
        if (pathname === '/dividends') return 'Dividenden';
        if (pathname === '/dividends/add') return 'Dividenden-Planer';
        if (pathname.startsWith('/dividends/edit')) return 'Dividende bearbeiten';
        if (pathname === '/mortgage') return 'Budget';
        if (pathname === '/exchange-rates') return 'Wechselkurse';
        if (pathname === '/settings') return 'Einstellungen';

        if (pathname.startsWith('/stock/')) {
            const match = matchPath('/stock/:id', pathname);
            if (match && match.params.id) {
                const id = match.params.id;
                // Try finding by ID first, then symbol (case-insensitive for robust matching)
                const stock = stocks.find(s =>
                    s.id === id ||
                    s.id.toLowerCase() === id.toLowerCase() ||
                    s.symbol === id ||
                    s.symbol.toLowerCase() === id.toLowerCase()
                );

                if (stock) {
                    return stock.type === 'etf' ? 'ETF Details' : 'Aktien Details';
                }
            }
            return 'Aktien Details';
        }

        return 'Portfolio Manager';
    };

    return (
        <header className="h-16 border-b border-border flex items-center justify-between px-4 md:px-8 bg-card sticky top-0 z-[200]">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="p-2 hover:bg-accent rounded-md transition-colors relative z-50 lg:hidden"
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
                    v{packageJson.version}
                </button>
                <h2 className="text-lg font-semibold capitalize whitespace-nowrap">
                    {getPageTitle(location.pathname)}
                </h2>
            </div>
        </header>
    );
}
