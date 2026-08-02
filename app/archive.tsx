import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ActionButton, BackButton, Card, EmptyState, LoadingView, Screen, ScreenHeader, SectionHeader } from '@/components/ui';
import { taskRepository } from '@/data/repositories';
import type { ArchivedTask } from '@/data/types';
import { useDataVersion } from '@/providers/data-version-provider';
import { useLanguage } from '@/providers/language-provider';
import { useAppTheme } from '@/theme/theme';

type ArchiveFilter = 'all' | 'projects' | 'loose';

export default function ArchiveScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useAppTheme();
  const { locale, t } = useLanguage();
  const { refresh, version } = useDataVersion();
  const [tasks, setTasks] = useState<ArchivedTask[]>([]);
  const [filter, setFilter] = useState<ArchiveFilter>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    taskRepository.listArchived(db)
      .then((nextTasks) => { if (active) setTasks(nextTasks); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [db, version]);

  const visibleTasks = useMemo(() => tasks.filter((task) => {
    if (filter === 'projects') return Boolean(task.projectId);
    if (filter === 'loose') return !task.projectId;
    return true;
  }), [filter, tasks]);

  async function restoreTask(id: string) {
    await taskRepository.restore(db, id);
    refresh();
  }

  function confirmPermanentDelete(task: ArchivedTask) {
    Alert.alert(t('confirmDeleteForeverTitle'), t('confirmDeleteForeverTask'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('deleteForever'),
        style: 'destructive',
        onPress: () => { void taskRepository.removePermanently(db, task.id).then(refresh); },
      },
    ]);
  }

  return (
    <Screen>
      <BackButton label={t('back')} onPress={() => router.back()} />
      <ScreenHeader
        action={<View style={[styles.headerIcon, { backgroundColor: theme.surfaceRaised }]}><Ionicons color={theme.textMuted} name="archive-outline" size={22} /></View>}
        subtitle={t('archiveSubtitle')}
        title={t('archiveTitle')}
      />

      <View style={[styles.filters, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
        <FilterButton active={filter === 'all'} label={t('filterAll')} onPress={() => setFilter('all')} />
        <FilterButton active={filter === 'projects'} label={t('filterProjects')} onPress={() => setFilter('projects')} />
        <FilterButton active={filter === 'loose'} label={t('filterLoose')} onPress={() => setFilter('loose')} />
      </View>

      <View style={styles.section}>
        <SectionHeader count={visibleTasks.length} title={t('archiveTitle')} />
        {loading ? <LoadingView /> : visibleTasks.length === 0 ? <EmptyState icon="archive-outline" text={t('archivedEmpty')} /> : (
          <View style={styles.list}>
            {visibleTasks.map((task) => (
              <Card key={task.id} style={styles.taskCard}>
                <View style={styles.taskHeading}>
                  <View style={[styles.taskIcon, { backgroundColor: theme.surfaceRaised }]}>
                    <Ionicons color={theme.textMuted} name="document-text-outline" size={19} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={[styles.taskTitle, { color: theme.text }]}>{task.title}</Text>
                    <Text style={[styles.meta, { color: theme.textMuted }]}>{task.projectName ?? t('noProject')}{task.dueDate ? ` · ${task.dueDate}` : ''}</Text>
                    <Text style={[styles.archivedDate, { color: theme.textMuted }]}>{t('archivedOn')} · {new Date(task.updatedAt).toLocaleDateString(locale)}</Text>
                  </View>
                </View>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <View style={styles.actions}>
                  <View style={styles.flex}><ActionButton icon="refresh-outline" label={t('restore')} onPress={() => void restoreTask(task.id)} /></View>
                  <View style={styles.flex}><ActionButton icon="trash-outline" kind="danger" label={t('deleteForever')} onPress={() => confirmPermanentDelete(task)} /></View>
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

function FilterButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.filterButton, { backgroundColor: active ? theme.accentSurfaceStrong : 'transparent', opacity: pressed ? 0.7 : 1 }]}
    >
      <Text style={[styles.filterText, { color: active ? theme.accentSoft : theme.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerIcon: { alignItems: 'center', borderRadius: 17, height: 48, justifyContent: 'center', width: 48 },
  filters: { borderRadius: 18, borderWidth: 1, flexDirection: 'row', padding: 4 },
  filterButton: { alignItems: 'center', borderRadius: 14, flex: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 8 },
  filterText: { fontSize: 12, fontWeight: '800' },
  section: { gap: 12 },
  list: { gap: 11 },
  taskCard: { gap: 14 },
  taskHeading: { alignItems: 'flex-start', flexDirection: 'row', gap: 12 },
  taskIcon: { alignItems: 'center', borderRadius: 14, height: 42, justifyContent: 'center', width: 42 },
  taskTitle: { fontSize: 16, fontWeight: '800', lineHeight: 22 },
  meta: { fontSize: 12, marginTop: 5 },
  archivedDate: { fontSize: 11, marginTop: 3 },
  divider: { height: 1 },
  actions: { flexDirection: 'row', gap: 9 },
});
