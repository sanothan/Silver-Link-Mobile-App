import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

const logo = require('../../assets/logo/logo_silverlink.png');

type BrandProps = {
  large?: boolean;
  showTagline?: boolean;
  center?: boolean;
};

export function Brand({ large = false, showTagline = false, center = false }: BrandProps) {
  return (
    <View
      style={[styles.row, large && styles.rowLarge, center && styles.rowCenter]}
      accessibilityRole="header"
    >
      <Image
        source={logo}
        style={[styles.logo, large && styles.logoLarge]}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
      <View style={center && !large ? styles.textCenter : undefined}>
        <Text style={[styles.name, large && styles.nameLarge, center && styles.nameCenter]}>
          SilverLink
        </Text>
        {showTagline ? (
          <Text style={[styles.tagline, center && styles.taglineCenter]}>
            Connecting generations, strengthening communities.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowLarge: {
    flexDirection: 'column',
    gap: 16,
    alignItems: 'center',
  },
  rowCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCenter: {
    alignItems: 'center',
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 14,
  },
  logoLarge: {
    width: 86,
    height: 86,
    borderRadius: 26,
  },
  name: {
    color: colors.primaryDark,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  nameLarge: {
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  nameCenter: {
    textAlign: 'center',
  },
  tagline: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  taglineCenter: {
    textAlign: 'center',
  },
});
