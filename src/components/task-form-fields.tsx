import { useState, type ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
        : { frequency: 'DAILY', intervalValue: 1, daysOfWeek: [], endDate: null },
    );
  }

  return (
    <View style={styles.form}>
      {/* Title */}
      <View style={styles.field}>
        <FieldLabel icon="text-outline" text={t('taskTitle')} />
        <AppInput autoFocus onChangeText={onTitleChange} placeholder={t('taskTitlePlaceholder')} returnKeyType="next" value={title} />
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
          <AppInput autoCapitalize="none" onChangeText={onDueDateChange} placeholder={t('datePlaceholder')} value={dueDate} />
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalChips}>
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalChips}>
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

// ─── Pure-JS Mini Calendar ─────────────────────────────────────────────────────

function MiniCalendar({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (dateKey: string) => void;
}) {
  const theme = useAppTheme();
  const { locale } = useLanguage();

  const todayKey = toDateKey(new Date());
  const todayDate = new Date();

  const initDate = value
    ? new Date(value + 'T12:00:00')
    : (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d; })();

  const [displayYear, setDisplayYear] = useState(initDate.getFullYear());
  const [displayMonth, setDisplayMonth] = useState(initDate.getMonth()); // 0-indexed

  const daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate();
  // Weekday of first day (0=Sun … 6=Sat). Convert to Monday-first offset.
  const firstDow = new Date(displayYear, displayMonth, 1).getDay();
  const startOffset = (firstDow + 6) % 7; // 0=Mon … 6=Sun

  const monthLabel = new Date(displayYear, displayMonth, 1).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  });

  // Mon Tue Wed Thu Fri Sat Sun labels — use locale-aware single chars
  const DOW_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  function prevMonth() {
    if (displayMonth === 0) { setDisplayMonth(11); setDisplayYear((y) => y - 1); }
    else setDisplayMonth((m) => m - 1);
  }

  function nextMonth() {
    if (displayMonth === 11) { setDisplayMonth(0); setDisplayYear((y) => y + 1); }
    else setDisplayMonth((m) => m + 1);
  }

  function selectDay(day: number) {
    const key = toDateKey(new Date(displayYear, displayMonth, day, 12));
    if (key < todayKey) return; // disable past days
    onChange(key);
  }

  function isDayDisabled(day: number) {
    return toDateKey(new Date(displayYear, displayMonth, day)) < todayKey;
  }

  function isDaySelected(day: number) {
    if (!value) return false;
    return value === toDateKey(new Date(displayYear, displayMonth, day));
  }

  function isDayToday(day: number) {
    return (
      todayDate.getFullYear() === displayYear &&
      todayDate.getMonth() === displayMonth &&
      todayDate.getDate() === day
    );
  }

  // Build cells grid: null = empty padding
  const cells: Array<number | null> = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <View style={[styles.calendar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {/* Month navigation */}
      <View style={styles.calendarNav}>
        <Pressable hitSlop={8} onPress={prevMonth} style={[styles.calendarNavBtn, { backgroundColor: theme.surfaceRaised }]}>
          <Ionicons color={theme.textSecondary} name="chevron-back" size={16} />
        </Pressable>
        <Text style={[styles.calendarMonthLabel, { color: theme.text }]}>{monthLabel}</Text>
        <Pressable hitSlop={8} onPress={nextMonth} style={[styles.calendarNavBtn, { backgroundColor: theme.surfaceRaised }]}>
          <Ionicons color={theme.textSecondary} name="chevron-forward" size={16} />
        </Pressable>
      </View>

      {/* Day-of-week header */}
      <View style={styles.calendarDowRow}>
        {DOW_LABELS.map((label) => (
          <View key={label} style={styles.calendarCell}>
            <Text style={[styles.calendarDowLabel, { color: theme.textMuted }]}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Day grid */}
      <View style={styles.calendarGrid}>
        {cells.map((day, idx) =>
          day === null ? (
            <View key={`e${idx}`} style={styles.calendarCell} />
          ) : (
            <Pressable
              key={day}
              disabled={isDayDisabled(day)}
              onPress={() => selectDay(day)}
              style={({ pressed }) => [
                styles.calendarCell,
                isDaySelected(day) && [styles.calendarDaySelected, { backgroundColor: theme.accent }],
                isDayToday(day) && !isDaySelected(day) && [styles.calendarDayToday, { borderColor: theme.accent }],
                { opacity: isDayDisabled(day) ? 0.28 : pressed ? 0.65 : 1 },
              ]}
            >
              <Text
                style={[
                  styles.calendarDayText,
                  { color: isDaySelected(day) ? '#FFFFFF' : theme.text },
                  isDayToday(day) && !isDaySelected(day) && { color: theme.accentSoft, fontWeight: '900' },
                ]}
              >
                {day}
              </Text>
            </Pressable>
          ),
        )}
      </View>
    </View>
  );
}

// ─── End-date picker (trigger + optional inline calendar) ─────────────────────

function EndDatePicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (d: string | null) => void;
}) {
  const theme = useAppTheme();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.endDateWrap}>
      {/* Trigger row */}
      <View style={styles.endDateRow}>
        <Text style={[styles.intervalLabel, { color: theme.textSecondary }]}>{t('recurrenceEndDate')}</Text>

        <Pressable
          onPress={() => setOpen((v) => !v)}
          style={({ pressed }) => [
            styles.endDateBtn,
            {
              backgroundColor: value ? theme.accentSurfaceStrong : theme.surfaceRaised,
              borderColor: value ? theme.accent : theme.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Ionicons color={value ? theme.accentSoft : theme.textMuted} name={value ? 'calendar' : 'calendar-outline'} size={14} />
          <Text style={[styles.endDateBtnText, { color: value ? theme.accentSoft : theme.textMuted }]}>
            {value ?? t('recurrenceEndDateHint')}
          </Text>
          <Ionicons color={value ? theme.accentSoft : theme.textMuted} name={open ? 'chevron-up' : 'chevron-down'} size={12} />
        </Pressable>

        {/* Clear */}
        {value ? (
          <Pressable
            hitSlop={8}
            onPress={() => { onChange(null); setOpen(false); }}
            style={[styles.endDateClear, { backgroundColor: theme.surfaceRaised }]}
          >
            <Ionicons color={theme.textMuted} name="close" size={14} />
          </Pressable>
        ) : null}
      </View>

      {/* Inline mini calendar */}
      {open ? (
        <MiniCalendar
          value={value}
          onChange={(key) => { onChange(key); setOpen(false); }}
        />
      ) : null}
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
          accessibilityRole="switch"
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
            <TextInput
              keyboardType="number-pad"
              maxLength={2}
              onChangeText={(v) => {
                const n = parseInt(v, 10);
                if (!isNaN(n) && n > 0) onChange({ ...draft, intervalValue: n });
              }}
              selectTextOnFocus
              style={[styles.intervalInput, { backgroundColor: theme.input, borderColor: theme.border, color: theme.text }]}
              value={String(draft.intervalValue)}
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

          {/* End date — mini calendar */}
          <EndDatePicker onChange={(d) => onChange({ ...draft, endDate: d })} value={draft.endDate} />

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

const CELL_SIZE = 36;

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

  // Recurrence
  recurrenceHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  toggle: { borderRadius: 13, height: 26, justifyContent: 'center', width: 44 },
  toggleThumb: { backgroundColor: '#FFFFFF', borderRadius: 10, height: 20, width: 20 },
  recurrenceBody: { borderRadius: 18, borderWidth: 1, gap: 14, padding: 16 },
  intervalRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  intervalLabel: { fontSize: 13, fontWeight: '700' },
  intervalInput: { borderRadius: 10, borderWidth: 1, fontSize: 15, fontWeight: '700', minWidth: 52, paddingHorizontal: 10, paddingVertical: 8, textAlign: 'center' },
  dayRow: { flexDirection: 'row', gap: 6 },
  dayChip: { alignItems: 'center', borderRadius: 10, borderWidth: 1, height: CELL_SIZE, justifyContent: 'center', width: CELL_SIZE },
  dayChipText: { fontSize: 12, fontWeight: '900' },
  recurrenceBadgeRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  recurrenceHintText: { flex: 1, fontSize: 11, lineHeight: 16 },

  // End date picker
  endDateWrap: { gap: 10 },
  endDateRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  endDateBtn: { alignItems: 'center', borderRadius: 14, borderWidth: 1, flex: 1, flexDirection: 'row', gap: 7, minHeight: 40, paddingHorizontal: 12, paddingVertical: 8 },
  endDateBtnText: { flex: 1, fontSize: 13, fontWeight: '700' },
  endDateClear: { alignItems: 'center', borderRadius: 12, height: 32, justifyContent: 'center', width: 32 },

  // Mini calendar
  calendar: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', padding: 10 },
  calendarNav: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  calendarNavBtn: { alignItems: 'center', borderRadius: 10, height: 30, justifyContent: 'center', width: 30 },
  calendarMonthLabel: { fontSize: 13, fontWeight: '900', textTransform: 'capitalize' },
  calendarDowRow: { flexDirection: 'row', marginBottom: 4 },
  calendarDowLabel: { fontSize: 10, fontWeight: '800', textAlign: 'center' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarCell: { alignItems: 'center', height: CELL_SIZE, justifyContent: 'center', width: `${100 / 7}%` },
  calendarDayText: { fontSize: 13, fontWeight: '600' },
  calendarDaySelected: { borderRadius: CELL_SIZE / 2 },
  calendarDayToday: { borderRadius: CELL_SIZE / 2, borderWidth: 1.5 },
});
