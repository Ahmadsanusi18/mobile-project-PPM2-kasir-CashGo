import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, Image,
  StatusBar, Platform, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';

const { width, height } = Dimensions.get('window');
const DOT_SIZE    = 180; // ← lebih besar
const COVER_SCALE = (Math.sqrt(width * width + height * height) * 2.5) / DOT_SIZE;
const DOT_OFFSET  = -(DOT_SIZE / 2);

export default function SplashScreen() {
  const router = useRouter();

  const welcomeOpacity = useRef(new Animated.Value(0)).current;
  const welcomeY       = useRef(new Animated.Value(16)).current;

  const dot1Scale   = useRef(new Animated.Value(0)).current;
  const dot2Scale   = useRef(new Animated.Value(0)).current;
  const dotsOpacity = useRef(new Animated.Value(0)).current;
  const expandScale = useRef(new Animated.Value(1)).current;

  const welcomeFadeOut = useRef(new Animated.Value(1)).current;

  const logoOpacity   = useRef(new Animated.Value(0)).current;
  const logoY         = useRef(new Animated.Value(-80)).current;
  const textOpacity   = useRef(new Animated.Value(0)).current;
  const textY         = useRef(new Animated.Value(50)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;

useEffect(() => {
    Animated.sequence([

      // STEP 1: "Selamat Datang" muncul
      Animated.parallel([
        Animated.timing(welcomeOpacity, { toValue: 1, duration: 80, useNativeDriver: true }),
        Animated.spring(welcomeY, { toValue: 0, friction: 9, tension: 120, useNativeDriver: true }),
      ]),

      Animated.delay(250), // tunggu sebentar biar kebaca

      // STEP 2: 2 titik muncul memantul
      Animated.parallel([
        Animated.timing(dotsOpacity, { toValue: 1, duration: 30, useNativeDriver: true }),
        Animated.spring(dot1Scale, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
        Animated.spring(dot2Scale, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
      ]),

      Animated.delay(100),

      // STEP 3: welcome fade out + lingkaran meluas
      Animated.parallel([
        Animated.timing(welcomeFadeOut, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(expandScale, { toValue: COVER_SCALE, duration: 350, useNativeDriver: true }),
      ]),

      // STEP 4: logo turun dari atas
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.spring(logoY, { toValue: 0, friction: 6, tension: 130, useNativeDriver: true }),
      ]),

      // STEP 5: CashGo. naik dari bawah
      Animated.parallel([
        Animated.timing(textOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.spring(textY, { toValue: 0, friction: 6, tension: 130, useNativeDriver: true }),
      ]),

      // STEP 6: footer muncul
      Animated.timing(footerOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),

      Animated.delay(1200), // tahan sebelum pindah halaman

    ]).start(() => {
      router.replace('/(tabs)');
    });

    const timer = setTimeout(() => router.replace('/(tabs)'), 5000);
    return () => clearTimeout(timer);
  }, []);

  const dot1Style = {
    opacity: dotsOpacity,
    transform: [{ scale: Animated.multiply(dot1Scale, expandScale) }],
  };
  const dot2Style = {
    opacity: dotsOpacity,
    transform: [{ scale: Animated.multiply(dot2Scale, expandScale) }],
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#F45B26" />

      {/* Teks Selamat Datang */}
      <Animated.View
        style={[
          styles.welcomeWrapper,
          {
            opacity: Animated.multiply(welcomeOpacity, welcomeFadeOut),
            transform: [{ translateY: welcomeY }],
          },
        ]}
      >
        <Text style={styles.welcomeLabel}>Welcome</Text>
      </Animated.View>

      {/* Dot kanan atas */}
      <Animated.View style={[styles.dot, styles.dotTopRight, dot1Style]} />

      {/* Dot kiri bawah */}
      <Animated.View style={[styles.dot, styles.dotBottomLeft, dot2Style]} />

      {/* Konten di atas oranye */}
      <View style={styles.content} pointerEvents="none">

        <Animated.Image
          source={require('../assets/images/T-Putih1.png')}
          style={[
            styles.logoImage,
            { opacity: logoOpacity, transform: [{ translateY: logoY }] },
          ]}
          resizeMode="contain"
        />

        <Animated.Text
          style={[
            styles.brandText,
            { opacity: textOpacity, transform: [{ translateY: textY }] },
          ]}
        >
          CashGo.
        </Animated.Text>

      </View>

      <Animated.View style={[styles.footer, { opacity: footerOpacity }]}>
        <Text style={styles.footerText}>VERSION 1.0.0</Text>
      </Animated.View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  welcomeWrapper: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 2,
  },
  welcomeLabel: {
    fontSize: 35,          // ← lebih besar dari 22
    fontWeight: '800',     // ← sedikit lebih ringan dari 900, tetap bold
    color: '#18181B',
    letterSpacing: 0.5,    // ← dikurangi dari 2, lebih natural
    textAlign: 'center',
    fontStyle: 'normal',
  },
  dot: {
    position: 'absolute',
    width:  DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: '#F45B26',
  },
  dotTopRight:   { top: DOT_OFFSET,    right: DOT_OFFSET },
  dotBottomLeft: { bottom: DOT_OFFSET, left:  DOT_OFFSET },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  logoImage: {
    width: 110,
    height: 110,
    marginBottom: 16,
  },
  brandText: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 44 : 28,
  },
  footerText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 2,
  },
});