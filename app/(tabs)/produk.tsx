import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity,
  StyleSheet, Modal, TextInput, Alert, ScrollView,
  Platform, useWindowDimensions, ActivityIndicator
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

export default function ManageScreen() {
  const [products, setProducts] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({
    id: '', name: '', price: '', stock: '', image_url: '', discount: '0'
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 10;

  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);

  const isFocused = useIsFocused();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  useEffect(() => {
    if (isFocused) { setPage(0); fetchProducts(0, true); }
  }, [isFocused]);

  const fetchProducts = async (pageNum: number, reset = false) => {
    setLoading(true);
    const from = pageNum * PAGE_SIZE;
    const { data } = await supabase
      .from('products').select('*')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (data) {
      setProducts(reset ? data : [...products, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoading(false);
  };

  const handleSearch = async (text: string) => {
    setSearch(text);
    if (!text.trim()) {
      setIsSearchMode(false);
      setPage(0);
      fetchProducts(0, true);
      return;
    }
    setIsSearchMode(true);
    setSearching(true);
    const q = text.trim().toLowerCase();
    const { data } = await supabase
      .from('products')
      .select('*')
      .or(`name.ilike.%${q}%,product_code.ilike.%${q}%`)
      .order('name');
    setProducts(data || []);
    setHasMore(false);
    setSearching(false);
  };

  const clearSearch = () => {
    setSearch('');
    setIsSearchMode(false);
    setPage(0);
    fetchProducts(0, true);
  };

  const loadMore = () => {
    if (!loading && hasMore && !isSearchMode) {
      const next = page + 1;
      setPage(next);
      fetchProducts(next);
    }
  };

  // ── PICK IMAGE (simpan URI lokal untuk preview) ────────────────────────
  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.5
    });
    if (!res.canceled) {
      setForm({ ...form, image_url: res.assets[0].uri });
    }
  };

  // ── UPLOAD KE SUPABASE STORAGE ────────────────────────────────────────
  const uploadImage = async (uri: string): Promise<string | null> => {
    try {
      setUploading(true);
      const fileName = `product_${Date.now()}.jpg`;

      const response = await fetch(uri);
      const blob = await response.blob();

      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
      });

      const { error } = await supabase.storage
        .from('products')
        .upload(fileName, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (error) {
        console.error('Upload error:', error);
        return null;
      }

      const { data } = supabase.storage
        .from('products')
        .getPublicUrl(fileName);

      return data.publicUrl;
    } catch (e) {
      console.error('Upload failed:', e);
      return null;
    } finally {
      setUploading(false);
    }
  };

  // ── SAVE ──────────────────────────────────────────────────────────────
  const save = async () => {
    if (!form.name || !form.price || !form.stock)
      return Alert.alert("Error", "Isi nama, harga, dan stok");

    setLoading(true);
    const discountVal = Math.min(Math.max(parseInt(form.discount || '0'), 0), 100);

    // Jika gambar masih URI lokal (file:// atau content://) → upload dulu
    let finalImageUrl = form.image_url;
    if (
      form.image_url &&
      (form.image_url.startsWith('file://') || form.image_url.startsWith('content://'))
    ) {
      const uploaded = await uploadImage(form.image_url);
      if (uploaded) {
        finalImageUrl = uploaded;
      } else {
        setLoading(false);
        return Alert.alert("Error", "Gagal upload gambar, coba lagi");
      }
    }

    const data = {
      name: form.name.toUpperCase(),
      price: parseInt(form.price),
      stock: parseInt(form.stock),
      discount: discountVal,
      image_url: finalImageUrl
    };

    if (form.id) await supabase.from('products').update(data).eq('id', form.id);
    else await supabase.from('products').insert([data]);

    setLoading(false);
    setModal(false);
    setForm({ id: '', name: '', price: '', stock: '', image_url: '', discount: '0' });
    setPage(0);
    if (isSearchMode && search.trim()) handleSearch(search);
    else fetchProducts(0, true);
  };

  const del = (id: string) => {
    Alert.alert("HAPUS PRODUK", "Tindakan ini tidak bisa dibatalkan.", [
      { text: "BATAL", style: "cancel" },
      { text: "HAPUS", style: 'destructive', onPress: async () => {
        await supabase.from('products').delete().eq('id', id);
        if (isSearchMode && search.trim()) handleSearch(search);
        else fetchProducts(0, true);
      }}
    ]);
  };

  const getDiscountedPrice = (price: string, discount: string) => {
    const p = parseInt(price || '0');
    const d = Math.min(parseInt(discount || '0'), 100);
    return p - Math.round(p * d / 100);
  };

  const DISCOUNT_PRESETS = [0, 5, 10, 15, 20, 25, 50, 65, 70];

  return (
    <View style={styles.container}>
      <View style={[styles.header, isTablet && styles.headerTablet]}>
        <View>
          <Text style={styles.headerLabel}>INVENTORY</Text>
          <Text style={styles.headerTitle}>MANAGE</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModal(true)}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>TAMBAH PRODUK</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons
          name={searching ? 'hourglass-outline' : 'search'}
          size={16}
          color={isSearchMode ? '#F45B26' : '#A1A1AA'}
          style={{ marginLeft: 14 }}
        />
        <TextInput
          placeholder="Cari nama atau kode produk..."
          placeholderTextColor="#A1A1AA"
          style={styles.searchInput}
          value={search}
          onChangeText={handleSearch}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={clearSearch} style={{ paddingHorizontal: 12 }}>
            <Ionicons name="close-circle" size={18} color="#A1A1AA" />
          </TouchableOpacity>
        )}
      </View>

      {isSearchMode && (
        <View style={styles.searchResultInfo}>
          <Ionicons name="filter-outline" size={12} color="#F45B26" />
          <Text style={styles.searchResultText}>
            {products.length} hasil untuk "{search}"
          </Text>
        </View>
      )}

      <FlatList
        data={products}
        key={isTablet ? 'tablet-grid' : 'mobile-list'}
        numColumns={isTablet ? 2 : 1}
        columnWrapperStyle={isTablet ? { gap: 16 } : null}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListFooterComponent={
          !isSearchMode && hasMore && products.length > 0 ? (
            <TouchableOpacity style={styles.moreBtn} onPress={loadMore}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.moreBtnText}>LIHAT SELANJUTNYA</Text>}
            </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={40} color="#E4E4E7" />
              <Text style={styles.emptyText}>
                {isSearchMode ? 'PRODUK TIDAK DITEMUKAN' : 'BELUM ADA PRODUK'}
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const hasDiscount = item.discount > 0;
          const discountedPrice = hasDiscount
            ? item.price - Math.round(item.price * item.discount / 100)
            : item.price;

          return (
            <View style={[styles.itemCard, isTablet && styles.itemCardTablet]}>
              <View style={styles.imgWrapper}>
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={styles.img} />
                ) : (
                  <View style={[styles.img, styles.imgPlaceholder]}>
                    <Ionicons name="image-outline" size={24} color="#A1A1AA" />
                  </View>
                )}
                {hasDiscount && (
                  <View style={styles.imgDiscountBadge}>
                    <Text style={styles.imgDiscountText}>{item.discount}%</Text>
                  </View>
                )}
              </View>

              <View style={styles.itemDetails}>
                {item.product_code && (
                  <View style={styles.productCodeBadge}>
                    <Ionicons name="barcode-outline" size={10} color="#F45B26" />
                    <Text style={styles.productCodeText}>{item.product_code}</Text>
                  </View>
                )}
                <Text style={styles.name} numberOfLines={1}>{item.name.toUpperCase()}</Text>
                {hasDiscount ? (
                  <View>
                    <Text style={styles.priceOriginal}>Rp {item.price.toLocaleString()}</Text>
                    <Text style={styles.priceDiscounted}>Rp {discountedPrice.toLocaleString()}</Text>
                  </View>
                ) : (
                  <Text style={styles.price}>Rp {item.price.toLocaleString()}</Text>
                )}
                <View style={styles.stockBadge}>
                  <Text style={styles.stockText}>Stok: {item.stock ?? 0}</Text>
                </View>
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  onPress={() => {
                    setForm({
                      id: item.id, name: item.name,
                      price: item.price.toString(),
                      stock: (item.stock ?? 0).toString(),
                      image_url: item.image_url || '',
                      discount: (item.discount ?? 0).toString()
                    });
                    setModal(true);
                  }}
                  style={styles.iconBtnEdit}>
                  <Ionicons name="pencil" size={18} color="#007ef4" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => del(item.id)} style={styles.iconBtnDelete}>
                  <Ionicons name="trash" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      <Modal visible={modal} animationType="slide">
        <View style={styles.modalContainer}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
            <Text style={styles.modalTitle}>{form.id ? 'EDIT PRODUCT' : 'NEW PRODUCT'}</Text>

            {form.id && (() => {
              const currentProduct = products.find(p => p.id === form.id);
              return currentProduct?.product_code ? (
                <View style={styles.modalProductCodeBox}>
                  <Ionicons name="barcode-outline" size={16} color="#F45B26" />
                  <View style={{ marginLeft: 10 }}>
                    <Text style={styles.modalProductCodeLabel}>KODE PRODUK</Text>
                    <Text style={styles.modalProductCodeValue}>{currentProduct.product_code}</Text>
                  </View>
                  <View style={styles.modalProductCodeBadge}>
                    <Text style={styles.modalProductCodeBadgeText}>AUTO</Text>
                  </View>
                </View>
              ) : null;
            })()}

            {/* IMAGE PICKER */}
            <TouchableOpacity onPress={pickImage} style={styles.imagePicker}>
              {uploading ? (
                <View style={{ alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator color="#F45B26" size="large" />
                  <Text style={styles.pickerText}>MENGUPLOAD...</Text>
                </View>
              ) : form.image_url ? (
                <Image source={{ uri: form.image_url }} style={styles.previewImg} />
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <Ionicons name="cloud-upload-outline" size={36} color="#A1A1AA" />
                  <Text style={styles.pickerText}>UPLOAD PHOTO</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Tombol hapus gambar */}
            {form.image_url && !uploading && (
              <TouchableOpacity
                onPress={() => setForm({ ...form, image_url: '' })}
                style={styles.removeImageBtn}
              >
                <Ionicons name="trash-outline" size={14} color="#EF4444" />
                <Text style={styles.removeImageText}>HAPUS GAMBAR</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.label}>PRODUCT NAME</Text>
            <TextInput
              placeholder="e.g. Nama Produk" placeholderTextColor="#A1A1AA"
              style={styles.input} value={form.name}
              onChangeText={t => setForm({ ...form, name: t })}
            />

            <View style={[styles.formRow, isTablet && styles.formRowTablet]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>PRICE (RP)</Text>
                <TextInput
                  placeholder="e.g. 15000" placeholderTextColor="#A1A1AA"
                  style={styles.input} keyboardType="numeric"
                  value={form.price} onChangeText={t => setForm({ ...form, price: t })}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>STOCK</Text>
                <TextInput
                  placeholder="e.g. 50" placeholderTextColor="#A1A1AA"
                  style={styles.input} keyboardType="numeric"
                  value={form.stock} onChangeText={t => setForm({ ...form, stock: t })}
                />
              </View>
            </View>

            <View style={styles.discountSection}>
              <View style={styles.discountHeader}>
                <View style={styles.discountTitleRow}>
                  <Ionicons name="pricetag" size={16} color="#F45B26" />
                  <Text style={styles.discountTitle}>DISKON PRODUK</Text>
                </View>
                <View style={[
                  styles.discountStatusBadge,
                  parseInt(form.discount || '0') > 0 ? styles.discountStatusActive : styles.discountStatusOff
                ]}>
                  <Text style={[
                    styles.discountStatusText,
                    parseInt(form.discount || '0') > 0 && { color: '#16A34A' }
                  ]}>
                    {parseInt(form.discount || '0') > 0 ? 'AKTIF' : 'TIDAK AKTIF'}
                  </Text>
                </View>
              </View>

              <Text style={styles.label}>PILIH CEPAT</Text>
              <View style={styles.presetRow}>
                {DISCOUNT_PRESETS.map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.presetBtn, form.discount === p.toString() && styles.presetBtnActive]}
                    onPress={() => setForm({ ...form, discount: p.toString() })}
                  >
                    <Text style={[styles.presetBtnText, form.discount === p.toString() && styles.presetBtnTextActive]}>
                      {p === 0 ? 'OFF' : `${p}%`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>ATAU KETIK MANUAL (%)</Text>
              <View style={styles.discountInputRow}>
                <View style={styles.discountInputBox}>
                  <TextInput
                    style={styles.discountInput}
                    keyboardType="numeric"
                    value={form.discount}
                    onChangeText={t => {
                      const clean = t.replace(/[^0-9]/g, '');
                      const val = Math.min(parseInt(clean || '0'), 100);
                      setForm({ ...form, discount: val.toString() });
                    }}
                    maxLength={3}
                  />
                  <Text style={styles.discountInputSuffix}>%</Text>
                </View>
                {form.price && parseInt(form.discount || '0') > 0 && (
                  <View style={styles.discountPreview}>
                    <Text style={styles.discountPreviewLabel}>HARGA SETELAH DISKON</Text>
                    <Text style={styles.discountPreviewValue}>
                      Rp {getDiscountedPrice(form.price, form.discount).toLocaleString('id-ID')}
                    </Text>
                    <Text style={styles.discountPreviewSaving}>
                      Hemat Rp {(parseInt(form.price || '0') - getDiscountedPrice(form.price, form.discount)).toLocaleString('id-ID')}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <TouchableOpacity
              onPress={save}
              style={[styles.saveBtn, (loading || uploading) && { opacity: 0.6 }]}
              disabled={loading || uploading}
            >
              {loading || uploading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveBtnText}>SIMPAN PRODUK</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity onPress={() => {
              setModal(false);
              setForm({ id: '', name: '', price: '', stock: '', image_url: '', discount: '0' });
            }}>
              <Text style={styles.cancelBtnText}>BATAL</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 20 },
  header: { marginTop: Platform.OS === 'ios' ? 60 : 40, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerTablet: { paddingHorizontal: 10 },
  headerLabel: { fontSize: 11, fontWeight: '700', color: '#71717A', letterSpacing: 1.5 },
  headerTitle: { fontSize: 32, fontWeight: '900', color: '#18181B', letterSpacing: -1 },
  addBtn: { backgroundColor: '#F45B26', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  addBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4F4F5', borderRadius: 14, height: 48, borderWidth: 1, borderColor: '#E4E4E7', marginBottom: 10 },
  searchInput: { flex: 1, paddingHorizontal: 10, fontSize: 14, fontWeight: '600', color: '#18181B' },
  searchResultInfo: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 12, paddingHorizontal: 2 },
  searchResultText: { fontSize: 11, fontWeight: '700', color: '#F45B26' },
  itemCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, padding: 14, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E4E7' },
  itemCardTablet: { flex: 1, marginBottom: 16 },
  imgWrapper: { position: 'relative' },
  img: { width: 60, height: 60, borderRadius: 12, backgroundColor: '#F4F4F5' },
  imgPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  imgDiscountBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#EF4444', borderRadius: 6, paddingHorizontal: 4, paddingVertical: 2 },
  imgDiscountText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900' },
  itemDetails: { flex: 1, marginLeft: 16 },
  productCodeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: '#FFF0EB', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, marginBottom: 4, borderWidth: 1, borderColor: '#FFCAB0' },
  productCodeText: { fontSize: 10, fontWeight: '900', color: '#F45B26', letterSpacing: 0.3 },
  name: { fontWeight: '800', fontSize: 15, color: '#18181B', letterSpacing: 0.3 },
  price: { color: '#71717A', fontSize: 13, fontWeight: '600', marginTop: 2 },
  priceOriginal: { color: '#A1A1AA', fontSize: 11, fontWeight: '600', textDecorationLine: 'line-through', marginTop: 2 },
  priceDiscounted: { color: '#F45B26', fontSize: 13, fontWeight: '800' },
  stockBadge: { backgroundColor: '#e9fcef', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 6, borderWidth: 0.5, borderColor: '#d5ffd6' },
  stockText: { color: '#000000', fontSize: 11, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 8 },
  iconBtnEdit: { width: 40, height: 40, backgroundColor: '#e6f5f8', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  iconBtnDelete: { width: 40, height: 40, backgroundColor: '#FEF2F2', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { paddingVertical: 60, alignItems: 'center', gap: 12 },
  emptyText: { color: '#A1A1AA', fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  modalContainer: { flex: 1, backgroundColor: '#FFFFFF', padding: 25, paddingTop: Platform.OS === 'ios' ? 60 : 40 },
  modalTitle: { fontSize: 26, fontWeight: '900', color: '#18181B', marginBottom: 20, letterSpacing: -0.5 },
  modalProductCodeBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF0EB', borderRadius: 14, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#FFCAB0' },
  modalProductCodeLabel: { fontSize: 9, fontWeight: '800', color: '#71717A', letterSpacing: 0.8 },
  modalProductCodeValue: { fontSize: 18, fontWeight: '900', color: '#F45B26', letterSpacing: 0.5 },
  modalProductCodeBadge: { marginLeft: 'auto', backgroundColor: '#18181B', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  modalProductCodeBadgeText: { fontSize: 9, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.5 },
  imagePicker: { width: '100%', height: 220, backgroundColor: '#F4F4F5', justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderRadius: 20, borderWidth: 2, borderColor: '#E4E4E7', borderStyle: 'dashed' },
  previewImg: { width: '100%', height: '100%', borderRadius: 18 },
  pickerText: { fontWeight: '700', color: '#A1A1AA', fontSize: 12, marginTop: 8 },
  removeImageBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginBottom: 16, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#FEF2F2', borderRadius: 8, borderWidth: 1, borderColor: '#FECACA' },
  removeImageText: { fontSize: 11, fontWeight: '800', color: '#EF4444' },
  label: { fontSize: 11, fontWeight: '800', color: '#71717A', marginBottom: 8, letterSpacing: 0.8 },
  input: { backgroundColor: '#F4F4F5', padding: 16, borderRadius: 14, marginBottom: 20, fontSize: 15, fontWeight: '600', color: '#18181B' },
  formRow: { flexDirection: 'column' },
  formRowTablet: { flexDirection: 'row', gap: 16 },
  discountSection: { backgroundColor: '#FFFDFB', borderRadius: 20, padding: 18, marginBottom: 24, borderWidth: 1, borderColor: '#FFEDD5' },
  discountHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  discountTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  discountTitle: { fontSize: 14, fontWeight: '900', color: '#18181B', letterSpacing: 0.3 },
  discountStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  discountStatusActive: { backgroundColor: '#DCFCE7' },
  discountStatusOff: { backgroundColor: '#F4F4F5' },
  discountStatusText: { fontSize: 10, fontWeight: '900', color: '#A1A1AA', letterSpacing: 0.5 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  presetBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#E4E4E7', backgroundColor: '#F4F4F5' },
  presetBtnActive: { backgroundColor: '#F45B26', borderColor: '#F45B26' },
  presetBtnText: { fontSize: 12, fontWeight: '800', color: '#71717A' },
  presetBtnTextActive: { color: '#FFFFFF' },
  discountInputRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  discountInputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#F45B26', borderRadius: 14, paddingHorizontal: 16, height: 52, width: 110 },
  discountInput: { flex: 1, fontSize: 22, fontWeight: '900', color: '#18181B', padding: 0 },
  discountInputSuffix: { fontSize: 18, fontWeight: '900', color: '#F45B26' },
  discountPreview: { flex: 1, backgroundColor: '#F0FDF4', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#BBF7D0' },
  discountPreviewLabel: { fontSize: 9, fontWeight: '800', color: '#71717A', letterSpacing: 0.5, marginBottom: 2 },
  discountPreviewValue: { fontSize: 16, fontWeight: '900', color: '#16A34A' },
  discountPreviewSaving: { fontSize: 10, fontWeight: '700', color: '#16A34A', marginTop: 2 },
  saveBtn: { backgroundColor: '#F45B26', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  cancelBtnText: { textAlign: 'center', marginTop: 20, color: '#A1A1AA', fontWeight: '700', fontSize: 14, paddingVertical: 10 },
  moreBtn: { backgroundColor: '#18181B', padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 10 },
  moreBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});