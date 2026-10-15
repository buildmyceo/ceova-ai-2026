-- Drop Dev Environment Tables
DROP TABLE IF EXISTS dev_terminal_logs CASCADE;
DROP TABLE IF EXISTS dev_sessions CASCADE;
DROP TABLE IF EXISTS dev_workspaces CASCADE;
DROP TABLE IF EXISTS ceova_projects CASCADE;

-- Drop Skills and Connectors Tables
DROP TABLE IF EXISTS tool_logs CASCADE;
DROP TABLE IF EXISTS planner_logs CASCADE;
DROP TABLE IF EXISTS custom_apps CASCADE;
DROP TABLE IF EXISTS skills CASCADE;
DROP TABLE IF EXISTS connectors CASCADE;

-- Drop Integration Credentials Tables
DROP TABLE IF EXISTS user_github_tokens CASCADE;
DROP TABLE IF EXISTS user_google_tokens CASCADE;
DROP TABLE IF EXISTS user_app_secrets CASCADE;
