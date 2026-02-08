import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabaseConfig';

export default function SettingsScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [autoDownload, setAutoDownload] = useState(false);
  const [language, setLanguage] = useState('English');

  const handleLogout = async () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.auth.signOut();
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          }
        }
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                // First delete user profile
                await supabase
                  .from('user_profiles')
                  .delete()
                  .eq('id', user.id);
                
                // Then delete auth user
                await supabase.auth.signOut();
              }
            } catch (error) {
              Alert.alert('Error', error.message);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const settingsGroups = [
    {
      title: 'Preferences',
      items: [
        {
          icon: 'notifications',
          label: 'Push Notifications',
          value: notifications,
          onToggle: setNotifications,
          type: 'switch'
        },
        {
          icon: 'moon',
          label: 'Dark Mode',
          value: darkMode,
          onToggle: setDarkMode,
          type: 'switch'
        },
        {
          icon: 'download',
          label: 'Auto-download Resources',
          value: autoDownload,
          onToggle: setAutoDownload,
          type: 'switch'
        },
      ]
    },
    {
      title: 'Account',
      items: [
        {
          icon: 'lock-closed',
          label: 'Change Password',
          type: 'link',
          action: () => Alert.alert('Info', 'Password change feature coming soon')
        },
        {
          icon: 'language',
          label: 'Language',
          value: language,
          type: 'select',
          action: () => Alert.alert('Info', 'Language selection coming soon')
        },
        {
          icon: 'help-circle',
          label: 'Help & Support',
          type: 'link',
          action: () => Alert.alert('Support', 'Contact: support@studdyhub.co.za')
        },
      ]
    },
    {
      title: 'About',
      items: [
        {
          icon: 'information-circle',
          label: 'About StuddyHub',
          type: 'link',
          action: () => Alert.alert('About', 'StuddyHub v1.0.0\nYour Grade 12 Success Partner')
        },
        {
          icon: 'document-text',
          label: 'Privacy Policy',
          type: 'link',
          action: () => Alert.alert('Privacy', 'Privacy policy available on our website')
        },
        {
          icon: 'shield-checkmark',
          label: 'Terms of Service',
          type: 'link',
          action: () => Alert.alert('Terms', 'Terms of service available on our website')
        },
      ]
    }
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content}>
        {settingsGroups.map((group, groupIndex) => (
          <View key={groupIndex} style={styles.group}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            <View style={styles.groupContent}>
              {group.items.map((item, itemIndex) => (
                <TouchableOpacity
                  key={itemIndex}
                  style={styles.settingItem}
                  onPress={item.action}
                  disabled={item.type === 'switch'}
                >
                  <View style={styles.settingLeft}>
                    <View style={styles.settingIcon}>
                      <Ionicons name={item.icon} size={20} color="#6C5CE7" />
                    </View>
                    <Text style={styles.settingLabel}>{item.label}</Text>
                  </View>
                  
                  {item.type === 'switch' ? (
                    <Switch
                      value={item.value}
                      onValueChange={item.onToggle}
                      trackColor={{ false: '#2D3561', true: '#6C5CE7' }}
                      thumbColor="#FFF"
                    />
                  ) : item.type === 'select' ? (
                    <View style={styles.selectContainer}>
                      <Text style={styles.selectText}>{item.value}</Text>
                      <Ionicons name="chevron-forward" size={16} color="#636E72" />
                    </View>
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color="#636E72" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Danger Zone */}
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Danger Zone</Text>
          <View style={styles.groupContent}>
            <TouchableOpacity 
              style={[styles.settingItem, styles.dangerItem]}
              onPress={handleLogout}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, styles.dangerIcon]}>
                  <Ionicons name="log-out-outline" size={20} color="#FF7675" />
                </View>
                <Text style={[styles.settingLabel, styles.dangerText]}>Log Out</Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.settingItem, styles.dangerItem]}
              onPress={handleDeleteAccount}
              disabled={loading}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, styles.dangerIcon]}>
                  <Ionicons name="trash-outline" size={20} color="#FF7675" />
                </View>
                <Text style={[styles.settingLabel, styles.dangerText]}>Delete Account</Text>
              </View>
              {loading && <ActivityIndicator size="small" color="#FF7675" />}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>StuddyHub v1.0.0</Text>
          <Text style={styles.copyright}>© 2024 StuddyHub. All rights reserved.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E27',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: '#1E2340',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  group: {
    marginBottom: 24,
  },
  groupTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#636E72',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  groupContent: {
    backgroundColor: '#1E2340',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2D3561',
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2D3561',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#6C5CE720',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dangerIcon: {
    backgroundColor: '#FF767520',
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  dangerText: {
    color: '#FF7675',
  },
  dangerItem: {
    backgroundColor: '#FF767510',
  },
  selectContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectText: {
    fontSize: 14,
    color: '#636E72',
  },
  versionContainer: {
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 20,
  },
  versionText: {
    fontSize: 14,
    color: '#636E72',
    marginBottom: 4,
  },
  copyright: {
    fontSize: 12,
    color: '#636E72',
  },
});