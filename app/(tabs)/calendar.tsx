import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Card, EmptyState, IconButton, LoadingView, Screen, ScreenHeader, SectionHeader } from '@/components/ui';
import { calendarRepository } from '@/data/repositories';
import type { CalendarItem } from '@/data/types';
import { useDataVersion } from '@/providers/data-version-provider';
import { useLanguage } from '@/providers/language-provider';
import { useAppTheme } from '@/theme/theme';
import {
  dateKeysBetween,
  endOfWeek,
  fromDateKey,
  monthCalendarRange,
  shiftMonth,
  startOfWeek,
  toDateKey,
} from '@/utils/date';

type CalendarMode = 'agenda' | 'week' | 'month';

export default function CalendarScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useAppTheme();
  const { locale, t } = useLanguage();
  const { version } = useDataVersion();
  const [mode, setMode] = useState<CalendarMode>('agenda');
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => {
    if (mode === 'week') return { start: startOfWeek(anchor), end: endOfWeek(anchor) };
    if (mode === 'month') return monthCalendarRange(anchor);
    return {
      start: new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12),
      end: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 12),
    };
  }, [anchor, mode]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    calendarRepository.listRange(db, toDateKey(range.start), toDateKey(range.end))
      .then((nextItems) => { if (active) setItems(nextItems); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [db, range.end, range.start, version]);

  const itemsByDate = useMemo(() => {
    const groups = new Map<string, CalendarItem[]>();
    for (const item of items) groups.set(item.date, [...(groups.get(item.date) ?? []), item]);
    return groups;
  }, [items]);

  const periodLabel = mode === 'week'
    ? `${range.start.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} – ${range.end.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}`
    : anchor.toLocaleDateString(locale, { month: 'long', year: 'numeric' });

  function changeMode(nextMode: CalendarMode) {
    setMode(nextMode);
    setAnchor(fromDateKey(selectedDate));
  }

  function navigate(amount: -1 | 1) {
    if (mode === 'week') {
      const next = new Date(anchor);
      next.setDate(next.getDate() + (amount * 7));
      setAnchor(next);
      setSelectedDate(toDateKey(startOfWeek(next)));
      return;
    }
    const next = shiftMonth(anchor, amount);
    setAnchor(next);
    setSelectedDate(toDateKey(next));
  }

  return (
    <Screen>
      <ScreenHeader subtitle={t('calendarSubtitle')} title={t('calendarTitle')} />

      <View style={[styles.modeSelector, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
        <ModeButton active={mode === 'agenda'} label={t('calendarAgenda')} onPress={() => changeMode('agenda')} />
        <ModeButton active={mode === 'week'} label={t('calendarWeek')} onPress={() => changeMode('week')} />
        <ModeButton active={mode === 'month'} label={t('calendarMonth')} onPress={() => changeMode('month')} />
      </View>

      <View style={styles.navigation}>
        <IconButton icon="chevron-back" label={t('calendarTitle')} onPress={() => navigate(-1)} />
        <Text style={[styles.period, { color: theme.text }]}>{periodLabel}</Text>
        <IconButton icon="chevron-forward" label={t('calendarTitle')} onPress={() => navigate(1)} />
      </View>

      {loading ? <LoadingView /> : mode === 'agenda' ? (
        <AgendaView items={items} locale={locale} onOpenTask={(id) => router.push(`/task/${id}`)} />
      ) : mode === 'week' ? (
        <WeekView
          end={range.end}
          itemsByDate={itemsByDate}
          locale={locale}
          onOpenTask={(id) => router.push(`/task/${id}`)}
          onSelect={setSelectedDate}
          selectedDate={selectedDate}
          start={range.start}
        />
      ) : (
        <MonthView
          anchor={anchor}
          end={range.end}
          itemsByDate={itemsByDate}
          locale={locale}
          onOpenTask={(id) => router.push(`/task/${id}`)}
          onSelect={setSelectedDate}
          selectedDate={selectedDate}
          start={range.start}
        />
      )}
    </Screen>
  );
}

function AgendaView({ items, locale, onOpenTask }: { items: CalendarItem[]; locale: string; onOpenTask: (id: string) => void }) {
  const { t } = useLanguage();
  const groups = useMemo(() => {
    const result = new Map<string, CalendarItem[]>();
    for (const item of items) result.set(item.date, [...(result.get(item.date) ?? []), item]);
    return [...result.entries()];
  }, [items]);
  if (groups.length === 0) return <EmptyState text={t('calendarEmpty')} />;
  return (
    <View style={styles.agendaList}>
      {groups.map(([date, dayItems]) => (
        <View key={date} style={styles.dayGroup}>
          <SectionHeader title={fromDateKey(date).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' })} />
          <DayItems items={dayItems} onOpenTask={onOpenTask} />
        </View>
      ))}
    </View>
  );
}

function WeekView({ start, end, selectedDate, itemsByDate, locale, onSelect, onOpenTask }: CalendarGridProps) {
  const theme = useAppTheme();
  const { t } = useLanguage();
  const days = dateKeysBetween(start, end);
  const selectedItems = itemsByDate.get(selectedDate) ?? [];
  return (
    <View style={styles.calendarContent}>
      <View style={[styles.weekRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {days.map((date) => {
          const day = fromDateKey(date);
          const active = date === selectedDate;
          return (
            <Pressable key={date} onPress={() => onSelect(date)} style={[styles.weekDay, active && { backgroundColor: theme.accent }]}>
              <Text style={[styles.weekday, { color: active ? '#FFFFFF' : theme.textMuted }]}>{day.toLocaleDateString(locale, { weekday: 'narrow' })}</Text>
              <Text style={[styles.dayNumber, { color: active ? '#FFFFFF' : theme.text }]}>{day.getDate()}</Text>
              <View style={styles.dots}><DayDots count={(itemsByDate.get(date) ?? []).length} active={active} /></View>
            </Pressable>
          );
        })}
      </View>
      <SectionHeader count={selectedItems.length} title={fromDateKey(selectedDate).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })} />
      {selectedItems.length === 0 ? <EmptyState text={t('calendarDayEmpty')} /> : <DayItems items={selectedItems} onOpenTask={onOpenTask} />}
    </View>
  );
}

function MonthView({ start, end, selectedDate, itemsByDate, locale, anchor, onSelect, onOpenTask }: CalendarGridProps & { anchor: Date }) {
  const theme = useAppTheme();
  const { t } = useLanguage();
  const days = dateKeysBetween(start, end);
  const weekDays = dateKeysBetween(startOfWeek(new Date(2026, 0, 5, 12)), endOfWeek(new Date(2026, 0, 5, 12)));
  const selectedItems = itemsByDate.get(selectedDate) ?? [];
  return (
    <View style={styles.calendarContent}>
      <View style={styles.monthWeekdays}>
        {weekDays.map((date) => <Text key={date} style={[styles.monthWeekday, { color: theme.textMuted }]}>{fromDateKey(date).toLocaleDateString(locale, { weekday: 'narrow' })}</Text>)}
      </View>
      <View style={[styles.monthGrid, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {days.map((date) => {
          const day = fromDateKey(date);
          const active = date === selectedDate;
          const inMonth = day.getMonth() === anchor.getMonth();
          return (
            <Pressable key={date} onPress={() => onSelect(date)} style={[styles.monthCell, active && { backgroundColor: theme.accent }]}> 
              <Text style={[styles.monthDayNumber, { color: active ? '#FFFFFF' : inMonth ? theme.text : theme.textMuted, opacity: inMonth || active ? 1 : 0.45 }]}>{day.getDate()}</Text>
              <View style={styles.dots}><DayDots count={(itemsByDate.get(date) ?? []).length} active={active} /></View>
            </Pressable>
          );
        })}
      </View>
      <SectionHeader count={selectedItems.length} title={fromDateKey(selectedDate).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })} />
      {selectedItems.length === 0 ? <EmptyState text={t('calendarDayEmpty')} /> : <DayItems items={selectedItems} onOpenTask={onOpenTask} />}
    </View>
  );
}

interface CalendarGridProps {
  start: Date;
  end: Date;
  selectedDate: string;
  itemsByDate: Map<string, CalendarItem[]>;
  locale: string;
  onSelect: (date: string) => void;
  onOpenTask: (id: string) => void;
}

function DayDots({ count, active }: { count: number; active: boolean }) {
  return <>{Array.from({ length: Math.min(count, 3) }, (_, index) => <View key={index} style={[styles.dot, { backgroundColor: active ? '#FFFFFF' : '#6D5EF7' }]} />)}</>;
}

function DayItems({ items, onOpenTask }: { items: CalendarItem[]; onOpenTask: (id: string) => void }) {
  const theme = useAppTheme();
  const { t } = useLanguage();
  return (
    <View style={styles.itemList}>
      {items.map((item) => (
        <Pressable disabled={item.kind !== 'task'} key={`${item.kind}-${item.id}`} onPress={() => onOpenTask(item.id)}>
          <Card style={styles.calendarCard}>
            <View style={[styles.marker, { backgroundColor: item.color }]} />
            <View style={[styles.itemIcon, { backgroundColor: `${item.color}20` }]}>
              <Ionicons color={item.color} name={item.kind === 'task' ? 'checkbox-outline' : 'calendar-outline'} size={18} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.itemTitle, item.completed && styles.completed, { color: item.completed ? theme.textMuted : theme.text }]}>{item.title}</Text>
              <Text style={[styles.kind, { color: theme.textMuted }]}>{item.kind === 'task' ? t('task') : t('event')}</Text>
            </View>
          </Card>
        </Pressable>
      ))}
    </View>
  );
}

function ModeButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  const theme = useAppTheme();
  return (
    <Pressable onPress={onPress} style={[styles.modeButton, active && { backgroundColor: theme.accentSurfaceStrong }]}>
      <Text style={[styles.modeText, { color: active ? theme.accentSoft : theme.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  modeSelector: { borderRadius: 18, borderWidth: 1, flexDirection: 'row', padding: 4 },
  modeButton: { alignItems: 'center', borderRadius: 14, flex: 1, minHeight: 44, justifyContent: 'center' },
  modeText: { fontSize: 12, fontWeight: '800' },
  navigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  period: { flex: 1, fontSize: 16, fontWeight: '800', textAlign: 'center', textTransform: 'capitalize' },
  agendaList: { gap: 18 },
  dayGroup: { gap: 8 },
  itemList: { gap: 8 },
  calendarContent: { gap: 14 },
  weekRow: { borderRadius: 24, borderWidth: 1, flexDirection: 'row', overflow: 'hidden', padding: 6 },
  weekDay: { alignItems: 'center', borderRadius: 16, flex: 1, minHeight: 78, paddingVertical: 9 },
  weekday: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  dayNumber: { fontSize: 17, fontWeight: '800', marginTop: 5 },
  dots: { flexDirection: 'row', gap: 2, height: 5, justifyContent: 'center', marginTop: 6 },
  dot: { borderRadius: 2, height: 4, width: 4 },
  monthWeekdays: { flexDirection: 'row' },
  monthWeekday: { fontSize: 10, fontWeight: '800', textAlign: 'center', width: '14.2857%' },
  monthGrid: { borderRadius: 24, borderWidth: 1, flexDirection: 'row', flexWrap: 'wrap', overflow: 'hidden', padding: 6 },
  monthCell: { alignItems: 'center', borderRadius: 14, height: 53, justifyContent: 'center', width: '14.2857%' },
  monthDayNumber: { fontSize: 13, fontWeight: '700' },
  calendarCard: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 14 },
  marker: { alignSelf: 'stretch', width: 4, borderRadius: 4 },
  itemIcon: { alignItems: 'center', borderRadius: 13, height: 38, justifyContent: 'center', width: 38 },
  itemTitle: { fontSize: 15, fontWeight: '700' },
  completed: { textDecorationLine: 'line-through' },
  kind: { fontSize: 11, marginTop: 3 },
});
