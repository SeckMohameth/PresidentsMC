import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { ArrowLeft, Hash, Search } from 'lucide-react-native';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, startAt, endAt, where } from 'firebase/firestore';
import Colors from '@/constants/colors';
import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/utils/firebase';
import { trackAnalyticsEvent } from '@/utils/analytics';

type CrewSearchResult = {
  id: string;
  name: string;
  description?: string;
  logoUrl?: string;
  memberCount?: number;
  requiresApproval?: boolean;
};

export default function JoinCrewScreen() {
  const { joinCrew, isJoiningCrew, requestJoin, user } = useAuth();
  const [inviteCode, setInviteCode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CrewSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [requestStatus, setRequestStatus] = useState<Record<string, 'pending' | 'approved' | 'denied'>>({});

  const handleJoinCrew = async () => {
    if (!inviteCode.trim()) {
      Alert.alert('Error', 'Please enter an invite code');
      return;
    }

    void trackAnalyticsEvent({
      eventName: 'crew_join_by_code_requested',
      properties: {
        inviteCodeLength: inviteCode.trim().length,
      },
      route: '/join-crew',
    });

    try {
      await joinCrew(inviteCode.toUpperCase());
      void trackAnalyticsEvent({
        eventName: 'crew_join_by_code_success',
        route: '/join-crew',
        properties: {
          inviteCodeLength: inviteCode.trim().length,
        },
      });
      router.replace('/');
    } catch (error) {
      if (__DEV__) {
        console.log('[JoinCrew] Error:', error);
      }
      void trackAnalyticsEvent({
        eventName: 'crew_join_by_code_failed',
        route: '/join-crew',
        properties: {
          inviteCodeLength: inviteCode.trim().length,
        },
      });
      Alert.alert('Error', 'Invalid invite code. Please check and try again.');
    }
  };

  const formatInviteCode = (text: string) => {
    const cleaned = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    return cleaned.slice(0, 8);
  };

  const handleJoinRequest = async (result: CrewSearchResult) => {
    try {
      await requestJoin(result.id);
      setRequestStatus((prev) => ({ ...prev, [result.id]: 'pending' }));
      void trackAnalyticsEvent({
        eventName: 'crew_join_request_sent',
        crewId: result.id,
        route: '/join-crew',
        properties: {
          source: 'discoverable_search',
          status: 'success',
        },
      });
      Alert.alert('Request Sent', 'Your request has been sent to the crew admins.');
    } catch {
      void trackAnalyticsEvent({
        eventName: 'crew_join_request_sent',
        crewId: result.id,
        route: '/join-crew',
        properties: {
          source: 'discoverable_search',
          status: 'failed',
        },
      });
      Alert.alert('Error', 'Unable to send request. Please try again.');
    }
  };

  useEffect(() => {
    const queryText = searchQuery.trim().toLowerCase();
    if (queryText.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const crewsRef = collection(db, 'crews');
        const crewsQuery = query(
          crewsRef,
          where('isDiscoverable', '==', true),
          where('status', '==', 'active'),
          orderBy('nameLower'),
          startAt(queryText),
          endAt(`${queryText}\uf8ff`),
          limit(10)
        );
        const snap = await getDocs(crewsQuery);
        const results: CrewSearchResult[] = snap.docs.map((docSnap) => {
          const data = docSnap.data() as any;
          return {
            id: docSnap.id,
            name: data.name || '',
            description: data.description || '',
            logoUrl: data.logoUrl || '',
            memberCount: data.memberCount || 0,
            requiresApproval: data.requiresApproval ?? true,
          };
        });
        setSearchResults(results);
      } catch (error) {
        if (__DEV__) {
          console.log('[JoinCrew] Search error:', error);
        }
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!user?.id || searchResults.length === 0) return;
    let isActive = true;

    const loadStatuses = async () => {
      const entries = await Promise.all(
        searchResults.map(async (result) => {
          const requestRef = doc(db, 'crews', result.id, 'joinRequests', user.id);
          const snap = await getDoc(requestRef);
          if (!snap.exists()) return [result.id, undefined] as const;
          const data = snap.data() as { status?: 'pending' | 'approved' | 'denied' };
          return [result.id, data.status] as const;
        })
      );

      if (!isActive) return;

      const next: Record<string, 'pending' | 'approved' | 'denied'> = {};
      entries.forEach(([crewId, status]) => {
        if (status) next[crewId] = status;
      });
      setRequestStatus(next);
    };

    loadStatuses();
    return () => {
      isActive = false;
    };
  }, [searchResults, user?.id]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            testID="back-button"
          >
            <ArrowLeft size={24} color={Colors.dark.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Join a Crew</Text>
          <View style={styles.placeholder} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Enter Invite Code</Text>
              <Text style={styles.sectionDescription}>
                Ask your crew admin for the invite code
              </Text>

              <View style={styles.codeInputContainer}>
                <Hash size={24} color={Colors.dark.primary} />
                <TextInput
                  style={styles.codeInput}
                  placeholder="ABCD1234"
                  placeholderTextColor={Colors.dark.textTertiary}
                  value={inviteCode}
                  onChangeText={(text) => setInviteCode(formatInviteCode(text))}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={8}
                  testID="invite-code-input"
                />
              </View>

              <TouchableOpacity
                style={[styles.joinButton, isJoiningCrew && styles.buttonDisabled]}
                onPress={handleJoinCrew}
                disabled={isJoiningCrew || !inviteCode.trim()}
                activeOpacity={0.8}
                testID="join-button"
              >
                {isJoiningCrew ? (
                  <ActivityIndicator color={Colors.dark.background} />
                ) : (
                  <Text style={styles.joinButtonText}>Join Crew</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or search</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Search by Name</Text>
              <Text style={styles.sectionDescription}>
                Find a crew by name (requires crew to be discoverable)
              </Text>

              <View style={styles.searchInputContainer}>
                <Search size={20} color={Colors.dark.textTertiary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search crews..."
                  placeholderTextColor={Colors.dark.textTertiary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                  testID="search-input"
                />
              </View>

              {searchQuery.length > 0 && (
                <View style={styles.searchResults}>
                  {isSearching ? (
                    <View style={styles.emptyResults}>
                      <ActivityIndicator color={Colors.dark.primary} />
                    </View>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((result) => (
                      <TouchableOpacity
                        key={result.id}
                        style={styles.searchResultItem}
                        onPress={() => handleJoinRequest(result)}
                        activeOpacity={0.8}
                        disabled={requestStatus[result.id] === 'pending'}
                      >
                        {result.logoUrl ? (
                          <Image source={{ uri: result.logoUrl }} style={styles.resultLogo} contentFit="cover" />
                        ) : (
                          <View style={styles.resultLogoPlaceholder}>
                            <Text style={styles.resultLogoText}>{result.name?.charAt(0) || '?'}</Text>
                          </View>
                        )}
                        <View style={styles.resultInfo}>
                          <Text style={styles.resultName}>{result.name}</Text>
                          {!!result.description && (
                            <Text style={styles.resultDescription} numberOfLines={1}>{result.description}</Text>
                          )}
                          <Text style={styles.resultMeta}>
                            {result.memberCount || 0} members
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.resultJoin,
                            requestStatus[result.id] === 'pending' && styles.resultJoinPending,
                          ]}
                        >
                          {requestStatus[result.id] === 'pending' ? 'Pending' : 'Request'}
                        </Text>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <View style={styles.emptyResults}>
                      <Text style={styles.emptyResultsText}>
                        No crews found matching {`"${searchQuery}"`}
                      </Text>
                      <Text style={styles.emptyResultsHint}>
                        Most crews are private. Ask your admin for an invite code.
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  placeholder: {
    width: 40,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginBottom: 6,
  },
  sectionDescription: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 20,
  },
  codeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: Colors.dark.border,
    marginBottom: 16,
  },
  codeInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    marginLeft: 12,
    letterSpacing: 4,
    textAlign: 'center',
  },
  joinButton: {
    backgroundColor: Colors.dark.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  joinButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.dark.background,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.dark.border,
  },
  dividerText: {
    fontSize: 14,
    color: Colors.dark.textTertiary,
    marginHorizontal: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.dark.text,
    paddingVertical: 14,
    marginLeft: 12,
  },
  searchResults: {
    marginTop: 16,
  },
  emptyResults: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyResultsText: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyResultsHint: {
    fontSize: 13,
    color: Colors.dark.textTertiary,
    textAlign: 'center',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 10,
  },
  resultLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  resultLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  resultLogoText: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: '700' as const,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  resultDescription: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  resultMeta: {
    color: Colors.dark.textTertiary,
    fontSize: 12,
    marginTop: 4,
  },
  resultJoin: {
    color: Colors.dark.primary,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  resultJoinPending: {
    color: Colors.dark.pending,
  },
});
