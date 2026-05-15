import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Shield, Star, ChevronRight, UserMinus } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { CrewMember } from '@/types';
import { getInitials, formatMiles } from '@/utils/helpers';

interface MemberRowProps {
  member: CrewMember;
  onPress?: () => void;
  showStats?: boolean;
  showRemove?: boolean;
  onRemove?: () => void;
}

export default function MemberRow({ member, onPress, showStats = true, showRemove, onRemove }: MemberRowProps) {
  const getRoleIcon = () => {
    if (member.role === 'admin') {
      return <Shield size={14} color={Colors.dark.primary} />;
    }
    if (member.role === 'officer') {
      return <Star size={14} color={Colors.dark.warning} />;
    }
    return null;
  };

  const getRoleLabel = () => {
    if (member.role === 'admin') return 'Admin';
    if (member.role === 'officer') return 'Officer';
    return 'Member';
  };

  return (
    <Pressable 
      style={({ pressed }) => [styles.container, pressed && onPress && styles.pressed]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.avatarContainer}>
        {member.avatar ? (
          <Image 
            source={{ uri: member.avatar }} 
            style={styles.avatar}
            contentFit="cover"
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitials}>{getInitials(member.name)}</Text>
          </View>
        )}
        {member.role !== 'member' && (
          <View style={styles.roleIconContainer}>
            {getRoleIcon()}
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{member.name}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.role}>{getRoleLabel()}</Text>
          {showStats && (
            <>
              <View style={styles.dot} />
              <Text style={styles.stats}>
                {member.ridesAttended} rides • {formatMiles(member.milesTraveled)} mi
              </Text>
            </>
          )}
        </View>
      </View>
      {showRemove && onRemove && (
        <Pressable style={styles.removeButton} onPress={onRemove}>
          <UserMinus size={18} color={Colors.dark.error} />
        </Pressable>
      )}
      {onPress && <ChevronRight size={20} color={Colors.dark.textTertiary} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.dark.surface,
  },
  pressed: {
    backgroundColor: Colors.dark.surfaceElevated,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.dark.surfaceElevated,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: '700',
  },
  roleIconContainer: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    padding: 3,
  },
  info: {
    flex: 1,
  },
  name: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  role: {
    color: Colors.dark.textTertiary,
    fontSize: 13,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.dark.textTertiary,
    marginHorizontal: 8,
  },
  stats: {
    color: Colors.dark.textTertiary,
    fontSize: 13,
  },
  removeButton: {
    padding: 8,
    marginLeft: 8,
  },
});
