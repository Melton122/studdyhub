import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, FlatList,
  Modal, RefreshControl, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabaseConfig';
import { useAuth } from '../context/AuthContext';

const { width, height } = Dimensions.get('window');

const DIFFICULTY_LEVELS = [
  { id: 1, label: 'Easy', color: '#00B894' },
  { id: 2, label: 'Medium', color: '#FDCB6E' },
  { id: 3, label: 'Hard', color: '#FF7675' },
];

export default function FlashCardsScreen({ navigation }) {
  const { user } = useAuth();
  const [flashcards, setFlashcards] = useState([]);
  const [filteredCards, setFilteredCards] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [reviewMode, setReviewMode] = useState('unmastered'); // 'all', 'unmastered', 'difficult'
  const [filterSubject, setFilterSubject] = useState('all');

  const [newCard, setNewCard] = useState({
    front_text: '',
    back_text: '',
    hint: '',
    subject_id: '',
    difficulty_level: 1,
  });

  useEffect(() => {
    fetchData();
  }, [user]);

  useEffect(() => {
    filterCards();
  }, [flashcards, reviewMode, filterSubject]);

  const fetchData = async () => {
    try {
      const [cardsRes, subjectsRes] = await Promise.all([
        supabase
          .from('flash_cards')
          .select('*, subjects(name)')
          .eq('user_id', user?.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('subjects')
          .select('*')
          .order('name'),
      ]);

      setFlashcards(cardsRes.data || []);
      setFilteredCards(cardsRes.data || []);
      setSubjects(subjectsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load flashcards');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterCards = () => {
    let filtered = [...flashcards];

    // Filter by review mode
    if (reviewMode === 'unmastered') {
      filtered = filtered.filter(card => card.mastery_level < 70);
    } else if (reviewMode === 'difficult') {
      filtered = filtered.filter(card => card.difficulty_level === 3);
    }

    // Filter by subject
    if (filterSubject !== 'all') {
      filtered = filtered.filter(card => card.subject_id === filterSubject);
    }

    setFilteredCards(filtered);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleAddCard = async () => {
    if (!newCard.front_text.trim() || !newCard.back_text.trim()) {
      Alert.alert('Error', 'Please fill in both front and back of the card');
      return;
    }

    if (!newCard.subject_id) {
      Alert.alert('Error', 'Please select a subject');
      return;
    }

    try {
      const { error } = await supabase.from('flash_cards').insert([{
        ...newCard,
        user_id: user.id,
        mastery_level: 0,
        created_at: new Date().toISOString(),
      }]);

      if (error) throw error;

      Alert.alert('Success', 'Flashcard added successfully');
      setShowAddModal(false);
      setNewCard({
        front_text: '',
        back_text: '',
        hint: '',
        subject_id: '',
        difficulty_level: 1,
      });
      fetchData();
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const updateMasteryLevel = async (cardId, masteryChange) => {
    try {
      const card = flashcards.find(c => c.id === cardId);
      if (!card) return;

      const newMastery = Math.min(100, Math.max(0, (card.mastery_level || 0) + masteryChange));
      const nextReview = new Date();
      
      // Spaced repetition algorithm
      if (newMastery < 30) {
        nextReview.setHours(nextReview.getHours() + 1); // Review in 1 hour
      } else if (newMastery < 70) {
        nextReview.setDate(nextReview.getDate() + 1); // Review in 1 day
      } else {
        nextReview.setDate(nextReview.getDate() + 7); // Review in 1 week
      }

      const { error } = await supabase
        .from('flash_cards')
        .update({
          mastery_level: newMastery,
          last_reviewed_at: new Date().toISOString(),
          next_review_at: nextReview.toISOString(),
        })
        .eq('id', cardId);

      if (error) throw error;

      // Update local state
      const updatedCards = flashcards.map(card => 
        card.id === cardId 
          ? { 
              ...card, 
              mastery_level: newMastery,
              last_reviewed_at: new Date().toISOString(),
              next_review_at: nextReview.toISOString(),
            }
          : card
      );
      setFlashcards(updatedCards);
    } catch (error) {
      console.error('Error updating mastery:', error);
    }
  };

  const handleReviewAction = (action) => {
    const currentCard = filteredCards[currentCardIndex];
    
    switch (action) {
      case 'easy':
        updateMasteryLevel(currentCard.id, 20);
        break;
      case 'medium':
        updateMasteryLevel(currentCard.id, 10);
        break;
      case 'hard':
        updateMasteryLevel(currentCard.id, -10);
        break;
    }

    // Move to next card or finish review
    if (currentCardIndex < filteredCards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setIsFlipped(false);
    } else {
      Alert.alert(
        'Review Complete!',
        'You have reviewed all cards in this set.',
        [{ text: 'OK', onPress: () => setShowReviewModal(false) }]
      );
    }
  };

  const deleteCard = async (cardId) => {
    Alert.alert(
      'Delete Flashcard',
      'Are you sure you want to delete this flashcard?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('flash_cards')
                .delete()
                .eq('id', cardId);

              if (error) throw error;

              Alert.alert('Success', 'Flashcard deleted');
              fetchData();
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const startReview = (mode = 'all') => {
    if (filteredCards.length === 0) {
      Alert.alert('No Cards', 'No flashcards available for review');
      return;
    }

    setReviewMode(mode);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setShowReviewModal(true);
  };

  const renderFlashcardItem = ({ item }) => {
    const subject = subjects.find(s => s.id === item.subject_id);
    const difficulty = DIFFICULTY_LEVELS.find(d => d.id === item.difficulty_level);

    return (
      <TouchableOpacity
        style={styles.cardItem}
        onPress={() => {
          setNewCard({
            front_text: item.front_text,
            back_text: item.back_text,
            hint: item.hint || '',
            subject_id: item.subject_id,
            difficulty_level: item.difficulty_level,
          });
          // Could implement edit modal here
        }}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardMeta}>
            <View style={[styles.subjectBadge, { backgroundColor: difficulty?.color + '20' }]}>
              <Text style={[styles.subjectText, { color: difficulty?.color }]}>
                {subject?.name || 'Unknown'}
              </Text>
            </View>
            <View style={styles.difficultyBadge}>
              <Text style={[styles.difficultyText, { color: difficulty?.color }]}>
                {difficulty?.label}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => deleteCard(item.id)}>
            <Ionicons name="trash-outline" size={18} color="#FF7675" />
          </TouchableOpacity>
        </View>

        <Text style={styles.cardFront} numberOfLines={2}>
          {item.front_text}
        </Text>
        <Text style={styles.cardBackHint} numberOfLines={1}>
          {item.hint || 'No hint provided'}
        </Text>

        <View style={styles.cardFooter}>
          <View style={styles.masteryContainer}>
            <View style={styles.masteryBar}>
              <View 
                style={[
                  styles.masteryFill,
                  { width: `${item.mastery_level || 0}%` }
                ]} 
              />
            </View>
            <Text style={styles.masteryText}>{item.mastery_level || 0}%</Text>
          </View>
          
          {item.next_review_at && (
            <Text style={styles.reviewDate}>
              Next: {new Date(item.next_review_at).toLocaleDateString()}
            </Text>
          )}
        </View>
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

  const currentReviewCard = filteredCards[currentCardIndex];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Flash Cards</Text>
        <Text style={styles.headerSubtitle}>
          {flashcards.length} cards • {filteredCards.length} for review
        </Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.addButton]}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add" size={20} color="#FFF" />
          <Text style={styles.actionButtonText}>Add Card</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, styles.reviewButton]}
          onPress={() => startReview('unmastered')}
          disabled={filteredCards.length === 0}
        >
          <Ionicons name="play" size={20} color="#FFF" />
          <Text style={styles.actionButtonText}>
            Review ({filteredCards.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
      >
        <View style={styles.filters}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              filterSubject === 'all' && styles.filterButtonActive
            ]}
            onPress={() => setFilterSubject('all')}
          >
            <Text style={[
              styles.filterText,
              filterSubject === 'all' && styles.filterTextActive
            ]}>
              All Subjects
            </Text>
          </TouchableOpacity>

          {subjects.map(subject => (
            <TouchableOpacity
              key={subject.id}
              style={[
                styles.filterButton,
                filterSubject === subject.id && styles.filterButtonActive
              ]}
              onPress={() => setFilterSubject(subject.id)}
            >
              <Text style={[
                styles.filterText,
                filterSubject === subject.id && styles.filterTextActive
              ]}>
                {subject.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Review Mode Filters */}
      <View style={styles.reviewFilters}>
        {['all', 'unmastered', 'difficult'].map(mode => (
          <TouchableOpacity
            key={mode}
            style={[
              styles.reviewFilterButton,
              reviewMode === mode && styles.reviewFilterButtonActive
            ]}
            onPress={() => setReviewMode(mode)}
          >
            <Text style={[
              styles.reviewFilterText,
              reviewMode === mode && styles.reviewFilterTextActive
            ]}>
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Flashcards List */}
      <FlatList
        data={filteredCards}
        renderItem={renderFlashcardItem}
        keyExtractor={item => item.id}
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
            <Ionicons name="layers-outline" size={60} color="#636E72" />
            <Text style={styles.emptyTitle}>No flashcards yet</Text>
            <Text style={styles.emptyText}>
              Create your first flashcard to get started
            </Text>
            <TouchableOpacity 
              style={styles.emptyButton}
              onPress={() => setShowAddModal(true)}
            >
              <Text style={styles.emptyButtonText}>Create Flashcard</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Add Flashcard Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Flashcard</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Subject *</Text>
                <View style={styles.subjectButtons}>
                  {subjects.map(subject => (
                    <TouchableOpacity
                      key={subject.id}
                      style={[
                        styles.subjectButton,
                        newCard.subject_id === subject.id && styles.subjectButtonActive
                      ]}
                      onPress={() => setNewCard(prev => ({ ...prev, subject_id: subject.id }))}
                    >
                      <Text style={[
                        styles.subjectButtonText,
                        newCard.subject_id === subject.id && styles.subjectButtonTextActive
                      ]}>
                        {subject.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Front of Card *</Text>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  placeholder="Question, term, or concept..."
                  placeholderTextColor="#636E72"
                  value={newCard.front_text}
                  onChangeText={(text) => setNewCard(prev => ({ ...prev, front_text: text }))}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Back of Card *</Text>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  placeholder="Answer, definition, or explanation..."
                  placeholderTextColor="#636E72"
                  value={newCard.back_text}
                  onChangeText={(text) => setNewCard(prev => ({ ...prev, back_text: text }))}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Hint (Optional)</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Helpful hint for remembering..."
                  placeholderTextColor="#636E72"
                  value={newCard.hint}
                  onChangeText={(text) => setNewCard(prev => ({ ...prev, hint: text }))}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Difficulty Level</Text>
                <View style={styles.difficultyButtons}>
                  {DIFFICULTY_LEVELS.map(level => (
                    <TouchableOpacity
                      key={level.id}
                      style={[
                        styles.difficultyButton,
                        newCard.difficulty_level === level.id && styles.difficultyButtonActive,
                        { borderColor: level.color + '40' }
                      ]}
                      onPress={() => setNewCard(prev => ({ ...prev, difficulty_level: level.id }))}
                    >
                      <Text style={[
                        styles.difficultyButtonText,
                        newCard.difficulty_level === level.id && styles.difficultyButtonTextActive,
                        { color: newCard.difficulty_level === level.id ? '#FFF' : level.color }
                      ]}>
                        {level.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity 
                style={[
                  styles.saveButton,
                  (!newCard.front_text.trim() || !newCard.back_text.trim() || !newCard.subject_id) && 
                  styles.saveButtonDisabled
                ]}
                onPress={handleAddCard}
                disabled={!newCard.front_text.trim() || !newCard.back_text.trim() || !newCard.subject_id}
              >
                <Text style={styles.saveButtonText}>Save Flashcard</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Review Modal */}
      <Modal
        visible={showReviewModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowReviewModal(false)}
      >
        <View style={styles.reviewModalOverlay}>
          <View style={styles.reviewModalContent}>
            {currentReviewCard && (
              <>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewProgress}>
                    {currentCardIndex + 1} / {filteredCards.length}
                  </Text>
                  <TouchableOpacity onPress={() => setShowReviewModal(false)}>
                    <Ionicons name="close" size={24} color="#FFF" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.flashcardReview}
                  onPress={() => setIsFlipped(!isFlipped)}
                  activeOpacity={0.9}
                >
                  <View style={styles.flashcardInner}>
                    {!isFlipped ? (
                      <>
                        <Text style={styles.cardLabel}>FRONT</Text>
                        <Text style={styles.cardContent}>
                          {currentReviewCard.front_text}
                        </Text>
                        {currentReviewCard.hint && (
                          <Text style={styles.cardHint}>
                            Hint: {currentReviewCard.hint}
                          </Text>
                        )}
                      </>
                    ) : (
                      <>
                        <Text style={styles.cardLabel}>BACK</Text>
                        <Text style={styles.cardContent}>
                          {currentReviewCard.back_text}
                        </Text>
                        <Text style={styles.flipInstruction}>
                          Tap to show question
                        </Text>
                      </>
                    )}
                  </View>
                  <View style={styles.flipIndicator}>
                    <Ionicons 
                      name={isFlipped ? "arrow-up" : "arrow-down"} 
                      size={20} 
                      color="#6C5CE7" 
                    />
                    <Text style={styles.flipText}>
                      {isFlipped ? 'Show Question' : 'Show Answer'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {isFlipped && (
                  <View style={styles.reviewActions}>
                    <Text style={styles.reviewPrompt}>How well did you know this?</Text>
                    
                    <TouchableOpacity 
                      style={[styles.reviewActionButton, styles.easyButton]}
                      onPress={() => handleReviewAction('easy')}
                    >
                      <Ionicons name="checkmark-circle" size={20} color="#00B894" />
                      <Text style={styles.reviewActionText}>Easy</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.reviewActionButton, styles.mediumButton]}
                      onPress={() => handleReviewAction('medium')}
                    >
                      <Ionicons name="help-circle" size={20} color="#FDCB6E" />
                      <Text style={styles.reviewActionText}>Medium</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.reviewActionButton, styles.hardButton]}
                      onPress={() => handleReviewAction('hard')}
                    >
                      <Ionicons name="close-circle" size={20} color="#FF7675" />
                      <Text style={styles.reviewActionText}>Hard</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
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
  quickActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 14,
  },
  addButton: {
    backgroundColor: '#6C5CE7',
  },
  reviewButton: {
    backgroundColor: '#00B894',
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  filtersScroll: {
    marginBottom: 10,
  },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1E2340',
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  filterButtonActive: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#636E72',
  },
  filterTextActive: {
    color: '#FFF',
  },
  reviewFilters: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  reviewFilterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1E2340',
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  reviewFilterButtonActive: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  reviewFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#636E72',
  },
  reviewFilterTextActive: {
    color: '#FFF',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  cardItem: {
    backgroundColor: '#1E2340',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  subjectBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  subjectText: {
    fontSize: 12,
    fontWeight: '600',
  },
  difficultyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#2D3561',
  },
  difficultyText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardFront: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
    lineHeight: 22,
  },
  cardBackHint: {
    fontSize: 13,
    color: '#A29BFE',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  masteryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  masteryBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#2D3561',
    borderRadius: 3,
    overflow: 'hidden',
  },
  masteryFill: {
    height: '100%',
    backgroundColor: '#00B894',
    borderRadius: 3,
  },
  masteryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#636E72',
    minWidth: 40,
  },
  reviewDate: {
    fontSize: 11,
    color: '#636E72',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
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
    color: '#636E72',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: '#6C5CE7',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0A0E27',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2D3561',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  modalBody: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A29BFE',
    marginBottom: 8,
  },
  subjectButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subjectButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#1E2340',
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  subjectButtonActive: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  subjectButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#A29BFE',
  },
  subjectButtonTextActive: {
    color: '#FFF',
  },
  formInput: {
    backgroundColor: '#1E2340',
    borderWidth: 1,
    borderColor: '#2D3561',
    borderRadius: 12,
    padding: 14,
    color: '#FFF',
    fontSize: 15,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  difficultyButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  difficultyButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  difficultyButtonActive: {
    backgroundColor: '#6C5CE7',
  },
  difficultyButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  difficultyButtonTextActive: {
    color: '#FFF',
  },
  saveButton: {
    backgroundColor: '#6C5CE7',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  reviewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewModalContent: {
    backgroundColor: '#0A0E27',
    borderRadius: 24,
    width: width * 0.9,
    maxHeight: height * 0.8,
    borderWidth: 1,
    borderColor: '#2D3561',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2D3561',
  },
  reviewProgress: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A29BFE',
  },
  flashcardReview: {
    padding: 30,
    minHeight: 300,
    justifyContent: 'center',
  },
  flashcardInner: {
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#636E72',
    marginBottom: 16,
    letterSpacing: 1,
  },
  cardContent: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFF',
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 20,
  },
  cardHint: {
    fontSize: 14,
    color: '#A29BFE',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
  },
  flipInstruction: {
    fontSize: 13,
    color: '#636E72',
    marginTop: 20,
  },
  flipIndicator: {
    alignItems: 'center',
    marginTop: 30,
  },
  flipText: {
    fontSize: 12,
    color: '#6C5CE7',
    marginTop: 4,
  },
  reviewActions: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#2D3561',
  },
  reviewPrompt: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  reviewActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  easyButton: {
    backgroundColor: '#00B89420',
    borderWidth: 1,
    borderColor: '#00B894',
  },
  mediumButton: {
    backgroundColor: '#FDCB6E20',
    borderWidth: 1,
    borderColor: '#FDCB6E',
  },
  hardButton: {
    backgroundColor: '#FF767520',
    borderWidth: 1,
    borderColor: '#FF7675',
  },
  reviewActionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
});