# Feed Personalization Algorithms

## Overview

The platform's personalization system leverages user behavior, tag affinities, and collaborative filtering to deliver highly relevant content feeds. This document details the algorithms and implementation strategies for personalizing user experiences across Events, Fundraisers, and Organizations.

## Personalization Architecture

### Core Components

```typescript
interface PersonalizationEngine {
  userProfileBuilder: UserProfileBuilder;
  affinityCalculator: AffinityCalculator;
  contentScorer: ContentScorer;
  feedGenerator: FeedGenerator;
  realTimeUpdater: RealTimeUpdater;
}

interface UserProfile {
  userId: string;
  tagAffinities: Map<string, number>; // tag_id -> affinity_score (0-1)
  interactionHistory: InteractionMetrics;
  demographicFactors: DemographicProfile;
  engagementPatterns: EngagementProfile;
  socialConnections: SocialGraph;
}
```

### Algorithm Flow

1. **User Profile Building** → Real-time behavior tracking
2. **Content Analysis** → Tag extraction and metadata enrichment
3. **Relevance Scoring** → Multi-factor relevance calculation
4. **Collaborative Filtering** → Similar user analysis
5. **Feed Generation** → Ranked content delivery
6. **Feedback Loop** → Continuous learning and optimization

## User Profile Building Algorithm

### Behavioral Tracking System

```typescript
class UserProfileBuilder {
  async updateProfile(userId: string, interaction: UserInteraction): Promise<void> {
    const profile = await this.getUserProfile(userId);

    // Update tag affinities based on interaction type
    await this.updateTagAffinities(profile, interaction);

    // Update engagement patterns
    await this.updateEngagementPatterns(profile, interaction);

    // Update social connections
    await this.updateSocialGraph(profile, interaction);

    // Calculate decay for time-based relevance
    await this.applyTemporalDecay(profile);
  }

  private async updateTagAffinities(
    profile: UserProfile,
    interaction: UserInteraction
  ): Promise<void> {
    const contentTags = await this.getContentTags(interaction.contentId);
    const interactionWeight = this.getInteractionWeight(interaction.type);

    for (const tag of contentTags) {
      const currentAffinity = profile.tagAffinities.get(tag.id) || 0;
      const newAffinity = this.calculateNewAffinity(
        currentAffinity,
        interactionWeight,
        tag.categoryLevel
      );

      profile.tagAffinities.set(tag.id, Math.min(newAffinity, 1.0));
    }
  }
}
```

### Interaction Weights

```typescript
const INTERACTION_WEIGHTS = {
  VIEW: 0.1,
  LIKE: 0.3,
  SHARE: 0.5,
  COMMENT: 0.4,
  DONATE: 0.8,
  ATTEND_EVENT: 0.7,
  FOLLOW_ORG: 0.6,
  CREATE_FUNDRAISER: 0.9,
  RECURRING_DONATION: 1.0
} as const;
```

### Temporal Decay Model

```typescript
class TemporalDecayCalculator {
  private readonly DECAY_RATE = 0.1; // 10% decay per week
  private readonly MIN_AFFINITY = 0.05; // Minimum threshold to maintain

  calculateDecay(lastUpdate: Date, currentAffinity: number): number {
    const weeksSinceUpdate = this.getWeeksDifference(lastUpdate, new Date());
    const decayFactor = Math.exp(-this.DECAY_RATE * weeksSinceUpdate);
    const decayedAffinity = currentAffinity * decayFactor;

    return decayedAffinity < this.MIN_AFFINITY ? 0 : decayedAffinity;
  }
}
```

## Content Scoring Algorithm

### Multi-Factor Relevance Scoring

```typescript
interface ContentScore {
  tagAffinityScore: number;     // 0-1, based on user tag preferences
  socialProofScore: number;     // 0-1, based on similar users' interactions
  timelinessScore: number;      // 0-1, recency and trend factors
  diversityScore: number;       // 0-1, content type diversity
  qualityScore: number;         // 0-1, engagement rate and credibility
  locationRelevanceScore: number; // 0-1, geographic proximity
  finalScore: number;           // Weighted combination
}

class ContentScorer {
  async scoreContent(
    content: FeedContent,
    userProfile: UserProfile
  ): Promise<ContentScore> {
    const tagAffinityScore = await this.calculateTagAffinity(content, userProfile);
    const socialProofScore = await this.calculateSocialProof(content, userProfile);
    const timelinessScore = this.calculateTimeliness(content);
    const diversityScore = await this.calculateDiversity(content, userProfile);
    const qualityScore = await this.calculateQuality(content);
    const locationScore = this.calculateLocationRelevance(content, userProfile);

    const finalScore = this.combineScores({
      tagAffinityScore,
      socialProofScore,
      timelinessScore,
      diversityScore,
      qualityScore,
      locationRelevanceScore: locationScore
    });

    return {
      tagAffinityScore,
      socialProofScore,
      timelinessScore,
      diversityScore,
      qualityScore,
      locationRelevanceScore: locationScore,
      finalScore
    };
  }

  private combineScores(scores: Omit<ContentScore, 'finalScore'>): number {
    const weights = {
      tagAffinityScore: 0.35,      // Primary factor
      socialProofScore: 0.20,      // Community influence
      timelinessScore: 0.15,       // Recency importance
      qualityScore: 0.15,          // Content credibility
      diversityScore: 0.10,        // Avoid filter bubbles
      locationRelevanceScore: 0.05  // Geographic relevance
    };

    return Object.entries(scores).reduce((total, [key, score]) => {
      return total + (score * weights[key as keyof typeof weights]);
    }, 0);
  }
}
```

### Tag Affinity Calculation

```typescript
class TagAffinityCalculator {
  async calculateTagAffinity(
    content: FeedContent,
    userProfile: UserProfile
  ): Promise<number> {
    const contentTags = await this.getContentTags(content.id, content.type);
    let totalAffinity = 0;
    let weightSum = 0;

    for (const tag of contentTags) {
      const userAffinity = userProfile.tagAffinities.get(tag.id) || 0;
      const tagWeight = this.getTagWeight(tag.categoryLevel, tag.importance);

      totalAffinity += userAffinity * tagWeight;
      weightSum += tagWeight;
    }

    return weightSum > 0 ? totalAffinity / weightSum : 0;
  }

  private getTagWeight(categoryLevel: number, importance: number): number {
    // Higher weight for more specific tags and important categories
    const levelWeight = Math.pow(1.5, categoryLevel); // Exponential increase
    const importanceWeight = importance / 100; // Normalize importance

    return levelWeight * importanceWeight;
  }
}
```

## Collaborative Filtering Algorithm

### User Similarity Calculation

```typescript
class CollaborativeFilter {
  async findSimilarUsers(
    userId: string,
    limit: number = 50
  ): Promise<SimilarUser[]> {
    const userProfile = await this.getUserProfile(userId);
    const potentialSimilarUsers = await this.getCandidateUsers(userId);

    const similarities = await Promise.all(
      potentialSimilarUsers.map(async (candidateId) => {
        const candidateProfile = await this.getUserProfile(candidateId);
        const similarity = this.calculateCosineSimilarity(
          userProfile.tagAffinities,
          candidateProfile.tagAffinities
        );

        return {
          userId: candidateId,
          similarity,
          profile: candidateProfile
        };
      })
    );

    return similarities
      .filter(s => s.similarity > 0.3) // Minimum similarity threshold
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  private calculateCosineSimilarity(
    vectorA: Map<string, number>,
    vectorB: Map<string, number>
  ): number {
    const allKeys = new Set([...vectorA.keys(), ...vectorB.keys()]);

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (const key of allKeys) {
      const valueA = vectorA.get(key) || 0;
      const valueB = vectorB.get(key) || 0;

      dotProduct += valueA * valueB;
      magnitudeA += valueA * valueA;
      magnitudeB += valueB * valueB;
    }

    const magnitude = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
    return magnitude > 0 ? dotProduct / magnitude : 0;
  }
}
```

### Social Proof Scoring

```typescript
class SocialProofCalculator {
  async calculateSocialProof(
    content: FeedContent,
    userProfile: UserProfile
  ): Promise<number> {
    const similarUsers = await this.collaborativeFilter.findSimilarUsers(
      userProfile.userId,
      100
    );

    let totalEngagement = 0;
    let weightSum = 0;

    for (const similarUser of similarUsers) {
      const interaction = await this.getInteraction(
        similarUser.userId,
        content.id
      );

      if (interaction) {
        const engagementScore = this.getEngagementScore(interaction.type);
        const userWeight = similarUser.similarity;

        totalEngagement += engagementScore * userWeight;
        weightSum += userWeight;
      }
    }

    return weightSum > 0 ? totalEngagement / weightSum : 0;
  }

  private getEngagementScore(interactionType: string): number {
    return INTERACTION_WEIGHTS[interactionType as keyof typeof INTERACTION_WEIGHTS] || 0;
  }
}
```

## Feed Generation Algorithm

### Real-Time Feed Assembly

```typescript
class FeedGenerator {
  async generatePersonalizedFeed(
    userId: string,
    options: FeedOptions = {}
  ): Promise<PersonalizedFeed> {
    const userProfile = await this.getUserProfile(userId);
    const candidateContent = await this.getCandidateContent(userId, options);

    // Score all candidate content
    const scoredContent = await Promise.all(
      candidateContent.map(async (content) => {
        const score = await this.contentScorer.scoreContent(content, userProfile);
        return { ...content, score };
      })
    );

    // Apply diversity filters and ranking
    const diversifiedContent = await this.applyDiversityFilters(
      scoredContent,
      userProfile
    );

    // Generate final feed with metadata
    return {
      userId,
      content: diversifiedContent,
      generatedAt: new Date(),
      personalizationVersion: '1.0',
      debugInfo: this.generateDebugInfo(scoredContent, diversifiedContent)
    };
  }

  private async applyDiversityFilters(
    scoredContent: ScoredContent[],
    userProfile: UserProfile
  ): Promise<FeedContent[]> {
    const sorted = scoredContent.sort((a, b) => b.score.finalScore - a.score.finalScore);
    const diversified: FeedContent[] = [];
    const seenCategories = new Set<string>();
    const seenOrganizations = new Set<string>();

    for (const content of sorted) {
      // Ensure content type diversity
      if (this.shouldIncludeForDiversity(
        content,
        diversified,
        seenCategories,
        seenOrganizations
      )) {
        diversified.push(content);

        // Track diversity metrics
        this.updateDiversityTracking(
          content,
          seenCategories,
          seenOrganizations
        );

        if (diversified.length >= 50) break; // Feed size limit
      }
    }

    return diversified;
  }
}
```

### Content Diversity Algorithm

```typescript
class DiversityManager {
  calculateDiversityScore(
    content: FeedContent,
    userRecentFeed: FeedContent[]
  ): number {
    const contentTypeRatio = this.getContentTypeRatio(content.type, userRecentFeed);
    const organizationRatio = this.getOrganizationRatio(content.organizationId, userRecentFeed);
    const tagDiversityScore = this.getTagDiversityScore(content, userRecentFeed);

    // Penalize over-representation
    const diversityPenalty = Math.max(contentTypeRatio, organizationRatio) - 0.3;
    const penalty = diversityPenalty > 0 ? diversityPenalty * 0.5 : 0;

    return Math.max(0, tagDiversityScore - penalty);
  }

  private getContentTypeRatio(
    contentType: string,
    recentFeed: FeedContent[]
  ): number {
    const typeCount = recentFeed.filter(c => c.type === contentType).length;
    return recentFeed.length > 0 ? typeCount / recentFeed.length : 0;
  }
}
```

## Real-Time Personalization Updates

### Event-Driven Profile Updates

```typescript
class RealTimePersonalizer {
  async handleUserInteraction(interaction: UserInteraction): Promise<void> {
    // Immediate profile update
    await this.userProfileBuilder.updateProfile(
      interaction.userId,
      interaction
    );

    // Trigger feed refresh if significant interaction
    if (this.isSignificantInteraction(interaction)) {
      await this.invalidateFeedCache(interaction.userId);
      await this.precomputeNewFeed(interaction.userId);
    }

    // Update similar users' recommendations
    if (this.isSociallyRelevantInteraction(interaction)) {
      await this.updateSimilarUsersRecommendations(interaction);
    }
  }

  private isSignificantInteraction(interaction: UserInteraction): boolean {
    const significantTypes = ['DONATE', 'ATTEND_EVENT', 'FOLLOW_ORG', 'CREATE_FUNDRAISER'];
    return significantTypes.includes(interaction.type);
  }

  async precomputeNewFeed(userId: string): Promise<void> {
    const feed = await this.feedGenerator.generatePersonalizedFeed(userId);
    await this.cacheManager.setFeed(userId, feed, 3600); // 1-hour cache
  }
}
```

### Trending Content Algorithm

```typescript
class TrendingCalculator {
  async calculateTrendingScore(content: FeedContent): Promise<number> {
    const timeWindow = 24 * 60 * 60 * 1000; // 24 hours
    const now = new Date();
    const windowStart = new Date(now.getTime() - timeWindow);

    const recentInteractions = await this.getInteractions(
      content.id,
      windowStart,
      now
    );

    const interactionScore = recentInteractions.reduce((total, interaction) => {
      const weight = INTERACTION_WEIGHTS[interaction.type as keyof typeof INTERACTION_WEIGHTS];
      const timeWeight = this.getTimeWeight(interaction.createdAt, now);
      return total + (weight * timeWeight);
    }, 0);

    // Normalize by content age and baseline engagement
    const ageInHours = (now.getTime() - content.createdAt.getTime()) / (60 * 60 * 1000);
    const ageWeight = Math.max(0.1, 1 - (ageInHours / 168)); // Decay over a week

    return interactionScore * ageWeight;
  }

  private getTimeWeight(interactionTime: Date, now: Date): number {
    const hoursAgo = (now.getTime() - interactionTime.getTime()) / (60 * 60 * 1000);
    return Math.exp(-hoursAgo / 12); // Exponential decay over 12 hours
  }
}
```

## Performance Optimizations

### Caching Strategy

```typescript
interface CacheConfig {
  userProfileTTL: number;      // 30 minutes
  feedCacheTTL: number;        // 1 hour
  contentScoresTTL: number;    // 15 minutes
  similarUsersTTL: number;     // 6 hours
  trendingScoresTTL: number;   // 10 minutes
}

class PersonalizationCache {
  async getFeed(userId: string): Promise<PersonalizedFeed | null> {
    const cached = await this.redis.get(`feed:${userId}`);
    if (cached) {
      const feed = JSON.parse(cached);
      // Check if feed is still fresh enough
      if (this.isFeedFresh(feed)) {
        return feed;
      }
    }
    return null;
  }

  async setFeed(userId: string, feed: PersonalizedFeed, ttl: number): Promise<void> {
    await this.redis.setex(
      `feed:${userId}`,
      ttl,
      JSON.stringify(feed)
    );
  }
}
```

### Batch Processing

```typescript
class BatchPersonalizationProcessor {
  async processBatch(userIds: string[]): Promise<void> {
    const batchSize = 100;

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);

      await Promise.all(
        batch.map(userId => this.processUserPersonalization(userId))
      );

      // Brief pause between batches to avoid overwhelming the system
      await this.sleep(100);
    }
  }

  private async processUserPersonalization(userId: string): Promise<void> {
    try {
      await this.realTimePersonalizer.precomputeNewFeed(userId);
    } catch (error) {
      console.error(`Failed to process personalization for user ${userId}:`, error);
      // Continue processing other users
    }
  }
}
```

## Algorithm Evaluation and A/B Testing

### Metrics Tracking

```typescript
interface PersonalizationMetrics {
  feedEngagementRate: number;   // CTR on recommended content
  diversityScore: number;       // Content type and source diversity
  userSatisfactionScore: number; // Based on implicit feedback
  algorithmLatency: number;     // Time to generate personalized feed
  cacheHitRate: number;         // Efficiency metric
}

class PersonalizationAnalytics {
  async trackFeedPerformance(
    userId: string,
    feed: PersonalizedFeed,
    interactions: UserInteraction[]
  ): Promise<PersonalizationMetrics> {
    const engagementRate = this.calculateEngagementRate(feed, interactions);
    const diversityScore = this.calculateFeedDiversity(feed);
    const satisfactionScore = await this.calculateSatisfactionScore(userId, interactions);

    return {
      feedEngagementRate: engagementRate,
      diversityScore,
      userSatisfactionScore: satisfactionScore,
      algorithmLatency: feed.metadata?.processingTime || 0,
      cacheHitRate: await this.getCacheHitRate(userId)
    };
  }
}
```

### A/B Testing Framework

```typescript
interface AlgorithmVariant {
  id: string;
  name: string;
  config: PersonalizationConfig;
  trafficPercentage: number;
}

class PersonalizationExperimentManager {
  private variants: AlgorithmVariant[] = [
    {
      id: 'baseline',
      name: 'Current Algorithm',
      config: { /* current config */ },
      trafficPercentage: 70
    },
    {
      id: 'enhanced_diversity',
      name: 'Enhanced Diversity',
      config: { /* enhanced diversity config */ },
      trafficPercentage: 30
    }
  ];

  async getAlgorithmForUser(userId: string): Promise<AlgorithmVariant> {
    const hash = this.hashUserId(userId);
    const bucket = hash % 100;

    let cumulativePercentage = 0;
    for (const variant of this.variants) {
      cumulativePercentage += variant.trafficPercentage;
      if (bucket < cumulativePercentage) {
        return variant;
      }
    }

    return this.variants[0]; // Fallback to baseline
  }
}
```

## Privacy and Ethical Considerations

### Privacy-Preserving Personalization

```typescript
class PrivacyAwarePersonalizer {
  async generateFeedWithPrivacy(userId: string): Promise<PersonalizedFeed> {
    const userProfile = await this.getUserProfileWithPrivacy(userId);

    // Apply differential privacy to user preferences
    const noisyProfile = this.addDifferentialPrivacyNoise(userProfile);

    // Generate feed using privacy-preserving profile
    return this.feedGenerator.generatePersonalizedFeed(userId, {
      profile: noisyProfile,
      privacyMode: true
    });
  }

  private addDifferentialPrivacyNoise(profile: UserProfile): UserProfile {
    const epsilon = 1.0; // Privacy parameter
    const noiseScale = 1.0 / epsilon;

    const noisyAffinities = new Map();
    for (const [tagId, affinity] of profile.tagAffinities) {
      const noise = this.generateLaplaceNoise(noiseScale);
      const noisyAffinity = Math.max(0, Math.min(1, affinity + noise));
      noisyAffinities.set(tagId, noisyAffinity);
    }

    return { ...profile, tagAffinities: noisyAffinities };
  }
}
```

### Algorithm Bias Mitigation

```typescript
class BiasDetectionManager {
  async analyzeAlgorithmBias(): Promise<BiasReport> {
    const demographics = await this.getDemographicGroups();
    const biasMetrics = await Promise.all(
      demographics.map(group => this.analyzeDemographicBias(group))
    );

    return {
      overallBiasScore: this.calculateOverallBias(biasMetrics),
      demographicBiases: biasMetrics,
      recommendations: this.generateBiasMitigationRecommendations(biasMetrics),
      generatedAt: new Date()
    };
  }

  private async analyzeDemographicBias(
    demographic: DemographicGroup
  ): Promise<DemographicBiasMetrics> {
    const users = await this.getUsersByDemographic(demographic);
    const feedAnalysis = await this.analyzeFeedsForBias(users);

    return {
      demographic,
      contentDiversityScore: feedAnalysis.diversityScore,
      representationScore: feedAnalysis.representationScore,
      engagementParity: feedAnalysis.engagementParity
    };
  }
}
```

This comprehensive personalization system ensures that users receive highly relevant, diverse, and engaging content while maintaining privacy and fairness standards. The algorithms continuously learn and adapt to provide increasingly better recommendations over time.