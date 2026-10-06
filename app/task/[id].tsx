import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { TaskFormFields } from '@/components/task-form-fields';
import { ActionButton, BackButton, Card, LoadingView, Screen, ScreenHeader } from '@/components/ui';
import { projectRepository, recurrenceRepository, taskRepository } from '@/data/repositories';
import type { Priority, ProjectDestination, RecurrenceDraft, TaskItem } from '@/data/types';
import { useDataVersion } from '@/providers/data-version-provider';
import { useLanguage } from '@/providers/language-provider';
import { useAppTheme } from '@/theme/theme';
import { isValidDateKey, toDateKey } from '@/utils/date';
import { recurrenceEndDate } from '@/utils/recurrence';

export default function TaskEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const taskId = Array.isArray(id) ? id[0] : id;
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useAppTheme();
  const { t } = useLanguage();
  const { refresh } = useDataVersion();
  const [task, setTask] = useState<TaskItem | null>(null);
  const [projects, setProjects] = useState<ProjectDestination[]>([]);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<Priority>(0);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [columnId, setColumnId] = useState<string | null>(null);
  const [recurrenceDraft, setRecurrenceDraft] = useState<RecurrenceDraft | null>(null);
  const [recurrenceStartDate, setRecurrenceStartDate] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const today = useMemo(() => toDateKey(new Date()), []);

  useEffect(() => {
    let active = true;
    if (!taskId) {
      setLoading(false);
      return () => { active = false; };
    }
    Promise.all([
      taskRepository.getById(db, taskId),
      projectRepository.listDestinations(db),
      recurrenceRepository.getRule(db, taskId),
    ])
      .then(([nextTask, nextProjects, nextRule]) => {
        if (!active) return;
        setTask(nextTask);
        setProjects(nextProjects);
        if (nextTask) {
          setTitle(nextTask.title);
          setNotes(nextTask.notes ?? '');
          setDueDate(nextTask.dueDate ?? '');
          setPriority(nextTask.priority);
          setProjectId(nextTask.projectId);
          setColumnId(nextTask.columnId);
        }
        if (nextRule) {
          setRecurrenceStartDate(nextRule.startDate);
          setRecurrenceDraft({
            frequency: nextRule.frequency,
            intervalValue: nextRule.intervalValue,
            daysOfWeek: nextRule.daysOfWeek,
            endDate: nextRule.endDate,
            endType: nextRule.endType,
            endValue: nextRule.endValue,
          });
        }
      })
      .catch(() => { if (active) setError(t('errorGeneric')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [db, taskId, t]);

  function selectDestination(nextProjectId: string | null, nextColumnId: string | null) {
    setProjectId(nextProjectId);
    setColumnId(nextColumnId);
    setError('');
  }

  async function saveTask() {
    if (!task || !title.trim() || saving) return;
    const cleanDate = dueDate.trim();
    if (cleanDate && !isValidDateKey(cleanDate)) {
      setError(t('invalidDate'));
      return;
    }
    const startDate = recurrenceStartDate ?? (cleanDate || today);
    if (recurrenceDraft) {
      try {
        recurrenceEndDate(recurrenceDraft, startDate);
      } catch {
        setError(t('invalidRecurrence'));
        return;
      }
    }
    const selectedProject = projects.find((project) => project.id === projectId);
    const selectedColumnIndex = selectedProject?.columns.findIndex((column) => column.id === columnId) ?? -1;
    let nextStatus = task.status;
    let nextCompletedOn = task.completedOn;
    if (selectedProject) {
      const isLastColumn = selectedColumnIndex >= 0 && selectedColumnIndex === selectedProject.columns.length - 1;
      nextStatus = isLastColumn ? 'DONE' : 'OPEN';
      nextCompletedOn = isLastColumn ? today : null;
    } else if (task.projectId) {
      nextStatus = 'OPEN';
      nextCompletedOn = null;
    }

    setSaving(true);
    try {
      await db.withExclusiveTransactionAsync(async (transaction) => {
        await taskRepository.update(
          transaction,
          task.id,
          {
            title,
            notes: notes.trim() || null,
            dueDate: cleanDate || null,
            priority,
            projectId,
            columnId: projectId ? columnId : null,
            milestoneId: projectId === task.projectId ? task.milestoneId : null,
          },
          nextStatus,
          nextCompletedOn,
        );

        // Save or delete recurrence rule
        if (recurrenceDraft) {
          await recurrenceRepository.saveRule(transaction, task.id, recurrenceDraft, startDate);
          // Generate occurrences immediately so they show up in Tasks
          const rule = await recurrenceRepository.getRule(transaction, task.id);
          if (rule) await recurrenceRepository.generateForRule(transaction, rule, today);
        } else {
          await recurrenceRepository.deleteRule(transaction, task.id);
        }
      });

      refresh();
      router.back();
    } catch {
      setError(t('errorGeneric'));
    } finally {
      setSaving(false);
    }
  }

  async function archiveTask() {
    if (!task) return;
    await taskRepository.archive(db, task.id);
    refresh();
    router.back();
  }

  function confirmDelete() {
    if (!task) return;
    Alert.alert(t('confirmDeleteTitle'), t('confirmDeleteTask'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: () => {
          void taskRepository.remove(db, task.id).then(() => {
            refresh();
            router.back();
          });
        },
      },
    ]);
  }

  if (loading) return <Screen><LoadingView /></Screen>;

  if (!task) {
    return (
      <Screen>
        <BackButton label={t('back')} onPress={() => router.back()} />
        <Card><Text style={[styles.message, { color: theme.textMuted }]}>{t('taskNotFound')}</Text></Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <BackButton label={t('back')} onPress={() => router.back()} />
      <ScreenHeader title={t('editTask')} />
      <Card style={styles.formCard}>
        <TaskFormFields
          columnId={columnId}
          dueDate={dueDate}
          notes={notes}
          onDestinationChange={selectDestination}
          onDueDateChange={(value) => { setDueDate(value); setError(''); }}
          onNotesChange={setNotes}
          onPriorityChange={setPriority}
          onRecurrenceChange={setRecurrenceDraft}
          onTitleChange={setTitle}
          priority={priority}
          projectId={projectId}
          projects={projects}
          recurrenceDraft={recurrenceDraft}
          title={title}
        />
      </Card>
      {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
      <ActionButton disabled={saving || !title.trim()} icon="save-outline" label={t('saveChanges')} onPress={() => void saveTask()} />
      <View style={styles.secondaryActions}>
        <View style={styles.flex}><ActionButton icon="archive-outline" kind="ghost" label={t('archive')} onPress={() => void archiveTask()} /></View>
        <View style={styles.flex}><ActionButton icon="trash-outline" kind="danger" label={t('delete')} onPress={confirmDelete} /></View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  formCard: { paddingVertical: 22 },
  secondaryActions: { flexDirection: 'row', gap: 10 },
  message: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  error: { fontSize: 13, fontWeight: '600', lineHeight: 19, textAlign: 'center' },
});
