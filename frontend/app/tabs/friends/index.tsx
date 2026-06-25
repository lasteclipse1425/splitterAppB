import React, { useEffect, useState, useMemo } from 'react';
import { YStack, XStack, Paragraph, Input, ScrollView, Separator, Text } from 'tamagui';
import { useRouter } from 'expo-router';
import { Search, UserPlus } from '@tamagui/lucide-icons';
import { useTranslation } from 'react-i18next';
import { useFriendsStore } from '@/features/friends/model/friends.store';
import { FriendListItem } from '@/features/friends/ui/FriendListItem';
import Fab from '@/shared/ui/Fab';
import { appRadii } from '@/shared/ui/app-tokens';
import { useAppTheme } from '@/shared/ui/theme-context';
import { SkeletonCard } from '@/shared/ui/Skeleton';
import { EmptyState } from '@/shared/ui/EmptyState';

export default function FriendsScreen() {
  const { friends, loading, error, fetchAll } = useFriendsStore();
  const router = useRouter();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const { colors, surfaceCardProps, appShadow } = useAppTheme();

  useEffect(() => {
    fetchAll();
  }, []);

  const filteredFriends = useMemo(() => {
    if (!searchQuery) {
      return friends;
    }
    const lowerCaseQuery = searchQuery.toLowerCase();
    return friends.filter(friend => {
      const title = (
        friend?.user?.displayName || friend?.user?.username || ''
      ).toLowerCase();
      const uniqueId = (friend?.user?.uniqueId || friend?.uniqueId || '').toLowerCase();
      return title.includes(lowerCaseQuery) || uniqueId.includes(lowerCaseQuery);
    });
  }, [friends, searchQuery]);

  if (loading && friends.length === 0) {
    return (
      <YStack f={1} bg={colors.background} p="$4" gap="$3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </YStack>
    );
  }

  return (
    <YStack f={1} bg={colors.background}>
      <YStack f={1} p="$4">
        {/* Search Input */}
        <XStack position="relative" ai="center" mb="$4">
          <Input
            placeholder={t('friends.searchPlaceholder', 'Search friends...')}
            value={searchQuery}
            onChangeText={setSearchQuery}
            f={1}
            h={44}
            pl={40}
            borderRadius={appRadii.md}
            bg={colors.card}
            borderWidth={1}
            borderColor={colors.border}
          />
          <Search 
            size={20} 
            color="$gray10" 
            position="absolute"
            left={12}
            pointerEvents="none"
          />
        </XStack>

        {error && <Paragraph col="$red10" p="$4">{error}</Paragraph>}
        
        <ScrollView f={1} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
          {filteredFriends.length > 0 && (
            <YStack
              borderWidth={1}
              borderColor={colors.border}
              borderRadius={appRadii.lg}
              overflow="hidden"
              backgroundColor={colors.card}
              {...appShadow.card}
            >
              {filteredFriends.map((f, index) => (
                <React.Fragment key={f.user?.id ?? f.userId ?? f.uniqueId ?? index}>
                  <FriendListItem friend={f} />
                  {index < filteredFriends.length - 1 && <Separator />}
                </React.Fragment>
              ))}
            </YStack>
          )}
          
          {filteredFriends.length === 0 && !loading && (
            <EmptyState
              icon={UserPlus}
              title={
                searchQuery
                  ? t('friends.search.noResults', 'No friends found')
                  : t('friends.empty', 'No friends yet')
              }
              subtitle={
                searchQuery
                  ? undefined
                  : t('friends.emptySubtitle', 'Tap + to send a friend request')
              }
            />
          )}
        </ScrollView>
      </YStack>

      <Fab onPress={() => router.push('/tabs/friends/requests')} />
    </YStack>
  );
}
