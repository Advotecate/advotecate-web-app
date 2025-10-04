import { Pool } from 'pg';

// Database connection (assuming it's available globally)
declare global {
  var db: Pool;
}

interface GetCategoriesOptions {
  isActive?: boolean;
  sortBy?: 'name' | 'sortOrder';
}

interface GetTagsOptions {
  categoryId?: string;
  isActive?: boolean;
  sortBy?: 'name' | 'sortOrder';
  includeCategory?: boolean;
}

interface GetPersonalizedFeedOptions {
  limit?: number;
  offset?: number;
  contentTypes?: string[];
  algorithm?: 'latest' | 'relevance' | 'popularity' | 'mixed';
}

class InterestService {

  // ===== INTEREST CATEGORIES =====

  async getCategories(options: GetCategoriesOptions = {}) {
    try {
      let query = 'SELECT * FROM interest_categories';
      const conditions = [];
      const values = [];

      if (options.isActive !== undefined) {
        conditions.push(`is_active = $${values.length + 1}`);
        values.push(options.isActive);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      // Add ordering
      if (options.sortBy === 'name') {
        query += ' ORDER BY name ASC';
      } else {
        query += ' ORDER BY sort_order ASC, name ASC';
      }

      const result = await db.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('Error getting categories:', error);
      throw error;
    }
  }

  async getCategory(idOrSlug: string) {
    try {
      const query = `
        SELECT * FROM interest_categories
        WHERE id = $1 OR slug = $1
      `;
      const result = await db.query(query, [idOrSlug]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting category:', error);
      throw error;
    }
  }

  async createCategory(categoryData: any) {
    try {
      const {
        name,
        slug,
        description,
        iconName,
        colorHex,
        colorBg,
        sortOrder = 0
      } = categoryData;

      const query = `
        INSERT INTO interest_categories
        (name, slug, description, icon_name, color_hex, color_bg, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const values = [name, slug, description, iconName, colorHex, colorBg, sortOrder];
      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  }

  async updateCategory(id: string, updates: any) {
    try {
      const allowedFields = [
        'name', 'slug', 'description', 'icon_name', 'color_hex',
        'color_bg', 'sort_order', 'is_active'
      ];

      const setClause = [];
      const values = [];

      for (const [key, value] of Object.entries(updates)) {
        const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        if (allowedFields.includes(dbField)) {
          setClause.push(`${dbField} = $${values.length + 1}`);
          values.push(value);
        }
      }

      if (setClause.length === 0) {
        throw new Error('No valid fields to update');
      }

      values.push(id);

      const query = `
        UPDATE interest_categories
        SET ${setClause.join(', ')}
        WHERE id = $${values.length}
        RETURNING *
      `;

      const result = await db.query(query, values);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  }

  async deleteCategory(id: string) {
    try {
      const query = 'DELETE FROM interest_categories WHERE id = $1';
      const result = await db.query(query, [id]);
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  }

  // ===== INTEREST TAGS =====

  async getTags(options: GetTagsOptions = {}) {
    try {
      let query = `
        SELECT t.*,
               ${options.includeCategory ? `
                 c.name as category_name,
                 c.slug as category_slug,
                 c.icon_name as category_icon_name,
                 c.color_hex as category_color_hex,
                 c.color_bg as category_color_bg
               ` : 'null as category_name'}
        FROM interest_tags t
        ${options.includeCategory ? 'LEFT JOIN interest_categories c ON t.category_id = c.id' : ''}
      `;

      const conditions = [];
      const values = [];

      if (options.categoryId) {
        conditions.push(`t.category_id = $${values.length + 1}`);
        values.push(options.categoryId);
      }

      if (options.isActive !== undefined) {
        conditions.push(`t.is_active = $${values.length + 1}`);
        values.push(options.isActive);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      // Add ordering
      if (options.sortBy === 'name') {
        query += ' ORDER BY t.name ASC';
      } else {
        query += ' ORDER BY t.sort_order ASC, t.name ASC';
      }

      const result = await db.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('Error getting tags:', error);
      throw error;
    }
  }

  async getTag(idOrSlug: string) {
    try {
      const query = `
        SELECT t.*,
               c.name as category_name,
               c.slug as category_slug,
               c.icon_name as category_icon_name,
               c.color_hex as category_color_hex,
               c.color_bg as category_color_bg
        FROM interest_tags t
        LEFT JOIN interest_categories c ON t.category_id = c.id
        WHERE t.id = $1 OR t.slug = $1
      `;
      const result = await db.query(query, [idOrSlug]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting tag:', error);
      throw error;
    }
  }

  async searchTags(searchQuery: string) {
    try {
      const query = `
        SELECT t.*,
               c.name as category_name,
               c.color_hex as category_color_hex,
               c.color_bg as category_color_bg
        FROM interest_tags t
        LEFT JOIN interest_categories c ON t.category_id = c.id
        WHERE t.is_active = true
          AND (
            t.name ILIKE $1
            OR t.description ILIKE $1
            OR c.name ILIKE $1
          )
        ORDER BY
          CASE
            WHEN t.name ILIKE $2 THEN 1
            WHEN t.name ILIKE $1 THEN 2
            WHEN c.name ILIKE $1 THEN 3
            ELSE 4
          END,
          t.name ASC
        LIMIT 50
      `;

      const searchPattern = `%${searchQuery}%`;
      const exactPattern = `${searchQuery}%`;
      const result = await db.query(query, [searchPattern, exactPattern]);
      return result.rows;
    } catch (error) {
      console.error('Error searching tags:', error);
      throw error;
    }
  }

  async createTag(tagData: any) {
    try {
      const {
        categoryId,
        name,
        slug,
        description,
        iconName,
        colorOverride,
        sortOrder = 0,
        metadata = {}
      } = tagData;

      const query = `
        INSERT INTO interest_tags
        (category_id, name, slug, description, icon_name, color_override, sort_order, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const values = [
        categoryId,
        name,
        slug,
        description,
        iconName || null,
        colorOverride || null,
        sortOrder,
        JSON.stringify(metadata)
      ];

      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating tag:', error);
      throw error;
    }
  }

  async updateTag(id: string, updates: any) {
    try {
      const allowedFields = [
        'category_id', 'name', 'slug', 'description', 'icon_name',
        'color_override', 'sort_order', 'is_active', 'metadata'
      ];

      const setClause = [];
      const values = [];

      for (const [key, value] of Object.entries(updates)) {
        const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        if (allowedFields.includes(dbField)) {
          if (dbField === 'metadata' && typeof value === 'object') {
            setClause.push(`${dbField} = $${values.length + 1}`);
            values.push(JSON.stringify(value));
          } else {
            setClause.push(`${dbField} = $${values.length + 1}`);
            values.push(value);
          }
        }
      }

      if (setClause.length === 0) {
        throw new Error('No valid fields to update');
      }

      values.push(id);

      const query = `
        UPDATE interest_tags
        SET ${setClause.join(', ')}
        WHERE id = $${values.length}
        RETURNING *
      `;

      const result = await db.query(query, values);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error updating tag:', error);
      throw error;
    }
  }

  async deleteTag(id: string) {
    try {
      const query = 'DELETE FROM interest_tags WHERE id = $1';
      const result = await db.query(query, [id]);
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting tag:', error);
      throw error;
    }
  }

  // ===== USER INTERESTS =====

  async getUserInterests(userId: string) {
    try {
      const query = `
        SELECT ui.*,
               t.name as tag_name,
               t.slug as tag_slug,
               t.description as tag_description,
               t.icon_name as tag_icon_name,
               t.color_override as tag_color_override,
               c.name as category_name,
               c.color_hex as category_color_hex,
               c.color_bg as category_color_bg,
               c.icon_name as category_icon_name
        FROM user_interests ui
        JOIN interest_tags t ON ui.tag_id = t.id
        JOIN interest_categories c ON t.category_id = c.id
        WHERE ui.user_id = $1 AND ui.is_active = true
        ORDER BY ui.priority DESC, c.sort_order ASC, t.sort_order ASC
      `;

      const result = await db.query(query, [userId]);
      return result.rows;
    } catch (error) {
      console.error('Error getting user interests:', error);
      throw error;
    }
  }

  async updateUserInterests(userId: string, interests: Array<{tagId: string, priority: number}>) {
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      // First, deactivate all current interests
      await client.query(
        'UPDATE user_interests SET is_active = false WHERE user_id = $1',
        [userId]
      );

      // Then insert/update new interests
      for (const interest of interests) {
        await client.query(`
          INSERT INTO user_interests (user_id, tag_id, priority)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id, tag_id)
          DO UPDATE SET priority = $3, is_active = true, updated_at = CURRENT_TIMESTAMP
        `, [userId, interest.tagId, interest.priority]);
      }

      await client.query('COMMIT');

      // Return updated interests
      return this.getUserInterests(userId);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error updating user interests:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async addUserInterest(userId: string, tagId: string, priority: number) {
    try {
      const query = `
        INSERT INTO user_interests (user_id, tag_id, priority)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, tag_id)
        DO UPDATE SET priority = $3, is_active = true, updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;

      const result = await db.query(query, [userId, tagId, priority]);
      return result.rows[0];
    } catch (error) {
      console.error('Error adding user interest:', error);
      throw error;
    }
  }

  async removeUserInterest(userId: string, tagId: string) {
    try {
      const query = 'DELETE FROM user_interests WHERE user_id = $1 AND tag_id = $2';
      const result = await db.query(query, [userId, tagId]);
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error removing user interest:', error);
      throw error;
    }
  }

  // ===== ENTITY TAGGING =====

  async getEntityTags(entityType: string, entityId: string) {
    try {
      const query = `
        SELECT et.*,
               t.name as tag_name,
               t.slug as tag_slug,
               t.icon_name as tag_icon_name,
               t.color_override as tag_color_override,
               c.name as category_name,
               c.color_hex as category_color_hex,
               c.color_bg as category_color_bg,
               c.icon_name as category_icon_name
        FROM entity_tags et
        JOIN interest_tags t ON et.tag_id = t.id
        JOIN interest_categories c ON t.category_id = c.id
        WHERE et.entity_type = $1 AND et.entity_id = $2
        ORDER BY et.relevance_score DESC, c.sort_order ASC, t.sort_order ASC
      `;

      const result = await db.query(query, [entityType, entityId]);
      return result.rows;
    } catch (error) {
      console.error('Error getting entity tags:', error);
      throw error;
    }
  }

  async tagEntity(
    entityType: string,
    entityId: string,
    tags: Array<{tagId: string, relevanceScore: number, isAutoTagged?: boolean}>,
    userId?: string
  ) {
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      const entityTags = [];

      for (const tag of tags) {
        const result = await client.query(`
          INSERT INTO entity_tags (tag_id, entity_type, entity_id, relevance_score, is_auto_tagged, tagged_by_user_id)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (tag_id, entity_type, entity_id)
          DO UPDATE SET
            relevance_score = $4,
            is_auto_tagged = $5,
            tagged_by_user_id = $6,
            updated_at = CURRENT_TIMESTAMP
          RETURNING *
        `, [
          tag.tagId,
          entityType,
          entityId,
          tag.relevanceScore,
          tag.isAutoTagged || false,
          userId || null
        ]);

        entityTags.push(result.rows[0]);
      }

      await client.query('COMMIT');
      return entityTags;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error tagging entity:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async removeEntityTag(entityType: string, entityId: string, tagId: string) {
    try {
      const query = `
        DELETE FROM entity_tags
        WHERE entity_type = $1 AND entity_id = $2 AND tag_id = $3
      `;
      const result = await db.query(query, [entityType, entityId, tagId]);
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error removing entity tag:', error);
      throw error;
    }
  }

  async getEntitiesByTag(tagId: string, entityType?: string) {
    try {
      let query = `
        SELECT et.entity_type, et.entity_id, et.relevance_score,
               t.name as tag_name
        FROM entity_tags et
        JOIN interest_tags t ON et.tag_id = t.id
        WHERE et.tag_id = $1
      `;

      const values = [tagId];

      if (entityType) {
        query += ' AND et.entity_type = $2';
        values.push(entityType);
      }

      query += ' ORDER BY et.relevance_score DESC LIMIT 100';

      const result = await db.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('Error getting entities by tag:', error);
      throw error;
    }
  }

  // ===== USER FEED PREFERENCES =====

  async getFeedPreferences(userId: string) {
    try {
      const query = `
        SELECT * FROM user_feed_preferences WHERE user_id = $1
      `;

      const result = await db.query(query, [userId]);

      if (result.rows.length === 0) {
        // Create default preferences
        return this.createDefaultFeedPreferences(userId);
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error getting feed preferences:', error);
      throw error;
    }
  }

  async createDefaultFeedPreferences(userId: string) {
    try {
      const query = `
        INSERT INTO user_feed_preferences (user_id)
        VALUES ($1)
        RETURNING *
      `;

      const result = await db.query(query, [userId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating default feed preferences:', error);
      throw error;
    }
  }

  async updateFeedPreferences(userId: string, preferences: any) {
    try {
      const {
        interestWeights,
        contentTypePreferences,
        feedAlgorithm,
        showRecommendedContent
      } = preferences;

      const query = `
        UPDATE user_feed_preferences
        SET
          interest_weights = COALESCE($2, interest_weights),
          content_type_preferences = COALESCE($3, content_type_preferences),
          feed_algorithm = COALESCE($4, feed_algorithm),
          show_recommended_content = COALESCE($5, show_recommended_content),
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
        RETURNING *
      `;

      const values = [
        userId,
        interestWeights ? JSON.stringify(interestWeights) : null,
        contentTypePreferences ? JSON.stringify(contentTypePreferences) : null,
        feedAlgorithm || null,
        showRecommendedContent !== undefined ? showRecommendedContent : null
      ];

      const result = await db.query(query, values);

      if (result.rows.length === 0) {
        // Create if doesn't exist
        return this.createDefaultFeedPreferences(userId);
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error updating feed preferences:', error);
      throw error;
    }
  }

  // ===== PERSONALIZED CONTENT =====

  async getPersonalizedFeed(userId: string, options: GetPersonalizedFeedOptions = {}) {
    try {
      const {
        limit = 20,
        offset = 0,
        contentTypes = ['organization', 'fundraiser', 'event'],
        algorithm = 'mixed'
      } = options;

      // This is a simplified version - in production, you'd want more sophisticated scoring
      const query = `
        WITH user_relevance AS (
          SELECT
            et.entity_type,
            et.entity_id,
            AVG(ui.priority * et.relevance_score / 100.0) as relevance_score
          FROM user_interests ui
          JOIN entity_tags et ON ui.tag_id = et.tag_id
          WHERE ui.user_id = $1 AND ui.is_active = true
            AND et.entity_type = ANY($2)
          GROUP BY et.entity_type, et.entity_id
          HAVING AVG(ui.priority * et.relevance_score / 100.0) > 1.5
        )
        SELECT
          ur.entity_type,
          ur.entity_id,
          ur.relevance_score,
          CURRENT_TIMESTAMP as fetched_at
        FROM user_relevance ur
        ORDER BY
          CASE
            WHEN $4 = 'relevance' THEN ur.relevance_score
            WHEN $4 = 'latest' THEN 0
            ELSE ur.relevance_score * 0.8 + RANDOM() * 0.2
          END DESC
        LIMIT $5 OFFSET $6
      `;

      const values = [userId, contentTypes, algorithm, algorithm, limit, offset];
      const result = await db.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('Error getting personalized feed:', error);
      throw error;
    }
  }

  async getRecommendedTags(userId: string, limit: number = 10) {
    try {
      // Simplified recommendation based on similar users and popular tags in user's categories
      const query = `
        WITH user_categories AS (
          SELECT DISTINCT t.category_id
          FROM user_interests ui
          JOIN interest_tags t ON ui.tag_id = t.id
          WHERE ui.user_id = $1 AND ui.is_active = true
        ),
        popular_in_categories AS (
          SELECT
            t.id,
            t.name,
            t.slug,
            t.description,
            COUNT(ui.user_id) as user_count
          FROM interest_tags t
          JOIN user_interests ui ON t.id = ui.tag_id
          WHERE t.category_id IN (SELECT category_id FROM user_categories)
            AND t.id NOT IN (
              SELECT tag_id FROM user_interests
              WHERE user_id = $1 AND is_active = true
            )
            AND t.is_active = true
          GROUP BY t.id, t.name, t.slug, t.description
          ORDER BY user_count DESC
          LIMIT $2
        )
        SELECT * FROM popular_in_categories
      `;

      const result = await db.query(query, [userId, limit]);
      return result.rows;
    } catch (error) {
      console.error('Error getting recommended tags:', error);
      throw error;
    }
  }

  // ===== ANALYTICS =====

  async getTagAnalytics() {
    try {
      const query = `
        SELECT
          t.id as tag_id,
          t.name,
          t.slug,
          COUNT(DISTINCT ui.user_id) as user_count,
          COUNT(DISTINCT et.entity_id) as entity_count,
          c.name as category_name
        FROM interest_tags t
        LEFT JOIN user_interests ui ON t.id = ui.tag_id AND ui.is_active = true
        LEFT JOIN entity_tags et ON t.id = et.tag_id
        LEFT JOIN interest_categories c ON t.category_id = c.id
        WHERE t.is_active = true
        GROUP BY t.id, t.name, t.slug, c.name
        ORDER BY user_count DESC, entity_count DESC
      `;

      const result = await db.query(query);
      return result.rows;
    } catch (error) {
      console.error('Error getting tag analytics:', error);
      throw error;
    }
  }

  async getUserAnalytics(userId: string) {
    try {
      const query = `
        SELECT
          COUNT(*) as total_interests,
          AVG(priority) as avg_priority,
          COUNT(DISTINCT t.category_id) as categories_interested
        FROM user_interests ui
        JOIN interest_tags t ON ui.tag_id = t.id
        WHERE ui.user_id = $1 AND ui.is_active = true
      `;

      const result = await db.query(query, [userId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error getting user analytics:', error);
      throw error;
    }
  }

  async getContentAnalytics() {
    try {
      const query = `
        SELECT
          et.entity_type,
          COUNT(*) as total_entities,
          AVG(et.relevance_score) as avg_relevance,
          COUNT(DISTINCT et.tag_id) as unique_tags
        FROM entity_tags et
        GROUP BY et.entity_type
        ORDER BY total_entities DESC
      `;

      const result = await db.query(query);
      return result.rows;
    } catch (error) {
      console.error('Error getting content analytics:', error);
      throw error;
    }
  }
}

export const interestService = new InterestService();