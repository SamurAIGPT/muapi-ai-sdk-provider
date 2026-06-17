import type {
  Experimental_VideoModelV3 as VideoModelV3,
  Experimental_VideoModelV3CallOptions as VideoModelV3CallOptions,
} from '@ai-sdk/provider';
import { T2V_MODELS, I2V_MODELS, LIST_INPUT_I2V } from './model-registry';
import { MuApiError } from './muapi-error';

const BASE_URL = 'https://api.muapi.ai/api/v1';

export class MuApiVideoModel implements VideoModelV3 {
  readonly specificationVersion = 'v3' as const;
  readonly provider = 'muapi';
  readonly maxVideosPerCall = 1;

  constructor(
    readonly modelId: string,
    private readonly apiKey: string,
    private readonly mode: 'text-to-video' | 'image-to-video' = 'text-to-video',
  ) {}

  async doGenerate(options: VideoModelV3CallOptions) {
    const registry = this.mode === 'image-to-video' ? I2V_MODELS : T2V_MODELS;
    const endpoint = registry[this.modelId];
    if (!endpoint) {
      throw new MuApiError(`Unknown model: ${this.modelId}`);
    }

    const payload: Record<string, unknown> = {
      prompt: options.prompt,
      duration: (options.providerOptions?.muapi?.duration as number) ?? 5,
      aspect_ratio: options.aspectRatio ?? '16:9',
    };

    // image-to-video: attach image input
    if (this.mode === 'image-to-video' && options.providerOptions?.muapi?.image_url) {
      const imageUrl = options.providerOptions.muapi.image_url as string;
      if (LIST_INPUT_I2V.has(this.modelId)) {
        payload.images_list = [imageUrl];
      } else {
        payload.image_url = imageUrl;
      }
    }

    if (options.providerOptions?.muapi) {
      const { image_url, ...rest } = options.providerOptions.muapi as Record<string, unknown>;
      Object.assign(payload, rest);
    }

    const { request_id } = await this.post(endpoint, payload);
    const videoUrl = await this.poll(request_id);

    const timestamp = new Date();
    return {
      videos: [{ type: 'url' as const, url: videoUrl, mediaType: 'video/mp4' }],
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

  private async poll(requestId: string): Promise<string> {
    while (true) {
      const res = await fetch(`${BASE_URL}/predictions/${requestId}/result`, {
        headers: { 'x-api-key': this.apiKey },
      });
      if (!res.ok) throw new MuApiError(`Poll failed: ${res.statusText}`, res.status);
      const data = await res.json();
      if (data.status === 'completed') return data.outputs[0];
      if (data.status === 'failed') throw new MuApiError(data.error ?? 'Video generation failed');
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}
