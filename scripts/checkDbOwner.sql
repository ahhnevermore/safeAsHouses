-- Check the owner of the database specified in the DB_USER environment variable
SELECT d.datname AS database_name, u.usename AS owner
FROM pg_database d
JOIN pg_user u ON d.datdba = u.usesysid
WHERE d.datname = current_database();
