import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Shield, Star, UserMinus, UserPlus } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useCrew } from '@/providers/CrewProvider';
import { CrewMember, JoinRequest } from '@/types';

export default function AdminSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    crew,
    members,
    joinRequests,
    approveJoinRequest,
    denyJoinRequest,
    removeMember,
    setMemberRole,
    updateCrewSettings,
    isAdmin,
    isOwner,
    isSubscriptionActive,
  } = useCrew();

  const [name, setName] = useState(crew?.name || '');
  const [description, setDescription] = useState(crew?.description || '');
  const [logoUrl, setLogoUrl] = useState(crew?.logoUrl || '');
  const [isDiscoverable, setIsDiscoverable] = useState(crew?.isDiscoverable ?? true);
  const [requiresApproval, setRequiresApproval] = useState(crew?.requiresApproval ?? true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!crew) return;
    setName(crew.name || '');
    setDescription(crew.description || '');
    setLogoUrl(crew.logoUrl || '');
    setIsDiscoverable(crew.isDiscoverable ?? true);
    setRequiresApproval(crew.requiresApproval ?? true);
  }, [crew]);

  const pendingRequests = useMemo(
    () => joinRequests.filter((request) => request.status === 'pending'),
    [joinRequests]
  );

  const pickLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setLogoUrl(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!crew) return;
    setIsSaving(true);
    try {
      await updateCrewSettings({
        name: name.trim() || crew.name,
        description: description.trim(),
        logoUrl,
        isDiscoverable,
        requiresApproval,
      });
      Alert.alert('Saved', 'Club settings updated.');
    } catch (error: any) {
      const message =
        error?.message === 'SUBSCRIPTION_INACTIVE'
          ? 'Subscription inactive. Renew to manage crew settings.'
          : 'Unable to save settings right now.';
      Alert.alert('Error', message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async (request: JoinRequest) => {
    try {
      await approveJoinRequest(request);
    } catch {
      Alert.alert('Error', 'Unable to approve this request right now.');
    }
  };

  const handleDeny = async (request: JoinRequest) => {
    try {
      await denyJoinRequest(request);
    } catch {
      Alert.alert('Error', 'Unable to deny this request right now.');
    }
  };

  const handleRemove = (member: CrewMember) => {
    Alert.alert('Remove Member', `Remove ${member.name} from the crew?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeMember(member.id);
          } catch (error: any) {
            const message =
              error?.message === 'OWNER_REMOVE_NOT_ALLOWED'
                ? 'You cannot remove the current owner.'
                : 'Unable to remove this member right now.';
            Alert.alert('Error', message);
          }
        },
      },
    ]);
  };

  const toggleOfficer = async (member: CrewMember) => {
    try {
      await setMemberRole(member.id, member.role === 'officer' ? 'member' : 'officer');
    } catch (error: any) {
      const message =
        error?.message === 'OWNER_ROLE_LOCKED'
          ? 'The owner role cannot be changed.'
          : 'Unable to update this member role.';
      Alert.alert('Error', message);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text style={styles.title}>Admin Settings</Text>
          <View style={styles.backButton} />
        </View>

        {!isOwner && !isSubscriptionActive && (
          <View style={styles.banner}>
            <Shield size={16} color={Colors.dark.warning} />
            <Text style={styles.bannerText}>
              Subscription inactive. Admin actions are locked until the club subscription is active.
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Join Requests</Text>
          {pendingRequests.length === 0 ? (
            <Text style={styles.emptyText}>No pending requests.</Text>
          ) : (
            pendingRequests.map((request) => (
              <View key={request.id} style={styles.requestRow}>
                <View style={styles.requestInfo}>
                  <Text style={styles.memberName}>{request.userName}</Text>
                  <Text style={styles.memberMeta}>{request.userEmail}</Text>
                </View>
                <View style={styles.rowActions}>
                  <Pressable style={styles.iconButton} onPress={() => handleApprove(request)}>
                    <UserPlus size={16} color={Colors.dark.text} />
                  </Pressable>
                  <Pressable style={styles.iconButton} onPress={() => handleDeny(request)}>
                    <UserMinus size={16} color={Colors.dark.text} />
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>

        {isAdmin && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Club Settings</Text>
            <Pressable style={styles.logoRow} onPress={pickLogo}>
              {logoUrl ? (
                <Image source={{ uri: logoUrl }} style={styles.logo} contentFit="cover" />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <Camera size={18} color={Colors.dark.text} />
                </View>
              )}
              <Text style={styles.logoText}>Change club logo</Text>
            </Pressable>

            <Text style={styles.label}>Club Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Club name"
              placeholderTextColor={Colors.dark.textTertiary}
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={description}
              onChangeText={setDescription}
              placeholder="Club description"
              placeholderTextColor={Colors.dark.textTertiary}
              multiline
            />

            <View style={styles.switchRow}>
              <Text style={styles.label}>Discoverable</Text>
              <Switch
                value={isDiscoverable}
                onValueChange={setIsDiscoverable}
                trackColor={{ false: Colors.dark.surfaceElevated, true: Colors.dark.primary }}
                thumbColor={Colors.dark.text}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.label}>Require Approval</Text>
              <Switch
                value={requiresApproval}
                onValueChange={setRequiresApproval}
                trackColor={{ false: Colors.dark.surfaceElevated, true: Colors.dark.primary }}
                thumbColor={Colors.dark.text}
              />
            </View>

            <Pressable style={styles.saveButton} onPress={handleSave} disabled={isSaving}>
              <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save Settings'}</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Members</Text>
          {members.map((member) => (
            <View key={member.id} style={styles.memberRow}>
              <View style={styles.requestInfo}>
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={styles.memberMeta}>{member.role}</Text>
              </View>
              {isAdmin && member.id !== crew?.ownerId ? (
                <View style={styles.rowActions}>
                  <Pressable style={styles.iconButton} onPress={() => toggleOfficer(member)}>
                    <Star size={16} color={Colors.dark.text} />
                  </Pressable>
                  <Pressable style={styles.iconButton} onPress={() => handleRemove(member)}>
                    <UserMinus size={16} color={Colors.dark.error} />
                  </Pressable>
                </View>
              ) : null}
            </View>
          ))}
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
  banner: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 16,
  },
  bannerText: {
    flex: 1,
    color: Colors.dark.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 16,
    gap: 12,
  },
  sectionTitle: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyText: {
    color: Colors.dark.textTertiary,
    fontSize: 14,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  requestInfo: {
    flex: 1,
    gap: 2,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 10,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.surfaceElevated,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  memberName: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '600',
  },
  memberMeta: {
    color: Colors.dark.textTertiary,
    fontSize: 13,
    textTransform: 'capitalize',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  logoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.dark.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '600',
  },
  label: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 12,
    backgroundColor: Colors.dark.surfaceElevated,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.dark.text,
    fontSize: 15,
  },
  inputMultiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  saveButton: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    color: Colors.dark.background,
    fontSize: 15,
    fontWeight: '700',
  },
});
