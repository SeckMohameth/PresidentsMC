import React from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { useAuth } from '@/providers/AuthProvider';
import { UserPreferences } from '@/types';

const DEFAULT_PREFS: UserPreferences = {
  pushEnabled: true,
  announcements: true,
  rides: true,
  joinRequests: true,
};

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, updatePreferences } = useAuth();
  const prefs = { ...DEFAULT_PREFS, ...(user?.preferences || {}) };

  const handleToggle = (key: keyof UserPreferences, value: boolean) => {
    if (!user?.id) return;
    updatePreferences({ [key]: value } as Partial<UserPreferences>);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text style={styles.title}>Notifications</Text>
          <View style={styles.backButton} />
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Push Notifications</Text>
            <Switch
              value={prefs.pushEnabled}
              onValueChange={(value) => handleToggle('pushEnabled', value)}
              trackColor={{ false: Colors.dark.surfaceElevated, true: Colors.dark.primary }}
              thumbColor={Colors.dark.text}
            />
          </View>
          <Text style={styles.hint}>
            Turn off to pause all push notifications for this device.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Announcements</Text>
            <Switch
              value={prefs.announcements}
              onValueChange={(value) => handleToggle('announcements', value)}
              trackColor={{ false: Colors.dark.surfaceElevated, true: Colors.dark.primary }}
              thumbColor={Colors.dark.text}
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Ride Updates</Text>
            <Switch
              value={prefs.rides}
              onValueChange={(value) => handleToggle('rides', value)}
              trackColor={{ false: Colors.dark.surfaceElevated, true: Colors.dark.primary }}
              thumbColor={Colors.dark.text}
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Join Requests</Text>
            <Switch
              value={prefs.joinRequests}
              onValueChange={(value) => handleToggle('joinRequests', value)}
              trackColor={{ false: Colors.dark.surfaceElevated, true: Colors.dark.primary }}
              thumbColor={Colors.dark.text}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
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
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.dark.text,
  },
  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  label: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '600',
  },
  hint: {
    color: Colors.dark.textTertiary,
    fontSize: 12,
    marginTop: 6,
  },
});
