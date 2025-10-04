/**
 * Permission Service
 * Handles permission checking and management for users and organizations
 */

import { supabaseAdmin } from '../config/supabase.js';

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  description: string;
  category: string;
  is_sensitive: boolean;
}

export interface UserPermissionResult {
  permission_name: string;
  resource: string;
  action: string;
  source: string;
  is_sensitive: boolean;
}

/**
 * Check if a user has a specific permission
 */
export async function checkUserPermission(
  userId: string,
  permissionName: string,
  organizationId?: string
): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin.rpc('check_user_permission', {
      p_user_id: userId,
      p_permission_name: permissionName,
      p_organization_id: organizationId || null,
    });

    if (error) {
      console.error('Error checking permission:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Error in checkUserPermission:', error);
    return false;
  }
}

/**
 * Get all permissions for a user (optionally scoped to an organization)
 */
export async function getUserPermissions(
  userId: string,
  organizationId?: string
): Promise<UserPermissionResult[]> {
  try {
    const { data, error } = await supabaseAdmin.rpc('get_user_permissions', {
      p_user_id: userId,
      p_organization_id: organizationId || null,
    });

    if (error) {
      console.error('Error getting user permissions:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getUserPermissions:', error);
    return [];
  }
}

/**
 * Get user's role in an organization
 */
export async function getUserOrgRole(
  userId: string,
  organizationId: string
): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      console.error('Error getting user org role:', error);
      return null;
    }

    return data?.role || null;
  } catch (error) {
    console.error('Error in getUserOrgRole:', error);
    return null;
  }
}

/**
 * Get user's platform role
 */
export async function getUserPlatformRole(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', userId)
      .eq('status', 'active')
      .single();

    if (error) {
      console.error('Error getting user platform role:', error);
      return null;
    }

    return data?.role || null;
  } catch (error) {
    console.error('Error in getUserPlatformRole:', error);
    return null;
  }
}

/**
 * Grant a specific permission to a user
 */
export async function grantUserPermission(
  userId: string,
  permissionName: string,
  grantedBy: string,
  organizationId?: string,
  reason?: string,
  expiresAt?: Date
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get permission ID
    const { data: permission, error: permError } = await supabaseAdmin
      .from('permissions')
      .select('id')
      .eq('name', permissionName)
      .single();

    if (permError || !permission) {
      return { success: false, error: 'Permission not found' };
    }

    // Insert user permission
    const { error: insertError } = await supabaseAdmin
      .from('user_permissions')
      .insert({
        user_id: userId,
        permission_id: permission.id,
        organization_id: organizationId || null,
        is_granted: true,
        reason: reason || null,
        expires_at: expiresAt || null,
        granted_by: grantedBy,
      });

    if (insertError) {
      console.error('Error granting permission:', insertError);
      return { success: false, error: insertError.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in grantUserPermission:', error);
    return { success: false, error: 'Internal error' };
  }
}

/**
 * Revoke a specific permission from a user
 */
export async function revokeUserPermission(
  userId: string,
  permissionName: string,
  revokedBy: string,
  organizationId?: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get permission ID
    const { data: permission, error: permError } = await supabaseAdmin
      .from('permissions')
      .select('id')
      .eq('name', permissionName)
      .single();

    if (permError || !permission) {
      return { success: false, error: 'Permission not found' };
    }

    // Update user permission to revoked
    const { error: updateError } = await supabaseAdmin
      .from('user_permissions')
      .update({
        is_granted: false,
        revoked_at: new Date().toISOString(),
        revoked_by: revokedBy,
        reason: reason || null,
      })
      .eq('user_id', userId)
      .eq('permission_id', permission.id)
      .eq('organization_id', organizationId || null);

    if (updateError) {
      console.error('Error revoking permission:', updateError);
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in revokeUserPermission:', error);
    return { success: false, error: 'Internal error' };
  }
}

/**
 * Check if user is super admin (has all permissions)
 */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  try {
    const role = await getUserPlatformRole(userId);
    return role === 'super_admin';
  } catch (error) {
    console.error('Error checking super admin status:', error);
    return false;
  }
}

/**
 * Check if user is organization owner (has all org permissions)
 */
export async function isOrganizationOwner(
  userId: string,
  organizationId: string
): Promise<boolean> {
  try {
    const role = await getUserOrgRole(userId, organizationId);
    return role === 'OWNER';
  } catch (error) {
    console.error('Error checking organization owner status:', error);
    return false;
  }
}

/**
 * Permission categories for grouping
 */
export const PERMISSION_CATEGORIES = {
  FINANCIAL: 'financial',
  CONTENT: 'content',
  MEMBER_MGMT: 'member_mgmt',
  VOLUNTEER_MGMT: 'volunteer_mgmt',
  COMPLIANCE: 'compliance',
  ANALYTICS: 'analytics',
} as const;

/**
 * Common permission names (typed constants)
 */
export const PERMISSIONS = {
  // Organization
  ORG_VIEW: 'organization.view',
  ORG_EDIT: 'organization.edit',
  ORG_SETTINGS: 'organization.settings',
  ORG_DELETE: 'organization.delete',
  ORG_TRANSFER: 'organization.transfer_ownership',

  // Members
  MEMBER_VIEW: 'member.view',
  MEMBER_INVITE: 'member.invite',
  MEMBER_REMOVE: 'member.remove',
  MEMBER_EDIT_ROLE: 'member.edit_role',
  MEMBER_MANAGE_PERMS: 'member.manage_permissions',

  // Fundraisers
  FUNDRAISER_VIEW: 'fundraiser.view',
  FUNDRAISER_CREATE: 'fundraiser.create',
  FUNDRAISER_EDIT: 'fundraiser.edit',
  FUNDRAISER_DELETE: 'fundraiser.delete',
  FUNDRAISER_PUBLISH: 'fundraiser.publish',

  // Donations
  DONATION_VIEW: 'donation.view',
  DONATION_VIEW_DETAILS: 'donation.view_details',
  DONATION_EXPORT: 'donation.export',
  DONATION_REFUND: 'donation.refund',

  // Disbursements
  DISBURSEMENT_VIEW: 'disbursement.view',
  DISBURSEMENT_CREATE: 'disbursement.create',
  DISBURSEMENT_APPROVE: 'disbursement.approve',

  // Events
  EVENT_VIEW: 'event.view',
  EVENT_CREATE: 'event.create',
  EVENT_EDIT: 'event.edit',
  EVENT_DELETE: 'event.delete',
  EVENT_MANAGE_REGISTRATIONS: 'event.manage_registrations',

  // Volunteers
  VOLUNTEER_VIEW: 'volunteer.view',
  VOLUNTEER_APPROVE: 'volunteer.approve',
  VOLUNTEER_HOURS_APPROVE: 'volunteer.hours_approve',

  // Compliance
  COMPLIANCE_VIEW_REPORTS: 'compliance.view_reports',
  COMPLIANCE_FILE_REPORTS: 'compliance.file_reports',

  // Analytics
  ANALYTICS_VIEW: 'analytics.view',
} as const;
