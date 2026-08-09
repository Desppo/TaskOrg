import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import { taskRepository } from '@/data/repositories';
import type { TaskItem } from '@/data/types';
import { useDataVersion } from '@/providers/data-version-provider';
import { useLanguage } from '@/providers/language-provider';
import { useAppTheme } from '@/theme/theme';
import { toDateKey } from '@/utils/date';

// ─── Animated checkbox ────────────────────────────────────────────────────────
function TaskCheckbox({
  done,
  overdue,
  onPress,
  label,
}: {
  done: boolean;
  overdue: boolean;
  onPress: () => void;
  label: string;
}) {
  const theme = useAppTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const fill = useRef(new Animated.Value(done ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(fill, { toValue: done ? 1 : 0, useNativeDriver: false, speed: 20, bounciness: 6 }).start();
  }, [done, fill]);

  function handlePress() {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.82, useNativeDriver: true, speed: 40 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20 }),
    ]).start();
    onPress();
  }

  const borderColor = done
    ? theme.success
    : overdue
      ? theme.danger
      : theme.accentSoft;

  const bg = fill.interpolate({ inputRange: [0, 1], outputRange: ['transparent', theme.success] });

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      hitSlop={12}
      onPress={handlePress}
    >
      <Animated.View
        style={[
          styles.checkbox,
          { borderColor, backgroundColor: bg, transform: [{ scale }] },
        ]}
      >
        {done && <Ionicons color="#FFFFFF" name="checkmark" size={13} />}
      </Animated.View>
    </Pressable>
  );
}

// ─── Priority chip ─────────────────────────────────────────────────────────────
function PriorityDot({ priority }: { priority: number }) {
  const theme = useAppTheme();
  if (priority === 0) return null;
  const color =
    priority === 3 ? theme.priorityHigh : priority === 2 ? theme.priorityMedium : theme.priorityLow;
  return <View style={[styles.priorityDot, { backgroundColor: color }]} />;
}

// ─── Single task row ───────────────────────────────────────────────────────────
function TaskRow({
  task,
  overdue = false,
  today,
  locale,
  onToggle,
  onPress,
}: {
  task: TaskItem;
  overdue?: boolean;
  today: string;
  locale: string;
  onToggle: () => void;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const done = task.status === 'DONE';

  const dateLabel = useMemo(() => {
    if (!task.dueDate) return null;
    if (task.dueDate === today) return null; // already in "Hoy" section header
    const d = new Date(task.dueDate + 'T12:00:00');
    return d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  }, [task.dueDate, today, locale]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.taskRow, { opacity: pressed ? 0.76 : 1 }]}
    >
      <TaskCheckbox done={done} label={task.title} onPress={onToggle} overdue={overdue} />
      <View style={styles.taskContent}>
        <View style={styles.taskTitleRow}>
          <Text
            numberOfLines={2}
            style={[
              styles.taskTitle,
              { color: done ? theme.textMuted : theme.text },
              done && styles.taskDone,
            ]}
          >
            {task.title}
          </Text>
          <PriorityDot priority={task.priority} />
        </View>
        {overdue && task.dueDate ? (
          <View style={styles.taskMeta}>
            <Ionicons color={theme.danger} name="alert-circle-outline" size={12} />
            <Text style={[styles.taskMetaText, { color: theme.danger }]}>
              Vencida · {task.dueDate}
            </Text>
          </View>
        ) : dateLabel ? (
          <View style={styles.taskMeta}>
            <Ionicons color={theme.textMuted} name="calendar-outline" size={12} />
            <Text style={[styles.taskMetaText, { color: theme.textMuted }]}>{dateLabel}</Text>
          </View>
        ) : null}
        {task.notes ? (
          <Text numberOfLines={1} style={[styles.taskNotes, { color: theme.textMuted }]}>
            {task.notes}
          </Text>
        ) : null}
      </View>
      <Ionicons color={theme.border} name="chevron-forward" size={16} />
    </Pressable>
  );
}

// ─── Section header ────────────────────────────────────────────────────────────
function SectionLabel({
  title,
  subtitle,
  count,
  accent,
}: {
  title: string;
  subtitle?: string;
  count?: number;
  accent?: boolean;
}) {
  const theme = useAppTheme();
  const color = accent ? theme.accentSoft : theme.textSecondary;
  return (
    <View style={styles.sectionLabelRow}>
      <View style={styles.sectionLabelLeft}>
        <Text style={[styles.sectionLabelTitle, { color: accent ? theme.text : theme.textSecondary }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.sectionLabelHint, { color: theme.textMuted }]}>{subtitle}</Text>
        ) : null}
      </View>
      {typeof count === 'number' && count > 0 ? (
        <View style={[styles.sectionBadge, { backgroundColor: accent ? theme.accentSurface : theme.surfaceRaised }]}>
          <Text style={[styles.sectionBadgeText, { color }]}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── Empty row ─────────────────────────────────────────────────────────────────
function EmptyRow({ text }: { text: string }) {
  const theme = useAppTheme();
  return (
    <View style={[styles.emptyRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Ionicons color={theme.textMuted} name="checkmark-done-outline" size={18} />
      <Text style={[styles.emptyRowText, { color: theme.textMuted }]}>{text}</Text>
    </View>
  );
}

// ─── Quick-add bar ──────────────────────────────────────────────────────────────
function QuickAddBar({
  placeholder,
  value,
  onChangeText,
  onSubmit,
}: {
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  onSubmit: () => void;
}) {
  const theme = useAppTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[
        styles.quickAdd,
        {
          backgroundColor: theme.surface,
          borderColor: focused ? theme.accent : theme.border,
          borderWidth: focused ? 1.5 : 1,
        },
      ]}
    >
      <View style={[styles.quickAddIcon, { backgroundColor: focused ? theme.accentSurface : theme.surfaceRaised }]}>
        <Ionicons color={focused ? theme.accentSoft : theme.textMuted} name="add" size={20} />
      </View>
      <TextInput
        onBlur={() => setFocused(false)}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        returnKeyType="done"
        selectionColor={theme.accent}
        style={[styles.quickAddInput, { color: theme.text }]}
        value={value}
      />
      {value.trim().length > 0 && (
        <Pressable
          onPress={onSubmit}
          style={[styles.quickAddSend, { backgroundColor: theme.accent }]}
        >
          <Ionicons color="#FFFFFF" name="arrow-up" size={16} />
        </Pressable>
      )}
    </View>
  );
}

// ─── Screen divider ────────────────────────────────────────────────────────────
function Divider() {
  const theme = useAppTheme();
  return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
}

// ─── Upcoming date group label ─────────────────────────────────────────────────
function DateGroupLabel({ dateKey, locale }: { dateKey: string; locale: string }) {
  const theme = useAppTheme();
  const d = new Date(dateKey + 'T12:00:00');
  const label = d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <View style={styles.dateGroupRow}>
      <View style={[styles.dateGroupLine, { backgroundColor: theme.border }]} />
      <Text style={[styles.dateGroupText, { color: theme.textMuted }]}>{label}</Text>
      <View style={[styles.dateGroupLine, { backgroundColor: theme.border }]} />
    </View>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────
export default function TodayScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useAppTheme();
  const { locale, t } = useLanguage();
  const { refresh, version } = useDataVersion();
  const date = useMemo(() => toDateKey(new Date()), []);

  const [todayTasks, setTodayTasks] = useState<TaskItem[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<TaskItem[]>([]);
  const [unscheduled, setUnscheduled] = useState<TaskItem[]>([]);
  const [completed, setCompleted] = useState<TaskItem[]>([]);
  const [taskTitle, setTaskTitle] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      taskRepository.listToday(db, date),
      taskRepository.listUpcoming(db, date),
      taskRepository.listUnscheduled(db),
      taskRepository.listCompleted(db, date),
    ])
      .then(([next, nextUp, nextUn, nextDone]) => {
        if (active) {
          setTodayTasks(next);
          setUpcomingTasks(nextUp);
          setUnscheduled(nextUn);
          setCompleted(nextDone);
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [date, db, version]);

  async function addTask() {
    if (!taskTitle.trim()) return;
    await taskRepository.createForToday(db, taskTitle, date);
    setTaskTitle('');
    refresh();
  }

  async function toggleTask(task: TaskItem) {
    await taskRepository.setCompleted(db, task.id, task.status !== 'DONE', date);
    refresh();
  }

  const overdueTasks = todayTasks.filter(t => t.dueDate && t.dueDate < date);
  const exactTodayTasks = todayTasks.filter(t => t.dueDate === date);
  const allTodayGroup = [...overdueTasks, ...exactTodayTasks];

  // Group upcoming by date
  const upcomingByDate = useMemo(() => {
    const map = new Map<string, TaskItem[]>();
    for (const task of upcomingTasks) {
      const key = task.dueDate ?? '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    }
    return map;
  }, [upcomingTasks]);

  const totalTasks = allTodayGroup.length + upcomingTasks.length + unscheduled.length;

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={[styles.eyebrow, { color: theme.accentSoft }]}>
              {t('tasksEyebrow')}
            </Text>
            <Text style={[styles.title, { color: theme.text }]}>{t('tasksTitle')}</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              {totalTasks === 0 && !loading
                ? (locale.startsWith('es') ? 'Todo en orden.' : 'All clear.')
                : locale.startsWith('es')
                  ? `${totalTasks} tarea${totalTasks === 1 ? '' : 's'} pendiente${totalTasks === 1 ? '' : 's'}`
                  : `${totalTasks} pending task${totalTasks === 1 ? '' : 's'}`}
            </Text>
          </View>
          <View style={[styles.headerBadge, { backgroundColor: theme.accentSurface }]}>
            <Ionicons color={theme.accentSoft} name="list" size={22} />
          </View>
        </View>

        {/* ── Daily review card ───────────────────────────────────────── */}
        <Pressable accessibilityRole="button" onPress={() => router.push('/review')}>
          {({ pressed }) => (
            <View
              style={[
                styles.reviewCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  opacity: pressed ? 0.78 : 1,
                },
              ]}
            >
              <View style={[styles.reviewIconWrap, { backgroundColor: theme.accentSurface }]}>
                <Ionicons color={theme.accentSoft} name="journal-outline" size={20} />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.reviewTitle, { color: theme.text }]}>{t('openReview')}</Text>
                <Text style={[styles.reviewHint, { color: theme.textMuted }]}>
                  {t('todayReviewHint')}
                </Text>
              </View>
              <View style={styles.reviewMetrics}>
                <View style={[styles.pill, { backgroundColor: theme.successSurface }]}>
                  <Ionicons color={theme.success} name="checkmark" size={12} />
                  <Text style={[styles.pillText, { color: theme.success }]}>{completed.length}</Text>
                </View>
                <View style={[styles.pill, { backgroundColor: theme.warningSurface }]}>
                  <Ionicons color={theme.warning} name="time-outline" size={12} />
                  <Text style={[styles.pillText, { color: theme.warning }]}>{totalTasks}</Text>
                </View>
              </View>
            </View>
          )}
        </Pressable>

        {/* ── Quick add ──────────────────────────────────────────────── */}
        <QuickAddBar
          onChangeText={setTaskTitle}
          onSubmit={() => void addTask()}
          placeholder={t('tasksQuickAdd')}
          value={taskTitle}
        />

        {/* ── Task list ──────────────────────────────────────────────── */}
        {loading ? (
          <View style={styles.loadingWrap}>
            <Text style={[styles.loadingText, { color: theme.textMuted }]}>
              {locale.startsWith('es') ? 'Cargando…' : 'Loading…'}
            </Text>
          </View>
        ) : (
          <View style={[styles.listCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>

            {/* Section: Hoy */}
            <View style={styles.section}>
              <SectionLabel
                accent
                count={allTodayGroup.length}
                subtitle={t('tasksTodaySectionHint')}
                title={t('tasksTodaySection')}
              />
              {allTodayGroup.length === 0 ? (
                <EmptyRow text={t('tasksTodayEmpty')} />
              ) : (
                allTodayGroup.map((task) => (
                  <TaskRow
                    key={task.id}
                    locale={locale}
                    onPress={() => router.push(`/task/${task.id}`)}
                    onToggle={() => void toggleTask(task)}
                    overdue={!!task.dueDate && task.dueDate < date}
                    task={task}
                    today={date}
                  />
                ))
              )}
            </View>

            <Divider />

            {/* Section: Próximamente */}
            <View style={styles.section}>
              <SectionLabel
                count={upcomingTasks.length}
                subtitle={t('tasksUpcomingSectionHint')}
                title={t('tasksUpcomingSection')}
              />
              {upcomingTasks.length === 0 ? (
                <EmptyRow text={t('tasksUpcomingEmpty')} />
              ) : (
                Array.from(upcomingByDate.entries()).map(([dateKey, items]) => (
                  <View key={dateKey}>
                    <DateGroupLabel dateKey={dateKey} locale={locale} />
                    {items.map((task) => (
                      <TaskRow
                        key={task.id}
                        locale={locale}
                        onPress={() => router.push(`/task/${task.id}`)}
                        onToggle={() => void toggleTask(task)}
                        task={task}
                        today={date}
                      />
                    ))}
                  </View>
                ))
              )}
            </View>

            <Divider />

            {/* Section: Sin fecha */}
            <View style={styles.section}>
              <SectionLabel
                count={unscheduled.length}
                subtitle={t('unscheduledSectionHint')}
                title={t('unscheduledSection')}
              />
              {unscheduled.length === 0 ? (
                <EmptyRow text={t('unscheduledEmpty')} />
              ) : (
                unscheduled.map((task) => (
                  <TaskRow
                    key={task.id}
                    locale={locale}
                    onPress={() => router.push(`/task/${task.id}`)}
                    onToggle={() => void toggleTask(task)}
                    task={task}
                    today={date}
                  />
                ))
              )}
            </View>

            {/* Completed today (collapsible feel, always at bottom) */}
            {completed.length > 0 && (
              <>
                <Divider />
                <View style={styles.section}>
                  <SectionLabel count={completed.length} title={t('completedToday')} />
                  {completed.map((task) => (
                    <TaskRow
                      key={task.id}
                      locale={locale}
                      onPress={() => router.push(`/task/${task.id}`)}
                      onToggle={() => void toggleTask(task)}
                      task={task}
                      today={date}
                    />
                  ))}
                </View>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 120, gap: 16 },

  // Header
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerText: { flex: 1 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, marginBottom: 6 },
  title: { fontSize: 30, fontWeight: '900', letterSpacing: -0.9, lineHeight: 35 },
  subtitle: { fontSize: 13, marginTop: 5, lineHeight: 18 },
  headerBadge: { alignItems: 'center', borderRadius: 16, height: 48, justifyContent: 'center', width: 48 },

  // Review card
  reviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
  },
  reviewIconWrap: { alignItems: 'center', borderRadius: 14, height: 42, justifyContent: 'center', width: 42 },
  reviewTitle: { fontSize: 14, fontWeight: '800' },
  reviewHint: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  reviewMetrics: { gap: 5 },
  pill: { alignItems: 'center', borderRadius: 9, flexDirection: 'row', gap: 3, paddingHorizontal: 7, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: '900' },

  // Quick add
  quickAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 56,
  },
  quickAddIcon: { alignItems: 'center', borderRadius: 12, height: 36, justifyContent: 'center', width: 36 },
  quickAddInput: { flex: 1, fontSize: 15, fontWeight: '600' },
  quickAddSend: { alignItems: 'center', borderRadius: 12, height: 36, justifyContent: 'center', width: 36 },

  // List card wrapper
  listCard: { borderRadius: 24, borderWidth: 1, overflow: 'hidden' },

  // Section
  section: { paddingHorizontal: 18, paddingVertical: 18, gap: 4 },

  // Section label
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  sectionLabelLeft: { flex: 1 },
  sectionLabelTitle: { fontSize: 13, fontWeight: '900', letterSpacing: 0.2 },
  sectionLabelHint: { fontSize: 11, lineHeight: 15, marginTop: 2 },
  sectionBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  sectionBadgeText: { fontSize: 11, fontWeight: '900' },

  // Task row
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  taskContent: { flex: 1, gap: 2 },
  taskTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  taskTitle: { flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  taskDone: { textDecorationLine: 'line-through' },
  taskMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  taskMetaText: { fontSize: 11, fontWeight: '600' },
  taskNotes: { fontSize: 11, lineHeight: 15 },

  // Checkbox
  checkbox: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },

  // Priority dot
  priorityDot: { borderRadius: 4, height: 8, width: 8 },

  // Divider
  divider: { height: 1, marginHorizontal: 18 },

  // Empty row
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 4,
  },
  emptyRowText: { fontSize: 13, lineHeight: 18, flex: 1 },

  // Date group
  dateGroupRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 6 },
  dateGroupLine: { flex: 1, height: 1 },
  dateGroupText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },

  // Loading
  loadingWrap: { alignItems: 'center', paddingVertical: 40 },
  loadingText: { fontSize: 14 },

  // Flex util
  flex: { flex: 1 },
});
