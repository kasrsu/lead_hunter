"""Prompt templates for agent nodes."""
from .enrichment_prompts import (
    DRAFT_PROMPT_TEMPLATE,
    CRITIQUE_PROMPT_TEMPLATE,
    REVISE_PROMPT_TEMPLATE,
)
from .dispatch_prompts import EVAL_PROMPT_TEMPLATE, REGEN_PROMPT_TEMPLATE

__all__ = [
    "DRAFT_PROMPT_TEMPLATE",
    "CRITIQUE_PROMPT_TEMPLATE",
    "REVISE_PROMPT_TEMPLATE",
    "EVAL_PROMPT_TEMPLATE",
    "REGEN_PROMPT_TEMPLATE",
]
