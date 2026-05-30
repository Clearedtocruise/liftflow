import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { LiftFlowColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

export default function Index() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={LiftFlowColors.accent} />
      </View>
    );
  }

  if (isAuthenticated) {
    if (user && !user.onboardingCompleted) {
      return <Redirect href="/(onboarding)/legal" />;
    }
    return <Redirect href="/(tabs)/dashboard" />;
  }

  return <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LiftFlowColors.background,
  },
});
