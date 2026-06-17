import type {
  ImageModelV3,
  ImageModelV3CallOptions,
} from '@ai-sdk/provider';
import { T2I_MODELS, I2I_MODELS } from './model-registry';
import { MuApiError } from './muapi-error';

const BASE_URL = 'https://api.muapi.ai/api/v1';

export class MuApiImageModel implements ImageModelV3 {
  readonly specificationVersion = 'v3' as const;
  readonly provider = 'muapi';
  readonly maxImagesPerCall = 1;

  constructor(
    readonly modelId: string,
    private readonly apiKey: string,
  ) {}

  async doGenerate(options: ImageModelV3CallOptions) {
    const endpoint = T2I_MODELS[this.modelId] ?? I2I_MODELS[this.modelId];
    if (!endpoint) {
      throw new MuApiError(`Unknown model: ${this.modelId}`);
    }

    const payload: Record<string, unknown> = {
      prompt: options.prompt,
      n: options.n ?? 1,
    };
    if (options.size) {
      const [width, height] = options.size.split('x').map(Number);
      if (width) payload.width = width;
      if (height) payload.height = height;
    }
    if (options.aspectRatio) payload.aspect_ratio = options.aspectRatio;
    if (options.providerOptions?.muapi) {
      Object.assign(payload, options.providerOptions.muapi);
    }

    const { request_id } = await this.post(endpoint, payload);
    const outputs = await this.poll(request_id);

    const timestamp = new Date();
    return {
      images: outputs as string[],
      warnings: [] as [],
      response: {
        timestamp,
        modelId: this.modelId,
        headers: undefined,
      },
    };
  }

  private async post(endpoint: string, body: unknown): Promise<{ request_id: string }> {
    const res = await fetch(`${BASE_URL}/${endpoint}`, {
      method: 'POST',
      headers: { 'x-api-key': this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new MuApiError(err.detail ?? res.statusText, res.status);
    }
    return res.json();
  }

  private async poll(requestId: string): Promise<string[]> {
    while (true) {
      const res = await fetch(`${BASE_URL}/predictions/${requestId}/result`, {
        headers: { 'x-api-key': this.apiKey },
      });
      if (!res.ok) throw new MuApiError(`Poll failed: ${res.statusText}`, res.status);
      const data = await res.json();
      if (data.status === 'completed') return data.outputs;
      if (data.status === 'failed') throw new MuApiError(data.error ?? 'Image generation failed');
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}
