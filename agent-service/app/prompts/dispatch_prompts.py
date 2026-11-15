"""Prompts for the Review & Dispatch Agent (evaluation and regeneration)."""

EVAL_PROMPT_TEMPLATE = """You are a strict QA evaluator for cold outreach emails sent to local businesses.

Target Business Context:
- Name: {name}
- Category: {category}
- Rating: {rating} ({reviews} reviews)
- Address: {address}
- Classification: {classification}

Current Email Draft:
Subject: {subject}
Body:
{body}

Evaluation Criteria:
1. Is it personalized to {name} specifically?
2. Is the tone professional, friendly, and non-spammy?
3. Is there a clear, low-friction call-to-action (CTA)?
4. Is it concise (under 150 words)?

Instructions:
Provide a 2-sentence critique analyzing the draft against the criteria above.
End your response with EXACTLY one of these two decision tags on a new line:
DECISION: GOOD
DECISION: NEEDS_REVISION"""


REGEN_PROMPT_TEMPLATE = """You are an expert cold email copywriter. Rewrite the following email draft based on feedback.

Business Context:
- Name: {name}
- Category: {category}
- Rating: {rating} ({reviews} reviews)
- Classification: {classification}
- Angle: {template_type}

Current Subject: {current_subject}
Current Body:
{current_body}

Feedback / Required Improvements:
{feedback}

Instructions:
- Keep the email under 120 words.
- Maintain a direct, helpful, non-pushy tone.
- Return ONLY valid JSON in this exact structure:
{{
  "subject": "...",
  "body": "..."
}}"""
