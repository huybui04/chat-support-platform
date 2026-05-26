import { Injectable, Logger } from '@nestjs/common';

type AutoReplyInput = {
  channel: string;
  campaignName?: string | null;
  customerName?: string | null;
  customerMessage: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

const DEFAULT_SYSTEM_PROMPT =
  'You are a customer support assistant. Reply briefly, clearly, and politely. Ask at most one clarifying question. Respond in Vietnamese.';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  isAutoReplyEnabled(channel: string) {
    const rawEnabled = process.env.AI_AUTO_REPLY_ENABLED?.trim();
    if (rawEnabled !== '1' && rawEnabled?.toLowerCase() !== 'true') {
      return false;
    }

    const allowedChannels = this.resolveAllowedChannels();
    if (allowedChannels.size === 0) {
      return true;
    }

    return allowedChannels.has(channel.trim().toLowerCase());
  }

  async generateAutoReply(input: AutoReplyInput): Promise<string | null> {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return null;
    }

    const message = input.customerMessage.trim();
    if (!message) {
      return null;
    }

    if (!this.isEligibleForAutoReply(message)) {
      return null;
    }

    const model =
      this.normalizeModelName(process.env.GEMINI_MODEL?.trim()) ||
      'gemini-1.5-flash';
    const systemPrompt =
      process.env.AI_AUTO_REPLY_SYSTEM_PROMPT?.trim() || DEFAULT_SYSTEM_PROMPT;

    const maxOutputTokens = this.parseNumber(
      process.env.AI_AUTO_REPLY_MAX_OUTPUT_TOKENS,
      256,
    );
    const temperature = this.parseNumber(
      process.env.AI_AUTO_REPLY_TEMPERATURE,
      0.4,
    );
    const maxInputChars = this.parseNumber(
      process.env.AI_AUTO_REPLY_MAX_INPUT_CHARS,
      1500,
    );

    const prompt = this.buildPrompt({
      ...input,
      customerMessage: message.slice(0, maxInputChars),
    });

    try {
      const primary = await this.requestCompletion({
        apiKey,
        model,
        prompt,
        systemPrompt,
        maxOutputTokens,
        temperature,
      });

      if (primary?.text) {
        return primary.text;
      }

      if (primary?.status !== 404) {
        return null;
      }

      const fallbackModel = await this.resolveFirstAvailableModel(apiKey);
      if (!fallbackModel || fallbackModel === model) {
        return null;
      }

      const fallback = await this.requestCompletion({
        apiKey,
        model: fallbackModel,
        prompt,
        systemPrompt,
        maxOutputTokens,
        temperature,
      });

      if (fallback?.text) {
        this.logger.warn(
          `Gemini auto-reply: fallback model selected (${fallbackModel}).`,
        );
      }

      return fallback?.text ?? null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_error';
      this.logger.warn(`Gemini auto-reply error: ${message}`);
      return null;
    }
  }

  private async requestCompletion(input: {
    apiKey: string;
    model: string;
    prompt: string;
    systemPrompt: string;
    maxOutputTokens: number;
    temperature: number;
  }) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent?key=${encodeURIComponent(input.apiKey)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: input.systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: input.prompt }] }],
        generationConfig: {
          maxOutputTokens: input.maxOutputTokens,
          temperature: input.temperature,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.warn(
        `Gemini auto-reply failed (${response.status}): ${errorBody}`,
      );
      return { status: response.status, text: null as string | null };
    }

    const payload = (await response.json()) as GeminiResponse;
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text ?? null;

    return { status: response.status, text: text?.trim() || null };
  }

  private async resolveFirstAvailableModel(apiKey: string) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      );

      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as {
        models?: Array<{
          name?: string;
          supportedGenerationMethods?: string[];
        }>;
      };

      const models = payload.models ?? [];
      const candidate = models.find((item) =>
        (item.supportedGenerationMethods ?? []).includes('generateContent'),
      );

      return this.normalizeModelName(candidate?.name) ?? null;
    } catch {
      return null;
    }
  }

  private normalizeModelName(value?: string | null) {
    if (!value) {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    return trimmed.startsWith('models/')
      ? trimmed.slice('models/'.length)
      : trimmed;
  }

  private buildPrompt(input: AutoReplyInput) {
    const campaign = input.campaignName?.trim() || 'Support';
    const customer = input.customerName?.trim() || 'Customer';
    const channel = input.channel.trim().toLowerCase();

    return [
      `Channel: ${channel}`,
      `Campaign: ${campaign}`,
      `Customer: ${customer}`,
      `Message: ${input.customerMessage}`,
      'Reply:',
    ].join('\n');
  }

  private resolveAllowedChannels() {
    const rawChannels = process.env.AI_AUTO_REPLY_CHANNELS?.trim();
    if (!rawChannels) {
      return new Set<string>();
    }

    return new Set(
      rawChannels
        .split(/[,\s]+/g)
        .map((channel) => channel.trim().toLowerCase())
        .filter(Boolean),
    );
  }

  private parseNumber(value: string | undefined, fallback: number) {
    if (!value) {
      return fallback;
    }

    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }

    return fallback;
  }

  private isEligibleForAutoReply(message: string) {
    const normalized = message.toLowerCase();

    if (this.isGreetingMessage(normalized)) {
      return true;
    }

    if (this.isSimpleFaqMessage(normalized)) {
      return true;
    }

    return false;
  }

  private isGreetingMessage(message: string) {
    const greetings = [
      'hello',
      'hi',
      'hey',
      'good morning',
      'good afternoon',
      'good evening',
      'xin chao',
      'chao',
      'chao ban',
      'alo',
      'hey there',
    ];

    return greetings.some((token) => message.includes(token));
  }

  private isSimpleFaqMessage(message: string) {
    const faqKeywords = [
      'gia',
      'bao nhieu',
      'price',
      'phi',
      'cost',
      'ho tro',
      'support',
      'lien he',
      'contact',
      'gio lam viec',
      'working hours',
      'dia chi',
      'address',
      'huong dan',
      'cach',
      'how to',
      'how do i',
      'account',
      'dang nhap',
      'mat khau',
      'reset',
      'doi mat khau',
      'bao hanh',
      'warranty',
      'ship',
      'van chuyen',
      'giao hang',
      'thoi gian giao',
    ];

    return faqKeywords.some((token) => message.includes(token));
  }
}
