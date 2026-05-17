// ══════════════════════════════════════════════════════════════════
//  Strategy pattern — Productivity Insight algorithms
//  Each class encapsulates one algorithm and implements InsightStrategy<T>.
//  The AnalyticsComponent acts as the Context: it holds a reference to
//  insightTasks (the filtered dataset) and delegates computation here.
// ══════════════════════════════════════════════════════════════════

export interface EnrichedTask {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  deadline: string;
  completedAt: string;
  boardId: number;
  boardTitle: string;
}

// ── Strategy interface ───────────────────────────────────────────
export interface InsightStrategy<T = unknown> {
  compute(tasks: EnrichedTask[]): T;
}

// ── Return types ─────────────────────────────────────────────────
export interface DayActivity {
  day: string; short: string; count: number; pct: number; isTop: boolean;
}

export interface TimeSlotActivity {
  label: string; icon: string; range: string;
  hours: number[]; count: number; pct: number; isTop: boolean;
}

export interface StreakResult   { current: number; best: number; }
export interface WeekdayWeekend { weekday: number; weekend: number; }

export interface PowerDay {
  rank: number; day: string; slot: string;
  count: number; icon: string; isPeak: boolean;
}

export interface Recommendation { icon: string; text: string; }

// ══════════════════════════════════════════════════════════════════
//  Concrete Strategy 1 — Day-of-week activity
// ══════════════════════════════════════════════════════════════════
export class DayOfWeekInsightStrategy implements InsightStrategy<DayActivity[]> {
  private readonly shorts = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  private readonly fulls  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  compute(tasks: EnrichedTask[]): DayActivity[] {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    tasks
      .filter(t => t.status === 'Done' && t.completedAt)
      .forEach(t => counts[new Date(t.completedAt).getDay()]++);

    const max    = Math.max(...counts, 1);
    const topIdx = counts.indexOf(Math.max(...counts));
    return this.fulls.map((day, i) => ({
      day, short: this.shorts[i], count: counts[i],
      pct:   Math.round(counts[i] / max * 100),
      isTop: i === topIdx && counts[i] > 0
    }));
  }
}

// ══════════════════════════════════════════════════════════════════
//  Concrete Strategy 2 — Time-of-day activity
// ══════════════════════════════════════════════════════════════════
export class TimeOfDayInsightStrategy implements InsightStrategy<TimeSlotActivity[]> {
  private readonly slots = [
    { label: 'Morning',   icon: 'wb_sunny',    range: '6 AM – 11 AM',  hours: [6,7,8,9,10,11] },
    { label: 'Afternoon', icon: 'light_mode',  range: '12 PM – 4 PM',  hours: [12,13,14,15,16] },
    { label: 'Evening',   icon: 'nights_stay', range: '5 PM – 9 PM',   hours: [17,18,19,20,21] },
    { label: 'Night',     icon: 'bedtime',     range: '10 PM – 5 AM',  hours: [22,23,0,1,2,3,4,5] }
  ];

  compute(tasks: EnrichedTask[]): TimeSlotActivity[] {
    const counts = this.slots.map(() => 0);
    tasks
      .filter(t => t.status === 'Done' && t.completedAt)
      .forEach(t => {
        const h   = new Date(t.completedAt).getHours();
        const idx = this.slots.findIndex(s => s.hours.includes(h));
        if (idx >= 0) counts[idx]++;
      });

    const max    = Math.max(...counts, 1);
    const topIdx = counts.indexOf(Math.max(...counts));
    return this.slots.map((s, i) => ({
      ...s, count: counts[i],
      pct:   Math.round(counts[i] / max * 100),
      isTop: i === topIdx && counts[i] > 0
    }));
  }
}

// ══════════════════════════════════════════════════════════════════
//  Concrete Strategy 3 — Completion streaks
// ══════════════════════════════════════════════════════════════════
export class StreakInsightStrategy implements InsightStrategy<StreakResult> {
  compute(tasks: EnrichedTask[]): StreakResult {
    const done = tasks.filter(t => t.status === 'Done' && t.completedAt);
    if (!done.length) return { current: 0, best: 0 };

    const dateSet = new Set(done.map(t => {
      const d = new Date(t.completedAt); d.setHours(0, 0, 0, 0);
      return d.getTime();
    }));
    const dates = Array.from(dateSet).sort((a, b) => a - b).map(ms => new Date(ms));

    let best = 1, run = 1;
    for (let i = 1; i < dates.length; i++) {
      const diffDays = Math.round((dates[i].getTime() - dates[i - 1].getTime()) / 86400000);
      run  = diffDays === 1 ? run + 1 : 1;
      best = Math.max(best, run);
    }

    const today    = new Date(); today.setHours(0, 0, 0, 0);
    const lastDate = dates[dates.length - 1];
    const gap      = Math.round((today.getTime() - lastDate.getTime()) / 86400000);
    return { current: gap <= 1 ? run : 0, best };
  }
}

// ══════════════════════════════════════════════════════════════════
//  Concrete Strategy 4 — On-time completion rate
// ══════════════════════════════════════════════════════════════════
export class OnTimeRateInsightStrategy implements InsightStrategy<number> {
  compute(tasks: EnrichedTask[]): number {
    const doneWithDeadline = tasks.filter(t => t.status === 'Done' && t.completedAt && t.deadline);
    if (!doneWithDeadline.length) return 0;
    const onTime = doneWithDeadline.filter(
      t => new Date(t.completedAt) <= new Date(t.deadline)
    ).length;
    return Math.round(onTime / doneWithDeadline.length * 100);
  }
}

// ══════════════════════════════════════════════════════════════════
//  Concrete Strategy 5 — Weekday vs Weekend split
// ══════════════════════════════════════════════════════════════════
export class WeekdayWeekendInsightStrategy implements InsightStrategy<WeekdayWeekend> {
  compute(tasks: EnrichedTask[]): WeekdayWeekend {
    let weekday = 0, weekend = 0;
    tasks
      .filter(t => t.status === 'Done' && t.completedAt)
      .forEach(t => {
        const dow = new Date(t.completedAt).getDay();
        (dow === 0 || dow === 6) ? weekend++ : weekday++;
      });
    return { weekday, weekend };
  }
}

// ══════════════════════════════════════════════════════════════════
//  Concrete Strategy 6 — Power Days (top day × time-slot combos)
// ══════════════════════════════════════════════════════════════════
export class PowerDaysInsightStrategy implements InsightStrategy<PowerDay[]> {
  private readonly slotDefs = [
    { label: 'Morning',   hours: [6,7,8,9,10,11],     icon: 'wb_sunny' },
    { label: 'Afternoon', hours: [12,13,14,15,16],    icon: 'light_mode' },
    { label: 'Evening',   hours: [17,18,19,20,21],    icon: 'nights_stay' },
    { label: 'Night',     hours: [22,23,0,1,2,3,4,5], icon: 'bedtime' }
  ];
  private readonly days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  compute(tasks: EnrichedTask[]): PowerDay[] {
    const matrix: Record<string, number> = {};
    tasks
      .filter(t => t.status === 'Done' && t.completedAt)
      .forEach(t => {
        const d    = new Date(t.completedAt);
        const day  = this.days[d.getDay()];
        const h    = d.getHours();
        const slot = this.slotDefs.find(s => s.hours.includes(h));
        if (slot) {
          const key = `${day}|${slot.label}`;
          matrix[key] = (matrix[key] || 0) + 1;
        }
      });

    return Object.entries(matrix)
      .map(([key, count]) => {
        const [day, slotLabel] = key.split('|');
        const slotDef = this.slotDefs.find(s => s.label === slotLabel)!;
        return { day, slot: slotLabel, count, icon: slotDef?.icon ?? 'schedule' };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map((e, i) => ({ ...e, rank: i + 1, isPeak: i === 0 }));
  }
}
