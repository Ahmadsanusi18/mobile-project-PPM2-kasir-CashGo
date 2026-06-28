import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, StatusBar, KeyboardAvoidingView,
  Platform, ScrollView, Image, Animated, ViewStyle
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

const IMG_LOGO = require('../../assets/images/T-Putih1.png');
const IMG_BG   = require('../../assets/images/T-Oren1.png');

interface SkeletonBoxProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

function SkeletonBox({ width, height, borderRadius = 8, style }: SkeletonBoxProps) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius, backgroundColor: '#E4E4E7' },
        { opacity },
        style,
      ]}
    />
  );
}

function LoginSkeleton() {
  return (
    <View style={styles.scrollContainer}>
      <View style={styles.headerSection}>
        <SkeletonBox width={80} height={80} borderRadius={24} style={{ marginBottom: 16 }} />
        <SkeletonBox width={120} height={22} borderRadius={6} style={{ marginBottom: 10 }} />
        <SkeletonBox width={220} height={14} borderRadius={6} style={{ marginBottom: 4 }} />
        <SkeletonBox width={180} height={14} borderRadius={6} />
      </View>

      <View style={styles.formSection}>
        <SkeletonBox width={100} height={10} borderRadius={4} style={{ marginBottom: 8 }} />
        <SkeletonBox width="100%" height={54} borderRadius={14} style={{ marginBottom: 18 }} />

        <SkeletonBox width={80} height={10} borderRadius={4} style={{ marginBottom: 8 }} />
        <SkeletonBox width="100%" height={54} borderRadius={14} style={{ marginBottom: 18 }} />

        <SkeletonBox width="100%" height={54} borderRadius={14} style={{ marginTop: 10 }} />
      </View>

      <View style={[styles.footerSection, { marginTop: 20 }]}>
        <SkeletonBox width={160} height={14} borderRadius={6} />
      </View>
    </View>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [secureText, setSecureText] = useState(true);
  const [loading, setLoading]     = useState(false);
  const [isPageReady, setIsPageReady] = useState(false);

  useEffect(() => {
    const preload = async () => {
      try {
        await Promise.all([
          Image.prefetch(Image.resolveAssetSource(IMG_LOGO).uri),
          Image.prefetch(Image.resolveAssetSource(IMG_BG).uri),
        ]);
      } catch (_) {
        // kalau prefetch gagal tetap lanjut tampil
      } finally {
        setIsPageReady(true);
      }
    };

    preload();
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      alert('Semua kolom input wajib diisi!');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password,
    });
    if (error) {
      alert('Gagal Masuk: ' + error.message);
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <Image source={IMG_BG} style={styles.backgroundImage} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40, zIndex: 1 }}
          showsVerticalScrollIndicator={false}
        >
          {!isPageReady ? (
            <LoginSkeleton />
          ) : (
            <>
              <View style={styles.headerSection}>
                <View style={styles.logoCircle}>
                  <Image source={IMG_LOGO} style={styles.logoImage} />
                </View>
                <Text style={styles.brandTitle}>CashGo.</Text>
                <Text style={styles.brandSubtitle}>Silakan masuk untuk mengelola transaksi dan tokomu</Text>
              </View>

              <View style={styles.formSection}>
                <Text style={styles.inputLabel}>ALAMAT EMAIL</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={20} color="#A1A1AA" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Masukkan email anda"
                    placeholderTextColor="#A1A1AA"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <Text style={styles.inputLabel}>KATA SANDI</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color="#A1A1AA" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Masukkan kata sandi"
                    placeholderTextColor="#A1A1AA"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={secureText}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setSecureText(!secureText)}>
                    <Ionicons name={secureText ? "eye-off-outline" : "eye-outline"} size={20} color="#71717A" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
                  {loading
                    ? <ActivityIndicator color="#FFFFFF" />
                    : <Text style={styles.loginButtonText}>MASUK SEKARANG</Text>
                  }
                </TouchableOpacity>
              </View>

              <View style={styles.footerSection}>
                <Text style={styles.footerText}>Belum punya akun kasir? </Text>
                <TouchableOpacity onPress={() => router.push('/auth/register')}>
                  <Text style={styles.registerLink}>Daftar</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  keyboardView: { flex: 1 },
  backgroundImage: {
    position: 'absolute', right: -100, top: 150,
    width: 550, height: 550, opacity: 0.13,
    transform: [{ rotate: '30deg' }], resizeMode: 'contain', zIndex: 0,
  },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40, zIndex: 1 },
  headerSection: { alignItems: 'center', marginBottom: 35 },
  logoCircle: { width: 80, height: 80, backgroundColor: '#F45B26', borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#FFEDD5' },
  logoImage: { width: 50, height: 50, resizeMode: 'contain' },
  brandTitle: { fontSize: 22, fontWeight: '900', color: '#18181B', letterSpacing: -0.5 },
  brandSubtitle: { fontSize: 13, fontWeight: '600', color: '#71717A', textAlign: 'center', marginTop: 6, paddingHorizontal: 20, lineHeight: 18 },
  formSection: { marginBottom: 25 },
  inputLabel: { fontSize: 10, fontWeight: '800', color: '#71717A', letterSpacing: 1, marginBottom: 8 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E4E7', borderRadius: 14, paddingHorizontal: 14, height: 54, marginBottom: 18 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, color: '#18181B', fontSize: 14, fontWeight: '600' },
  loginButton: { backgroundColor: '#F45B26', height: 54, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 10, shadowColor: '#F45B26', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  loginButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  footerSection: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  footerText: { fontSize: 13, fontWeight: '600', color: '#71717A' },
  registerLink: { fontSize: 13, fontWeight: '800', color: '#F45B26' },
});