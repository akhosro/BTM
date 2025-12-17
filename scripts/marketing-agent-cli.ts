/**
 * Marketing Agent CLI
 *
 * Command-line tool to use the marketing automation agent
 *
 * Usage:
 *   npm run marketing:score-lead
 *   npm run marketing:generate-linkedin
 *   npm run marketing:generate-email
 *   npm run marketing:weekly-content
 *   npm run marketing:analyze-response
 */

import {
  scoreL,
  generateLinkedInMessage,
  generateColdEmail,
  generateLinkedInPost,
  generateBlogOutline,
  writeBlogSection,
  analyzeLeadResponse,
  generateWeeklyContent,
} from "../lib/marketing/automation-agent";

// Sample lead data for testing
const sampleLead = {
  firstName: "Sarah",
  lastName: "Johnson",
  email: "sarah.johnson@acmemanufacturing.com",
  company: "Acme Manufacturing",
  jobTitle: "Energy Manager",
  industry: "Manufacturing",
  facilityType: "Manufacturing Plant",
  location: "Toronto, ON",
};

async function main() {
  const command = process.argv[2];

  console.log("\n🤖 Enalysis Marketing Automation Agent\n");
  console.log("═══════════════════════════════════════════════════════════\n");

  switch (command) {
    case "score-lead":
      await scoreLeadDemo();
      break;

    case "generate-linkedin":
      await generateLinkedInDemo();
      break;

    case "generate-email":
      await generateEmailDemo();
      break;

    case "generate-post":
      await generatePostDemo();
      break;

    case "blog-outline":
      await blogOutlineDemo();
      break;

    case "weekly-content":
      await weeklyContentDemo();
      break;

    case "analyze-response":
      await analyzeResponseDemo();
      break;

    default:
      showHelp();
  }

  console.log("\n═══════════════════════════════════════════════════════════\n");
}

function showHelp() {
  console.log("Available Commands:\n");
  console.log("  score-lead           - Score a sample lead (0-100)");
  console.log("  generate-linkedin    - Generate LinkedIn connection message");
  console.log("  generate-email       - Generate cold email sequence (3 emails)");
  console.log("  generate-post        - Generate LinkedIn post");
  console.log("  blog-outline         - Generate blog post outline");
  console.log("  weekly-content       - Generate content for the week");
  console.log("  analyze-response     - Analyze a lead's response\n");
  console.log("Usage:");
  console.log("  npx tsx scripts/marketing-agent-cli.ts <command>\n");
  console.log("Examples:");
  console.log("  npx tsx scripts/marketing-agent-cli.ts generate-linkedin");
  console.log("  npx tsx scripts/marketing-agent-cli.ts weekly-content");
}

async function scoreLeadDemo() {
  console.log("📊 LEAD SCORING\n");
  console.log("Lead Details:");
  console.log(`  Name: ${sampleLead.firstName} ${sampleLead.lastName}`);
  console.log(`  Company: ${sampleLead.company}`);
  console.log(`  Title: ${sampleLead.jobTitle}`);
  console.log(`  Industry: ${sampleLead.industry}\n`);

  console.log("⏳ Scoring lead...\n");

  const score = await scoreL(sampleLead);

  console.log(`✅ Lead Score: ${score}/100\n`);

  if (score >= 80) {
    console.log("🔥 HIGH PRIORITY - Reach out immediately!");
  } else if (score >= 60) {
    console.log("✅ GOOD FIT - Add to outreach sequence");
  } else if (score >= 40) {
    console.log("⚠️  MEDIUM FIT - Consider nurturing campaign");
  } else {
    console.log("❌ LOW FIT - Deprioritize or skip");
  }
}

async function generateLinkedInDemo() {
  console.log("💼 LINKEDIN CONNECTION MESSAGE\n");
  console.log("Generating personalized message for:");
  console.log(`  ${sampleLead.firstName} ${sampleLead.lastName}`);
  console.log(`  ${sampleLead.jobTitle} at ${sampleLead.company}\n`);

  console.log("⏳ Generating...\n");

  const message = await generateLinkedInMessage(sampleLead);

  console.log("✅ Generated Message:\n");
  console.log("─".repeat(60));
  console.log(message);
  console.log("─".repeat(60));
  console.log("\n📝 Character count:", message.length, "/300");
}

async function generateEmailDemo() {
  console.log("📧 COLD EMAIL SEQUENCE\n");
  console.log("Generating 3-email sequence for:");
  console.log(`  ${sampleLead.firstName} ${sampleLead.lastName}`);
  console.log(`  ${sampleLead.company}\n`);

  for (let step of [1, 2, 3] as const) {
    console.log(`\n⏳ Generating Email ${step}...\n`);

    const email = await generateColdEmail(sampleLead, step);

    console.log(`✅ EMAIL ${step}:\n`);
    console.log("─".repeat(60));
    console.log(`Subject: ${email.subject}\n`);
    console.log(email.body);
    console.log("─".repeat(60));

    if (step === 1) {
      console.log("\n📅 Send: Immediately");
    } else if (step === 2) {
      console.log("\n📅 Send: 4 days after Email 1 (if no response)");
    } else {
      console.log("\n📅 Send: 7 days after Email 1 (breakup email)");
    }
  }
}

async function generatePostDemo() {
  console.log("📱 LINKEDIN POST GENERATOR\n");

  const topics = [
    "How we saved a client $127K last year",
    "Why most buildings waste 30% on energy costs",
    "Peak demand charges explained in simple terms",
  ];

  console.log("Select a topic:");
  topics.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));

  const topicIndex = 0; // Default to first topic
  const topic = topics[topicIndex];

  console.log(`\n⏳ Generating post about: "${topic}"\n`);

  const post = await generateLinkedInPost(topic);

  console.log("✅ Generated Post:\n");
  console.log("─".repeat(60));
  console.log(post);
  console.log("─".repeat(60));
  console.log("\n📝 Character count:", post.length, "/3,000");
  console.log("💡 Best time to post: Tuesday-Thursday, 8-10 AM EST");
}

async function blogOutlineDemo() {
  console.log("📝 BLOG POST OUTLINE GENERATOR\n");

  const keyword = "reduce peak demand charges";

  console.log(`Target Keyword: "${keyword}"`);
  console.log("Target Word Count: 2,000\n");

  console.log("⏳ Generating outline...\n");

  const outline = await generateBlogOutline(keyword, 2000);

  console.log("✅ Generated Outline:\n");
  console.log("─".repeat(60));
  console.log(`TITLE: ${outline.title}\n`);
  console.log(`META DESCRIPTION: ${outline.metaDescription}\n`);
  console.log("OUTLINE:");

  outline.outline.forEach((section, i) => {
    console.log(`\n${i + 1}. ${section.heading}`);
    section.subheadings.forEach((sub) => {
      console.log(`   - ${sub}`);
    });
  });

  console.log("─".repeat(60));
  console.log("\n💡 Next: Use writeBlogSection() to write each section");
}

async function weeklyContentDemo() {
  console.log("📅 WEEKLY CONTENT GENERATOR\n");
  console.log("⏳ Generating content plan for the week...\n");

  const content = await generateWeeklyContent();

  console.log("✅ LINKEDIN POSTS (5 for the week):\n");
  console.log("─".repeat(60));

  content.linkedinPosts.forEach((post) => {
    console.log(`\n${post.day.toUpperCase()}: ${post.topic}`);
    console.log(`\n${post.post}`);
    console.log("\n" + "─".repeat(60));
  });

  console.log("\n✅ BLOG POST IDEAS:\n");
  console.log("─".repeat(60));

  content.blogIdeas.forEach((idea, i) => {
    console.log(`\n${i + 1}. ${idea.title}`);
    console.log(`   Keyword: "${idea.keyword}"`);
  });

  console.log("\n" + "─".repeat(60));
  console.log("\n💡 Schedule these posts in your social media tool");
  console.log("💡 Assign blog posts to writers or use AI to draft");
}

async function analyzeResponseDemo() {
  console.log("🔍 RESPONSE ANALYSIS\n");

  const responses = [
    "This looks interesting! Can you send me pricing info?",
    "Not interested right now, maybe in 6 months",
    "Please remove me from your list",
    "Would love to see a demo. When are you available?",
  ];

  console.log("Analyzing different prospect responses:\n");

  for (const response of responses) {
    console.log("─".repeat(60));
    console.log(`\nProspect Response: "${response}"\n`);

    console.log("⏳ Analyzing...\n");

    const analysis = await analyzeLeadResponse(sampleLead, response);

    console.log("✅ Analysis:");
    console.log(`   Intent Level: ${analysis.intent.toUpperCase()}`);
    console.log(`   Suggested Action: ${analysis.suggestedAction}`);

    if (analysis.draftReply) {
      console.log(`\n   Draft Reply:\n   "${analysis.draftReply}"`);
    }

    console.log("");
  }

  console.log("─".repeat(60));
}

main().catch((error) => {
  console.error("\n❌ Error:", error.message);
  process.exit(1);
});
