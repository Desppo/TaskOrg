import { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/providers/language-provider';
import { useAppTheme } from '@/theme/theme';
import { fromDateKey, isValidDateKey, shiftMonth, toDateKey } from '@/utils/date';

// Date-only values stay in local time on Android and iOS, including across DST changes.
export function DateField({ value, onChange, label, minimumDate, allowClear = true }: {
  value: string | null;
  onChange: (value: string | null) => void;
  label: string;
  minimumDate?: string;
  allowClear?: boolean;
}) {
  const theme = useAppTheme();
  const { locale, t } = useLanguage();
  const today = toDateKey(new Date());
  const selected = value && isValidDateKey(value) ? value : null;
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => fromDateKey(selected ?? minimumDate ?? today));
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const offset = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const count = new Date(year, monthIndex + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, index) => {
    const day = index - offset + 1;
    return day > 0 && day <= count ? toDateKey(new Date(year, monthIndex, day)) : null;
  });
  const dateLabel = selected
    ? fromDateKey(selected).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
    : t('chooseDate');

  function toggle() {
    Keyboard.dismiss();
    if (!open) setMonth(fromDateKey(selected ?? minimumDate ?? today));
    setOpen(!open);
  }

  return (
    <View style={styles.field}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${dateLabel}`}
          accessibilityState={{ expanded: open }}
          onPress={toggle}
          style={[styles.trigger, { backgroundColor: theme.input, borderColor: open ? theme.accent : theme.border }]}
        >
          <Ionicons name="calendar-outline" size={20} color={theme.accentSoft} />
          <Text style={[styles.value, { color: selected ? theme.text : theme.textMuted }]}>{dateLabel}</Text>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={theme.textMuted} />
        </Pressable>
        {selected && allowClear ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('clearDate')} onPress={() => { onChange(null); setOpen(false); }} style={styles.iconButton}>
            <Ionicons name="close-circle-outline" color={theme.textMuted} size={23} />
          </Pressable>
        ) : null}
      </View>
      {open ? (
        <View style={[styles.calendar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.row}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('previousMonth')} onPress={() => setMonth(shiftMonth(month, -1))} style={styles.iconButton}>
              <Ionicons name="chevron-back" color={theme.accentSoft} size={20} />
            </Pressable>
            <Text accessibilityLiveRegion="polite" style={[styles.month, { color: theme.text }]}>
              {month.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t('nextMonth')} onPress={() => setMonth(shiftMonth(month, 1))} style={styles.iconButton}>
              <Ionicons name="chevron-forward" color={theme.accentSoft} size={20} />
            </Pressable>
          </View>
          <View style={styles.grid}>
            {Array.from({ length: 7 }, (_, day) => (
              <Text key={day} style={[styles.weekday, { color: theme.textMuted }]}>
                {new Date(2024, 0, day + 1).toLocaleDateString(locale, { weekday: 'narrow' })}
              </Text>
            ))}
            {cells.map((key, index) => {
              if (!key) return <View key={`empty-${index}`} style={styles.cell} />;
              const disabled = Boolean(minimumDate && key < minimumDate);
              const active = key === selected;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityLabel={fromDateKey(key).toLocaleDateString(locale, { dateStyle: 'full' })}
                  accessibilityState={{ selected: active, disabled }}
                  disabled={disabled}
                  onPress={() => { onChange(key); setOpen(false); }}
                  style={[styles.cell, { backgroundColor: active ? theme.accent : 'transparent', opacity: disabled ? 0.3 : 1 }]}
                >
                  <Text style={[styles.day, { color: active ? '#FFFFFF' : key === today ? theme.accentSoft : theme.text }]}>{fromDateKey(key).getDate()}</Text>
                  {key === today ? <View style={[styles.todayDot, { backgroundColor: active ? '#FFFFFF' : theme.accent }]} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  trigger: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 54, borderWidth: 1, borderRadius: 17, padding: 12 },
  value: { flex: 1, fontSize: 14, fontWeight: '600' },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  calendar: { borderRadius: 16, borderWidth: 1, padding: 8 },
  month: { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: '800', textTransform: 'capitalize' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, fontWeight: '700', paddingVertical: 10 },
  cell: { width: `${100 / 7}%`, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  day: { fontSize: 14, fontWeight: '600' },
  todayDot: { width: 4, height: 4, borderRadius: 2, position: 'absolute', bottom: 4 },
});
