/**
 * Session Manager with TTL auto-cleanup
 * Prevents memory leaks from abandoned orchestrator sessions
 */

export class SessionManager {
  constructor(options = {}) {
    this.sessions = new Map();
    this.ttl = options.ttl || 30 * 60 * 1000; // Default 30 minutes
    this.cleanupInterval = options.cleanupInterval || 5 * 60 * 1000; // 5 min cleanup
    this.maxSessions = options.maxSessions || 500;
    this.cleanupTimer = null;

    // Start cleanup timer
    this.startCleanupTimer();
  }

  /**
   * Start the periodic cleanup timer
   */
  startCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.cleanupTimer = setInterval(() => this.cleanup(), this.cleanupInterval);
    // Prevent timer from keeping Node process alive
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Set a session with orchestrator
   * @param {string} sessionId
   * @param {Object} orchestrator
   * @returns {Object} orchestrator
   */
  set(sessionId, orchestrator) {
    // Check max sessions limit
    if (this.sessions.size >= this.maxSessions && !this.sessions.has(sessionId)) {
      this.evictOldest();
    }

    this.sessions.set(sessionId, {
      orchestrator,
      createdAt: Date.now(),
      lastAccessedAt: Date.now()
    });

    return orchestrator;
  }

  /**
   * Get session and update access time
   * @param {string} sessionId
   * @returns {Object|null} orchestrator or null
   */
  get(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastAccessedAt = Date.now();
      return session.orchestrator;
    }
    return null;
  }

  /**
   * Check if session exists
   * @param {string} sessionId
   * @returns {boolean}
   */
  has(sessionId) {
    return this.sessions.has(sessionId);
  }

  /**
   * Delete a session
   * @param {string} sessionId
   * @returns {boolean}
   */
  delete(sessionId) {
    return this.sessions.delete(sessionId);
  }

  /**
   * Get session count
   * @returns {number}
   */
  get size() {
    return this.sessions.size;
  }

  /**
   * Cleanup expired sessions
   * @returns {number} Number of sessions cleaned
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastAccessedAt > this.ttl) {
        this.sessions.delete(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[SessionManager] Cleaned ${cleaned} expired sessions. Active: ${this.sessions.size}`);
    }

    return cleaned;
  }

  /**
   * Evict the oldest session (LRU)
   * @returns {string|null} Evicted session ID
   */
  evictOldest() {
    let oldest = null;
    let oldestTime = Infinity;

    for (const [sessionId, session] of this.sessions) {
      if (session.lastAccessedAt < oldestTime) {
        oldest = sessionId;
        oldestTime = session.lastAccessedAt;
      }
    }

    if (oldest) {
      this.sessions.delete(oldest);
      console.log(`[SessionManager] Evicted oldest session: ${oldest}`);
    }

    return oldest;
  }

  /**
   * Get statistics
   * @returns {Object}
   */
  getStats() {
    const sessions = Array.from(this.sessions.values());
    const now = Date.now();

    return {
      activeSessions: this.sessions.size,
      maxSessions: this.maxSessions,
      ttlMinutes: Math.round(this.ttl / 60000),
      oldestSessionAge: sessions.length > 0
        ? Math.round((now - Math.min(...sessions.map(s => s.createdAt))) / 1000)
        : 0,
      averageAge: sessions.length > 0
        ? Math.round(sessions.reduce((sum, s) => sum + (now - s.createdAt), 0) / sessions.length / 1000)
        : 0
    };
  }

  /**
   * Shutdown and cleanup
   */
  shutdown() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.sessions.clear();
    console.log('[SessionManager] Shutdown complete');
  }

  /**
   * Clear all sessions (for testing)
   */
  clear() {
    this.sessions.clear();
  }
}

// Export singleton instance for production use
export const sessionManager = new SessionManager({
  ttl: 30 * 60 * 1000,           // 30 minutes
  cleanupInterval: 5 * 60 * 1000, // 5 minutes
  maxSessions: 500
});

export default SessionManager;
