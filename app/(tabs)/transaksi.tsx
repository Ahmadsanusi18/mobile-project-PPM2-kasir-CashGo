import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  TouchableOpacity, Modal, ScrollView, TextInput, useWindowDimensions, Platform
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, { Circle, Rect } from 'react-native-svg';

const WalletIllustration = () => (
  <Svg width="120" height="90" viewBox="0 0 120 90" fill="none">
    <Rect x="8" y="22" width="96" height="58" rx="10" fill="#F4F4F5" />
    <Rect x="8" y="22" width="96" height="58" rx="10" stroke="#E4E4E7" strokeWidth="1.5" />
    <Rect x="8" y="18" width="96" height="18" rx="8" fill="#E4E4E7" />
    <Rect x="72" y="36" width="26" height="30" rx="8" fill="#FFFFFF" stroke="#E4E4E7" strokeWidth="1.5" />
    <Circle cx="85" cy="51" r="8" fill="#F45B26" opacity="0.15" />
    <Circle cx="85" cy="51" r="5" fill="#F45B26" opacity="0.3" />
    <Rect x="18" y="38" width="44" height="7" rx="3.5" fill="#E4E4E7" />
    <Rect x="18" y="50" width="32" height="5" rx="2.5" fill="#F4F4F5" />
    <Rect x="18" y="60" width="38" height="5" rx="2.5" fill="#F4F4F5" />
    <Rect x="5" y="30" width="6" height="34" rx="3" fill="#E4E4E7" />
  </Svg>
);

export default function HistoryScreen() {
  const router = useRouter();
  const [history, setHistory] = useState<any[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [filterType, setFilterType] = useState('TODAY');

  const currentYearActive = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYearActive);

  const availableYears = React.useMemo(() => {
    const years = [];
    for (let y = 2020; y <= currentYearActive; y++) years.push(y);
    return years;
  }, [currentYearActive]);

  const [stats, setStats] = useState({ totalOmzet: 0, totalOrders: 0 });
  const { width } = useWindowDimensions();
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) fetchHistory(filterType, selectedYear);
  }, [isFocused, filterType, selectedYear]);

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (text.trim() === '') {
      setFilteredHistory(history);
    } else {
      setFilteredHistory(history.filter(item =>
        item.customer_name?.toLowerCase().includes(text.toLowerCase()) ||
        item.transaction_code?.toLowerCase().includes(text.toLowerCase()) 
      ));
    }
  };

  const fetchHistory = async (type: string, targetYear: number = currentYearActive) => {
    setLoading(true);
    setSearchQuery('');
    let query = supabase.from('transactions').select('*').order('created_at', { ascending: false });

    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    if (type === 'WEEK') {
      startDate.setDate(now.getDate() - 7);
      query = query.gte('created_at', startDate.toISOString());
    } else if (type === 'MONTH') {
      startDate.setMonth(now.getMonth() - 1);
      query = query.gte('created_at', startDate.toISOString());
    } else if (type === 'YEAR') {
      startDate = new Date(targetYear, 0, 1, 0, 0, 0, 0);
      endDate = new Date(targetYear, 11, 31, 23, 59, 59, 999);
      query = query.gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString());
    } else {
      startDate.setHours(0, 0, 0, 0);
      query = query.gte('created_at', startDate.toISOString());
    }

    const { data, error } = await query;
    if (!error) {
      const logs = data || [];
      setHistory(logs);
      setFilteredHistory(logs);
      setStats(logs.reduce((acc, curr) => ({
        totalOmzet: acc.totalOmzet + curr.total_amount,
        totalOrders: acc.totalOrders + 1,
      }), { totalOmzet: 0, totalOrders: 0 }));
    }
    setLoading(false);
  };

  const renderDashboard = () => (
    <View style={styles.dashboardContainer}>
      <View style={styles.filterRow}>
        {['TODAY', 'WEEK', 'MONTH', 'YEAR'].map((item) => (
          <TouchableOpacity
            key={item}
            onPress={() => { setFilterType(item); if (item === 'YEAR') setSelectedYear(currentYearActive); }}
            style={[styles.filterBtn, filterType === item && styles.filterBtnActive]}
          >
            <Text style={[styles.filterBtnText, filterType === item && styles.filterBtnTextActive]}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {filterType === 'YEAR' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.yearSelectorRow}>
          {availableYears.map(year => (
            <TouchableOpacity
              key={year}
              onPress={() => setSelectedYear(year)}
              style={[styles.yearMiniBtn, selectedYear === year && styles.yearMiniBtnActive]}
            >
              <Text style={[styles.yearMiniBtnText, selectedYear === year && styles.yearMiniBtnTextActive]}>
                {year}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <Text style={styles.sectionTitle}>RINGKASAN PERFORMA</Text>

      <View style={styles.mainStatCard}>
        <Text style={styles.statLabel}>TOTAL OMZET ({filterType === 'YEAR' ? selectedYear : filterType})</Text>
        <Text style={styles.statValue}>Rp {stats.totalOmzet.toLocaleString()}</Text>
        <View style={styles.statFooter}>
          <Ionicons name="receipt-outline" size={14} color="#71717A" />
          <Text style={styles.statSubText}> {stats.totalOrders} Transaksi Sukses</Text>
        </View>
      </View>

      <View style={styles.actionBtnRow}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#F45B26' }]}
          onPress={() => router.push('/diagram')}
        >
          <Ionicons name="bar-chart" size={18} color="#FFFFFF" />
          <Text style={styles.actionBtnText}>GRAFIK</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#18181B' }]}
          onPress={() => router.push('/draft')}
        >
          <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
          <Text style={styles.actionBtnText}>DRAFT</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#ff9500' }]}
          onPress={() => router.push('/customer')}
        >
          <Ionicons name="people" size={18} color="#FFFFFF" />
          <Text style={styles.actionBtnText}>CUST</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.sectionTitle, { marginTop: 25 }]}>DAFTAR RIWAYAT TRANSAKSI</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>BUSINESS REPORT</Text>
          <Text style={styles.headerTitle}>HISTORY</Text>
        </View>
        <TouchableOpacity onPress={() => fetchHistory(filterType, selectedYear)} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={20} color="#F45B26" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#A1A1AA" style={{ marginLeft: 15 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari nama / kode transaksi..."
          value={searchQuery}
          onChangeText={handleSearch}
          placeholderTextColor="#A1A1AA"
          returnKeyType="done"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Ionicons name="close-circle" size={18} color="#A1A1AA" style={{ marginRight: 15 }} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#F45B26" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={filteredHistory}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderDashboard}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => setSelectedTx(item)}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  {/* ✅ KODE TRANSAKSI di atas nama pelanggan */}
                  {item.transaction_code && (
                    <View style={styles.txCodeBadge}>
                      <Ionicons name="receipt-outline" size={10} color="#F45B26" />
                      <Text style={styles.txCodeText}>{item.transaction_code}</Text>
                    </View>
                  )}
                  <Text style={styles.customerName}>{item.customer_name?.toUpperCase() || 'UMUM'}</Text>
                  <Text style={styles.dateTime}>
                    {new Date(item.created_at).toLocaleDateString('id-ID')} • {new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <View style={styles.methodBadge}>
                  <Text style={styles.methodText}>{item.payment_method || 'CASH'}</Text>
                </View>
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.totalAmount}>Rp {item.total_amount.toLocaleString()}</Text>
                <Ionicons name="chevron-forward" size={16} color="#F45B26" />
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <WalletIllustration />
              <Text style={styles.emptyTitle}>BELUM ADA TRANSAKSI</Text>
              <Text style={styles.emptyText}>Transaksi yang berhasil akan{'\n'}muncul di sini</Text>
            </View>
          }
        />
      )}

      {/* MODAL DETAIL */}
      <Modal visible={!!selectedTx} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.detailBox}>
            <View style={styles.detailHeader}>
              <View>
                <Text style={styles.detailTitle}>RECEIPT DETAIL</Text>
                {/* ✅ KODE TRANSAKSI di header modal */}
                {selectedTx?.transaction_code && (
                  <View style={styles.modalTxCodeBadge}>
                    <Ionicons name="receipt-outline" size={11} color="#F45B26" />
                    <Text style={styles.modalTxCodeText}>{selectedTx.transaction_code}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={() => setSelectedTx(null)}>
                <Ionicons name="close-circle" size={32} color="#F45B26" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.receiptPaper}>
                <Text style={styles.receiptStore}>CashGo.</Text>
                <Text style={styles.receiptStoreAddress}>Jl. Cijaku Lebak Banten</Text>

                {/* ✅ KODE TRANSAKSI di dalam receipt */}
                {selectedTx?.transaction_code && (
                  <View style={styles.receiptInfoRow}>
                    <Text style={styles.receiptInfoLabel}>NO. TRANSAKSI</Text>
                    <Text style={[styles.receiptInfoValue, { color: '#F45B26', fontWeight: '900' }]}>
                      {selectedTx.transaction_code}
                    </Text>
                  </View>
                )}

                <View style={styles.receiptInfoRow}>
                  <Text style={styles.receiptInfoLabel}>PELANGGAN</Text>
                  <Text style={styles.receiptInfoValue}>{selectedTx?.customer_name?.toUpperCase() || 'UMUM'}</Text>
                </View>
                <View style={styles.receiptInfoRow}>
                  <Text style={styles.receiptInfoLabel}>TANGGAL</Text>
                  <Text style={styles.receiptInfoValue}>
                    {selectedTx ? new Date(selectedTx.created_at).toLocaleDateString('id-ID') : ''}
                  </Text>
                </View>
                <View style={styles.receiptInfoRow}>
                  <Text style={styles.receiptInfoLabel}>WAKTU</Text>
                  <Text style={styles.receiptInfoValue}>
                    {selectedTx ? new Date(selectedTx.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </Text>
                </View>

                <View style={styles.receiptDivider} />

                {selectedTx?.items?.map((prod: any, idx: number) => {
                  const discPct = prod.discount_pct || prod.discount || 0;
                  const originalTotal = prod.qty * prod.price;
                  const discAmt = prod.discount_amount ?? (discPct > 0 ? Math.round(prod.price * discPct / 100) * prod.qty : 0);
                  const finalPrice = prod.final_price ?? (originalTotal - discAmt);
                  const hasDisc = discPct > 0 || discAmt > 0;

                  return (
                    <View key={idx} style={styles.receiptItem}>
                      <View style={styles.receiptItemHeader}>
                        <Text style={styles.prodName}>{prod.name.toUpperCase()}</Text>
                        {hasDisc && (
                          <View style={styles.receiptDiscBadge}>
                            <Text style={styles.receiptDiscBadgeText}>{discPct}% OFF</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.receiptItemRow}>
                        <Text style={styles.prodSub}>{prod.qty} × Rp {prod.price.toLocaleString()}</Text>
                        <Text style={[styles.prodSubtotal, hasDisc && styles.prodSubtotalStrike]}>
                          Rp {originalTotal.toLocaleString()}
                        </Text>
                      </View>
                      {hasDisc && (
                        <>
                          <View style={styles.receiptItemRow}>
                            <Text style={styles.discLine}>DISKON {discPct}%</Text>
                            <Text style={styles.discLine}>- Rp {discAmt.toLocaleString()}</Text>
                          </View>
                          <View style={styles.receiptItemRow}>
                            <Text style={styles.subtotalLabel}>SUBTOTAL</Text>
                            <Text style={styles.subtotalValue}>Rp {finalPrice.toLocaleString()}</Text>
                          </View>
                        </>
                      )}
                    </View>
                  );
                })}

                <View style={styles.receiptDivider} />

                {(() => {
                  const totalDisc = selectedTx?.items?.reduce((s: number, p: any) => {
                    const discPct = p.discount_pct || p.discount || 0;
                    const discAmt = p.discount_amount ?? (discPct > 0 ? Math.round(p.price * discPct / 100) * p.qty : 0);
                    return s + discAmt;
                  }, 0) || 0;
                  return totalDisc > 0 ? (
                    <View style={[styles.receiptItemRow, { marginBottom: 8 }]}>
                      <Text style={styles.discLine}>TOTAL DISKON</Text>
                      <Text style={styles.discLine}>- Rp {totalDisc.toLocaleString()}</Text>
                    </View>
                  ) : null;
                })()}

                <View style={styles.receiptTotalRow}>
                  <Text style={styles.totalFinalLabel}>TOTAL</Text>
                  <Text style={styles.totalFinalValue}>Rp {selectedTx?.total_amount.toLocaleString()}</Text>
                </View>

                <View style={[styles.receiptInfoRow, { marginTop: 12 }]}>
                  <Text style={styles.receiptInfoLabel}>METODE</Text>
                  <Text style={styles.receiptInfoValue}>{selectedTx?.payment_method || 'CASH'}</Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 20 },
  header: { marginTop: Platform.OS === 'ios' ? 60 : 40, marginBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerLabel: { fontSize: 11, fontWeight: '700', color: '#71717A', letterSpacing: 1.5 },
  headerTitle: { fontSize: 32, fontWeight: '900', color: '#18181B', letterSpacing: -1 },
  refreshBtn: { width: 44, height: 44, backgroundColor: '#FFF7ED', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },

  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4F4F5', borderRadius: 15, marginBottom: 15, height: 50, borderWidth: 1, borderColor: '#E4E4E7' },
  searchInput: { flex: 1, paddingHorizontal: 10, fontSize: 14, fontWeight: '600', color: '#18181B' },

  filterRow: { flexDirection: 'row', backgroundColor: '#F4F4F5', padding: 5, borderRadius: 15, marginBottom: 20 },
  filterBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  filterBtnActive: { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E4E4E7' },
  filterBtnText: { fontSize: 10, fontWeight: '800', color: '#A1A1AA' },
  filterBtnTextActive: { color: '#F45B26' },

  yearSelectorRow: { flexDirection: 'row', paddingBottom: 20, paddingHorizontal: 2 },
  yearMiniBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F4F4F5', borderWidth: 1, borderColor: '#E4E4E7', marginRight: 8 },
  yearMiniBtnActive: { backgroundColor: '#F45B26', borderColor: '#F45B26' },
  yearMiniBtnText: { fontSize: 12, fontWeight: '700', color: '#71717A' },
  yearMiniBtnTextActive: { color: '#FFFFFF' },

  dashboardContainer: { marginBottom: 10 },
  sectionTitle: { fontSize: 11, fontWeight: '900', color: '#18181B', marginBottom: 15, letterSpacing: 0.8 },

  mainStatCard: { padding: 22, borderRadius: 22, borderWidth: 1, borderColor: '#FFEDD5', backgroundColor: '#FFFDFB', marginBottom: 12 },
  statLabel: { color: '#71717A', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  statValue: { color: '#F45B26', fontSize: 32, fontWeight: '900', marginVertical: 6 },
  statFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  statSubText: { color: '#71717A', fontSize: 12, fontWeight: '700' },

  actionBtnRow: { flexDirection: 'row', marginBottom: 12, gap: 10 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 16, paddingVertical: 14 },
  actionBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13, letterSpacing: 0.5, marginLeft: 6 },

  // ✅ KODE TRANSAKSI — card list
  txCodeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#FFF0EB', paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 6, marginBottom: 4,
    borderWidth: 1, borderColor: '#FFCAB0',
  },
  txCodeText: { fontSize: 10, fontWeight: '900', color: '#F45B26', letterSpacing: 0.3 },

  // ✅ KODE TRANSAKSI — modal header
  modalTxCodeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#FFF0EB', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, marginTop: 4, alignSelf: 'flex-start',
    borderWidth: 1, borderColor: '#FFCAB0',
  },
  modalTxCodeText: { fontSize: 12, fontWeight: '900', color: '#F45B26', letterSpacing: 0.3 },

  card: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: '#E4E4E7' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  customerName: { fontSize: 15, fontWeight: '800', color: '#18181B' },
  dateTime: { fontSize: 11, color: '#A1A1AA', fontWeight: '600', marginTop: 2 },
  methodBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#F4F4F5' },
  methodText: { fontSize: 9, fontWeight: '900', color: '#71717A' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  totalAmount: { fontSize: 17, fontWeight: '900', color: '#18181B' },

  empty: { paddingTop: 50, paddingBottom: 30, alignItems: 'center' },
  emptyTitle: { fontSize: 13, fontWeight: '900', color: '#18181B', marginTop: 16, letterSpacing: 0.5 },
  emptyText: { fontSize: 12, fontWeight: '600', color: '#A1A1AA', marginTop: 6, textAlign: 'center', lineHeight: 18 },

  overlay: { flex: 1, backgroundColor: 'rgba(24, 24, 27, 0.4)', justifyContent: 'flex-end' },
  detailBox: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 25, height: '85%' },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 25 },
  detailTitle: { fontWeight: '900', fontSize: 18, color: '#18181B', letterSpacing: -0.5 },

  receiptPaper: { backgroundColor: '#FFFDFB', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#FFEDD5', borderStyle: 'dashed' },
  receiptStore: { textAlign: 'center', fontWeight: '900', fontSize: 18, color: '#F45B26' },
  receiptStoreAddress: { textAlign: 'center', fontSize: 11, color: '#A1A1AA', fontWeight: '600', marginBottom: 14 },
  receiptInfoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  receiptInfoLabel: { fontSize: 11, fontWeight: '700', color: '#A1A1AA' },
  receiptInfoValue: { fontSize: 11, fontWeight: '800', color: '#18181B' },
  receiptDivider: { borderTopWidth: 1, borderColor: '#E4E4E7', borderStyle: 'dashed', marginVertical: 16 },

  receiptItem: { marginBottom: 14 },
  receiptItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  receiptItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  prodName: { fontWeight: '800', fontSize: 14, color: '#18181B', flex: 1 },
  prodSub: { fontSize: 12, color: '#71717A', fontWeight: '600' },
  prodSubtotal: { fontWeight: '800', color: '#18181B', fontSize: 13 },
  prodSubtotalStrike: { textDecorationLine: 'line-through', color: '#A1A1AA', fontSize: 12 },
  receiptDiscBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, marginLeft: 8 },
  receiptDiscBadgeText: { fontSize: 9, fontWeight: '900', color: '#EF4444' },
  discLine: { fontSize: 12, fontWeight: '700', color: '#EF4444' },
  subtotalLabel: { fontSize: 12, fontWeight: '800', color: '#18181B' },
  subtotalValue: { fontSize: 13, fontWeight: '900', color: '#18181B' },
  receiptTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalFinalLabel: { fontWeight: '900', fontSize: 18, color: '#18181B' },
  totalFinalValue: { fontWeight: '900', fontSize: 18, color: '#F45B26' },
});