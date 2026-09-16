import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.2";
import { Logger } from "./logger.ts";

export class GoogleAuthService {
    private supabaseUrl: string;
    private supabaseServiceKey: string;
    private adminClient: SupabaseClient;

    constructor() {
        this.supabaseUrl = Deno.env.get("VITE_SUPABASE_URL") || Deno.env.get("SUPABASE_URL") || "";
        this.supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE") || "";
        this.adminClient = createClient(this.supabaseUrl, this.supabaseServiceKey);
    }

    async getValidAccessToken(userId: string): Promise<string | null> {
        const { data, error } = await this.adminClient
            .from("user_google_tokens")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle();

        if (error || !data) {
            Logger.ERROR(`No Google token found for user ${userId}. Error: ${error?.message}`);
            return null;
        }

        const { access_token, refresh_token, expiry_date } = data;

        // If the token is not expired (giving a 5-minute buffer)
        if (Date.now() < expiry_date - 5 * 60 * 1000) {
            return access_token;
        }

        // Token is expired, try to refresh
        if (!refresh_token) {
            Logger.ERROR(`Google token expired for user ${userId} but no refresh_token found.`);
            return null;
        }

        Logger.INFO(`Refreshing Google token for user ${userId}...`);
        const newTokens = await this.refreshAccessToken(refresh_token);
        if (!newTokens) {
            return null;
        }

        const newExpiry = Date.now() + (newTokens.expires_in * 1000);

        // Update database
        const updateData: any = {
            access_token: newTokens.access_token,
            expiry_date: newExpiry,
            updated_at: new Date().toISOString()
        };

        if (newTokens.refresh_token) {
            updateData.refresh_token = newTokens.refresh_token;
        }

        await this.adminClient
            .from("user_google_tokens")
            .update(updateData)
            .eq("user_id", userId);

        return newTokens.access_token;
    }

    private async refreshAccessToken(refreshToken: string) {
        const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
        const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

        if (!clientId || !clientSecret) {
            Logger.ERROR("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in environment variables.");
            return null;
        }

        try {
            const response = await fetch("https://oauth2.googleapis.com/token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                    client_id: clientId,
                    client_secret: clientSecret,
                    refresh_token: refreshToken,
                    grant_type: "refresh_token",
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                Logger.ERROR(`Failed to refresh token: ${JSON.stringify(data)}`);
                return null;
            }

            return data;
        } catch (e: any) {
            Logger.ERROR(`Exception refreshing token: ${e.message}`);
            return null;
        }
    }
}

export const googleAuthService = new GoogleAuthService();
