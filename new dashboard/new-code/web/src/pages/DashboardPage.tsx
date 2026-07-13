import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { useAuth } from '../contexts/AuthContext';
import { useProjectScope } from '../contexts/ProjectContext';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, TrendingUp, Users, CalendarDays, PhoneCall, Target } from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// ANIMATION
// ─────────────────────────────────────────────────────────────
const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } },
};

// ─────────────────────────────────────────────────────────────
// DEMO DATA
// ─────────────────────────────────────────────────────────────
const STATS = [
  { label: 'Total Leads', value: '2,450', change: '+12.5%', up: true, icon: Users, sparkline: [30, 45, 35, 60, 55, 70, 65, 80, 75, 90] },
  { label: 'Pipeline Value', value: '$5.3M', change: '+6.7%', up: true, icon: Target, sparkline: [40, 38, 50, 55, 48, 60, 72, 68, 78, 85] },
  { label: 'Meetings This Week', value: '42', change: '+23%', up: true, icon: CalendarDays, sparkline: [10, 15, 12, 20, 18, 35, 30, 38, 42, 42] },
  { label: 'Calls Today', value: '124', change: '-8%', up: false, icon: PhoneCall, sparkline: [50, 55, 60, 45, 40, 35, 30, 28, 25, 20] },
];

const VELOCITY_DATA = [
  { month: 'Jan', value: 35 }, { month: 'Feb', value: 42 }, { month: 'Mar', value: 38 },
  { month: 'Apr', value: 55 }, { month: 'May', value: 48 }, { month: 'Jun', value: 62 },
  { month: 'Jul', value: 58 }, { month: 'Aug', value: 72 }, { month: 'Sep', value: 68 },
  { month: 'Oct', value: 85 }, { month: 'Nov', value: 78 }, { month: 'Dec', value: 92 },
];

const STAGES = [
  { name: 'Qualified', count: 340, pct: 100, color: '#1A7EE8' },
  { name: 'Contacted', count: 420, pct: 82, color: '#1463B8' },
  { name: 'Meeting Scheduled', count: 215, pct: 63, color: '#8B6544' },
  { name: 'Meeting Successful', count: 180, pct: 45, color: '#6E5038' },
  { name: 'Proposal Sent', count: 95, pct: 28, color: '#573D2D' },
];

const DEALS = [
  { company: 'Acme Corp', contact: 'Jane Smith', value: '$42,000', stage: 'Qualified', avatar: 'AC' },
  { company: 'Stark Industries', contact: 'Tony Stark', value: '$120,500', stage: 'Proposal', avatar: 'SI' },
  { company: 'Wayne Enterprises', contact: 'Bruce Wayne', value: '$85,000', stage: 'Negotiation', avatar: 'WE' },
  { company: 'LexCorp', contact: 'Lex Luthor', value: '$12,400', stage: 'Contacted', avatar: 'LC' },
  { company: 'Oscorp', contact: 'Norman Osborn', value: '$67,200', stage: 'Qualified', avatar: 'OC' },
];

// ─────────────────────────────────────────────────────────────
// SPARKLINE SVG
// ─────────────────────────────────────────────────────────────
function Sparkline({ data, color = '#1A7EE8' }: { data: number[]; color?: string }) {
  const max = Math.max(...data);
  const h = 32;
  const w = 80;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(' ');
  const fillPoints = `0,${h} ${points} ${w},${h}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <defs>
        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={fillPoints} fill={`url(#spark-${color.replace('#', '')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// AREA CHART SVG (Pipeline Velocity)
// ─────────────────────────────────────────────────────────────
function AreaChart({ data }: { data: typeof VELOCITY_DATA }) {
  const max = Math.max(...data.map(d => d.value));
  const w = 600;
  const h = 200;
  const px = 40; // padding x
  const py = 20;
  const chartW = w - px * 2;
  const chartH = h - py * 2;

  const pts = data.map((d, i) => ({
    x: px + (i / (data.length - 1)) * chartW,
    y: py + chartH - (d.value / max) * chartH,
  }));

  // Smooth bezier path
  let path = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const cp1x = pts[i - 1].x + (pts[i].x - pts[i - 1].x) * 0.4;
    const cp1y = pts[i - 1].y;
    const cp2x = pts[i].x - (pts[i].x - pts[i - 1].x) * 0.4;
    const cp2y = pts[i].y;
    path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${pts[i].x},${pts[i].y}`;
  }
  const fillPath = `${path} L ${pts[pts.length - 1].x},${h - py} L ${pts[0].x},${h - py} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1A7EE8" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#1A7EE8" stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
        <line key={pct} x1={px} y1={py + chartH * (1 - pct)} x2={w - px} y2={py + chartH * (1 - pct)} stroke="var(--border-color)" strokeWidth={0.5} strokeDasharray={pct === 0 ? "0" : "4 4"} />
      ))}
      {/* Fill */}
      <motion.path
        d={fillPath}
        fill="url(#areaGrad)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, delay: 0.5 }}
      />
      {/* Line */}
      <motion.path
        d={path}
        fill="none"
        stroke="#1A7EE8"
        strokeWidth={2}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.5, delay: 0.3, ease: "easeOut" }}
      />
      {/* Data dots */}
      {pts.map((p, i) => (
        <motion.circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={3}
          fill="var(--color-surface)"
          stroke="#1A7EE8"
          strokeWidth={1.5}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5 + i * 0.05 }}
        />
      ))}
      {/* Month labels */}
      {data.map((d, i) => (
        <text key={i} x={pts[i].x} y={h - 2} textAnchor="middle" fill="var(--color-gray-400)" fontSize={9} fontWeight={500}>
          {d.month}
        </text>
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────
function StatCard({ stat, index }: { stat: typeof STATS[0]; index: number }) {
  const Icon = stat.icon;
  return (
    <motion.div variants={item} className="glass-card noise-overlay p-5 relative cursor-pointer group">
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-brand-subtle)' }}>
            <Icon size={16} strokeWidth={1.5} style={{ color: 'var(--color-brand)' }} />
          </div>
          <div className={`flex items-center gap-1 text-xs font-semibold ${stat.up ? 'trend-up' : 'trend-down'}`}>
            {stat.up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {stat.change}
          </div>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] mb-1" style={{ color: 'var(--color-gray-400)' }}>{stat.label}</p>
            <p className="text-3xl font-bold tracking-[-0.03em]" style={{ color: 'var(--color-gray-900)', fontFamily: 'var(--font-display)' }}>{stat.value}</p>
          </div>
          <Sparkline data={stat.sparkline} color={stat.up ? '#4D9B5D' : '#C44D4D'} />
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

function greetingFor(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function currentDate(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { loading: scopeLoading } = useProjectScope();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (scopeLoading) return;
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, [scopeLoading]);

  const firstName = (profile?.full_name || '').trim().split(/\s+/)[0] || 'Demo';

  return (
    <AppShell title="Dashboard">
      <AnimatePresence>
        {!loading && (
          <motion.div
            key="dash"
            variants={container}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0 }}
            className="space-y-8 max-w-[1400px] mx-auto"
          >
            {/* ── GREETING ── */}
            <motion.div variants={item} className="flex items-end justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-[-0.03em] mb-1" style={{ color: 'var(--color-gray-900)', fontFamily: 'var(--font-display)' }}>
                  {greetingFor()}, {firstName}
                </h1>
                <p className="text-sm" style={{ color: 'var(--color-gray-400)' }}>{currentDate()}</p>
              </div>
              <button
                onClick={() => navigate('/leads/new')}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold zen-press flex items-center gap-2 transition-all hover:brightness-110"
                style={{ background: 'var(--color-brand)', color: '#fff', boxShadow: '0 4px 14px rgba(26, 126, 232, 0.25)' }}
              >
                <TrendingUp size={14} />
                New Lead
              </button>
            </motion.div>

            {/* ── STAT CARDS ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
              {STATS.map((stat, i) => (
                <StatCard key={stat.label} stat={stat} index={i} />
              ))}
            </div>

            {/* ── VELOCITY CHART ── */}
            <motion.div variants={item} className="dash-panel p-6 md:p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-base font-bold tracking-[-0.02em]" style={{ color: 'var(--color-gray-900)', fontFamily: 'var(--font-display)' }}>Pipeline Velocity</h2>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-gray-400)' }}>Lead conversion trend over 12 months</p>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold trend-up">
                  <ArrowUpRight size={12} />
                  +18% vs last year
                </div>
              </div>
              <div className="h-48 md:h-56">
                <AreaChart data={VELOCITY_DATA} />
              </div>
            </motion.div>

            {/* ── BOTTOM ROW ── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Deals List (3 cols) */}
              <motion.div variants={item} className="lg:col-span-3 dash-panel">
                <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <h2 className="text-sm font-bold tracking-[-0.01em]" style={{ color: 'var(--color-gray-900)', fontFamily: 'var(--font-display)' }}>Recent Deals</h2>
                  <button onClick={() => navigate('/leads')} className="text-xs font-semibold transition-colors hover:text-[var(--color-brand)]" style={{ color: 'var(--color-gray-400)' }}>View All →</button>
                </div>
                <div>
                  {DEALS.map((deal, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + i * 0.06 }}
                      className="flex items-center px-6 py-4 transition-colors cursor-pointer hover:bg-[var(--color-surface-hover)]"
                      style={{ borderBottom: i < DEALS.length - 1 ? '1px solid var(--border-color)' : 'none' }}
                      onClick={() => navigate('/leads')}
                    >
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mr-4" style={{ background: 'var(--color-brand-subtle)', color: 'var(--color-brand)', border: '1px solid var(--color-brand-light)' }}>
                        {deal.avatar}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0 mr-4">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-gray-900)' }}>{deal.company}</p>
                        <p className="text-xs truncate" style={{ color: 'var(--color-gray-400)' }}>{deal.contact}</p>
                      </div>
                      {/* Value */}
                      <p className="text-sm font-semibold tabular-nums mr-6 shrink-0" style={{ color: 'var(--color-gray-900)' }}>{deal.value}</p>
                      {/* Stage pill */}
                      <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0" style={{ background: 'var(--color-brand-subtle)', color: 'var(--color-brand)', border: '1px solid var(--color-brand-light)' }}>
                        {deal.stage}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Stage Distribution (2 cols) */}
              <motion.div variants={item} className="lg:col-span-2 dash-panel p-6">
                <h2 className="text-sm font-bold tracking-[-0.01em] mb-6" style={{ color: 'var(--color-gray-900)', fontFamily: 'var(--font-display)' }}>Stage Distribution</h2>
                <div className="space-y-5">
                  {STAGES.map((stage, i) => (
                    <motion.div
                      key={stage.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.7 + i * 0.08 }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium" style={{ color: 'var(--color-gray-500)' }}>{stage.name}</span>
                        <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--color-gray-900)' }}>{stage.count}</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-alt)' }}>
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: stage.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${stage.pct}%` }}
                          transition={{ duration: 1, delay: 0.8 + i * 0.1, ease: "easeOut" }}
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}

export default DashboardPage;
