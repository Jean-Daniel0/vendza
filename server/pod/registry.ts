import type { PodAdapter } from './types';
import { dprinting } from './dprinting';

const adapters = new Map<string, PodAdapter>([[dprinting.slug, dprinting]]);

export const getPodAdapter = (slug: string): PodAdapter | undefined => adapters.get(slug);
export const registerPodAdapter = (adapter: PodAdapter) => { adapters.set(adapter.slug, adapter); };
