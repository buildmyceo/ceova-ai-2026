import { Tool, ToolContext, ToolResult } from '../types.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.2';

export class SystemContextTool implements Tool {
  metadata = {
    id: 'system_context',
    name: 'System Context & Weather',
    description: 'Use this tool to get the current date, time, user information, and weather. Use this whenever the user asks for the current time, day, or weather.',
    category: 'system',
    icon: 'clock',
    requiresImage: false,
    requiresAuth: false,
    enabled: true,
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "Optional city or location name to get the weather for (e.g. 'London', 'New York'). If left empty, it will attempt to fetch weather for the current IP location."
        }
      }
    }
  };

  async execute(context: ToolContext): Promise<ToolResult> {
    const { args, userId } = context;
    const location = args?.location || '';
    
    context.onStatusUpdate?.("Fetching system context & weather...");

    let weatherInfo = "Weather not requested/unavailable.";
    try {
      const weatherUrl = location 
        ? `https://wttr.in/${encodeURIComponent(location)}?format=%C+%t+%w+%h`
        : `https://wttr.in/?format=%C+%t+%w+%h`;
      
      const response = await fetch(weatherUrl);
      if (response.ok) {
        weatherInfo = await response.text();
      }
    } catch (e) {
      console.warn("Weather fetch failed", e);
    }

    const now = new Date();
    
    // Fetch user info from Supabase using service key to get email/name
    let userInfo = "Unknown User";
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data: user } = await supabase.auth.admin.getUserById(userId);
        if (user?.user) {
          userInfo = `Email: ${user.user.email} | Name: ${user.user.user_metadata?.full_name || 'N/A'}`;
        }
      }
    } catch (e) {
      console.warn("User fetch failed", e);
    }

    const resultData = {
      currentTime: now.toLocaleTimeString(),
      currentDate: now.toDateString(),
      isoTimestamp: now.toISOString(),
      weather: weatherInfo.trim(),
      user: userInfo
    };

    return {
      success: true,
      data: resultData
    };
  }
}
