import { Pool } from 'pg';
import { pool } from '../config/database.js';

export interface PersonalizedContent {
  entityType: 'organization' | 'fundraiser' | 'event';
  entityId: string;
  relevanceScore: number;
  matchingInterests: number;
  title: string;
  description: string;
  imageUrl?: string;
  createdAt: Date;
}

export interface ContentFeedOptions {
  userId: string;
  page?: number;
  limit?: number;
  entityTypes?: string[];
  minRelevanceScore?: number;
  algorithm?: 'latest' | 'relevance' | 'popularity' | 'mixed';
}

export interface RecommendationOptions {
  userId: string;
  limit?: number;
  excludeSelected?: boolean;
  basedOnBehavior?: boolean;
}

export class PersonalizationService {
  private db: Pool;

  constructor() {
    this.db = pool;
  }

  /**
   * Get personalized content feed for a user based on their interests
   */
  async getPersonalizedFeed(options: ContentFeedOptions): Promise<{
    content: PersonalizedContent[];
    totalCount: number;
    page: number;
    hasMore: boolean;
  }> {
    const {
      userId,
      page = 1,
      limit = 20,
      entityTypes = ['organization', 'fundraiser', 'event'],
      minRelevanceScore = 2.0,
      algorithm = 'mixed'
    } = options;

    const offset = (page - 1) * limit;

    try {
      // Get user's feed preferences
      const preferencesQuery = `
        SELECT content_type_preferences, feed_algorithm, interest_weights
        FROM user_feed_preferences
        WHERE user_id = $1
      `;
      const preferencesResult = await this.db.query(preferencesQuery, [userId]);
      const preferences = preferencesResult.rows[0];

      // Build the main content query based on algorithm
      let contentQuery = '';
      let orderBy = '';

      switch (algorithm) {
        case 'latest':
          orderBy = 'ORDER BY created_at DESC';
          break;
        case 'relevance':
          orderBy = 'ORDER BY relevance_score DESC, created_at DESC';
          break;
        case 'popularity':
          orderBy = 'ORDER BY popularity_score DESC, relevance_score DESC';
          break;
        case 'mixed':
        default:
          orderBy = 'ORDER BY (relevance_score * 0.6 + popularity_score * 0.4) DESC, created_at DESC';
          break;
      }

      // Get personalized content based on user interests
      contentQuery = `
        WITH user_content_relevance AS (
          SELECT
            ui.user_id,
            et.entity_type,
            et.entity_id,
            AVG(ui.priority * et.relevance_score / 100.0) as relevance_score,
            COUNT(*) as matching_interests
          FROM user_interests ui
          JOIN entity_tags et ON ui.tag_id = et.tag_id
          WHERE ui.user_id = $1 AND ui.is_active = true
          GROUP BY ui.user_id, et.entity_type, et.entity_id
          HAVING AVG(ui.priority * et.relevance_score / 100.0) >= $4
        ),
        content_with_scores AS (
          SELECT
            ucr.entity_type,
            ucr.entity_id,
            ucr.relevance_score,
            ucr.matching_interests,
            CASE
              WHEN ucr.entity_type = 'organization' THEN
                (SELECT COUNT(*) FROM fundraisers WHERE organization_id = ucr.entity_id)
              WHEN ucr.entity_type = 'fundraiser' THEN
                (SELECT donation_count FROM fundraisers WHERE id = ucr.entity_id)
              WHEN ucr.entity_type = 'event' THEN
                (SELECT attendee_count FROM events WHERE id = ucr.entity_id)
              ELSE 0
            END as popularity_score,
            CASE
              WHEN ucr.entity_type = 'organization' THEN
                (SELECT name FROM organizations WHERE id = ucr.entity_id)
              WHEN ucr.entity_type = 'fundraiser' THEN
                (SELECT title FROM fundraisers WHERE id = ucr.entity_id)
              WHEN ucr.entity_type = 'event' THEN
                (SELECT title FROM events WHERE id = ucr.entity_id)
            END as title,
            CASE
              WHEN ucr.entity_type = 'organization' THEN
                (SELECT mission_statement FROM organizations WHERE id = ucr.entity_id)
              WHEN ucr.entity_type = 'fundraiser' THEN
                (SELECT description FROM fundraisers WHERE id = ucr.entity_id)
              WHEN ucr.entity_type = 'event' THEN
                (SELECT description FROM events WHERE id = ucr.entity_id)
            END as description,
            CASE
              WHEN ucr.entity_type = 'organization' THEN
                (SELECT logo_url FROM organizations WHERE id = ucr.entity_id)
              WHEN ucr.entity_type = 'fundraiser' THEN
                (SELECT image_url FROM fundraisers WHERE id = ucr.entity_id)
              WHEN ucr.entity_type = 'event' THEN
                (SELECT image_url FROM events WHERE id = ucr.entity_id)
            END as image_url,
            CASE
              WHEN ucr.entity_type = 'organization' THEN
                (SELECT created_at FROM organizations WHERE id = ucr.entity_id)
              WHEN ucr.entity_type = 'fundraiser' THEN
                (SELECT created_at FROM fundraisers WHERE id = ucr.entity_id)
              WHEN ucr.entity_type = 'event' THEN
                (SELECT created_at FROM events WHERE id = ucr.entity_id)
            END as created_at
          FROM user_content_relevance ucr
          WHERE ucr.entity_type = ANY($5)
        )
        SELECT * FROM content_with_scores
        WHERE title IS NOT NULL
        ${orderBy}
        LIMIT $2 OFFSET $3
      `;

      const contentResult = await this.db.query(contentQuery, [
        userId,
        limit,
        offset,
        minRelevanceScore,
        entityTypes
      ]);

      // Get total count for pagination
      const countQuery = `
        SELECT COUNT(*) as total
        FROM (
          SELECT DISTINCT et.entity_type, et.entity_id
          FROM user_interests ui
          JOIN entity_tags et ON ui.tag_id = et.tag_id
          WHERE ui.user_id = $1 AND ui.is_active = true
            AND et.entity_type = ANY($2)
          GROUP BY et.entity_type, et.entity_id
          HAVING AVG(ui.priority * et.relevance_score / 100.0) >= $3
        ) as filtered_content
      `;

      const countResult = await this.db.query(countQuery, [
        userId,
        entityTypes,
        minRelevanceScore
      ]);

      const totalCount = parseInt(countResult.rows[0].total);
      const hasMore = offset + contentResult.rows.length < totalCount;

      return {
        content: contentResult.rows.map(row => ({
          entityType: row.entity_type,
          entityId: row.entity_id,
          relevanceScore: parseFloat(row.relevance_score),
          matchingInterests: parseInt(row.matching_interests),
          title: row.title,
          description: row.description || '',
          imageUrl: row.image_url,
          createdAt: new Date(row.created_at)
        })),
        totalCount,
        page,
        hasMore
      };

    } catch (error) {
      console.error('Error getting personalized feed:', error);
      throw new Error('Failed to retrieve personalized content feed');
    }
  }

  /**
   * Get recommended tags for a user based on their behavior and similar users
   */
  async getRecommendedTags(options: RecommendationOptions): Promise<{
    recommendedTags: Array<{
      tagId: string;
      tagName: string;
      categoryName: string;
      relevanceScore: number;
      reason: string;
    }>;
  }> {
    const {
      userId,
      limit = 10,
      excludeSelected = true,
      basedOnBehavior = true
    } = options;

    try {
      let query = '';
      let queryParams: any[] = [userId, limit];

      if (basedOnBehavior) {
        // Recommend based on user behavior and similar users
        query = `
          WITH user_selected_tags AS (
            SELECT tag_id FROM user_interests WHERE user_id = $1 AND is_active = true
          ),
          similar_users AS (
            SELECT ui2.user_id, COUNT(*) as common_interests
            FROM user_interests ui1
            JOIN user_interests ui2 ON ui1.tag_id = ui2.tag_id
            WHERE ui1.user_id = $1 AND ui2.user_id != $1
              AND ui1.is_active = true AND ui2.is_active = true
            GROUP BY ui2.user_id
            ORDER BY common_interests DESC
            LIMIT 50
          ),
          popular_among_similar AS (
            SELECT
              t.id as tag_id,
              t.name as tag_name,
              c.name as category_name,
              COUNT(*) as frequency,
              AVG(ui.priority) as avg_priority
            FROM similar_users su
            JOIN user_interests ui ON su.user_id = ui.user_id
            JOIN interest_tags t ON ui.tag_id = t.id
            JOIN interest_categories c ON t.category_id = c.id
            WHERE ui.is_active = true
              ${excludeSelected ? 'AND t.id NOT IN (SELECT tag_id FROM user_selected_tags)' : ''}
            GROUP BY t.id, t.name, c.name
            ORDER BY frequency DESC, avg_priority DESC
            LIMIT $2
          )
          SELECT
            tag_id,
            tag_name,
            category_name,
            (frequency * avg_priority / 5.0) as relevance_score,
            'Popular among users with similar interests' as reason
          FROM popular_among_similar
        `;
      } else {
        // Recommend based on global popularity and category diversity
        query = `
          WITH user_selected_tags AS (
            SELECT tag_id FROM user_interests WHERE user_id = $1 AND is_active = true
          ),
          user_categories AS (
            SELECT DISTINCT t.category_id
            FROM user_selected_tags ust
            JOIN interest_tags t ON ust.tag_id = t.id
          ),
          popular_tags AS (
            SELECT
              t.id as tag_id,
              t.name as tag_name,
              c.name as category_name,
              c.id as category_id,
              COUNT(ui.user_id) as user_count,
              AVG(ui.priority) as avg_priority,
              CASE
                WHEN c.id IN (SELECT category_id FROM user_categories) THEN 0.8
                ELSE 1.2
              END as diversity_bonus
            FROM interest_tags t
            JOIN interest_categories c ON t.category_id = c.id
            LEFT JOIN user_interests ui ON t.id = ui.tag_id AND ui.is_active = true
            WHERE t.is_active = true AND c.is_active = true
              ${excludeSelected ? 'AND t.id NOT IN (SELECT tag_id FROM user_selected_tags)' : ''}
            GROUP BY t.id, t.name, c.name, c.id
            ORDER BY (user_count * diversity_bonus) DESC
            LIMIT $2
          )
          SELECT
            tag_id,
            tag_name,
            category_name,
            (user_count * diversity_bonus * avg_priority / 100.0) as relevance_score,
            CASE
              WHEN diversity_bonus > 1.0 THEN 'Popular in new interest areas'
              ELSE 'Popular in your interest areas'
            END as reason
          FROM popular_tags
        `;
      }

      const result = await this.db.query(query, queryParams);

      return {
        recommendedTags: result.rows.map(row => ({
          tagId: row.tag_id,
          tagName: row.tag_name,
          categoryName: row.category_name,
          relevanceScore: parseFloat(row.relevance_score || 0),
          reason: row.reason
        }))
      };

    } catch (error) {
      console.error('Error getting recommended tags:', error);
      throw new Error('Failed to retrieve recommended tags');
    }
  }

  /**
   * Update user's feed preferences
   */
  async updateFeedPreferences(
    userId: string,
    preferences: {
      interestWeights?: { [tagId: string]: number };
      contentTypePreferences?: { [entityType: string]: number };
      feedAlgorithm?: 'latest' | 'relevance' | 'popularity' | 'mixed';
      showRecommendedContent?: boolean;
    }
  ): Promise<void> {
    try {
      const query = `
        INSERT INTO user_feed_preferences (
          user_id, interest_weights, content_type_preferences,
          feed_algorithm, show_recommended_content
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id) DO UPDATE SET
          interest_weights = COALESCE($2, user_feed_preferences.interest_weights),
          content_type_preferences = COALESCE($3, user_feed_preferences.content_type_preferences),
          feed_algorithm = COALESCE($4, user_feed_preferences.feed_algorithm),
          show_recommended_content = COALESCE($5, user_feed_preferences.show_recommended_content),
          updated_at = CURRENT_TIMESTAMP
      `;

      await this.db.query(query, [
        userId,
        preferences.interestWeights ? JSON.stringify(preferences.interestWeights) : null,
        preferences.contentTypePreferences ? JSON.stringify(preferences.contentTypePreferences) : null,
        preferences.feedAlgorithm || null,
        preferences.showRecommendedContent ?? null
      ]);

    } catch (error) {
      console.error('Error updating feed preferences:', error);
      throw new Error('Failed to update feed preferences');
    }
  }

  /**
   * Get analytics about user's interests and feed performance
   */
  async getUserAnalytics(userId: string): Promise<{
    totalInterests: number;
    categoriesCount: number;
    feedActivityScore: number;
    topCategories: Array<{
      categoryName: string;
      tagCount: number;
      avgPriority: number;
    }>;
  }> {
    try {
      const analyticsQuery = `
        WITH user_interest_summary AS (
          SELECT
            COUNT(ui.tag_id) as total_interests,
            COUNT(DISTINCT t.category_id) as categories_count,
            AVG(ui.priority) as avg_priority
          FROM user_interests ui
          JOIN interest_tags t ON ui.tag_id = t.id
          WHERE ui.user_id = $1 AND ui.is_active = true
        ),
        category_breakdown AS (
          SELECT
            c.name as category_name,
            COUNT(ui.tag_id) as tag_count,
            AVG(ui.priority) as avg_priority
          FROM user_interests ui
          JOIN interest_tags t ON ui.tag_id = t.id
          JOIN interest_categories c ON t.category_id = c.id
          WHERE ui.user_id = $1 AND ui.is_active = true
          GROUP BY c.id, c.name
          ORDER BY tag_count DESC, avg_priority DESC
          LIMIT 5
        )
        SELECT
          uis.total_interests,
          uis.categories_count,
          uis.avg_priority as feed_activity_score,
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'categoryName', cb.category_name,
              'tagCount', cb.tag_count,
              'avgPriority', cb.avg_priority
            ) ORDER BY cb.tag_count DESC
          ) as top_categories
        FROM user_interest_summary uis
        CROSS JOIN category_breakdown cb
        GROUP BY uis.total_interests, uis.categories_count, uis.avg_priority
      `;

      const result = await this.db.query(analyticsQuery, [userId]);
      const row = result.rows[0];

      if (!row) {
        return {
          totalInterests: 0,
          categoriesCount: 0,
          feedActivityScore: 0,
          topCategories: []
        };
      }

      return {
        totalInterests: parseInt(row.total_interests || 0),
        categoriesCount: parseInt(row.categories_count || 0),
        feedActivityScore: parseFloat(row.feed_activity_score || 0),
        topCategories: row.top_categories || []
      };

    } catch (error) {
      console.error('Error getting user analytics:', error);
      throw new Error('Failed to retrieve user analytics');
    }
  }
}

export const personalizationService = new PersonalizationService();