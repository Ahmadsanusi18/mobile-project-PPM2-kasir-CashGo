import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { HapticTab } from '@/components/haptic-tab';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#F45B26',
        tabBarInactiveTintColor: isDark ? '#71717A' : '#A1A1AA',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          borderTopWidth: 1,
          borderColor: isDark ? '#27272A' : '#F4F4F5',
          elevation: 0,
          height: Platform.OS === 'ios' ? 88 : 72,
          paddingBottom: Platform.OS === 'ios' ? 32 : 14,
          paddingTop: 8,
          backgroundColor: isDark ? '#121212' : '#FFFFFF',
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: isDark ? 0.2 : 0.03,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontWeight: '800',
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: 0.3,
          marginTop: 4,
        },
      }}>

      {/* 1. Dashboard */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="house" size={24} color={color} solid />
          ),
        }}
      />

      {/* 2. Riwayat Transaksi */}
      <Tabs.Screen
        name="transaksi"
        options={{
          title: 'Transaksi',
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="receipt" size={24} color={color} solid />
          ),
        }}
      />

      {/* 3. Kasir */}
      <Tabs.Screen
        name="kasir"
        options={{
          title: 'Kasir',
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="cash-register" size={24} color={color} solid />
          ),
        }}
      />

      {/* 4. Manajemen Produk */}
{/* 4. Manajemen Produk */}
<Tabs.Screen
  name="produk"
  options={{
    title: 'Produk',
    tabBarIcon: ({ color }) => (
      <FontAwesome6 name="barcode" size={24} color={color} />
    ),
  }}
/>

      {/* 5. Profil Kasir */}
      <Tabs.Screen
        name="profil"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="circle-user" size={24} color={color} solid />
          ),
        }}
      />

      {/* 6. Explore — disembunyikan */}
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          href: null,
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="paper-plane" size={24} color={color} solid />
          ),
        }}
      />

    </Tabs>
  );
}