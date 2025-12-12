import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Download,
  Upload,
  Users,
  FileText,
  ChevronDown
} from 'lucide-react';
import React from 'react';
// Lightweight SVG line chart component (avoids external chart libs to prevent hook conflicts)
const LineChartSVG: React.FC<{data: {month: string; paid: number}[]; height?: number}> = ({ data, height = 240 }) => {
  const w = 760;
  const h = height;
  const padding = 48;
  const n = data.length;
  const vals = data.map(d => d.paid);
  const max = Math.max(...vals, 0);
  const min = Math.min(...vals, 0);
  const range = max - min || 1;

  const x = (i: number) => (n === 1 ? w / 2 : (i / (n - 1)) * (w - padding * 2) + padding);
  const y = (v: number) => padding + (1 - (v - min) / range) * (h - padding * 2);

  const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d.paid)}`).join(' ');

  const tickCount = 4;
  const ticks = Array.from({ length: tickCount + 1 }).map((_, i) => min + (range * (i / tickCount))).reverse();

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.round(v));

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const [tooltip, setTooltip] = React.useState<{show: boolean; left: number; top: number; index: number} | null>(null);

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    const container = containerRef.current;
    if (!svg || !container || !data.length) return;
    const rect = svg.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const ratioX = rect.width / w;
    const ratioY = rect.height / h;

    // map px back to viewBox x coordinate
    const viewX = (px / ratioX);

    // find nearest point index by comparing viewBox x positions
    let nearest = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < n; i++) {
      const xi = x(i);
      const dist = Math.abs(viewX - xi);
      if (dist < nearestDist) { nearestDist = dist; nearest = i; }
    }

    const val = data[nearest];
    // compute pixel positions for tooltip
    const pxX = x(nearest) * ratioX;
    const pxY = y(val.paid) * ratioY;

    setTooltip({ show: true, left: pxX, top: pxY, index: nearest });
  };

  const handleLeave = () => setTooltip(null);

  return (
    <div ref={containerRef} className="w-full relative" style={{ height }}>
      <svg ref={svgRef} viewBox={`0 0 ${w} ${h}`} className="w-full h-full" onMouseMove={handleMove} onMouseLeave={handleLeave}>
        <defs>
          <linearGradient id="lg" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ecfdf5" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        {/* Y axis labels and grid */}
        {ticks.map((val, idx) => {
          const yy = y(val);
          return (
            <g key={idx}>
              <line x1={padding} x2={w - padding} y1={yy} y2={yy} stroke="#e6e6e6" strokeWidth={1} />
              <text x={padding - 8} y={yy + 4} fontSize={11} textAnchor="end" fill="#333">{fmt(val)}</text>
            </g>
          );
        })}

        {/* area (optional) */}
        <path d={`${path} L ${w - padding} ${h - padding} L ${padding} ${h - padding} Z`} fill="url(#lg)" stroke="none" />
        {/* line */}
        <path d={path} fill="none" stroke="#10B981" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {/* points */}
        {data.map((d, i) => (
          <g key={d.month}>
            <circle cx={x(i)} cy={y(d.paid)} r={3.5} fill="#fff" stroke="#059669" strokeWidth={2} />
          </g>
        ))}
        {/* x labels */}
        {data.map((d, i) => (
          <text key={d.month} x={x(i)} y={h - 8} fontSize={10} textAnchor="middle" fill="#666">{d.month}</text>
        ))}

        {/* highlight circle on hover (rendered in SVG for proper scaling) */}
        {tooltip && tooltip.show && data[tooltip.index] && (
          <g>
            <circle cx={x(tooltip.index)} cy={y(data[tooltip.index].paid)} r={6} fill="#10B981" opacity={0.15} />
            <circle cx={x(tooltip.index)} cy={y(data[tooltip.index].paid)} r={4} fill="#10B981" />
          </g>
        )}
      </svg>

      {/* Tooltip box (pixel positioned) */}
      {tooltip && tooltip.show && data[tooltip.index] && (
        <div style={{ position: 'absolute', left: Math.max(8, tooltip.left - 40), top: Math.max(8, tooltip.top - 56), transform: 'translateY(-100%)' }} className="pointer-events-none">
          <div className="rounded bg-background border px-3 py-2 text-sm shadow">
            <div className="font-medium">{data[tooltip.index].month}</div>
            <div className="text-muted-foreground">{fmt(data[tooltip.index].paid)}</div>
          </div>
        </div>
      )}
    </div>
  );
};



// Small numeric line chart used for counts/days (non-currency)
const MiniLineChartSVG: React.FC<{data: {month: string; value: number}[]; height?: number; color?: string; unit?: string}> = ({ data, height = 160, color = '#ef4444', unit }) => {
  const w = 760;
  const h = height;
  const padding = 40;
  const n = data.length;
  const vals = data.map(d => d.value);
  const max = Math.max(...vals, 0);
  const min = Math.min(...vals, 0);
  const range = max - min || 1;

  const x = (i: number) => (n === 1 ? w / 2 : (i / (n - 1)) * (w - padding * 2) + padding);
  const y = (v: number) => padding + (1 - (v - min) / range) * (h - padding * 2);

  const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d.value)}`).join(' ');
  const tickCount = 4;
  const ticks = Array.from({ length: tickCount + 1 }).map((_, i) => min + (range * (i / tickCount))).reverse();

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const [tooltip, setTooltip] = React.useState<{show: boolean; left: number; top: number; index: number} | null>(null);

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    const container = containerRef.current;
    if (!svg || !container || !data.length) return;
    const rect = svg.getBoundingClientRect();
    const clientX = e.clientX;
    const px = clientX - rect.left;
    const ratioX = rect.width / w;
    let nearest = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < n; i++) {
      const xi = x(i);
      const dist = Math.abs((px / ratioX) - xi);
      if (dist < nearestDist) { nearestDist = dist; nearest = i; }
    }

    const val = data[nearest];
    const pxX = x(nearest) * ratioX;
    const pxY = y(val.value) * (rect.height / h);
    setTooltip({ show: true, left: pxX, top: pxY, index: nearest });
  };
  const handleLeave = () => setTooltip(null);

  return (
    <div ref={containerRef} className="w-full relative" style={{ height }}>
      <svg ref={svgRef} viewBox={`0 0 ${w} ${h}`} className="w-full h-full" onMouseMove={handleMove} onMouseLeave={handleLeave}>
        <defs>
          <linearGradient id="lg2" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.06} />
            <stop offset="100%" stopColor="transparent" stopOpacity={0} />
          </linearGradient>
        </defs>

        {ticks.map((val, idx) => {
          const yy = y(val);
          return (
            <g key={idx}>
              <line x1={padding} x2={w - padding} y1={yy} y2={yy} stroke="#efefef" strokeWidth={1} />
              <text x={padding - 8} y={yy + 4} fontSize={11} textAnchor="end" fill="#333">{Math.round(val)}{unit ? ` ${unit}` : ''}</text>
            </g>
          );
        })}

        <path d={`${path} L ${w - padding} ${h - padding} L ${padding} ${h - padding} Z`} fill="url(#lg2)" stroke="none" />
        <path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

        {data.map((d, i) => (
          <g key={d.month}>
            <circle cx={x(i)} cy={y(d.value)} r={3.5} fill="#fff" stroke={color} strokeWidth={2} />
          </g>
        ))}

        {data.map((d, i) => (
          <text key={d.month} x={x(i)} y={h - 8} fontSize={10} textAnchor="middle" fill="#666">{d.month}</text>
        ))}

        {tooltip && tooltip.show && data[tooltip.index] && (
          <g>
            <circle cx={x(tooltip.index)} cy={y(data[tooltip.index].value)} r={6} fill={color} opacity={0.12} />
            <circle cx={x(tooltip.index)} cy={y(data[tooltip.index].value)} r={4} fill={color} />
          </g>
        )}
      </svg>

      {tooltip && tooltip.show && data[tooltip.index] && (
        <div style={{ position: 'absolute', left: Math.max(8, tooltip.left - 40), top: Math.max(8, tooltip.top - 56), transform: 'translateY(-100%)' }} className="pointer-events-none">
          <div className="rounded bg-background border px-3 py-2 text-sm shadow">
            <div className="font-medium">{data[tooltip.index].month}</div>
            <div className="text-muted-foreground">{Math.round(data[tooltip.index].value)}{unit ? ` ${unit}` : ''}</div>
          </div>
        </div>
      )}
    </div>
  );
};

// Monthly defaulters and average delay mock data
const monthlyDefaultersByYear: Record<number, {month: string; count: number}[]> = {
  2024: [
    { month: 'Jan', count: 14 },{ month: 'Fev', count: 12 },{ month: 'Mar', count: 15 },{ month: 'Abr', count: 13 },{ month: 'Mai', count: 16 },{ month: 'Jun', count: 14 },{ month: 'Jul', count: 18 },{ month: 'Ago', count: 20 },{ month: 'Set', count: 21 },{ month: 'Out', count: 22 },{ month: 'Nov', count: 24 },{ month: 'Dez', count: 23 }
  ],
  2023: [
    { month: 'Jan', count: 10 },{ month: 'Fev', count: 11 },{ month: 'Mar', count: 13 },{ month: 'Abr', count: 12 },{ month: 'Mai', count: 14 },{ month: 'Jun', count: 13 },{ month: 'Jul', count: 16 },{ month: 'Ago', count: 17 },{ month: 'Set', count: 18 },{ month: 'Out', count: 19 },{ month: 'Nov', count: 20 },{ month: 'Dez', count: 22 }
  ]
};

const monthlyAvgDelayByYear: Record<number, {month: string; days: number}[]> = {
  2024: [
    { month: 'Jan', days: 5 },{ month: 'Fev', days: 4 },{ month: 'Mar', days: 6 },{ month: 'Abr', days: 5 },{ month: 'Mai', days: 6 },{ month: 'Jun', days: 5 },{ month: 'Jul', days: 7 },{ month: 'Ago', days: 8 },{ month: 'Set', days: 9 },{ month: 'Out', days: 10 },{ month: 'Nov', days: 11 },{ month: 'Dez', days: 9 }
  ],
  2023: [
    { month: 'Jan', days: 4 },{ month: 'Fev', days: 4 },{ month: 'Mar', days: 5 },{ month: 'Abr', days: 4 },{ month: 'Mai', days: 5 },{ month: 'Jun', days: 5 },{ month: 'Jul', days: 6 },{ month: 'Ago', days: 6 },{ month: 'Set', days: 7 },{ month: 'Out', days: 7 },{ month: 'Nov', days: 8 },{ month: 'Dez', days: 9 }
  ]
};

const Dashboard = () => {
  // Mock data - em uma aplicação real viria de uma API
  const dashboardData = {
    financialMetrics: {
      totalReceivable: 15750000.50,
      totalReceived: 12980000.75,
      totalOverdue: 2770000.25,
      monthlyCollection: 2150000.00
    },
    defaultMetrics: {
      totalDefaulters: 23,
      defaultAmount: 2770000.25,
      defaultPercentage: 17.6
    },
    monthlyMetrics: {
      currentMonth: 'Dezembro 2024',
      received: 2150000.00,
      target: 2500000.00,
      percentage: 86
    },
    recentActivities: [
      { id: 1, type: 'payment', description: 'Pagamento recebido - Concessionária ABC', amount: 150000, time: '2 horas atrás' },
      { id: 2, type: 'boleto', description: 'Boleto gerado - Usuário XYZ', amount: 85000, time: '3 horas atrás' },
      { id: 3, type: 'nfe', description: 'NFe emitida - Concessionária DEF', amount: 220000, time: '5 horas atr��s' },
      { id: 4, type: 'overdue', description: 'Débito em atraso - Usuário GHI', amount: 95000, time: '1 dia atrás' }
    ]
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getAuthAccess = () => {
    try { const u = JSON.parse(localStorage.getItem('authUser') || 'null'); return u?.accessType || ''; } catch (e) { return ''; }
  };

  const isAVD = getAuthAccess() === 'AVD';

  // Mock list of producers to pay (boletos/notas)
  const producersToPay = [
    { id: 'P001', name: 'Produtora Energia ABC', valor: 150000.00, boleto: 'BOL001', nota: 'NFE001', status: 'boleto-gerado' },
    { id: 'P002', name: 'Produtora Energia DEF', valor: 220000.00, boleto: 'BOL003', nota: null, status: 'boleto-gerado' },
    { id: 'P003', name: 'Produtora Energia GHI', valor: 85000.00, boleto: 'BOL002', nota: 'NFE002', status: 'pago' }
  ];

  // Mock monthly paid values for the chart (últimos 12 meses) per year
  const monthlyPaidByYear: Record<number, {month: string; paid: number}[]> = {
    2024: [
      { month: 'Jan', paid: 1200000 },{ month: 'Fev', paid: 900000 },{ month: 'Mar', paid: 1450000 },{ month: 'Abr', paid: 1100000 },{ month: 'Mai', paid: 1300000 },{ month: 'Jun', paid: 1250000 },{ month: 'Jul', paid: 1500000 },{ month: 'Ago', paid: 1600000 },{ month: 'Set', paid: 1700000 },{ month: 'Out', paid: 1800000 },{ month: 'Nov', paid: 2000000 },{ month: 'Dez', paid: 2150000 }
    ],
    2023: [
      { month: 'Jan', paid: 1000000 },{ month: 'Fev', paid: 950000 },{ month: 'Mar', paid: 1150000 },{ month: 'Abr', paid: 980000 },{ month: 'Mai', paid: 1250000 },{ month: 'Jun', paid: 1100000 },{ month: 'Jul', paid: 1350000 },{ month: 'Ago', paid: 1450000 },{ month: 'Set', paid: 1500000 },{ month: 'Out', paid: 1550000 },{ month: 'Nov', paid: 1700000 },{ month: 'Dez', paid: 1900000 }
    ]
  };

  // Mock transmissoras and geradoras with monthly series per year
  const transmissoras = [
    { id: 'T1', name: 'Transmissora Norte', monthlyByYear: { 2024: [80000,70000,90000,75000,82000,78000,90000,92000,98000,100000,110000,120000], 2023: [70000,68000,72000,70000,73000,71000,76000,78000,80000,82000,90000,100000] } },
    { id: 'T2', name: 'Transmissora Sul', monthlyByYear: { 2024: [60000,50000,70000,65000,68000,64000,72000,76000,80000,82000,90000,95000], 2023: [50000,48000,60000,58000,60000,59000,64000,66000,70000,72000,78000,82000] } }
  ];

  const geradoras = [
    { id: 'G1', name: 'Geradora ABC', monthlyByYear: { 2024: [200000,180000,220000,190000,210000,205000,230000,240000,250000,260000,280000,300000], 2023: [180000,170000,190000,175000,185000,180000,200000,210000,220000,230000,240000,260000] } },
    { id: 'G2', name: 'Geradora DEF', monthlyByYear: { 2024: [150000,120000,160000,130000,140000,135000,155000,165000,170000,175000,190000,210000], 2023: [140000,130000,150000,135000,145000,140000,150000,155000,160000,165000,175000,190000] } }
  ];

  const years = [2025, 2024, 2023, 2022];
  const defaultYear = 2024; // fallback when mock data for selected year is missing
  const [selected, setSelected] = React.useState<{type: 'all' | 'transmissora' | 'geradora'; id?: string; year: number; label?: string}>({ type: 'all', year: defaultYear });
  const [search, setSearch] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    // use mousedown to ensure we catch clicks before React synthetic handlers can toggle state
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filteredTransmissoras = transmissoras.filter(t => t.name.toLowerCase().includes(search.trim().toLowerCase()));
  const filteredGeradoras = geradoras.filter(g => g.name.toLowerCase().includes(search.trim().toLowerCase()));

  const chartData = React.useMemo(() => {
    const monthlyPaid = monthlyPaidByYear[selected.year] || monthlyPaidByYear[defaultYear] || [];
    if (selected.type === 'all') return monthlyPaid.map(m => ({ month: m.month + '/' + String(selected.year).slice(-2), paid: m.paid }));

    const months = monthlyPaid.map(m => m.month + '/' + String(selected.year).slice(-2));
    if (selected.type === 'transmissora') {
      const t = transmissoras.find(x => x.id === selected.id);
      if (!t) return monthlyPaid.map(m => ({ month: m.month + '/' + String(selected.year).slice(-2), paid: 0 }));
      const arr = (t.monthlyByYear && (t.monthlyByYear[selected.year] || t.monthlyByYear[defaultYear])) || [];
      return months.map((m, i) => ({ month: m, paid: arr[i] || 0 }));
    }

    if (selected.type === 'geradora') {
      const g = geradoras.find(x => x.id === selected.id);
      if (!g) return monthlyPaid.map(m => ({ month: m.month + '/' + String(selected.year).slice(-2), paid: 0 }));
      const arr = (g.monthlyByYear && (g.monthlyByYear[selected.year] || g.monthlyByYear[defaultYear])) || [];
      return months.map((m, i) => ({ month: m, paid: arr[i] || 0 }));
    }

    return monthlyPaid.map(m => ({ month: m.month + '/' + String(selected.year).slice(-2), paid: m.paid }));
  }, [selected, years]);

  const defaultersChartData = React.useMemo(() => {
    const arr = monthlyDefaultersByYear[selected.year] || monthlyDefaultersByYear[defaultYear] || [];
    return arr.map(m => ({ month: m.month + '/' + String(selected.year).slice(-2), value: m.count }));
  }, [selected, years]);

  const avgDelayChartData = React.useMemo(() => {
    const arr = monthlyAvgDelayByYear[selected.year] || monthlyAvgDelayByYear[defaultYear] || [];
    return arr.map(m => ({ month: m.month + '/' + String(selected.year).slice(-2), value: m.days }));
  }, [selected, years]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Controle financeiro de transmissão de energia elétrica</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exportar Relatório
          </Button>
          <Button size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Importar Dados
          </Button>
        </div>
      </div>

      {isAVD ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total a Pagar</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(dashboardData.financialMetrics.totalReceivable)}</div>
                <p className="text-xs text-muted-foreground">Valor total de boletos gerados e a pagar</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pagos no Mês</CardTitle>
                <CheckCircle className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">{formatCurrency(dashboardData.financialMetrics.monthlyCollection)}</div>
                <p className="text-xs text-muted-foreground">Total de pagamentos efetuados no mês</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Em Atraso</CardTitle>
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{formatCurrency(dashboardData.financialMetrics.totalOverdue)}</div>
                <p className="text-xs text-muted-foreground">Total em atraso</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Pagamentos - últimos 12 meses</CardTitle>
              <CardDescription>Valores pagos mês a mês</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <label className="text-sm text-muted-foreground">Filtrar por:</label>
                  {/* Searchable dropdown (search inside dropdown) */}
                  <div className="relative">
                    <button type="button" onMouseDown={(e) => { e.stopPropagation(); setOpen(o => !o); }} className="h-9 rounded-md border border-input bg-background px-3 text-sm flex items-center gap-2">
                      <span className="truncate">
                        {(() => {
                          if (selected.type === 'all') return 'Todos (valor total)';
                          if (selected.type === 'transmissora') {
                            if (selected.label) return `Transmissora: ${selected.label}`;
                            const t = transmissoras.find(x => x.id === selected.id);
                            return t ? `Transmissora: ${t.name}` : 'Transmissora selecionada';
                          }
                          if (selected.type === 'geradora') {
                            if (selected.label) return `Geradora: ${selected.label}`;
                            const g = geradoras.find(x => x.id === selected.id);
                            return g ? `Geradora: ${g.name}` : 'Geradora selecionada';
                          }
                          return 'Todos (valor total)';
                        })()}
                      </span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </button>

                    {open && (
                      <div ref={dropdownRef} onMouseDown={(e)=>e.stopPropagation()} className="absolute left-0 mt-2 w-80 bg-card border rounded shadow p-2 z-50">
                        <input
                          type="text"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Buscar transmissora/geradora"
                          className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                        />
                        <div className="max-h-48 overflow-auto mt-2">
                          <div className="text-xs text-muted-foreground px-1 py-1">Transmissoras</div>
                          {filteredTransmissoras.length === 0 ? <div className="px-2 py-1 text-sm text-muted-foreground">Nenhuma encontrada</div> : filteredTransmissoras.map(t => (
                            <div key={t.id} className="px-2 py-1 hover:bg-muted/50 rounded cursor-pointer text-sm" onClick={() => { setSelected(s => ({ ...s, type: 'transmissora', id: t.id, label: t.name })); setOpen(false); setSearch(''); }}>
                              {t.name}
                            </div>
                          ))}

                          <div className="text-xs text-muted-foreground px-1 py-1 mt-2">Geradoras</div>
                          {filteredGeradoras.length === 0 ? <div className="px-2 py-1 text-sm text-muted-foreground">Nenhuma encontrada</div> : filteredGeradoras.map(g => (
                            <div key={g.id} className="px-2 py-1 hover:bg-muted/50 rounded cursor-pointer text-sm" onClick={() => { setSelected(s => ({ ...s, type: 'geradora', id: g.id, label: g.name })); setOpen(false); setSearch(''); }}>
                              {g.name}
                            </div>
                          ))}

                          <div className="border-t mt-2 pt-2"><div className="px-2 py-1 hover:bg-muted/50 rounded cursor-pointer text-sm" onClick={() => { setSelected({ type: 'all', year: selected.year, label: undefined }); setOpen(false); setSearch(''); }}>Mostrar Todos (valor total)</div></div>
                        </div>
                      </div>
                    )}
                  </div>

                  <label className="text-sm text-muted-foreground ml-3">Ano:</label>
                  <select
                    value={selected.year}
                    onChange={(e) => setSelected(s => ({ ...s, year: Number(e.target.value) }))}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    {years.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                <div className="text-sm text-muted-foreground">{selected.type === 'all' ? 'Total' : `${selected.type === 'transmissora' ? 'Transmissora' : 'Geradora'} selecionada`}</div>
              </div>

              <div className="-mx-4 px-4">
                <LineChartSVG data={chartData} height={240} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Boletos e notas emitidos</CardTitle>
              <CardDescription>Boletos e NFe emitidos (geradora / transmissora)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto -mx-4 px-4">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="text-left">
                      <th className="pb-2">Produtora</th>
                      <th className="pb-2">Valor</th>
                      <th className="pb-2">Boleto</th>
                      <th className="pb-2">Nota</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="align-top">
                    {producersToPay.map(p => (
                      <tr key={p.id} className="border-t">
                        <td className="py-2">{p.name}</td>
                        <td className="py-2">{formatCurrency(p.valor)}</td>
                        <td className="py-2">{p.boleto || '—'}</td>
                        <td className="py-2">{p.nota || '—'}</td>
                        <td className="py-2">
                          <Badge variant={p.status === 'pago' ? 'default' : p.status === 'boleto-gerado' ? 'secondary' : 'destructive'}>
                            {p.status === 'pago' ? 'Pago' : p.status === 'boleto-gerado' ? 'Boleto/NFe gerados' : 'Atrasado'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        // Default full dashboard for non-AVD users
        <>
          {/* Financial Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total a Receber</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(dashboardData.financialMetrics.totalReceivable)}</div>
                <p className="text-xs text-muted-foreground">+12.5% em relação ao mês anterior</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Recebido</CardTitle>
                <TrendingUp className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">{formatCurrency(dashboardData.financialMetrics.totalReceived)}</div>
                <p className="text-xs text-muted-foreground">+8.2% em relação ao mês anterior</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Em Atraso</CardTitle>
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{formatCurrency(dashboardData.financialMetrics.totalOverdue)}</div>
                <p className="text-xs text-muted-foreground">23 inadimplentes ativos</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Recebido no Mês</CardTitle>
                <CheckCircle className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(dashboardData.financialMetrics.monthlyCollection)}</div>
                <p className="text-xs text-muted-foreground">86% da meta mensal</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly Collection Progress */}
            <Card>
              <CardHeader>
                <CardTitle>Meta de Arrecadação - {dashboardData.monthlyMetrics.currentMonth}</CardTitle>
                <CardDescription>Progresso do recebimento mensal</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Recebido</span>
                  <span className="text-sm font-bold">{formatCurrency(dashboardData.monthlyMetrics.received)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Meta</span>
                  <span className="text-sm text-muted-foreground">{formatCurrency(dashboardData.monthlyMetrics.target)}</span>
                </div>
                <Progress value={dashboardData.monthlyMetrics.percentage} className="h-2" />
                <div className="flex justify-between items-center">
                  <Badge variant="secondary">{dashboardData.monthlyMetrics.percentage}% da meta</Badge>
                  <span className="text-sm text-muted-foreground">Faltam {formatCurrency(dashboardData.monthlyMetrics.target - dashboardData.monthlyMetrics.received)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Default Management */}
            <Card>
              <CardHeader>
                <CardTitle>Controle de Inadimplência</CardTitle>
                <CardDescription>Resumo dos débitos em atraso</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Total de Inadimplentes</span>
                  <Badge variant="destructive">{dashboardData.defaultMetrics.totalDefaulters}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Valor Total em Atraso</span>
                  <span className="text-sm font-bold text-destructive">{formatCurrency(dashboardData.defaultMetrics.defaultAmount)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">% do Total a Receber</span>
                  <Badge variant="outline">{dashboardData.defaultMetrics.defaultPercentage}%</Badge>
                </div>

                {/* Monthly charts for AVC: inadimplentes (count) and atraso médio (dias) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium mb-2">Inadimplentes (últimos 12 meses)</div>
                    <MiniLineChartSVG data={defaultersChartData} height={160} color="#d946ef" unit="clientes" />
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-2">Atraso médio (dias) - últimos 12 meses</div>
                    <MiniLineChartSVG data={avgDelayChartData} height={160} color="#f97316" unit="dias" />
                  </div>
                </div>

                <Button variant="outline" className="w-full"><Users className="h-4 w-4 mr-2" />Ver Detalhes dos Inadimplentes</Button>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activities */}
          <Card>
            <CardHeader>
              <CardTitle>Atividades Recentes</CardTitle>
              <CardDescription>Últimas movimentações do sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboardData.recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      {activity.type === 'payment' && <CheckCircle className="h-5 w-5 text-success" />}
                      {activity.type === 'boleto' && <FileText className="h-5 w-5 text-primary" />}
                      {activity.type === 'nfe' && <FileText className="h-5 w-5 text-accent" />}
                      {activity.type === 'overdue' && <AlertTriangle className="h-5 w-5 text-destructive" />}
                      <div>
                        <p className="text-sm font-medium">{activity.description}</p>
                        <p className="text-xs text-muted-foreground flex items-center"><Clock className="h-3 w-3 mr-1" />{activity.time}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{formatCurrency(activity.amount)}</p>
                      <Badge variant={activity.type === 'payment' ? 'default' : activity.type === 'overdue' ? 'destructive' : 'secondary'} className="text-xs">
                        {activity.type === 'payment' ? 'Pago' : activity.type === 'boleto' ? 'Boleto' : activity.type === 'nfe' ? 'NFe' : 'Atraso'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t"><Button variant="outline" className="w-full">Ver Todas as Atividades</Button></div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Ações Rápidas</CardTitle>
              <CardDescription>Acesso rápido às principais funcionalidades</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button variant="outline" className="h-auto flex-col py-4"><Download className="h-6 w-6 mb-2" /><span className="text-sm">Baixar Boletos</span></Button>
                <Button variant="outline" className="h-auto flex-col py-4"><Upload className="h-6 w-6 mb-2" /><span className="text-sm">Upload Comprovantes</span></Button>
                <Button variant="outline" className="h-auto flex-col py-4"><FileText className="h-6 w-6 mb-2" /><span className="text-sm">Gerar NFe</span></Button>
                <Button variant="outline" className="h-auto flex-col py-4"><TrendingUp className="h-6 w-6 mb-2" /><span className="text-sm">Conciliação</span></Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default Dashboard;
