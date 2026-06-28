import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, StatusBar, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import CountryPicker, { CountryCode } from 'react-native-country-picker-modal';

export default function RegisterScreen() {
  const router = useRouter();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  
  // State Country Picker
  const [countryCode, setCountryCode] = useState<CountryCode>('ID');
  const [callingCode, setCallingCode] = useState('62');
  const [showPicker, setShowPicker] = useState(false);
  
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!email || !password || !fullName || !phone) {
      alert('Mohon isi semua data dengan lengkap!');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password,
      options: {
        data: {
          full_name: fullName,
          phone_number: phone,
          country_code: `+${callingCode}`,
          role: 'customer', // Default role di-set langsung jadi customer
        }
      }
    });

    if (error) {
      alert('Gagal: ' + error.message);
    } else {
      alert('Registrasi sukses!');
      router.replace('/auth/login');
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.headerSection}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#18181B" />
          </TouchableOpacity>
          <Text style={styles.brandTitle}>BUAT AKUN</Text>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.inputLabel}>NAMA LENGKAP</Text>
          <View style={styles.inputWrapper}>
            <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Contoh: Nama Anda" />
          </View>

          <Text style={styles.inputLabel}>ALAMAT EMAIL</Text>
          <View style={styles.inputWrapper}>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="email@contoh.com" keyboardType="email-address" autoCapitalize="none" />
          </View>

          <Text style={styles.inputLabel}>NOMOR HP</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {/* Country Picker */}
            <TouchableOpacity style={styles.countryPickerButton} onPress={() => setShowPicker(true)}>
              <CountryPicker
                withFilter
                withFlag
                withCallingCode
                withEmoji
                countryCode={countryCode}
                onSelect={(country) => {
                  setCountryCode(country.cca2);
                  setCallingCode(country.callingCode[0]);
                }}
                visible={showPicker}
              />
              <Text style={{ fontWeight: '700' }}>+{callingCode}</Text>
            </TouchableOpacity>

            <View style={[styles.inputWrapper, { flex: 1 }]}>
              <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="812xxxxxx" />
            </View>
          </View>

          <Text style={styles.inputLabel}>KATA SANDI</Text>
          <View style={styles.inputWrapper}>
            <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Minimal 6 karakter" />
          </View>

          <TouchableOpacity style={styles.registerButton} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.registerButtonText}>DAFTAR SEKARANG</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContainer: { padding: 24 },
  headerSection: { marginBottom: 30, marginTop: 40 },
  backButton: { width: 40, height: 40, backgroundColor: '#F4F4F5', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  brandTitle: { fontSize: 22, fontWeight: '900', marginTop: 20 },
  formSection: { gap: 4 },
  inputLabel: { fontSize: 10, fontWeight: '800', color: '#71717A', marginTop: 12, marginBottom: 6 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E4E4E7', borderRadius: 14, paddingHorizontal: 14, height: 54 },
  input: { flex: 1, fontSize: 14, color: '#18181B' },
  countryPickerButton: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E4E4E7', borderRadius: 14, paddingHorizontal: 10, height: 54, gap: 5 },
  registerButton: { backgroundColor: '#F45B26', height: 54, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  registerButtonText: { color: '#FFF', fontWeight: '800' }
});