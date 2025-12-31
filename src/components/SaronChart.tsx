import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Plus, Trash2, X, Edit2 } from 'lucide-react';
import { DecimalInput } from './DecimalInput';

interface SaronDataPoint {
    date: string;
    rate: number;
    isForecast?: boolean;
}

const DEFAULT_DATA: SaronDataPoint[] = [
    { date: 'Jan 20', rate: -0.75 },
    { date: 'Apr 20', rate: -0.75 },
    { date: 'Jul 20', rate: -0.75 },
    { date: 'Okt 20', rate: -0.75 },
    { date: 'Jan 21', rate: -0.75 },
    { date: 'Apr 21', rate: -0.75 },
    { date: 'Jul 21', rate: -0.75 },
    { date: 'Okt 21', rate: -0.75 },
    { date: 'Jan 22', rate: -0.75 },
    { date: 'Apr 22', rate: -0.75 },
    { date: 'Jul 22', rate: -0.25 },
    { date: 'Okt 22', rate: 0.50 },
    { date: 'Jan 23', rate: 1.00 },
    { date: 'Apr 23', rate: 1.50 },
    { date: 'Jul 23', rate: 1.75 },
    { date: 'Okt 23', rate: 1.75 },
    { date: 'Jan 24', rate: 1.75 },
    { date: 'Apr 24', rate: 1.50 },
    { date: 'Jul 24', rate: 1.25 },
    { date: 'Okt 24', rate: 1.00 },
    { date: 'Jan 25', rate: 0.80 },
    { date: 'Apr 25', rate: 0.50 },
    { date: 'Jul 25', rate: 0.25 },
    { date: 'Okt 25', rate: 0.00 },
    { date: 'Jan 26', rate: 0.00, isForecast: true },
    { date: 'Apr 26', rate: 0.00, isForecast: true },
];

export const SaronChart = () => {
    const [data, setData] = useState<SaronDataPoint[]>(() => {
        try {
            const saved = localStorage.getItem('saron_data_v3');
            return saved ? JSON.parse(saved) : DEFAULT_DATA;
        } catch (e) {
            return DEFAULT_DATA;
        }
    });

    const [isEditing, setIsEditing] = useState(false);
    const [newDate, setNewDate] = useState('');
    const [newRate, setNewRate] = useState<number>(0);

    useEffect(() => {
        localStorage.setItem('saron_data_v3', JSON.stringify(data));
    }, [data]);

    const handleAdd = () => {
        if (!newDate) return;
        const newItem = { date: newDate, rate: newRate, isForecast: false };
        // Stick to appending for now
        setData([...data, newItem]);
        setNewDate('');
        setNewRate(0);
    };

    const handleDelete = (index: number) => {
        const newData = [...data];
        newData.splice(index, 1);
        setData(newData);
    };

    const handleReset = () => {
        if (confirm('Möchten Sie wirklich auf die Standard-Daten zurücksetzen?')) {
            setData(DEFAULT_DATA);
        }
    };

    return (
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-semibold">SARON / SNB Leitzins</h3>
                    <p className="text-sm text-muted-foreground">
                        {isEditing ? 'Daten bearbeiten (3-Monats-Sätze)' : 'Historische Entwicklung & Trend'}
                    </p>
                </div>
                <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="text-sm bg-secondary hover:bg-secondary/80 px-3 py-1.5 rounded-md transition-colors flex items-center gap-2"
                >
                    {isEditing ? <X className="size-4" /> : <Edit2 className="size-4" />}
                    {isEditing ? 'Schließen' : 'Bearbeiten'}
                </button>
            </div>

            {isEditing ? (
                <div className="space-y-4">
                    <div className="flex gap-2 items-end bg-accent/30 p-3 rounded-lg">
                        <div className="flex-1 space-y-1">
                            <label className="text-xs text-muted-foreground">Datum (z.B. Sep 26)</label>
                            <input
                                value={newDate}
                                onChange={(e) => setNewDate(e.target.value)}
                                className="w-full bg-background border border-input rounded-md px-2 py-1 text-sm"
                                placeholder="Monat Jahr"
                            />
                        </div>
                        <div className="flex-1 space-y-1">
                            <label className="text-xs text-muted-foreground">Zinssatz (%)</label>
                            <DecimalInput
                                value={newRate}
                                onChange={(val) => setNewRate(parseFloat(val) || 0)}
                                className="w-full bg-background border border-input rounded-md px-2 py-1 text-sm"
                            />
                        </div>
                        <button onClick={handleAdd} className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm flex items-center gap-1" aria-label="Eintrag hinzufügen">
                            <Plus className="size-4" />
                        </button>
                    </div>

                    <div className="max-h-[300px] overflow-y-auto space-y-1 border rounded-md p-2">
                        {data.slice().reverse().map((item, i) => {
                            const realIndex = data.length - 1 - i;
                            return (
                                <div key={realIndex} className="flex items-center justify-between text-sm p-2 hover:bg-accent rounded">
                                    <span>{item.date}</span>
                                    <div className="flex items-center gap-4">
                                        <span className="font-mono font-bold">{item.rate.toFixed(2)}%</span>
                                        <button onClick={() => handleDelete(realIndex)} className="text-destructive hover:bg-destructive/10 p-1 rounded" aria-label="Eintrag löschen">
                                            <Trash2 className="size-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <button onClick={handleReset} className="text-xs text-muted-foreground hover:underline w-full text-center">
                        Auf Standard zurücksetzen
                    </button>
                </div>
            ) : (
                <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                            <XAxis
                                dataKey="date"
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                interval={Math.floor(data.length / 6)}
                            />
                            <YAxis
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                unit="%"
                                domain={['dataMin - 0.5', 'dataMax + 0.5']}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                                itemStyle={{ color: 'hsl(var(--primary))' }}
                                formatter={(value: number) => [`${value.toFixed(2)}%`, 'Zinssatz']}
                            />
                            <ReferenceLine y={0} stroke="hsl(var(--border))" />
                            <Line
                                type="stepAfter"
                                dataKey="rate"
                                stroke="hsl(var(--primary))"
                                strokeWidth={2}
                                dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                                activeDot={{ r: 5 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
};
