import React from 'react';
import {StatusBar, StyleSheet, Text, View} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#0e0f12" />
      <SafeAreaView style={styles.screen}>
        <View style={styles.content}>
          <Text accessibilityRole="header" style={styles.brand}>Stras<Text style={styles.accent}>Drive</Text></Text>
          <Text style={styles.subtitle}>Version native en développement</Text>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#0e0f12'},
  content: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24},
  brand: {fontSize: 36, fontWeight: '700', color: '#fafaf9'},
  accent: {color: '#eab308'},
  subtitle: {marginTop: 12, color: '#a8a29e', fontSize: 14, textAlign: 'center'},
});
