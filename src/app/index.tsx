import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Brand } from '../components/Brand';
import { colors } from '../theme/colors';

// ─── Slide data (keeping 4 slides) ───────────────────────────────────────────
const slides = [
  {
    id: 'companionship',
    icon: '♡',
    iconBg: '#E0E7FF',
    iconColor: colors.primary,
    accentBg: '#EEF2FF',
    title: 'Companionship Made Simple',
    description:
      'Connect with trusted volunteers for friendly conversations and small everyday support.',
  },
  {
    id: 'trusted',
    icon: '✓',
    iconBg: '#F3E8FF',
    iconColor: colors.secondary,
    accentBg: '#F5F3FF',
    title: 'Safe and Trusted',
    description:
      'View verified volunteers and stay informed about your activities with complete peace of mind.',
  },
  {
    id: 'connected',
    icon: '⌚',
    iconBg: '#E0F2FE',
    iconColor: colors.info,
    accentBg: '#F0F9FF',
    title: 'Volunteer Your Way',
    description:
      'Choose activities that fit your time, interests, and location.',
  },
  {
    id: 'peace',
    icon: '⌂',
    iconBg: '#DCFCE7',
    iconColor: colors.success,
    accentBg: '#F0FDF4',
    title: 'Peace of Mind',
    description:
      'Request help, follow activity updates, and keep your caregiver informed.',
  },
] as const;

const ONBOARDING_COMPLETE_KEY = 'silverlink.onboarding.complete.v1';

// ─── Splash ──────────────────────────────────────────────────────────────────
function Splash() {
  const [opacity] = useState(() => new Animated.Value(0));
  const [scale] = useState(() => new Animated.Value(0.88));
  const [messageOpacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 750,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          damping: 14,
          stiffness: 80,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(messageOpacity, {
        toValue: 1,
        duration: 500,
        delay: 200,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.03,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [messageOpacity, opacity, scale]);

  return (
    <SafeAreaView style={styles.splash}>
      {/* Background decoration */}
      <View pointerEvents="none" style={styles.splashOrbTopRight} />
      <View pointerEvents="none" style={styles.splashOrbBottomLeft} />
      <View pointerEvents="none" style={styles.splashOrbCenter} />

      {/* Logo + Name */}
      <Animated.View style={[styles.splashBrand, { opacity, transform: [{ scale }] }]}>
        <Brand large center showTagline />
      </Animated.View>

      {/* Tagline message */}
      <Animated.Text style={[styles.splashMessage, { opacity: messageOpacity }]}>
        Care. Connection. Confidence.
      </Animated.Text>
    </SafeAreaView>
  );
}

// ─── Onboarding ──────────────────────────────────────────────────────────────
function Onboarding({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const listRef = useRef<FlatList<(typeof slides)[number]>>(null);
  const artSize = Math.min(220, width * 0.52, height * 0.26);

  const next = () => {
    if (page === slides.length - 1) {
      onDone();
      return;
    }
    const nextPage = page + 1;
    setPage(nextPage);
    listRef.current?.scrollToOffset({ offset: width * nextPage, animated: true });
  };

  return (
    <SafeAreaView style={styles.screen}>
      {/* Background orbs */}
      <View pointerEvents="none" style={styles.onboardOrbTop} />

      {/* Header */}
      <View style={styles.header}>
        <Brand />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip introduction"
          onPress={onDone}
          hitSlop={12}
          style={styles.skipButton}
        >
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      </View>

      {/* Slides */}
      <FlatList
        ref={listRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        onMomentumScrollEnd={(event) =>
          setPage(
            Math.max(
              0,
              Math.min(
                slides.length - 1,
                Math.round(event.nativeEvent.contentOffset.x / width),
              ),
            ),
          )
        }
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            {/* Illustration */}
            <View
              style={[
                styles.illustration,
                {
                  width: artSize,
                  height: artSize,
                  borderRadius: artSize / 2,
                  backgroundColor: item.iconBg,
                },
              ]}
            >
              {/* Inner ring */}
              <View
                style={[
                  styles.illustrationRing,
                  {
                    width: artSize * 0.7,
                    height: artSize * 0.7,
                    borderRadius: (artSize * 0.7) / 2,
                    borderColor: item.iconColor + '30',
                  },
                ]}
              />
              <Text style={[styles.illustrationIcon, { color: item.iconColor }]}>
                {item.icon}
              </Text>
            </View>

            {/* Text */}
            <Text style={styles.slideTitle}>{item.title}</Text>
            <Text style={styles.slideDescription}>{item.description}</Text>
          </View>
        )}
      />

      {/* Footer */}
      <View style={styles.footer}>
        {/* Progress dots */}
        <View
          style={styles.dots}
          accessibilityLabel={`Page ${page + 1} of ${slides.length}`}
        >
          {slides.map((slide, index) => (
            <View
              key={slide.id}
              style={[styles.dot, index === page && styles.dotActive]}
            />
          ))}
        </View>

        {/* Next / Get Started */}
        <Pressable
          accessibilityRole="button"
          style={styles.primaryButton}
          onPress={next}
        >
          <Text style={styles.primaryButtonText}>
            {page === slides.length - 1 ? 'Get Started' : 'Next'}
          </Text>
          <Text style={styles.buttonArrow}>
            {page === slides.length - 1 ? '' : '→'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ─── Index (orchestrator) ─────────────────────────────────────────────────────
export default function Index() {
  const router = useRouter();
  const [destination, setDestination] = useState<'loading' | 'onboarding'>(
    'loading',
  );

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const completed = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
        if (!active) return;
        if (completed === 'true') router.replace('/welcome');
        else setDestination('onboarding');
      } catch {
        if (active) setDestination('onboarding');
      }
    }, 3000);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [router]);

  async function finishOnboarding() {
    await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true').catch(
      () => undefined,
    );
    router.replace('/welcome');
  }

  if (destination === 'loading') return <Splash />;
  return <Onboarding onDone={finishOnboarding} />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Splash ──
  splash: {
    flex: 1,
    backgroundColor: '#F4F5FF',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    overflow: 'hidden',
  },
  splashOrbTopRight: {
    position: 'absolute',
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: '#DDE1FF',
    top: -130,
    right: -110,
  },
  splashOrbBottomLeft: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#EDE9FE',
    bottom: -80,
    left: -80,
  },
  splashOrbCenter: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(79,70,229,0.06)',
    top: '30%',
    left: '20%',
  },
  splashBrand: {
    alignItems: 'center',
    gap: 16,
  },
  splashMessage: {
    color: colors.textSecondary,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // ── Onboarding ──
  screen: { flex: 1, backgroundColor: colors.surface },
  onboardOrbTop: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: '#EEF2FF',
    top: -100,
    right: -80,
  },

  // Header
  header: {
    paddingHorizontal: 22,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 1,
  },
  skipButton: {
    minWidth: 60,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: 8,
  },
  skip: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },

  // Slides
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 12,
    gap: 0,
  },
  illustration: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 36,
    position: 'relative',
  },
  illustrationRing: {
    position: 'absolute',
    borderWidth: 2,
  },
  illustrationIcon: {
    fontSize: 72,
    lineHeight: 86,
  },
  slideTitle: {
    fontSize: 28,
    lineHeight: 35,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 14,
  },
  slideDescription: {
    fontSize: 17,
    lineHeight: 26,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 340,
  },

  // Footer
  footer: {
    paddingHorizontal: 22,
    paddingBottom: 20,
    gap: 20,
  },
  dots: {
    minHeight: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 28,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },

  // Button
  primaryButton: {
    minHeight: 60,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    shadowColor: '#3730A3',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 6,
  },
  primaryButtonText: {
    color: colors.textOnPrimary,
    fontWeight: '800',
    fontSize: 18,
    letterSpacing: 0.1,
  },
  buttonArrow: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 22,
  },
});
