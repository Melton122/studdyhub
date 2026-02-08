import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, TextInput, RefreshControl, Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabaseConfig';

export default function TutorsScreen({ navigation }) {
  const [tutors, setTutors] = useState([]);
  const [filteredTutors, setFilteredTutors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchTutors();
  }, []);

  useEffect(() => {
    filterTutors();
  }, [searchQuery, tutors]);

  const fetchTutors = async () => {
    try {
      const { data, error } = await supabase
        .from('tutors')
        .select('*')
        .order('rating', { ascending: false, nullsFirst: false });

      if (error) throw error;
      setTutors(data || []);
      setFilteredTutors(data || []);
    } catch (error) {
      console.error('Error fetching tutors:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterTutors = () => {
    if (!searchQuery.trim()) {
      setFilteredTutors(tutors);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = tutors.filter(tutor => {
        const nameMatch = tutor.name?.toLowerCase().includes(query);
        const subjectMatch = tutor.subjects?.some(s => 
          s.toLowerCase().includes(query)
        );
        return nameMatch || subjectMatch;
      });
      setFilteredTutors(filtered);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchTutors();
  };

  const renderTutor = ({ item }) => {
    const initials = (item.name || 'T')
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    const subjects = item.subjects || [];
    const hasRating = item.rating !== null && item.rating !== undefined;

    return (
      <TouchableOpacity
        style={styles.tutorCard}
        onPress={() => navigation.navigate('TutorDetails', { tutor: item })}
        activeOpacity={0.7}
      >
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {item.profile_image_url ? (
            <Image
              source={{ uri: item.profile_image_url }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          {item.available && (
            <View style={styles.availableBadge} />
          )}
        </View>

        {/* Info */}
        <View style={styles.tutorInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.tutorName}>{item.name}</Text>
            {hasRating && (
              <View style={styles.ratingPill}>
                <Ionicons name="star" size={12} color="#FDCB6E" />
                <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
              </View>
            )}
          </View>

          {/* Subjects */}
          <View style={styles.subjectsRow}>
            {subjects.slice(0, 2).map((subject, index) => (
              <View key={index} style={styles.subjectChip}>
                <Text style={styles.subjectText}>{subject}</Text>
              </View>
            ))}
            {subjects.length > 2 && (
              <Text style={styles.moreText}>+{subjects.length - 2}</Text>
            )}
          </View>

          {/* Rate */}
          <Text style={styles.rateText}>
            R{(item.hourly_rate || item.rate_per_session || 0).toFixed(0)} / session
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={24} color="#636E72" />
      </TouchableOpacity>
    );
  };

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
          placeholder="Search tutors or subjects..."
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

      {/* Tutors List */}
      <FlatList
        data={filteredTutors}
        renderItem={renderTutor}
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
            <Ionicons name="people-outline" size={60} color="#636E72" />
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No tutors found' : 'No tutors available'}
            </Text>
            <Text style={styles.emptyText}>
              {searchQuery 
                ? 'Try a different search term'
                : 'Check back later for available tutors'}
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
  tutorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E2340',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#6C5CE7',
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6C5CE7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
  },
  availableBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#00B894',
    borderWidth: 2,
    borderColor: '#1E2340',
  },
  tutorInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  tutorName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2D3561',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FDCB6E',
  },
  subjectsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  subjectChip: {
    backgroundColor: '#6C5CE720',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  subjectText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#A29BFE',
  },
  moreText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6C5CE7',
    paddingHorizontal: 4,
  },
  rateText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#00B894',
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