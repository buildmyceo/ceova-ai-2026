// In-memory quota cache for Edge Functions
// Edge isolates stay warm for several minutes across invocations.
// We can cache quota limits here to drastically reduce DB hits.

interface Quota {
    aiUsed: number;
    aiLimit: number;
    toolsUsed: number;
    toolsLimit: number;
    connectorsUsed: number;
    connectorsLimit: number;
    timestamp: number;
}

const CACHE_TTL_MS = 60000; // Cache quota for 60 seconds

class QuotaCache {
    private cache = new Map<string, Quota>();

    get(userId: string): Omit<Quota, 'timestamp'> | null {
        const item = this.cache.get(userId);
        if (!item) return null;
        if (Date.now() - item.timestamp > CACHE_TTL_MS) {
            this.cache.delete(userId);
            return null;
        }
        return { 
            aiUsed: item.aiUsed, aiLimit: item.aiLimit,
            toolsUsed: item.toolsUsed, toolsLimit: item.toolsLimit,
            connectorsUsed: item.connectorsUsed, connectorsLimit: item.connectorsLimit
        };
    }

    set(userId: string, data: Omit<Quota, 'timestamp'>) {
        this.cache.set(userId, {
            ...data,
            timestamp: Date.now()
        });
    }

    increment(userId: string, amounts: { ai?: number, tools?: number, connectors?: number }) {
        const item = this.cache.get(userId);
        if (item) {
            if (amounts.ai) item.aiUsed += amounts.ai;
            if (amounts.tools) item.toolsUsed += amounts.tools;
            if (amounts.connectors) item.connectorsUsed += amounts.connectors;
            this.cache.set(userId, item);
        }
    }

    clear(userId: string) {
        this.cache.delete(userId);
    }
}

export const quotaCache = new QuotaCache();
