import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';

import {
  FirebaseAuthTypes,
  getAuth,
  onAuthStateChanged,
  signOut,
} from '@react-native-firebase/auth';

type AuthContextType = {
  user: FirebaseAuthTypes.User | null;
  loading: boolean;
  logout: () => Promise<void>;
};

const AuthContext =
  createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] =
    useState<FirebaseAuthTypes.User | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        console.log(
          'AUTH STATE:',
          currentUser
            ? {
                uid: currentUser.uid,
                email: currentUser.email,
                name: currentUser.displayName,
              }
            : 'SIGNED OUT'
        );

        setUser(currentUser);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const logout = async () => {
    try {
      const auth = getAuth();
      await signOut(auth);
    } catch (error) {
      console.log('LOGOUT ERROR:', error);
      throw error;
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator
          size="large"
          color="#111827"
        />
      </View>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used inside AuthProvider'
    );
  }

  return context;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
});