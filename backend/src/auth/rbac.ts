interface Permission {
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

interface Role {
  name: string;
  permissions: Permission[];
  inherits?: string[];
  description: string;
}

interface User {
  id: string;
  roles: string[];
  organizations: string[];
  customPermissions?: Permission[];
}

class RBACService {
  private roles: Map<string, Role> = new Map();

  constructor() {
    this.initializeDefaultRoles();
  }

  private initializeDefaultRoles(): void {
    // Super Admin - full system access
    this.addRole({
      name: 'super_admin',
      description: 'Full system administrator with unrestricted access',
      permissions: [
        { resource: '*', action: '*' }
      ]
    });

    // Organization Admin - manage their organization and fundraisers
    this.addRole({
      name: 'org_admin',
      description: 'Organization administrator with full control over their organization',
      permissions: [
        // Organization management
        { resource: 'organization', action: 'read', conditions: { own: true } },
        { resource: 'organization', action: 'update', conditions: { own: true } },

        // Fundraiser management
        { resource: 'fundraiser', action: '*', conditions: { own_org: true } },

        // Donation viewing
        { resource: 'donation', action: 'read', conditions: { own_org: true } },
        { resource: 'donation', action: 'export', conditions: { own_org: true } },

        // Compliance and reporting
        { resource: 'compliance_report', action: '*', conditions: { own_org: true } },
        { resource: 'disbursement', action: 'read', conditions: { own_org: true } },
        { resource: 'disbursement', action: 'request', conditions: { own_org: true } },

        // User management within organization
        { resource: 'organization_user', action: '*', conditions: { own_org: true } },

        // Analytics for their organization
        { resource: 'analytics', action: 'read', conditions: { own_org: true } }
      ]
    });

    // Organization Treasurer - financial operations
    this.addRole({
      name: 'org_treasurer',
      description: 'Organization treasurer with financial oversight responsibilities',
      permissions: [
        // Read-only organization access
        { resource: 'organization', action: 'read', conditions: { own: true } },

        // Fundraiser viewing and basic management
        { resource: 'fundraiser', action: 'read', conditions: { own_org: true } },
        { resource: 'fundraiser', action: 'update', conditions: { own_org: true } },

        // Full donation access
        { resource: 'donation', action: 'read', conditions: { own_org: true } },
        { resource: 'donation', action: 'export', conditions: { own_org: true } },

        // Compliance and reporting (key responsibility)
        { resource: 'compliance_report', action: '*', conditions: { own_org: true } },

        // Disbursement management
        { resource: 'disbursement', action: '*', conditions: { own_org: true } },

        // Financial analytics
        { resource: 'analytics', action: 'read', conditions: { own_org: true, type: 'financial' } }
      ]
    });

    // Organization Staff - limited operations
    this.addRole({
      name: 'org_staff',
      description: 'Organization staff with limited operational access',
      permissions: [
        // Read-only organization access
        { resource: 'organization', action: 'read', conditions: { own: true } },

        // Fundraiser management
        { resource: 'fundraiser', action: 'read', conditions: { own_org: true } },
        { resource: 'fundraiser', action: 'create', conditions: { own_org: true } },
        { resource: 'fundraiser', action: 'update', conditions: { own_org: true } },

        // Limited donation viewing
        { resource: 'donation', action: 'read', conditions: { own_org: true, summary_only: true } },

        // Basic analytics
        { resource: 'analytics', action: 'read', conditions: { own_org: true, type: 'basic' } }
      ]
    });

    // Organization Viewer - read-only access
    this.addRole({
      name: 'org_viewer',
      description: 'Read-only access to organization data',
      permissions: [
        { resource: 'organization', action: 'read', conditions: { own: true } },
        { resource: 'fundraiser', action: 'read', conditions: { own_org: true } },
        { resource: 'donation', action: 'read', conditions: { own_org: true, summary_only: true } },
        { resource: 'analytics', action: 'read', conditions: { own_org: true, type: 'basic' } }
      ]
    });

    // Donor - basic user permissions
    this.addRole({
      name: 'donor',
      description: 'Individual donor with personal account management',
      permissions: [
        // Self-management
        { resource: 'user', action: 'read', conditions: { own: true } },
        { resource: 'user', action: 'update', conditions: { own: true } },

        // Donation capabilities
        { resource: 'donation', action: 'create' },
        { resource: 'donation', action: 'read', conditions: { own: true } },
        { resource: 'donation', action: 'cancel', conditions: { own: true, status: 'pending' } },

        // Public read access
        { resource: 'fundraiser', action: 'read', conditions: { status: 'active' } },
        { resource: 'organization', action: 'read', conditions: { status: 'active', verified: true } },

        // Personal analytics
        { resource: 'analytics', action: 'read', conditions: { own: true, type: 'personal' } }
      ]
    });

    // Compliance Officer - specialized compliance access
    this.addRole({
      name: 'compliance_officer',
      description: 'Compliance specialist with cross-organization audit access',
      permissions: [
        // Cross-organization compliance access
        { resource: 'compliance_report', action: 'read' },
        { resource: 'compliance_report', action: 'audit' },

        // Donation review for compliance
        { resource: 'donation', action: 'read', conditions: { purpose: 'compliance' } },
        { resource: 'donation', action: 'flag', conditions: { purpose: 'compliance' } },

        // User verification for KYC
        { resource: 'user', action: 'read', conditions: { purpose: 'kyc' } },
        { resource: 'user', action: 'verify', conditions: { purpose: 'kyc' } },

        // Organization verification
        { resource: 'organization', action: 'read', conditions: { purpose: 'verification' } },
        { resource: 'organization', action: 'verify' },

        // Compliance analytics
        { resource: 'analytics', action: 'read', conditions: { type: 'compliance' } }
      ]
    });
  }

  addRole(role: Role): void {
    this.roles.set(role.name, role);
  }

  getRole(roleName: string): Role | undefined {
    return this.roles.get(roleName);
  }

  getAllRoles(): Role[] {
    return Array.from(this.roles.values());
  }

  async hasPermission(
    user: User,
    resource: string,
    action: string,
    context?: Record<string, any>
  ): Promise<boolean> {
    // Check custom permissions first (highest priority)
    if (user.customPermissions) {
      const hasCustomPermission = this.checkPermissions(
        user.customPermissions,
        resource,
        action,
        context,
        user
      );
      if (hasCustomPermission) return true;
    }

    // Check role-based permissions
    for (const roleName of user.roles) {
      const role = this.roles.get(roleName);
      if (!role) continue;

      const allPermissions = await this.expandRolePermissions(role);
      const hasPermission = this.checkPermissions(
        allPermissions,
        resource,
        action,
        context,
        user
      );

      if (hasPermission) return true;
    }

    return false;
  }

  async getUserPermissions(user: User, context?: Record<string, any>): Promise<Permission[]> {
    const allPermissions: Permission[] = [];

    // Add custom permissions
    if (user.customPermissions) {
      allPermissions.push(...user.customPermissions);
    }

    // Add role-based permissions
    for (const roleName of user.roles) {
      const role = this.roles.get(roleName);
      if (role) {
        const rolePermissions = await this.expandRolePermissions(role);
        allPermissions.push(...rolePermissions);
      }
    }

    return allPermissions;
  }

  private async expandRolePermissions(role: Role): Promise<Permission[]> {
    let permissions = [...role.permissions];

    // Handle role inheritance
    if (role.inherits) {
      for (const inheritedRoleName of role.inherits) {
        const inheritedRole = this.roles.get(inheritedRoleName);
        if (inheritedRole) {
          const inheritedPermissions = await this.expandRolePermissions(inheritedRole);
          permissions = [...permissions, ...inheritedPermissions];
        }
      }
    }

    return permissions;
  }

  private checkPermissions(
    permissions: Permission[],
    resource: string,
    action: string,
    context?: Record<string, any>,
    user?: User
  ): boolean {
    return permissions.some(permission => {
      // Check resource match (wildcard or exact match)
      if (permission.resource !== '*' && permission.resource !== resource) {
        return false;
      }

      // Check action match (wildcard or exact match)
      if (permission.action !== '*' && permission.action !== action) {
        return false;
      }

      // Check conditions if they exist
      if (permission.conditions && context && user) {
        return this.evaluateConditions(permission.conditions, context, user);
      }

      return true;
    });
  }

  private evaluateConditions(
    conditions: Record<string, any>,
    context: Record<string, any>,
    user: User
  ): boolean {
    for (const [key, value] of Object.entries(conditions)) {
      switch (key) {
        case 'own':
          if (value && context.userId !== user.id) return false;
          break;

        case 'own_org':
          if (value) {
            const orgId = context.organizationId;
            if (!orgId || !user.organizations.includes(orgId)) {
              return false;
            }
          }
          break;

        case 'to_own_org':
          if (value) {
            const targetOrgId = context.targetOrganizationId;
            if (!targetOrgId || !user.organizations.includes(targetOrgId)) {
              return false;
            }
          }
          break;

        case 'status':
          if (context.status !== value) return false;
          break;

        case 'verified':
          if (context.verified !== value) return false;
          break;

        case 'summary_only':
          if (value && context.requestType === 'detailed') return false;
          break;

        case 'type':
          if (context.type !== value) return false;
          break;

        case 'purpose':
          if (context.purpose !== value) return false;
          break;

        default:
          // Generic condition matching
          if (context[key] !== value) return false;
      }
    }

    return true;
  }

  // Utility methods for role management
  canUserManageRole(managerRoles: string[], targetRole: string): boolean {
    // Super admin can manage any role
    if (managerRoles.includes('super_admin')) return true;

    // Organization admins can manage org staff and viewers
    if (managerRoles.includes('org_admin')) {
      return ['org_staff', 'org_viewer', 'donor'].includes(targetRole);
    }

    return false;
  }

  getRoleHierarchy(): Record<string, number> {
    return {
      'super_admin': 100,
      'compliance_officer': 80,
      'org_admin': 60,
      'org_treasurer': 50,
      'org_staff': 30,
      'org_viewer': 20,
      'donor': 10
    };
  }

  isRoleHigher(role1: string, role2: string): boolean {
    const hierarchy = this.getRoleHierarchy();
    return (hierarchy[role1] || 0) > (hierarchy[role2] || 0);
  }
}

export const rbacService = new RBACService();