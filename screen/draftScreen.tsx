import { useIsFocused } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useRouter } from 'expo-router';

export default function DraftsScreen() {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const isFocused = useIsFocused();
  const router = useRouter();

  useEffect(() => {
    if (isFocused) fetchDrafts();
  }, [isFocused]);

  const fetchDrafts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('drafts')
      .select('*')
      .order('created_at', { ascending: false });
    setDrafts(data || []);
    setLoading(false);
  };

  const deleteDraft = (id: string) => {
    Alert.alert('HAPUS DRAFT', 'Yakin ingin menghapus draft ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus', style: 'destructive',
        onPress: async () => {
          await supabase.from('drafts').delete().eq('id', id);
          fetchDrafts();
        }
      }
    ]);
  };

  const continueDraft = (draft: any) => {
    Alert.alert(
      'LANJUTKAN TRANSAKSI',
      `Lanjutkan transaksi untuk ${draft.customer_name?.toUpperCase() || 'UMUM'}?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Lanjutkan',
          onPress: () => {
            router.push({
              pathname: '/(tabs)/kasir',
              params: {
                draftId: draft.id,
                draftItems: JSON.stringify(draft.items || []),
                draftCustomer: draft.customer_name || '',
              },
            });
          }
        }
      ]
    );
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
      + ' · ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={styles.container}>

      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#18181B" />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.welcomeText}>STORE POS</Text>
          <Text style={styles.title}>DRAFT</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{drafts.length} DRAFT</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#F45B26" style={{ marginTop: 50 }} />
      ) : drafts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-outline" size={48} color="#D4D4D8" />
          <Text style={styles.emptyText}>BELUM ADA DRAFT TERSIMPAN</Text>
        </View>
      ) : (
        <FlatList
          data={drafts}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 40, paddingTop: 5 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.cardLeft}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>
                      {(item.customer_name || 'U')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View>
                    {/* ✅ DRAFT CODE di atas nama pelanggan */}
                    {item.draft_code && (
                      <View style={styles.draftCodeBadge}>
                        <Ionicons name="document-outline" size={10} color="#F45B26" />
                        <Text style={styles.draftCodeText}>{item.draft_code}</Text>
                      </View>
                    )}
                    <Text style={styles.customerName}>{item.customer_name?.toUpperCase() || 'UMUM'}</Text>
                    <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => deleteDraft(item.id)} style={styles.deleteBtn}>
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>

              {/* Daftar item dalam draft */}
              <View style={styles.itemList}>
                {(item.items || []).slice(0, 3).map((i: any, idx: number) => (
                  <View key={idx} style={styles.itemRow}>
                    <Text style={styles.itemName} numberOfLines={1}>{i.name?.toUpperCase()}</Text>
                    <Text style={styles.itemQty}>{i.qty}x</Text>
                    <Text style={styles.itemPrice}>Rp {(i.final_price || 0).toLocaleString('id-ID')}</Text>
                  </View>
                ))}
                {item.items?.length > 3 && (
                  <Text style={styles.moreItems}>+{item.items.length - 3} item lainnya</Text>
                )}
              </View>

              <View style={styles.cardBottom}>
                <View>
                  <Text style={styles.totalLabel}>TOTAL</Text>
                  <Text style={styles.totalValue}>Rp {(item.total_amount || 0).toLocaleString('id-ID')}</Text>
                </View>

                <TouchableOpacity
                  style={styles.continueBtn}
                  onPress={() => continueDraft(item)}
                >
                  <Text style={styles.continueBtnText}>LANJUTKAN TRANSAKSI</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 20 },

  headerRow: {
    marginTop: Platform.OS === 'ios' ? 60 : 40,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  backBtn: {
    width: 44, height: 44, backgroundColor: '#F4F4F5',
    borderRadius: 12, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#E4E4E7',
  },
  titleContainer: { flex: 1 },
  welcomeText: { fontSize: 11, fontWeight: '700', color: '#71717A', letterSpacing: 1.5 },
  title: { fontSize: 32, fontWeight: '900', color: '#18181B', letterSpacing: -1 },
  badge: { backgroundColor: '#18181B', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#E4E4E7',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarCircle: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#FFF0EB', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '900', color: '#F45B26' },

  // ✅ DRAFT CODE BADGE
  draftCodeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#FFF0EB', paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 6, marginBottom: 4,
    borderWidth: 1, borderColor: '#FFCAB0',
  },
  draftCodeText: { fontSize: 10, fontWeight: '900', color: '#F45B26', letterSpacing: 0.3 },

  customerName: { fontSize: 14, fontWeight: '900', color: '#18181B' },
  cardDate: { fontSize: 10, fontWeight: '700', color: '#A1A1AA', marginTop: 1 },
  deleteBtn: {
    backgroundColor: '#FEF2F2', padding: 8, borderRadius: 10,
    borderWidth: 1, borderColor: '#FECACA',
  },

  itemList: { backgroundColor: '#F4F4F5', borderRadius: 12, padding: 10, marginBottom: 12, gap: 6 },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  itemName: { flex: 1, fontSize: 11, fontWeight: '800', color: '#18181B' },
  itemQty: { fontSize: 11, fontWeight: '700', color: '#71717A', marginHorizontal: 8 },
  itemPrice: { fontSize: 11, fontWeight: '800', color: '#F45B26' },
  moreItems: { fontSize: 10, fontWeight: '700', color: '#A1A1AA', marginTop: 2 },

  cardBottom: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', borderTopWidth: 1,
    borderColor: '#F4F4F5', paddingTop: 10,
  },
  totalLabel: { fontSize: 10, fontWeight: '900', color: '#71717A', letterSpacing: 0.5 },
  totalValue: { fontSize: 18, fontWeight: '900', color: '#18181B' },

  continueBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F45B26', paddingHorizontal: 14,
    paddingVertical: 9, borderRadius: 12,
  },
  continueBtnText: { fontSize: 11, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.5 },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { color: '#A1A1AA', fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
});