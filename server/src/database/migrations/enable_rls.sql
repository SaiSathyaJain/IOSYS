-- Enable RLS on tables (idempotent)
ALTER TABLE inward ENABLE ROW LEVEL SECURITY;
ALTER TABLE outward ENABLE ROW LEVEL SECURITY;

-- Policy for Public/Anon access (if authentication isn't fully implemented yet)
-- OR specific role-based policies if using Supabase Auth
-- For now, considering the "Service Key" is used on server-side, it bypasses RLS by default.
-- BUT, if the client is calling Supabase directly (which it isn't, it goes through our server), 
-- OR if the server is NOT using the service_role key, we need policies.

-- Since we are connecting via `createClient(url, key)` in db.js, we need to check if that key is the anon key or service_role key.
-- If it's the ANON key, RLS applies. If SERVICE_ROLE key, RLS is bypassed.

-- Policy 1: Allow ALL operations for authenticated users (simplest fix if using Auth)
CREATE POLICY "Allow All Access for Authenticated Users" 
ON inward 
FOR ALL 
USING (auth.role() = 'authenticated') 
WITH CHECK (auth.role() = 'authenticated');

-- Policy 2: Allow specific access if using Anon Key (Temporary fix for development)
CREATE POLICY "Allow All Access for Anon Table Inward"
ON inward
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow All Access for Anon Table Outward"
ON outward
FOR ALL
USING (true)
WITH CHECK (true);
