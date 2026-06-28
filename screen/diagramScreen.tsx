import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { supabase } from '../lib/supabase';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';

const screenWidth = Dimensions.get('window').width;

export default function AnalyticsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('WEEK'); // WEEK, MONTH, YEAR, CUSTOM
  const [chartData, setChartData] = useState<any[]>([]);
  const [chartData2, setChartData2] = useState<any[]>([]); // dataset kedua (tahun lalu) khusus mode YEAR
  const [totalSales, setTotalSales] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [percentageChange, setPercentageChange] = useState({ value: 0, isPositive: true });

  // STRATEGI DINAMIS TAHUN (Otomatis Mendukung 2026, 2027, dst.)
  const currentYearActive = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYearActive);

  const availableYears = React.useMemo(() => {
    const startYear = 2020;
    const years = [];
    for (let y = startYear; y <= currentYearActive; y++) {
      years.push(y);
    }
    return years;
  }, [currentYearActive]);

  // State Rentang Tanggal Kustom
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 7)));
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) fetchAnalyticsData(filter);
  }, [isFocused, filter, startDate, endDate, selectedYear]);

  const fetchAnalyticsData = async (range: string) => {
    setLoading(true);
    let queryStartDate = new Date();
    let compareStartDate = new Date();
    let queryEndDate = new Date();

    queryEndDate.setHours(23, 59, 59, 999);

    if (range === 'WEEK') {
      queryStartDate.setDate(queryEndDate.getDate() - 6);
      queryStartDate.setHours(0, 0, 0, 0);
      compareStartDate = new Date(queryStartDate);
      compareStartDate.setDate(compareStartDate.getDate() - 7);
    } else if (range === 'MONTH') {
      queryStartDate.setMonth(queryEndDate.getMonth() - 1);
      queryStartDate.setHours(0, 0, 0, 0);
      compareStartDate = new Date(queryStartDate);
      compareStartDate.setMonth(compareStartDate.getMonth() - 1);
    } else if (range === 'YEAR') {
      queryStartDate = new Date(selectedYear, 0, 1, 0, 0, 0, 0);
      queryEndDate = new Date(selectedYear, 11, 31, 23, 59, 59, 999);
      compareStartDate = new Date(selectedYear - 1, 0, 1, 0, 0, 0, 0);
    } else if (range === 'CUSTOM') {
      queryStartDate = new Date(startDate);
      queryStartDate.setHours(0, 0, 0, 0);
      queryEndDate = new Date(endDate);
      queryEndDate.setHours(23, 59, 59, 999);

      const diffTime = Math.abs(queryEndDate.getTime() - queryStartDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      compareStartDate = new Date(queryStartDate);
      compareStartDate.setDate(compareStartDate.getDate() - diffDays);
    }

    const { data, error } = await supabase
      .from('transactions')
      .select('created_at, total_amount')
      .gte('created_at', compareStartDate.toISOString())
      .lte('created_at', queryEndDate.toISOString())
      .order('created_at', { ascending: true });

    if (!error && data) {
      if (range === 'YEAR') {
        processYearlyComparison(data, selectedYear);
      } else {
        const currentPeriodData = data.filter(item => new Date(item.created_at) >= queryStartDate);
        const pastPeriodData = data.filter(item => new Date(item.created_at) < queryStartDate);
        processRealisticData(currentPeriodData, pastPeriodData, range);
      }
    } else {
      setChartData([{ value: 0, label: 'Error' }]);
      setChartData2([]);
    }
    setLoading(false);
  };

  const processRealisticData = (currentData: any[], pastData: any[], range: string) => {
    const totalCurrentSales = currentData.reduce((sum, item) => sum + item.total_amount, 0);
    const totalPastSales = pastData.reduce((sum, item) => sum + item.total_amount, 0);

    setTotalOrders(currentData.length);

    const grouped = currentData.reduce((acc: any, curr: any) => {
      const date = new Date(curr.created_at).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
      });
      acc[date] = (acc[date] || 0) + curr.total_amount;
      return acc;
    }, {});

    const keys = Object.keys(grouped);

    if (keys.length === 0) {
      setTotalSales(0);
      setTotalOrders(0);
      setPercentageChange({ value: 0, isPositive: true });
      setChartData([{ value: 0, label: 'No Data' }]);
      setChartData2([]);
      return;
    }

    const step = Math.ceil(keys.length / 6);
    const displayKeys = keys.filter((_, idx) => idx % step === 0 || idx === keys.length - 1);

    // Format untuk gifted-charts: { value, label, dataPointText }
    const points = displayKeys.map(key => {
      const rawValue = grouped[key] / 1000;
      return {
        value: rawValue,
        label: key,
        dataPointText: rawValue.toFixed(0),
      };
    });

    if (totalPastSales > 0) {
      const change = ((totalCurrentSales - totalPastSales) / totalPastSales) * 100;
      setPercentageChange({
        value: Math.abs(parseFloat(change.toFixed(1))),
        isPositive: change >= 0
      });
    } else {
      setPercentageChange({ value: totalCurrentSales > 0 ? 100 : 0, isPositive: true });
    }

    setTotalSales(totalCurrentSales);
    setChartData(points);
    setChartData2([]);
  };

  const processYearlyComparison = (data: any[], targetYear: number) => {
    const pastYear = targetYear - 1;
    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const currentYearValues = Array(12).fill(0);
    const pastYearValues = Array(12).fill(0);

    let totalCurrentSales = 0;
    let totalPastSales = 0;
    let currentOrders = 0;

    data.forEach(item => {
      const date = new Date(item.created_at);
      const year = date.getFullYear();
      const month = date.getMonth();

      if (year === targetYear) {
        currentYearValues[month] += item.total_amount;
        totalCurrentSales += item.total_amount;
        currentOrders += 1;
      } else if (year === pastYear) {
        pastYearValues[month] += item.total_amount;
        totalPastSales += item.total_amount;
      }
    });

    setTotalOrders(currentOrders);

    if (totalPastSales > 0) {
      const change = ((totalCurrentSales - totalPastSales) / totalPastSales) * 100;
      setPercentageChange({
        value: Math.abs(parseFloat(change.toFixed(1))),
        isPositive: change >= 0
      });
    } else {
      setPercentageChange({ value: totalCurrentSales > 0 ? 100 : 0, isPositive: true });
    }

    setTotalSales(totalCurrentSales);

    // Dataset tahun ini (garis utama, oranye)
    const currentPoints = currentYearValues.map((v, i) => ({
      value: v / 1000,
      label: monthLabels[i],
      dataPointText: (v / 1000).toFixed(0),
    }));

    // Dataset tahun lalu (garis pembanding, abu-abu)
    const pastPoints = pastYearValues.map((v, i) => ({
      value: v / 1000,
      label: monthLabels[i],
    }));

    setChartData(currentPoints);
    setChartData2(pastPoints);
  };

  const onStartDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowStartPicker(false);
    if (selectedDate) setStartDate(selectedDate);
  };

  const onEndDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowEndPicker(false);
    if (selectedDate) setEndDate(selectedDate);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 50 }}>
      {/* HEADER UTAMA DENGAN BUTTON BACK */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#18181B" />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.headerLabel}>STATISTICS</Text>
          <Text style={styles.headerTitle}>ANALYTICS</Text>
        </View>
      </View>

      {/* FILTER TAB */}
      <View style={styles.filterRow}>
        {['WEEK', 'MONTH', 'YEAR', 'CUSTOM'].map((item) => (
          <TouchableOpacity
            key={item}
            onPress={() => setFilter(item)}
            style={[styles.filterBtn, filter === item && styles.filterBtnActive]}
          >
            <Text style={[styles.filterBtnText, filter === item && styles.filterBtnTextActive]}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* SELEKTOR PILIHAN TAHUN */}
      {filter === 'YEAR' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.yearSelectorRow}
        >
          {availableYears.map((year) => (
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

      {/* RENDER FILTER TANGGAL CUSTOM */}
      {filter === 'CUSTOM' && (
        <View style={styles.datePickerContainer}>
          <TouchableOpacity style={styles.dateSelector} onPress={() => setShowStartPicker(!showStartPicker)}>
            <Ionicons name="calendar-outline" size={16} color="#71717A" />
            <View style={{ marginLeft: 8 }}>
              <Text style={styles.dateSelectorLabel}>DARI TANGGAL</Text>
              <Text style={styles.dateSelectorValue}>{startDate.toLocaleDateString('id-ID')}</Text>
            </View>
          </TouchableOpacity>

          <Ionicons name="arrow-forward" size={16} color="#A1A1AA" style={{ alignSelf: 'center' }} />

          <TouchableOpacity style={styles.dateSelector} onPress={() => setShowEndPicker(!showEndPicker)}>
            <Ionicons name="calendar-outline" size={16} color="#71717A" />
            <View style={{ marginLeft: 8 }}>
              <Text style={styles.dateSelectorLabel}>SAMPAI TANGGAL</Text>
              <Text style={styles.dateSelectorValue}>{endDate.toLocaleDateString('id-ID')}</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* POPUP TANGGAL */}
      {filter === 'CUSTOM' && (showStartPicker || showEndPicker) && (
        <View style={styles.pickerOverlayContainer}>
          {showStartPicker && (
            <View style={styles.inlinePickerWrapper}>
              <Text style={styles.pickerTitle}>Pilih Tanggal Mulai</Text>
              <DateTimePicker
                value={startDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
                maximumDate={new Date()}
                onChange={onStartDateChange}
                themeVariant="light"
              />
              {Platform.OS === 'ios' && (
                <TouchableOpacity style={styles.closePickerBtn} onPress={() => setShowStartPicker(false)}>
                  <Text style={styles.closePickerText}>Selesai</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {showEndPicker && (
            <View style={styles.inlinePickerWrapper}>
              <Text style={styles.pickerTitle}>Pilih Tanggal Akhir</Text>
              <DateTimePicker
                value={endDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
                minimumDate={startDate}
                maximumDate={new Date()}
                onChange={onEndDateChange}
                themeVariant="light"
              />
              {Platform.OS === 'ios' && (
                <TouchableOpacity style={styles.closePickerBtn} onPress={() => setShowEndPicker(false)}>
                  <Text style={styles.closePickerText}>Selesai</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#F45B26" style={{ marginTop: 50 }} />
      ) : (
        <View>
          {/* TOTAL CARD */}
          <View style={styles.summaryCard}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.summaryLabel}>TOTAL PENDAPATAN ({filter === 'YEAR' ? selectedYear : filter})</Text>
              <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>Rp {totalSales.toLocaleString()}</Text>
            </View>

            {percentageChange.value > 0 && (
              <View style={[
                styles.badge,
                { backgroundColor: percentageChange.isPositive ? '#E8F5E9' : '#FFEBEE' }
              ]}>
                <Ionicons
                  name={percentageChange.isPositive ? "trending-up" : "trending-down"}
                  size={14}
                  color={percentageChange.isPositive ? "#4CAF50" : "#F44336"}
                />
                <Text style={[
                  styles.badgeText,
                  { color: percentageChange.isPositive ? "#4CAF50" : "#F44336" }
                ]}>
                  {percentageChange.isPositive ? 'Naik' : 'Turun'} {percentageChange.value}%
                </Text>
              </View>
            )}
          </View>

          {/* CHART BOX */}
          <View style={styles.chartBox}>
            <Text style={styles.chartTitle}>Tren Penjualan (dalam ribuan) — geser pada grafik untuk lihat detail</Text>
            {chartData.length > 0 && (
              <LineChart
                data={chartData}
                data2={filter === 'YEAR' ? chartData2 : undefined}
                width={screenWidth - 80}
                height={220}
                thickness={3}
                color="#F45B26"
                color2="#A1A1AA"
                dataPointsColor="#F45B26"
                dataPointsColor2="#A1A1AA"
                dataPointsRadius={4}
                startFillColor="#F45B26"
                startFillColor2="#A1A1AA"
                startOpacity={0.15}
                endOpacity={0.01}
                areaChart
                curved
                isAnimated
                animationDuration={500}
                yAxisTextStyle={{ color: '#A1A1AA', fontSize: 10 }}
                xAxisLabelTextStyle={{ color: '#A1A1AA', fontSize: 10 }}
                xAxisColor="#E4E4E7"
                yAxisColor="#E4E4E7"
                rulesColor="#F4F4F5"
                noOfSections={4}
                initialSpacing={15}
                spacing={chartData.length > 1 ? (screenWidth - 110) / (chartData.length - 1) : 50}
                // === GARIS VERTIKAL DRAGGABLE + TOOLTIP ===
                pointerConfig={{
                  pointerStripUptoDataPoint: true,
                  pointerStripColor: '#F45B26',
                  pointerStripWidth: 2,
                  strokeDashArray: [4, 4],
                  pointerColor: '#F45B26',
                  radius: 6,
                  pointerLabelWidth: 110,
                  pointerLabelHeight: 70,
                  activatePointersOnLongPress: false,
                  autoAdjustPointerLabelPosition: true,
                  pointerLabelComponent: (items: any) => {
                    const main = items[0];
                    const compare = filter === 'YEAR' ? items[1] : null;
                    return (
                      <View style={styles.tooltipBox}>
                        <Text style={styles.tooltipLabel}>{main?.label}</Text>
                        <Text style={styles.tooltipValue}>
                          Rp {Math.round((main?.value || 0) * 1000).toLocaleString()}
                        </Text>
                        {compare && (
                          <Text style={styles.tooltipCompare}>
                            Thn lalu: Rp {Math.round((compare?.value || 0) * 1000).toLocaleString()}
                          </Text>
                        )}
                      </View>
                    );
                  },
                }}
              />
            )}

            {filter === 'YEAR' && (
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#F45B26' }]} />
                  <Text style={styles.legendText}>Thn {selectedYear}</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#A1A1AA' }]} />
                  <Text style={styles.legendText}>Thn {selectedYear - 1}</Text>
                </View>
              </View>
            )}
          </View>

          {/* RUANG KOSONG DIBAWAH GRAFIK DIISI RINGKASAN BISNIS / INSIGHTS */}
          <Text style={styles.sectionTitle}>BUSINESS PERFORMANCE INSIGHTS</Text>
          <View style={styles.insightsContainer}>
            <View style={styles.insightItem}>
              <View style={[styles.iconWrapper, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="stats-chart" size={18} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.insightLabel}>Rata-Rata Pendapatan per Transaksi</Text>
                <Text style={styles.insightValue}>
                  Rp {totalOrders > 0 ? Math.round(totalSales / totalOrders).toLocaleString() : 0}
                </Text>
              </View>
            </View>

            <View style={styles.insightItem}>
              <View style={[styles.iconWrapper, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="checkmark-done-circle" size={18} color="#16A34A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.insightLabel}>Volume Penjualan Sukses</Text>
                <Text style={styles.insightValue}>{totalOrders} Transaksi Diarsip</Text>
              </View>
            </View>
          </View>

        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 20 },

  headerRow: {
    marginTop: Platform.OS === 'ios' ? 60 : 40,
    marginBottom: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15
  },
  backBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#F4F4F5',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E4E4E7'
  },
  titleContainer: { flex: 1 },
  headerLabel: { fontSize: 11, fontWeight: '700', color: '#71717A', letterSpacing: 1.5 },
  headerTitle: { fontSize: 32, fontWeight: '900', color: '#18181B', letterSpacing: -1 },

  filterRow: { flexDirection: 'row', backgroundColor: '#F4F4F5', padding: 5, borderRadius: 15, marginBottom: 20, gap: 5 },
  filterBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  filterBtnActive: { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E4E4E7' },
  filterBtnText: { fontSize: 11, fontWeight: '800', color: '#A1A1AA' },
  filterBtnTextActive: { color: '#F45B26' },

  yearSelectorRow: { flexDirection: 'row', gap: 8, paddingBottom: 20, paddingHorizontal: 2 },
  yearMiniBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F4F4F5', borderWidth: 1, borderColor: '#E4E4E7' },
  yearMiniBtnActive: { backgroundColor: '#F45B26', borderColor: '#F45B26' },
  yearMiniBtnText: { fontSize: 12, fontWeight: '700', color: '#71717A' },
  yearMiniBtnTextActive: { color: '#FFFFFF' },

  datePickerContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, gap: 10 },
  dateSelector: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4F4F5', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#E4E4E7' },
  dateSelectorLabel: { fontSize: 8, fontWeight: '800', color: '#71717A' },
  dateSelectorValue: { fontSize: 12, fontWeight: '700', color: '#18181B', marginTop: 2 },

  pickerOverlayContainer: { backgroundColor: '#F4F4F5', padding: 15, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#E4E4E7' },
  inlinePickerWrapper: { width: '100%', justifyContent: 'center' },
  pickerTitle: { fontSize: 12, fontWeight: '800', color: '#18181B', marginBottom: 10, textAlign: 'center' },
  closePickerBtn: { backgroundColor: '#F45B26', paddingVertical: 10, borderRadius: 10, marginTop: 12, alignItems: 'center' },
  closePickerText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  summaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFDFB',
    padding: 22,
    borderRadius: 22,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFEDD5'
  },
  summaryLabel: { fontSize: 10, fontWeight: '800', color: '#71717A', marginBottom: 5, letterSpacing: 0.5 },
  summaryValue: { fontSize: 24, fontWeight: '900', color: '#18181B' },

  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, gap: 4 },
  badgeText: { fontSize: 11, fontWeight: '800' },

  chartBox: { backgroundColor: '#FFFFFF', borderRadius: 20, alignItems: 'center', marginVertical: 5, paddingVertical: 10 },
  chartTitle: { fontSize: 11, fontWeight: '800', color: '#71717A', marginBottom: 15, alignSelf: 'flex-start', letterSpacing: 0.3 },

  legendRow: { flexDirection: 'row', gap: 16, marginTop: 12, alignSelf: 'flex-start', paddingLeft: 15 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontWeight: '700', color: '#71717A' },

  tooltipBox: {
    backgroundColor: '#18181B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 100,
  },
  tooltipLabel: { color: '#A1A1AA', fontSize: 10, fontWeight: '700', marginBottom: 2 },
  tooltipValue: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  tooltipCompare: { color: '#71717A', fontSize: 10, fontWeight: '600', marginTop: 2 },

  sectionTitle: { fontSize: 11, fontWeight: '900', color: '#18181B', marginTop: 25, marginBottom: 15, letterSpacing: 0.8 },
  insightsContainer: { gap: 12 },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    gap: 15
  },
  iconWrapper: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  insightLabel: { fontSize: 11, fontWeight: '700', color: '#71717A' },
  insightValue: { fontSize: 16, fontWeight: '900', color: '#18181B', marginTop: 2 }
});