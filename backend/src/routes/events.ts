import { Router } from 'express';
import { authenticate, allowAnonymous, requirePermission } from '../middleware/auth.js';
import {
  validateCreateEvent,
  validateUpdateEvent,
  validatePaginationQuery,
  validateUuidParam,
  validateSlugParam
} from '../middleware/validation.js';
import { EventController } from '../controllers/events.js';

const router = Router();
const eventController = new EventController();

// Public event endpoints (no authentication required)
router.get('/public',
  validatePaginationQuery,
  eventController.getActiveEvents
);

router.get('/public/:slug',
  validateSlugParam,
  eventController.getEventBySlug
);

router.get('/public/:slug/stats',
  validateSlugParam,
  eventController.getEventStats
);

// Search events
router.get('/search',
  allowAnonymous,
  eventController.searchEvents
);

// Event management (authenticated)
router.post('/',
  authenticate(),
  requirePermission('event', 'create'),
  validateCreateEvent,
  eventController.createEvent
);

router.get('/',
  authenticate(),
  validatePaginationQuery,
  eventController.getEvents
);

router.get('/:id',
  authenticate(),
  requirePermission('event', 'read'),
  validateUuidParam,
  eventController.getEvent
);

router.put('/:id',
  authenticate(),
  requirePermission('event', 'update'),
  validateUuidParam,
  validateUpdateEvent,
  eventController.updateEvent
);

router.delete('/:id',
  authenticate(),
  requirePermission('event', 'delete'),
  validateUuidParam,
  eventController.deleteEvent
);

// Event status management
router.post('/:id/activate',
  authenticate(),
  requirePermission('event', 'update'),
  validateUuidParam,
  eventController.activateEvent
);

router.post('/:id/cancel',
  authenticate(),
  requirePermission('event', 'update'),
  validateUuidParam,
  eventController.cancelEvent
);

router.post('/:id/complete',
  authenticate(),
  requirePermission('event', 'update'),
  validateUuidParam,
  eventController.completeEvent
);

// Event attendees
router.get('/:id/attendees',
  authenticate(),
  requirePermission('event', 'read'),
  validateUuidParam,
  validatePaginationQuery,
  eventController.getEventAttendees
);

router.post('/:id/register',
  authenticate(),
  validateUuidParam,
  eventController.registerForEvent
);

router.delete('/:id/register',
  authenticate(),
  validateUuidParam,
  eventController.unregisterFromEvent
);

router.get('/:id/attendees/export',
  authenticate(),
  requirePermission('event', 'export'),
  validateUuidParam,
  eventController.exportAttendees
);

// Event analytics
router.get('/:id/analytics/overview',
  authenticate(),
  requirePermission('analytics', 'read'),
  validateUuidParam,
  eventController.getAnalyticsOverview
);

router.get('/:id/analytics/attendance',
  authenticate(),
  requirePermission('analytics', 'read'),
  validateUuidParam,
  eventController.getAttendanceAnalytics
);

router.get('/:id/analytics/engagement',
  authenticate(),
  requirePermission('analytics', 'read'),
  validateUuidParam,
  eventController.getEngagementAnalytics
);

// Event sharing and social features
router.get('/:id/share-stats',
  authenticate(),
  requirePermission('event', 'read'),
  validateUuidParam,
  eventController.getShareStats
);

router.post('/:id/share-links',
  authenticate(),
  requirePermission('event', 'read'),
  validateUuidParam,
  eventController.generateShareLinks
);

// Event updates and communications
router.get('/:id/updates',
  allowAnonymous,
  validateUuidParam,
  eventController.getEventUpdates
);

router.post('/:id/updates',
  authenticate(),
  requirePermission('event', 'update'),
  validateUuidParam,
  eventController.createEventUpdate
);

router.put('/:id/updates/:updateId',
  authenticate(),
  requirePermission('event', 'update'),
  validateUuidParam,
  eventController.updateEventUpdate
);

router.delete('/:id/updates/:updateId',
  authenticate(),
  requirePermission('event', 'update'),
  validateUuidParam,
  eventController.deleteEventUpdate
);

// Featured and trending events
router.get('/featured',
  eventController.getFeaturedEvents
);

router.get('/trending',
  eventController.getTrendingEvents
);

// Event categories and types
router.get('/categories',
  eventController.getEventCategories
);

router.get('/types',
  eventController.getEventTypes
);

// Event locations
router.get('/locations',
  authenticate(),
  requirePermission('location', 'read'),
  eventController.getLocations
);

router.post('/locations',
  authenticate(),
  requirePermission('location', 'create'),
  eventController.createLocation
);

export default router;