"""Prompts for the Lead Enrichment Agent (drafting, critique, revision)."""

DRAFT_PROMPT_TEMPLATE = """You are writing a deeply personalized, authentic outreach email body on behalf of Anusara Sugeeshwara, Marketing team at EvoSolutions.

Our offer: {offer_description}

TARGET BUSINESS PROFILE & METRICS:
- Business Name: {business_name}
- Category: {category}
- Rating: {rating}/5
- Review Volume: {reviews_count} reviews
- Address / Location: {address}
- Review Snippet: {review_snippet}
- Website: {website}
- Lead Score: {lead_score}/100
- Strategic Classification: {classification}
- Recommended Angle: {angle}

EVALUATION RUBRIC & STRATEGIC INSIGHTS:
- Rubric Breakdown: {rubric_scores_formatted}
- Strategic Justifications:
{rubric_justifications_formatted}

RESEARCH BRIEF & BACKGROUND:
{research_brief}

CRITICAL RULES:
1. SUBJECT: Must be formatted exactly as:
Outreach & Partnership Proposal - {business_name}

2. SALUTATION:
Must start with:
Dear {business_name} Team,

3. DEEPLY PERSONALIZED 3-PART BODY STRUCTURE (DO NOT COPY-PASTE STATIC TEMPLATES!):

- PART 1 (WARM GREETING & TAILORED OBSERVATION):
  * Open with: "Greetings from EvoSolutions! I'm Anusara Sugeeshwara from our marketing team."
  * Next, write a unique, authentic sentence acknowledging {business_name} based on their scale & reputation:
    - If high review volume (500+ reviews): Recognize them as a major local dining icon / high-traffic landmark in {address}.
    - If high rating with growing reviews: Recognize them as an impressive rising culinary gem setting high standards.
    - Naturally incorporate their exact rating ({rating}/5) and review volume ({reviews_count} reviews) in a fluid, conversational way.

- PART 2 (Tailored EvoSolutions Intro):
  * Write 1 sentence explaining what EvoSolutions does (smart POS, real-time kitchen display sync, table management, direct ordering) tailored specifically to their category ({category}).

- PART 3 (Strategic Value Bullet Points):
  * Provide 2 to 3 clean, natural bullet points (starting with -) offering specific operational benefits directly tied to their scale, location ({address}), or strategic angle ({angle}). Avoid generic fluff.

4. STRICT OMISSION RULE (NO OUTROS OR CONTACT DETAILS):
- DO NOT write any closing proposal summary, system outro, call-to-action, website links (evosolutions.lk), phone numbers, email addresses, opt-out messages, or signature blocks.
- Stop immediately after the bullet points! The closing proposal invitation, polite opt-out reply note, website link, phone number (0751800804), email (hello@evosolutions.lk), and signature block are ALL automatically appended by our system as a hardcoded postfix for every email.

Respond in exactly this format, nothing else:
SUBJECT: Outreach & Partnership Proposal - {business_name}
BODY:
Dear {business_name} Team,

Greetings from EvoSolutions! I'm Anusara Sugeeshwara from our marketing team. <authentic personalized sentence about {business_name} referencing rating {rating}/5 and {reviews_count} reviews in {address}>

<1 sentence tailored EvoSolutions intro connecting our software to {category}>

- <tailored bullet point 1: kitchen display sync or operational speed>
- <tailored bullet point 2: front-of-house table pacing or guest coordination>
- <tailored bullet point 3: direct order margin protection or inventory control>"""


CRITIQUE_PROMPT_TEMPLATE = """Review this cold outreach email draft against these required rules:
1. Subject ends with "- {business_name}"
2. Salutation starts with "Dear {business_name} Team,"
3. Body opens warmly with "Greetings from EvoSolutions! I'm Anusara Sugeeshwara...", followed by a uniquely tailored observation (with exact rating {rating}/5 and review count {reviews_count}), a relevant EvoSolutions product intro, and 2-3 tailored bullet points.
4. DOES NOT contain any closing proposal summary, system outro, CTA, website links, phone numbers, email addresses, opt-out text, or manual sign-off signature block (these are appended automatically by the system postfix)

Subject: {subject}
Body:
{body}

If it passes all rules, respond with exactly: APPROVE
If it fails any rule, respond with: REVISE: <one sentence explanation of what to fix>"""


REVISE_PROMPT_TEMPLATE = """Revise this cold email draft so it is deeply personalized and strategically tailored to {business_name}, avoiding static boilerplate text.

Target business: {business_name}
Rating: {rating}/5 | Reviews: {reviews_count} | Location: {address}

Current draft:
SUBJECT: {subject}
BODY:
{body}

Feedback:
{review_notes}

Remember:
- Open with "Greetings from EvoSolutions! I'm Anusara Sugeeshwara...", then write an authentic observation tailored to {business_name}'s scale and rating ({rating}/5 across {reviews_count} reviews).
- Include 1 sentence explaining EvoSolutions' software for {business_name}, followed by 2-3 clean, tailored bullet points (-).
- DO NOT write any closing proposal summary, system outro, call-to-action, website links, phone numbers, email addresses, opt-out messages, or manual sign-off signature blocks at the end (the system appends the hardcoded postfix automatically).

Respond in exactly this format, nothing else:
SUBJECT: Outreach & Partnership Proposal - {business_name}
BODY:
Dear {business_name} Team,

Greetings from EvoSolutions! I'm Anusara Sugeeshwara from our marketing team. <authentic observation about {business_name}>

<1 sentence tailored EvoSolutions intro>

- <tailored bullet point 1>
- <tailored bullet point 2>"""

