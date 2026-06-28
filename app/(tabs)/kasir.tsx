import { useIsFocused } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useLocalSearchParams } from 'expo-router';

// ─── Safe import native BT module (hanya aktif di APK, tidak crash di Expo Go) ──
let ThermalPrinter: any = null;
try {
  ThermalPrinter = require('react-native-thermal-receipt-printer-image-qr').default;
} catch (_) {
  ThermalPrinter = null;
}

const { width } = Dimensions.get('window');
const cardWidth = (width - 50) / 2;

interface BTDevice {
  inner_mac_address: string;
  device_name: string;
}

export default function CashierScreen() {
  const [products, setProducts]         = useState<any[]>([]);
  const [filtered, setFiltered]         = useState<any[]>([]);
  const [cart, setCart]                 = useState<any[]>([]);
  const [search, setSearch]             = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerWA, setCustomerWA]     = useState('');
  const [cashAmount, setCashAmount]     = useState('');
  const [loading, setLoading]           = useState(true);
  const [showCashInput, setShowCashInput] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successTrxCode, setSuccessTrxCode]     = useState('');

  // Draft
  const [showDraftModal, setShowDraftModal]         = useState(false);
  const [draftCustomerName, setDraftCustomerName]   = useState('');
  const [savingDraft, setSavingDraft]               = useState(false);

  // Bluetooth
  const [btDevices, setBtDevices]               = useState<BTDevice[]>([]);
  const [selectedPrinter, setSelectedPrinter]   = useState<BTDevice | null>(null);
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [scanning, setScanning]                 = useState(false);
  const [printing, setPrinting]                 = useState(false);

  // Apakah BT module tersedia (hanya di APK build)
  const btAvailable = ThermalPrinter !== null;

  const { draftId, draftItems, draftCustomer } = useLocalSearchParams<{
    draftId?: string;
    draftItems?: string;
    draftCustomer?: string;
  }>();

  const draftLoaded = useRef(false);
  const isFocused   = useIsFocused();

  useEffect(() => { if (isFocused) fetchProducts(); }, [isFocused]);

  useEffect(() => {
    if (!loading && products.length > 0 && draftItems && !draftLoaded.current) {
      try {
        draftLoaded.current = true;
        const parsedItems: any[] = JSON.parse(draftItems);
        const merged = parsedItems.reduce((acc: any[], d: any) => {
          const live = products.find(p => p.id === d.id);
          acc.push(live ? { ...live, qty: d.qty } : d);
          return acc;
        }, []);
        setCart(merged);
        if (draftCustomer) setCustomerName(draftCustomer);
        Alert.alert('DRAFT DILANJUTKAN', `${merged.length} item berhasil dimuat.`);
      } catch {
        Alert.alert('GAGAL', 'Gagal memuat data draft.');
      }
    }
  }, [loading, products, draftItems]);

  const fetchProducts = async () => {
    setLoading(true);
    const { data } = await supabase.from('products').select('*').order('name');
    setProducts(data || []);
    setFiltered(data || []);
    setLoading(false);
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const handleSearch     = (t: string) => { setSearch(t); setFiltered(products.filter(p => p.name.toLowerCase().includes(t.toLowerCase()))); };
  const formatThousand   = (t: string) => { const c = t.replace(/[^0-9]/g, ''); return c ? parseInt(c, 10).toLocaleString('id-ID') : ''; };
  const handleCashChange = (t: string) => setCashAmount(formatThousand(t));
  const handleWAChange   = (t: string) => setCustomerWA(t.replace(/[^0-9]/g, ''));

  const updateCart = (item: any, qty: number) => {
    const inCart = cart.find(i => i.id === item.id)?.qty || 0;
    if (qty > 0 && inCart >= item.stock) { Alert.alert('STOK HABIS', `Stok ${item.name.toUpperCase()} tidak mencukupi.`); return; }
    setCart(prev => {
      const exist = prev.find(i => i.id === item.id);
      if (exist) return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + qty } : i).filter(i => i.qty > 0);
      return qty > 0 ? [...prev, { ...item, qty: 1 }] : prev;
    });
  };

  const getDiscountAmount  = (item: any) => (!item.discount ? 0 : Math.round(item.price * Math.min(item.discount, 100) / 100) * item.qty);
  const getItemFinalPrice  = (item: any) => (item.price * item.qty) - getDiscountAmount(item);
  const getDiscountedUnit  = (item: any) => (!item.discount ? item.price : item.price - Math.round(item.price * Math.min(item.discount, 100) / 100));

  const totalDiscount = cart.reduce((s, i) => s + getDiscountAmount(i), 0);
  const totalAmount   = cart.reduce((s, i) => s + getItemFinalPrice(i), 0);
  const totalItems    = cart.reduce((s, i) => s + i.qty, 0);
  const parsedCash    = parseFloat(cashAmount.replace(/[^0-9]/g, '')) || 0;
  const changeAmount  = parsedCash - totalAmount;

  // ─── Bluetooth Permission (Android) ──────────────────────────────────────
  const requestBTPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    try {
      if (Platform.Version >= 31) {
        const res = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
        return Object.values(res).every(r => r === PermissionsAndroid.RESULTS.GRANTED);
      }
      const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      return r === PermissionsAndroid.RESULTS.GRANTED;
    } catch { return false; }
  };

  // ─── Scan Printer BT ─────────────────────────────────────────────────────
  const scanPrinters = async () => {
    if (!btAvailable) {
      Alert.alert('INFO', 'Bluetooth printer hanya tersedia di APK build.\nDi Expo Go, struk akan dibagikan via share sheet.');
      return;
    }
    const ok = await requestBTPermission();
    if (!ok) { Alert.alert('IZIN DITOLAK', 'Izin Bluetooth diperlukan.'); return; }
    setScanning(true);
    setBtDevices([]);
    try {
      const devices: BTDevice[] = await ThermalPrinter.getBluetoothDeviceList();
      if (!devices?.length) {
        Alert.alert('TIDAK ADA PRINTER', 'Tidak ada perangkat ditemukan.\nPastikan printer menyala & sudah dipair di Pengaturan Bluetooth HP.');
      } else {
        setBtDevices(devices);
      }
    } catch {
      Alert.alert('ERROR', 'Gagal memindai Bluetooth.');
    } finally {
      setScanning(false);
    }
  };

  // ─── ESC/POS text builder untuk 58mm (32 char per baris) ─────────────────
  const rowLR = (left: string, right: string, len = 32) => {
    const space = Math.max(1, len - left.length - right.length);
    return left + ' '.repeat(space) + right;
  };

  const buildEscLines = (
    items: any[], trxCode: string, custName: string, custWA: string,
    cash: number, change: number, total: number, disc: number,
  ): string[] => {
    const DIV = '--------------------------------';
    const lines: string[] = [
      '[C]<b>CashGo.</b>',
      '[C]Jl. Cijaku Lebak Banten',
      ...(trxCode ? [`[C]NO.TRX: ${trxCode}`] : []),
      `[L]${DIV}`,
      `[L]${rowLR('PELANGGAN', ': ' + (custName || 'UMUM').toUpperCase())}`,
      ...(custWA ? [`[L]${rowLR('NO. WA', ': ' + custWA)}`] : []),
      `[L]${rowLR('TANGGAL', ': ' + new Date().toLocaleDateString('id-ID'))}`,
      `[L]${rowLR('WAKTU', ': ' + new Date().toLocaleTimeString('id-ID'))}`,
      `[L]${DIV}`,
    ];

    items.forEach(i => {
      const d = getDiscountAmount(i), f = getItemFinalPrice(i);
      lines.push(`[L]<b>${i.name.toUpperCase()}</b>`);
      lines.push(`[L]${rowLR(`${i.qty} x ${i.price.toLocaleString('id-ID')}`, (i.price * i.qty).toLocaleString('id-ID'))}`);
      if (d > 0) {
        lines.push(`[L]${rowLR(`DISKON ${i.discount}%`, '-' + d.toLocaleString('id-ID'))}`);
        lines.push(`[L]<b>${rowLR('SUBTOTAL', f.toLocaleString('id-ID'))}</b>`);
      }
    });

    lines.push(`[L]${DIV}`);
    if (disc > 0) lines.push(`[L]${rowLR('TOTAL DISKON', '-' + disc.toLocaleString('id-ID'))}`);
    lines.push(`[L]<b>${rowLR('TOTAL', 'Rp ' + total.toLocaleString('id-ID'))}</b>`);
    lines.push(`[L]${DIV}`);
    lines.push(`[L]${rowLR('METODE', ': CASH')}`);
    lines.push(`[L]${rowLR('BAYAR', ': Rp ' + cash.toLocaleString('id-ID'))}`);
    lines.push(`[L]${rowLR('KEMBALI', ': Rp ' + change.toLocaleString('id-ID'))}`);
    lines.push(`[L]${DIV}`);
    lines.push('[C]TERIMA KASIH');
    lines.push('[C]ATAS KUNJUNGAN ANDA');
    lines.push('[L] ', '[L] ', '[L] '); // feed kertas
    return lines;
  };

  // ─── HTML untuk fallback share PDF ───────────────────────────────────────
  const buildHTML = (
    items: any[], trxCode: string, custName: string, custWA: string,
    cash: number, change: number, total: number, disc: number,
  ) => `
    <html><head><style>
      @page{margin:0;}body{margin:0;padding:8px;font-family:'Courier New',monospace;font-size:12px;width:58mm;}
      .c{text-align:center;}.d{border-top:1px dotted #000;margin:6px 0;}
      .r{display:flex;justify-content:space-between;}.b{font-weight:bold;}
      .red{color:#c0392b;font-size:10px;}
    </style></head><body>
      <div class="c"><b style="font-size:14px;">CashGo.</b><br><span style="font-size:10px;">Jl. Cijaku Lebak Banten</span></div>
      ${trxCode ? `<div class="c" style="font-size:9px;color:#555;">NO. TRX: ${trxCode}</div>` : ''}
      <div class="d"></div>
      <div style="font-size:10px;">
        <div class="r"><span>PELANGGAN</span><span>: ${(custName||'UMUM').toUpperCase()}</span></div>
        ${custWA ? `<div class="r"><span>NO. WA</span><span>: ${custWA}</span></div>` : ''}
        <div class="r"><span>TANGGAL</span><span>: ${new Date().toLocaleDateString('id-ID')}</span></div>
        <div class="r"><span>WAKTU</span><span>: ${new Date().toLocaleTimeString('id-ID')}</span></div>
      </div>
      <div class="d"></div>
      ${items.map(i => {
        const d = getDiscountAmount(i), f = getItemFinalPrice(i);
        return `
          <div class="r"><span class="b">${i.name.toUpperCase()}</span></div>
          <div class="r"><span>${i.qty} x ${i.price.toLocaleString('id-ID')}</span><span>${(i.price*i.qty).toLocaleString('id-ID')}</span></div>
          ${d > 0 ? `
            <div class="r red"><span>DISKON ${i.discount}%</span><span>-${d.toLocaleString('id-ID')}</span></div>
            <div class="r b"><span>SUBTOTAL</span><span>${f.toLocaleString('id-ID')}</span></div>` : ''}`;
      }).join('')}
      <div class="d"></div>
      ${disc>0?`<div class="r red"><span>TOTAL DISKON</span><span>-${disc.toLocaleString('id-ID')}</span></div>`:''}
      <div class="r b" style="font-size:14px;"><span>TOTAL</span><span>${total.toLocaleString('id-ID')}</span></div>
      <div class="d"></div>
      <div style="font-size:10px;">
        <div class="r"><span>METODE</span><span>: CASH</span></div>
        <div class="r"><span>BAYAR</span><span>: ${cash.toLocaleString('id-ID')}</span></div>
        <div class="r"><span>KEMBALI</span><span>: ${change.toLocaleString('id-ID')}</span></div>
      </div>
      <div class="d"></div>
      <div class="c" style="margin-top:12px;font-size:10px;">TERIMA KASIH<br>ATAS KUNJUNGAN ANDA</div>
    </body></html>`;

  // ─── Print via BT ────────────────────────────────────────────────────────
  const printViaBluetooth = async (
    items: any[], trxCode: string, custName: string, custWA: string,
    cash: number, change: number, total: number, disc: number,
  ): Promise<boolean> => {
    if (!selectedPrinter) return false;
    setPrinting(true);
    try {
      await ThermalPrinter.connectBluetoothPrinter(selectedPrinter.inner_mac_address);
      const lines = buildEscLines(items, trxCode, custName, custWA, cash, change, total, disc);
      for (const text of lines) {
        await ThermalPrinter.printBluetooth({
          text,
          mmFeedPaper: 5,
          printerDpi: 203,
          printerWidthMM: 58,
          printerNbrCharactersPerLine: 32,
        });
      }
      return true;
    } catch (e: any) {
      Alert.alert('GAGAL CETAK', `Printer error.\n${e?.message || 'Pastikan printer menyala & terhubung.'}`);
      return false;
    } finally {
      setPrinting(false);
    }
  };

  // ─── Print via Share PDF (fallback Expo Go / jika tidak pilih printer) ───
  const printViaShare = async (
    items: any[], trxCode: string, custName: string, custWA: string,
    cash: number, change: number, total: number, disc: number,
  ): Promise<boolean> => {
    try {
      const html = buildHTML(items, trxCode, custName, custWA, cash, change, total, disc);
      const h    = 440 + items.length * 55;
      const { uri } = await Print.printToFileAsync({ html, width: 164, height: h });
      await Sharing.shareAsync(uri);
      return true;
    } catch {
      Alert.alert('GAGAL', 'Gagal membuat PDF struk.');
      return false;
    }
  };

  // ─── Draft ────────────────────────────────────────────────────────────────
  const saveDraft = async () => {
    if (!cart.length) return;
    setSavingDraft(true);
    try {
      const { error } = await supabase.from('drafts').insert([{
        customer_name: draftCustomerName || 'UMUM',
        total_amount: totalAmount,
        items: cart.map(i => ({ ...i, discount_pct: i.discount||0, discount_amount: getDiscountAmount(i), final_price: getItemFinalPrice(i) })),
        created_at: new Date().toISOString(),
      }]);
      if (error) throw error;
      setCart([]); setCustomerName(''); setCustomerWA('');
      setDraftCustomerName(''); setShowDraftModal(false);
      Alert.alert('DRAFT TERSIMPAN', `Draft "${draftCustomerName || 'UMUM'}" berhasil disimpan.`);
    } catch { Alert.alert('GAGAL', 'Tidak dapat menyimpan draft.'); }
    finally { setSavingDraft(false); }
  };

  // ─── MAIN: Proses transaksi ───────────────────────────────────────────────
  const processPayment = async () => {
    if (!cart.length) return;
    if (parsedCash < totalAmount) { Alert.alert('UANG KURANG', 'Nominal uang kurang dari total.'); return; }

    // Jika APK + BT available tapi belum pilih printer → minta pilih
    if (btAvailable && !selectedPrinter) {
      Alert.alert(
        'PILIH PRINTER',
        'Belum ada printer Bluetooth yang dipilih.\nCetak via share PDF saja?',
        [
          { text: 'PILIH PRINTER', onPress: () => { setShowPrinterModal(true); } },
          { text: 'SHARE PDF', onPress: () => doTransaction(false) },
          { text: 'BATAL', style: 'cancel' },
        ]
      );
      return;
    }

    await doTransaction(btAvailable && !!selectedPrinter);
  };

  const doTransaction = async (useBluetooth: boolean) => {
    const cartSnap   = [...cart];
    const totalSnap  = totalAmount;
    const discSnap   = totalDiscount;
    const cashSnap   = parsedCash;
    const changeSnap = changeAmount;
    const custSnap   = customerName;
    const waSnap     = customerWA;

    let transactionCode = '';

    // 1. Simpan ke DB
    try {
      const { data: trxData, error: trxError } = await supabase
        .from('transactions')
        .insert([{
          customer_name:  custSnap || 'UMUM',
          total_amount:   totalSnap,
          payment_method: 'CASH',
          phone_number:   waSnap ? Number(waSnap) : null,
          items: cartSnap.map(i => ({
            ...i,
            discount_pct:    i.discount || 0,
            discount_amount: getDiscountAmount(i),
            final_price:     getItemFinalPrice(i),
          })),
        }])
        .select('transaction_code')
        .single();

      if (trxError) throw trxError;
      transactionCode = trxData?.transaction_code ?? '';

      for (const item of cartSnap) {
        const { error: se } = await supabase.from('products').update({ stock: item.stock - item.qty }).eq('id', item.id);
        if (se) throw se;
      }
      if (draftId) await supabase.from('drafts').delete().eq('id', draftId);
    } catch {
      Alert.alert('DATABASE ERROR', 'Gagal memproses transaksi.');
      return;
    }

    // 2. Cetak
    let printed = false;
    if (useBluetooth) {
      printed = await printViaBluetooth(cartSnap, transactionCode, custSnap, waSnap, cashSnap, changeSnap, totalSnap, discSnap);
      // Jika BT gagal, tawarkan fallback PDF
      if (!printed) {
        Alert.alert('FALLBACK', 'Cetak Bluetooth gagal. Share via PDF?', [
          { text: 'YA', onPress: () => printViaShare(cartSnap, transactionCode, custSnap, waSnap, cashSnap, changeSnap, totalSnap, discSnap) },
          { text: 'TIDAK', style: 'cancel' },
        ]);
      }
    } else {
      printed = await printViaShare(cartSnap, transactionCode, custSnap, waSnap, cashSnap, changeSnap, totalSnap, discSnap);
    }

    // 3. Reset & sukses
    await fetchProducts();
    setCart([]); setCustomerName(''); setCustomerWA('');
    setCashAmount(''); setShowCashInput(false);
    setSuccessTrxCode(transactionCode);
    setShowSuccessModal(true);
    setTimeout(() => setShowSuccessModal(false), 3000);
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.container}>

        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.welcomeText}>STORE POS</Text>
            <Text style={styles.title}>CASHIER</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {/* Tombol printer - hanya muncul jika BT tersedia (APK) */}
            {btAvailable && (
              <TouchableOpacity
                style={[styles.printerBtn, selectedPrinter && styles.printerBtnActive]}
                onPress={() => { setShowPrinterModal(true); scanPrinters(); }}
              >
                <Ionicons name="print-outline" size={14} color={selectedPrinter ? '#FFF' : '#18181B'} />
                <Text style={[styles.printerBtnText, selectedPrinter && { color: '#FFF' }]}>
                  {selectedPrinter ? selectedPrinter.device_name.slice(0, 10) : 'PRINTER'}
                </Text>
              </TouchableOpacity>
            )}
            <View style={[styles.badge, draftId ? { backgroundColor: '#F45B26' } : {}]}>
              <Text style={styles.badgeText}>{totalItems} ITEMS</Text>
            </View>
          </View>
        </View>

        {/* SEARCH */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={16} color="#A1A1AA" style={{ marginLeft: 14 }} />
          <TextInput placeholder="Cari produk di toko..." placeholderTextColor="#A1A1AA" style={styles.search} value={search} onChangeText={handleSearch} />
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#F45B26" style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={filtered}
            numColumns={2}
            key={2}
            columnWrapperStyle={{ justifyContent: 'space-between' }}
            contentContainerStyle={{ paddingBottom: showCashInput ? 440 : 190, paddingTop: 5 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            renderItem={({ item }) => {
              const currentQty     = cart.find(i => i.id === item.id)?.qty || 0;
              const remainingStock = item.stock - currentQty;
              const hasDiscount    = item.discount > 0;
              const discUnit       = getDiscountedUnit(item);
              return (
                <View style={[styles.card, currentQty > 0 && styles.activeCard]}>
                  <View style={styles.imgWrapper}>
                    <Image source={{ uri: item.image_url }} style={styles.img} />
                    {hasDiscount && <View style={styles.discBadge}><Text style={styles.discBadgeText}>{item.discount}%</Text></View>}
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.pName} numberOfLines={1}>{item.name.toUpperCase()}</Text>
                    {hasDiscount ? (
                      <View>
                        <Text style={styles.pPriceOriginal}>Rp {item.price.toLocaleString()}</Text>
                        <Text style={styles.pPriceDisc}>Rp {discUnit.toLocaleString()}</Text>
                      </View>
                    ) : (
                      <Text style={styles.pPrice}>Rp {item.price.toLocaleString()}</Text>
                    )}
                    <Text style={[styles.pStock, { color: remainingStock <= 2 ? '#EF4444' : '#71717A' }]}>
                      STOCK: {item.stock > 0 ? remainingStock : 'HABIS'}
                    </Text>
                  </View>
                  <View style={styles.qtyRowMain}>
                    <TouchableOpacity onPress={() => updateCart(item, -1)} style={styles.qBtnMinus}>
                      <Ionicons name="remove" size={16} color="#18181B" />
                    </TouchableOpacity>
                    <Text style={styles.qtyVal}>{currentQty}</Text>
                    <TouchableOpacity onPress={() => updateCart(item, 1)} style={[styles.qBtnPlus, item.stock <= 0 && styles.qBtnDisabled]} disabled={item.stock <= 0}>
                      <Ionicons name="add" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>PRODUK TIDAK DITEMUKAN</Text></View>}
          />
        )}

        {/* FOOTER */}
        {cart.length > 0 && (
          <View style={styles.footer}>
            {showCashInput && (
              <View style={styles.cashCalculationBox}>
                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>NAMA PELANGGAN</Text>
                  <View style={styles.inputBox}>
                    <Ionicons name="person-outline" size={14} color="#F45B26" style={{ marginRight: 6 }} />
                    <TextInput placeholder="Nama / UMUM" placeholderTextColor="#A1A1AA" style={styles.inputField} value={customerName} onChangeText={setCustomerName} returnKeyType="next" />
                  </View>
                </View>
                <View style={styles.inputRow}>
                  <View style={styles.inputLabelRow}>
                    <Text style={styles.inputLabel}>NO. WHATSAPP</Text>
                    <View style={styles.optionalBadge}><Text style={styles.optionalText}>OPSIONAL</Text></View>
                  </View>
                  <View style={styles.inputBox}>
                    <Ionicons name="logo-whatsapp" size={14} color="#25D366" style={{ marginRight: 6 }} />
                    <TextInput placeholder="08xxxxxxxxxx" placeholderTextColor="#A1A1AA" style={styles.inputField} value={customerWA} onChangeText={handleWAChange} keyboardType="phone-pad" returnKeyType="next" maxLength={15} />
                  </View>
                </View>
                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>UANG TUNAI</Text>
                  <View style={styles.inputBox}>
                    <Text style={styles.currencyPrefix}>Rp</Text>
                    <TextInput style={styles.inputField} placeholder="0" placeholderTextColor="#A1A1AA" keyboardType="numeric" value={cashAmount} onChangeText={handleCashChange} returnKeyType="done" onSubmitEditing={Keyboard.dismiss} />
                  </View>
                </View>
                <View style={styles.changeRow}>
                  <Text style={styles.changeLabel}>UANG KEMBALIAN</Text>
                  <Text style={[styles.changeValue, { color: changeAmount >= 0 && parsedCash > 0 ? '#4CAF50' : '#F44336' }]}>
                    Rp {changeAmount >= 0 && parsedCash > 0 ? changeAmount.toLocaleString('id-ID') : '0'}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.totalRow}>
              <View>
                <Text style={styles.totalLabel}>TOTAL PEMBAYARAN</Text>
                {totalDiscount > 0 && <Text style={styles.savingText}>HEMAT Rp {totalDiscount.toLocaleString('id-ID')}</Text>}
                <Text style={styles.customerPreview}>{customerName ? `AN: ${customerName.toUpperCase()}` : 'PELANGGAN UMUM'}</Text>
              </View>
              <Text style={styles.totalValue}>Rp {totalAmount.toLocaleString('id-ID')}</Text>
            </View>

            <View style={styles.actionRow}>
              {showCashInput ? (
                <>
                  <TouchableOpacity style={[styles.payBtn, { backgroundColor: '#F4F4F5', borderWidth: 1, borderColor: '#E4E4E7' }]} onPress={() => { setShowCashInput(false); setCashAmount(''); setCustomerWA(''); Keyboard.dismiss(); }}>
                    <Text style={[styles.payBtnText, { color: '#71717A' }]}>BATAL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.payBtn, { backgroundColor: printing ? '#D4D4D8' : '#F45B26' }]} onPress={processPayment} disabled={printing}>
                    {printing
                      ? <ActivityIndicator size="small" color="#FFF" />
                      : <>
                          <Ionicons name={btAvailable && selectedPrinter ? 'print' : 'share-social'} size={14} color="#FFF" style={{ marginRight: 5 }} />
                          <Text style={styles.payBtnText}>{btAvailable && selectedPrinter ? 'CETAK STRUK' : 'BAYAR & SHARE'}</Text>
                        </>
                    }
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity style={styles.draftSaveBtn} onPress={() => { setDraftCustomerName(''); setShowDraftModal(true); }}>
                    <Ionicons name="save-outline" size={16} color="#fff" />
                    <Text style={styles.draftSaveBtnText}>DRAFT</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.payBtn, { backgroundColor: '#F45B26', flex: 2 }]} onPress={() => setShowCashInput(true)}>
                    <Text style={styles.payBtnText}>BAYAR TUNAI (CASH)</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        )}

        {/* MODAL PILIH PRINTER BT */}
        <Modal visible={showPrinterModal} transparent animationType="slide" onRequestClose={() => setShowPrinterModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={styles.modalTitle}>PILIH PRINTER</Text>
                <TouchableOpacity onPress={scanPrinters} disabled={scanning}>
                  {scanning
                    ? <ActivityIndicator size="small" color="#F45B26" />
                    : <Ionicons name="refresh" size={20} color="#F45B26" />
                  }
                </TouchableOpacity>
              </View>
              <Text style={styles.modalSubtitle}>Perangkat Bluetooth yang sudah dipair</Text>

              {btDevices.length === 0 && !scanning && (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <Ionicons name="bluetooth-outline" size={36} color="#D4D4D8" />
                  <Text style={{ color: '#A1A1AA', fontWeight: '700', fontSize: 12, marginTop: 10, textAlign: 'center' }}>
                    Belum ada perangkat.{'\n'}Pair printer di Pengaturan HP lalu tekan refresh.
                  </Text>
                </View>
              )}

              {btDevices.map(device => (
                <TouchableOpacity
                  key={device.inner_mac_address}
                  style={[styles.deviceItem, selectedPrinter?.inner_mac_address === device.inner_mac_address && styles.deviceItemActive]}
                  onPress={() => { setSelectedPrinter(device); setShowPrinterModal(false); }}
                >
                  <Ionicons name="print-outline" size={18} color={selectedPrinter?.inner_mac_address === device.inner_mac_address ? '#F45B26' : '#71717A'} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.deviceName, selectedPrinter?.inner_mac_address === device.inner_mac_address && { color: '#F45B26' }]}>
                      {device.device_name}
                    </Text>
                    <Text style={styles.deviceMac}>{device.inner_mac_address}</Text>
                  </View>
                  {selectedPrinter?.inner_mac_address === device.inner_mac_address && (
                    <Ionicons name="checkmark-circle" size={18} color="#F45B26" />
                  )}
                </TouchableOpacity>
              ))}

              <TouchableOpacity style={[styles.modalBtnCancel, { marginTop: 16 }]} onPress={() => setShowPrinterModal(false)}>
                <Text style={styles.modalBtnCancelText}>TUTUP</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* MODAL SUKSES */}
        <Modal visible={showSuccessModal} transparent animationType="fade" onRequestClose={() => setShowSuccessModal(false)}>
          <View style={styles.successOverlay}>
            <View style={styles.successBox}>
              <View style={styles.successIconCircle}>
                <Ionicons name="checkmark" size={40} color="#FFF" />
              </View>
              <Text style={styles.successTitle}>TRANSAKSI BERHASIL!</Text>
              {successTrxCode ? <Text style={styles.successTrxCode}>NO. TRX: {successTrxCode}</Text> : null}
              <Text style={styles.successSub}>
                {btAvailable && selectedPrinter ? 'Struk tercetak otomatis ke printer' : 'Struk dibagikan via share sheet'}
              </Text>
            </View>
          </View>
        </Modal>

        {/* MODAL DRAFT */}
        <Modal visible={showDraftModal} transparent animationType="slide" onRequestClose={() => setShowDraftModal(false)}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <View style={styles.modalBox}>
                <Text style={styles.modalTitle}>SIMPAN DRAFT</Text>
                <Text style={styles.modalSubtitle}>{cart.length} item · Rp {totalAmount.toLocaleString('id-ID')}</Text>
                <View style={styles.modalInputBox}>
                  <Ionicons name="person-outline" size={16} color="#F45B26" style={{ marginRight: 8 }} />
                  <TextInput placeholder="Nama pelanggan / UMUM" placeholderTextColor="#A1A1AA" style={styles.modalInput} value={draftCustomerName} onChangeText={setDraftCustomerName} autoFocus />
                </View>
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowDraftModal(false)}>
                    <Text style={styles.modalBtnCancelText}>BATAL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalBtnSave} onPress={saveDraft} disabled={savingDraft}>
                    {savingDraft ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.modalBtnSaveText}>SIMPAN DRAFT</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>

      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 20 },
  header:              { marginTop: Platform.OS === 'ios' ? 60 : 40, marginBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  welcomeText:         { fontSize: 11, fontWeight: '700', color: '#71717A', letterSpacing: 1.5 },
  title:               { fontSize: 32, fontWeight: '900', color: '#18181B', letterSpacing: -1 },
  badge:               { backgroundColor: '#18181B', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  badgeText:           { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  searchContainer:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4F4F5', borderRadius: 14, height: 48, borderWidth: 1, borderColor: '#E4E4E7', marginBottom: 15 },
  search:              { flex: 1, paddingHorizontal: 10, fontSize: 14, fontWeight: '600', color: '#18181B' },
  card:                { width: cardWidth, backgroundColor: '#FFFFFF', borderRadius: 22, padding: 12, marginBottom: 15, borderWidth: 1, borderColor: '#E4E4E7' },
  activeCard:          { borderColor: '#F45B26', borderWidth: 1.5, backgroundColor: '#FFFDFB' },
  imgWrapper:          { position: 'relative', marginBottom: 10 },
  img:                 { width: '100%', height: 110, borderRadius: 15, backgroundColor: '#F4F4F5' },
  discBadge:           { position: 'absolute', top: 6, right: 6, backgroundColor: '#EF4444', borderRadius: 7, paddingHorizontal: 6, paddingVertical: 3 },
  discBadgeText:       { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  cardInfo:            { marginBottom: 10, alignItems: 'flex-start', paddingHorizontal: 2 },
  pName:               { fontSize: 13, fontWeight: '800', color: '#18181B', marginBottom: 1 },
  pPrice:              { fontSize: 12, fontWeight: '700', color: '#F45B26', marginBottom: 1 },
  pPriceOriginal:      { fontSize: 10, color: '#A1A1AA', textDecorationLine: 'line-through' },
  pPriceDisc:          { fontSize: 12, fontWeight: '800', color: '#F45B26', marginBottom: 1 },
  pStock:              { fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
  qtyRowMain:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F4F4F5', padding: 4, borderRadius: 12 },
  qBtnMinus:           { backgroundColor: '#FFFFFF', width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E4E4E7' },
  qBtnPlus:            { backgroundColor: '#F45B26', width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  qBtnDisabled:        { backgroundColor: '#D4D4D8' },
  qtyVal:              { fontWeight: '900', fontSize: 13, color: '#18181B' },
  cashCalculationBox:  { backgroundColor: '#FFFDFB', borderRadius: 18, padding: 15, borderWidth: 1, borderColor: '#FFEDD5', marginBottom: 15 },
  inputRow:            { marginBottom: 12 },
  inputLabelRow:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  inputLabel:          { fontSize: 10, fontWeight: '900', color: '#71717A', letterSpacing: 0.5, marginBottom: 6 },
  optionalBadge:       { backgroundColor: '#F4F4F5', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: '#E4E4E7' },
  optionalText:        { fontSize: 8, fontWeight: '800', color: '#A1A1AA', letterSpacing: 0.3 },
  inputBox:            { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E4E7', borderRadius: 10, height: 38, paddingHorizontal: 10 },
  inputField:          { flex: 1, fontSize: 13, fontWeight: '700', color: '#18181B', padding: 0 },
  currencyPrefix:      { fontSize: 13, fontWeight: '700', color: '#71717A', marginRight: 4 },
  changeRow:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderColor: '#F4F4F5', paddingTop: 10 },
  changeLabel:         { fontSize: 10, fontWeight: '900', color: '#71717A', letterSpacing: 0.5 },
  changeValue:         { fontSize: 16, fontWeight: '900' },
  footer:              { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 22, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderColor: '#E4E4E7', paddingBottom: Platform.OS === 'ios' ? 35 : 22, borderTopLeftRadius: 26, borderTopRightRadius: 26, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 10 },
  totalRow:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  totalLabel:          { fontSize: 10, fontWeight: '800', color: '#71717A', letterSpacing: 0.5 },
  savingText:          { fontSize: 11, fontWeight: '800', color: '#22C55E', marginTop: 1 },
  customerPreview:     { fontSize: 11, fontWeight: '800', color: '#F45B26', marginTop: 1 },
  totalValue:          { fontSize: 26, fontWeight: '900', color: '#18181B' },
  actionRow:           { flexDirection: 'row', gap: 10 },
  payBtn:              { flex: 1, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  payBtnText:          { color: '#FFFFFF', fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },
  draftSaveBtn:        { flex: 1, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, backgroundColor: '#000000' },
  draftSaveBtnText:    { color: '#ffffff', fontWeight: '900', fontSize: 12, letterSpacing: 0.5 },
  printerBtn:          { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F4F4F5', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#E4E4E7' },
  printerBtnActive:    { backgroundColor: '#22C55E', borderColor: '#22C55E' },
  printerBtnText:      { fontSize: 10, fontWeight: '900', color: '#18181B' },
  modalOverlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBox:            { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 24, paddingBottom: Platform.OS === 'ios' ? 42 : 24 },
  modalTitle:          { fontSize: 16, fontWeight: '900', color: '#18181B', marginBottom: 4, letterSpacing: 0.3 },
  modalSubtitle:       { fontSize: 12, fontWeight: '700', color: '#71717A', marginBottom: 16, letterSpacing: 0.3 },
  modalInputBox:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4F4F5', borderRadius: 14, height: 50, paddingHorizontal: 14, marginBottom: 20, borderWidth: 1, borderColor: '#E4E4E7' },
  modalInput:          { flex: 1, fontSize: 14, fontWeight: '700', color: '#18181B' },
  modalActions:        { flexDirection: 'row', gap: 10 },
  modalBtnCancel:      { flex: 1, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F4F5', borderWidth: 1, borderColor: '#E4E4E7' },
  modalBtnCancelText:  { color: '#71717A', fontWeight: '900', fontSize: 13 },
  modalBtnSave:        { flex: 2, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F45B26' },
  modalBtnSaveText:    { color: '#FFFFFF', fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },
  deviceItem:          { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E4E4E7', marginBottom: 8, backgroundColor: '#FAFAFA' },
  deviceItemActive:    { borderColor: '#F45B26', backgroundColor: '#FFF8F5' },
  deviceName:          { fontSize: 13, fontWeight: '800', color: '#18181B' },
  deviceMac:           { fontSize: 10, fontWeight: '600', color: '#A1A1AA', marginTop: 2 },
  emptyContainer:      { padding: 40, alignItems: 'center' },
  emptyText:           { color: '#A1A1AA', fontWeight: '800', fontSize: 12 },
  successOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  successBox:          { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 32, alignItems: 'center', width: width * 0.78, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 20 },
  successIconCircle:   { width: 76, height: 76, borderRadius: 38, backgroundColor: '#22C55E', justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  successTitle:        { fontSize: 16, fontWeight: '900', color: '#18181B', letterSpacing: 0.3, marginBottom: 6, textAlign: 'center' },
  successTrxCode:      { fontSize: 11, fontWeight: '700', color: '#71717A', letterSpacing: 1, marginBottom: 8 },
  successSub:          { fontSize: 12, fontWeight: '600', color: '#A1A1AA', textAlign: 'center', lineHeight: 18 },
});