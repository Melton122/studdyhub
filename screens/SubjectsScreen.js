import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, TextInput, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabaseConfig';
import { useAuth } from '../context/AuthContext';

export default function SubjectsScreen({ navigation }) {
  const { profile } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [filteredSubjects, setFilteredSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchSubjects();
  }, [profile]);

  useEffect(() => {
    filterSubjects();
  }, [searchQuery, subjects]);

  const fetchSubjects = async () => {
    try {
      const { data: allSubjects, error } = await supabase
        .from('subjects')
        .select('*')
        .order('name');

      if (error) throw error;

      // Filter to show only user's selected subjects if they have any
      const userSubjects = profile?.selected_subjects || [];
      const displaySubjects = userSubjects.length > 0
        ? allSubjects.filter(s => userSubjects.includes(s.name))
        : allSubjects;

      setSubjects(displaySubjects);
      setFilteredSubjects(displaySubjects);
    } catch (error) {
      console.error('Error fetching subjects:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterSubjects = () => {
    if (!searchQuery.trim()) {
      setFilteredSubjects(subjects);
    } else {
      const filtered = subjects.filter(subject =>
        subject.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredSubjects(filtered);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchSubjects();
  };

  const renderSubject = ({ item }) => (
    <TouchableOpacity
      style={styles.subjectCard}
      onPress={() => navigation.navigate('Resources', {
        subjectId: item.id,
        subjectName: item.name
      })}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: (item.color || '#6C5CE7') + '20' }]}>
        <Ionicons
          name={item.icon || 'book-outline'}
          size={32}
          color={item.color || '#6C5CE7'}
        />
      </View>
      <View style={styles.subjectInfo}>
        <Text style={styles.subjectName}>{item.name}</Text>
        <Text style={styles.subjectHint}>Tap to view resources</Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color="#636E72" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6C5CE7" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#636E72" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search subjects..."
          placeholderTextColor="#636E72"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#636E72" />
          </TouchableOpacity>
        )}
      </View>

      {/* Subject List */}
      <FlatList
        data={filteredSubjects}
        renderItem={renderSubject}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6C5CE7"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="school-outline" size={60} color="#636E72" />
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No subjects found' : 'No subjects yet'}
            </Text>
            <Text style={styles.emptyText}>
              {searchQuery 
                ? 'Try a different search term'
                : 'Your selected subjects will appear here'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E27',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0E27',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E2340',
    margin: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
    marginLeft: 12,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  subjectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E2340',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  subjectInfo: {
    flex: 1,
  },
  subjectName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  subjectHint: {
    fontSize: 13,
    color: '#636E72',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 20,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#636E72',
    marginTop: 8,
    textAlign: 'center',
  },
});