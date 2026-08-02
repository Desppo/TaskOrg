import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ActionButton, AppInput, BackButton, Card, LoadingView, Screen, ScreenHeader } from '@/components/ui';
import { projectRepository } from '@/data/repositories';
import type { ProjectDetail, TaskItem } from '@/data/types';
import { useDataVersion } from '@/providers/data-version-provider';
import { useLanguage } from '@/providers/language-provider';
import { useAppTheme } from '@/theme/theme';
import { toDateKey } from '@/utils/date';

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const projectId = Array.isArray(id) ? id[0] : id;
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useAppTheme();
  const { t } = useLanguage();
  const { refresh, version } = useDataVersion();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const today = useMemo(() => toDateKey(new Date()), []);

  useEffect(() => {
    let active = true;
    if (!projectId) {
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    projectRepository.getById(db, projectId)
      .then((nextProject) => { if (active) setProject(nextProject); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [db, projectId, version]);

  async function addTask() {
    const firstColumn = project?.columns[0];
    if (!project || !firstColumn || !taskTitle.trim()) return;
    await projectRepository.createTask(db, project.id, firstColumn.id, taskTitle);
    setTaskTitle('');
    refresh();
  }

  async function moveTask(task: TaskItem, columnIndex: number, direction: -1 | 1) {
    if (!project) return;
    const nextIndex = columnIndex + direction;
    const nextColumn = project.columns[nextIndex];
    if (!nextColumn) return;
    const completedOn = nextIndex === project.columns.length - 1 ? today : null;
    await projectRepository.moveTask(db, task.id, nextColumn.id, completedOn);
    refresh();
  }

  if (loading) {
    return <Screen><LoadingView /></Screen>;
  }

  if (!project) {
    return (
      <Screen>
        <BackButton label={t('back')} onPress={() => router.back()} />
        <Card><Text style={[styles.emptyText, { color: theme.textMuted }]}>{t('projectNotFound')}</Text></Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <BackButton label={t('back')} onPress={() => router.back()} />
      <ScreenHeader
        action={<View style={[styles.projectIcon, { backgroundColor: `${project.color}20` }]}><Ionicons color={project.color} name="folder-open-outline" size={23} /></View>}
        subtitle={project.description ?? undefined}
        title={project.name}
      />

      <Card tone="accent">
        <View style={styles.inputRow}>
          <AppInput
            onChangeText={setTaskTitle}
            onSubmitEditing={() => void addTask()}
            placeholder={t('projectTaskPlaceholder')}
            returnKeyType="done"
            style={styles.flex}
            value={taskTitle}
          />
          <ActionButton disabled={!taskTitle.trim() || project.columns.length === 0} icon="add" label={t('add')} onPress={() => void addTask()} />
        </View>
      </Card>

      {project.columns.map((column, columnIndex) => (
        <View key={column.id} style={styles.columnSection}>
          <View style={styles.columnHeader}>
            <View style={[styles.columnMarker, { backgroundColor: project.color }]} />
            <Text style={[styles.columnTitle, { color: theme.text }]}>{column.name}</Text>
            <Text style={[styles.count, { backgroundColor: theme.surfaceRaised, color: theme.textMuted }]}>{column.tasks.length}</Text>
          </View>
          {column.tasks.length === 0 ? (
            <Text style={[styles.emptyColumn, { borderColor: theme.border, color: theme.textMuted }]}>{t('projectEmptyColumn')}</Text>
          ) : (
            <View style={styles.taskList}>
              {column.tasks.map((task) => (
                <Card key={task.id} style={styles.taskCard}>
                  <Pressable onPress={() => router.push(`/task/${task.id}`)} style={styles.flex}>
                    <Text style={[styles.taskTitle, task.status === 'DONE' && styles.taskDone, { color: task.status === 'DONE' ? theme.textMuted : theme.text }]}>{task.title}</Text>
                  </Pressable>
                  <View style={styles.moveRow}>
                    <MoveButton
                      accessibilityLabel={t('movePrevious')}
                      disabled={columnIndex === 0}
                      icon="arrow-back"
                      onPress={() => void moveTask(task, columnIndex, -1)}
                    />
                    <MoveButton
                      accessibilityLabel={t('moveNext')}
                      disabled={columnIndex === project.columns.length - 1}
                      icon="arrow-forward"
                      onPress={() => void moveTask(task, columnIndex, 1)}
                    />
                  </View>
                </Card>
              ))}
            </View>
          )}
        </View>
      ))}
    </Screen>
  );
}

function MoveButton({ accessibilityLabel, disabled, icon, onPress }: { accessibilityLabel: string; disabled: boolean; icon: 'arrow-back' | 'arrow-forward'; onPress: () => void }) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.moveButton, { backgroundColor: theme.surfaceRaised, opacity: disabled ? 0.25 : pressed ? 0.6 : 1 }]}
    >
      <Ionicons color={theme.text} name={icon} size={17} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  projectIcon: { alignItems: 'center', borderRadius: 17, height: 50, justifyContent: 'center', width: 50 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  columnSection: { gap: 10 },
  columnHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  columnMarker: { borderRadius: 3, height: 19, width: 4 },
  columnTitle: { fontSize: 17, fontWeight: '800' },
  count: { borderRadius: 10, fontSize: 11, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 3 },
  emptyColumn: { borderRadius: 16, borderStyle: 'dashed', borderWidth: 1, fontSize: 13, padding: 16, textAlign: 'center' },
  taskList: { gap: 8 },
  taskCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  taskTitle: { flex: 1, fontSize: 15, fontWeight: '700' },
  taskDone: { textDecorationLine: 'line-through' },
  moveRow: { flexDirection: 'row', gap: 6 },
  moveButton: { alignItems: 'center', borderRadius: 10, height: 36, justifyContent: 'center', width: 38 },
  emptyText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
