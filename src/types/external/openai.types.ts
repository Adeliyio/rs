/* ------------------------------------------------------------------ */
/*  OpenAI external API types                                         */
/* ------------------------------------------------------------------ */

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/* ---------- Extraction (vision / structured output) ---------- */

export interface ExtractionTextContent {
  type: 'text';
  text: string;
}

export interface ExtractionImageContent {
  type: 'image_url';
  image_url: { url: string; detail?: 'auto' | 'low' | 'high' };
}

export type ExtractionContentPart = ExtractionTextContent | ExtractionImageContent;

export interface ExtractionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ExtractionContentPart[];
}

export interface ExtractionResponseFormat {
  type: 'json_object' | 'json_schema';
  json_schema?: {
    name: string;
    strict?: boolean;
    schema: Record<string, unknown>;
  };
}

export interface ExtractionRequest {
  model: string;
  messages: ExtractionMessage[];
  response_format?: ExtractionResponseFormat;
}

export interface ExtractionFieldConfidence {
  value: unknown;
  confidence: number;
}

export interface ExtractionResponse {
  parsed: Record<string, ExtractionFieldConfidence>;
  raw: string;
  usage: TokenUsage;
}

/* ---------- Generation (letter / document drafting) ---------- */

export interface GenerationRequest {
  model: string;
  system_prompt: string;
  user_content: string;
  grounding_context: string;
  max_tokens: number;
  temperature: number;
}

export interface GenerationResponse {
  content: string;
  usage: TokenUsage;
  finish_reason: 'stop' | 'length' | 'content_filter';
}
