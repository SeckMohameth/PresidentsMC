import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, Alert, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { ArrowLeft, Search, Shield, Star, Users } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useCrew } from '@/providers/CrewProvider';
import MemberRow from '@/components/MemberRow';
import { CrewMember } from '@/types';

export default function MembersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { members, crew, isAdmin, currentUser, removeMember, setMemberRole } = useCrew();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'admin' | 'officer' | 'member'>('all');
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const filteredMembers = useMemo(() => {
    let result = members;
    
    if (search.trim()) {
      const query = search.toLowerCase();
      result = result.filter(m => m.name.toLowerCase().includes(query));
    }
    
    if (filter !== 'all') {
      result = result.filter(m => m.role === filter);
    }
    
    return result.sort((a, b) => {
      const roleOrder = { admin: 0, officer: 1, member: 2 };
      return roleOrder[a.role] - roleOrder[b.role];
    });
  }, [members, search, filter]);

  const stats = useMemo(() => ({
    admins: members.filter(m => m.role === 'admin').length,
    officers: members.filter(m => m.role === 'officer').length,
    members: members.filter(m => m.role === 'member').length,
  }), [members]);

  const handleRemoveMember = (member: CrewMember) => {
    if (member.id === currentUser?.id) return;
    if (member.role === 'admin') {
      Alert.alert('Cannot Remove', 'You cannot remove another admin.');
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
      showRemove={isAdmin && item.id !== currentUser?.id && item.role !== 'admin'}
      onRemove={() => handleRemoveMember(item)}
      onPress={isAdmin ? () => handleRoleChange(item) : undefined}
    />
  );

  const handleRoleChange = (member: CrewMember) => {
    if (!isAdmin) return;
    if (member.role === 'admin') {
      Alert.alert('Role Locked', 'Admins cannot be changed here.');
      return;
    }
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
      member.role !== 'officer'
        ? { text: 'Make Officer', onPress: () => handleUpdateRole('officer') }
        : { text: 'Set as Member', onPress: () => handleUpdateRole('member') },
      { text: 'Cancel', style: 'cancel' as const },
    ];

    Alert.alert('Change Role', `Update ${member.name}'s role`, actions);
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
              All ({members.length})
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
            <Text style={styles.crewMeta}>{members.length} members</Text>
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
        contentContainerStyle={[styles.listContent, isTablet && styles.listContentTablet]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No members found</Text>
          </View>
        }
      />
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
});
