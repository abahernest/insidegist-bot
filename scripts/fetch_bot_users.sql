-- SQL Script to fetch existing bot users for bot_users.json
-- Run this against your database and save the result as bot_users.json

SELECT json_agg(u)
FROM (
    SELECT 
        username, 
        email, 
        company_name as "company", 
        job_title as "jobTitle", 
        summary as "bio",
        'BotPass2026!#' as "password", -- Default bot password
        username as "fullName" -- Fallback since fullName isn't in DB
    FROM users 
    WHERE email LIKE '%@kuda.com' 
       OR email LIKE '%@moniepoint.com' 
       OR email LIKE '%@interswitchgroup.com' 
       OR email LIKE '%@safaricom.co.ke' 
       OR email LIKE '%@paystack.com'
) u;
