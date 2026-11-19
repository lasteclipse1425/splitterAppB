// app/tabs/scan-invite.tsx
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, Image, Animated, Modal } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { YStack, XStack, Button, Paragraph, Input } from 'tamagui';
import { ChevronLeft } from '@tamagui/lucide-icons';

import { parseInviteFromScan } from '@/shared/lib/utils/invite';
import { FriendsApi } from '@/features/friends/api/friends.api';
import { useFriendsStore } from '@/features/friends/model/friends.store';
import { GroupsApi } from '@/features/groups/api/groups.api';

type FromParam = 'friends-requests' | 'groups-index' | undefined;

interface UserData {
  avatar?: string;
  name: string;
  username: string;
  bio?: string;
}

export default function ScanInviteScreen() {
  const [perm, requestPerm] = useCameraPermissions();
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [manualLink, setManualLink] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [userData, setUserData] = useState<UserData | null>(null);
  const lock = useRef(false);
  const isFocused = useIsFocused();
  const router = useRouter();
  const { t } = useTranslation();
  const refreshFriends = useFriendsStore((s) => s.fetchAll);
  const { from } = useLocalSearchParams<{ from?: FromParam }>();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (isFocused && !perm?.granted) requestPerm();
    if (!isFocused) {
      setStatus('idle');
      lock.current = false;
    }
  }, [isFocused, perm?.granted, requestPerm]);

  useEffect(() => {
    if (status === 'ok') {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
    }
  }, [status, fadeAnim, scaleAnim]);

  const goBack = () => {
    if (from === 'friends-requests') router.replace('/tabs/friends/requests' as never);
    else if (from === 'groups-index') router.replace('/tabs/groups' as never);
    else if (router.canGoBack()) router.back();
    else router.replace('/tabs' as never);
  };

  async function redeem(data: string) {
    if (lock.current) return;
    lock.current = true;
    try {
      setErrorMessage('');
      const parsed = parseInviteFromScan(data);
      if (!parsed) throw new Error('This link is not a valid friend or group invite.');

      setStatus('loading');
      
      const response =
        parsed.kind === 'friend'
          ? await FriendsApi.joinByToken(parsed.token)
          : await GroupsApi.joinByToken(parsed.token);

      // API helpers already return response.data (not axios response object).
      const payload = (response ?? {}) as Record<string, any>;
      if (parsed.kind === 'friend' && payload.action === 'self') {
        throw new Error('You cannot add yourself as a friend.');
      }
      if (parsed.kind === 'friend') {
        await refreshFriends();
      }

      const userLike =
        payload.user ??
        payload.inviter ??
        payload.owner ??
        payload.from ??
        payload.to ??
        null;

      const fallbackName =
        parsed.kind === 'group' ? 'Group invite accepted' : 'Friend invite accepted';
      const fallbackUsername = parsed.kind === 'group' ? '@group' : '@friend';
      const actionText =
        parsed.kind === 'group'
          ? payload.member ?? payload.joined ?? 'joined'
          : payload.action ?? 'accepted';

      setUserData({
        avatar: userLike?.avatarUrl ?? userLike?.avatar ?? userLike?.photo,
        name: userLike?.name ?? userLike?.fullName ?? userLike?.username ?? fallbackName,
        username:
          userLike?.uniqueId
            ? `@${String(userLike.uniqueId).toLowerCase()}`
            : userLike?.username
            ? `@${String(userLike.username).toLowerCase()}`
            : fallbackUsername,
        bio: `Status: ${String(actionText)}`,
      });

      setStatus('ok');
      setTimeout(goBack, 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not use this invite.';
      const friendlyMessage = /invalid or expired token/i.test(message)
        ? t('friends.invite.expired', 'This invite link has expired. Ask your friend to create a new QR code or link.')
        : /invalid token|token is required/i.test(message)
          ? t('friends.invite.invalid', 'This invite link is invalid. Check the link and try again.')
          : message;
      setErrorMessage(friendlyMessage);
      setStatus('error');
      setTimeout(() => {
        setStatus('idle');
        lock.current = false;
      }, 1800);
    }
  }

  const submitManualLink = () => {
    const link = manualLink.trim();
    if (!link) {
      setErrorMessage('Paste or enter an invite link first.');
      setStatus('error');
      setTimeout(() => setStatus('idle'), 1800);
      return;
    }
    void redeem(link);
  };

  return (
    <View style={S.root}>
      <View style={S.headerAbs}>
        <XStack ai="center" jc="space-between" px="$3" py="$2">
          <Button
            size="$2"
            h={28}
            chromeless
            onPress={goBack}
            icon={<ChevronLeft size={18} color="white" />}
            color="white"
          >
            Back
          </Button>
          <Paragraph fow="700" fos="$6" col="white">Scan invite</Paragraph>
          <YStack w={54} />
        </XStack>
      </View>

      <View style={S.cameraWrap}>
        {isFocused && perm?.granted ? (
          <CameraView
            style={S.camera}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] as const }}
            onBarcodeScanned={(res) => {
              if (lock.current || status === 'loading') return;
              void redeem(res.data);
            }}
          />
        ) : (
          <YStack f={1} ai="center" jc="center">
            <Paragraph col="$gray1">Allow camera access</Paragraph>
          </YStack>
        )}
      </View>

      {status !== 'ok' && status !== 'loading' && (
        <YStack position="absolute" left={16} right={16} bottom={28} gap="$2" p="$3" br={14} bg="rgba(0,0,0,0.82)">
          <Paragraph col="white" fos={13}>Or paste an invite link</Paragraph>
          <Input
            value={manualLink}
            onChangeText={(value) => {
              setManualLink(value);
              setErrorMessage('');
            }}
            placeholder="https://.../friends/join?token=..."
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={submitManualLink}
            bg="white"
            color="#1A1A1A"
            borderRadius={10}
            accessibilityLabel="Invite link"
          />
          {!!errorMessage && <Paragraph color="$red10">{errorMessage}</Paragraph>}
          <Button onPress={submitManualLink} theme="active" borderRadius={10}>
            Use invite link
          </Button>
        </YStack>
      )}

      {status === 'loading' && (
        <View style={S.overlay}>
          <YStack ai="center" gap="$2">
            <ActivityIndicator color="white" />
            <Paragraph col="white">ConnectingвЂ¦</Paragraph>
          </YStack>
        </View>
      )}

      {/* Success Modal */}
      <Modal
        visible={status === 'ok'}
        transparent
        animationType="none"
        statusBarTranslucent
      >
        <View style={S.modalOverlay}>
          <Animated.View
            style={[
              S.successModal,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <View style={S.checkmark}>
              <Paragraph fos={24} fow="bold" col="white">вњ“</Paragraph>
            </View>

            <View style={S.avatarContainer}>
              {userData?.avatar ? (
                <Image
                  source={{ uri: userData.avatar }}
                  style={S.avatar}
                  resizeMode="cover"
                />
              ) : (
                <View style={[S.avatar, S.avatarPlaceholder]}>
                  <Paragraph fos={32} col="$gray8">
                    {userData?.name?.[0]?.toUpperCase() || '?'}
                  </Paragraph>
                </View>
              )}
            </View>

            <YStack ai="center" px="$4" pt="$2" gap="$1">
              <Paragraph fos={20} fow="700" col="#1a1a1a" ta="center">
                {userData?.name || 'User'}
              </Paragraph>
              <Paragraph fos={14} col="#666" ta="center">
                {userData?.username || '@user'}
              </Paragraph>
            </YStack>

            {userData?.bio && (
              <YStack px="$6" pt="$4">
                <Paragraph fos={14} col="#333" ta="center" lh={20}>
                  {userData.bio}
                </Paragraph>
              </YStack>
            )}

            <View style={{ height: 24 }} />
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const S = StyleSheet.create({
  root: { 
    flex: 1, 
    backgroundColor: '#000' 
  },
  headerAbs: {
    position: 'absolute',
    top: 0, 
    left: 0, 
    right: 0,
    zIndex: 10,
    paddingTop: 8,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  cameraWrap: { 
    flex: 1, 
    backgroundColor: '#000' 
  },
  camera: { 
    flex: 1 
  },
  overlay: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  successModal: {
    width: 358,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2ECC71',
    elevation: 10,
    shadowColor: '#2ECC71',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    position: 'relative',
  },
  checkmark: {
    position: 'absolute',
    top: -12,
    right: -12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2ECC71',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    elevation: 5,
    shadowColor: '#2ECC71',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  avatarContainer: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 12,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#2ECC71',
  },
  avatarPlaceholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
