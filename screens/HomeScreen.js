import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Linking, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabaseConfig';

export default function ResourcesScreen({ route, navigation }) {
  const { subjectId, subjectName } = route.params;
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchResources();
  }, [subjectId]);

  const fetchResources = async () => {
    try {
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .eq('subject_id', subjectId)
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setResources(data || []);
    } catch (error) {
      console.error('Error fetching resources:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (resource) => {
    if (!resource.file_url) {
      Alert.alert('Error', 'No download link available');
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(resource.file_url);
      if (canOpen) {
        await Linking.openURL(resource.file_url);
        
        // Increment download count
        const currentCount = resource.download_count || 0;
        await supabase
          .from('resources')
          .update({ download_count: currentCount + 1 })
          .eq('id', resource.id);
        
        // Update local state
        setResources(prev => 
          prev.map(r => 
            r.id === resource.id 
              ? { ...r, download_count: currentCount + 1 }
              : r
          )
        );
      } else {
        Alert.alert('Error', 'Cannot open this file');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open resource');
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'book': return 'book';
      case 'past_paper': return 'document-text';
      case 'notes': return 'clipboard';
      case 'video': return 'play-circle';
      case 'worksheet': return 'document-attach';
      default: return 'document';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'book': return '#6C5CE7';
      case 'past_paper': return '#FD79A8';
      case 'notes': return '#00B894';
      case 'video': return '#E17055';
      case 'worksheet': return '#74B9FF';
      default: return '#74B9FF';
    }
  };

  const filteredResources = filter === 'all'
    ? resources
    : resources.filter(r => r.resource_type === filter);

  const renderResource = ({ item }) => {
    const typeColor = getTypeColor(item.resource_type);
    const typeIcon = getTypeIcon(item.resource_type);

    return (
      <TouchableOpacity
        style={styles.resourceCard}
        onPress={() => handleDownload(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, { backgroundColor: typeColor + '20' }]}>
          <Ionicons name={typeIcon} size={24} color={typeColor} />
        </View>

        <View style={styles.resourceInfo}>
          <Text style={styles.resourceTitle} numberOfLines={2}>
            {item.title}
          </Text>
          {item.description && (
            <Text style={styles.resourceDesc} numberOfLines={1}>
              {item.description}
            </Text>
          )}
          <View style={styles.resourceMeta}>
            <View style={styles.typeBadge}>
              <Text style={[styles.typeText, { color: typeColor }]}>
                {item.resource_type?.replace('_', ' ') || 'resource'}
              </Text>
            </View>
            {item.year && (
              <View style={styles.yearBadge}>
                <Text style={styles.yearText}>{item.year}</Text>
              </View>
            )}
            <View style={styles.downloadCount}>
              <Ionicons name="download-outline" size={12} color="#636E72" />
              <Text style={styles.countText}>{item.download_count || 0}</Text>
            </View>
          </View>
        </View>

        <Ionicons name="download" size={24} color={typeColor} />
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
      {/* Filter Pills */}
      <View style={styles.filterContainer}>
        {['all', 'book', 'past_paper', 'notes', 'video', 'worksheet'].map(type => (
          <TouchableOpacity
            key={type}
            style={[styles.filterPill, filter === type && styles.filterPillActive]}
            onPress={() => setFilter(type)}
          >
            <Text style={[styles.filterText, filter === type && styles.filterTextActive]}>
              {type === 'all' ? 'All' : type.replace('_', ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Resources List */}
      <FlatList
        data={filteredResources}
        renderItem={renderResource}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={60} color="#636E72" />
            <Text style={styles.emptyTitle}>No resources found</Text>
            <Text style={styles.emptyText}>
              Check back later for {subjectName} materials
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
  filterContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    flexWrap: 'wrap',
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1E2340',
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  filterPillActive: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#636E72',
    textTransform: 'capitalize',
  },
  filterTextActive: {
    color: '#FFF',
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  resourceCard: {
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
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  resourceInfo: {
    flex: 1,
  },
  resourceTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  resourceDesc: {
    fontSize: 13,
    color: '#A29BFE',
    marginBottom: 6,
  },
  resourceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#2D3561',
  },
  typeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  yearBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#FDCB6E',
  },
  yearText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0A0E27',
  },
  downloadCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  countText: {
    fontSize: 11,
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