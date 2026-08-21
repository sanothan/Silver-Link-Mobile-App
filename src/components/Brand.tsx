import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

const logo = require('../../assets/logo/logo_silverlink.png');

type BrandProps = { large?: boolean; showTagline?: boolean };

export function Brand({ large = false, showTagline = false }: BrandProps) {
  return (
    <View style={styles.row} accessibilityRole="header">
      <Image source={logo} style={[styles.logo, large && styles.logoLarge]} resizeMode="contain" accessibilityIgnoresInvertColors />
      <View>
        <Text style={[styles.name, large && styles.nameLarge]}>SilverLink</Text>
        {showTagline ? <Text style={styles.tagline}>Together, with care</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 44, height: 44, borderRadius: 12 },
  logoLarge: { width: 74, height: 74, borderRadius: 20 },
  name: { color: colors.primaryDark, fontSize: 21, lineHeight: 26, fontWeight: '800', letterSpacing: -0.4 },
  nameLarge: { fontSize: 30, lineHeight: 36 },
  tagline: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 2 },
});
