import { Router, Request, Response } from 'express';
import { interestController } from '../controllers/interestController';
import { auth } from '../middleware/auth';
import { adminAuth } from '../middleware/adminAuth.js';

const router = Router();

// ===== INTEREST CATEGORIES ROUTES =====

/**
 * GET /interests/categories
 * Get all interest categories with optional filtering
 * Public endpoint
 */
router.get('/categories', interestController.getCategories);

/**
 * GET /interests/categories/:idOrSlug
 * Get single category by ID or slug
 * Public endpoint
 */
router.get('/categories/:idOrSlug', interestController.getCategory);

/**
 * POST /interests/categories
 * Create new interest category (admin only)
 */
router.post('/categories', adminAuth, interestController.createCategory);

/**
 * PUT /interests/categories/:id
 * Update interest category (admin only)
 */
router.put('/categories/:id', adminAuth, interestController.updateCategory);

/**
 * DELETE /interests/categories/:id
 * Delete interest category (admin only)
 */
router.delete('/categories/:id', adminAuth, interestController.deleteCategory);

// ===== INTEREST TAGS ROUTES =====

/**
 * GET /interests/tags
 * Get all interest tags with optional filtering
 * Public endpoint
 */
router.get('/tags', interestController.getTags);

/**
 * GET /interests/tags/:idOrSlug
 * Get single tag by ID or slug
 * Public endpoint
 */
router.get('/tags/:idOrSlug', interestController.getTag);

/**
 * GET /interests/tags/search
 * Search tags by name/description
 * Public endpoint
 */
router.get('/tags/search', interestController.searchTags);

/**
 * POST /interests/tags
 * Create new interest tag (admin only)
 */
router.post('/tags', adminAuth, interestController.createTag);

/**
 * PUT /interests/tags/:id
 * Update interest tag (admin only)
 */
router.put('/tags/:id', adminAuth, interestController.updateTag);

/**
 * DELETE /interests/tags/:id
 * Delete interest tag (admin only)
 */
router.delete('/tags/:id', adminAuth, interestController.deleteTag);

// ===== USER INTERESTS ROUTES =====

/**
 * GET /interests/user/interests
 * Get current user's interests
 * Requires authentication
 */
router.get('/user/interests', auth, interestController.getUserInterests);

/**
 * PUT /interests/user/interests
 * Update user's interest selection
 * Requires authentication
 */
router.put('/user/interests', auth, interestController.updateUserInterests);

/**
 * POST /interests/user/interests
 * Add single interest for user
 * Requires authentication
 */
router.post('/user/interests', auth, interestController.addUserInterest);

/**
 * DELETE /interests/user/interests/:tagId
 * Remove user interest
 * Requires authentication
 */
router.delete('/user/interests/:tagId', auth, interestController.removeUserInterest);

/**
 * GET /interests/users/:userId/interests
 * Get specific user's interests (admin only)
 */
router.get('/users/:userId/interests', adminAuth, interestController.getUserInterests);

// ===== ENTITY TAGGING ROUTES =====

/**
 * GET /interests/entities/:entityType/:entityId/tags
 * Get tags for a specific entity
 * Public endpoint
 */
router.get('/entities/:entityType/:entityId/tags', interestController.getEntityTags);

/**
 * POST /interests/entities/:entityType/:entityId/tags
 * Tag an entity with interest tags
 * Requires authentication
 */
router.post('/entities/:entityType/:entityId/tags', auth, interestController.tagEntity);

/**
 * DELETE /interests/entities/:entityType/:entityId/tags/:tagId
 * Remove tag from entity
 * Requires authentication
 */
router.delete('/entities/:entityType/:entityId/tags/:tagId', auth, interestController.removeEntityTag);

/**
 * GET /interests/tags/:tagId/entities
 * Get entities by tag (for personalized feeds)
 * Requires authentication
 */
router.get('/tags/:tagId/entities', auth, interestController.getEntitiesByTag);

// ===== USER FEED PREFERENCES ROUTES =====

/**
 * GET /interests/user/feed-preferences
 * Get user's feed preferences
 * Requires authentication
 */
router.get('/user/feed-preferences', auth, interestController.getFeedPreferences);

/**
 * PUT /interests/user/feed-preferences
 * Update user's feed preferences
 * Requires authentication
 */
router.put('/user/feed-preferences', auth, interestController.updateFeedPreferences);

/**
 * GET /interests/users/:userId/feed-preferences
 * Get specific user's feed preferences (admin only)
 */
router.get('/users/:userId/feed-preferences', adminAuth, interestController.getFeedPreferences);

// ===== PERSONALIZED CONTENT ROUTES =====

/**
 * GET /interests/user/feed
 * Get personalized content feed for user
 * Requires authentication
 */
router.get('/user/feed', auth, interestController.getPersonalizedFeed);

/**
 * GET /interests/user/recommendations
 * Get recommended tags for user based on behavior
 * Requires authentication
 */
router.get('/user/recommendations', auth, interestController.getRecommendedTags);

// ===== ANALYTICS ROUTES =====

/**
 * GET /interests/analytics/tags
 * Get tag popularity metrics (admin only)
 */
router.get('/analytics/tags', adminAuth, interestController.getTagAnalytics);

/**
 * GET /interests/analytics/users/:userId
 * Get user interest analytics (admin only)
 */
router.get('/analytics/users/:userId', adminAuth, interestController.getUserAnalytics);

/**
 * GET /interests/analytics/content
 * Get content performance by interest tags (admin only)
 */
router.get('/analytics/content', adminAuth, interestController.getContentAnalytics);

export default router;