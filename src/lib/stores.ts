import { writable } from 'svelte/store';
import type { WidgetData, CanvasTransform } from './types';

// Canvas transformation store
export const canvasTransform = writable<CanvasTransform>({
    panX: 0,
    panY: 0,
    zoom: 1,
});

// Widget data store
export const widgets = writable<WidgetData[]>([]);

// Loading states store
export const isLoadingWidgets = writable<boolean>(false);
export const apiError = writable<string | null>(null);

// Error probability for MockApiService (0 to 1)
export const errorProbability = writable<number>(0.15); // Default 15%