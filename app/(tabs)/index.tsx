import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Dimensions, FlatList, Image, Animated, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useIsFocused } from '@react-navigation/native';

const screenWidth = Dimensions.get('window').width;
const LOW_STOCK_THRESHOLD = 5;
const CREATOR_INSTAGRAM_URL = 'https://www.instagram.com/a.saan_/';

const tipsData = [
  { id: '1', title: 'Cek Stok', desc: 'Selalu periksa ketersediaan barang sebelum memulai input transaksi.' },
  { id: '2', title: 'Input Teliti', desc: 'Pastikan jumlah barang dan harga sudah sesuai sebelum cetak struk.' },
  { id: '3', title: 'Kebersihan', desc: 'Jaga kebersihan area meja kasir agar pelayanan lebih nyaman.' },
  { id: '4', title: 'Keamanan', desc: 'Segera kunci layar atau logout jika meninggalkan meja kasir.' },
  { id: '5', title: 'Laporan', desc: 'Lakukan rekap harian secara rutin agar saldo kas tetap akurat.' },
];

export default function DashboardScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const [todaySales, setTodaySales] = useState(0);
  const [todayOrders, setTodayOrders] = useState(0);
  const [userName, setUserName] = useState('Kasir');

  const [weeklyChange, setWeeklyChange] = useState({ value: 0, isPositive: true });
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [newCustomersThisWeek, setNewCustomersThisWeek] = useState(0);

  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [lowStockCount, setLowStockCount] = useState(0);

  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (isFocused) {
      fetchTodayStats();
      fetchUserData();
      fetchWeeklyTrend();
      fetchCustomerInsight();
      fetchLowStockProducts();
    }
  }, [isFocused]);

  const fetchUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.user_metadata?.full_name) {
      setUserName(user.user_metadata.full_name);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      const nextIndex = (activeIndex + 1) % tipsData.length;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setActiveIndex(nextIndex);
    }, 3000);
    return () => clearInterval(timer);
  }, [activeIndex]);

  const fetchTodayStats = async () => {
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const endOfToday = new Date(today.setHours(23, 59, 59, 999)).toISOString();

    const { data, error } = await supabase
      .from('transactions')
      .select('total_amount')
      .gte('created_at', startOfToday)
      .lte('created_at', endOfToday);

    if (!error && data) {
      const total = data.reduce((sum, item) => sum + item.total_amount, 0);
      setTodaySales(total);
      setTodayOrders(data.length);
    }
  };

  const fetchWeeklyTrend = async () => {
    const now = new Date();
    const queryEndDate = new Date(now);
    queryEndDate.setHours(23, 59, 59, 999);

    const queryStartDate = new Date(queryEndDate);
    queryStartDate.setDate(queryEndDate.getDate() - 6);
    queryStartDate.setHours(0, 0, 0, 0);

    const compareStartDate = new Date(queryStartDate);
    compareStartDate.setDate(compareStartDate.getDate() - 7);

    const { data, error } = await supabase
      .from('transactions')
      .select('created_at, total_amount')
      .gte('created_at', compareStartDate.toISOString())
      .lte('created_at', queryEndDate.toISOString());

    if (!error && data) {
      const currentPeriod = data.filter(item => new Date(item.created_at) >= queryStartDate);
      const pastPeriod = data.filter(item => new Date(item.created_at) < queryStartDate);

      const totalCurrent = currentPeriod.reduce((sum, item) => sum + item.total_amount, 0);
      const totalPast = pastPeriod.reduce((sum, item) => sum + item.total_amount, 0);

      if (totalPast > 0) {
        const change = ((totalCurrent - totalPast) / totalPast) * 100;
        setWeeklyChange({
          value: Math.abs(parseFloat(change.toFixed(1))),
          isPositive: change >= 0,
        });
      } else {
        setWeeklyChange({ value: totalCurrent > 0 ? 100 : 0, isPositive: true });
      }
    }
  };

  const fetchCustomerInsight = async () => {
    const { count: total, error: totalError } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true });

    if (!totalError && total !== null) {
      setTotalCustomers(total);
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const { count: newCount, error: newError } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo.toISOString());

    if (!newError && newCount !== null) {
      setNewCustomersThisWeek(newCount);
    }
  };

  const fetchLowStockProducts = async () => {
    const { data, count, error } = await supabase
      .from('products')
      .select('id, name, stock', { count: 'exact' })
      .lte('stock', LOW_STOCK_THRESHOLD)
      .order('stock', { ascending: true })
      .limit(3);

    if (!error && data) {
      setLowStockProducts(data);
      setLowStockCount(count || data.length);
    }
  };

  const handleOpenCreatorLink = async () => {
    try {
      await Linking.openURL(CREATOR_INSTAGRAM_URL);
    } catch (e) {
      console.error('Gagal membuka link:', e);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Selamat Bekerja,</Text>
          <Text style={styles.profileName}>{userName}</Text>
        </View>

        <View style={styles.brandContainer}>
          <Image source={require('../../assets/images/T-Oren2.png')} style={styles.brandLogo} />
          <Text style={styles.brandName}>CashGo.</Text>
        </View>
      </View>

      <View style={styles.todayCard}>
        <Image source={require('../../assets/icons/dompet.png')} style={styles.walletBackground} />
        <View style={styles.todayHeaderRow}>
          <Text style={styles.todayLabel}>PENDAPATAN HARI INI</Text>
        </View>
        <Text style={styles.todayValue}>Rp {todaySales.toLocaleString()}</Text>
        <View style={styles.divider} />
        <View style={styles.todayFooter}>
          <View style={styles.todayFooterItem}>
            <Ionicons name="receipt-outline" size={16} color="#FFF5F2" />
            <Text style={styles.todayFooterText}>{todayOrders} Transaksi Sukses</Text>
          </View>
          <Text style={styles.liveBadge}>LIVE</Text>
        </View>
      </View>

      {/* KARTU RINGKASAN */}
      <Text style={styles.sectionTitle}>RINGKASAN</Text>
      <View style={styles.insightRow}>
        <TouchableOpacity style={styles.insightCard} onPress={() => router.push('/diagram')} activeOpacity={0.8}>
          <View style={styles.insightCardTop}>
            <View style={[styles.insightIconBox, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="bar-chart" size={18} color="#2563EB" />
            </View>
            <Ionicons name="chevron-forward" size={16} color="#D4D4D8" />
          </View>
          <Text style={styles.insightLabel}>Tren minggu ini</Text>
          <View style={styles.insightValueRow}>
            <Ionicons
              name={weeklyChange.isPositive ? 'trending-up' : 'trending-down'}
              size={16}
              color={weeklyChange.isPositive ? '#16A34A' : '#DC2626'}
            />
            <Text style={styles.insightValue}>
              {weeklyChange.isPositive ? 'Naik' : 'Turun'} {weeklyChange.value}%
            </Text>
          </View>
          <Text style={styles.insightSubtext}>dibanding minggu lalu</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.insightCard} onPress={() => router.push('/customer')} activeOpacity={0.8}>
          <View style={styles.insightCardTop}>
            <View style={[styles.insightIconBox, { backgroundColor: '#FDF2F8' }]}>
              <Ionicons name="people" size={18} color="#DB2777" />
            </View>
            <Ionicons name="chevron-forward" size={16} color="#D4D4D8" />
          </View>
          <Text style={styles.insightLabel}>Customer terdaftar</Text>
          <Text style={styles.insightValue}>{totalCustomers} orang</Text>
          <Text style={styles.insightSubtext}>
            {newCustomersThisWeek > 0 ? `+${newCustomersThisWeek} baru minggu ini` : 'Belum ada penambahan'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.bigSectionTitle}>TIPS KASIR</Text>
      <View style={styles.carouselContainer}>
        <FlatList
          ref={flatListRef}
          data={tipsData}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
          scrollEventThrottle={16}
          renderItem={({ item }) => (
            <View style={styles.carouselCard}>
              <View style={styles.iconCircle}><Ionicons name="bulb" size={28} color="#F45B26" /></View>
              <View style={{ marginLeft: 15, flex: 1 }}>
                <Text style={styles.bannerTitle}>{item.title}</Text>
                <Text style={styles.bannerDesc}>{item.desc}</Text>
              </View>
            </View>
          )}
        />
        <View style={styles.pagination}>
          {tipsData.map((_, i) => {
            const width = scrollX.interpolate({
              inputRange: [(i - 1) * screenWidth, i * screenWidth, (i + 1) * screenWidth],
              outputRange: [8, 24, 8],
              extrapolate: 'clamp',
            });
            const opacity = scrollX.interpolate({
              inputRange: [(i - 1) * screenWidth, i * screenWidth, (i + 1) * screenWidth],
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });
            return <Animated.View key={i} style={[styles.dot, { width, opacity }]} />;
          })}
        </View>
      </View>

      {/* STOK MENIPIS */}
      {lowStockProducts.length > 0 && (
        <View style={{ marginBottom: 30 }}>
          <View style={styles.lowStockHeaderRow}>
            <Text style={styles.bigSectionTitle}>STOK MENIPIS</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/produk')}>
              <Text style={styles.seeAllText}>Lihat Semua</Text>
            </TouchableOpacity>
          </View>

          <View style={{ gap: 8 }}>
            {lowStockProducts.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.lowStockCard}
                onPress={() => router.push('/(tabs)/produk')}
                activeOpacity={0.8}
              >
                <View style={styles.lowStockIconBox}>
                  <Ionicons name="alert-circle" size={18} color="#A32D2D" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lowStockName}>{item.name}</Text>
                  <Text style={styles.lowStockSubtext}>Sisa stok</Text>
                </View>
                <Text style={styles.lowStockValue}>{item.stock}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {lowStockCount > lowStockProducts.length && (
            <Text style={styles.lowStockMoreText}>
              +{lowStockCount - lowStockProducts.length} produk lain juga menipis
            </Text>
          )}
        </View>
      )}

      {/* FOOTER CREDIT */}
      <View style={styles.footerContainer}>
        <Text style={styles.footerText}>
          <Text style={styles.footerTextBold}>CashGo</Text> | Aplikasi kasir Buatan Saya
        </Text>
        <TouchableOpacity onPress={handleOpenCreatorLink} activeOpacity={0.7} style={styles.footerCreditRow}>
          <Ionicons name="logo-instagram" size={16} color="#71717A" />
          <Text style={styles.footerCreditText}>a.saan_</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 20 },
  header: { marginTop: Platform.OS === 'ios' ? 60 : 40, marginBottom: 25, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  welcomeText: { fontSize: 13, fontWeight: '700', color: '#71717A', letterSpacing: 0.5 },
  profileName: { fontSize: 22, fontWeight: '900', color: '#18181B', letterSpacing: -0.5, marginTop: 2 },

  brandContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandLogo: { width: 32, height: 32, resizeMode: 'contain' },
  brandName: { fontSize: 16, fontWeight: '900', color: '#18181B' },

  todayCard: { backgroundColor: '#F45B26', padding: 22, borderRadius: 24, marginBottom: 25, shadowColor: '#F45B26', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 5, overflow: 'hidden' },
  walletBackground: { position: 'absolute', right: -30, top: -20, width: 180, height: 180, resizeMode: 'contain', opacity: 0.8, transform: [{ rotate: '25deg' }] },
  todayHeaderRow: { marginBottom: 8 },
  todayLabel: { fontSize: 11, fontWeight: '900', color: '#FFDDD1', letterSpacing: 1 },
  todayValue: { fontSize: 30, fontWeight: '900', color: '#FFFFFF', marginTop: 5, letterSpacing: -0.5 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 15 },
  todayFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  todayFooterItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  todayFooterText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  liveBadge: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', backgroundColor: 'rgba(0,0,0,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  sectionTitle: { fontSize: 13, fontWeight: '900', color: '#18181B', marginBottom: 15, letterSpacing: 0.5 },
  bigSectionTitle: { fontSize: 18, fontWeight: '900', color: '#18181B', marginBottom: 15, marginTop: 10 },

  insightRow: { flexDirection: 'row', gap: 12, marginBottom: 25 },
  insightCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  insightCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  insightIconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  insightLabel: { fontSize: 11, fontWeight: '700', color: '#71717A', marginBottom: 4 },
  insightValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  insightValue: { fontSize: 16, fontWeight: '900', color: '#18181B' },
  insightSubtext: { fontSize: 11, fontWeight: '600', color: '#A1A1AA', marginTop: 4 },

  carouselContainer: { marginBottom: 40 },
  carouselCard: { width: screenWidth - 40, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FFEDD5', padding: 24, borderRadius: 22 },
  iconCircle: { width: 56, height: 56, backgroundColor: '#FFE4D1', borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  bannerTitle: { fontSize: 16, fontWeight: '800', color: '#18181B' },
  bannerDesc: { fontSize: 13, fontWeight: '500', color: '#71717A', marginTop: 4, lineHeight: 18 },
  pagination: { flexDirection: 'row', justifyContent: 'center', marginTop: 15, alignItems: 'center' },
  dot: { height: 8, borderRadius: 4, backgroundColor: '#F45B26', marginHorizontal: 4 },

  lowStockHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  seeAllText: { fontSize: 12, fontWeight: '700', color: '#F45B26', marginTop: -10 },
  lowStockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    gap: 12,
  },
  lowStockIconBox: {
    width: 36, height: 36,
    borderRadius: 10,
    backgroundColor: '#FCEBEB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lowStockName: { fontSize: 13, fontWeight: '700', color: '#18181B' },
  lowStockSubtext: { fontSize: 11, fontWeight: '600', color: '#A1A1AA', marginTop: 2 },
  lowStockValue: { fontSize: 18, fontWeight: '900', color: '#A32D2D' },
  lowStockMoreText: { fontSize: 11, fontWeight: '600', color: '#A1A1AA', textAlign: 'center', marginTop: 10 },

  // STYLE FOOTER - SEBAGIAN BOLD, SEBAGIAN NORMAL
  footerContainer: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 40,
    gap: 6,
  },
  footerText: {
    fontSize: 13,
    fontWeight: '400',
    color: '#A1A1AA',
  },
  footerTextBold: {
    fontWeight: '800',
    color: '#71717A',
  },
  footerCreditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerCreditText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#71717A',
  },
});