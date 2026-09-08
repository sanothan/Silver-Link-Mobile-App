import { useRouter } from 'expo-router';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Brand } from '../components/Brand';
import { colors } from '../theme/colors';

const background = require('../../assets/images/silverlink_auth_background_v2.png');

export default function Welcome() {
  const router = useRouter();

  return (
    <ImageBackground
      source={background}
      resizeMode="cover"
      blurRadius={3}
      style={styles.bg}
    >
      <View style={styles.overlay} />

      {/* Soft decorative orbs */}
      <View style={styles.orbTopRight} pointerEvents="none" />
      <View style={styles.orbBottomLeft} pointerEvents="none" />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.container}>
          {/* Card */}
          <View style={styles.card}>

            {/* Brand centered */}
            <View style={styles.brandSection}>
              <Brand large center />
            </View>

            {/* Copy */}
            <View style={styles.copySection}>
              <Text style={styles.tagline}>
                Meaningful connections,{'\n'}made simple.
              </Text>
              <Text style={styles.support}>
                Connect elderly users, caregivers and volunteers through trusted community support.
              </Text>
            </View>

            {/* Trust badges */}
            <View style={styles.badges}>
              <View style={styles.badge}>
                <Text style={styles.badgeIcon}>✓</Text>
                <Text style={styles.badgeText}>Verified volunteers</Text>
              </View>
              <View style={styles.badgeDivider} />
              <View style={styles.badge}>
                <Text style={styles.badgeIcon}>♡</Text>
                <Text style={styles.badgeText}>Community care</Text>
              </View>
              <View style={styles.badgeDivider} />
              <View style={styles.badge}>
                <Text style={styles.badgeIcon}>◷</Text>
                <Text style={styles.badgeText}>Always updated</Text>
              </View>
            </View>

            {/* CTA buttons */}
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                style={styles.primaryButton}
                onPress={() => router.push('/login')}
              >
                <Text style={styles.primaryButtonText}>Log In</Text>
                <Text style={styles.buttonArrow}>→</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                style={styles.secondaryButton}
                onPress={() => router.push('/register')}
              >
                <Text style={styles.secondaryButtonText}>Create Account</Text>
              </Pressable>
            </View>

            {/* Trust footer */}
            <Text style={styles.trust}>
              Built for simple, respectful community connections.
            </Text>

          </View>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#E8EAFF' },
  overlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(30,27,75,0.28)',
  },
  orbTopRight: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(139,92,246,0.16)',
    top: -100,
    right: -80,
  },
  orbBottomLeft: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(79,70,229,0.14)',
    bottom: -80,
    left: -80,
  },
  safe: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    justifyContent: 'center',
  },

  /* Card */
  card: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 30,
    padding: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#1E1B4B',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.22,
    shadowRadius: 40,
    elevation: 14,
    gap: 28,
    alignItems: 'stretch',
  },

  /* Brand */
  brandSection: {
    alignItems: 'center',
    paddingTop: 4,
  },

  /* Copy */
  copySection: { gap: 10 },
  tagline: {
    color: colors.textPrimary,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  support: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },

  /* Trust badges row */
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 16,
    padding: 14,
    gap: 2,
  },
  badge: { alignItems: 'center', gap: 4, flex: 1 },
  badgeIcon: { fontSize: 18, color: colors.primary },
  badgeText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  badgeDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },

  /* Actions */
  actions: { gap: 12 },
  primaryButton: {
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    shadowColor: '#3730A3',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 18,
    elevation: 7,
  },
  primaryButtonText: {
    color: colors.textOnPrimary,
    fontWeight: '800',
    fontSize: 18,
    letterSpacing: 0.2,
  },
  buttonArrow: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 20,
  },
  secondaryButton: {
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 18,
    letterSpacing: 0.2,
  },

  /* Trust footer */
  trust: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
