# Content Discovery and Recommendation Engine

## Overview

The content discovery system enables users to explore and find relevant political content beyond their personalized feeds through advanced search, trending analysis, and intelligent recommendations. This engine powers discoverability across Events, Fundraisers, and Organizations while maintaining compliance with political content regulations.

## Discovery Architecture

### Core Discovery Components

```typescript
interface DiscoveryEngine {
  searchEngine: SearchEngine;
  trendingAnalyzer: TrendingAnalyzer;
  recommendationEngine: RecommendationEngine;
  exploreEngine: ExploreEngine;
  complianceFilter: ComplianceFilter;
}

interface DiscoveryRequest {
  userId?: string;
  query?: string;
  filters: DiscoveryFilters;
  context: DiscoveryContext;
  pagination: PaginationOptions;
}

interface DiscoveryFilters {
  contentTypes: ContentType[];
  tags: string[];
  location: GeographicFilter;
  dateRange: DateRange;
  organizationType: OrganizationType[];
  fundingGoals: FundingRange;
  complianceLevel: ComplianceLevel;
}
```

### Discovery Flow

1. **Query Processing** → Parse and enhance user queries
2. **Context Analysis** → Understand user intent and preferences
3. **Content Retrieval** → Multi-source content aggregation
4. **Relevance Scoring** → Advanced ranking algorithms
5. **Compliance Filtering** → Political content compliance validation
6. **Result Diversification** → Ensure varied, balanced results
7. **Response Generation** → Structured, enriched results

## Advanced Search Engine

### Query Processing and Enhancement

```typescript
class SearchQueryProcessor {
  async processQuery(rawQuery: string, context: SearchContext): Promise<ProcessedQuery> {
    const cleanedQuery = this.sanitizeQuery(rawQuery);
    const expandedQuery = await this.expandQuery(cleanedQuery, context);
    const structuredQuery = this.structureQuery(expandedQuery);

    return {
      original: rawQuery,
      cleaned: cleanedQuery,
      expanded: expandedQuery,
      structured: structuredQuery,
      intent: await this.detectIntent(cleanedQuery),
      entities: await this.extractEntities(cleanedQuery),
      synonyms: await this.generateSynonyms(cleanedQuery)
    };
  }

  private async expandQuery(query: string, context: SearchContext): Promise<string> {
    // Add political context expansions
    const politicalExpansions = await this.getPoliticalExpansions(query);

    // Add location-based expansions
    const locationExpansions = context.userLocation
      ? await this.getLocationExpansions(query, context.userLocation)
      : [];

    // Add temporal expansions for campaigns, elections
    const temporalExpansions = await this.getTemporalExpansions(query);

    return [query, ...politicalExpansions, ...locationExpansions, ...temporalExpansions]
      .join(' OR ');
  }

  private async detectIntent(query: string): Promise<SearchIntent> {
    const intentPatterns = {
      DONATE: /donate|contribution|support|fund|give/i,
      EVENT: /event|rally|meeting|conference|gathering/i,
      CANDIDATE: /candidate|campaign|election|vote|ballot/i,
      CAUSE: /cause|issue|policy|reform|advocacy/i,
      ORGANIZATION: /organization|committee|pac|party|group/i,
      LOCAL: /local|city|county|state|district|area/i
    };

    for (const [intent, pattern] of Object.entries(intentPatterns)) {
      if (pattern.test(query)) {
        return intent as SearchIntent;
      }
    }

    return 'GENERAL';
  }
}
```

### Multi-Index Search Strategy

```typescript
class MultiIndexSearchEngine {
  private readonly indexes = {
    content: 'content_search_index',
    tags: 'tag_search_index',
    organizations: 'organization_search_index',
    locations: 'location_search_index',
    people: 'people_search_index'
  };

  async executeSearch(processedQuery: ProcessedQuery): Promise<SearchResults> {
    const searches = await Promise.all([
      this.searchContentIndex(processedQuery),
      this.searchTagIndex(processedQuery),
      this.searchOrganizationIndex(processedQuery),
      this.searchLocationIndex(processedQuery),
      this.searchPeopleIndex(processedQuery)
    ]);

    const mergedResults = this.mergeSearchResults(searches);
    const rankedResults = await this.rankResults(mergedResults, processedQuery);

    return {
      results: rankedResults,
      facets: this.generateFacets(mergedResults),
      suggestions: await this.generateSuggestions(processedQuery),
      totalCount: mergedResults.length,
      searchTime: Date.now() - processedQuery.startTime
    };
  }

  private async searchContentIndex(query: ProcessedQuery): Promise<ContentResult[]> {
    const searchQuery = {
      query: {
        bool: {
          should: [
            {
              multi_match: {
                query: query.cleaned,
                fields: [
                  'title^3',
                  'description^2',
                  'content',
                  'tags.name^2'
                ],
                type: 'best_fields',
                fuzziness: 'AUTO'
              }
            },
            {
              nested: {
                path: 'tags',
                query: {
                  bool: {
                    should: query.entities.map(entity => ({
                      match: { 'tags.name': entity }
                    }))
                  }
                }
              }
            }
          ]
        }
      },
      highlight: {
        fields: {
          title: {},
          description: {},
          content: {}
        }
      }
    };

    return this.elasticsearch.search(searchQuery);
  }
}
```

### Search Result Ranking

```typescript
class SearchResultRanker {
  async rankResults(
    results: SearchResult[],
    query: ProcessedQuery,
    userContext?: UserContext
  ): Promise<RankedResult[]> {
    const scoredResults = await Promise.all(
      results.map(async (result) => {
        const relevanceScore = this.calculateRelevanceScore(result, query);
        const qualityScore = await this.calculateQualityScore(result);
        const freshnessScore = this.calculateFreshnessScore(result);
        const popularityScore = await this.calculatePopularityScore(result);
        const personalScore = userContext
          ? await this.calculatePersonalizationScore(result, userContext)
          : 0;

        const finalScore = this.combineScores({
          relevanceScore,
          qualityScore,
          freshnessScore,
          popularityScore,
          personalScore
        });

        return {
          ...result,
          scores: {
            relevanceScore,
            qualityScore,
            freshnessScore,
            popularityScore,
            personalScore,
            finalScore
          }
        };
      })
    );

    return scoredResults.sort((a, b) => b.scores.finalScore - a.scores.finalScore);
  }

  private combineScores(scores: SearchScores): number {
    const weights = {
      relevanceScore: 0.4,      // Primary search relevance
      qualityScore: 0.2,        // Content quality and credibility
      freshnessScore: 0.15,     // Recency importance
      popularityScore: 0.15,    // Community engagement
      personalScore: 0.1        // User personalization
    };

    return Object.entries(scores).reduce((total, [key, score]) => {
      return total + (score * weights[key as keyof SearchScores]);
    }, 0);
  }
}
```

## Trending Analysis Engine

### Multi-Dimensional Trending Algorithm

```typescript
class TrendingAnalyzer {
  async calculateTrendingContent(
    timeWindow: TrendingTimeWindow = '24h'
  ): Promise<TrendingContent[]> {
    const content = await this.getCandidateContent(timeWindow);

    const trendingScores = await Promise.all(
      content.map(async (item) => {
        const velocityScore = await this.calculateVelocityScore(item, timeWindow);
        const amplificationScore = await this.calculateAmplificationScore(item);
        const qualityScore = await this.calculateQualityScore(item);
        const diversityScore = this.calculateDiversityScore(item);
        const complianceScore = await this.calculateComplianceScore(item);

        const finalScore = this.combineTrendingScores({
          velocityScore,
          amplificationScore,
          qualityScore,
          diversityScore,
          complianceScore
        });

        return {
          ...item,
          trendingScore: finalScore,
          trendingFactors: {
            velocityScore,
            amplificationScore,
            qualityScore,
            diversityScore,
            complianceScore
          }
        };
      })
    );

    return trendingScores
      .filter(item => item.trendingScore > 0.5) // Minimum threshold
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, 50); // Top trending items
  }

  private async calculateVelocityScore(
    content: Content,
    timeWindow: TrendingTimeWindow
  ): Promise<number> {
    const windowMs = this.getTimeWindowMs(timeWindow);
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMs);

    const interactions = await this.getInteractions(content.id, windowStart, now);

    // Calculate interaction velocity
    const interactionCount = interactions.length;
    const baselineCount = await this.getBaselineInteractions(content.id, windowMs);

    // Velocity is the ratio of current interactions to baseline
    const velocity = baselineCount > 0 ? interactionCount / baselineCount : interactionCount;

    // Apply sigmoid function to normalize
    return Math.min(1, velocity / (1 + velocity));
  }

  private async calculateAmplificationScore(content: Content): Promise<number> {
    const shares = await this.getShares(content.id);
    const mentions = await this.getMentions(content.id);
    const crossPlatformActivity = await this.getCrossPlatformActivity(content.id);

    // Weighted amplification score
    const shareWeight = 0.4;
    const mentionWeight = 0.3;
    const crossPlatformWeight = 0.3;

    const normalizedShares = Math.min(1, shares.length / 100); // Normalize to 0-1
    const normalizedMentions = Math.min(1, mentions.length / 50);
    const normalizedCrossPlatform = Math.min(1, crossPlatformActivity / 10);

    return (
      normalizedShares * shareWeight +
      normalizedMentions * mentionWeight +
      normalizedCrossPlatform * crossPlatformWeight
    );
  }
}
```

### Real-Time Trending Updates

```typescript
class RealTimeTrendingProcessor {
  private trendingCache = new Map<string, TrendingContent[]>();
  private updateQueue = new Queue<TrendingUpdate>();

  async processInteraction(interaction: UserInteraction): Promise<void> {
    // Add to update queue for batch processing
    this.updateQueue.enqueue({
      contentId: interaction.contentId,
      interactionType: interaction.type,
      timestamp: interaction.createdAt,
      userId: interaction.userId
    });

    // Process high-impact interactions immediately
    if (this.isHighImpactInteraction(interaction)) {
      await this.processImmediateUpdate(interaction);
    }
  }

  private async processImmediateUpdate(interaction: UserInteraction): Promise<void> {
    const content = await this.getContent(interaction.contentId);
    const updatedScore = await this.trendingAnalyzer.calculateTrendingScore(content);

    // Update cache if score changed significantly
    if (this.isSignificantScoreChange(content.id, updatedScore)) {
      await this.updateTrendingCache(content.id, updatedScore);

      // Notify relevant users about trending content
      await this.notifyTrendingContent(content, updatedScore);
    }
  }

  async batchProcessUpdates(): Promise<void> {
    const batchSize = 100;
    const batch = [];

    while (batch.length < batchSize && !this.updateQueue.isEmpty()) {
      batch.push(this.updateQueue.dequeue());
    }

    if (batch.length > 0) {
      await this.processTrendingBatch(batch);
    }
  }
}
```

## Recommendation Engine

### Hybrid Recommendation System

```typescript
class HybridRecommendationEngine {
  async generateRecommendations(
    userId: string,
    context: RecommendationContext
  ): Promise<Recommendations> {
    const userProfile = await this.getUserProfile(userId);

    // Generate recommendations from multiple sources
    const [
      contentBasedRecs,
      collaborativeRecs,
      trendingRecs,
      locationBasedRecs,
      serendipityRecs
    ] = await Promise.all([
      this.generateContentBasedRecommendations(userProfile),
      this.generateCollaborativeRecommendations(userId),
      this.generateTrendingRecommendations(userProfile),
      this.generateLocationBasedRecommendations(userProfile),
      this.generateSerendipityRecommendations(userProfile)
    ]);

    // Combine and balance different recommendation sources
    const hybridRecommendations = this.combineRecommendations({
      contentBased: contentBasedRecs,
      collaborative: collaborativeRecs,
      trending: trendingRecs,
      locationBased: locationBasedRecs,
      serendipity: serendipityRecs
    });

    // Apply diversity and compliance filters
    const filteredRecommendations = await this.applyFilters(
      hybridRecommendations,
      userProfile
    );

    return {
      recommendations: filteredRecommendations,
      explanations: this.generateExplanations(filteredRecommendations),
      metadata: {
        algorithm: 'hybrid_v1.0',
        sources: ['content', 'collaborative', 'trending', 'location', 'serendipity'],
        generatedAt: new Date()
      }
    };
  }

  private combineRecommendations(
    sources: RecommendationSources
  ): WeightedRecommendation[] {
    const weights = {
      contentBased: 0.35,    // Strong weight for content similarity
      collaborative: 0.25,   // User similarity importance
      trending: 0.20,        // Current popular content
      locationBased: 0.15,   // Local relevance
      serendipity: 0.05      // Discovery and exploration
    };

    const combined = new Map<string, WeightedRecommendation>();

    // Combine recommendations with weights
    Object.entries(sources).forEach(([source, recommendations]) => {
      const weight = weights[source as keyof RecommendationSources];

      recommendations.forEach(rec => {
        const existing = combined.get(rec.contentId);
        if (existing) {
          existing.score += rec.score * weight;
          existing.sources.add(source);
        } else {
          combined.set(rec.contentId, {
            ...rec,
            score: rec.score * weight,
            sources: new Set([source])
          });
        }
      });
    });

    return Array.from(combined.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 100); // Limit recommendations
  }
}
```

### Content-Based Recommendations

```typescript
class ContentBasedRecommender {
  async generateRecommendations(
    userProfile: UserProfile
  ): Promise<ContentRecommendation[]> {
    const userTagVector = this.createTagVector(userProfile.tagAffinities);
    const candidateContent = await this.getCandidateContent();

    const recommendations = await Promise.all(
      candidateContent.map(async (content) => {
        const contentTagVector = await this.createContentTagVector(content);
        const similarity = this.calculateCosineSimilarity(
          userTagVector,
          contentTagVector
        );

        return {
          contentId: content.id,
          content,
          score: similarity,
          reasoning: this.generateContentBasedReasoning(content, userProfile)
        };
      })
    );

    return recommendations
      .filter(rec => rec.score > 0.3) // Minimum similarity threshold
      .sort((a, b) => b.score - a.score);
  }

  private async createContentTagVector(content: Content): Promise<TagVector> {
    const contentTags = await this.getContentTags(content.id, content.type);
    const vector = new Map<string, number>();

    for (const tag of contentTags) {
      const weight = this.calculateTagWeight(tag);
      vector.set(tag.id, weight);
    }

    return vector;
  }

  private calculateTagWeight(tag: ContentTag): number {
    // Weight based on tag importance and category level
    const importanceWeight = tag.importance / 100;
    const levelWeight = Math.pow(0.8, tag.categoryLevel); // Decrease weight for deeper levels

    return importanceWeight * levelWeight;
  }
}
```

## Explore Engine

### Curated Discovery Experience

```typescript
class ExploreEngine {
  async generateExploreContent(
    userId?: string,
    exploreType: ExploreType = 'MIXED'
  ): Promise<ExploreContent> {
    const userContext = userId ? await this.getUserContext(userId) : null;

    const sections = await Promise.all([
      this.generateTrendingSection(userContext),
      this.generateLocalSection(userContext),
      this.generateCauseBasedSection(userContext),
      this.generateUpcomingEventsSection(userContext),
      this.generateNewOrganizationsSection(userContext),
      this.generateSeasonalSection(userContext)
    ]);

    return {
      sections: sections.filter(section => section.content.length > 0),
      refreshedAt: new Date(),
      personalized: !!userId
    };
  }

  private async generateTrendingSection(
    userContext?: UserContext
  ): Promise<ExploreSection> {
    const trendingContent = await this.trendingAnalyzer.calculateTrendingContent('24h');

    // Filter by user interests if available
    const filteredContent = userContext
      ? this.filterByUserInterests(trendingContent, userContext)
      : trendingContent;

    return {
      title: 'Trending Now',
      description: 'Popular political content from the past 24 hours',
      type: 'TRENDING',
      content: filteredContent.slice(0, 10),
      refreshInterval: 300000 // 5 minutes
    };
  }

  private async generateLocalSection(
    userContext?: UserContext
  ): Promise<ExploreSection> {
    if (!userContext?.location) {
      return { title: 'Local', content: [], type: 'LOCAL' };
    }

    const localContent = await this.getLocalContent(
      userContext.location,
      50 // 50 mile radius
    );

    const rankedContent = this.rankByLocalRelevance(
      localContent,
      userContext.location
    );

    return {
      title: `In Your Area (${userContext.location.city})`,
      description: 'Political activities and organizations near you',
      type: 'LOCAL',
      content: rankedContent.slice(0, 8)
    };
  }

  private async generateCauseBasedSection(
    userContext?: UserContext
  ): Promise<ExploreSection> {
    const topCauses = userContext
      ? this.extractTopCauses(userContext.userProfile)
      : await this.getPopularCauses();

    const causeContent = await Promise.all(
      topCauses.slice(0, 3).map(async cause => {
        const content = await this.getContentByTag(cause.tagId, 3);
        return {
          causeName: cause.name,
          content
        };
      })
    );

    const flatContent = causeContent.flatMap(cc => cc.content);

    return {
      title: 'Issues You Care About',
      description: 'Content related to your interests',
      type: 'CAUSE_BASED',
      content: flatContent.slice(0, 12)
    };
  }
}
```

### Serendipity and Discovery

```typescript
class SerendipityEngine {
  async generateSerendipitousRecommendations(
    userProfile: UserProfile
  ): Promise<SerendipityRecommendation[]> {
    // Generate content that's outside normal preferences but potentially interesting
    const unexploredTags = await this.findUnexploredTags(userProfile);
    const emergingTopics = await this.findEmergingTopics();
    const crossPoliticalSpectrum = await this.findCrossPoliticalContent(userProfile);

    const serendipityContent = [
      ...await this.getContentByTags(unexploredTags, 5),
      ...await this.getContentByTopics(emergingTopics, 5),
      ...crossPoliticalSpectrum.slice(0, 3)
    ];

    return serendipityContent.map(content => ({
      ...content,
      serendipityReason: this.generateSerendipityReason(content, userProfile),
      explorationScore: this.calculateExplorationScore(content, userProfile)
    }));
  }

  private async findUnexploredTags(userProfile: UserProfile): Promise<string[]> {
    const userTags = new Set(userProfile.tagAffinities.keys());
    const relatedTags = await this.findRelatedTags([...userTags]);

    // Find tags that are related but unexplored
    return relatedTags.filter(tag => !userTags.has(tag));
  }

  private async findEmergingTopics(): Promise<string[]> {
    const timeWindow = 7 * 24 * 60 * 60 * 1000; // 7 days
    const recentInteractions = await this.getRecentInteractions(timeWindow);

    // Analyze tag frequency growth
    const tagGrowth = this.analyzeTagGrowth(recentInteractions);

    return tagGrowth
      .filter(growth => growth.growthRate > 1.5) // 50% growth
      .map(growth => growth.tagId);
  }

  private generateSerendipityReason(
    content: Content,
    userProfile: UserProfile
  ): string {
    // Generate human-readable explanation for why this content might be interesting
    const contentTags = content.tags || [];
    const userTags = [...userProfile.tagAffinities.keys()];

    const similarTags = contentTags.filter(tag => userTags.includes(tag.id));

    if (similarTags.length > 0) {
      return `Because you're interested in ${similarTags[0].name}`;
    }

    return 'Discover something new in politics';
  }
}
```

## Compliance and Safety Filtering

### Political Content Compliance

```typescript
class DiscoveryComplianceFilter {
  async filterContent(
    content: Content[],
    userProfile: UserProfile
  ): Promise<FilteredContent[]> {
    const complianceChecks = await Promise.all(
      content.map(async (item) => {
        const compliance = await this.checkCompliance(item, userProfile);
        return { ...item, compliance };
      })
    );

    // Filter out non-compliant content
    const compliantContent = complianceChecks.filter(
      item => item.compliance.isCompliant
    );

    // Add warning labels where appropriate
    return compliantContent.map(item => ({
      ...item,
      warnings: this.generateWarnings(item.compliance)
    }));
  }

  private async checkCompliance(
    content: Content,
    userProfile: UserProfile
  ): Promise<ComplianceCheck> {
    const checks = await Promise.all([
      this.checkAgeRestrictions(content, userProfile),
      this.checkGeographicRestrictions(content, userProfile),
      this.checkFundingRestrictions(content, userProfile),
      this.checkContentModeration(content),
      this.checkElectionLawCompliance(content, userProfile)
    ]);

    const isCompliant = checks.every(check => check.passed);
    const warnings = checks.flatMap(check => check.warnings || []);

    return {
      isCompliant,
      warnings,
      checks
    };
  }

  private async checkElectionLawCompliance(
    content: Content,
    userProfile: UserProfile
  ): Promise<ComplianceResult> {
    // Check various election law requirements
    const blackoutPeriod = await this.isInElectionBlackoutPeriod(
      content.location,
      content.createdAt
    );

    const foreignNationalRestrictions = await this.checkForeignNationalRestrictions(
      content,
      userProfile
    );

    const disclosureRequirements = await this.checkDisclosureRequirements(content);

    return {
      passed: !blackoutPeriod && foreignNationalRestrictions && disclosureRequirements,
      warnings: [
        ...(blackoutPeriod ? ['Content restricted during election blackout period'] : []),
        ...(disclosureRequirements ? [] : ['Missing required disclosure information'])
      ]
    };
  }
}
```

## Performance and Caching

### Multi-Layer Caching Strategy

```typescript
class DiscoveryCacheManager {
  private readonly cacheConfig = {
    searchResults: 300,      // 5 minutes
    trendingContent: 600,    // 10 minutes
    userRecommendations: 1800, // 30 minutes
    exploreContent: 900,     // 15 minutes
    complianceChecks: 3600   // 1 hour
  };

  async getCachedSearchResults(
    queryHash: string,
    userContext?: UserContext
  ): Promise<SearchResults | null> {
    const cacheKey = this.generateSearchCacheKey(queryHash, userContext);
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      const results = JSON.parse(cached);

      // Check if results are still fresh
      if (this.isCacheFresh(results.timestamp, this.cacheConfig.searchResults)) {
        return results;
      }
    }

    return null;
  }

  async cacheSearchResults(
    queryHash: string,
    results: SearchResults,
    userContext?: UserContext
  ): Promise<void> {
    const cacheKey = this.generateSearchCacheKey(queryHash, userContext);
    const cacheData = {
      ...results,
      timestamp: Date.now()
    };

    await this.redis.setex(
      cacheKey,
      this.cacheConfig.searchResults,
      JSON.stringify(cacheData)
    );
  }

  private generateSearchCacheKey(
    queryHash: string,
    userContext?: UserContext
  ): string {
    const contextHash = userContext
      ? this.hashUserContext(userContext)
      : 'anonymous';

    return `search:${queryHash}:${contextHash}`;
  }
}
```

### Search Index Optimization

```typescript
class SearchIndexOptimizer {
  async optimizeIndexes(): Promise<void> {
    await Promise.all([
      this.optimizeContentIndex(),
      this.optimizeTagIndex(),
      this.optimizeLocationIndex(),
      this.updateSearchStatistics()
    ]);
  }

  private async optimizeContentIndex(): Promise<void> {
    // Update index mappings for better search performance
    const mapping = {
      properties: {
        title: {
          type: 'text',
          analyzer: 'political_content_analyzer',
          fields: {
            keyword: { type: 'keyword' },
            completion: { type: 'completion' }
          }
        },
        description: {
          type: 'text',
          analyzer: 'political_content_analyzer'
        },
        tags: {
          type: 'nested',
          properties: {
            id: { type: 'keyword' },
            name: {
              type: 'text',
              analyzer: 'tag_analyzer',
              fields: { keyword: { type: 'keyword' } }
            },
            category: { type: 'keyword' },
            importance: { type: 'integer' }
          }
        },
        location: {
          type: 'geo_point'
        },
        created_at: {
          type: 'date'
        },
        trending_score: {
          type: 'float'
        }
      }
    };

    await this.elasticsearch.indices.putMapping({
      index: 'content_search_index',
      body: mapping
    });
  }

  private async createCustomAnalyzers(): Promise<void> {
    const settings = {
      analysis: {
        analyzer: {
          political_content_analyzer: {
            type: 'custom',
            tokenizer: 'standard',
            filter: [
              'lowercase',
              'political_synonyms',
              'english_stop',
              'english_stemmer'
            ]
          },
          tag_analyzer: {
            type: 'custom',
            tokenizer: 'keyword',
            filter: ['lowercase', 'political_synonyms']
          }
        },
        filter: {
          political_synonyms: {
            type: 'synonym',
            synonyms: [
              'democrat,democratic,dem',
              'republican,gop,conservative',
              'liberal,progressive,left',
              'conservative,right,traditional'
            ]
          },
          english_stop: {
            type: 'stop',
            stopwords: '_english_'
          },
          english_stemmer: {
            type: 'stemmer',
            language: 'english'
          }
        }
      }
    };

    await this.elasticsearch.indices.putSettings({
      index: 'content_search_index',
      body: settings
    });
  }
}
```

## Analytics and Optimization

### Discovery Analytics

```typescript
class DiscoveryAnalytics {
  async trackDiscoveryEvent(event: DiscoveryEvent): Promise<void> {
    await this.analytics.track({
      event: 'discovery_interaction',
      userId: event.userId,
      properties: {
        discoveryType: event.type,
        contentId: event.contentId,
        searchQuery: event.query,
        resultPosition: event.position,
        interactionType: event.interaction
      },
      timestamp: new Date()
    });

    // Update recommendation model with implicit feedback
    if (event.interaction === 'ENGAGE') {
      await this.updateRecommendationModel(event);
    }
  }

  async generateDiscoveryReport(): Promise<DiscoveryReport> {
    const timeRange = { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), end: new Date() };

    const [
      searchMetrics,
      recommendationMetrics,
      trendingMetrics,
      userEngagement
    ] = await Promise.all([
      this.getSearchMetrics(timeRange),
      this.getRecommendationMetrics(timeRange),
      this.getTrendingMetrics(timeRange),
      this.getUserEngagementMetrics(timeRange)
    ]);

    return {
      period: timeRange,
      searchMetrics,
      recommendationMetrics,
      trendingMetrics,
      userEngagement,
      keyInsights: this.generateKeyInsights({
        searchMetrics,
        recommendationMetrics,
        trendingMetrics,
        userEngagement
      })
    };
  }

  private generateKeyInsights(metrics: DiscoveryMetrics): string[] {
    const insights = [];

    if (metrics.searchMetrics.zeroResultsRate > 0.15) {
      insights.push('High zero-results rate indicates need for better query understanding');
    }

    if (metrics.recommendationMetrics.clickThroughRate < 0.05) {
      insights.push('Low recommendation CTR suggests need for algorithm tuning');
    }

    if (metrics.trendingMetrics.diversityScore < 0.7) {
      insights.push('Trending content lacks diversity across political spectrum');
    }

    return insights;
  }
}
```

This comprehensive discovery and recommendation system enables users to find relevant political content through multiple pathways while ensuring compliance with political content regulations and maintaining high-quality, diverse results.