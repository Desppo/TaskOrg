import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { TaskFormFields } from '@/components/task-form-fields';
import { ActionButton, BackButton, Card, LoadingView, Screen, ScreenHeader } from '@/components/ui';
import { inboxRepository, projectRepository } from '@/data/repositories';
import type { InboxItem, Priority, ProjectDestination } from '@/data/types';
import { useDataVersion } from '@/providers/data-version-provider';
import { useLanguage } from '@/providers/language-provider';
import { useAppTheme } from '@/theme/theme';
import { isValidDateKey, toDateKey } from '@/utils/date';

export default function InboxProcessorScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const itemId = Array.isArray(id) ? id[0] : id;
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useAppTheme();
  const { t } = useLanguage();
  const { refresh } = useDataVersion();
  const today = useMemo(() => toDateKey(new Date()), []);
  const [item, setItem] = useState<InboxItem | null>(null);
  const [projects, setProjects] = useState<ProjectDestination[]>([]);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState(today);
  const [priority, setPriority] = useState<Priority>(0);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [columnId, setColumnId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    if (!itemId) {
      setLoading(false);
      return () => { active = false; };
    }
    Promise.all([inboxRepository.getById(db, itemId), projectRepository.listDestinations(db)])
      .then(([nextItem, nextProjects]) => {
        if (!active) return;
        setItem(nextItem);
        setProjects(nextProjects);
        if (nextItem) setTitle(nextItem.content);
      })
      .catch(() => { if (active) setError(t('errorGeneric')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [db, itemId, t]);

  function selectDestination(nextProjectId: string | null, nextColumnId: string | null) {
    setProjectId(nextProjectId);
    setColumnId(nextColumnId);
    setError('');
  }

  async function createTask() {
    if (!item || !title.trim()) return;
    const cleanDate = dueDate.trim();
    if (cleanDate && !isValidDateKey(cleanDate)) {
      setError(t('invalidDate'));
      return;
    }
    const selectedProject = projects.find((project) => project.id === projectId);
    const columnIndex = selectedProject?.columns.findIndex((column) => column.id === columnId) ?? -1;
    const isLastColumn = Boolean(selectedProject && columnIndex >= 0 && columnIndex === selectedProject.columns.length - 1);

    setSaving(true);
    try {
      await inboxRepository.convertToTask(
        db,
        item.id,
        {
          title,
          notes: notes.trim() || null,
          dueDate: cleanDate || null,
          priority,
          projectId,
          columnId: projectId ? columnId : null,
          milestoneId: null,
        },
        isLastColumn ? 'DONE' : 'OPEN',
        isLastColumn ? today : null,
      );
      refresh();
      if (!cleanDate) router.replace('/today');
      else router.back();
    } catch {
      setError(t('errorGeneric'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Screen><LoadingView /></Screen>;

  if (!item) {
    return (
      <Screen>
        <BackButton label={t('back')} onPress={() => router.back()} />
        <Card><Text style={[styles.message, { color: theme.textMuted }]}>{t('inboxItemNotFound')}</Text></Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <BackButton label={t('back')} onPress={() => router.back()} />
      <ScreenHeader title={t('organizeInbox')} />
      <Card style={styles.formCard} tone="accent">
        <TaskFormFields
          columnId={columnId}
          dueDate={dueDate}
          notes={notes}
          onDestinationChange={selectDestination}
          onDueDateChange={(value) => { setDueDate(value); setError(''); }}
          onNotesChange={setNotes}
          onPriorityChange={setPriority}
          onTitleChange={setTitle}
          priority={priority}
          projectId={projectId}
          projects={projects}
          title={title}
        />
      </Card>
      {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
      <ActionButton disabled={saving || !title.trim()} icon="checkmark-circle-outline" label={t('createTask')} onPress={() => void createTask()} />
      <ActionButton icon="arrow-back-outline" kind="ghost" label={t('keepInInbox')} onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  formCard: { paddingVertical: 22 },
  message: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  error: { fontSize: 13, fontWeight: '600', lineHeight: 19, textAlign: 'center' },
});
