import { Router } from 'express';
import { authenticate, requireAdmin, requirePermission } from '../middleware/auth.js';
import {
  validateCreateOrganization,
  validateCreateUser,
  validateCreateFundraiser,
  validateCreateEvent,
  validatePaginationQuery,
  validateUuidParam
} from '../middleware/validation.js';

// Import controllers
import { OrganizationController } from '../controllers/organizations.js';
import { UserController } from '../controllers/users.js';
import { FundraiserController } from '../controllers/fundraisers.js';
import { EventController } from '../controllers/events.js';

const router = Router();

// Initialize controllers
const organizationController = new OrganizationController();
const userController = new UserController();
const fundraiserController = new FundraiserController();
const eventController = new EventController();

// Apply admin authentication to all routes
router.use(authenticate());
router.use(requireAdmin);

// Admin Organization Management
router.post('/organizations',
  validateCreateOrganization,
  organizationController.createOrganization
);

router.get('/organizations',
  validatePaginationQuery,
  organizationController.getOrganizations
);

router.get('/organizations/:id',
  validateUuidParam,
  organizationController.getOrganization
);

router.put('/organizations/:id',
  validateUuidParam,
  validateCreateOrganization,
  organizationController.updateOrganization
);

router.delete('/organizations/:id',
  validateUuidParam,
  organizationController.deleteOrganization
);

// Admin User Management
router.post('/users',
  validateCreateUser,
  userController.createUser
);

router.get('/users',
  validatePaginationQuery,
  userController.getUsers
);

router.get('/users/:id',
  validateUuidParam,
  userController.getUserById
);

router.put('/users/:id',
  validateUuidParam,
  validateCreateUser,
  userController.updateUser
);

router.delete('/users/:id',
  validateUuidParam,
  userController.deleteUser
);

// Admin Fundraiser Management
router.post('/fundraisers',
  validateCreateFundraiser,
  fundraiserController.createFundraiser
);

router.get('/fundraisers',
  validatePaginationQuery,
  fundraiserController.getFundraisers
);

router.get('/fundraisers/:id',
  validateUuidParam,
  fundraiserController.getFundraiser
);

router.put('/fundraisers/:id',
  validateUuidParam,
  validateCreateFundraiser,
  fundraiserController.updateFundraiser
);

router.delete('/fundraisers/:id',
  validateUuidParam,
  fundraiserController.deleteFundraiser
);

// Admin Event Management
router.post('/events',
  validateCreateEvent,
  eventController.createEvent
);

router.get('/events',
  validatePaginationQuery,
  eventController.getEvents
);

router.get('/events/:id',
  validateUuidParam,
  eventController.getEvent
);

router.put('/events/:id',
  validateUuidParam,
  validateCreateEvent,
  eventController.updateEvent
);

router.delete('/events/:id',
  validateUuidParam,
  eventController.deleteEvent
);

// Admin-specific endpoints for dropdown data
router.get('/event-categories',
  eventController.getEventCategories
);

router.get('/event-types',
  eventController.getEventTypes
);

// Admin analytics and reporting
router.get('/analytics/dashboard',
  async (req, res) => {
    try {
      // Combine data from all controllers for admin dashboard
      const organizationsCount = await organizationController.getOrganizationCount();
      const usersCount = await userController.getUserCount();
      const fundraisersCount = await fundraiserController.getFundraiserCount();
      const eventsCount = await eventController.getEventCount();

      res.json({
        success: true,
        data: {
          organizations: organizationsCount,
          users: usersCount,
          fundraisers: fundraisersCount,
          events: eventsCount
        }
      });
    } catch (error) {
      console.error('Error fetching admin dashboard:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch admin dashboard data'
      });
    }
  }
);

export default router;