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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { ArrowLeft, Crown, Edit3, Search, Shield, Star, UserRound, Users, X } from 'lucide-react-native';
import Colors from '@/constants/colors';
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
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

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
  };

  const saveLeadershipTitle = async () => {
    if (!editingMember) return;
    setIsSavingTitle(true);
    try {
      await setMemberLeadership(editingMember.id, { leadershipTitle: titleDraft.trim() });
      setEditingMember(null);
      setTitleDraft('');
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
      { text: 'Edit Club Title', onPress: () => openTitleEditor(member) },
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

    Alert.alert('Manage Member', `Update ${member.name}'s role or club title.`, actions);
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
          <Crown size={20} color={Colors.dark.primary} />
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
                  <Shield size={16} color={Colors.dark.primary} />
                ) : member.role === 'officer' ? (
                  <Star size={16} color={Colors.dark.warning} />
                ) : (
                  <UserRound size={16} color={Colors.dark.textTertiary} />
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
            <ArrowLeft size={24} color={Colors.dark.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Members</Text>
          <View style={{ width: 40 }} />
        </View>
        
        <View style={styles.searchContainer}>
          <Search size={18} color={Colors.dark.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search members..."
            placeholderTextColor={Colors.dark.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <View style={styles.filters}>
          <Pressable 
            style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
            onPress={() => setFilter('all')}
          >
            <Users size={14} color={filter === 'all' ? Colors.dark.text : Colors.dark.textTertiary} />
            <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
              All ({visibleMembers.length})
            </Text>
          </Pressable>
          <Pressable 
            style={[styles.filterChip, filter === 'admin' && styles.filterChipActive]}
            onPress={() => setFilter('admin')}
          >
            <Shield size={14} color={filter === 'admin' ? Colors.dark.text : Colors.dark.primary} />
            <Text style={[styles.filterText, filter === 'admin' && styles.filterTextActive]}>
              Admins ({stats.admins})
            </Text>
          </Pressable>
          <Pressable 
            style={[styles.filterChip, filter === 'officer' && styles.filterChipActive]}
            onPress={() => setFilter('officer')}
          >
            <Star size={14} color={filter === 'officer' ? Colors.dark.text : Colors.dark.warning} />
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
                <Text style={styles.modalTitle}>Club Title</Text>
                <Text style={styles.modalSubtitle}>{editingMember?.name}</Text>
              </View>
              <Pressable style={styles.modalClose} onPress={() => setEditingMember(null)}>
                <X size={20} color={Colors.dark.text} />
              </Pressable>
            </View>

            <TextInput
              style={styles.titleInput}
              value={titleDraft}
              onChangeText={setTitleDraft}
              placeholder="President, Road Captain, Treasurer..."
              placeholderTextColor={Colors.dark.textTertiary}
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
                <Edit3 size={16} color={Colors.dark.background} />
                <Text style={styles.saveTitleText}>{isSavingTitle ? 'Saving...' : 'Save Title'}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
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
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 10,
    color: Colors.dark.text,
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
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
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
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  crewLogoText: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: '700' as const,
  },
  crewInfo: {
    flex: 1,
  },
  crewName: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '700',
  },
  crewMeta: {
    color: Colors.dark.textTertiary,
    fontSize: 12,
    marginTop: 2,
  },
  roleStats: {
    alignItems: 'flex-end',
  },
  roleStatText: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  filterChipActive: {
    backgroundColor: Colors.dark.primary,
    borderColor: Colors.dark.primary,
  },
  filterText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  filterTextActive: {
    color: Colors.dark.text,
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
    backgroundColor: Colors.dark.border,
    marginLeft: 76,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.dark.textTertiary,
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
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '800',
  },
  hierarchySubtitle: {
    color: Colors.dark.textTertiary,
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
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.borderLight,
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
    color: Colors.dark.textTertiary,
    fontSize: 12,
    fontWeight: '700',
  },
  hierarchyName: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '800',
  },
  hierarchyRole: {
    color: Colors.dark.primary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  hierarchyType: {
    color: Colors.dark.textTertiary,
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
    alignSelf: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.borderLight,
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: Colors.dark.textTertiary,
    fontSize: 13,
    marginTop: 2,
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.surfaceElevated,
  },
  titleInput: {
    color: Colors.dark.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.background,
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
    backgroundColor: Colors.dark.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  suggestionText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontWeight: '600',
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
    borderColor: Colors.dark.borderLight,
    paddingVertical: 13,
  },
  clearTitleText: {
    color: Colors.dark.textSecondary,
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
    backgroundColor: Colors.dark.primary,
    paddingVertical: 13,
  },
  saveTitleDisabled: {
    opacity: 0.65,
  },
  saveTitleText: {
    color: Colors.dark.background,
    fontSize: 14,
    fontWeight: '800',
  },
});
