import type { ProductItem, Exhibition, Creator, Story, ScenePost, FeedItem } from '../types';
import { readConsumerCatalog } from '@/lib/products/consumer-catalog';

export const fiveStoreDemoProducts: ProductItem[] = readConsumerCatalog();
export const productsList = fiveStoreDemoProducts;
export const exhibitionsList: Exhibition[] = [];
export const scenePostsList: ScenePost[] = [];
export const sampleCreator: Creator | null = null;
export const sampleStory: Story | null = null;
export const feedItemsList: FeedItem[] = productsList.map((product) => ({ type: 'product', product }));
