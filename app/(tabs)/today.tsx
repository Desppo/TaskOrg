import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ActionButton, AppInput, Card, EmptyState, LoadingView, Screen, ScreenHeader, SectionHeader } from '@/components/ui';
import { taskRepository } from '@/data/repositories';
import type { TaskItem } from '@/data/types';
import { useDataVersion } from '@/providers/data-version-provider';
import { useLanguage } from '@/providers/language-provider';
import { useAppTheme } from '@/theme/theme';
import { toDateKey } from '@/utils/date';

export default function TodayScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useAppTheme();
  const { locale, t } = useLanguage();
  const { refresh, version } = useDataVersion();
  const date = useMemo(() => toDateKey(new Date()), []);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [completed, setCompleted] = useState<TaskItem[]>([]);
  const [unscheduled, setUnscheduled] = useState<TaskItem[]>([]);
  const [taskTitle, setTaskTitle] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([taskRepository.listToday(db, date), taskRepository.listCompleted(db, date), taskRepository.listUnscheduled(db)])
      .then(([nextTasks, nextCompleted, nextUnscheduled]) => {
        if (active) {
          setTasks(nextTasks);
          setCompleted(nextCompleted);
          setUnscheduled(nextUnscheduled);
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

  const dateLabel = new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const overdueTasks = tasks.filter((task) => task.dueDate && task.dueDate < date);
  const todayTasks = tasks.filter((task) => task.dueDate === date);

  function renderTaskList(items: TaskItem[], overdue = false) {
    return (
      <View style={styles.list}>
        {items.map((task) => (
          <Card key={task.id} style={styles.taskCard} tone={overdue ? 'danger' : 'default'}>
            <Pressable
              accessibilityLabel={task.title}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: false }}
              hitSlop={10}
              onPress={() => void toggleTask(task)}
              style={[styles.checkbox, { borderColor: overdue ? theme.danger : theme.accentSoft }]}
            />
            <Pressable onPress={() => router.push(`/task/${task.id}`)} style={styles.flex}>
              <Text style={[styles.taskTitle, { color: theme.text }]}>{task.title}</Text>
              {overdue && task.dueDate ? (
                <View style={styles.metaRow}>
                  <Ionicons color={theme.danger} name="alert-circle-outline" size={13} />
                  <Text style={[styles.overdue, { color: theme.danger }]}>{t('overdue')} · {task.dueDate}</Text>
                </View>
              ) : null}
            </Pressable>
            <Ionicons color={theme.textMuted} name="chevron-forward" size={18} />
          </Card>
        ))}
      </View>
    );
  }

  return (
    <Screen>
      <ScreenHeader eyebrow={t('todayEyebrow')} subtitle={dateLabel} title={t('todayTitle')} />

      <Pressable accessibilityRole="button" onPress={() => router.push('/review')}>
        {({ pressed }) => (
          <Card style={[styles.reviewCard, { opacity: pressed ? 0.78 : 1 }]} tone="accent">
            <View style={[styles.reviewIcon, { backgroundColor: theme.accent }]}> 
              <Ionicons color="#FFFFFF" name="journal-outline" size={23} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.reviewTitle, { color: theme.text }]}>{t('openReview')}</Text>
              <Text style={[styles.reviewHint, { color: theme.textMuted }]}>{t('todayReviewHint')}</Text>
              <View style={styles.reviewMetrics}>
                <View style={[styles.metricPill, { backgroundColor: theme.successSurface }]}>
                  <Ionicons color={theme.success} name="checkmark" size={13} />
                  <Text style={[styles.metricText, { color: theme.success }]}>{completed.length}</Text>
                </View>
                <View style={[styles.metricPill, { backgroundColor: theme.warningSurface }]}>
                  <Ionicons color={theme.warning} name="time-outline" size={13} />
                  <Text style={[styles.metricText, { color: theme.warning }]}>{tasks.length + unscheduled.length}</Text>
                </View>
              </View>
            </View>
            <Ionicons color={theme.accentSoft} name="chevron-forward" size={21} />
          </Card>
        )}
      </Pressable>

      <Card style={styles.captureCard} tone="accent">
        <View style={styles.captureHeading}>
          <View style={[styles.captureIcon, { backgroundColor: theme.accentSurfaceStrong }]}>
            <Ionicons color={theme.accentSoft} name="flash-outline" size={20} />
          </View>
          <Text style={[styles.cardTitle, { color: theme.text }]}>{t('quickTask')}</Text>
        </View>
        <View style={styles.inputRow}>
          <AppInput
            accessibilityLabel={t('quickTaskPlaceholder')}
            onChangeText={setTaskTitle}
            onSubmitEditing={() => void addTask()}
            placeholder={t('quickTaskPlaceholder')}
            returnKeyType="done"
            style={styles.flex}
            value={taskTitle}
          />
          <ActionButton disabled={!taskTitle.trim()} icon="add" label={t('add')} onPress={() => void addTask()} />
        </View>
      </Card>

      {loading ? <LoadingView /> : (
        <>
          {overdueTasks.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader count={overdueTasks.length} subtitle={t('overdueSectionHint')} title={t('overdueSection')} />
              {renderTaskList(overdueTasks, true)}
            </View>
          ) : null}
          <View style={styles.section}>
            <SectionHeader count={todayTasks.length} subtitle={t('todaySectionHint')} title={t('todaySection')} />
            {todayTasks.length === 0 ? <EmptyState icon="sunny-outline" text={t('todayEmpty')} /> : renderTaskList(todayTasks)}
          </View>
          <View style={styles.section}>
            <SectionHeader count={unscheduled.length} subtitle={t('unscheduledSectionHint')} title={t('unscheduledSection')} />
            {unscheduled.length === 0
              ? <EmptyState icon="calendar-outline" text={t('unscheduledEmpty')} />
              : renderTaskList(unscheduled)}
          </View>
        </>
      )}

      {completed.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader count={completed.length} title={t('completedToday')} />
          <View style={styles.list}>
            {completed.map((task) => (
              <Card key={task.id} style={styles.taskCard} tone="success">
                <Pressable
                  accessibilityLabel={task.title}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: true }}
                  hitSlop={10}
                  onPress={() => void toggleTask(task)}
                  style={[styles.checkbox, styles.checkboxDone, { backgroundColor: theme.success, borderColor: theme.success }]}
                >
                  <Ionicons color="#FFFFFF" name="checkmark" size={15} />
                </Pressable>
                <Pressable onPress={() => router.push(`/task/${task.id}`)} style={styles.flex}>
                  <Text style={[styles.taskTitle, styles.taskDone, { color: theme.textMuted }]}>{task.title}</Text>
                </Pressable>
              </Card>
            ))}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  reviewCard: { alignItems: 'center', flexDirection: 'row', gap: 13 },
  reviewIcon: { alignItems: 'center', borderRadius: 17, height: 50, justifyContent: 'center', width: 50 },
  reviewTitle: { fontSize: 16, fontWeight: '900' },
  reviewHint: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  reviewMetrics: { flexDirection: 'row', gap: 6, marginTop: 9 },
  metricPill: { alignItems: 'center', borderRadius: 10, flexDirection: 'row', gap: 3, paddingHorizontal: 7, paddingVertical: 4 },
  metricText: { fontSize: 11, fontWeight: '900' },
  captureCard: { gap: 14 },
  captureHeading: { alignItems: 'center', flexDirection: 'row', gap: 11 },
  captureIcon: { alignItems: 'center', borderRadius: 14, height: 42, justifyContent: 'center', width: 42 },
  cardTitle: { fontSize: 17, fontWeight: '800' },
  inputRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  section: { gap: 12 },
  list: { gap: 10 },
  taskCard: { alignItems: 'center', flexDirection: 'row', gap: 13, paddingVertical: 15 },
  checkbox: { borderRadius: 9, borderWidth: 2, height: 24, width: 24 },
  checkboxDone: { alignItems: 'center', justifyContent: 'center' },
  taskTitle: { fontSize: 15, fontWeight: '700', lineHeight: 21 },
  taskDone: { textDecorationLine: 'line-through' },
  metaRow: { alignItems: 'center', flexDirection: 'row', gap: 4, marginTop: 4 },
  overdue: { fontSize: 11, fontWeight: '700' },
});
