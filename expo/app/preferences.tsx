import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Settings } from 'lucide-react-native';
import { AppColors, useThemeColors } from '@/constants/colors';

export default function PreferencesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const openSystemSettings = async () => {
    await Linking.openSettings();
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text style={styles.title}>Preferences</Text>
          <View style={styles.backButton} />
        </View>

        <View style={styles.card}>
          <Pressable style={styles.row} onPress={openSystemSettings}>
            <View style={styles.rowLeft}>
              <Settings size={18} color={colors.primary} />
              <Text style={styles.label}>Open System Settings</Text>
            </View>
            <Text style={styles.link}>Open</Text>
          </Pressable>
          <Text style={styles.hint}>
            Manage system-level permissions like notifications, location, and camera access.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    width: 60,
  },
  backText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  label: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  link: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  hint: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 8,
  },
});
