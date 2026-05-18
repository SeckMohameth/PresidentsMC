import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Alert,
  useWindowDimensions,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { ArrowLeft, Crown, Edit3, Search, Shield, Star, UserRound, Users, X } from 'lucide-react-native';
import { AppColors, useThemeColors } from '@/constants/colors';
import { useCrew } from '@/providers/CrewProvider';
import MemberRow from '@/components/MemberRow';
import { CrewMember } from '@/types';

const ROLE_LABELS: Record<CrewMember['role'], string> = {
  admin: 'Admin',
  officer: 'Officer',
  member: 'Member',
};

const TITLE_SUGGESTIONS = [
  'President',
  'Vice President',
  'Sergeant at Arms',
  'Road Captain',
  'Treasurer',
  'Secretary',
  'Prospect',
];

function memberDisplayTitle(member: CrewMember) {
  return member.leadershipTitle || ROLE_LABELS[member.role];
}

function roleRank(member: CrewMember) {
  const title = member.leadershipTitle?.toLowerCase() || '';
  if (title.includes('president') && !title.includes('vice')) return 0;
  if (title.includes('vice')) return 1;
  if (member.role === 'admin') return 2;
  if (member.role === 'officer') return 3;
  return 4;
}

export default function MembersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { members, crew, isAdmin, currentUser, removeMember, setMemberRole, setMemberLeadership } = useCrew();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'admin' | 'officer' | 'member'>('all');
  const [editingMember, setEditingMember] = useState<CrewMember | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [permissionsDraft, setPermissionsDraft] = useState<NonNullable<CrewMember['permissions']>>({});
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const visibleMembers = useMemo(
    () => members.filter((member) => !member.isDeveloperSupport),
    [members]
  );

  const filteredMembers = useMemo(() => {
    let result = visibleMembers;
    
    if (search.trim()) {
      const query = search.toLowerCase();
      result = result.filter(m =>
        m.name.toLowerCase().includes(query) ||
        memberDisplayTitle(m).toLowerCase().includes(query) ||
        m.bike?.toLowerCase().includes(query)
      );
    }
    
    if (filter !== 'all') {
      result = result.filter(m => m.role === filter);
    }
    
    return [...result].sort((a, b) => {
      const rankDiff = roleRank(a) - roleRank(b);
      if (rankDiff !== 0) return rankDiff;
      return a.name.localeCompare(b.name);
    });
  }, [visibleMembers, search, filter]);

  const hierarchyMembers = useMemo(
    () => visibleMembers.filter((member) => member.role !== 'member' || !!member.leadershipTitle).sort((a, b) => {
      const rankDiff = roleRank(a) - roleRank(b);
      if (rankDiff !== 0) return rankDiff;
      return a.name.localeCompare(b.name);
    }),
    [visibleMembers]
  );

  const stats = useMemo(() => ({
    admins: visibleMembers.filter(m => m.role === 'admin').length,
    officers: visibleMembers.filter(m => m.role === 'officer').length,
    members: visibleMembers.filter(m => m.role === 'member').length,
  }), [visibleMembers]);

  const handleRemoveMember = (member: CrewMember) => {
    if (member.id === currentUser?.id) return;
    if (crew?.ownerId === member.id) {
      Alert.alert('Cannot Remove', 'The club owner cannot be removed.');
      return;
    }
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${member.name} from the crew?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeMember(member.id);
              Alert.alert('Removed', `${member.name} has been removed from the crew.`);
            } catch {
              Alert.alert('Error', 'Failed to remove member. Please try again.');
            }
          },
        },
      ]
    );
  };

  const renderMember = ({ item }: { item: CrewMember }) => (
    <MemberRow
      member={item}
      showRemove={isAdmin && item.id !== currentUser?.id && item.id !== crew?.ownerId}
      onRemove={() => handleRemoveMember(item)}
      onPress={isAdmin ? () => handleRoleChange(item) : undefined}
    />
  );

  const openTitleEditor = (member: CrewMember) => {
    setEditingMember(member);
    setTitleDraft(member.leadershipTitle || '');
    setPermissionsDraft(member.permissions || {});
  };

  const saveLeadershipTitle = async () => {
    if (!editingMember) return;
    setIsSavingTitle(true);
    try {
      await setMemberLeadership(editingMember.id, {
        leadershipTitle: titleDraft.trim(),
        permissions: {
          manageRides: permissionsDraft.manageRides === true,
          manageAnnouncements: permissionsDraft.manageAnnouncements === true,
          manageAlbums: permissionsDraft.manageAlbums === true,
          manageJoinRequests: permissionsDraft.manageJoinRequests === true,
        },
      });
      setEditingMember(null);
      setTitleDraft('');
      setPermissionsDraft({});
    } catch {
      Alert.alert('Error', 'Unable to update this title. Please try again.');
    } finally {
      setIsSavingTitle(false);
    }
  };

  const handleRoleChange = (member: CrewMember) => {
    if (!isAdmin) return;
    if (member.id === currentUser?.id) {
      Alert.alert('Not Allowed', 'You cannot change your own role here.');
      return;
    }

    const handleUpdateRole = async (role: CrewMember['role']) => {
      try {
        await setMemberRole(member.id, role);
      } catch {
        Alert.alert('Error', 'Unable to update role. Please try again.');
      }
    };

    const actions = [
      { text: 'Edit Title & Permissions', onPress: () => openTitleEditor(member) },
      member.role !== 'admin'
        ? { text: 'Make Admin', onPress: () => handleUpdateRole('admin') }
        : { text: 'Keep as Admin', style: 'default' as const },
      member.role !== 'officer'
        ? { text: 'Make Officer', onPress: () => handleUpdateRole('officer') }
        : { text: 'Keep as Officer', style: 'default' as const },
      member.role !== 'member'
        ? { text: 'Set as Member', onPress: () => handleUpdateRole('member') }
        : { text: 'Keep as Member', style: 'default' as const },
      { text: 'Cancel', style: 'cancel' as const },
    ];

    Alert.alert('Manage Member', `Update ${member.name}'s role, club title, or permissions.`, actions);
  };

  const ListHeader = () => {
    if (hierarchyMembers.length === 0) return null;
    return (
      <View style={[styles.hierarchySection, isTablet && styles.hierarchySectionTablet]}>
        <View style={styles.hierarchyHeader}>
          <View>
            <Text style={styles.hierarchyTitle}>Chain of Command</Text>
            <Text style={styles.hierarchySubtitle}>Club titles and leadership roles</Text>
          </View>
          <Crown size={20} color={colors.primary} />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.hierarchyScroller}
        >
          {hierarchyMembers.map((member, index) => (
            <Pressable
              key={member.id}
              style={styles.hierarchyCard}
              onPress={isAdmin ? () => handleRoleChange(member) : undefined}
              disabled={!isAdmin}
            >
              <View style={styles.hierarchyTopRow}>
                <Text style={styles.hierarchyRank}>{String(index + 1).padStart(2, '0')}</Text>
                {member.role === 'admin' ? (
                  <Shield size={16} color={colors.primary} />
                ) : member.role === 'officer' ? (
                  <Star size={16} color={colors.warning} />
                ) : (
                  <UserRound size={16} color={colors.textTertiary} />
                )}
              </View>
              <Text style={styles.hierarchyName} numberOfLines={1}>{member.name}</Text>
              <Text style={styles.hierarchyRole} numberOfLines={1}>{memberDisplayTitle(member)}</Text>
              <Text style={styles.hierarchyType}>{ROLE_LABELS[member.role]}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTop}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Members</Text>
          <View style={{ width: 40 }} />
        </View>
        
        <View style={styles.searchContainer}>
          <Search size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search members..."
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <View style={styles.filters}>
          <Pressable 
            style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
            onPress={() => setFilter('all')}
          >
            <Users size={14} color={filter === 'all' ? colors.text : colors.textTertiary} />
            <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
              All ({visibleMembers.length})
            </Text>
          </Pressable>
          <Pressable 
            style={[styles.filterChip, filter === 'admin' && styles.filterChipActive]}
            onPress={() => setFilter('admin')}
          >
            <Shield size={14} color={filter === 'admin' ? colors.text : colors.primary} />
            <Text style={[styles.filterText, filter === 'admin' && styles.filterTextActive]}>
              Admins ({stats.admins})
            </Text>
          </Pressable>
          <Pressable 
            style={[styles.filterChip, filter === 'officer' && styles.filterChipActive]}
            onPress={() => setFilter('officer')}
          >
            <Star size={14} color={filter === 'officer' ? colors.text : colors.warning} />
            <Text style={[styles.filterText, filter === 'officer' && styles.filterTextActive]}>
              Officers ({stats.officers})
            </Text>
          </Pressable>
        </View>

        <View style={styles.crewOverview}>
          {crew?.logoUrl ? (
            <Image source={{ uri: crew.logoUrl }} style={styles.crewLogo} contentFit="cover" />
          ) : (
            <View style={styles.crewLogoPlaceholder}>
              <Text style={styles.crewLogoText}>{crew?.name?.charAt(0) || 'C'}</Text>
            </View>
          )}
          <View style={styles.crewInfo}>
            <Text style={styles.crewName}>{crew?.name}</Text>
            <Text style={styles.crewMeta}>{visibleMembers.length} members</Text>
          </View>
          <View style={styles.roleStats}>
            <Text style={styles.roleStatText}>{stats.admins} Admin</Text>
            <Text style={styles.roleStatText}>{stats.officers} Officer</Text>
            <Text style={styles.roleStatText}>{stats.members} Member</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={filteredMembers}
        renderItem={renderMember}
        keyExtractor={item => item.id}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={[styles.listContent, isTablet && styles.listContentTablet]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No members found</Text>
          </View>
        }
      />

      <Modal
        visible={!!editingMember}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingMember(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Title & Permissions</Text>
                <Text style={styles.modalSubtitle}>{editingMember?.name}</Text>
              </View>
              <Pressable style={styles.modalClose} onPress={() => setEditingMember(null)}>
                <X size={20} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <TextInput
                style={styles.titleInput}
                value={titleDraft}
                onChangeText={setTitleDraft}
                placeholder="President, Road Captain, Treasurer..."
                placeholderTextColor={colors.textTertiary}
                maxLength={48}
                autoCapitalize="words"
              />

              <View style={styles.suggestionWrap}>
                {TITLE_SUGGESTIONS.map((title) => (
                  <Pressable
                    key={title}
                    style={styles.suggestionChip}
                    onPress={() => setTitleDraft(title)}
                  >
                    <Text style={styles.suggestionText}>{title}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.permissionSection}>
                <Text style={styles.permissionTitle}>Permissions</Text>
                <View style={styles.permissionRow}>
                  <View style={styles.permissionCopy}>
                    <Text style={styles.permissionLabel}>Manage rides</Text>
                    <Text style={styles.permissionHint}>Create, edit, cancel, and reopen rides.</Text>
                  </View>
                  <Switch
                    value={permissionsDraft.manageRides === true}
                    onValueChange={(value) =>
                      setPermissionsDraft((current) => ({ ...current, manageRides: value }))
                    }
                    trackColor={{ false: colors.surfaceElevated, true: colors.primary }}
                    thumbColor={colors.text}
                  />
                </View>
                <View style={styles.permissionRow}>
                  <View style={styles.permissionCopy}>
                    <Text style={styles.permissionLabel}>Post announcements</Text>
                    <Text style={styles.permissionHint}>Create, edit, pin, and remove announcements.</Text>
                  </View>
                  <Switch
                    value={permissionsDraft.manageAnnouncements === true}
                    onValueChange={(value) =>
                      setPermissionsDraft((current) => ({ ...current, manageAnnouncements: value }))
                    }
                    trackColor={{ false: colors.surfaceElevated, true: colors.primary }}
                    thumbColor={colors.text}
                  />
                </View>
                <View style={styles.permissionRow}>
                  <View style={styles.permissionCopy}>
                    <Text style={styles.permissionLabel}>Manage albums</Text>
                    <Text style={styles.permissionHint}>Create standalone club albums.</Text>
                  </View>
                  <Switch
                    value={permissionsDraft.manageAlbums === true}
                    onValueChange={(value) =>
                      setPermissionsDraft((current) => ({ ...current, manageAlbums: value }))
                    }
                    trackColor={{ false: colors.surfaceElevated, true: colors.primary }}
                    thumbColor={colors.text}
                  />
                </View>
                <View style={styles.permissionRow}>
                  <View style={styles.permissionCopy}>
                    <Text style={styles.permissionLabel}>Review join requests</Text>
                    <Text style={styles.permissionHint}>Approve or reject pending members.</Text>
                  </View>
                  <Switch
                    value={permissionsDraft.manageJoinRequests === true}
                    onValueChange={(value) =>
                      setPermissionsDraft((current) => ({ ...current, manageJoinRequests: value }))
                    }
                    trackColor={{ false: colors.surfaceElevated, true: colors.primary }}
                    thumbColor={colors.text}
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.clearTitleButton}
                onPress={() => setTitleDraft('')}
              >
                <Text style={styles.clearTitleText}>Clear</Text>
              </Pressable>
              <Pressable
                style={[styles.saveTitleButton, isSavingTitle && styles.saveTitleDisabled]}
                onPress={saveLeadershipTitle}
                disabled={isSavingTitle}
              >
                <Edit3 size={16} color={colors.background} />
                <Text style={styles.saveTitleText}>{isSavingTitle ? 'Saving...' : 'Save Changes'}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 10,
    color: colors.text,
    fontSize: 15,
  },
  filters: {
    flexDirection: 'row',
    gap: 8,
  },
  crewOverview: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  crewLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  crewLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  crewLogoText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700' as const,
  },
  crewInfo: {
    flex: 1,
  },
  crewName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  crewMeta: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 2,
  },
  roleStats: {
    alignItems: 'flex-end',
  },
  roleStatText: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  filterTextActive: {
    color: colors.text,
  },
  listContent: {
    paddingVertical: 8,
  },
  listContentTablet: {
    maxWidth: 840,
    alignSelf: 'center',
    width: '100%',
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 76,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textTertiary,
    fontSize: 15,
  },
  hierarchySection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  hierarchySectionTablet: {
    paddingHorizontal: 0,
  },
  hierarchyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  hierarchyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  hierarchySubtitle: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 2,
  },
  hierarchyScroller: {
    gap: 10,
    paddingRight: 16,
  },
  hierarchyCard: {
    width: 156,
    minHeight: 116,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 8,
    padding: 12,
  },
  hierarchyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  hierarchyRank: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '700',
  },
  hierarchyName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  hierarchyRole: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  hierarchyType: {
    color: colors.textTertiary,
    fontSize: 11,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '86%',
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: colors.textTertiary,
    fontSize: 13,
    marginTop: 2,
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  modalScroll: {
    flexGrow: 0,
  },
  titleInput: {
    color: colors.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  suggestionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  permissionSection: {
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 14,
    gap: 12,
  },
  permissionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  permissionCopy: {
    flex: 1,
  },
  permissionLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  permissionHint: {
    color: colors.textTertiary,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 18,
  },
  clearTitleButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingVertical: 13,
  },
  clearTitleText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  saveTitleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 8,
    backgroundColor: colors.primary,
    paddingVertical: 13,
  },
  saveTitleDisabled: {
    opacity: 0.65,
  },
  saveTitleText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '800',
  },
});
