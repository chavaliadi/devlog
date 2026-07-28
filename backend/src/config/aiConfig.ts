import dotenv from 'dotenv';

dotenv.config();

/**
 * AI Model Routing Configuration for DevLog
 *
 * Primary Models:
 * - SUMMARY_MODEL: DevLog daily summary generation & resume bullets (120B tier for rationale inference & strict markdown/JSON layout)
 * - COMMIT_MODEL: Single-commit active-voice technical rationale summaries (20B tier for high-volume, lower latency)
 * - FALLBACK_MODEL: Shared retry fallback for all AI call sites when primary model fails
 */
export const SUMMARY_MODEL = process.env.GROQ_SUMMARY_MODEL || process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
export const COMMIT_MODEL = process.env.GROQ_COMMIT_MODEL || process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
export const FALLBACK_MODEL = process.env.GROQ_FALLBACK_MODEL || 'qwen/qwen3.6-27b';
