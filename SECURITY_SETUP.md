# Security Setup Guide - Enalysis MVP

## ⚠️ IMPORTANT: Read Before Deployment

This guide covers essential security steps to protect your application and user data.

---

## 1. Generate Production Secrets

**CRITICAL**: Never use the same secrets in development and production!

### Generate New Secrets

Run these commands to generate cryptographically secure secrets:

```bash
# Generate SESSION_SECRET (64 bytes)
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"

# Generate ENCRYPTION_SECRET (32 bytes)
node -e "console.log('ENCRYPTION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# Generate CRON_SECRET (32 bytes)
node -e "console.log('CRON_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

### Your Production Secrets (Generated {{DATE}}):

```bash
# Main App Secrets
SESSION_SECRET=dd47a5f68dfcd4cdc9bf260e59574469e6077e30bc26adc26b6582adc874be1dff13e8468e5aad6988e9f864b5002314eb4f69c2db35e7b01cb4c2a26e3521f4

ENCRYPTION_SECRET=bd94c2c8fbdd4e6130debc29c138c8f43bdd01ed81dd82f792fad8ac03778e05

CRON_SECRET=9d9203537ab8a427558f011f4bb511b83bb7d9703de720cf40ba8565747fdffe
```

**⚠️ SAVE THESE SECRETS SECURELY!**
- Copy them to your password manager
- Add them to your hosting platform's environment variables
- NEVER commit them to git
- Keep backups in a secure location

---

## 2. Remove Exposed Secrets from Git History

If you've committed secrets to git, they're still in the history. Here's how to clean them:

### Option 1: Using BFG Repo-Cleaner (Easiest)

```bash
# Install BFG
# Windows: choco install bfg
# Mac: brew install bfg
# Or download from: https://rtyley.github.com/bfg-repo-cleaner/

# Remove .env files from history
bfg --delete-files .env
bfg --delete-files .env.local

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push (WARNING: This rewrites history!)
git push origin --force --all
```

### Option 2: Manual Cleanup

```bash
# Remove .env from git history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env .env.local ml-service/.env" \
  --prune-empty --tag-name-filter cat -- --all

# Force push
git push origin --force --all
git push origin --force --tags
```

### Option 3: Start Fresh (If repository is not shared)

```bash
# Delete .git directory
rm -rf .git

# Reinitialize
git init
git add .
git commit -m "Initial commit with secure environment setup"
git remote add origin <your-repo-url>
git push -u origin main --force
```

---

## 3. Secure Your Production Database

### Choose a Secure Database Provider

**Recommended Options:**

#### Option A: Supabase (Easiest)
```bash
# 1. Sign up at https://supabase.com
# 2. Create new project
# 3. Copy connection string from Settings → Database
# 4. Connection string format:
DATABASE_URL="postgresql://postgres.[PROJECT_ID]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
```

#### Option B: Neon (Fast, Serverless)
```bash
# 1. Sign up at https://neon.tech
# 2. Create new project
# 3. Copy connection string
# 4. Connection string format:
DATABASE_URL="postgresql://[user]:[password]@[endpoint].neon.tech/[database]?sslmode=require"
```

#### Option C: Railway
```bash
# 1. Sign up at https://railway.app
# 2. Create new project
# 3. Add PostgreSQL service
# 4. Connection string is automatically provided
```

### Database Security Checklist

- [ ] **Enable SSL mode** - Always use `?sslmode=require` in production
- [ ] **Use strong passwords** - 32+ characters, random
- [ ] **Enable connection pooling** - For better performance
- [ ] **Set up automated backups** - Daily backups with 30-day retention
- [ ] **Restrict IP access** - Allow only your application servers (if possible)
- [ ] **Monitor query performance** - Set up slow query logging

---

## 4. Encrypt Sensitive Data in Database

### Install Encryption Library

```bash
npm install crypto-js
npm install --save-dev @types/crypto-js
```

### Create Encryption Helpers

Create `lib/encryption.ts`:

```typescript
import CryptoJS from "crypto-js";

const SECRET_KEY = process.env.ENCRYPTION_SECRET;

if (!SECRET_KEY) {
  throw new Error("ENCRYPTION_SECRET environment variable is required");
}

/**
 * Encrypt sensitive data before storing in database
 */
export function encrypt(text: string): string {
  return CryptoJS.AES.encrypt(text, SECRET_KEY).toString();
}

/**
 * Decrypt sensitive data when reading from database
 */
export function decrypt(ciphertext: string): string {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);

    if (!decrypted) {
      throw new Error("Decryption failed - empty result");
    }

    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt data");
  }
}

/**
 * Check if a string is encrypted
 */
export function isEncrypted(text: string): boolean {
  try {
    // Encrypted data starts with specific patterns
    return text.startsWith("U2Fsd") || /^[A-Za-z0-9+/]+=*$/.test(text);
  } catch {
    return false;
  }
}
```

### Update OAuth Token Storage

Update `app/api/oauth/enphase/callback/route.ts`:

```typescript
import { encrypt } from "@/lib/encryption";

// When storing tokens:
const updatedMetadata = {
  ...existingSource.metadata,
  accessToken: encrypt(tokenData.access_token),
  refreshToken: encrypt(tokenData.refresh_token),
  systemId: metadata.systemId,
  tokenExpiry: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
};
```

### Update Token Retrieval

When reading tokens back:

```typescript
import { decrypt } from "@/lib/encryption";

const accessToken = decrypt(source.metadata.accessToken);
const refreshToken = decrypt(source.metadata.refreshToken);
```

---

## 5. Implement HTTPS in Production

### For Vercel/Railway/Render
✅ HTTPS is automatically configured - no action needed

### For Custom Hosting

#### Option A: Let's Encrypt (Free)
```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Generate certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo certbot renew --dry-run
```

#### Option B: Cloudflare (Free + CDN)
1. Sign up at https://cloudflare.com
2. Add your domain
3. Update nameservers
4. Enable "Always Use HTTPS"
5. Set SSL/TLS mode to "Full (strict)"

---

## 6. Secure Session Cookies

Update `lib/session.ts` for production:

```typescript
export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true, // ALWAYS true in production
    sameSite: "strict", // Changed from "lax" for better security
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
    domain: process.env.NODE_ENV === "production" ? ".yourdomain.com" : undefined,
  });
}
```

---

## 7. Environment Variable Management

### Development (.env.local)
```bash
# Use localhost and development credentials
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/enalysis_mvp"
SESSION_SECRET="dev_secret_change_in_production"
```

### Production (Hosting Platform)

#### Vercel
1. Go to Project Settings → Environment Variables
2. Add each variable
3. Select "Production" environment
4. Never use "Preview" or "Development" for production secrets

#### Railway
1. Go to Project → Variables
2. Add each variable
3. Variables are automatically injected

#### AWS/GCP
1. Use AWS Secrets Manager or GCP Secret Manager
2. Access secrets via SDK
3. Never hardcode in code or config files

---

## 8. API Key Security

### Rotate API Keys Regularly

```bash
# Every 3-6 months:
# 1. Generate new keys from provider dashboards
# 2. Update in hosting platform
# 3. Deploy new version
# 4. Deactivate old keys after 24 hours
```

### Monitor API Usage

- Set up alerts for unusual usage patterns
- Monitor for API key leaks (GitHub, public repos)
- Use services like GitGuardian to scan for leaked secrets

---

## 9. Security Headers

### Add Security Headers to Next.js

Update `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          }
        ]
      }
    ];
  }
};

module.exports = nextConfig;
```

---

## 10. Security Checklist Before Production

### Pre-Deployment

- [ ] All `.env` files removed from git history
- [ ] New SESSION_SECRET generated and added to production
- [ ] New ENCRYPTION_SECRET generated and added to production
- [ ] Production database with SSL enabled
- [ ] HTTPS enabled on production domain
- [ ] Security headers configured
- [ ] OAuth tokens encrypted in database
- [ ] API keys stored in environment variables (not in code)
- [ ] .gitignore properly configured
- [ ] No hardcoded passwords or secrets in code
- [ ] No `console.log` of sensitive data

### Post-Deployment

- [ ] Test login/logout flow
- [ ] Test OAuth connections
- [ ] Verify HTTPS is working (no mixed content warnings)
- [ ] Check security headers using https://securityheaders.com
- [ ] Test database connection with SSL
- [ ] Verify encrypted data can be decrypted
- [ ] Set up monitoring and alerts
- [ ] Document incident response plan

---

## 11. Incident Response Plan

### If Secrets Are Leaked

1. **Immediately rotate all secrets**
   - Generate new SESSION_SECRET
   - Generate new ENCRYPTION_SECRET
   - Rotate all API keys

2. **Invalidate all user sessions**
   ```typescript
   // Force all users to log in again
   await db.execute(sql`UPDATE users SET last_password_change = NOW()`);
   ```

3. **Notify affected users** (if user data was exposed)

4. **Review access logs** for suspicious activity

5. **Update security measures** to prevent future leaks

### Emergency Contacts

- **Security Team**: security@yourcompany.com
- **Hosting Provider Support**: [link]
- **Database Provider Support**: [link]

---

## 12. Regular Security Maintenance

### Monthly Tasks

- [ ] Review access logs for suspicious activity
- [ ] Check for outdated dependencies: `npm audit`
- [ ] Review user permissions and access levels
- [ ] Verify backups are working

### Quarterly Tasks

- [ ] Rotate API keys
- [ ] Update dependencies: `npm update`
- [ ] Security audit of new features
- [ ] Review and update access control policies

### Annually

- [ ] Full security penetration test
- [ ] Rotate all secrets (SESSION_SECRET, ENCRYPTION_SECRET)
- [ ] Review and update security policies
- [ ] Team security training

---

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Best Practices](https://nextjs.org/docs/app/building-your-application/configuring/security)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)

---

## Support

If you have security concerns or discover vulnerabilities:
- Email: security@yourcompany.com
- For immediate issues: [Emergency contact]

**Remember**: Security is an ongoing process, not a one-time task!
