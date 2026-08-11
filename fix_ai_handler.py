import re

with open('supabase/functions/ai_handler/index.ts', 'r') as f:
    code = f.read()

code = re.sub(r'import \{ routeAIRequest \} from "\.\./router/ai_router\.ts";\n', '', code)

replacement = """    let ai_response;
    if (activeConfig || mode === "custom" || mode === "custom_api") {
      ai_response = "Custom provider routing disabled in V1 cleanup. Using Ceova Groq engine.";
      provider = "ceova";
    }
    
    // Ceova Internal Path
    ai_response = ai_response || await callGroq(prompt);
    if (!ai_response) throw new Error("Ceova AI engines are busy.");"""

code = re.sub(r'    let ai_response;\n    if \(activeConfig.*?\n    \}\n', replacement, code, flags=re.DOTALL)

with open('supabase/functions/ai_handler/index.ts', 'w') as f:
    f.write(code)

