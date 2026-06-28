import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  TouchableOpacity, Platform, TextInput, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import {
  writeAsStringAsync,
  cacheDirectory,
  getInfoAsync,
  EncodingType
} from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const PAGE_SIZE = 20;

export default function CustomerScreen() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const isFocused = useIsFocused();
  const router = useRouter();

  useEffect(() => {
    if (isFocused) fetchCustomers();
  }, [isFocused]);

  const fetchCustomers = async () => {
    setLoading(true);

    // Tabel `customers` tidak ada di database -> data customer dibangun
    // langsung dari tabel `transactions`. TIDAK ADA PENGGABUNGAN sama sekali:
    // setiap baris transaksi = satu entri customer sendiri, walaupun nama
    // dan nomor HP-nya identik dengan transaksi lain.
    const { data: transactionsData, error: transactionsError } = await supabase
      .from('transactions')
      .select('id, customer_name, phone_number, created_at')
      .order('created_at', { ascending: false });

    if (transactionsError) {
      console.log('[CustomerScreen] ERROR fetch transactions:', JSON.stringify(transactionsError, null, 2));
      setCustomers([]);
      setFiltered([]);
      setLoading(false);
      return;
    }

    console.log('[CustomerScreen] transactions fetched:', transactionsData?.length ?? 0, 'rows');

    // Map 1:1 -> setiap transaksi langsung jadi satu item customer terpisah.
    const merged = (transactionsData || []).map((t: any, idx: number) => {
      const rawName = (t.customer_name && t.customer_name.trim()) || 'UMUM';
      const rawPhone = t.phone_number != null ? String(t.phone_number).trim() : '';

      return {
        // Pakai id transaksi asli kalau ada, fallback ke index supaya tetap unik
        id: t.id != null ? String(t.id) : `row-${idx}`,
        name: rawName,
        phone_number: rawPhone || null,
        created_at: t.created_at,
      };
    });

    console.log('[CustomerScreen] total customer rows (no merge):', merged.length);

    setCustomers(merged);
    setFiltered(merged);
    setLoading(false);
  };

  const handleSearch = (text: string) => {
    setSearch(text);
    setCurrentPage(1);
    if (!text.trim()) {
      setFiltered(customers);
      return;
    }
    setFiltered(
      customers.filter(c =>
        c.name?.toLowerCase().includes(text.toLowerCase()) ||
        c.phone_number?.toString().toLowerCase().includes(text.toLowerCase())
      )
    );
  };

  // PAGINATION
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginatedData = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const goToPrev = () => setCurrentPage(p => Math.max(1, p - 1));
  const goToNext = () => setCurrentPage(p => Math.min(totalPages, p + 1));

  // EXPORT CSV
  const handleExportCSV = async () => {
    if (customers.length === 0) {
      Alert.alert('Info', 'Tidak ada data untuk diekspor.');
      return;
    }

    if (!cacheDirectory) {
      Alert.alert('Gagal', 'Cache directory tidak tersedia di perangkat ini.');
      return;
    }

    setExporting(true);
    try {
      const header = 'No,Nama,No HP,Transaksi Terakhir\n';
      const rows = customers.map((c, i) => {
        const tanggal = new Date(c.created_at).toLocaleDateString('id-ID', {
          day: '2-digit', month: 'short', year: 'numeric'
        });
        const name = `"${(c.name || 'UMUM').replace(/"/g, "'")}"`;
        const phone = `"${(c.phone_number ? String(c.phone_number) : '-').replace(/"/g, "'")}"`;
        return `${i + 1},${name},${phone},${tanggal}`;
      }).join('\n');

      const csvContent = header + rows;
      const fileName = `customers_${Date.now()}.csv`;
      const fileUri = cacheDirectory + fileName;

      await writeAsStringAsync(fileUri, csvContent, {
        encoding: EncodingType.UTF8,
      });

      const fileInfo = await getInfoAsync(fileUri);
      if (!fileInfo.exists) throw new Error('File gagal dibuat');

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Data Customer',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('Info', 'File CSV tersimpan di: ' + fileUri);
      }
    } catch (e: any) {
      console.error('Export error:', e);
      Alert.alert('Gagal', e?.message ?? 'Terjadi kesalahan saat mengekspor data.');
    }
    setExporting(false);
  };

  const getInitials = (name: string) => {
    return (name || 'U')
      .split(' ')
      .map((w: string) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric'
    }) + ' · ' + d.toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <View style={styles.container}>

      {/* HEADER */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#18181B" />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.headerLabel}>STORE POS</Text>
          <Text style={styles.headerTitle}>CUSTOMER</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{customers.length} DATA</Text>
        </View>
      </View>

      {/* SEARCH + EXPORT ROW */}
      <View style={styles.searchExportRow}>
        <View style={[styles.searchContainer, { flex: 1 }]}>
          <Ionicons name="search" size={16} color="#A1A1AA" style={{ marginLeft: 14 }} />
          <TextInput
            placeholder="Cari nama atau nomor HP..."
            placeholderTextColor="#A1A1AA"
            style={styles.searchInput}
            value={search}
            onChangeText={handleSearch}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')} style={{ paddingHorizontal: 12 }}>
              <Ionicons name="close-circle" size={18} color="#A1A1AA" />
            </TouchableOpacity>
          )}
        </View>

        {/* EXPORT BUTTON */}
        <TouchableOpacity
          style={styles.exportBtn}
          onPress={handleExportCSV}
          disabled={exporting}
          activeOpacity={0.8}
        >
          {exporting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="download-outline" size={16} color="#FFFFFF" />
              <Text style={styles.exportBtnText}>CSV</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* HASIL PENCARIAN INFO */}
      {search.length > 0 && (
        <View style={styles.searchResultInfo}>
          <Ionicons name="filter-outline" size={12} color="#F45B26" />
          <Text style={styles.searchResultText}>
            {filtered.length} hasil untuk "{search}"
          </Text>
        </View>
      )}

      {/* LIST */}
      {loading ? (
        <ActivityIndicator size="large" color="#F45B26" style={{ marginTop: 50 }} />
      ) : (
        <>
          <FlatList
            data={paginatedData}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 10, paddingTop: 5 }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={48} color="#D4D4D8" />
                <Text style={styles.emptyTitle}>BELUM ADA DATA CUSTOMER</Text>
                <Text style={styles.emptyText}>Data customer akan muncul{'\n'}setelah ada transaksi</Text>
              </View>
            }
            renderItem={({ item, index }) => {
              const globalIndex = (currentPage - 1) * PAGE_SIZE + index + 1;
              return (
                <View style={styles.card}>
                  <View style={styles.cardLeft}>
                    <Text style={styles.indexNumber}>{globalIndex}</Text>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
                    </View>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.customerName}>
                      {item.name?.toUpperCase() || 'UMUM'}
                    </Text>
                    <View style={styles.phoneRow}>
                      <Ionicons name="call-outline" size={12} color="#A1A1AA" />
                      <Text style={styles.phoneText}>{item.phone_number || '-'}</Text>
                    </View>
                    <View style={styles.dateRow}>
                      <Ionicons name="time-outline" size={11} color="#A1A1AA" />
                      <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
                    </View>
                  </View>
                </View>
              );
            }}
          />

          {/* PAGINATION */}
          {totalPages > 1 && (
            <View style={styles.paginationContainer}>
              <TouchableOpacity
                style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]}
                onPress={goToPrev}
                disabled={currentPage === 1}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="chevron-back"
                  size={16}
                  color={currentPage === 1 ? '#D4D4D8' : '#18181B'}
                />
              </TouchableOpacity>

              <View style={styles.pageNumbersRow}>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => {
                    if (totalPages <= 5) return true;
                    if (p === 1 || p === totalPages) return true;
                    if (Math.abs(p - currentPage) <= 1) return true;
                    return false;
                  })
                  .reduce<(number | string)[]>((acc, p, idx, arr) => {
                    if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, idx) =>
                    p === '...'
                      ? <Text key={`dots-${idx}`} style={styles.pageDots}>···</Text>
                      : (
                        <TouchableOpacity
                          key={p}
                          style={[styles.pageNumber, currentPage === p && styles.pageNumberActive]}
                          onPress={() => setCurrentPage(p as number)}
                          activeOpacity={0.7}
                        >
                          <Text style={[
                            styles.pageNumberText,
                            currentPage === p && styles.pageNumberTextActive
                          ]}>
                            {p}
                          </Text>
                        </TouchableOpacity>
                      )
                  )
                }
              </View>

              <TouchableOpacity
                style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]}
                onPress={goToNext}
                disabled={currentPage === totalPages}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={currentPage === totalPages ? '#D4D4D8' : '#18181B'}
                />
              </TouchableOpacity>
            </View>
          )}

          {/* INFO HALAMAN */}
          {filtered.length > 0 && (
            <View style={styles.pageInfoRow}>
              <Text style={styles.pageInfoText}>
                Menampilkan {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} dari {filtered.length} customer
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
  },
  headerRow: {
    marginTop: Platform.OS === 'ios' ? 60 : 40,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  backBtn: {
    width: 44, height: 44,
    backgroundColor: '#F4F4F5',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  titleContainer: { flex: 1 },
  headerLabel: {
    fontSize: 11, fontWeight: '700',
    color: '#71717A', letterSpacing: 1.5,
  },
  headerTitle: {
    fontSize: 32, fontWeight: '900',
    color: '#18181B', letterSpacing: -1,
  },
  badge: {
    backgroundColor: '#18181B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    color: '#FFFFFF', fontSize: 10,
    fontWeight: '900', letterSpacing: 0.5,
  },
  searchExportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F4F5',
    borderRadius: 14,
    height: 48,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 10,
    fontSize: 14,
    fontWeight: '600',
    color: '#18181B',
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#18181B',
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  exportBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  searchResultInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  searchResultText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F45B26',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    gap: 12,
  },
  cardLeft: {
    alignItems: 'center',
    gap: 6,
  },
  indexNumber: {
    fontSize: 10,
    fontWeight: '800',
    color: '#A1A1AA',
    letterSpacing: 0.3,
  },
  avatar: {
    width: 44, height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF0EB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFCAB0',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#F45B26',
  },
  cardInfo: { flex: 1 },
  customerName: {
    fontSize: 14,
    fontWeight: '900',
    color: '#18181B',
    marginBottom: 4,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  phoneText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#71717A',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#A1A1AA',
  },
  paginationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  pageBtn: {
    width: 36, height: 36,
    borderRadius: 10,
    backgroundColor: '#F4F4F5',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageBtnDisabled: {
    backgroundColor: '#FAFAFA',
    borderColor: '#F4F4F5',
  },
  pageNumbersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pageNumber: {
    width: 36, height: 36,
    borderRadius: 10,
    backgroundColor: '#F4F4F5',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageNumberActive: {
    backgroundColor: '#18181B',
    borderColor: '#18181B',
  },
  pageNumberText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#71717A',
  },
  pageNumberTextActive: {
    color: '#FFFFFF',
  },
  pageDots: {
    fontSize: 13,
    fontWeight: '700',
    color: '#A1A1AA',
    paddingHorizontal: 4,
  },
  pageInfoRow: {
    alignItems: 'center',
    paddingBottom: 30,
  },
  pageInfoText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#A1A1AA',
  },
  emptyContainer: {
    paddingTop: 80,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#18181B',
    letterSpacing: 0.5,
    marginTop: 6,
  },
  emptyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#A1A1AA',
    textAlign: 'center',
    lineHeight: 18,
  },
});