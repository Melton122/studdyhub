import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Alert, ActivityIndicator, Linking, Share, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../supabaseConfig';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

export default function ResourceDetailsScreen({ route, navigation }) {
  const { resource } = route.params;
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [relatedResources, setRelatedResources] = useState([]);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);

  useEffect(() => {
    fetchRelatedResources();
    checkIfDownloaded();
  }, [resource.id]);

  const fetchRelatedResources = async () => {
    try {
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .eq('subject', resource.subject)
        .neq('id', resource.id)
        .order('download_count', { ascending: false })
        .limit(3);

      if (!error) {
        setRelatedResources(data || []);
      }
    } catch (error) {
      console.error('Error fetching related resources:', error);
    }
  };

  const checkIfDownloaded = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('downloads')
        .select('id')
        .eq('user_id', user.id)
        .eq('resource_id', resource.id)
        .single();

      if (!error && data) {
        setIsDownloaded(true);
      }
    } catch (error) {
      setIsDownloaded(false);
    }
  };

  const handleDownload = async () => {
    if (!user) {
      Alert.alert('Login Required', 'Please login to download resources');
      return;
    }

    try {
      setDownloading(true);
      
      // Record download
      const { error } = await supabase
        .from('downloads')
        .insert([{
          user_id: user.id,
          resource_id: resource.id,
          downloaded_at: new Date().toISOString(),
        }]);

      if (error) throw error;

      // Update download count
      await supabase
        .from('resources')
        .update({ download_count: (resource.download_count || 0) + 1 })
        .eq('id', resource.id);

      setIsDownloaded(true);
      
      Alert.alert(
        'Download Started',
        'Your resource download has started. Check your downloads folder.',
        [
          { text: 'OK' },
          {
            text: 'Open File',
            onPress: () => {
              if (resource.file_url) {
                Linking.openURL(resource.file_url);
              }
            }
          }
        ]
      );

    } catch (error) {
      console.error('Error downloading:', error);
      Alert.alert('Download Failed', 'Failed to download resource. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out this ${resource.subject} resource on StuddyHub: ${resource.title}`,
        title: resource.title,
        url: resource.file_url,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleOpenResource = async () => {
    if (resource.file_url) {
      await Linking.openURL(resource.file_url);
    } else {
      Alert.alert('No File Available', 'This resource does not have an available file.');
    }
  };

  const getResourceIcon = (type) => {
    switch (type) {
      case 'past_paper': return { icon: 'document-text', color: '#FF7675' };
      case 'notes': return { icon: 'book', color: '#00B894' };
      case 'video': return { icon: 'videocam', color: '#FD79A8' };
      case 'quiz': return { icon: 'help-circle', color: '#FDCB6E' };
      default: return { icon: 'document', color: '#74B9FF' };
    }
  };

  const resourceIcon = getResourceIcon(resource.type);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header with Back Button */}
        <LinearGradient
          colors={['#1E2340', '#6C5CE7']}
          style={styles.header}
        >
          <View style={styles.headerTop}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            
            <View style={styles.headerActions}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={handleShare}
              >
                <Ionicons name="share-outline" size={22} color="#FFF" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => navigation.navigate('Downloads')}
              >
                <Ionicons name="download-outline" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        {/* Resource Card */}
        <View style={styles.resourceCard}>
          <LinearGradient
            colors={['#1E2340', '#2D3561']}
            style={styles.resourceGradient}
          >
            <View style={styles.resourceHeader}>
              <View style={[styles.resourceIcon, { backgroundColor: resourceIcon.color + '20' }]}>
                <Ionicons name={resourceIcon.icon} size={32} color={resourceIcon.color} />
              </View>
              
              <View style={styles.resourceTitleContainer}>
                <Text style={styles.resourceTitle}>{resource.title}</Text>
                <View style={styles.resourceMeta}>
                  <View style={styles.subjectBadge}>
                    <Text style={styles.subjectText}>{resource.subject}</Text>
                  </View>
                  <Text style={styles.yearText}>{resource.year}</Text>
                </View>
              </View>
            </View>

            {/* Quick Stats */}
            <View style={styles.quickStats}>
              <View style={styles.statItem}>
                <Ionicons name="download" size={16} color="#636E72" />
                <Text style={styles.statNumber}>{resource.download_count || 0}</Text>
                <Text style={styles.statLabel}>Downloads</Text>
              </View>
              
              <View style={styles.statDivider} />
              
              <View style={styles.statItem}>
                <Ionicons name="time" size={16} color="#636E72" />
                <Text style={styles.statNumber}>{resource.pages || '-'}</Text>
                <Text style={styles.statLabel}>Pages</Text>
              </View>
              
              <View style={styles.statDivider} />
              
              <View style={styles.statItem}>
                <Ionicons name="star" size={16} color="#636E72" />
                <Text style={styles.statNumber}>{resource.difficulty || 'Medium'}</Text>
                <Text style={styles.statLabel}>Level</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description} numberOfLines={showFullDescription ? undefined : 4}>
            {resource.description || `This ${resource.type.replace('_', ' ')} covers important topics for ${resource.subject}. It's a valuable resource for matric students preparing for exams.`}
          </Text>
          {!showFullDescription && (
            <TouchableOpacity onPress={() => setShowFullDescription(true)}>
              <Text style={styles.readMore}>Read more</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Topics Covered */}
        {resource.topics && resource.topics.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Topics Covered</Text>
            <View style={styles.topicsGrid}>
              {resource.topics.map((topic, index) => (
                <View key={index} style={styles.topicChip}>
                  <Ionicons name="checkmark-circle" size={14} color="#00B894" />
                  <Text style={styles.topicText}>{topic}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionButtonLarge, styles.previewButton]}
            onPress={handleOpenResource}
            disabled={!resource.file_url}
          >
            <Ionicons name="eye" size={20} color="#6C5CE7" />
            <Text style={[styles.actionButtonText, { color: '#6C5CE7' }]}>
              {resource.file_url ? 'Preview Resource' : 'No Preview Available'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButtonLarge, styles.downloadButton]}
            onPress={handleDownload}
            disabled={downloading || isDownloaded}
          >
            {downloading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons 
                  name={isDownloaded ? "checkmark-circle" : "download"} 
                  size={20} 
                  color="#FFF" 
                />
                <Text style={styles.actionButtonText}>
                  {isDownloaded ? 'Already Downloaded' : 'Download Resource'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Related Resources */}
        {relatedResources.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Related Resources</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Resources', { subject: resource.subject })}>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {relatedResources.map((related, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={styles.relatedCard}
                  onPress={() => navigation.replace('ResourceDetails', { resource: related })}
                >
                  <View style={[styles.relatedIcon, { backgroundColor: getResourceIcon(related.type).color + '20' }]}>
                    <Ionicons name={getResourceIcon(related.type).icon} size={24} color={getResourceIcon(related.type).color} />
                  </View>
                  <Text style={styles.relatedTitle} numberOfLines={2}>
                    {related.title}
                  </Text>
                  <Text style={styles.relatedSubject}>{related.subject}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Tips Section */}
        <View style={styles.tipsCard}>
          <LinearGradient
            colors={['#FDCB6E20', '#FDCB6E10']}
            style={styles.tipsGradient}
          >
            <View style={styles.tipsHeader}>
              <Ionicons name="bulb" size={24} color="#FDCB6E" />
              <Text style={styles.tipsTitle}>Study Tip</Text>
            </View>
            <Text style={styles.tipsText}>
              Print this resource and time yourself while practicing. This helps simulate exam conditions.
            </Text>
          </LinearGradient>
        </View>

        <View style={styles.bottomSpacer} />
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
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    padding: 8,
  },
  resourceCard: {
    marginTop: -20,
    marginHorizontal: 20,
    borderRadius: 25,
    overflow: 'hidden',
  },
  resourceGradient: {
    padding: 25,
    borderRadius: 25,
  },
  resourceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  resourceIcon: {
    width: 60,
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  resourceTitleContainer: {
    flex: 1,
  },
  resourceTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 8,
  },
  resourceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  subjectBadge: {
    backgroundColor: '#6C5CE720',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  subjectText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6C5CE7',
  },
  yearText: {
    fontSize: 13,
    color: '#636E72',
  },
  quickStats: {
    flexDirection: 'row',
    backgroundColor: '#0A0E27',
    borderRadius: 16,
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#636E72',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#2D3561',
  },
  section: {
    padding: 20,
    paddingBottom: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 12,
  },
  seeAll: {
    fontSize: 14,
    color: '#6C5CE7',
    fontWeight: '600',
  },
  description: {
    fontSize: 15,
    color: '#A29BFE',
    lineHeight: 22,
  },
  readMore: {
    fontSize: 14,
    color: '#6C5CE7',
    fontWeight: '600',
    marginTop: 8,
  },
  topicsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  topicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E2340',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  topicText: {
    fontSize: 13,
    color: '#A29BFE',
  },
  actionButtons: {
    padding: 20,
    flexDirection: 'row',
    gap: 12,
  },
  actionButtonLarge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 14,
  },
  previewButton: {
    backgroundColor: '#1E2340',
    borderWidth: 1,
    borderColor: '#6C5CE7',
  },
  downloadButton: {
    backgroundColor: '#6C5CE7',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  relatedCard: {
    width: 160,
    backgroundColor: '#1E2340',
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  relatedIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  relatedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
    height: 40,
  },
  relatedSubject: {
    fontSize: 12,
    color: '#A29BFE',
  },
  tipsCard: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  tipsGradient: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FDCB6E30',
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  tipsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FDCB6E',
  },
  tipsText: {
    fontSize: 15,
    color: '#FFF',
    lineHeight: 22,
  },
  bottomSpacer: {
    height: 100,
  },
});