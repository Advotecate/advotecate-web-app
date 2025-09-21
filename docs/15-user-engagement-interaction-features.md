# User Engagement and Interaction Features

## Overview

This document outlines the comprehensive user engagement and interaction system that drives community participation, content interaction, and political involvement across the platform. The system includes social interactions, gamification elements, community building features, and civic engagement tools while maintaining compliance with political engagement regulations.

## Engagement Architecture

### Core Interaction Framework

```typescript
interface EngagementSystem {
  interactionManager: InteractionManager;
  socialFeatures: SocialFeatures;
  gamificationEngine: GamificationEngine;
  communityBuilder: CommunityBuilder;
  civicEngagement: CivicEngagementEngine;
  notificationSystem: NotificationSystem;
}

interface UserInteraction {
  id: string;
  userId: string;
  contentId: string;
  contentType: ContentType;
  interactionType: InteractionType;
  metadata: InteractionMetadata;
  createdAt: Date;
  context: InteractionContext;
}

enum InteractionType {
  VIEW = 'VIEW',
  LIKE = 'LIKE',
  DISLIKE = 'DISLIKE',
  SHARE = 'SHARE',
  COMMENT = 'COMMENT',
  SAVE = 'SAVE',
  FOLLOW = 'FOLLOW',
  UNFOLLOW = 'UNFOLLOW',
  DONATE = 'DONATE',
  VOLUNTEER = 'VOLUNTEER',
  ATTEND = 'ATTEND',
  RSVP = 'RSVP',
  REPORT = 'REPORT'
}
```

## Social Interaction Features

### Content Engagement System

```typescript
class ContentInteractionManager {
  async recordInteraction(
    userId: string,
    contentId: string,
    interactionType: InteractionType,
    metadata?: InteractionMetadata
  ): Promise<InteractionResult> {
    // Validate interaction permissions
    await this.validateInteractionPermissions(userId, contentId, interactionType);

    // Check rate limits
    await this.enforceRateLimits(userId, interactionType);

    // Record interaction
    const interaction = await this.createInteraction({
      userId,
      contentId,
      interactionType,
      metadata,
      createdAt: new Date(),
      context: await this.buildInteractionContext(userId, contentId)
    });

    // Update user engagement profile
    await this.updateUserEngagementProfile(userId, interaction);

    // Update content engagement metrics
    await this.updateContentEngagementMetrics(contentId, interaction);

    // Trigger real-time updates
    await this.triggerRealTimeUpdates(interaction);

    // Process compliance requirements
    if (this.requiresComplianceTracking(interactionType)) {
      await this.recordComplianceInteraction(interaction);
    }

    return {
      success: true,
      interaction,
      updatedMetrics: await this.getUpdatedEngagementMetrics(contentId)
    };
  }

  private async validateInteractionPermissions(
    userId: string,
    contentId: string,
    interactionType: InteractionType
  ): Promise<void> {
    const user = await this.getUserProfile(userId);
    const content = await this.getContent(contentId);

    // Check age restrictions for political content
    if (interactionType === InteractionType.DONATE) {
      await this.validateDonationEligibility(user, content);
    }

    // Check geographic restrictions
    if (content.geoRestricted) {
      await this.validateGeographicAccess(user, content);
    }

    // Check blocked users/content
    if (await this.isBlocked(userId, content.creatorId)) {
      throw new Error('User is blocked from interacting with this content');
    }
  }
}
```

### Like and Reaction System

```typescript
class ReactionSystem {
  private readonly reactionTypes = {
    LIKE: { emoji: '👍', points: 1 },
    LOVE: { emoji: '❤️', points: 2 },
    SUPPORT: { emoji: '✊', points: 3 },
    ANGRY: { emoji: '😠', points: 1 },
    LAUGH: { emoji: '😂', points: 1 },
    SAD: { emoji: '😢', points: 1 }
  };

  async addReaction(
    userId: string,
    contentId: string,
    reactionType: string
  ): Promise<ReactionResult> {
    // Remove existing reaction if present
    await this.removeExistingReaction(userId, contentId);

    // Add new reaction
    const reaction = await this.createReaction({
      userId,
      contentId,
      reactionType,
      points: this.reactionTypes[reactionType]?.points || 1,
      createdAt: new Date()
    });

    // Update content reaction counts
    await this.updateReactionCounts(contentId, reactionType, 1);

    // Award points to content creator
    await this.awardCreatorPoints(contentId, reaction.points);

    // Trigger notifications
    await this.notifyContentCreator(contentId, reaction);

    return {
      reaction,
      totalReactions: await this.getReactionCounts(contentId)
    };
  }

  async getReactionSummary(contentId: string): Promise<ReactionSummary> {
    const reactions = await this.getContentReactions(contentId);

    const summary = reactions.reduce((acc, reaction) => {
      acc[reaction.reactionType] = (acc[reaction.reactionType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalReactions = Object.values(summary).reduce((sum, count) => sum + count, 0);

    return {
      summary,
      totalReactions,
      topReaction: this.getTopReaction(summary),
      reactionDistribution: this.calculateReactionDistribution(summary)
    };
  }
}
```

### Comment and Discussion System

```typescript
class CommentSystem {
  async createComment(
    userId: string,
    contentId: string,
    commentText: string,
    parentCommentId?: string
  ): Promise<CommentResult> {
    // Content moderation
    const moderationResult = await this.moderateComment(commentText);
    if (!moderationResult.approved) {
      throw new Error('Comment does not meet community guidelines');
    }

    // Create comment
    const comment = await this.createCommentRecord({
      userId,
      contentId,
      parentCommentId,
      text: commentText,
      moderationScore: moderationResult.score,
      createdAt: new Date(),
      status: 'ACTIVE'
    });

    // Update thread structure
    if (parentCommentId) {
      await this.updateCommentThread(parentCommentId, comment.id);
    }

    // Update engagement metrics
    await this.updateContentCommentCount(contentId, 1);

    // Award user engagement points
    await this.awardEngagementPoints(userId, 'COMMENT', 5);

    // Trigger notifications
    await this.triggerCommentNotifications(comment);

    // Index for search
    await this.indexCommentForSearch(comment);

    return {
      comment: await this.enrichCommentWithMetadata(comment),
      threadStructure: await this.getCommentThread(contentId)
    };
  }

  async getCommentThread(
    contentId: string,
    sortBy: CommentSort = 'TOP'
  ): Promise<CommentThread> {
    const comments = await this.getCommentsForContent(contentId);
    const sortedComments = this.sortComments(comments, sortBy);

    // Build threaded structure
    const threadedComments = this.buildCommentHierarchy(sortedComments);

    return {
      contentId,
      totalComments: comments.length,
      comments: threadedComments,
      sortedBy: sortBy,
      hasMore: comments.length > 50 // Pagination
    };
  }

  private async moderateComment(text: string): Promise<ModerationResult> {
    const checks = await Promise.all([
      this.checkForProfanity(text),
      this.checkForSpam(text),
      this.checkForHateSpeech(text),
      this.checkForMisinformation(text),
      this.checkForPersonalAttacks(text)
    ]);

    const overallScore = this.calculateModerationScore(checks);
    const approved = overallScore > 0.7; // 70% threshold

    return {
      approved,
      score: overallScore,
      flags: checks.flatMap(check => check.flags),
      requiresReview: overallScore < 0.8 && overallScore > 0.3
    };
  }
}
```

## Social Following and Connections

### Follow/Unfollow System

```typescript
class SocialConnectionManager {
  async followUser(followerId: string, followeeId: string): Promise<FollowResult> {
    // Validate follow request
    await this.validateFollowRequest(followerId, followeeId);

    // Check if already following
    const existingFollow = await this.getExistingFollow(followerId, followeeId);
    if (existingFollow) {
      return { success: false, error: 'Already following user' };
    }

    // Create follow relationship
    const follow = await this.createFollow({
      followerId,
      followeeId,
      createdAt: new Date(),
      status: 'ACTIVE'
    });

    // Update follower/following counts
    await Promise.all([
      this.updateFollowerCount(followeeId, 1),
      this.updateFollowingCount(followerId, 1)
    ]);

    // Create notification
    await this.notifyNewFollower(followeeId, followerId);

    // Update recommendation algorithms
    await this.updateRecommendationModels(followerId, followeeId);

    return {
      success: true,
      follow,
      newFollowerCount: await this.getFollowerCount(followeeId)
    };
  }

  async followOrganization(
    userId: string,
    organizationId: string
  ): Promise<OrganizationFollowResult> {
    const follow = await this.createOrganizationFollow({
      userId,
      organizationId,
      followType: 'ORGANIZATION',
      notificationPreferences: {
        newEvents: true,
        newFundraisers: true,
        updates: true,
        urgentAlerts: false
      },
      createdAt: new Date()
    });

    // Update user's political interest profile
    await this.updateUserPoliticalProfile(userId, organizationId);

    // Subscribe to organization notifications
    await this.subscribeToOrganizationNotifications(userId, organizationId);

    return {
      success: true,
      follow,
      organizationProfile: await this.getOrganizationProfile(organizationId)
    };
  }

  async getFollowingSuggestions(userId: string): Promise<FollowSuggestion[]> {
    const userProfile = await this.getUserProfile(userId);

    const [
      tagBasedSuggestions,
      friendsOfFriendsSuggestions,
      locationBasedSuggestions,
      popularUsersSuggestions
    ] = await Promise.all([
      this.getTagBasedSuggestions(userProfile),
      this.getFriendsOfFriendsSuggestions(userId),
      this.getLocationBasedSuggestions(userProfile),
      this.getPopularUsersSuggestions(userProfile)
    ]);

    const allSuggestions = [
      ...tagBasedSuggestions,
      ...friendsOfFriendsSuggestions,
      ...locationBasedSuggestions,
      ...popularUsersSuggestions
    ];

    // Remove duplicates and rank suggestions
    const rankedSuggestions = this.rankFollowSuggestions(allSuggestions, userProfile);

    return rankedSuggestions.slice(0, 20); // Top 20 suggestions
  }
}
```

## Gamification System

### Points and Achievement System

```typescript
class GamificationEngine {
  private readonly pointsConfig = {
    PROFILE_COMPLETE: 100,
    FIRST_DONATION: 500,
    COMMENT: 5,
    SHARE: 10,
    ATTEND_EVENT: 50,
    CREATE_FUNDRAISER: 200,
    INVITE_FRIEND: 25,
    WEEKLY_ENGAGEMENT: 100,
    MILESTONE_DONATION: 1000
  };

  private readonly achievements = [
    {
      id: 'first_donation',
      name: 'First Supporter',
      description: 'Made your first political donation',
      icon: '🎯',
      points: 500,
      category: 'CIVIC_ENGAGEMENT'
    },
    {
      id: 'community_builder',
      name: 'Community Builder',
      description: 'Invited 10 friends to join the platform',
      icon: '🤝',
      points: 1000,
      category: 'SOCIAL'
    },
    {
      id: 'super_supporter',
      name: 'Super Supporter',
      description: 'Donated to 5 different campaigns',
      icon: '⭐',
      points: 2500,
      category: 'CIVIC_ENGAGEMENT'
    },
    {
      id: 'event_enthusiast',
      name: 'Event Enthusiast',
      description: 'Attended 10 political events',
      icon: '📅',
      points: 1500,
      category: 'PARTICIPATION'
    }
  ];

  async awardPoints(
    userId: string,
    action: string,
    context?: PointsContext
  ): Promise<PointsResult> {
    const pointsValue = this.pointsConfig[action] || 0;
    if (pointsValue === 0) return { success: false, error: 'Invalid action' };

    // Check for bonus multipliers
    const multiplier = await this.calculatePointsMultiplier(userId, action, context);
    const finalPoints = Math.round(pointsValue * multiplier);

    // Award points
    const pointsRecord = await this.createPointsRecord({
      userId,
      action,
      basePoints: pointsValue,
      multiplier,
      finalPoints,
      context,
      createdAt: new Date()
    });

    // Update user's total points
    await this.updateUserPoints(userId, finalPoints);

    // Check for new achievements
    const newAchievements = await this.checkAchievements(userId, action);

    // Check for level progression
    const levelUpdate = await this.checkLevelProgression(userId);

    return {
      success: true,
      pointsAwarded: finalPoints,
      totalPoints: await this.getUserTotalPoints(userId),
      newAchievements,
      levelUpdate
    };
  }

  async getUserEngagementStats(userId: string): Promise<EngagementStats> {
    const [
      totalPoints,
      currentLevel,
      achievements,
      streaks,
      weeklyActivity
    ] = await Promise.all([
      this.getUserTotalPoints(userId),
      this.getUserLevel(userId),
      this.getUserAchievements(userId),
      this.getUserStreaks(userId),
      this.getWeeklyActivity(userId)
    ]);

    return {
      totalPoints,
      currentLevel,
      nextLevel: await this.getNextLevel(currentLevel),
      pointsToNextLevel: await this.getPointsToNextLevel(userId),
      achievements,
      streaks,
      weeklyActivity,
      rank: await this.getUserRank(userId),
      badges: await this.getUserBadges(userId)
    };
  }

  private async checkAchievements(
    userId: string,
    triggerAction: string
  ): Promise<Achievement[]> {
    const userStats = await this.getUserActionStats(userId);
    const newAchievements = [];

    for (const achievement of this.achievements) {
      const hasAchievement = await this.userHasAchievement(userId, achievement.id);
      if (hasAchievement) continue;

      const meetsRequirements = await this.checkAchievementRequirements(
        achievement,
        userStats,
        triggerAction
      );

      if (meetsRequirements) {
        await this.grantAchievement(userId, achievement);
        newAchievements.push(achievement);
      }
    }

    return newAchievements;
  }
}
```

### Leaderboards and Competition

```typescript
class LeaderboardSystem {
  async getLeaderboards(
    userId: string,
    period: LeaderboardPeriod = 'MONTHLY'
  ): Promise<Leaderboards> {
    const [
      pointsLeaderboard,
      donationsLeaderboard,
      engagementLeaderboard,
      communityLeaderboard
    ] = await Promise.all([
      this.getPointsLeaderboard(period),
      this.getDonationsLeaderboard(period),
      this.getEngagementLeaderboard(period),
      this.getCommunityLeaderboard(period)
    ]);

    return {
      points: await this.enrichWithUserPosition(pointsLeaderboard, userId),
      donations: await this.enrichWithUserPosition(donationsLeaderboard, userId),
      engagement: await this.enrichWithUserPosition(engagementLeaderboard, userId),
      community: await this.enrichWithUserPosition(communityLeaderboard, userId),
      period,
      updatedAt: new Date()
    };
  }

  private async getPointsLeaderboard(
    period: LeaderboardPeriod
  ): Promise<LeaderboardEntry[]> {
    const dateRange = this.getDateRangeForPeriod(period);

    const topUsers = await this.database.query(`
      SELECT
        u.id,
        u.username,
        u.display_name,
        u.avatar_url,
        SUM(p.final_points) as total_points,
        COUNT(p.id) as actions_count,
        MAX(p.created_at) as last_activity
      FROM users u
      JOIN user_points p ON u.id = p.user_id
      WHERE p.created_at >= $1 AND p.created_at <= $2
        AND u.privacy_settings->>'show_in_leaderboards' = 'true'
      GROUP BY u.id, u.username, u.display_name, u.avatar_url
      ORDER BY total_points DESC
      LIMIT 100
    `, [dateRange.start, dateRange.end]);

    return topUsers.map((user, index) => ({
      rank: index + 1,
      userId: user.id,
      username: user.username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      score: user.total_points,
      actionsCount: user.actions_count,
      lastActivity: user.last_activity
    }));
  }

  async createChallenge(
    creatorId: string,
    challengeData: ChallengeData
  ): Promise<Challenge> {
    const challenge = await this.database.create('challenges', {
      id: generateId(),
      creatorId,
      title: challengeData.title,
      description: challengeData.description,
      type: challengeData.type,
      goal: challengeData.goal,
      duration: challengeData.duration,
      startDate: challengeData.startDate,
      endDate: challengeData.endDate,
      prizes: challengeData.prizes,
      rules: challengeData.rules,
      status: 'ACTIVE',
      createdAt: new Date()
    });

    // Create challenge leaderboard
    await this.initializeChallengeLeaderboard(challenge.id);

    // Notify eligible participants
    await this.notifyEligibleParticipants(challenge);

    return challenge;
  }
}
```

## Community Building Features

### Group and Community Creation

```typescript
class CommunityManager {
  async createCommunity(
    creatorId: string,
    communityData: CommunityData
  ): Promise<Community> {
    // Validate community data
    await this.validateCommunityData(communityData);

    // Check creator permissions
    await this.validateCreatorPermissions(creatorId);

    const community = await this.database.create('communities', {
      id: generateId(),
      creatorId,
      name: communityData.name,
      description: communityData.description,
      type: communityData.type,
      privacy: communityData.privacy,
      tags: communityData.tags,
      rules: communityData.rules,
      membershipRequirements: communityData.membershipRequirements,
      location: communityData.location,
      status: 'ACTIVE',
      memberCount: 1, // Creator is first member
      createdAt: new Date()
    });

    // Add creator as admin
    await this.addCommunityMember(community.id, creatorId, 'ADMIN');

    // Create community feed
    await this.initializeCommunityFeed(community.id);

    // Index for search
    await this.indexCommunityForSearch(community);

    return community;
  }

  async joinCommunity(
    userId: string,
    communityId: string
  ): Promise<CommunityJoinResult> {
    const community = await this.getCommunity(communityId);

    // Check if user can join
    await this.validateJoinEligibility(userId, community);

    // Handle different privacy levels
    if (community.privacy === 'PRIVATE') {
      return await this.requestCommunityMembership(userId, communityId);
    }

    // Join public community
    const membership = await this.addCommunityMember(communityId, userId, 'MEMBER');

    // Update member count
    await this.updateCommunityMemberCount(communityId, 1);

    // Add to user's community feed
    await this.addCommunityToUserFeed(userId, communityId);

    // Welcome notification
    await this.sendWelcomeNotification(userId, community);

    return {
      success: true,
      membership,
      community: await this.enrichCommunityData(community, userId)
    };
  }

  async getCommunityFeed(
    userId: string,
    communityId: string
  ): Promise<CommunityFeed> {
    // Verify membership
    await this.verifyMembership(userId, communityId);

    const [
      pinnedPosts,
      recentPosts,
      upcomingEvents,
      activeFundraisers
    ] = await Promise.all([
      this.getPinnedPosts(communityId),
      this.getRecentPosts(communityId, userId),
      this.getUpcomingEvents(communityId),
      this.getActiveFundraisers(communityId)
    ]);

    return {
      communityId,
      pinnedPosts,
      recentPosts,
      upcomingEvents,
      activeFundraisers,
      memberSpotlight: await this.getMemberSpotlight(communityId),
      communityStats: await this.getCommunityStats(communityId)
    };
  }
}
```

### User-Generated Content

```typescript
class UserContentManager {
  async createUserPost(
    userId: string,
    postData: UserPostData
  ): Promise<UserPost> {
    // Content moderation
    const moderationResult = await this.moderateUserContent(postData);

    const post = await this.database.create('user_posts', {
      id: generateId(),
      userId,
      title: postData.title,
      content: postData.content,
      type: postData.type,
      tags: postData.tags,
      attachments: postData.attachments,
      privacy: postData.privacy,
      allowComments: postData.allowComments,
      allowSharing: postData.allowSharing,
      moderationScore: moderationResult.score,
      status: moderationResult.approved ? 'PUBLISHED' : 'PENDING_REVIEW',
      createdAt: new Date()
    });

    // Index for search
    await this.indexPostForSearch(post);

    // Award creation points
    await this.gamificationEngine.awardPoints(userId, 'CREATE_POST');

    // Notify followers if public
    if (postData.privacy === 'PUBLIC') {
      await this.notifyFollowersOfNewPost(userId, post);
    }

    return post;
  }

  async shareContent(
    userId: string,
    contentId: string,
    shareData: ShareData
  ): Promise<ShareResult> {
    const originalContent = await this.getContent(contentId);

    // Create share record
    const share = await this.database.create('content_shares', {
      id: generateId(),
      userId,
      originalContentId: contentId,
      originalContentType: originalContent.type,
      shareType: shareData.type,
      platform: shareData.platform,
      message: shareData.message,
      privacy: shareData.privacy,
      createdAt: new Date()
    });

    // Update share count on original content
    await this.updateContentShareCount(contentId, 1);

    // Award sharing points
    await this.gamificationEngine.awardPoints(userId, 'SHARE');

    // Track sharing analytics
    await this.trackSharingEvent(share);

    // Create activity feed entry
    if (shareData.privacy === 'PUBLIC') {
      await this.createActivityFeedEntry(userId, 'SHARED', share);
    }

    return {
      success: true,
      share,
      newShareCount: await this.getContentShareCount(contentId)
    };
  }
}
```

## Civic Engagement Features

### Donation Integration with Engagement

```typescript
class CivicEngagementEngine {
  async recordDonation(
    userId: string,
    donationData: DonationData
  ): Promise<CivicEngagementResult> {
    // Record donation through FluidPay integration
    const donation = await this.fluidPayService.processDonation(donationData);

    // Award engagement points
    const pointsAwarded = await this.gamificationEngine.awardPoints(
      userId,
      'DONATION',
      { amount: donation.amount }
    );

    // Update user civic engagement profile
    await this.updateCivicEngagementProfile(userId, donation);

    // Create donation badge if milestone reached
    const badges = await this.checkDonationMilestones(userId);

    // Share achievement (if user allows)
    if (await this.userAllowsEngagementSharing(userId)) {
      await this.shareEngagementAchievement(userId, donation, badges);
    }

    return {
      donation,
      pointsAwarded,
      newBadges: badges,
      civicEngagementLevel: await this.getCivicEngagementLevel(userId)
    };
  }

  async trackVolunteerActivity(
    userId: string,
    volunteerData: VolunteerData
  ): Promise<VolunteerResult> {
    const activity = await this.database.create('volunteer_activities', {
      id: generateId(),
      userId,
      organizationId: volunteerData.organizationId,
      eventId: volunteerData.eventId,
      activityType: volunteerData.type,
      hours: volunteerData.hours,
      description: volunteerData.description,
      verificationStatus: 'PENDING',
      createdAt: new Date()
    });

    // Award volunteer points
    const pointsAwarded = await this.gamificationEngine.awardPoints(
      userId,
      'VOLUNTEER',
      { hours: volunteerData.hours }
    );

    // Request verification from organization
    await this.requestVolunteerVerification(activity);

    return {
      success: true,
      activity,
      pointsAwarded,
      totalVolunteerHours: await this.getTotalVolunteerHours(userId)
    };
  }

  async getImpactSummary(userId: string): Promise<ImpactSummary> {
    const [
      donationImpact,
      volunteerImpact,
      engagementImpact,
      communityImpact
    ] = await Promise.all([
      this.getDonationImpact(userId),
      this.getVolunteerImpact(userId),
      this.getEngagementImpact(userId),
      this.getCommunityImpact(userId)
    ]);

    return {
      totalDonated: donationImpact.totalAmount,
      donationCount: donationImpact.count,
      recipientsSupported: donationImpact.uniqueRecipients,
      volunteerHours: volunteerImpact.totalHours,
      volunteerEvents: volunteerImpact.eventCount,
      peopleReached: engagementImpact.reachCount,
      contentShared: engagementImpact.shareCount,
      communitiesJoined: communityImpact.communityCount,
      friendsInvited: communityImpact.inviteCount,
      overallImpactScore: this.calculateOverallImpact({
        donationImpact,
        volunteerImpact,
        engagementImpact,
        communityImpact
      })
    };
  }
}
```

## Notification System

### Real-Time Engagement Notifications

```typescript
class EngagementNotificationSystem {
  async sendEngagementNotification(
    notification: EngagementNotification
  ): Promise<void> {
    const userPreferences = await this.getUserNotificationPreferences(
      notification.userId
    );

    // Check if user wants this type of notification
    if (!this.shouldSendNotification(notification, userPreferences)) {
      return;
    }

    // Determine delivery methods
    const deliveryMethods = this.getDeliveryMethods(notification, userPreferences);

    // Send via each method
    await Promise.all([
      ...deliveryMethods.includes('IN_APP') ? [this.sendInAppNotification(notification)] : [],
      ...deliveryMethods.includes('EMAIL') ? [this.sendEmailNotification(notification)] : [],
      ...deliveryMethods.includes('PUSH') ? [this.sendPushNotification(notification)] : [],
      ...deliveryMethods.includes('SMS') ? [this.sendSMSNotification(notification)] : []
    ]);

    // Track notification engagement
    await this.trackNotificationSent(notification);
  }

  private getNotificationTemplate(
    type: NotificationType
  ): NotificationTemplate {
    const templates = {
      NEW_LIKE: {
        title: '{actor} liked your {contentType}',
        body: 'Your {contentType} "{contentTitle}" received a new like',
        icon: '👍',
        action: 'VIEW_CONTENT'
      },
      NEW_COMMENT: {
        title: '{actor} commented on your {contentType}',
        body: '"{commentPreview}"',
        icon: '💬',
        action: 'VIEW_COMMENT'
      },
      NEW_FOLLOWER: {
        title: '{actor} started following you',
        body: 'You have a new follower! Check out their profile.',
        icon: '👥',
        action: 'VIEW_PROFILE'
      },
      MILESTONE_ACHIEVED: {
        title: 'Achievement Unlocked! 🎉',
        body: 'You earned "{achievementName}" - {achievementDescription}',
        icon: '🏆',
        action: 'VIEW_ACHIEVEMENTS'
      },
      DONATION_RECEIVED: {
        title: 'New donation received! 💝',
        body: 'Your fundraiser "{fundraiserTitle}" received a ${amount} donation',
        icon: '💰',
        action: 'VIEW_FUNDRAISER'
      }
    };

    return templates[type];
  }

  async getNotificationFeed(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<NotificationFeed> {
    const notifications = await this.getUserNotifications(userId, limit, offset);

    // Mark as read when fetched
    await this.markNotificationsAsRead(
      notifications.filter(n => !n.readAt).map(n => n.id)
    );

    return {
      notifications: await this.enrichNotificationsWithMetadata(notifications),
      unreadCount: await this.getUnreadNotificationCount(userId),
      hasMore: notifications.length === limit
    };
  }
}
```

## Analytics and Insights

### Engagement Analytics Dashboard

```typescript
class EngagementAnalytics {
  async getUserEngagementReport(
    userId: string,
    timeRange: TimeRange
  ): Promise<EngagementReport> {
    const [
      activitySummary,
      contentPerformance,
      socialMetrics,
      growthMetrics
    ] = await Promise.all([
      this.getActivitySummary(userId, timeRange),
      this.getContentPerformance(userId, timeRange),
      this.getSocialMetrics(userId, timeRange),
      this.getGrowthMetrics(userId, timeRange)
    ]);

    return {
      timeRange,
      activitySummary,
      contentPerformance,
      socialMetrics,
      growthMetrics,
      insights: this.generateEngagementInsights({
        activitySummary,
        contentPerformance,
        socialMetrics,
        growthMetrics
      }),
      recommendations: await this.generateEngagementRecommendations(userId)
    };
  }

  private generateEngagementInsights(data: EngagementData): string[] {
    const insights = [];

    if (data.contentPerformance.averageEngagement > data.contentPerformance.previousPeriodAverage * 1.2) {
      insights.push('Your content engagement increased by 20%+ this period');
    }

    if (data.socialMetrics.newFollowers > data.socialMetrics.previousPeriodNewFollowers * 1.5) {
      insights.push('Your follower growth accelerated significantly');
    }

    if (data.activitySummary.donationTotal > 0) {
      insights.push(`You made a civic impact with $${data.activitySummary.donationTotal} in donations`);
    }

    return insights;
  }

  async trackEngagementTrends(): Promise<EngagementTrends> {
    const timeRanges = [
      { period: 'today', range: this.getTodayRange() },
      { period: 'week', range: this.getWeekRange() },
      { period: 'month', range: this.getMonthRange() }
    ];

    const trendData = await Promise.all(
      timeRanges.map(async ({ period, range }) => {
        const metrics = await this.getPlatformEngagementMetrics(range);
        return { period, metrics };
      })
    );

    return {
      trends: trendData,
      insights: this.analyzeTrends(trendData),
      predictions: await this.generateEngagementPredictions(trendData)
    };
  }
}
```

This comprehensive engagement system creates a vibrant community where users can meaningfully interact with political content, build connections, and participate in civic activities while earning recognition for their contributions to the democratic process.