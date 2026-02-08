import { Menu, X } from 'lucide-react';
import packageJson from '../../package.json';

interface HeaderProps {
    isSidebarOpen: boolean;
    setIsSidebarOpen: (isOpen: boolean) => void;
}

export function Header({ isSidebarOpen, setIsSidebarOpen }: HeaderProps) {
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
                    className="text-xs font-semibold text-foreground/90 hover:text-primary transition-colors bg-secondary/20 hover:bg-secondary/40 px-2 py-0.5 rounded hidden md:block"
                    title="Klicken zum Neuladen (Cache leeren)"
                >
                    v{packageJson.version}
                </button>

            </div>
        </header>
    );
}
