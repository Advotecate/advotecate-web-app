# API Documentation & OpenAPI Specifications

## Overview

Comprehensive REST API documentation for the political donation platform, including authentication, donation processing, compliance checking, and administrative operations.

## Base Configuration

```yaml
openapi: 3.0.3
info:
  title: Political Donation Platform API
  description: |
    REST API for processing political donations with compliance checking and reporting.

    ## Authentication
    All protected endpoints require a valid JWT token in the Authorization header:
    ```
    Authorization: Bearer <jwt_token>
    ```

    ## Rate Limits
    - Unauthenticated: 100 requests/hour
    - Authenticated: 1000 requests/hour
    - Admin: 5000 requests/hour

    ## Error Handling
    All errors follow RFC 7807 Problem Details format.

  version: 1.0.0
  contact:
    name: API Support
    email: api-support@advotecate.com
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT

servers:
  - url: https://api.donation-platform.com/v1
    description: Production server
  - url: https://staging-api.donation-platform.com/v1
    description: Staging server
  - url: http://localhost:8080/v1
    description: Development server

security:
  - BearerAuth: []

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    Error:
      type: object
      required:
        - type
        - title
        - status
        - detail
      properties:
        type:
          type: string
          format: uri
          example: "https://api.donation-platform.com/errors/validation-error"
        title:
          type: string
          example: "Validation Error"
        status:
          type: integer
          example: 400
        detail:
          type: string
          example: "The provided donation amount exceeds contribution limits"
        instance:
          type: string
          format: uri
          example: "/donations/12345"
        errors:
          type: array
          items:
            type: object
            properties:
              field:
                type: string
              message:
                type: string
```

## Authentication Endpoints

### POST /auth/login

```yaml
paths:
  /auth/login:
    post:
      tags:
        - Authentication
      summary: User login
      description: Authenticate user with email and password
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - email
                - password
              properties:
                email:
                  type: string
                  format: email
                  example: "john.doe@example.com"
                password:
                  type: string
                  minLength: 8
                  example: "securePassword123"
      responses:
        '200':
          description: Login successful
          content:
            application/json:
              schema:
                type: object
                properties:
                  access_token:
                    type: string
                    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  refresh_token:
                    type: string
                    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  expires_in:
                    type: integer
                    example: 3600
                  user:
                    $ref: '#/components/schemas/User'
        '400':
          description: Invalid credentials
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '429':
          description: Too many login attempts
```

### POST /auth/register

```yaml
  /auth/register:
    post:
      tags:
        - Authentication
      summary: User registration
      description: Register a new user account
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - email
                - password
                - firstName
                - lastName
                - streetAddress
                - city
                - state
                - postalCode
              properties:
                email:
                  type: string
                  format: email
                password:
                  type: string
                  minLength: 8
                  pattern: "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]"
                firstName:
                  type: string
                  maxLength: 100
                lastName:
                  type: string
                  maxLength: 100
                middleName:
                  type: string
                  maxLength: 100
                dateOfBirth:
                  type: string
                  format: date
                phone:
                  type: string
                  pattern: "^\\+?[1-9]\\d{1,14}$"
                streetAddress:
                  type: string
                  maxLength: 500
                city:
                  type: string
                  maxLength: 100
                state:
                  type: string
                  pattern: "^[A-Z]{2}$"
                postalCode:
                  type: string
                  pattern: "^\\d{5}(-\\d{4})?$"
                country:
                  type: string
                  pattern: "^[A-Z]{2}$"
                  default: "US"
                employer:
                  type: string
                  maxLength: 255
                occupation:
                  type: string
                  maxLength: 255
      responses:
        '201':
          description: User created successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  user:
                    $ref: '#/components/schemas/User'
                  message:
                    type: string
                    example: "Account created successfully. Please verify your email."
```

## User Management Endpoints

### GET /users/profile

```yaml
  /users/profile:
    get:
      tags:
        - User Management
      summary: Get current user profile
      description: Retrieve the authenticated user's profile information
      responses:
        '200':
          description: User profile retrieved
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '401':
          description: Unauthorized
```

### PUT /users/profile

```yaml
    put:
      tags:
        - User Management
      summary: Update user profile
      description: Update the authenticated user's profile information
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                firstName:
                  type: string
                  maxLength: 100
                lastName:
                  type: string
                  maxLength: 100
                phone:
                  type: string
                streetAddress:
                  type: string
                city:
                  type: string
                state:
                  type: string
                postalCode:
                  type: string
                employer:
                  type: string
                occupation:
                  type: string
      responses:
        '200':
          description: Profile updated successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
```

## Donation Processing Endpoints

### POST /donations

```yaml
  /donations:
    post:
      tags:
        - Donations
      summary: Process a donation
      description: |
        Process a new donation with compliance checking and payment processing.

        ## Compliance Validation
        - Automatically checks contribution limits
        - Validates donor eligibility
        - Ensures required disclosure information

        ## Payment Processing
        - Integrates with FluidPay for secure processing
        - Supports one-time and recurring donations
        - Handles payment method tokenization

      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - fundraiserId
                - amount
                - paymentMethod
                - donorInformation
              properties:
                fundraiserId:
                  type: string
                  format: uuid
                  example: "f47ac10b-58cc-4372-a567-0e02b2c3d479"
                amount:
                  type: number
                  minimum: 1
                  maximum: 50000
                  example: 100.00
                currency:
                  type: string
                  enum: [USD]
                  default: USD
                recurring:
                  type: boolean
                  default: false
                recurringFrequency:
                  type: string
                  enum: [monthly, quarterly, annually]
                paymentMethod:
                  type: object
                  required:
                    - type
                    - token
                  properties:
                    type:
                      type: string
                      enum: [credit_card, bank_transfer]
                    token:
                      type: string
                      description: FluidPay payment method token
                    last4:
                      type: string
                      pattern: "^\\d{4}$"
                donorInformation:
                  $ref: '#/components/schemas/DonorInformation'
                isAnonymous:
                  type: boolean
                  default: false
                dedications:
                  type: object
                  properties:
                    inHonorOf:
                      type: string
                    inMemoryOf:
                      type: string
      responses:
        '201':
          description: Donation processed successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Donation'
        '400':
          description: Validation error or compliance violation
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              examples:
                contribution_limit:
                  summary: Contribution limit exceeded
                  value:
                    type: "https://api.donation-platform.com/errors/contribution-limit"
                    title: "Contribution Limit Exceeded"
                    status: 400
                    detail: "This donation would exceed the annual contribution limit of $2,900"
                    remainingLimit: 1500.00
                prohibited_source:
                  summary: Prohibited contributor
                  value:
                    type: "https://api.donation-platform.com/errors/prohibited-source"
                    title: "Prohibited Source"
                    status: 400
                    detail: "Foreign nationals are prohibited from making contributions"
        '402':
          description: Payment processing error
        '429':
          description: Rate limit exceeded
```

### GET /donations/{donationId}

```yaml
  /donations/{donationId}:
    get:
      tags:
        - Donations
      summary: Get donation details
      description: Retrieve details for a specific donation
      parameters:
        - name: donationId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Donation details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Donation'
        '404':
          description: Donation not found
```

### GET /donations

```yaml
    get:
      tags:
        - Donations
      summary: List user donations
      description: Get a paginated list of donations for the authenticated user
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            minimum: 1
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 20
        - name: status
          in: query
          schema:
            type: string
            enum: [pending, processing, completed, failed, refunded]
        - name: startDate
          in: query
          schema:
            type: string
            format: date
        - name: endDate
          in: query
          schema:
            type: string
            format: date
      responses:
        '200':
          description: List of donations
          content:
            application/json:
              schema:
                type: object
                properties:
                  donations:
                    type: array
                    items:
                      $ref: '#/components/schemas/Donation'
                  pagination:
                    $ref: '#/components/schemas/Pagination'
```

## Compliance Endpoints

### POST /compliance/check

```yaml
  /compliance/check:
    post:
      tags:
        - Compliance
      summary: Check contribution compliance
      description: |
        Validate a potential contribution against federal and state regulations.

        ## Validation Checks
        - Contribution limits (annual and per-election)
        - Donor eligibility (citizenship, age, prohibited sources)
        - Disclosure requirements
        - Aggregation rules

      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - amount
                - organizationId
                - donorIdentifier
              properties:
                amount:
                  type: number
                  minimum: 1
                organizationId:
                  type: string
                  format: uuid
                donorIdentifier:
                  type: string
                  description: Email or user ID for existing donors
                donorInfo:
                  type: object
                  properties:
                    firstName:
                      type: string
                    lastName:
                      type: string
                    email:
                      type: string
                    citizenship:
                      type: string
                      enum: [citizen, permanent_resident, other]
                    employer:
                      type: string
                    occupation:
                      type: string
      responses:
        '200':
          description: Compliance check result
          content:
            application/json:
              schema:
                type: object
                properties:
                  allowed:
                    type: boolean
                    description: Whether the contribution is allowed
                  reason:
                    type: string
                    description: Reason if contribution is not allowed
                  warnings:
                    type: array
                    items:
                      type: string
                    description: Non-blocking warnings
                  limits:
                    type: object
                    properties:
                      remaining:
                        type: number
                        description: Remaining contribution limit
                      total:
                        type: number
                        description: Total contribution limit
                      period:
                        type: string
                        enum: [annual, per_election]
                  disclosureRequired:
                    type: boolean
                    description: Whether additional disclosure is required
                  requiredFields:
                    type: array
                    items:
                      type: string
                    description: Fields required for compliance
```

### GET /compliance/limits/{userId}

```yaml
  /compliance/limits/{userId}:
    get:
      tags:
        - Compliance
      summary: Get user contribution limits
      description: Retrieve current contribution limits and usage for a user
      parameters:
        - name: userId
          in: path
          required: true
          schema:
            type: string
            format: uuid
        - name: organizationId
          in: query
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Contribution limits
          content:
            application/json:
              schema:
                type: object
                properties:
                  limits:
                    type: array
                    items:
                      type: object
                      properties:
                        limitType:
                          type: string
                          enum: [annual, primary, general]
                        totalLimit:
                          type: number
                        used:
                          type: number
                        remaining:
                          type: number
                        resetDate:
                          type: string
                          format: date
```

## Fundraiser Management Endpoints

### POST /fundraisers

```yaml
  /fundraisers:
    post:
      tags:
        - Fundraisers
      summary: Create a new fundraiser
      description: Create a new fundraising campaign (organization admin only)
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - title
                - organizationId
                - goalAmount
                - startDate
              properties:
                title:
                  type: string
                  maxLength: 255
                description:
                  type: string
                  maxLength: 2000
                slug:
                  type: string
                  pattern: "^[a-z0-9-]+$"
                  maxLength: 255
                organizationId:
                  type: string
                  format: uuid
                goalAmount:
                  type: number
                  minimum: 1
                minimumDonation:
                  type: number
                  minimum: 1
                  default: 1
                maximumDonation:
                  type: number
                suggestedAmounts:
                  type: array
                  items:
                    type: number
                  maxItems: 10
                startDate:
                  type: string
                  format: date-time
                endDate:
                  type: string
                  format: date-time
                imageUrl:
                  type: string
                  format: uri
                videoUrl:
                  type: string
                  format: uri
                customFields:
                  type: object
                settings:
                  type: object
                  properties:
                    allowAnonymous:
                      type: boolean
                      default: false
                    requireAddress:
                      type: boolean
                      default: true
                    requireEmployerInfo:
                      type: boolean
                      default: true
      responses:
        '201':
          description: Fundraiser created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Fundraiser'
```

### GET /fundraisers/{slug}

```yaml
  /fundraisers/{slug}:
    get:
      tags:
        - Fundraisers
      summary: Get fundraiser by slug
      description: Retrieve fundraiser details by URL slug (public endpoint)
      security: []
      parameters:
        - name: slug
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Fundraiser details
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Fundraiser'
                  - type: object
                    properties:
                      organization:
                        $ref: '#/components/schemas/PublicOrganization'
                      statistics:
                        type: object
                        properties:
                          totalRaised:
                            type: number
                          donationCount:
                            type: integer
                          averageDonation:
                            type: number
                          progressPercentage:
                            type: number
```

## Organization Management Endpoints

### GET /organizations/{organizationId}

```yaml
  /organizations/{organizationId}:
    get:
      tags:
        - Organizations
      summary: Get organization details
      description: Retrieve organization information (public endpoint for basic info)
      security: []
      parameters:
        - name: organizationId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Organization details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PublicOrganization'
```

### PUT /organizations/{organizationId}

```yaml
    put:
      tags:
        - Organizations
      summary: Update organization
      description: Update organization details (admin only)
      parameters:
        - name: organizationId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                name:
                  type: string
                  maxLength: 255
                description:
                  type: string
                  maxLength: 2000
                website:
                  type: string
                  format: uri
                phone:
                  type: string
                email:
                  type: string
                  format: email
                address:
                  $ref: '#/components/schemas/Address'
      responses:
        '200':
          description: Organization updated
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Organization'
```

## Administrative Endpoints

### GET /admin/dashboard

```yaml
  /admin/dashboard:
    get:
      tags:
        - Administration
      summary: Get admin dashboard data
      description: Retrieve dashboard metrics and statistics (super admin only)
      security:
        - BearerAuth: []
      responses:
        '200':
          description: Dashboard data
          content:
            application/json:
              schema:
                type: object
                properties:
                  metrics:
                    type: object
                    properties:
                      totalDonations:
                        type: number
                      totalDonors:
                        type: integer
                      totalOrganizations:
                        type: integer
                      totalFundraisers:
                        type: integer
                      recentActivity:
                        type: array
                        items:
                          $ref: '#/components/schemas/ActivityLog'
                  compliance:
                    type: object
                    properties:
                      pendingReviews:
                        type: integer
                      flaggedTransactions:
                        type: integer
                      upcomingDeadlines:
                        type: array
                        items:
                          type: object
                          properties:
                            type:
                              type: string
                            deadline:
                              type: string
                              format: date
                            organizationId:
                              type: string
                              format: uuid
        '403':
          description: Insufficient permissions
```

### GET /admin/compliance/reports

```yaml
  /admin/compliance/reports:
    get:
      tags:
        - Administration
      summary: List compliance reports
      description: Get compliance reports for all organizations (admin only)
      parameters:
        - name: organizationId
          in: query
          schema:
            type: string
            format: uuid
        - name: reportType
          in: query
          schema:
            type: string
            enum: [fec_quarterly, fec_monthly, state_quarterly, annual_summary]
        - name: status
          in: query
          schema:
            type: string
            enum: [draft, pending_review, filed, amended]
        - name: startDate
          in: query
          schema:
            type: string
            format: date
        - name: endDate
          in: query
          schema:
            type: string
            format: date
      responses:
        '200':
          description: Compliance reports
          content:
            application/json:
              schema:
                type: object
                properties:
                  reports:
                    type: array
                    items:
                      $ref: '#/components/schemas/ComplianceReport'
                  pagination:
                    $ref: '#/components/schemas/Pagination'
```

## Data Models

### User Schema

```yaml
components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: string
          format: uuid
          readOnly: true
        email:
          type: string
          format: email
        emailVerified:
          type: boolean
          readOnly: true
        firstName:
          type: string
          maxLength: 100
        lastName:
          type: string
          maxLength: 100
        middleName:
          type: string
          maxLength: 100
        dateOfBirth:
          type: string
          format: date
        phone:
          type: string
        phoneVerified:
          type: boolean
          readOnly: true
        address:
          $ref: '#/components/schemas/Address'
        employer:
          type: string
          maxLength: 255
        occupation:
          type: string
          maxLength: 255
        citizenshipStatus:
          type: string
          enum: [citizen, permanent_resident, other]
        role:
          type: string
          enum: [donor, org_admin, super_admin]
          readOnly: true
        status:
          type: string
          enum: [active, suspended, pending_verification]
          readOnly: true
        kycStatus:
          type: string
          enum: [pending, verified, rejected]
          readOnly: true
        createdAt:
          type: string
          format: date-time
          readOnly: true
        updatedAt:
          type: string
          format: date-time
          readOnly: true

    Address:
      type: object
      required:
        - streetAddress
        - city
        - state
        - postalCode
      properties:
        streetAddress:
          type: string
          maxLength: 500
        city:
          type: string
          maxLength: 100
        state:
          type: string
          pattern: "^[A-Z]{2}$"
        postalCode:
          type: string
          pattern: "^\\d{5}(-\\d{4})?$"
        country:
          type: string
          pattern: "^[A-Z]{2}$"
          default: "US"
```

### Donation Schema

```yaml
    Donation:
      type: object
      properties:
        id:
          type: string
          format: uuid
          readOnly: true
        fundraiserId:
          type: string
          format: uuid
        userId:
          type: string
          format: uuid
        organizationId:
          type: string
          format: uuid
        amount:
          type: number
          minimum: 1
        currency:
          type: string
          enum: [USD]
        feeAmount:
          type: number
          readOnly: true
        netAmount:
          type: number
          readOnly: true
        status:
          type: string
          enum: [pending, processing, completed, failed, refunded, cancelled]
          readOnly: true
        paymentMethod:
          type: object
          properties:
            type:
              type: string
            last4:
              type: string
        isRecurring:
          type: boolean
        recurringFrequency:
          type: string
          enum: [monthly, quarterly, annually]
        donorEmployer:
          type: string
        donorOccupation:
          type: string
        isAnonymous:
          type: boolean
        complianceFlags:
          type: object
          readOnly: true
        processedAt:
          type: string
          format: date-time
          readOnly: true
        completedAt:
          type: string
          format: date-time
          readOnly: true
        createdAt:
          type: string
          format: date-time
          readOnly: true
        updatedAt:
          type: string
          format: date-time
          readOnly: true

    DonorInformation:
      type: object
      required:
        - firstName
        - lastName
        - email
        - address
      properties:
        firstName:
          type: string
          maxLength: 100
        lastName:
          type: string
          maxLength: 100
        email:
          type: string
          format: email
        phone:
          type: string
        address:
          $ref: '#/components/schemas/Address'
        employer:
          type: string
          maxLength: 255
        occupation:
          type: string
          maxLength: 255
        citizenshipStatus:
          type: string
          enum: [citizen, permanent_resident, other]
          default: citizen
```

### Fundraiser Schema

```yaml
    Fundraiser:
      type: object
      properties:
        id:
          type: string
          format: uuid
          readOnly: true
        organizationId:
          type: string
          format: uuid
        title:
          type: string
          maxLength: 255
        description:
          type: string
          maxLength: 2000
        slug:
          type: string
          readOnly: true
        goalAmount:
          type: number
        minimumDonation:
          type: number
        maximumDonation:
          type: number
        suggestedAmounts:
          type: array
          items:
            type: number
        startDate:
          type: string
          format: date-time
        endDate:
          type: string
          format: date-time
        imageUrl:
          type: string
          format: uri
        videoUrl:
          type: string
          format: uri
        status:
          type: string
          enum: [draft, active, paused, completed, cancelled]
        totalRaised:
          type: number
          readOnly: true
        donationCount:
          type: integer
          readOnly: true
        lastDonationAt:
          type: string
          format: date-time
          readOnly: true
        settings:
          type: object
          properties:
            allowAnonymous:
              type: boolean
            requireAddress:
              type: boolean
            requireEmployerInfo:
              type: boolean
        createdAt:
          type: string
          format: date-time
          readOnly: true
        updatedAt:
          type: string
          format: date-time
          readOnly: true

    Organization:
      type: object
      properties:
        id:
          type: string
          format: uuid
          readOnly: true
        name:
          type: string
          maxLength: 255
        legalName:
          type: string
          maxLength: 255
        organizationType:
          type: string
          enum: [candidate_committee, pac, super_pac, party_committee, nonprofit_501c3, nonprofit_501c4]
        email:
          type: string
          format: email
        phone:
          type: string
        website:
          type: string
          format: uri
        address:
          $ref: '#/components/schemas/Address'
        fecId:
          type: string
          maxLength: 20
        ein:
          type: string
          maxLength: 20
        stateFilingId:
          type: string
          maxLength: 50
        verificationStatus:
          type: string
          enum: [pending, verified, rejected, suspended]
          readOnly: true
        status:
          type: string
          enum: [active, inactive, suspended]
        createdAt:
          type: string
          format: date-time
          readOnly: true
        updatedAt:
          type: string
          format: date-time
          readOnly: true

    PublicOrganization:
      type: object
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        organizationType:
          type: string
        website:
          type: string
          format: uri
        verificationStatus:
          type: string
```

### Utility Schemas

```yaml
    Pagination:
      type: object
      properties:
        page:
          type: integer
        limit:
          type: integer
        total:
          type: integer
        totalPages:
          type: integer
        hasNext:
          type: boolean
        hasPrevious:
          type: boolean

    ComplianceReport:
      type: object
      properties:
        id:
          type: string
          format: uuid
        organizationId:
          type: string
          format: uuid
        reportType:
          type: string
          enum: [fec_quarterly, fec_monthly, state_quarterly, annual_summary]
        reportingPeriodStart:
          type: string
          format: date
        reportingPeriodEnd:
          type: string
          format: date
        filingDeadline:
          type: string
          format: date
        status:
          type: string
          enum: [draft, pending_review, filed, amended]
        generatedFileUrl:
          type: string
          format: uri
        filedAt:
          type: string
          format: date-time
        confirmationNumber:
          type: string
        createdAt:
          type: string
          format: date-time

    ActivityLog:
      type: object
      properties:
        id:
          type: string
          format: uuid
        type:
          type: string
          enum: [donation_created, user_registered, organization_verified, report_filed]
        description:
          type: string
        userId:
          type: string
          format: uuid
        organizationId:
          type: string
          format: uuid
        metadata:
          type: object
        timestamp:
          type: string
          format: date-time
```

## Response Examples

### Successful Donation Response

```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "fundraiserId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "userId": "12345678-1234-1234-1234-123456789012",
  "organizationId": "87654321-4321-4321-4321-210987654321",
  "amount": 100.00,
  "currency": "USD",
  "feeAmount": 3.20,
  "netAmount": 96.80,
  "status": "completed",
  "paymentMethod": {
    "type": "credit_card",
    "last4": "4242"
  },
  "isRecurring": false,
  "donorEmployer": "Tech Corp",
  "donorOccupation": "Software Engineer",
  "isAnonymous": false,
  "processedAt": "2024-01-15T10:30:00Z",
  "completedAt": "2024-01-15T10:30:15Z",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:15Z"
}
```

### Compliance Check Response

```json
{
  "allowed": true,
  "warnings": [
    "This contribution requires disclosure of employer and occupation information."
  ],
  "limits": {
    "remaining": 2800.00,
    "total": 2900.00,
    "period": "annual"
  },
  "disclosureRequired": true,
  "requiredFields": [
    "employer",
    "occupation"
  ]
}
```

### Error Response

```json
{
  "type": "https://api.donation-platform.com/errors/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "The request contains invalid data",
  "instance": "/donations",
  "errors": [
    {
      "field": "amount",
      "message": "Amount must be greater than 0"
    },
    {
      "field": "donorInformation.email",
      "message": "Valid email address is required"
    }
  ]
}
```

This comprehensive API documentation provides all the endpoints, schemas, and examples needed for integrating with the political donation platform, ensuring proper compliance checking, secure payment processing, and complete audit trails.