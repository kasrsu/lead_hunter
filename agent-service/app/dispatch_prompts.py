"""Prompt templates for dispatch agent evaluation & regeneration.

Re-exports prompts from app.prompts.dispatch_prompts.
"""

from .prompts.dispatch_prompts import EVAL_PROMPT_TEMPLATE, REGEN_PROMPT_TEMPLATE

__all__ = ["EVAL_PROMPT_TEMPLATE", "REGEN_PROMPT_TEMPLATE"]
