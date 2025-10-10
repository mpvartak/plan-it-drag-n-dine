# Security Policy

## Overview

This project uses Supabase for backend services and OpenAI for AI-powered features. Security is handled through a combination of Row Level Security (RLS) policies, JWT authentication, and proper secret management.

## Reporting a Vulnerability

If you discover a security vulnerability, please email the maintainers directly rather than opening a public issue. We appreciate your responsible disclosure.

## Security Architecture

### Authentication & Authorization

- **User Authentication**: Handled by Supabase Auth with JWT tokens
- **Row Level Security (RLS)**: All database tables have RLS policies enabled
- **Data Isolation**: Users can only access their own data through RLS policies

### API Keys & Secrets

#### ✅ Public (Safe to Expose)

The following values are safe to include in the repository and frontend code:

- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase anon/public key
- `VITE_SUPABASE_PROJECT_ID` - Your project identifier

These are protected by RLS policies and designed to be publicly visible.

#### ❌ Private (Never Commit)

The following should NEVER be committed to the repository:

- `SUPABASE_SERVICE_ROLE_KEY` - Bypasses RLS, full admin access
- `OPENAI_API_KEY` - Your OpenAI API key
- Database passwords or connection strings
- Any other third-party API keys

### Secret Management

**Edge Functions**:
- Secrets are stored in Supabase's secure secret storage
- Set via: `supabase secrets set OPENAI_API_KEY=sk-...`
- Never hardcoded in function code

**Environment Variables**:
- Local development uses `.env` (gitignored for production secrets)
- `.env.example` provides template with placeholders
- Production secrets managed through Supabase dashboard

## Row Level Security Policies

All database tables implement RLS policies:

```sql
-- Example: Users can only access their own meal plans
CREATE POLICY "Users can access own meal plans"
ON meal_plans
FOR ALL
USING (auth.uid() = user_id);
```

Tables with RLS enabled:
- `profiles`
- `meal_plans`
- `meal_items`
- `recipes`
- `grocery_lists`
- `chat_messages`
- `feedback`

## Edge Function Security

Edge functions implement multiple security layers:

1. **JWT Verification**: All requests verify the user's JWT token
2. **User Context**: Supabase client uses the user's JWT for RLS enforcement
3. **Input Validation**: Function arguments are validated before processing
4. **Rate Limiting**: Consider implementing rate limits for production use

Example from `meal-plan-chat/index.ts`:

```typescript
// Extract and verify JWT
const authHeader = req.headers.get('Authorization');
const { data: { user }, error } = await supabase.auth.getUser(jwt);

// Create client with user context (enforces RLS)
const supabase = createClient(url, anonKey, {
  global: { headers: { Authorization: authHeader } }
});
```

## Best Practices for Contributors

1. **Never commit secrets**: Check files before committing
2. **Use `.env.example`**: Update template when adding new variables
3. **Test RLS policies**: Ensure users can't access other users' data
4. **Validate input**: Always validate and sanitize user input
5. **Follow principle of least privilege**: Request minimal permissions needed

## Security Checklist for Deployment

- [ ] All RLS policies are enabled and tested
- [ ] Service role key is not in repository
- [ ] OpenAI API key is set as Supabase secret
- [ ] `.env` file contains only public keys or is gitignored
- [ ] Edge functions verify JWT tokens
- [ ] No secrets in git history (check with `git log -p -- .env`)
- [ ] Rate limiting configured (if needed)
- [ ] CORS policies reviewed

## Dependencies

This project uses:
- `@supabase/supabase-js` - Official Supabase client
- OpenAI API (GPT-4o) - For AI features via edge functions
- No direct database connections from frontend (all via Supabase)

Keep dependencies updated to receive security patches:
```bash
npm audit
npm update
```

## Additional Resources

- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth)
- [Edge Functions Security](https://supabase.com/docs/guides/functions/security)
