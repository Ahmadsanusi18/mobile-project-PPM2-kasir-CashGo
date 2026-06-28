import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function ProfilScreen() {
  const [profile, setProfile] = useState<any>(null);
  const [cashierCode, setCashierCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setProfile(user.user_metadata);
      const { data: profileData } = await supabase
        .from("profiles")
        .select("cashier_code")
        .eq("id", user.id)
        .single();
      if (profileData) setCashierCode(profileData.cashier_code);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    Alert.alert("Konfirmasi", "Yakin ingin keluar dari akun?", [
      { text: "Batal" },
      {
        text: "Keluar",
        onPress: async () => await supabase.auth.signOut(),
        style: "destructive",
      },
    ]);
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#F45B26" />;

  const initials = (profile?.full_name || "U")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.pageHeader}>
        <Text style={styles.pageHeaderLabel}>STORE POS</Text>
        <Text style={styles.pageHeaderTitle}>PROFIL</Text>
      </View>

      {/* AVATAR & NAMA */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.name}>{profile?.full_name || "User Kasir"}</Text>
          <Text style={styles.email}>{profile?.email || "-"}</Text>
        </View>
        {cashierCode && (
          <View style={styles.cashierCodeBadge}>
            <Ionicons name="id-card-outline" size={11} color="#F45B26" />
            <Text style={styles.cashierCodeText}>{cashierCode}</Text>
          </View>
        )}
      </View>

      {/* INFO CARD */}
      <View style={styles.card}>
        <InfoItem
          icon="call-outline"
          label="NOMOR HP"
          value={`${profile?.country_code || "+62"} ${profile?.phone_number || "-"}`}
        />
        <InfoItem
          icon="shield-checkmark-outline"
          label="KODE KASIR"
          value={cashierCode || "Belum digenerate"}
          valueColor="#F45B26"
        />
        <InfoItem
          icon="briefcase-outline"
          label="ROLE"
          value="Kasir / Staff"
          isLast
        />
      </View>

      {/* LOGOUT */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color="#EF4444" />
        <Text style={styles.logoutText}>KELUAR DARI APLIKASI</Text>
      </TouchableOpacity>

      {/* BRANDING CASHGO */}
      <View style={styles.brandingContainer}>
        <Image
          source={require('../../assets/images/T-Oren2.png')}
          style={styles.brandingLogo}
          resizeMode="contain"
        />
        <Text style={styles.brandingText}>CashGo.</Text>
        <Text style={styles.brandingVersion}>VERSION 1.0.0</Text>
      </View>

    </View>
  );
}

const InfoItem = ({
  icon, label, value, valueColor, isLast,
}: {
  icon: any;
  label: string;
  value: string;
  valueColor?: string;
  isLast?: boolean;
}) => (
  <View style={[styles.infoRow, isLast && { borderBottomWidth: 0 }]}>
    <View style={styles.infoIconBox}>
      <Ionicons name={icon} size={18} color="#F45B26" />
    </View>
    <View style={{ marginLeft: 14, flex: 1 }}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueColor ? { color: valueColor } : {}]}>
        {value}
      </Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
  },
  pageHeader: {
    marginTop: Platform.OS === "ios" ? 60 : 40,
    marginBottom: 25,
  },
  pageHeaderLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#71717A",
    letterSpacing: 1.5,
  },
  pageHeaderTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: "#18181B",
    letterSpacing: -1,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFDFB",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FFEDD5",
    gap: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFF0EB",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFCAB0",
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "900",
    color: "#F45B26",
  },
  profileInfo: { flex: 1 },
  name: { fontSize: 15, fontWeight: "900", color: "#18181B" },
  email: { fontSize: 11, fontWeight: "600", color: "#71717A", marginTop: 2 },
  cashierCodeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFF0EB",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FFCAB0",
  },
  cashierCodeText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#F45B26",
    letterSpacing: 0.3,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#E4E4E7",
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F4F4F5",
  },
  infoIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#FFF0EB",
    justifyContent: "center",
    alignItems: "center",
  },
  infoLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#A1A1AA",
    letterSpacing: 0.8,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#18181B",
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    marginBottom: 32,
  },
  logoutText: {
    color: "#EF4444",
    fontWeight: "900",
    marginLeft: 10,
    fontSize: 13,
    letterSpacing: 0.5,
  },

  // BRANDING
  brandingContainer: {
    alignItems: "center",
    gap: 6,
  },
  brandingLogo: {
    width: 48,
    height: 48,
  },
  brandingText: {
    fontSize: 20,
    fontWeight: "900",
    color: "#18181B",
    letterSpacing: -0.5,
  },
  brandingVersion: {
    fontSize: 10,
    fontWeight: "700",
    color: "#A1A1AA",
    letterSpacing: 2,
  },
});