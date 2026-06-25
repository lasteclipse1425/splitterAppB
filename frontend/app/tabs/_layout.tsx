// app/tabs/_layout.tsx

import React, { useCallback } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { YStack, XStack, Text, View } from 'tamagui';
import { Home, Settings, Bell, ChevronLeft, Zap } from '@tamagui/lucide-icons';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '@/shared/lib/stores/app-store';
import UserAvatar from '@/shared/ui/UserAvatar';
import { useAppColors } from '@/shared/ui/theme-context';
import { useFriendsStore } from '@/features/friends/model/friends.store';
import { useReceiptSessionStore } from '@/features/receipt/model/receipt-session.store';
import { openQuickHabits } from '@/features/receipt/model/quick-habits-ui.store';

// --- Reusable Badge Component ---
function DotBadge({ value }: { value?: number }) {
  const colors = useAppColors();
  if (!value || value <= 0) return null;
  return (
    <View
      position="absolute"
      top={-4} right={-4}
      w={20} h={20}
      br={999}
      ai="center" jc="center"
      backgroundColor={colors.primary}
    >
      <Text color="white" fontSize={10} fontWeight="700">
        {value}
      </Text>
    </View>
  );
}

// --- Global Header for all Tabs ---
// FIX: ранее здесь были useEffect + useFocusEffect + AppState.addEventListener,
// которые вызывали fetchAll() (загрузку списка друзей и запросов) при каждом
// переключении таба. Поскольку этот хедер общий для ВСЕХ экранов, каждая
// навигация → fetchAll → обновление стора → перерисовка → useFocusEffect →
// снова fetchAll → бесконечный цикл запросов GET /friends и GET /friends/requests
// теперь хедер только ЧИТАЕТ requestsCount из стора через selector.
// загрузку данных выполняют сами экраны друзей при своём монтировании
function GlobalTabsHeader(props: any) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAppStore();
  const { t } = useTranslation();
  const routeName = props?.route?.name ?? '';
  const showHomeShortcut =
    routeName === 'profile' ||
    routeName.startsWith('friends') ||
    routeName.startsWith('groups') ||
    routeName.startsWith('sessions');
  const onBackToHome = () => router.replace({ pathname: '/tabs' });

  const requestsCount = useFriendsStore((s) => s.requestsRaw?.incoming?.length ?? 0);
  const sessionItems = useReceiptSessionStore((s) => s.items);
  const showHabitsShortcut =
    routeName.startsWith('sessions') && sessionItems.length > 0;
  const displayName = user?.username || t('profile.labels.guest', 'Guest');
  const userInitial = displayName.slice(0, 1).toUpperCase();

  const colors = useAppColors();
  const handleOpenProfile = useCallback(() => {
    router.push({ pathname: '/tabs/profile' });
  }, [router]);

  return (
    <YStack bg={colors.background} pt={insets.top} borderBottomWidth={1} borderBottomColor={colors.border}>
      <XStack h={50} ai="center" jc="space-between" px="$4">
        <XStack ai="center" gap="$2">
          {showHomeShortcut && (
            <Pressable onPress={onBackToHome} hitSlop={10}>
              <XStack ai="center" gap="$1">
                <ChevronLeft size={20} color={colors.textMuted} />
                <Text fontSize={14} color={colors.textMuted}>
                  {t('navigation.mainMenu', 'Main menu')}
                </Text>
              </XStack>
            </Pressable>
          )}
          <Text fontSize={18} fontWeight="700" color={colors.text} numberOfLines={1} miw={150}>
            {props.options.title}
          </Text>
        </XStack>

        <XStack ai="center" gap="$3">
          {showHabitsShortcut && (
            <Pressable onPress={() => openQuickHabits('suggestions')} hitSlop={10}>
              <Zap size={22} color={colors.primary} />
            </Pressable>
          )}
          <Pressable onPress={() => router.push('/tabs/friends/requests')}>
            <View>
              <Bell size={22} color={colors.textMuted} />
              <DotBadge value={requestsCount} />
            </View>
          </Pressable>

          <Pressable onPress={handleOpenProfile} hitSlop={10}>
            <UserAvatar uri={user?.avatarUrl ?? undefined} label={userInitial} size={36} textSize={14} />
          </Pressable>
        </XStack>
      </XStack>
    </YStack>
  );
}

export default function TabLayout() {
  const { user } = useAppStore();
  const { t } = useTranslation();

  const greetingName = user?.username || t('home.header.friendFallback', 'friend');
  const homeTitle = t('home.header.greeting', { name: greetingName });
  const homeLabel = t('navigation.tabs.home', 'Home');
  const settingsTitle = t('navigation.tabs.settings', 'Settings');
  const profileTitle = t('profile.title', 'Profile');
  const groupsTitle = t('navigation.groups.title', 'Groups');
  const newGroupTitle = t('navigation.groups.create', 'New group');
  const groupDetailsTitle = t('navigation.groups.details', 'Group');
  const scanInviteTitle = t('navigation.scanInvite', 'Scan Invite');
  const friendQrTitle = t('navigation.friendQr', 'My Friend QR');
  const groupQrTitle = t('navigation.groupQr', 'Group QR');
  const scanReceiptTitle = t('navigation.scanReceipt', 'Scan Receipt');
  const participantsTitle = t('navigation.participants', 'Participants');
  const itemsSplitTitle = t('navigation.itemsSplit', 'Items Split');
  const finishTitle = t('navigation.finish', 'Finish');
  const historyTitle = t('navigation.history', 'Recent bills');
  const historyDetailsTitle = t('navigation.historyDetails', 'Bill details');

  return (
    <Tabs
      screenOptions={{
        header: (props) => <GlobalTabsHeader {...props} />,
        tabBarStyle: { display: 'none' },
      }}
    >
      {/* Home & Settings tabs (hidden from bar) */}
      <Tabs.Screen
        name="index"
        options={{
          href: null,
          title: homeTitle,
          tabBarLabel: homeLabel,
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
          title: settingsTitle,
          tabBarLabel: settingsTitle,
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          href: null,
          title: profileTitle,
        }}
      />

      {/* Friends stack (hidden) */}
      <Tabs.Screen name="friends/index" options={{ href: null, title: t('friends.title', 'Friends') }} />
      <Tabs.Screen name="friends/search" options={{ href: null, title: t('friends.search', 'Search') }} />
      <Tabs.Screen name="friends/requests" options={{ href: null, title: t('friends.requests', 'Requests') }} />

      {/* HIDDEN: Groups */}
      <Tabs.Screen name="groups/index"   options={{ href: null, title: groupsTitle }} />
      <Tabs.Screen name="groups/create"  options={{ href: null, title: newGroupTitle }} />
      <Tabs.Screen name="groups/[groupId]" options={{ href: null, title: groupDetailsTitle }} />

      <Tabs.Screen name="scan-invite" options={{ href: null, title: scanInviteTitle }} />
      <Tabs.Screen name="friends/invite" options={{ href: null, title: friendQrTitle }} />
      <Tabs.Screen name="groups/invite" options={{ href: null, title: groupQrTitle }} />

      <Tabs.Screen name="scan-receipt" options={{ href: null, title: scanReceiptTitle }} />
      <Tabs.Screen name="sessions/participants" options={{ href: null, title: participantsTitle }} />
      <Tabs.Screen name="sessions/items-split" options={{ href: null, title: itemsSplitTitle }} />
      <Tabs.Screen name="sessions/finish" options={{ href: null, title: finishTitle }} />
      <Tabs.Screen name="sessions/history/index" options={{ href: null, title: historyTitle }} />
      <Tabs.Screen name="sessions/history/[historyId]" options={{ href: null, title: historyDetailsTitle }} />

    </Tabs>
  );
}
