import React from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, FlatList, Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function TutorReviewsScreen({ route, navigation }) {
  const { reviews, tutorName } = route.params;

  const renderReviewItem = ({ item }) => (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewerInfo}>
          {item.students?.profile_image_url ? (
            <Image 
              source={{ uri: item.students.profile_image_url }} 
              style={styles.reviewerAvatar}
            />
          ) : (
            <View style={styles.reviewerAvatarPlaceholder}>
              <Text style={styles.reviewerInitials}>
                {item.students?.full_name?.charAt(0) || 'S'}
              </Text>
            </View>
          )}
          <View>
            <Text style={styles.reviewerName}>{item.students?.full_name || 'Student'}</Text>
            <Text style={styles.reviewDate}>
              {new Date(item.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </Text>
          </View>
        </View>
        <View style={styles.ratingContainer}>
          {[...Array(5)].map((_, i) => (
            <Ionicons
              key={i}
              name={i < Math.floor(item.rating) ? "star" : "star-outline"}
              size={16}
              color="#FDCB6E"
            />
          ))}
          <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
        </View>
      </View>
      
      <Text style={styles.reviewComment}>{item.comment}</Text>
    </View>
  );

  const calculateAverage = () => {
    if (!reviews.length) return 0;
    const total = reviews.reduce((sum, review) => sum + review.rating, 0);
    return (total / reviews.length).toFixed(1);
  };

  const averageRating = calculateAverage();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reviews</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Reviews Summary */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryContent}>
          <View style={styles.averageRating}>
            <Text style={styles.averageNumber}>{averageRating}</Text>
            <View style={styles.starsContainer}>
              {[...Array(5)].map((_, i) => (
                <Ionicons
                  key={i}
                  name={i < Math.floor(averageRating) ? "star" : "star-outline"}
                  size={20}
                  color="#FDCB6E"
                />
              ))}
            </View>
            <Text style={styles.totalReviews}>{reviews.length} reviews</Text>
          </View>
          
          <View style={styles.ratingBreakdown}>
            {[5, 4, 3, 2, 1].map(rating => {
              const count = reviews.filter(r => Math.floor(r.rating) === rating).length;
              const percentage = reviews.length ? (count / reviews.length) * 100 : 0;
              
              return (
                <View key={rating} style={styles.ratingRow}>
                  <Text style={styles.ratingLabel}>{rating} stars</Text>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${percentage}%` }]} />
                  </View>
                  <Text style={styles.ratingCount}>{count}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* Reviews List */}
      <FlatList
        data={reviews}
        renderItem={renderReviewItem}
        keyExtractor={(item, index) => index.toString()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <Text style={styles.listTitle}>All Reviews ({reviews.length})</Text>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubble-outline" size={60} color="#636E72" />
            <Text style={styles.emptyTitle}>No Reviews Yet</Text>
            <Text style={styles.emptyText}>
              Be the first to review {tutorName}
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
  summaryCard: {
    backgroundColor: '#1E2340',
    margin: 20,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  summaryContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  averageRating: {
    alignItems: 'center',
    marginRight: 30,
    minWidth: 100,
  },
  averageNumber: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  totalReviews: {
    fontSize: 14,
    color: '#A29BFE',
  },
  ratingBreakdown: {
    flex: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingLabel: {
    fontSize: 12,
    color: '#A29BFE',
    width: 60,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#2D3561',
    borderRadius: 3,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FDCB6E',
    borderRadius: 3,
  },
  ratingCount: {
    fontSize: 12,
    color: '#636E72',
    width: 30,
    textAlign: 'right',
  },
  listContent: {
    padding: 20,
    paddingTop: 10,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 20,
  },
  reviewCard: {
    backgroundColor: '#1E2340',
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reviewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  reviewerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6C5CE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reviewerInitials: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  reviewerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 2,
  },
  reviewDate: {
    fontSize: 12,
    color: '#636E72',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FDCB6E',
    marginLeft: 8,
  },
  reviewComment: {
    fontSize: 15,
    color: '#A29BFE',
    lineHeight: 22,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#A29BFE',
    textAlign: 'center',
  },
});