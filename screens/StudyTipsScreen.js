import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ScrollView, Image, ActivityIndicator, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabaseConfig';
import { useAuth } from '../context/AuthContext';

const STUDY_TIP_CATEGORIES = [
  { id: 'all', name: 'All Tips', icon: 'apps' },
  { id: 'focus', name: 'Focus', icon: 'bulb' },
  { id: 'time', name: 'Time Management', icon: 'time' },
  { id: 'memory', name: 'Memory', icon: 'brain' },
  { id: 'exam', name: 'Exam Prep', icon: 'school' },
  { id: 'wellness', name: 'Wellness', icon: 'heart' },
];

export default function StudyTipsScreen() {
  const { user } = useAuth();
  const [tips, setTips] = useState([]);
  const [filteredTips, setFilteredTips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [bookmarkedTips, setBookmarkedTips] = useState([]);
  const [userPreferences, setUserPreferences] = useState(null);

  useEffect(() => {
    fetchStudyTips();
    fetchUserBookmarks();
    fetchUserPreferences();
  }, [user]);

  useEffect(() => {
    filterTips();
  }, [activeCategory, tips]);

  const fetchStudyTips = async () => {
    try {
      const { data } = await supabase
        .from('study_tips')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      setTips(data || []);
      setFilteredTips(data || []);
    } catch (error) {
      console.error('Error fetching study tips:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchUserBookmarks = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('study_tip_bookmarks')
        .select('tip_id')
        .eq('user_id', user.id);
      setBookmarkedTips(data?.map(b => b.tip_id) || []);
    } catch (error) {
      console.error('Error fetching bookmarks:', error);
    }
  };

  const fetchUserPreferences = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('user_study_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();
      setUserPreferences(data);
    } catch (error) {
      // User may not have preferences set yet
      setUserPreferences(null);
    }
  };

  const filterTips = () => {
    if (activeCategory === 'all') {
      setFilteredTips(tips);
    } else {
      const filtered = tips.filter(tip => 
        tip.categories?.includes(activeCategory)
      );
      setFilteredTips(filtered);
    }
  };

  const toggleBookmark = async (tipId) => {
    if (!user) return;
    
    const isBookmarked = bookmarkedTips.includes(tipId);
    
    try {
      if (isBookmarked) {
        await supabase
          .from('study_tip_bookmarks')
          .delete()
          .eq('user_id', user.id)
          .eq('tip_id', tipId);
        setBookmarkedTips(prev => prev.filter(id => id !== tipId));
      } else {
        await supabase
          .from('study_tip_bookmarks')
          .insert([{
            user_id: user.id,
            tip_id: tipId,
          }]);
        setBookmarkedTips(prev => [...prev, tipId]);
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
    }
  };

  const getDailyTip = () => {
    if (tips.length === 0) return null;
    const today = new Date().getDate();
    return tips[today % tips.length];
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchStudyTips();
  };

  const renderStudyTip = ({ item }) => (
    <View style={styles.tipCard}>
      <View style={styles.tipHeader}>
        <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(item.categories?.[0]) + '20' }]}>
          <Text style={[styles.categoryText, { color: getCategoryColor(item.categories?.[0]) }]}>
            {getCategoryName(item.categories?.[0])}
          </Text>
        </View>
        <TouchableOpacity onPress={() => toggleBookmark(item.id)}>
          <Ionicons 
            name={bookmarkedTips.includes(item.id) ? "bookmark" : "bookmark-outline"} 
            size={20} 
            color={bookmarkedTips.includes(item.id) ? "#6C5CE7" : "#636E72"} 
          />
        </TouchableOpacity>
      </View>
      
      <Text style={styles.tipTitle}>{item.title}</Text>
      <Text style={styles.tipDescription}>{item.description}</Text>
      
      {item.sub_tips && item.sub_tips.length > 0 && (
        <View style={styles.subTips}>
          {item.sub_tips.slice(0, 3).map((subTip, index) => (
            <View key={index} style={styles.subTipItem}>
              <Ionicons name="checkmark-circle" size={14} color="#00B894" />
              <Text style={styles.subTipText}>{subTip}</Text>
            </View>
          ))}
        </View>
      )}
      
      <View style={styles.tipFooter}>
        <View style={styles.difficulty}>
          <Text style={styles.difficultyLabel}>Level: </Text>
          <View style={styles.difficultyStars}>
            {[1, 2, 3, 4, 5].map(level => (
              <Ionicons 
                key={level}
                name={level <= (item.difficulty_level || 3) ? "star" : "star-outline"} 
                size={12} 
                color="#FDCB6E" 
              />
            ))}
          </View>
        </View>
        
        <View style={styles.timeEstimate}>
          <Ionicons name="time-outline" size={12} color="#636E72" />
          <Text style={styles.timeText}>{item.time_estimate || '5 min'}</Text>
        </View>
      </View>
    </View>
  );

  const getCategoryColor = (category) => {
    switch(category) {
      case 'focus': return '#6C5CE7';
      case 'time': return '#00B894';
      case 'memory': return '#FD79A8';
      case 'exam': return '#FDCB6E';
      case 'wellness': return '#74B9FF';
      default: return '#636E72';
    }
  };

  const getCategoryName = (category) => {
    const cat = STUDY_TIP_CATEGORIES.find(c => c.id === category);
    return cat ? cat.name : 'Study Tip';
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6C5CE7" />
      </View>
    );
  }

  const dailyTip = getDailyTip();

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#6C5CE7"
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Study Tips & Strategies</Text>
        <Text style={styles.headerSubtitle}>Level up your study game</Text>
      </View>

      {/* Daily Tip */}
      {dailyTip && (
        <View style={styles.dailyTipCard}>
          <View style={styles.dailyTipHeader}>
            <Ionicons name="sunny" size={24} color="#FDCB6E" />
            <Text style={styles.dailyTipTitle}>Tip of the Day</Text>
          </View>
          <Text style={styles.dailyTipText}>{dailyTip.title}</Text>
          <Text style={styles.dailyTipDescription} numberOfLines={2}>
            {dailyTip.description}
          </Text>
        </View>
      )}

      {/* Category Filter */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesScroll}
        contentContainerStyle={styles.categoriesContainer}
      >
        {STUDY_TIP_CATEGORIES.map(category => (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.categoryButton,
              activeCategory === category.id && styles.categoryButtonActive
            ]}
            onPress={() => setActiveCategory(category.id)}
          >
            <Ionicons 
              name={category.icon} 
              size={18} 
              color={activeCategory === category.id ? '#FFF' : '#636E72'} 
            />
            <Text style={[
              styles.categoryButtonText,
              activeCategory === category.id && styles.categoryButtonTextActive
            ]}>
              {category.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tips List */}
      <View style={styles.tipsList}>
        <Text style={styles.sectionTitle}>
          {activeCategory === 'all' ? 'All Study Tips' : 
           STUDY_TIP_CATEGORIES.find(c => c.id === activeCategory)?.name}
          <Text style={styles.tipsCount}> ({filteredTips.length})</Text>
        </Text>
        
        <FlatList
          data={filteredTips}
          renderItem={renderStudyTip}
          keyExtractor={item => item.id}
          scrollEnabled={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="bulb-outline" size={60} color="#636E72" />
              <Text style={styles.emptyTitle}>No tips found</Text>
              <Text style={styles.emptyText}>
                Check back later for {activeCategory} tips
              </Text>
            </View>
          }
        />
      </View>

      {/* Quick Stats */}
      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Ionicons name="bookmark" size={20} color="#6C5CE7" />
          <Text style={styles.statNumber}>{bookmarkedTips.length}</Text>
          <Text style={styles.statLabel}>Saved Tips</Text>
        </View>
        
        <View style={styles.statDivider} />
        
        <View style={styles.statItem}>
          <Ionicons name="eye" size={20} color="#00B894" />
          <Text style={styles.statNumber}>{tips.length}</Text>
          <Text style={styles.statLabel}>Total Tips</Text>
        </View>
        
        <View style={styles.statDivider} />
        
        <View style={styles.statItem}>
          <Ionicons name="trending-up" size={20} color="#FD79A8" />
          <Text style={styles.statNumber}>
            {userPreferences?.study_score || 0}
          </Text>
          <Text style={styles.statLabel}>Study Score</Text>
        </View>
      </View>
    </ScrollView>
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
  header: {
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#1E2340',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#A29BFE',
  },
  dailyTipCard: {
    backgroundColor: '#FDCB6E20',
    marginHorizontal: 20,
    marginTop: 20,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FDCB6E30',
  },
  dailyTipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  dailyTipTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FDCB6E',
  },
  dailyTipText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 8,
  },
  dailyTipDescription: {
    fontSize: 14,
    color: '#A29BFE',
    lineHeight: 20,
  },
  categoriesScroll: {
    marginTop: 20,
  },
  categoriesContainer: {
    paddingHorizontal: 20,
    gap: 8,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E2340',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  categoryButtonActive: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  categoryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#636E72',
  },
  categoryButtonTextActive: {
    color: '#FFF',
  },
  tipsList: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 16,
  },
  tipsCount: {
    color: '#636E72',
  },
  tipCard: {
    backgroundColor: '#1E2340',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  tipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tipTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
  },
  tipDescription: {
    fontSize: 14,
    color: '#A29BFE',
    lineHeight: 22,
    marginBottom: 16,
  },
  subTips: {
    backgroundColor: '#0A0E27',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  subTipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  subTipText: {
    flex: 1,
    fontSize: 13,
    color: '#FFF',
    lineHeight: 18,
  },
  tipFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  difficulty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  difficultyLabel: {
    fontSize: 12,
    color: '#636E72',
  },
  difficultyStars: {
    flexDirection: 'row',
    gap: 2,
  },
  timeEstimate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 12,
    color: '#636E72',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#636E72',
    textAlign: 'center',
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#1E2340',
    marginHorizontal: 20,
    marginBottom: 30,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#636E72',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#2D3561',
  },
});