import * as Location from "expo-location";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, {
  Marker,
  type MapPressEvent,
  type Region,
} from "react-native-maps";
import { colors } from "../theme/colors";

export type PickedLocation = {
  latitude: number;
  longitude: number;
  label?: string;
};
const DEFAULT_REGION: Region = {
  latitude: 6.9271,
  longitude: 79.8612,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};
export function LocationPicker({
  value,
  onChange,
}: {
  value?: PickedLocation;
  onChange: (location: PickedLocation) => void;
}) {
  const [region, setRegion] = useState<Region>(
    value
      ? { ...value, latitudeDelta: 0.025, longitudeDelta: 0.025 }
      : DEFAULT_REGION,
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(
    "Tap the map to choose a meeting point.",
  );
  async function choose(latitude: number, longitude: number) {
    let label: string | undefined;
    try {
      const [place] = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });
      label =
        [place?.name, place?.street, place?.district, place?.city]
          .filter(Boolean)
          .filter((item, index, all) => all.indexOf(item) === index)
          .join(", ") || undefined;
    } catch {
      /* Coordinates remain usable without an address. */
    }
    onChange({ latitude, longitude, label });
  }
  async function selectCurrentLocation() {
    setLoading(true);
    setMessage("Finding your location…");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setMessage(
          "Location permission was not granted. You can still tap the map.",
        );
        return;
      }
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const selected = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };
      setRegion({ ...selected, latitudeDelta: 0.02, longitudeDelta: 0.02 });
      await choose(selected.latitude, selected.longitude);
      setMessage("Current location selected. Check the pin before continuing.");
    } catch {
      setMessage("We couldn't find your location. Please tap the map instead.");
    } finally {
      setLoading(false);
    }
  }
  const selectMap = (event: MapPressEvent) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    void choose(latitude, longitude);
  };
  return (
    <View>
      <View style={styles.mapFrame}>
        <MapView
          accessibilityLabel="Map location picker"
          style={styles.map}
          region={region}
          onRegionChangeComplete={setRegion}
          onPress={selectMap}
          showsUserLocation
        >
          {value ? (
            <Marker coordinate={value} title="Selected meeting point" />
          ) : null}
        </MapView>
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={loading}
        style={styles.currentButton}
        onPress={() => void selectCurrentLocation()}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={styles.currentText}>◎ Use My Current Location</Text>
        )}
      </Pressable>
      <Text style={styles.help}>{message}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  mapFrame: {
    height: 245,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.borderDark,
    backgroundColor: colors.surfaceSoft,
  },
  map: { width: "100%", height: "100%" },
  currentButton: {
    minHeight: 52,
    borderRadius: 14,
    marginTop: 11,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  currentText: { color: colors.primary, fontSize: 16, fontWeight: "800" },
  help: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
});
