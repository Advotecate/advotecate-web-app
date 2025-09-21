import { Router } from 'express';
import { validateWebhookSignature, validateAPIKey } from '../middleware/security.js';
import { config } from '../config/index.js';
import { WebhookController } from '../controllers/webhooks.js';

const router = Router();
const webhookController = new WebhookController();

// FluidPay webhooks (with signature validation)
router.post('/fluidpay',
  validateWebhookSignature(config.fluidpay.webhookSecret),
  webhookController.handleFluidPayWebhook
);

// Internal system webhooks (with API key validation)
router.post('/system/user-verification',
  validateAPIKey,
  webhookController.handleUserVerificationWebhook
);

router.post('/system/organization-verification',
  validateAPIKey,
  webhookController.handleOrganizationVerificationWebhook
);

router.post('/system/compliance-alert',
  validateAPIKey,
  webhookController.handleComplianceAlertWebhook
);

// Supabase webhooks (if using Supabase real-time features)
router.post('/supabase/database-changes',
  validateAPIKey,
  webhookController.handleSupabaseWebhook
);

// Third-party service webhooks
router.post('/email/sendgrid',
  validateWebhookSignature(process.env.SENDGRID_WEBHOOK_SECRET || ''),
  webhookController.handleEmailWebhook
);

router.post('/sms/twilio',
  validateWebhookSignature(process.env.TWILIO_WEBHOOK_SECRET || ''),
  webhookController.handleSMSWebhook
);

// Webhook management endpoints (admin only)
router.get('/status',
  validateAPIKey,
  webhookController.getWebhookStatus
);

router.get('/logs',
  validateAPIKey,
  webhookController.getWebhookLogs
);

router.post('/test/:service',
  validateAPIKey,
  webhookController.testWebhook
);

export default router;