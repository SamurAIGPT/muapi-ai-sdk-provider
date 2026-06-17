import { MuApiImageModel } from './muapi-image-model';
import { MuApiVideoModel } from './muapi-video-model';

export interface MuApiProviderOptions {
  apiKey?: string;
}

export interface MuApiProvider {
  /**
   * Text-to-image or image-to-image generation.
   * Model IDs: 'flux-schnell', 'flux-dev', 'hidream-fast', 'midjourney', 'veo4', etc.
   */
  image(modelId: string): MuApiImageModel;

  /**
   * Text-to-video generation.
   * Model IDs: 'veo3-fast', 'kling-master', 'wan2.2', 'seedance-pro', 'runway', etc.
   */
  video(modelId: string): MuApiVideoModel;

  /**
   * Image-to-video generation.
   * Model IDs: 'kling-master', 'veo3', 'wan2.5', 'seedance-2', etc.
   */
  imageToVideo(modelId: string): MuApiVideoModel;
}

export function createMuapi(options: MuApiProviderOptions = {}): MuApiProvider {
  const apiKey = options.apiKey ?? process.env.MUAPI_API_KEY ?? '';

  if (!apiKey) {
    throw new Error(
      'MuAPI API key is required. Pass apiKey or set MUAPI_API_KEY env var.',
    );
  }

  return {
    image: (modelId) => new MuApiImageModel(modelId, apiKey),
    video: (modelId) => new MuApiVideoModel(modelId, apiKey, 'text-to-video'),
    imageToVideo: (modelId) => new MuApiVideoModel(modelId, apiKey, 'image-to-video'),
  };
}

export const muapi = createMuapi();
