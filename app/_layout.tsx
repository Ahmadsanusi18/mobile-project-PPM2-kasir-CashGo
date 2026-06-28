import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase'; // Pastikan path ke init supabase kamu benar
import { Session } from '@supabase/supabase-js';

const SECTOR_EXPIRY_KEY = 'kasir_shofa_login_time';
const OUT_TIME_LIMIT = 24 * 60 * 60 * 1000; // Batas durasi 24 jam dalam milidetik

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const segments = useSegments();
  const router = useRouter();
  
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // 1. Periksa validitas sesi 24 jam saat aplikasi pertama kali diaktifkan
    const validateSessionDuration = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (currentSession) {
          const loginTimeStr = await AsyncStorage.getItem(SECTOR_EXPIRY_KEY);
          const now = Date.now();

          if (loginTimeStr) {
            const timeElapsed = now - parseInt(loginTimeStr, 10);
            
            // JIKA SUDAH MELEWATI 24 JAM -> Paksa Keluar Otomatis
            if (timeElapsed >= OUT_TIME_LIMIT) {
              await supabase.auth.signOut();
              await AsyncStorage.removeItem(SECTOR_EXPIRY_KEY);
              setSession(null);
              setInitialized(true);
              return;
            }
          } else {
            // Pengaman: Jika session ada tapi timestamp lokal kosong, buat baru
            await AsyncStorage.setItem(SECTOR_EXPIRY_KEY, now.toString());
          }
        }
        setSession(currentSession);
      } catch (error) {
        console.log("Auth Initialization Error:", error);
      } finally {
        setInitialized(true);
      }
    };

    validateSessionDuration();

    // 2. Pantau perubahan status autentikasi secara live (Login/Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      setSession(currentSession);
      
      if (event === 'SIGNED_IN' && currentSession) {
        // Simpan waktu login pertama kali saat kasir sukses masuk
        await AsyncStorage.setItem(SECTOR_EXPIRY_KEY, Date.now().toString());
      } else if (event === 'SIGNED_OUT') {
        // Bersihkan token waktu lokal saat logout manual atau otomatis terjadi
        await AsyncStorage.removeItem(SECTOR_EXPIRY_KEY);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 3. Pengarah Rute Protektif (Navigation Guard)
  useEffect(() => {
    if (!initialized) return;

    const inTabsGroup = segments[0] === '(tabs)';
    const inAuthGroup = segments[0] === 'auth';
    const isWelcomeScreen = [...segments].length === 0 || (segments[0] as string) === 'index';

    // Biarkan welcome screen (app/index.tsx) menyelesaikan tugas animasinya dulu selama 3 detik
    if (isWelcomeScreen) return;

    if (session) {
      // Jika session aktif dan kasir mencoba buka form login/register, lempar langsung ke Dashboard
      if (inAuthGroup) {
        router.replace('/(tabs)');
      }
    } else {
      // Jika tidak ada session / waktu expired 24 jam habis, paksa ke login screen
      if (!inAuthGroup) {
        router.replace('/auth/login');
      }
    }
  }, [session, initialized, segments]);

  // Loading indicator transparan sewaktu sistem membaca internal storage HP
  if (!initialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#F45B26" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        {/* Splash/Welcome Screen di Root */}
        <Stack.Screen name="index" options={{ headerShown: false }} /> 
        
        {/* Sub-folder Authentication */}
        <Stack.Screen name="auth/login" options={{ headerShown: false, animation: 'fade' }} /> 
        <Stack.Screen name="auth/register" options={{ headerShown: false }} /> 

        {/* Workspace Utama Kasir */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="diagram" options={{ headerShown: false }} />
        <Stack.Screen name="draft" options={{ headerShown: false }} />
        <Stack.Screen name="customer" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}