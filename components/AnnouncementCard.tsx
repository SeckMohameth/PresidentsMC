import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Linking } from 'react-native';
import { Image } from 'expo-image';
import { Heart, Pin, Shield, Star, Pencil, X, Link as LinkIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { Announcement } from '@/types';
import { useAuth } from '@/providers/AuthProvider';
import { formatRelativeTime, getInitials } from '@/utils/helpers';

interface AnnouncementCardProps {
  announcement: Announcement;
  onEdit?: () => void;
  onToggleLike?: () => void;
}

export default function AnnouncementCard({ announcement, onEdit, onToggleLike }: AnnouncementCardProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [isImageOpen, setIsImageOpen] = useState(false);
  const [isOpeningLink, setIsOpeningLink] = useState(false);
  const likedBy = announcement.likedBy || [];
  const hasLiked = !!user?.id && likedBy.includes(user.id);

  const getRoleBadge = () => {
    if (announcement.authorRole === 'admin') {
      return (
        <View style={[styles.badge, styles.adminBadge]}>
          <Shield size={10} color={Colors.dark.primary} />
          <Text style={styles.badgeText}>Admin</Text>
        </View>
      );
    }
    if (announcement.authorRole === 'officer') {
      return (
        <View style={[styles.badge, styles.officerBadge]}>
          <Star size={10} color={Colors.dark.warning} />
          <Text style={[styles.badgeText, { color: Colors.dark.warning }]}>Officer</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <Pressable style={({ pressed }) => [styles.container, pressed && styles.pressed]}>
      {announcement.isPinned && (
        <View style={styles.pinnedBanner}>
          <Pin size={12} color={Colors.dark.primary} />
          <Text style={styles.pinnedText}>Pinned</Text>
        </View>
      )}
      {onEdit && (
        <Pressable style={styles.editButton} onPress={onEdit} hitSlop={6}>
          <Pencil size={16} color={Colors.dark.textSecondary} />
        </Pressable>
      )}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          {announcement.authorAvatar ? (
            <Image 
              source={{ uri: announcement.authorAvatar }} 
              style={styles.avatar}
              contentFit="cover"
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitials}>
                {getInitials(announcement.authorName)}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.headerInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.authorName}>{announcement.authorName}</Text>
            {getRoleBadge()}
          </View>
          <Text style={styles.timestamp}>{formatRelativeTime(announcement.createdAt)}</Text>
        </View>
      </View>
      <Text style={styles.title}>{announcement.title}</Text>
      <Text style={styles.content}>{announcement.content}</Text>
      {announcement.link ? (
        <Pressable
          style={styles.linkRow}
          onPress={async () => {
            if (isOpeningLink) return;
            setIsOpeningLink(true);
            try {
              await Linking.openURL(announcement.link as string);
            } finally {
              setIsOpeningLink(false);
            }
          }}
        >
          <LinkIcon size={14} color={Colors.dark.primary} />
          <Text style={styles.linkText} numberOfLines={1}>{announcement.link}</Text>
        </Pressable>
      ) : null}
      {announcement.imageUrl && (
        <View style={styles.imageContainer}>
          <Pressable onPress={() => setIsImageOpen(true)}>
            <Image 
              source={{ uri: announcement.imageUrl }}
              style={styles.announcementImage}
              contentFit="cover"
            />
          </Pressable>
        </View>
      )}
      <View style={styles.footer}>
        <Pressable
          style={[styles.likeButton, hasLiked && styles.likeButtonActive]}
          onPress={onToggleLike}
          disabled={!onToggleLike}
          hitSlop={8}
        >
          <Heart
            size={16}
            color={hasLiked ? Colors.dark.primary : Colors.dark.textSecondary}
            fill={hasLiked ? Colors.dark.primary : 'transparent'}
          />
          <Text style={[styles.likeText, hasLiked && styles.likeTextActive]}>
            {likedBy.length}
          </Text>
        </Pressable>
      </View>

      <Modal visible={isImageOpen} transparent animationType="fade" onRequestClose={() => setIsImageOpen(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={[styles.modalClose, { top: insets.top + 12, right: insets.right + 12 }]} onPress={() => setIsImageOpen(false)}>
            <X size={22} color={Colors.dark.text} />
          </Pressable>
          <View style={[styles.modalContent, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
            <Image source={{ uri: announcement.imageUrl }} style={styles.modalImage} contentFit="contain" />
          </View>
        </View>
      </Modal>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 720,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  pinnedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  editButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  pinnedText: {
    color: Colors.dark.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.dark.surfaceElevated,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '700',
  },
  headerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  authorName: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '600',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  adminBadge: {
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
  },
  officerBadge: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
  },
  badgeText: {
    color: Colors.dark.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  timestamp: {
    color: Colors.dark.textTertiary,
    fontSize: 13,
    marginTop: 2,
  },
  title: {
    color: Colors.dark.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
    lineHeight: 22,
  },
  content: {
    color: Colors.dark.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  linkText: {
    color: Colors.dark.primary,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  imageContainer: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  announcementImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  footer: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeButton: {
    minWidth: 54,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  likeButtonActive: {
    borderColor: 'rgba(249, 115, 22, 0.35)',
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
  },
  likeText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  likeTextActive: {
    color: Colors.dark.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  modalClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
});
