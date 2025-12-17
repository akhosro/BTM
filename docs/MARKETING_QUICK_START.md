# Marketing Quick Start Guide

## 🚀 Get Your First Customers in 30 Days

This guide shows you how to use the marketing automation agent to acquire your first customers quickly.

---

## Week 1: Setup & Launch (Days 1-7)

### Day 1: Tools Setup

**Install Required Tools** ($120/month total):

1. **LinkedIn Sales Navigator** ($80/month)
   - Go to linkedin.com/sales
   - Sign up for free trial
   - Build saved search for "Energy Manager" OR "Facilities Manager"
   - Filter: 100-5,000 employees, manufacturing/commercial RE/data centers

2. **Instantly.ai** ($40/month)
   - Go to instantly.ai
   - Sign up
   - Connect 3-5 email accounts (Gmail/Google Workspace)
   - Enable warm-up mode (takes 7-14 days)

3. **Apollo.io** (Free tier)
   - Go to apollo.io
   - Sign up
   - Export 100 leads per month free

### Day 2: Build Your Lead List

Run this command to use the AI agent:
```bash
cd enalysis-mvp
npx tsx scripts/marketing-agent-cli.ts score-lead
```

**Manual Lead Building**:
1. LinkedIn Sales Navigator → Search for "Energy Manager"
2. Export to CSV (100 leads)
3. Score each lead using the AI agent
4. Prioritize leads with score >70

**Target Profile**:
- Job Title: Energy Manager, Facilities Manager, Sustainability Director
- Company Size: 100-5,000 employees
- Industry: Manufacturing, Data Centers, Commercial Real Estate
- Location: North America (Ontario, California, New York, Texas)

### Day 3-4: Generate Content

**LinkedIn Messages** (generate 20):
```bash
npx tsx scripts/marketing-agent-cli.ts generate-linkedin
```

**Email Sequences** (generate 5 variations):
```bash
npx tsx scripts/marketing-agent-cli.ts generate-email
```

**Copy/paste generated messages into Instantly.ai**

### Day 5: Set Up Campaigns

**LinkedIn Campaign**:
- Send 50 connection requests/day (manually or with Waalaxy)
- Use AI-generated messages
- Track responses in spreadsheet

**Email Campaign**:
- Upload leads to Instantly.ai
- Set up 3-email sequence (AI-generated)
- Schedule: Email 1 (Day 0), Email 2 (Day 4), Email 3 (Day 7)
- Start with 100 emails/day, scale to 500/day

### Day 6-7: Launch & Monitor

**Launch Campaigns**:
- LinkedIn: 50 messages/day
- Email: 100 emails/day

**Expected Week 1 Results**:
- 350 LinkedIn messages sent
- 700 emails sent
- 50-100 responses
- 5-10 demo bookings

---

## Week 2: Content Marketing (Days 8-14)

### Daily: LinkedIn Posts

Generate weekly content:
```bash
npx tsx scripts/marketing-agent-cli.ts weekly-content
```

**Posting Schedule**:
- Monday: Case study/success story
- Tuesday: Educational (peak demand, TOU, etc.)
- Wednesday: Industry insights
- Thursday: Tips/tricks
- Friday: Weekend reflection/thought leadership

**Best Time to Post**: 8-10 AM EST, Tuesday-Thursday

### Blog Posts

Generate blog outlines:
```bash
npx tsx scripts/marketing-agent-cli.ts blog-outline
```

**Week 2 Blog Posts**:
1. "How to Reduce Peak Demand Charges by 30% (Complete Guide)"
2. "Energy Management Software Buyer's Guide 2025"

**Publish on**:
- Your website blog
- Medium
- LinkedIn Articles

### Expected Week 2 Results:
- 5 LinkedIn posts published
- 2 blog posts published
- 500-1,000 impressions per post
- 10-20 website visitors from content

---

## Week 3: Scale Outreach (Days 15-21)

### Scale Email Campaigns

**Increase Volume**:
- Day 15: 200 emails/day
- Day 17: 300 emails/day
- Day 19: 500 emails/day

**Monitor Metrics**:
- Open rate: Should be >30%
- Reply rate: Should be >5%
- If lower, improve subject lines/personalization

### Add Cold Calling

**Script**:
```
"Hi [Name], this is [Your Name] from Enalysis.

I work with facilities like yours to reduce peak demand charges using AI.

Quick question - do you have demand charges on your electricity bill?

[If yes] Great - we've saved clients 20-30% on their monthly bills. Worth a 15-minute chat to see if we can help [Company]?

[Book demo on call]"
```

**Call 20-30 prospects/day**

### Expected Week 3 Results:
- 1,500+ emails sent
- 100+ LinkedIn messages
- 30-50 phone calls
- 20-30 demo bookings
- 3-5 customers closed

---

## Week 4: Optimize & Close (Days 22-30)

### Demo Best Practices

**Pre-Demo**:
- Send calendar invite with Zoom link
- Ask for electricity bill (PDF) in advance
- Prepare personalized analysis

**During Demo** (15 minutes):
1. **Intro** (2 min): Ask about pain points
2. **Analysis** (5 min): Show their bill, identify waste
3. **Demo** (5 min): Show live dashboard with their data
4. **ROI** (2 min): Calculate savings for them
5. **Close** (1 min): "Want to start with a 30-day trial?"

**Post-Demo**:
- Send follow-up email with:
  - Recording
  - ROI calculation
  - Next steps
- Follow up in 24 hours if no response

### Close Process

**Objection Handling**:

| Objection | Response |
|-----------|----------|
| "Too expensive" | "It pays for itself in 2-3 months. The first month is free - see the savings, then decide." |
| "Need to check with boss" | "Great! Can I send you an ROI summary to share with them?" |
| "Not the right time" | "When would be better? We can start the trial anytime and pause it." |
| "Already have a solution" | "What are you using? Curious how it compares to AI-driven optimization." |

**Trial Offer**:
- 30 days free
- No credit card required
- Full support & onboarding
- Cancel anytime

**Pricing** (after trial):
- Starter: $500/month (1-2 sites)
- Growth: $2,000/month (3-10 sites)
- Enterprise: $5,000+/month (10+ sites)

### Expected Week 4 Results:
- 30-40 demos completed
- 10-15 trials started
- 5-8 paying customers

---

## Month 1 Summary

### Expected Results:

| Metric | Target |
|--------|--------|
| Leads Generated | 500-1,000 |
| Demos Booked | 40-60 |
| Trials Started | 20-30 |
| Paying Customers | 5-10 |
| Monthly Recurring Revenue (MRR) | $5,000-15,000 |

### Cost Breakdown:

| Item | Cost |
|------|------|
| LinkedIn Sales Navigator | $80 |
| Instantly.ai | $40 |
| Anthropic API (Claude) | $50 |
| LinkedIn Ads (optional) | $500 |
| **Total** | **$670/month** |

**ROI**: $5,000 MRR / $670 spend = 7.5x ROI

---

## Automation Checklist

Use the marketing agent to automate:

- [x] Lead scoring
- [x] LinkedIn message generation
- [x] Email sequence creation
- [x] Content generation (posts & blogs)
- [x] Response analysis

**Run Daily**:
```bash
# Generate today's LinkedIn post
npx tsx scripts/marketing-agent-cli.ts generate-post

# Analyze overnight responses
npx tsx scripts/marketing-agent-cli.ts analyze-response
```

**Run Weekly**:
```bash
# Generate next week's content
npx tsx scripts/marketing-agent-cli.ts weekly-content
```

---

## Growth Hacks

### 1. Free Energy Audit
- Create ROI calculator on website
- Requires email to see results
- Auto-send personalized report
- Conversion: 20-30% to demo

### 2. "Save 20% or Work for Free" Guarantee
- Removes risk from decision
- Increases conversion by 40-60%

### 3. Referral Program
- Give $500 credit per referral
- Referred customer gets 20% off first year
- Viral coefficient: 1.2-1.5x

### 4. Launch on Product Hunt
- One-time spike of 5,000-10,000 visitors
- Expected: 50-100 signups in 24 hours

### 5. LinkedIn Post Formula
```
Hook: "We saved a client $127K last year"
Problem: "They were wasting 30% on peak demand"
Solution: "Our AI predicted peaks 24h ahead"
Results: "$127K saved, 28% cost reduction"
CTA: "DM me for a free audit"
```

Post 1x/day → 30-50K impressions/month

---

## Next Steps

### Scale to 100 Customers (Month 2-3):

1. **Hire SDR** (Sales Development Rep)
   - Cost: $3,000-5,000/month + commission
   - Handles outreach & demo bookings
   - You focus on demos & closing

2. **Add Paid Ads**
   - LinkedIn Ads: $1,500/month
   - Google Ads: $1,000/month
   - Expected: 30-50 qualified leads/month

3. **Content Marketing**
   - Publish 2 blog posts/week
   - Build SEO authority
   - 1,000+ organic visitors/month by Month 3

4. **Partnerships**
   - Energy consultants (20% commission)
   - Solar installers (bundled offering)
   - 10-20 referrals/month

---

## Tools Summary

### Free Tools:
- ✅ Apollo.io (100 leads/month free)
- ✅ Claude AI (via API - included in your app)
- ✅ Canva (free tier)
- ✅ Google Analytics

### Paid Tools:
- LinkedIn Sales Navigator: $80/month
- Instantly.ai: $40/month
- Calendly: $10/month
- Total: $130/month minimum

### Optional (for scale):
- ZoomInfo: $200/month (better lead data)
- Waalaxy: $40/month (LinkedIn automation)
- Smartlead.ai: $40/month (unlimited emails)

---

## Measuring Success

### Key Metrics:

1. **Outreach Metrics**:
   - Messages sent: 500+/day
   - Response rate: 5-10%
   - Demo booking rate: 2-3%

2. **Content Metrics**:
   - LinkedIn impressions: 10K+/week
   - Website visitors: 500+/month
   - Blog traffic: 200+/month

3. **Sales Metrics**:
   - Demos per week: 10-15
   - Demo-to-trial: 50%
   - Trial-to-paid: 50%

4. **Revenue Metrics**:
   - MRR: $5K+ (Month 1), $15K+ (Month 2), $30K+ (Month 3)
   - CAC (Customer Acquisition Cost): <$500
   - LTV (Lifetime Value): $15K+ (assuming 2.5 year retention)

---

## FAQ

**Q: Can I do this without spending money?**
A: Yes, but slower. Use free LinkedIn (50 messages/day limit), free Apollo leads, and manual outreach. Will take 2-3x longer.

**Q: Do I need technical skills?**
A: No. The marketing agent generates everything. Just copy/paste messages.

**Q: How much time per day?**
A: 2-3 hours:
- 30 min: Review responses
- 60 min: Send outreach (LinkedIn + email)
- 30 min: Demos
- 30 min: Content creation

**Q: What if I get negative responses?**
A: Normal. 90-95% won't respond or will say no. Focus on the 5-10% who are interested.

**Q: Should I hire a marketer?**
A: Not yet. Do it yourself for Month 1-2 to learn what works. Then hire when you're at $10-20K MRR.

---

## Get Started Now

**Run this command**:
```bash
cd enalysis-mvp
npx tsx scripts/marketing-agent-cli.ts weekly-content
```

This will generate:
- 5 LinkedIn posts for next week
- 5 blog post ideas
- Ready to publish

**Your Action Plan for Today**:
1. Sign up for LinkedIn Sales Navigator (free trial)
2. Build list of 100 prospects
3. Generate 10 personalized messages using the agent
4. Send first 10 messages today
5. Book your first demo by end of week

Let's go! 🚀
