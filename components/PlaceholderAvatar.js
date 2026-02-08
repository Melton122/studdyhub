import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function PlaceholderAvatar({ name, size = 50, fontSize = 20 }) {
  const initials = name ? name.charAt(0).toUpperCase() : 'U';
  const colors = ['#6C5CE7', '#A29BFE'];
  
  return (
    <LinearGradient
      colors={colors}
      style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <Text style={[styles.initials, { fontSize: fontSize }]}>
        {initials}
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: '#FFF',
    fontWeight: '800',
  },
});