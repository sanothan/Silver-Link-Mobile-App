import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const logo = require('../../assets/logo/logo_silverlink.png');
const slides = [
  { icon: '\u2661', title: 'Care that feels close', description: 'Stay connected with the people who matter, wherever life takes you.', color: '#E9EDFF', iconColor: '#5664D8' },
  { icon: '\u2726', title: 'Support, simply arranged', description: 'Coordinate everyday care and helpful support in one calm, easy place.', color: '#F3ECFF', iconColor: '#8759D7' },
  { icon: '\u2301', title: 'A little help goes a long way', description: 'Build confidence, independence, and peace of mind—together.', color: '#E6F7F4', iconColor: '#239B92' },
];

function Brand({ compact = false }: { compact?: boolean }) {
  return <View style={styles.brand}><Image source={logo} style={[styles.logo, compact && styles.compactLogo]} resizeMode="contain" /><View><Text style={[styles.brandName, compact && styles.compactBrandName]}>SilverLink</Text>{!compact && <Text style={styles.tagline}>Together, with care</Text>}</View></View>;
}

function Splash() {
  return <View style={styles.splash}><View style={styles.splashGlow} /><Brand /><Text style={styles.splashMessage}>Care. Connection. Confidence.</Text></View>;
}

function Onboarding({ onDone }: { onDone: () => void }) {
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const listRef = useRef<FlatList<(typeof slides)[number]>>(null);
  const next = () => page === slides.length - 1 ? onDone() : listRef.current?.scrollToIndex({ index: page + 1, animated: true });

  return <SafeAreaView style={styles.screen}>
    <View style={styles.onboardingHeader}><Brand compact /><Pressable accessibilityRole="button" accessibilityLabel="Skip onboarding" onPress={onDone} hitSlop={12}><Text style={styles.skip}>Skip</Text></Pressable></View>
    <FlatList ref={listRef} data={slides} horizontal pagingEnabled showsHorizontalScrollIndicator={false} keyExtractor={(item) => item.title} getItemLayout={(_, index) => ({ length: width, offset: width * index, index })} onMomentumScrollEnd={(event) => setPage(Math.round(event.nativeEvent.contentOffset.x / width))} renderItem={({ item }) => <View style={[styles.slide, { width }]}><View style={[styles.illustration, { backgroundColor: item.color }]}><Text style={[styles.illustrationIcon, { color: item.iconColor }]}>{item.icon}</Text><View style={[styles.dot, styles.dotOne, { backgroundColor: item.iconColor }]} /><View style={[styles.dot, styles.dotTwo, { backgroundColor: item.iconColor }]} /></View><Text style={styles.slideTitle}>{item.title}</Text><Text style={styles.slideDescription}>{item.description}</Text></View>} />
    <View style={styles.onboardingFooter}><View style={styles.dots}>{slides.map((slide, index) => <View key={slide.title} style={[styles.paginationDot, index === page && styles.paginationDotActive]} />)}</View><Pressable accessibilityRole="button" style={styles.primaryButton} onPress={next}><Text style={styles.primaryButtonText}>{page === slides.length - 1 ? 'Get started' : 'Continue'}</Text><Text style={styles.buttonArrow}>→</Text></Pressable></View>
  </SafeAreaView>;
}

export default function Index() {
  const router = useRouter();
  const [stage, setStage] = useState<'splash' | 'onboarding'>('splash');
  useEffect(() => { const timer = setTimeout(() => setStage('onboarding'), 1800); return () => clearTimeout(timer); }, []);
  if (stage === 'splash') return <Splash />;
  return <Onboarding onDone={() => router.replace('/login')} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' }, splash: { flex: 1, backgroundColor: '#F7F8FF', justifyContent: 'center', alignItems: 'center', gap: 18, overflow: 'hidden' }, splashGlow: { position: 'absolute', width: 420, height: 420, borderRadius: 210, backgroundColor: '#E6E8FF', top: -110, right: -120 }, brand: { flexDirection: 'row', alignItems: 'center', gap: 12, zIndex: 1 }, logo: { width: 78, height: 78, borderRadius: 20 }, compactLogo: { width: 42, height: 42, borderRadius: 12 }, brandName: { fontSize: 30, lineHeight: 35, fontWeight: '800', color: '#253061', letterSpacing: -0.7 }, compactBrandName: { fontSize: 20, lineHeight: 24, letterSpacing: -0.4 }, tagline: { color: '#7B84A0', fontSize: 13, marginTop: 2 }, splashMessage: { color: '#66708E', fontSize: 15, zIndex: 1 }, onboardingHeader: { paddingHorizontal: 24, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, skip: { color: '#68738F', fontSize: 15, fontWeight: '600' }, slide: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 54 }, illustration: { width: 238, height: 238, borderRadius: 119, justifyContent: 'center', alignItems: 'center', marginBottom: 46 }, illustrationIcon: { fontSize: 103, fontWeight: '300', marginTop: -8 }, dot: { width: 15, height: 15, borderRadius: 8, opacity: 0.28, position: 'absolute' }, dotOne: { top: 45, right: 39 }, dotTwo: { bottom: 43, left: 32, width: 10, height: 10 }, slideTitle: { fontSize: 28, lineHeight: 34, fontWeight: '800', color: '#202842', textAlign: 'center', letterSpacing: -0.5 }, slideDescription: { fontSize: 16, lineHeight: 24, color: '#6D7791', textAlign: 'center', marginTop: 15, maxWidth: 320 }, onboardingFooter: { paddingHorizontal: 24, paddingBottom: 22, gap: 24 }, dots: { flexDirection: 'row', justifyContent: 'center', gap: 7 }, paginationDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#D8DCEA' }, paginationDotActive: { width: 23, backgroundColor: '#5966D8' }, primaryButton: { height: 56, borderRadius: 16, backgroundColor: '#5260D4', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, shadowColor: '#3846AA', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 3 }, primaryButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 }, buttonArrow: { color: '#FFFFFF', fontSize: 22, lineHeight: 24 },
});
