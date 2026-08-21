import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Brand } from '../components/Brand';
import { colors } from '../theme/colors';

const slides = [
  { icon: '♡', title: 'Companionship and support', description: 'Stay connected and ask for simple, non-medical help when you need it.', color: '#E0E7FF', iconColor: colors.primary },
  { icon: '✓', title: 'A trusted community', description: 'Meet verified volunteers and build safer community connections.', color: '#F3E8FF', iconColor: colors.secondary },
  { icon: '⌚', title: 'Volunteer your way', description: 'Choose activities that fit your time, interests, and location.', color: '#E0F2FE', iconColor: colors.info },
  { icon: '⌂', title: 'Peace of mind', description: 'Caregivers can follow scheduled visits and receive important updates.', color: '#DCFCE7', iconColor: colors.success },
] as const;

function Splash() {
  const [opacity] = useState(() => new Animated.Value(0));
  const [scale] = useState(() => new Animated.Value(0.92));
  const [messageOpacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, damping: 12, stiffness: 90, useNativeDriver: true }),
      ]),
      Animated.timing(messageOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.035, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ]).start();
  }, [messageOpacity, opacity, scale]);

  return <SafeAreaView style={styles.splash}><Animated.View style={[styles.splashGlow, { opacity }]} /><Animated.View style={{ opacity, transform: [{ scale }] }}><Brand large showTagline /></Animated.View><Animated.Text style={[styles.splashMessage, { opacity: messageOpacity }]}>Care. Connection. Confidence.</Animated.Text></SafeAreaView>;
}

function Onboarding({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const listRef = useRef<FlatList<(typeof slides)[number]>>(null);
  const artSize = Math.min(238, width * 0.56, height * 0.3);
  const next = () => {
    if (page === slides.length - 1) {
      onDone();
      return;
    }
    const nextPage = page + 1;
    setPage(nextPage);
    listRef.current?.scrollToOffset({ offset: width * nextPage, animated: true });
  };

  return <SafeAreaView style={styles.screen}>
    <View style={styles.header}><Brand /><Pressable accessibilityRole="button" accessibilityLabel="Skip introduction" onPress={onDone} hitSlop={12} style={styles.skipButton}><Text style={styles.skip}>Skip</Text></Pressable></View>
    <FlatList ref={listRef} data={slides} horizontal pagingEnabled showsHorizontalScrollIndicator={false} keyExtractor={(item) => item.title} getItemLayout={(_, index) => ({ length: width, offset: width * index, index })} onMomentumScrollEnd={(event) => setPage(Math.max(0, Math.min(slides.length - 1, Math.round(event.nativeEvent.contentOffset.x / width))))} renderItem={({ item }) => <View style={[styles.slide, { width }]}><View style={[styles.illustration, { width: artSize, height: artSize, borderRadius: artSize / 2, backgroundColor: item.color }]}><Text style={[styles.illustrationIcon, { color: item.iconColor }]}>{item.icon}</Text></View><Text style={styles.slideTitle}>{item.title}</Text><Text style={styles.slideDescription}>{item.description}</Text></View>} />
    <View style={styles.footer}><View style={styles.dots} accessibilityLabel={`Page ${page + 1} of ${slides.length}`}>{slides.map((slide, index) => <View key={slide.title} style={[styles.dot, index === page && styles.dotActive]} />)}</View><Pressable accessibilityRole="button" style={styles.primaryButton} onPress={next}><Text style={styles.primaryButtonText}>{page === slides.length - 1 ? 'Get started' : 'Next'}</Text><Text style={styles.arrow}>→</Text></Pressable></View>
  </SafeAreaView>;
}

export default function Index() {
  const router = useRouter();
  const [destination, setDestination] = useState<'loading' | 'onboarding'>('loading');

  useEffect(() => {
    const timer = setTimeout(() => setDestination('onboarding'), 3000);
    return () => clearTimeout(timer);
  }, []);

  function finishOnboarding() {
    router.replace('/welcome');
  }

  if (destination === 'loading') return <Splash />;
  return <Onboarding onDone={finishOnboarding} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface }, splash: { flex: 1, backgroundColor: '#F7F8FF', justifyContent: 'center', alignItems: 'center', gap: 18, overflow: 'hidden' }, splashGlow: { position: 'absolute', width: 420, height: 420, borderRadius: 210, backgroundColor: '#E6E8FF', top: -110, right: -120 }, splashMessage: { color: colors.textSecondary, fontSize: 17, lineHeight: 24 }, header: { paddingHorizontal: 22, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, skipButton: { minWidth: 52, minHeight: 48, alignItems: 'center', justifyContent: 'center' }, skip: { color: colors.textSecondary, fontSize: 16, fontWeight: '700' }, slide: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, paddingVertical: 16 }, illustration: { justifyContent: 'center', alignItems: 'center', marginBottom: 30 }, illustrationIcon: { fontSize: 80, lineHeight: 96, fontWeight: '500' }, slideTitle: { fontSize: 28, lineHeight: 35, fontWeight: '800', color: colors.textPrimary, textAlign: 'center', letterSpacing: -0.5 }, slideDescription: { fontSize: 17, lineHeight: 26, color: colors.textSecondary, textAlign: 'center', marginTop: 13, maxWidth: 340 }, footer: { paddingHorizontal: 22, paddingBottom: 16, gap: 22 }, dots: { minHeight: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }, dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.borderDark }, dotActive: { width: 26, backgroundColor: colors.primary }, primaryButton: { minHeight: 58, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 }, primaryButtonText: { color: colors.textOnPrimary, fontWeight: '800', fontSize: 18 }, arrow: { color: colors.textOnPrimary, fontSize: 22 },
});
