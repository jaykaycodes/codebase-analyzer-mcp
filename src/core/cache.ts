/**
 * Analysis Cache
 *
 * In-memory cache for analysis results with TTL support.
 * Used to enable expand_section without re-analyzing.
 */

import type {
  AnalysisResultV2,
  CacheEntry,
  SemanticAnalysis,
  StructuralAnalysis,
  SurfaceAnalysis,
  AnalysisDepth,
} from "../types.js";

/**
 * Default cache TTL: 1 hour
 */
const DEFAULT_TTL_MS = 60 * 60 * 1000;

/**
 * Maximum cache entries to prevent memory issues
 */
const MAX_CACHE_ENTRIES = 50;

/**
 * Cache for analysis results
 */
interface AnalysisCacheData {
  result: AnalysisResultV2;
  surface: SurfaceAnalysis;
  structural: StructuralAnalysis[];
  semantic: SemanticAnalysis | null;
}

class AnalysisCache {
  private cache = new Map<string, CacheEntry<AnalysisCacheData>>();
  private ttlMs: number;

  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  /**
   * Generate cache key from source and optional commit hash
   */
  generateKey(source: string, commitHash?: string): string {
    const normalized = source.replace(/\\/g, "/").replace(/\/+$/, "");
    return commitHash ? `${normalized}@${commitHash}` : normalized;
  }

  /**
   * Store analysis result in cache
   */
  set(
    source: string,
    data: AnalysisCacheData,
    commitHash?: string,
    depth: AnalysisDepth = "standard"
  ): void {
    // Enforce max entries
    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      this.evictOldest();
    }

    const key = this.generateKey(source, commitHash);
    const now = Date.now();

    const entry: CacheEntry<AnalysisCacheData> = {
      key,
      value: data,
      createdAt: now,
      expiresAt: now + this.ttlMs,
      metadata: {
        source,
        commitHash,
        depth,
      },
    };

    this.cache.set(key, entry);
  }

  /**
   * Get analysis result from cache
   */
  get(source: string, commitHash?: string): AnalysisCacheData | null {
    const key = this.generateKey(source, commitHash);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Get by analysis ID
   */
  getByAnalysisId(analysisId: string): AnalysisCacheData | null {
    for (const entry of this.cache.values()) {
      if (entry.value.result.analysisId === analysisId) {
        // Check if expired
        if (Date.now() > entry.expiresAt) {
          this.cache.delete(entry.key);
          return null;
        }
        return entry.value;
      }
    }
    return null;
  }

  /**
   * Check if source has cached result
   */
  has(source: string, commitHash?: string): boolean {
    const key = this.generateKey(source, commitHash);
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Invalidate cache for a source
   */
  invalidate(source: string, commitHash?: string): boolean {
    const key = this.generateKey(source, commitHash);
    return this.cache.delete(key);
  }

  /**
   * Clear all expired entries
   */
  clearExpired(): number {
    const now = Date.now();
    let cleared = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  stats(): {
    entries: number;
    maxEntries: number;
    ttlMs: number;
    oldestEntryAge: number | null;
  } {
    let oldestCreatedAt: number | null = null;

    for (const entry of this.cache.values()) {
      if (oldestCreatedAt === null || entry.createdAt < oldestCreatedAt) {
        oldestCreatedAt = entry.createdAt;
      }
    }

    return {
      entries: this.cache.size,
      maxEntries: MAX_CACHE_ENTRIES,
      ttlMs: this.ttlMs,
      oldestEntryAge: oldestCreatedAt ? Date.now() - oldestCreatedAt : null,
    };
  }

  /**
   * Evict oldest entry
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}

// Singleton instance
export const analysisCache = new AnalysisCache();

// Export class for testing
export { AnalysisCache };
