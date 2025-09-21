import { createClient, RedisClientType } from 'redis';
import { config } from '../config/index.js';
import { SessionData } from '../types/auth.js';
import crypto from 'crypto';

class SessionManager {
  private redis: RedisClientType;
  private readonly sessionTTL = config.security.sessionTtlHours * 60 * 60; // Convert to seconds
  private readonly maxInactivity = 2 * 60 * 60; // 2 hours in seconds

  constructor() {
    this.redis = createClient({ url: config.redis.url });
    this.redis.on('error', (err) => console.error('Redis Client Error', err));
    this.redis.connect();
  }

  async createSession(sessionData: Omit<SessionData, 'lastActivity'>): Promise<string> {
    const sessionId = this.generateSessionId();
    const session: SessionData = {
      ...sessionData,
      lastActivity: new Date()
    };

    const sessionKey = this.getSessionKey(sessionId);
    await this.redis.setEx(
      sessionKey,
      this.sessionTTL,
      JSON.stringify(session)
    );

    // Track user sessions for concurrent session management
    const userSessionsKey = this.getUserSessionsKey(sessionData.userId);
    await this.redis.sAdd(userSessionsKey, sessionId);
    await this.redis.expire(userSessionsKey, this.sessionTTL);

    return sessionId;
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      const sessionKey = this.getSessionKey(sessionId);
      const sessionData = await this.redis.get(sessionKey);

      if (!sessionData) return null;

      const session: SessionData = JSON.parse(sessionData);
      session.lastActivity = new Date(session.lastActivity);

      // Check if session is still valid based on activity
      const timeSinceActivity = Date.now() - session.lastActivity.getTime();

      if (timeSinceActivity > this.maxInactivity * 1000) {
        await this.destroySession(sessionId);
        return null;
      }

      return session;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }

  async updateSessionActivity(sessionId: string, additionalData?: Partial<SessionData>): Promise<boolean> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) return false;

      const updatedSession: SessionData = {
        ...session,
        ...additionalData,
        lastActivity: new Date()
      };

      const sessionKey = this.getSessionKey(sessionId);
      await this.redis.setEx(
        sessionKey,
        this.sessionTTL,
        JSON.stringify(updatedSession)
      );

      return true;
    } catch (error) {
      console.error('Error updating session activity:', error);
      return false;
    }
  }

  async extendSession(sessionId: string): Promise<boolean> {
    try {
      const sessionKey = this.getSessionKey(sessionId);
      const exists = await this.redis.exists(sessionKey);

      if (exists) {
        await this.redis.expire(sessionKey, this.sessionTTL);
        await this.updateSessionActivity(sessionId);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error extending session:', error);
      return false;
    }
  }

  async destroySession(sessionId: string): Promise<void> {
    try {
      const session = await this.getSession(sessionId);

      const sessionKey = this.getSessionKey(sessionId);
      await this.redis.del(sessionKey);

      // Remove from user sessions set
      if (session) {
        const userSessionsKey = this.getUserSessionsKey(session.userId);
        await this.redis.sRem(userSessionsKey, sessionId);
      }
    } catch (error) {
      console.error('Error destroying session:', error);
    }
  }

  async destroyAllUserSessions(userId: string): Promise<void> {
    try {
      const userSessionsKey = this.getUserSessionsKey(userId);
      const sessionIds = await this.redis.sMembers(userSessionsKey);

      if (sessionIds.length > 0) {
        // Delete all session keys
        const sessionKeys = sessionIds.map(id => this.getSessionKey(id));
        await this.redis.del(sessionKeys);

        // Clear the user sessions set
        await this.redis.del(userSessionsKey);
      }
    } catch (error) {
      console.error('Error destroying all user sessions:', error);
    }
  }

  async getActiveSessions(userId: string): Promise<SessionData[]> {
    try {
      const userSessionsKey = this.getUserSessionsKey(userId);
      const sessionIds = await this.redis.sMembers(userSessionsKey);

      const sessions: SessionData[] = [];

      for (const sessionId of sessionIds) {
        const session = await this.getSession(sessionId);
        if (session) {
          sessions.push(session);
        } else {
          // Clean up invalid session reference
          await this.redis.sRem(userSessionsKey, sessionId);
        }
      }

      return sessions.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
    } catch (error) {
      console.error('Error getting active sessions:', error);
      return [];
    }
  }

  async limitConcurrentSessions(userId: string, maxSessions: number = 5): Promise<void> {
    try {
      const sessions = await this.getActiveSessions(userId);

      if (sessions.length > maxSessions) {
        // Sort by last activity and remove oldest sessions
        const sessionsToRemove = sessions
          .sort((a, b) => a.lastActivity.getTime() - b.lastActivity.getTime())
          .slice(0, sessions.length - maxSessions);

        for (const session of sessionsToRemove) {
          // Find session ID by matching session data
          const userSessionsKey = this.getUserSessionsKey(userId);
          const sessionIds = await this.redis.sMembers(userSessionsKey);

          for (const sessionId of sessionIds) {
            const currentSession = await this.getSession(sessionId);
            if (currentSession &&
                currentSession.lastActivity.getTime() === session.lastActivity.getTime()) {
              await this.destroySession(sessionId);
              break;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error limiting concurrent sessions:', error);
    }
  }

  async isSessionValid(sessionId: string, ipAddress?: string, userAgent?: string): Promise<boolean> {
    const session = await this.getSession(sessionId);

    if (!session) return false;

    // Optional: Check IP address consistency (can be disabled for mobile users)
    if (ipAddress && session.ipAddress && session.ipAddress !== ipAddress) {
      // Log suspicious activity but don't invalidate immediately
      console.warn('IP address changed for session:', sessionId, {
        original: session.ipAddress,
        current: ipAddress
      });
    }

    // Optional: Check user agent consistency
    if (userAgent && session.userAgent && session.userAgent !== userAgent) {
      console.warn('User agent changed for session:', sessionId);
    }

    return true;
  }

  async flagSuspiciousSession(sessionId: string, reason: string): Promise<void> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) return;

      const flags = session.sessionFlags || [];
      flags.push(`suspicious:${reason}:${new Date().toISOString()}`);

      await this.updateSessionActivity(sessionId, { sessionFlags: flags });

      // Log security event
      console.warn('Session flagged as suspicious:', {
        sessionId,
        userId: session.userId,
        reason,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error flagging suspicious session:', error);
    }
  }

  private generateSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private getSessionKey(sessionId: string): string {
    return `advotecate:session:${sessionId}`;
  }

  private getUserSessionsKey(userId: string): string {
    return `advotecate:user_sessions:${userId}`;
  }

  // Cleanup expired sessions (run periodically)
  async cleanupExpiredSessions(): Promise<{ cleaned: number; errors: number }> {
    let cleaned = 0;
    let errors = 0;

    try {
      const pattern = 'advotecate:session:*';
      const keys = await this.redis.keys(pattern);

      for (const key of keys) {
        try {
          const ttl = await this.redis.ttl(key);
          if (ttl <= 0) {
            const sessionId = key.replace('advotecate:session:', '');
            await this.destroySession(sessionId);
            cleaned++;
          }
        } catch (error) {
          console.error('Error cleaning session:', key, error);
          errors++;
        }
      }

      console.log(`Session cleanup completed: ${cleaned} cleaned, ${errors} errors`);
    } catch (error) {
      console.error('Error during session cleanup:', error);
      errors++;
    }

    return { cleaned, errors };
  }

  async getSessionStats(): Promise<{
    totalSessions: number;
    activeUsers: number;
    avgSessionDuration: number;
  }> {
    try {
      const sessionKeys = await this.redis.keys('advotecate:session:*');
      const userSessionKeys = await this.redis.keys('advotecate:user_sessions:*');

      return {
        totalSessions: sessionKeys.length,
        activeUsers: userSessionKeys.length,
        avgSessionDuration: 0 // Would need more complex calculation
      };
    } catch (error) {
      console.error('Error getting session stats:', error);
      return { totalSessions: 0, activeUsers: 0, avgSessionDuration: 0 };
    }
  }
}

export const sessionManager = new SessionManager();