import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
  FlatList,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Search } from 'lucide-react-native';
import { httpsCallable } from 'firebase/functions';
import Colors from '@/constants/colors';
import { ImageAttribution } from '@/types';
import { functions } from '@/utils/firebase';

type UnsplashPhoto = {
  id: string;
  urls: { small: string; regular: string };
  user: { name: string; username: string; links?: { html?: string } };
  links: { html?: string };
};

export type UnsplashSelection = {
  url: string;
  attribution: ImageAttribution;
};

interface UnsplashPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (selection: UnsplashSelection) => void;
  title?: string;
}

const ACCESS_KEY = process.env.EXPO_PUBLIC_UNSPLASH_ACCESS_KEY;
const USE_FUNCTIONS = process.env.EXPO_PUBLIC_UNSPLASH_USE_FUNCTIONS === 'true';

export default function UnsplashPicker({
  visible,
  onClose,
  onSelect,
  title = 'Search Unsplash',
}: UnsplashPickerProps) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UnsplashPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSearch = useMemo(() => query.trim().length >= 2, [query]);

  const searchViaFunction = async (searchQuery: string) => {
    const callable = httpsCallable(functions, 'unsplashSearch');
    const response = await callable({ query: searchQuery, perPage: 30 });
    const data = response.data as { results: UnsplashPhoto[] };
    return data.results || [];
  };

  const searchViaDirect = async (searchQuery: string) => {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
      searchQuery
    )}&per_page=30&client_id=${ACCESS_KEY}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Unsplash request failed');
    const data = await res.json();
    return data.results || [];
  };

  const runSearch = useCallback(async () => {
    if (!canSearch) return;
    setIsLoading(true);
    setError(null);
    try {
      let photos: UnsplashPhoto[] = [];
      if (USE_FUNCTIONS) {
        try {
          photos = await searchViaFunction(query.trim());
        } catch (error) {
          if (ACCESS_KEY) {
            photos = await searchViaDirect(query.trim());
          } else {
            throw error;
          }
        }
      } else if (ACCESS_KEY) {
        photos = await searchViaDirect(query.trim());
      } else {
        // Try function first, fall back to showing error
        try {
          photos = await searchViaFunction(query.trim());
        } catch {
          Alert.alert('Setup Needed', 'Add EXPO_PUBLIC_UNSPLASH_ACCESS_KEY to your environment variables or set EXPO_PUBLIC_UNSPLASH_USE_FUNCTIONS=true.');
          return;
        }
      }
      setResults(photos);
    } catch {
      setError('Unable to fetch images. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [canSearch, query]);

  const handleSelect = useCallback(
    (photo: UnsplashPhoto) => {
      const attribution: ImageAttribution = {
        source: 'unsplash',
        name: photo.user.name,
        username: photo.user.username,
        link: photo.links?.html || photo.user.links?.html || '',
      };
      onSelect({ url: photo.urls.regular, attribution });
    },
    [onSelect]
  );

  const renderItem = ({ item }: { item: UnsplashPhoto }) => (
    <Pressable style={styles.photoItem} onPress={() => handleSelect(item)}>
      <Image source={{ uri: item.urls.small }} style={styles.photoImage} contentFit="cover" />
    </Pressable>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} style={styles.closeButton} hitSlop={8}>
            <X size={22} color={Colors.dark.text} />
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <Search size={18} color={Colors.dark.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search photos..."
            placeholderTextColor={Colors.dark.textTertiary}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={runSearch}
          />
          <Pressable
            style={[styles.searchButton, !canSearch && styles.searchButtonDisabled]}
            onPress={runSearch}
            disabled={!canSearch || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.dark.text} />
            ) : (
              <Text style={styles.searchButtonText}>Search</Text>
            )}
          </Pressable>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          numColumns={3}
          contentContainerStyle={styles.gridContent}
          ListEmptyComponent={
            !isLoading ? (
              <Text style={styles.emptyText}>
                {canSearch ? 'No results yet. Try another search.' : 'Search for a photo to get started.'}
              </Text>
            ) : null
          }
        />

        <Text style={styles.attributionNote}>
          Photos are provided by Unsplash. Attribution data is saved with your selection.
        </Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    color: Colors.dark.text,
    backgroundColor: Colors.dark.surface,
  },
  searchButton: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  searchButtonText: {
    color: Colors.dark.text,
    fontWeight: '600',
  },
  gridContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  photoItem: {
    flex: 1 / 3,
    aspectRatio: 1,
    margin: 4,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: Colors.dark.surface,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  emptyText: {
    color: Colors.dark.textTertiary,
    textAlign: 'center',
    padding: 24,
  },
  attributionNote: {
    color: Colors.dark.textTertiary,
    textAlign: 'center',
    paddingVertical: 10,
    fontSize: 12,
  },
  errorText: {
    color: Colors.dark.error,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
});
