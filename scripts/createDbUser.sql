-- Create a dedicated user for the application
CREATE USER s4feashouses WITH PASSWORD 'wembley';
GRANT CONNECT ON DATABASE s4feashouses TO s4feashouses;
GRANT USAGE ON SCHEMA public TO s4feashouses;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO s4feashouses;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO s4feashouses;
ALTER DATABASE s4feashouses OWNER TO s4feashouses;
