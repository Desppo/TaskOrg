import { type ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DateField } from '@/components/date-field';
import { AppInput } from '@/components/ui';
import type { Priority, ProjectDestination, RecurrenceDraft, RecurrenceFrequency } from '@/data/types';
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
  // Optional — not shown in the inbox organize form
  recurrenceDraft?: RecurrenceDraft | null;
  onRecurrenceChange?: (draft: RecurrenceDraft | null) => void;
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
  recurrenceDraft,
  onRecurrenceChange,
}: TaskFormFieldsProps) {
  const theme = useAppTheme();
  const { t } = useLanguage();
  const today = toDateKey(new Date());
  const selectedProject = projects.find((p) => p.id === projectId) ?? null;
  const priorities: Array<[Priority, string]> = [
    [0, t('priorityNone')],
    [1, t('priorityLow')],
    [2, t('priorityMedium')],
    [3, t('priorityHigh')],
  ];

  function selectProject(project: ProjectDestination | null) {
    onDestinationChange(project?.id ?? null, project?.columns[0]?.id ?? null);
  }

  function toggleRecurrence() {
    if (!onRecurrenceChange) return;
    onRecurrenceChange(
      recurrenceDraft
        ? null
        : { frequency: 'DAILY', intervalValue: 1, daysOfWeek: [], endDate: null, endType: 'none', endValue: null },
    );
  }

  return (
    <View style={styles.form}>
      {/* Title */}
      <View style={styles.field}>
        <FieldLabel icon="text-outline" text={t('taskTitle')} />
        <AppInput onChangeText={onTitleChange} placeholder={t('taskTitlePlaceholder')} returnKeyType="done" value={title} />
      </View>

      {/* Notes */}
      <View style={styles.field}>
        <FieldLabel icon="document-text-outline" text={t('notes')} />
        <AppInput multiline numberOfLines={4} onChangeText={onNotesChange} placeholder={t('notesPlaceholder')} style={styles.notes} value={notes} />
      </View>

      {/* Date — hidden when recurrence is active (start date is auto-managed) */}
      {!recurrenceDraft ? (
        <View style={styles.field}>
          <FieldLabel icon="calendar-outline" text={t('dueDate')} />
          <View style={styles.chipRow}>
            <ChoiceChip active={dueDate === today} label={t('today')} onPress={() => onDueDateChange(today)} />
            <ChoiceChip active={dueDate === shiftDate(today, 1)} label={t('tomorrow')} onPress={() => onDueDateChange(shiftDate(today, 1))} />
            <ChoiceChip active={!dueDate} label={t('noDate')} onPress={() => onDueDateChange('')} />
          </View>
          <DateField label={t('dueDate')} onChange={(value) => onDueDateChange(value ?? '')} value={dueDate} />
        </View>
      ) : null}

      {/* Priority */}
      <View style={styles.field}>
        <FieldLabel icon="flag-outline" text={t('priority')} />
        <View style={styles.chipRow}>
          {priorities.map(([value, label]) => (
            <ChoiceChip key={value} active={priority === value} label={label} onPress={() => onPriorityChange(value)} />
          ))}
        </View>
      </View>

      {/* Destination */}
      <View style={styles.field}>
        <FieldLabel icon="folder-open-outline" text={t('destination')} />
        <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalChips}>
          <ChoiceChip active={!projectId} label={t('noProject')} onPress={() => selectProject(null)} />
          {projects.map((project) => (
            <ChoiceChip key={project.id} active={project.id === projectId} label={project.name} onPress={() => selectProject(project)} />
          ))}
        </ScrollView>
      </View>

      {/* Column (if project selected) */}
      {selectedProject && selectedProject.columns.length > 0 ? (
        <View style={styles.field}>
          <FieldLabel icon="albums-outline" text={t('column')} />
          <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalChips}>
            {selectedProject.columns.map((col) => (
              <ChoiceChip key={col.id} active={col.id === columnId} label={col.name} onPress={() => onDestinationChange(selectedProject.id, col.id)} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Recurrence (optional — not shown in inbox form) */}
      {onRecurrenceChange !== undefined ? (
        <RecurrenceSection draft={recurrenceDraft ?? null} onChange={onRecurrenceChange} onToggle={toggleRecurrence} />
      ) : null}

      <View style={styles.localRow}>
        <Ionicons color={theme.success} name="phone-portrait-outline" size={13} />
        <Text style={[styles.localHint, { color: theme.textMuted }]}>TaskOrg · local</Text>
      </View>
    </View>
  );
}

// ─── Recurrence section ────────────────────────────────────────────────────────

type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

function RecurrenceSection({
  draft,
  onChange,
  onToggle,
}: {
  draft: RecurrenceDraft | null;
  onChange: (d: RecurrenceDraft) => void;
  onToggle: () => void;
}) {
  const theme = useAppTheme();
  const { t } = useLanguage();

  const freqOptions: Array<[RecurrenceFrequency, string]> = [
    ['DAILY', t('recurrenceDaily')],
    ['WEEKLY', t('recurrenceWeekly')],
    ['MONTHLY', t('recurrenceMonthly')],
  ];

  const dayLabels: Array<[DayIndex, string]> = [
    [1, t('recurrenceDaysMon')],
    [2, t('recurrenceDaysTue')],
    [3, t('recurrenceDaysWed')],
    [4, t('recurrenceDaysThu')],
    [5, t('recurrenceDaysFri')],
    [6, t('recurrenceDaysSat')],
    [0, t('recurrenceDaysSun')],
  ];

  const intervalUnit = !draft ? '' : draft.frequency === 'DAILY'
    ? t('recurrenceIntervalDays')
    : draft.frequency === 'WEEKLY'
      ? t('recurrenceIntervalWeeks')
      : t('recurrenceIntervalMonths');

  function toggleDay(day: DayIndex) {
    if (!draft) return;
    const next = draft.daysOfWeek.includes(day)
      ? draft.daysOfWeek.filter((d) => d !== day)
      : [...draft.daysOfWeek, day];
    onChange({ ...draft, daysOfWeek: next });
  }

  return (
    <View style={styles.field}>
      <View style={styles.recurrenceHeader}>
        <FieldLabel icon="repeat-outline" text={t('recurrence')} />
        <Pressable
          accessibilityLabel={t('recurrence')}
          accessibilityRole="switch"
          hitSlop={10}
          accessibilityState={{ checked: !!draft }}
          onPress={onToggle}
          style={[styles.toggle, { backgroundColor: draft ? theme.accent : theme.surfaceRaised }]}
        >
          <View style={[styles.toggleThumb, { transform: [{ translateX: draft ? 18 : 2 }] }]} />
        </Pressable>
      </View>

      {draft ? (
        <View style={[styles.recurrenceBody, { backgroundColor: theme.accentSurface, borderColor: theme.border }]}>
          {/* Frequency chips */}
          <View style={styles.chipRow}>
            {freqOptions.map(([value, label]) => (
              <ChoiceChip key={value} active={draft.frequency === value} label={label}
                onPress={() => onChange({ ...draft, frequency: value, daysOfWeek: [] })} />
            ))}
          </View>

          {/* Interval */}
          <View style={styles.intervalRow}>
            <Text style={[styles.intervalLabel, { color: theme.textSecondary }]}>{t('recurrenceInterval')}</Text>
            <AppInput
              accessibilityLabel={t('recurrenceInterval')}
              keyboardType="number-pad"
              maxLength={2}
              onChangeText={(v) => {
                if (v === '') {
                  onChange({ ...draft, intervalValue: 0 }); // temporarily invalid
                } else {
                  const n = parseInt(v, 10);
                  if (!isNaN(n) && n > 0) onChange({ ...draft, intervalValue: n });
                }
              }}
              selectTextOnFocus
              style={[styles.intervalInput, { backgroundColor: theme.input, borderColor: theme.border, color: theme.text }]}
              value={draft.intervalValue > 0 ? String(draft.intervalValue) : ''}
            />
            <Text style={[styles.intervalLabel, { color: theme.textSecondary }]}>{intervalUnit}</Text>
          </View>

          {/* Days of week (WEEKLY only) */}
          {draft.frequency === 'WEEKLY' ? (
            <View style={styles.dayRow}>
              {dayLabels.map(([day, label]) => {
                const active = draft.daysOfWeek.includes(day);
                return (
                  <Pressable
                    key={day}
                    accessibilityLabel={label}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: active }}
                    onPress={() => toggleDay(day)}
                    style={[styles.dayChip, {
                      backgroundColor: active ? theme.accent : theme.surfaceRaised,
                      borderColor: active ? theme.accentStrong : theme.border,
                    }]}
                  >
                    <Text style={[styles.dayChipText, { color: active ? '#FFFFFF' : theme.textMuted }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/* End type selection */}
          <View style={styles.field}>
            <View style={styles.chipRow}>
              <ChoiceChip active={draft.endType === 'none'} label={t('recurrenceEndTypeNever')} onPress={() => onChange({ ...draft, endType: 'none', endValue: null, endDate: null })} />
              <ChoiceChip active={draft.endType === 'date'} label={t('recurrenceEndTypeDate')} onPress={() => onChange({ ...draft, endType: 'date', endValue: null, endDate: null })} />
              <ChoiceChip active={draft.endType === 'duration'} label={t('recurrenceEndTypeDuration')} onPress={() => onChange({ ...draft, endType: 'duration', endValue: '5', endDate: null })} />
            </View>
          </View>

          {/* End value inputs */}
          {draft.endType === 'date' ? (
            <DateField label={t('recurrenceEndDate')} onChange={(d) => onChange({ ...draft, endDate: d, endValue: d })} value={draft.endDate} />
          ) : draft.endType === 'duration' ? (
             <View style={styles.intervalRow}>
               <AppInput
                 accessibilityLabel={t('recurrenceEndTypeDuration')}
                 keyboardType="number-pad"
                 maxLength={3}
                 onChangeText={(v) => onChange({ ...draft, endValue: v })}
                 selectTextOnFocus
                 style={[styles.intervalInput, { backgroundColor: theme.input, borderColor: theme.border, color: theme.text }]}
                 value={draft.endValue ?? ''}
               />
               <Text style={[styles.intervalLabel, { color: theme.textSecondary }]}>{intervalUnit}</Text>
             </View>
          ) : null}

          <View style={styles.recurrenceBadgeRow}>
            <Ionicons color={theme.accentSoft} name="information-circle-outline" size={14} />
            <Text style={[styles.recurrenceHintText, { color: theme.textMuted }]}>{t('recurrenceHint')}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

// ─── Shared sub-components ─────────────────────────────────────────────────────

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
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, {
        backgroundColor: active ? theme.accentSurfaceStrong : theme.surfaceRaised,
        borderColor: active ? theme.accent : theme.border,
        opacity: pressed ? 0.7 : 1,
      }]}
    >
      {active ? <Ionicons color={theme.accentSoft} name="checkmark" size={14} /> : null}
      <Text style={[styles.chipText, { color: active ? theme.accentSoft : theme.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  form: { gap: 22 },
  field: { gap: 10 },
  labelRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  label: { fontSize: 14, fontWeight: '800' },
  notes: { minHeight: 96, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  horizontalChips: { gap: 8, paddingRight: 8 },
  chip: { alignItems: 'center', borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 5, minHeight: 44, justifyContent: 'center', paddingHorizontal: 13 },
  chipText: { fontSize: 12, fontWeight: '800' },
  localRow: { alignItems: 'center', alignSelf: 'flex-end', flexDirection: 'row', gap: 4 },
  localHint: { fontSize: 10, fontWeight: '700' },

  // Recurrence
  recurrenceHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  toggle: { borderRadius: 13, height: 26, justifyContent: 'center', width: 44 },
  toggleThumb: { backgroundColor: '#FFFFFF', borderRadius: 10, height: 20, width: 20 },
  recurrenceBody: { borderRadius: 18, borderWidth: 1, gap: 14, padding: 16 },
  intervalRow: { flexWrap: 'wrap', alignItems: 'center', flexDirection: 'row', gap: 10 },
  intervalLabel: { fontSize: 13, fontWeight: '700' },
  intervalInput: { borderRadius: 10, borderWidth: 1, fontSize: 15, fontWeight: '700', minWidth: 52, paddingHorizontal: 10, paddingVertical: 8, textAlign: 'center' },
  dayRow: { flexWrap: 'wrap', flexDirection: 'row', gap: 6 },
  dayChip: { alignItems: 'center', borderRadius: 10, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
  dayChipText: { fontSize: 12, fontWeight: '900' },
  recurrenceBadgeRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  recurrenceHintText: { flex: 1, fontSize: 11, lineHeight: 16 },

});
