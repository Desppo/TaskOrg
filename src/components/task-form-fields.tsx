import type { ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppInput } from '@/components/ui';
import type { Priority, ProjectDestination } from '@/data/types';
import { useLanguage } from '@/providers/language-provider';
import { useAppTheme } from '@/theme/theme';
import { shiftDate, toDateKey } from '@/utils/date';

interface TaskFormFieldsProps {
  title: string;
  notes: string;
  dueDate: string;
  priority: Priority;
  projects: ProjectDestination[];
  projectId: string | null;
  columnId: string | null;
  onTitleChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onDueDateChange: (value: string) => void;
  onPriorityChange: (value: Priority) => void;
  onDestinationChange: (projectId: string | null, columnId: string | null) => void;
}

type IconName = ComponentProps<typeof Ionicons>['name'];

export function TaskFormFields({
  title,
  notes,
  dueDate,
  priority,
  projects,
  projectId,
  columnId,
  onTitleChange,
  onNotesChange,
  onDueDateChange,
  onPriorityChange,
  onDestinationChange,
}: TaskFormFieldsProps) {
  const theme = useAppTheme();
  const { t } = useLanguage();
  const today = toDateKey(new Date());
  const selectedProject = projects.find((project) => project.id === projectId) ?? null;
  const priorities: Array<[Priority, string]> = [
    [0, t('priorityNone')],
    [1, t('priorityLow')],
    [2, t('priorityMedium')],
    [3, t('priorityHigh')],
  ];

  function selectProject(project: ProjectDestination | null) {
    onDestinationChange(project?.id ?? null, project?.columns[0]?.id ?? null);
  }

  return (
    <View style={styles.form}>
      <View style={styles.field}>
        <FieldLabel icon="text-outline" text={t('taskTitle')} />
        <AppInput
          autoFocus
          onChangeText={onTitleChange}
          placeholder={t('taskTitlePlaceholder')}
          returnKeyType="next"
          value={title}
        />
      </View>

      <View style={styles.field}>
        <FieldLabel icon="document-text-outline" text={t('notes')} />
        <AppInput
          multiline
          numberOfLines={4}
          onChangeText={onNotesChange}
          placeholder={t('notesPlaceholder')}
          style={styles.notes}
          value={notes}
        />
      </View>

      <View style={styles.field}>
        <FieldLabel icon="calendar-outline" text={t('dueDate')} />
        <View style={styles.chipRow}>
          <ChoiceChip active={dueDate === today} label={t('today')} onPress={() => onDueDateChange(today)} />
          <ChoiceChip active={dueDate === shiftDate(today, 1)} label={t('tomorrow')} onPress={() => onDueDateChange(shiftDate(today, 1))} />
          <ChoiceChip active={!dueDate} label={t('noDate')} onPress={() => onDueDateChange('')} />
        </View>
        <AppInput
          autoCapitalize="none"
          onChangeText={onDueDateChange}
          placeholder={t('datePlaceholder')}
          value={dueDate}
        />
      </View>

      <View style={styles.field}>
        <FieldLabel icon="flag-outline" text={t('priority')} />
        <View style={styles.chipRow}>
          {priorities.map(([value, label]) => (
            <ChoiceChip key={value} active={priority === value} label={label} onPress={() => onPriorityChange(value)} />
          ))}
        </View>
      </View>

      <View style={styles.field}>
        <FieldLabel icon="folder-open-outline" text={t('destination')} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalChips}>
          <ChoiceChip active={!projectId} label={t('noProject')} onPress={() => selectProject(null)} />
          {projects.map((project) => (
            <ChoiceChip key={project.id} active={project.id === projectId} label={project.name} onPress={() => selectProject(project)} />
          ))}
        </ScrollView>
      </View>

      {selectedProject && selectedProject.columns.length > 0 ? (
        <View style={styles.field}>
          <FieldLabel icon="albums-outline" text={t('column')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalChips}>
            {selectedProject.columns.map((column) => (
              <ChoiceChip
                key={column.id}
                active={column.id === columnId}
                label={column.name}
                onPress={() => onDestinationChange(selectedProject.id, column.id)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.localRow}>
        <Ionicons color={theme.success} name="phone-portrait-outline" size={13} />
        <Text style={[styles.localHint, { color: theme.textMuted }]}>TaskOrg · local</Text>
      </View>
    </View>
  );
}

function FieldLabel({ icon, text }: { icon: IconName; text: string }) {
  const theme = useAppTheme();
  return (
    <View style={styles.labelRow}>
      <Ionicons color={theme.accentSoft} name={icon} size={16} />
      <Text style={[styles.label, { color: theme.text }]}>{text}</Text>
    </View>
  );
}

function ChoiceChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? theme.accentSurfaceStrong : theme.surfaceRaised,
          borderColor: active ? theme.accent : theme.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      {active ? <Ionicons color={theme.accentSoft} name="checkmark" size={14} /> : null}
      <Text style={[styles.chipText, { color: active ? theme.accentSoft : theme.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  form: { gap: 22 },
  field: { gap: 10 },
  labelRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  label: { fontSize: 14, fontWeight: '800' },
  notes: { minHeight: 96, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  horizontalChips: { gap: 8, paddingRight: 8 },
  chip: { alignItems: 'center', borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 5, minHeight: 42, justifyContent: 'center', paddingHorizontal: 13 },
  chipText: { fontSize: 12, fontWeight: '800' },
  localRow: { alignItems: 'center', alignSelf: 'flex-end', flexDirection: 'row', gap: 4 },
  localHint: { fontSize: 10, fontWeight: '700' },
});
