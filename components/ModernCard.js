// components/ModernCard.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export const ModernCard = ({ 
  children, 
  onPress, 
  gradient = false,
  colors = ['#1E2340', '#2D3561'],
  style 
}) => {
  const CardContent = gradient ? LinearGradient : View;
  
  const cardStyle = [
    styles.card,
    gradient && styles.gradientCard,
    style
  ];

  const contentProps = gradient ? {
    colors: colors,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 }
  } : {};

  const CardComponent = onPress ? TouchableOpacity : View;

  return (
    <CardComponent 
      onPress={onPress}
      style={cardStyle}
      activeOpacity={0.7}
    >
      <CardContent {...contentProps} style={styles.cardContent}>
        {children}
      </CardContent>
    </CardComponent>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2D3561',
    overflow: 'hidden',
  },
  gradientCard: {
    borderWidth: 0,
  },
  cardContent: {
    padding: 20,
  },
});