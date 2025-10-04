import { Request, Response } from 'express';
import { Pool } from 'pg';
import { interestService } from '../services/interestService';
import { personalizationService } from '../services/personalizationService';

// Database connection (assuming it's available globally)
declare global {
  var db: Pool;
}

class InterestController {

  // ===== INTEREST CATEGORIES =====

  async getCategories(req: Request, res: Response) {
    try {
      const { isActive, sortBy } = req.query;

      const categories = await interestService.getCategories({
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        sortBy: sortBy as 'name' | 'sortOrder' | undefined
      });

      res.json({ categories });
    } catch (error) {
      console.error('Error getting categories:', error);
      res.status(500).json({
        error: 'Failed to get categories',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getCategory(req: Request, res: Response) {
    try {
      const { idOrSlug } = req.params;

      const category = await interestService.getCategory(idOrSlug);

      if (!category) {
        return res.status(404).json({ error: 'Category not found' });
      }

      res.json({ category });
    } catch (error) {
      console.error('Error getting category:', error);
      res.status(500).json({
        error: 'Failed to get category',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async createCategory(req: Request, res: Response) {
    try {
      const categoryData = req.body;

      // Validate required fields
      const required = ['name', 'slug', 'description', 'iconName', 'colorHex', 'colorBg'];
      for (const field of required) {
        if (!categoryData[field]) {
          return res.status(400).json({ error: `Missing required field: ${field}` });
        }
      }

      const category = await interestService.createCategory(categoryData);

      res.status(201).json({ category });
    } catch (error) {
      console.error('Error creating category:', error);

      if (error instanceof Error && error.message.includes('duplicate key')) {
        return res.status(409).json({ error: 'Category with this name or slug already exists' });
      }

      res.status(500).json({
        error: 'Failed to create category',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async updateCategory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const category = await interestService.updateCategory(id, updates);

      if (!category) {
        return res.status(404).json({ error: 'Category not found' });
      }

      res.json({ category });
    } catch (error) {
      console.error('Error updating category:', error);
      res.status(500).json({
        error: 'Failed to update category',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async deleteCategory(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const success = await interestService.deleteCategory(id);

      if (!success) {
        return res.status(404).json({ error: 'Category not found' });
      }

      res.json({ message: 'Category deleted successfully' });
    } catch (error) {
      console.error('Error deleting category:', error);
      res.status(500).json({
        error: 'Failed to delete category',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // ===== INTEREST TAGS =====

  async getTags(req: Request, res: Response) {
    try {
      const { categoryId, isActive, sortBy, includeCategory } = req.query;

      const tags = await interestService.getTags({
        categoryId: categoryId as string,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        sortBy: sortBy as 'name' | 'sortOrder' | undefined,
        includeCategory: includeCategory === 'true'
      });

      res.json({ tags });
    } catch (error) {
      console.error('Error getting tags:', error);
      res.status(500).json({
        error: 'Failed to get tags',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getTag(req: Request, res: Response) {
    try {
      const { idOrSlug } = req.params;

      const tag = await interestService.getTag(idOrSlug);

      if (!tag) {
        return res.status(404).json({ error: 'Tag not found' });
      }

      res.json({ tag });
    } catch (error) {
      console.error('Error getting tag:', error);
      res.status(500).json({
        error: 'Failed to get tag',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async searchTags(req: Request, res: Response) {
    try {
      const { q: query } = req.query;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Search query is required' });
      }

      const tags = await interestService.searchTags(query);

      res.json({ tags, query });
    } catch (error) {
      console.error('Error searching tags:', error);
      res.status(500).json({
        error: 'Failed to search tags',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async createTag(req: Request, res: Response) {
    try {
      const tagData = req.body;

      // Validate required fields
      const required = ['categoryId', 'name', 'slug', 'description'];
      for (const field of required) {
        if (!tagData[field]) {
          return res.status(400).json({ error: `Missing required field: ${field}` });
        }
      }

      const tag = await interestService.createTag(tagData);

      res.status(201).json({ tag });
    } catch (error) {
      console.error('Error creating tag:', error);

      if (error instanceof Error && error.message.includes('duplicate key')) {
        return res.status(409).json({ error: 'Tag with this slug already exists' });
      }

      res.status(500).json({
        error: 'Failed to create tag',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async updateTag(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const tag = await interestService.updateTag(id, updates);

      if (!tag) {
        return res.status(404).json({ error: 'Tag not found' });
      }

      res.json({ tag });
    } catch (error) {
      console.error('Error updating tag:', error);
      res.status(500).json({
        error: 'Failed to update tag',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async deleteTag(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const success = await interestService.deleteTag(id);

      if (!success) {
        return res.status(404).json({ error: 'Tag not found' });
      }

      res.json({ message: 'Tag deleted successfully' });
    } catch (error) {
      console.error('Error deleting tag:', error);
      res.status(500).json({
        error: 'Failed to delete tag',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // ===== USER INTERESTS =====

  async getUserInterests(req: Request, res: Response) {
    try {
      // Get user ID from params (admin route) or auth middleware (user route)
      const userId = req.params.userId || (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      const interests = await interestService.getUserInterests(userId);

      res.json({ interests });
    } catch (error) {
      console.error('Error getting user interests:', error);
      res.status(500).json({
        error: 'Failed to get user interests',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async updateUserInterests(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const { interests } = req.body;

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      if (!Array.isArray(interests)) {
        return res.status(400).json({ error: 'Interests must be an array' });
      }

      // Validate interests format
      for (const interest of interests) {
        if (!interest.tagId || typeof interest.priority !== 'number') {
          return res.status(400).json({
            error: 'Each interest must have tagId and priority fields'
          });
        }

        if (interest.priority < 1 || interest.priority > 5) {
          return res.status(400).json({
            error: 'Interest priority must be between 1 and 5'
          });
        }
      }

      const updatedInterests = await interestService.updateUserInterests(userId, interests);

      res.json({ interests: updatedInterests });
    } catch (error) {
      console.error('Error updating user interests:', error);
      res.status(500).json({
        error: 'Failed to update user interests',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async addUserInterest(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const { tagId, priority = 3 } = req.body;

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      if (!tagId) {
        return res.status(400).json({ error: 'Tag ID is required' });
      }

      if (priority < 1 || priority > 5) {
        return res.status(400).json({ error: 'Priority must be between 1 and 5' });
      }

      const interest = await interestService.addUserInterest(userId, tagId, priority);

      res.status(201).json({ interest });
    } catch (error) {
      console.error('Error adding user interest:', error);

      if (error instanceof Error && error.message.includes('duplicate key')) {
        return res.status(409).json({ error: 'User already has this interest' });
      }

      res.status(500).json({
        error: 'Failed to add user interest',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async removeUserInterest(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const { tagId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      const success = await interestService.removeUserInterest(userId, tagId);

      if (!success) {
        return res.status(404).json({ error: 'User interest not found' });
      }

      res.json({ message: 'User interest removed successfully' });
    } catch (error) {
      console.error('Error removing user interest:', error);
      res.status(500).json({
        error: 'Failed to remove user interest',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // ===== ENTITY TAGGING =====

  async getEntityTags(req: Request, res: Response) {
    try {
      const { entityType, entityId } = req.params;

      // Validate entity type
      const validEntityTypes = ['organization', 'fundraiser', 'event', 'user', 'donation'];
      if (!validEntityTypes.includes(entityType)) {
        return res.status(400).json({ error: 'Invalid entity type' });
      }

      const tags = await interestService.getEntityTags(entityType, entityId);

      res.json({ tags });
    } catch (error) {
      console.error('Error getting entity tags:', error);
      res.status(500).json({
        error: 'Failed to get entity tags',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async tagEntity(req: Request, res: Response) {
    try {
      const { entityType, entityId } = req.params;
      const { tags } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      // Validate entity type
      const validEntityTypes = ['organization', 'fundraiser', 'event', 'user', 'donation'];
      if (!validEntityTypes.includes(entityType)) {
        return res.status(400).json({ error: 'Invalid entity type' });
      }

      if (!Array.isArray(tags)) {
        return res.status(400).json({ error: 'Tags must be an array' });
      }

      // Validate tags format
      for (const tag of tags) {
        if (!tag.tagId || typeof tag.relevanceScore !== 'number') {
          return res.status(400).json({
            error: 'Each tag must have tagId and relevanceScore fields'
          });
        }

        if (tag.relevanceScore < 1 || tag.relevanceScore > 100) {
          return res.status(400).json({
            error: 'Relevance score must be between 1 and 100'
          });
        }
      }

      const entityTags = await interestService.tagEntity(
        entityType,
        entityId,
        tags,
        userId
      );

      res.status(201).json({ tags: entityTags });
    } catch (error) {
      console.error('Error tagging entity:', error);
      res.status(500).json({
        error: 'Failed to tag entity',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async removeEntityTag(req: Request, res: Response) {
    try {
      const { entityType, entityId, tagId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      // Validate entity type
      const validEntityTypes = ['organization', 'fundraiser', 'event', 'user', 'donation'];
      if (!validEntityTypes.includes(entityType)) {
        return res.status(400).json({ error: 'Invalid entity type' });
      }

      const success = await interestService.removeEntityTag(entityType, entityId, tagId);

      if (!success) {
        return res.status(404).json({ error: 'Entity tag not found' });
      }

      res.json({ message: 'Entity tag removed successfully' });
    } catch (error) {
      console.error('Error removing entity tag:', error);
      res.status(500).json({
        error: 'Failed to remove entity tag',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getEntitiesByTag(req: Request, res: Response) {
    try {
      const { tagId } = req.params;
      const { entityType } = req.query;

      const entities = await interestService.getEntitiesByTag(
        tagId,
        entityType as string
      );

      res.json({ entities });
    } catch (error) {
      console.error('Error getting entities by tag:', error);
      res.status(500).json({
        error: 'Failed to get entities by tag',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // ===== USER FEED PREFERENCES =====

  async getFeedPreferences(req: Request, res: Response) {
    try {
      // Get user ID from params (admin route) or auth middleware (user route)
      const userId = req.params.userId || (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      const preferences = await interestService.getFeedPreferences(userId);

      res.json({ preferences });
    } catch (error) {
      console.error('Error getting feed preferences:', error);
      res.status(500).json({
        error: 'Failed to get feed preferences',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async updateFeedPreferences(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const preferences = req.body;

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      await personalizationService.updateFeedPreferences(userId, preferences);

      res.json({ message: 'Feed preferences updated successfully' });
    } catch (error) {
      console.error('Error updating feed preferences:', error);
      res.status(500).json({
        error: 'Failed to update feed preferences',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // ===== PERSONALIZED CONTENT =====

  async getPersonalizedFeed(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      const {
        page,
        limit,
        entityTypes,
        minRelevanceScore,
        algorithm
      } = req.query;

      const feedResult = await personalizationService.getPersonalizedFeed({
        userId,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
        entityTypes: entityTypes ? (entityTypes as string).split(',') : undefined,
        minRelevanceScore: minRelevanceScore ? parseFloat(minRelevanceScore as string) : 2.0,
        algorithm: algorithm as 'latest' | 'relevance' | 'popularity' | 'mixed' || 'mixed'
      });

      res.json(feedResult);
    } catch (error) {
      console.error('Error getting personalized feed:', error);
      res.status(500).json({
        error: 'Failed to get personalized feed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getRecommendedTags(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      const { limit, excludeSelected, basedOnBehavior } = req.query;

      const recommendations = await personalizationService.getRecommendedTags({
        userId,
        limit: limit ? parseInt(limit as string) : 10,
        excludeSelected: excludeSelected === 'true',
        basedOnBehavior: basedOnBehavior !== 'false'
      });

      res.json(recommendations);
    } catch (error) {
      console.error('Error getting recommended tags:', error);
      res.status(500).json({
        error: 'Failed to get recommended tags',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // ===== ANALYTICS =====

  async getTagAnalytics(req: Request, res: Response) {
    try {
      const analytics = await interestService.getTagAnalytics();

      res.json({ analytics });
    } catch (error) {
      console.error('Error getting tag analytics:', error);
      res.status(500).json({
        error: 'Failed to get tag analytics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getUserAnalytics(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      const analytics = await personalizationService.getUserAnalytics(userId);

      res.json(analytics);
    } catch (error) {
      console.error('Error getting user analytics:', error);
      res.status(500).json({
        error: 'Failed to get user analytics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getContentAnalytics(req: Request, res: Response) {
    try {
      const analytics = await interestService.getContentAnalytics();

      res.json({ analytics });
    } catch (error) {
      console.error('Error getting content analytics:', error);
      res.status(500).json({
        error: 'Failed to get content analytics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export const interestController = new InterestController();