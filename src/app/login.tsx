
import React, { useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { GoogleSignin } from '@react-native-google-signin/google-signin';

import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
} from '@react-native-firebase/auth';

import '../config/google';

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    if (loading) {
      return;
    }

    try {
      setLoading(true);

      /*
       * Check Google Play Services
       */
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });

      /*
       * Open Google account picker
       */
      const result = await GoogleSignin.signIn();

      /*
       * Get Google ID token
       */
      const idToken = result.data?.idToken;

      if (!idToken) {
        throw new Error(
          'Google ID token was not returned.'
        );
      }

      /*
       * Create Firebase credential
       */
      const credential =
        GoogleAuthProvider.credential(idToken);

      /*
       * Get Firebase Auth instance
       */
      const auth = getAuth();

      /*
       * Sign into Firebase
       */
      const firebaseResult =
        await signInWithCredential(
          auth,
          credential
        );

      const user = firebaseResult.user;

      console.log(
        '================================'
      );

      console.log(
        'GOOGLE LOGIN SUCCESS'
      );

      console.log(
        'UID:',
        user.uid
      );

      console.log(
        'NAME:',
        user.displayName
      );

      console.log(
        'EMAIL:',
        user.email
      );

      console.log(
        'PHOTO:',
        user.photoURL
      );

      console.log(
        '================================'
      );

      /*
       * No manual navigation.
       *
       * Firebase auth state changes.
       *
       * AuthProvider detects the user.
       *
       * _layout.tsx redirects to the map.
       */
    }catch (error: any) {
       console.log('========== GOOGLE ERROR ==========');
       console.log('CODE:', error?.code);
       console.log('MESSAGE:', error?.message);
       console.log('NATIVE ERROR:', error);
       console.log('==================================');

       Alert.alert(
         'Google Login Error',
         `Code: ${error?.code}\n\n${error?.message}`
       );
     } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>

      {/* ================= HEADER ================= */}

      <View style={styles.header}>

        <View style={styles.logo}>
          <Text style={styles.logoText}>
            ⌖
          </Text>
        </View>

        <Text style={styles.title}>
          LiveLocation
        </Text>

        <Text style={styles.subtitle}>
          Track your people. Stay connected.
        </Text>

      </View>

      {/* ================= LOGIN CARD ================= */}

      <View style={styles.card}>

        <Text style={styles.welcome}>
          Welcome back
        </Text>

        <Text style={styles.description}>
          Sign in with your Google account
          to continue to LiveLocation.
        </Text>

        <TouchableOpacity
          style={[
            styles.googleButton,
            loading && styles.disabledButton,
          ]}
          onPress={handleGoogleLogin}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator
              size="small"
              color="#111827"
            />
          ) : (
            <>
              <View style={styles.googleIcon}>
                <Text style={styles.googleG}>
                  G
                </Text>
              </View>

              <Text style={styles.googleText}>
                Continue with Google
              </Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.terms}>
          By continuing, you agree to our
          Terms and Privacy Policy.
        </Text>

      </View>

      {/* ================= FOOTER ================= */}

      <View style={styles.footer}>

        <View style={styles.statusDot} />

        <Text style={styles.footerText}>
          Secure authentication
        </Text>

      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  header: {
    alignItems: 'center',
    marginBottom: 42,
  },

  logo: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  logoText: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '700',
  },

  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.8,
  },

  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748B',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  welcome: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },

  description: {
    fontSize: 14,
    lineHeight: 21,
    color: '#64748B',
    marginBottom: 28,
  },

  googleButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  disabledButton: {
    opacity: 0.6,
  },

  googleIcon: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  googleG: {
    fontSize: 20,
    fontWeight: '800',
    color: '#4285F4',
  },

  googleText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },

  terms: {
    marginTop: 20,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 17,
    color: '#94A3B8',
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#22C55E',
    marginRight: 7,
  },

  footerText: {
    fontSize: 12,
    color: '#64748B',
  },
});

