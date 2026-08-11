// In-memory quota cache for Edge Functions
// Edge isolates stay warm for several minutes across invocations.
// We can cache quota limits here to drastically reduce DB hits.

interface Quota {
    used: number;
    limit: number;
    timestamp: number;
}

const CACHE_TTL_MS = 60000; // Cache quota for 60 seconds

class QuotaCache {
    private cache = new Map<string, Quota>();

    get(userId: string): { used: number, limit: number } | null {
        const item = this.cache.get(userId);
        if (!item) return null;
        if (Date.now() - item.timestamp > CACHE_TTL_MS) {
            this.cache.delete(userId);
            return null;
        }
        return { used: item.used, limit: item.limit };
    }

    set(userId: string, data: { used: number, limit: number }) {
        this.cache.set(userId, {
            ...data,
            timestamp: Date.now()
        });
    }

    increment(userId: string, amount: number) {
        const item = this.cache.get(userId);
        if (item) {
            item.used += amount;
            this.cache.set(userId, item);
        }
    }

    clear(userId: string) {
        this.cache.delete(userId);
    }
}

export const quotaCache = new QuotaCache();
