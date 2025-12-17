/**
 * Marketing Automation Agent
 *
 * AI-powered marketing assistant that handles:
 * 1. Lead generation and outreach
 * 2. Content creation (emails, LinkedIn posts, blog posts)
 * 3. Lead scoring and qualification
 * 4. Follow-up automation
 * 5. Performance tracking
 */

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ===== LEAD GENERATION =====

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  jobTitle: string;
  industry: string;
  facilityType?: string;
  location?: string;
  linkedinUrl?: string;
  estimatedEnergySpend?: number;
  score: number; // 0-100
  source: string; // "linkedin" | "email" | "website" | "referral"
  status: "new" | "contacted" | "responded" | "demo_booked" | "customer" | "lost";
  lastContactedAt?: Date;
  createdAt: Date;
}

/**
 * Score a lead based on fit and intent
 */
export async function scoreL(lead: Partial<Lead>): Promise<number> {
  const prompt = `You are a lead scoring AI for Enalysis, an energy management platform.

Score this lead from 0-100 based on:
1. Job title relevance (Energy Manager, Facilities Manager, etc.)
2. Company size indicators
3. Industry fit (manufacturing, data centers, commercial real estate)
4. Estimated energy spend

Lead:
Name: ${lead.firstName} ${lead.lastName}
Company: ${lead.company}
Job Title: ${lead.jobTitle}
Industry: ${lead.industry}
Facility Type: ${lead.facilityType || "unknown"}
Location: ${lead.location || "unknown"}

Return ONLY a number from 0-100. No explanation.`;

  const message = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 10,
    messages: [{ role: "user", content: prompt }],
  });

  const scoreText = message.content[0].type === "text" ? message.content[0].text : "50";
  return parseInt(scoreText.trim()) || 50;
}

// ===== CONTENT GENERATION =====

/**
 * Generate personalized LinkedIn connection message
 */
export async function generateLinkedInMessage(lead: Partial<Lead>): Promise<string> {
  const prompt = `You are a sales AI for Enalysis, an AI-powered energy management platform.

Write a SHORT, personalized LinkedIn connection request (under 300 characters) for this prospect:

Name: ${lead.firstName} ${lead.lastName}
Company: ${lead.company}
Job Title: ${lead.jobTitle}
Industry: ${lead.industry}
Facility Type: ${lead.facilityType || "facility"}

Key points:
- Mention their specific facility type or industry
- Highlight one relevant pain point (peak demand charges, energy waste, etc.)
- Keep it casual and helpful, not salesy
- Include a soft CTA (open to chat, would love to connect, etc.)
- NO lengthy introductions
- NO bullet points or formatting

Write ONLY the message text, nothing else.`;

  const message = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 200,
    messages: [{ role: "user", content: prompt }],
  });

  return message.content[0].type === "text" ? message.content[0].text : "";
}

/**
 * Generate personalized cold email
 */
export async function generateColdEmail(
  lead: Partial<Lead>,
  sequenceStep: 1 | 2 | 3
): Promise<{ subject: string; body: string }> {
  const prompts = {
    1: `Write Email 1 of a 3-email cold outreach sequence for Enalysis (AI energy management platform).

Prospect:
Name: ${lead.firstName}
Company: ${lead.company}
Title: ${lead.jobTitle}
Industry: ${lead.industry}

Email 1 Goals:
- Hook with specific pain point (peak demand charges, energy waste)
- Mention impressive result (client saved $127K, reduced costs 28%, etc.)
- Include clear CTA (ROI calculator or demo booking)
- Keep under 150 words
- Professional but conversational

Return JSON:
{
  "subject": "...",
  "body": "..."
}`,

    2: `Write Email 2 (follow-up) of a 3-email sequence. Sent 4 days after Email 1 with no response.

Prospect:
Name: ${lead.firstName}
Company: ${lead.company}
Industry: ${lead.industry}

Email 2 Goals:
- Reference Email 1 briefly
- Add social proof (case study from similar industry)
- List 3 specific savings areas
- Strong CTA (book 15-min call)
- Keep under 120 words

Return JSON:
{
  "subject": "...",
  "body": "..."
}`,

    3: `Write Email 3 (breakup email) of a 3-email sequence. Sent 7 days after Email 1 with no response.

Prospect:
Name: ${lead.firstName}
Company: ${lead.company}

Email 3 Goals:
- Acknowledge they're not interested (humor/humility)
- Final value prop (free trial, no credit card)
- Leave door open
- Keep under 100 words
- Subject line should indicate this is the last email

Return JSON:
{
  "subject": "...",
  "body": "..."
}`,
  };

  const message = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 500,
    messages: [{ role: "user", content: prompts[sequenceStep] }],
  });

  const responseText = message.content[0].type === "text" ? message.content[0].text : "{}";

  try {
    // Extract JSON from response (may have markdown code blocks)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error("Failed to parse email JSON:", e);
  }

  return {
    subject: `Quick question about ${lead.company}'s energy costs`,
    body: `Hi ${lead.firstName},\n\nI noticed ${lead.company} operates in ${lead.industry}.\n\nMost facilities waste 20-30% on peak demand charges. We built an AI that finds these savings automatically.\n\nWant to see your potential savings?\n\nBest,\n[Your Name]`,
  };
}

/**
 * Generate LinkedIn post
 */
export async function generateLinkedInPost(topic: string): Promise<string> {
  const prompt = `You are a content creator for Enalysis, an AI-powered energy management platform.

Write a LinkedIn post about: "${topic}"

Guidelines:
- Start with a hook (surprising stat, bold claim, question)
- Tell a story or share a real example
- Include 1-2 insights about energy management
- End with engagement question or CTA
- Use line breaks for readability
- Keep under 1,200 characters
- NO hashtags
- Professional but conversational tone

Write ONLY the post text.`;

  const message = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  return message.content[0].type === "text" ? message.content[0].text : "";
}

/**
 * Generate blog post outline
 */
export async function generateBlogOutline(
  keyword: string,
  targetWordCount: number = 2000
): Promise<{
  title: string;
  metaDescription: string;
  outline: Array<{ heading: string; subheadings: string[] }>;
}> {
  const prompt = `You are an SEO content strategist for Enalysis (energy management SaaS).

Create a blog post outline optimized for the keyword: "${keyword}"

Target word count: ${targetWordCount}
Target audience: Energy managers, facilities managers, sustainability directors

Requirements:
- Title should be compelling and include keyword
- Meta description under 160 characters
- 5-7 H2 sections
- 2-4 H3 subheadings per H2
- Include sections for: problem, solution, benefits, case study, action steps

Return JSON:
{
  "title": "...",
  "metaDescription": "...",
  "outline": [
    {
      "heading": "H2 heading here",
      "subheadings": ["H3 here", "H3 here"]
    }
  ]
}`;

  const message = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const responseText = message.content[0].type === "text" ? message.content[0].text : "{}";

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error("Failed to parse blog outline JSON:", e);
  }

  return {
    title: `How to ${keyword}`,
    metaDescription: `Learn how to ${keyword} and reduce energy costs.`,
    outline: [],
  };
}

/**
 * Write full blog post section
 */
export async function writeBlogSection(
  heading: string,
  subheadings: string[],
  keyword: string,
  targetWordCount: number = 400
): Promise<string> {
  const prompt = `You are a content writer for Enalysis, an AI energy management platform.

Write the "${heading}" section of a blog post about "${keyword}".

Subheadings to cover:
${subheadings.map((s) => `- ${s}`).join("\n")}

Requirements:
- Target ${targetWordCount} words
- Include specific examples and data
- Use short paragraphs (2-3 sentences)
- Professional but accessible tone
- Include 1-2 Enalysis mentions where natural
- NO salesy language

Write the section in markdown format with H3 subheadings.`;

  const message = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  return message.content[0].type === "text" ? message.content[0].text : "";
}

// ===== RESPONSE HANDLING =====

/**
 * Analyze inbound lead response and suggest next action
 */
export async function analyzeLeadResponse(
  lead: Partial<Lead>,
  responseText: string
): Promise<{
  intent: "high" | "medium" | "low" | "not_interested";
  suggestedAction: string;
  draftReply?: string;
}> {
  const prompt = `You are an AI sales assistant for Enalysis.

A prospect responded to our outreach:

Prospect: ${lead.firstName} ${lead.lastName} (${lead.jobTitle} at ${lead.company})
Their response: "${responseText}"

Analyze their intent level and suggest the best next action.

Return JSON:
{
  "intent": "high" | "medium" | "low" | "not_interested",
  "suggestedAction": "book_demo" | "send_case_study" | "send_pricing" | "follow_up_later" | "remove_from_list",
  "draftReply": "Suggested reply text (if applicable)"
}`;

  const message = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  const responseTextAI = message.content[0].type === "text" ? message.content[0].text : "{}";

  try {
    const jsonMatch = responseTextAI.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error("Failed to parse response analysis JSON:", e);
  }

  return {
    intent: "medium",
    suggestedAction: "Manual review needed",
  };
}

// ===== AUTOMATION WORKFLOWS =====

/**
 * Auto-generate personalized outreach for a lead
 */
export async function automateLeadOutreach(
  lead: Partial<Lead>,
  channel: "linkedin" | "email"
): Promise<{ message: string; subject?: string }> {
  if (channel === "linkedin") {
    const message = await generateLinkedInMessage(lead);
    return { message };
  } else {
    const email = await generateColdEmail(lead, 1);
    return { message: email.body, subject: email.subject };
  }
}

/**
 * Daily content generator - creates posts/emails for the week
 */
export async function generateWeeklyContent(): Promise<{
  linkedinPosts: Array<{ day: string; topic: string; post: string }>;
  blogIdeas: Array<{ keyword: string; title: string }>;
}> {
  // LinkedIn post topics
  const topics = [
    "How we saved a client $127K last year",
    "Peak demand charges explained",
    "Why most buildings waste 30% on energy",
    "AI vs traditional energy management",
    "Case study: Data center reduced costs 28%",
  ];

  const linkedinPosts = await Promise.all(
    topics.slice(0, 5).map(async (topic, i) => ({
      day: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"][i],
      topic,
      post: await generateLinkedInPost(topic),
    }))
  );

  // Blog post ideas
  const keywords = [
    "reduce peak demand charges",
    "time of use electricity optimization",
    "energy management software for manufacturing",
    "data center energy optimization",
    "commercial building energy monitoring",
  ];

  const blogIdeas = await Promise.all(
    keywords.map(async (keyword) => {
      const outline = await generateBlogOutline(keyword);
      return { keyword, title: outline.title };
    })
  );

  return { linkedinPosts, blogIdeas };
}

// ===== USAGE EXAMPLES =====

/*
// Example 1: Score a lead
const lead = {
  firstName: "John",
  lastName: "Smith",
  email: "john@acme.com",
  company: "Acme Manufacturing",
  jobTitle: "Energy Manager",
  industry: "Manufacturing",
  facilityType: "Manufacturing Plant",
  location: "Toronto, ON"
};

const score = await scoreLead(lead);
console.log(`Lead score: ${score}/100`);

// Example 2: Generate LinkedIn message
const linkedinMsg = await generateLinkedInMessage(lead);
console.log(linkedinMsg);

// Example 3: Generate cold email sequence
const email1 = await generateColdEmail(lead, 1);
const email2 = await generateColdEmail(lead, 2);
const email3 = await generateColdEmail(lead, 3);

// Example 4: Generate LinkedIn posts for the week
const content = await generateWeeklyContent();
content.linkedinPosts.forEach(post => {
  console.log(`${post.day}: ${post.topic}`);
  console.log(post.post);
  console.log("---");
});

// Example 5: Analyze inbound response
const analysis = await analyzeLeadResponse(lead, "This looks interesting. Can you send me pricing?");
console.log(`Intent: ${analysis.intent}`);
console.log(`Action: ${analysis.suggestedAction}`);
console.log(`Reply: ${analysis.draftReply}`);
*/

export default {
  scoreLead,
  generateLinkedInMessage,
  generateColdEmail,
  generateLinkedInPost,
  generateBlogOutline,
  writeBlogSection,
  analyzeLeadResponse,
  automateLeadOutreach,
  generateWeeklyContent,
};
