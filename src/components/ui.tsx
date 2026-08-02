import { useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type StyleProp,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '@/theme/theme';

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const theme = useAppTheme();
  const content = <View style={[styles.content, !scroll && styles.contentFixed]}>{children}</View>;
  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: theme.background }]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      ) : content}
    </SafeAreaView>
  );
}

export function ScreenHeader({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: ReactNode }) {
  const theme = useAppTheme();
  return (
    <View style={styles.screenHeader}>
      <View style={styles.screenHeaderCopy}>
        {eyebrow ? <Text style={[styles.eyebrow, { color: theme.accentSoft }]}>{eyebrow}</Text> : null}
        <Text style={[styles.screenTitle, { color: theme.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.screenSubtitle, { color: theme.textMuted }]}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function Card({ children, style, tone = 'default' }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: 'default' | 'accent' | 'success' | 'warning' | 'danger' }) {
  const theme = useAppTheme();
  const backgroundColor = tone === 'accent'
    ? theme.accentSurface
    : tone === 'success'
      ? theme.successSurface
      : tone === 'warning'
        ? theme.warningSurface
        : tone === 'danger'
          ? theme.dangerSurface
          : theme.surface;
  return (
    <View style={[styles.card, { backgroundColor, borderColor: tone === 'default' ? theme.border : 'transparent', shadowColor: theme.shadow }, style]}>
      {children}
    </View>
  );
}

export function AppInput(props: TextInputProps) {
  const theme = useAppTheme();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={theme.textMuted}
      {...props}
      onBlur={(event) => { setFocused(false); props.onBlur?.(event); }}
      onFocus={(event) => { setFocused(true); props.onFocus?.(event); }}
      selectionColor={theme.accent}
      style={[
        styles.input,
        {
          backgroundColor: theme.input,
          borderColor: focused ? theme.accent : theme.border,
          color: theme.text,
        },
        focused && styles.inputFocused,
        props.style,
      ]}
    />
  );
}

export function ActionButton({
  label,
  onPress,
  disabled = false,
  kind = 'primary',
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  kind?: 'primary' | 'ghost' | 'danger';
  icon?: ComponentProps<typeof Ionicons>['name'];
}) {
  const theme = useAppTheme();
  const backgroundColor = kind === 'primary' ? theme.accent : kind === 'danger' ? theme.dangerSurface : theme.surfaceRaised;
  const color = kind === 'danger' ? theme.danger : kind === 'primary' ? '#FFFFFF' : theme.text;
  function handlePress() {
    void Haptics.selectionAsync().catch(() => undefined);
    onPress();
  }
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor,
          opacity: disabled ? 0.38 : pressed ? 0.82 : 1,
          transform: [{ scale: pressed && !disabled ? 0.985 : 1 }],
        },
        kind === 'primary' && { shadowColor: theme.accentStrong },
      ]}
    >
      {icon ? <Ionicons color={color} name={icon} size={18} /> : null}
      <Text style={[styles.buttonText, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, label, onPress, kind = 'default' }: { icon: ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; kind?: 'default' | 'accent' | 'danger' }) {
  const theme = useAppTheme();
  const backgroundColor = kind === 'accent' ? theme.accentSurface : kind === 'danger' ? theme.dangerSurface : theme.surfaceRaised;
  const color = kind === 'accent' ? theme.accentSoft : kind === 'danger' ? theme.danger : theme.text;
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={() => { void Haptics.selectionAsync().catch(() => undefined); onPress(); }}
      style={({ pressed }) => [styles.iconButton, { backgroundColor, opacity: pressed ? 0.72 : 1 }]}
    >
      <Ionicons color={color} name={icon} size={20} />
    </Pressable>
  );
}

export function EmptyState({ text, icon = 'sparkles-outline' }: { text: string; icon?: ComponentProps<typeof Ionicons>['name'] }) {
  const theme = useAppTheme();
  return (
    <Card style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.accentSurface }]}>
        <Ionicons color={theme.accentSoft} name={icon} size={24} />
      </View>
      <Text style={[styles.emptyText, { color: theme.textMuted }]}>{text}</Text>
    </Card>
  );
}

export function LoadingView() {
  const theme = useAppTheme();
  return <ActivityIndicator color={theme.accent} size="small" style={styles.loading} />;
}

export function SectionHeader({ title, subtitle, count }: { title: string; subtitle?: string; count?: number }) {
  const theme = useAppTheme();
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionCopy}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.sectionSubtitle, { color: theme.textMuted }]}>{subtitle}</Text> : null}
      </View>
      {typeof count === 'number' ? (
        <View style={[styles.sectionCount, { backgroundColor: theme.surfaceRaised }]}>
          <Text style={[styles.sectionCountText, { color: theme.textSecondary }]}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function BackButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useAppTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.6 : 1 }]}>
      <Ionicons color={theme.accentSoft} name="chevron-back" size={20} />
      <Text style={[styles.backText, { color: theme.accentSoft }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 118, gap: 20 },
  contentFixed: { flex: 1 },
  screenHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  screenHeaderCopy: { flex: 1 },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.7, marginBottom: 8 },
  screenTitle: { fontSize: 32, fontWeight: '900', letterSpacing: -1.1, lineHeight: 37 },
  screenSubtitle: { fontSize: 14, lineHeight: 20, marginTop: 7 },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
  },
  input: { borderRadius: 17, borderWidth: 1, fontSize: 16, minHeight: 54, paddingHorizontal: 16, paddingVertical: 13 },
  inputFocused: { borderWidth: 1.5 },
  button: {
    minHeight: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 2,
  },
  buttonText: { fontSize: 14, fontWeight: '800', letterSpacing: 0.1 },
  iconButton: { alignItems: 'center', borderRadius: 15, height: 48, justifyContent: 'center', width: 48 },
  empty: { alignItems: 'center', paddingVertical: 30, gap: 11 },
  emptyIcon: { alignItems: 'center', borderRadius: 18, height: 52, justifyContent: 'center', width: 52 },
  emptyText: { textAlign: 'center', fontSize: 14, lineHeight: 20, maxWidth: 270 },
  loading: { paddingVertical: 36 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  sectionCopy: { flex: 1 },
  sectionTitle: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  sectionCount: { alignItems: 'center', borderRadius: 13, minWidth: 34, paddingHorizontal: 9, paddingVertical: 6 },
  sectionCountText: { fontSize: 12, fontWeight: '900' },
  backButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', minHeight: 40, paddingRight: 14 },
  backText: { fontSize: 14, fontWeight: '800' },
});
