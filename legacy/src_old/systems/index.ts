// Register every available game system here. This is the ONE place that imports
// concrete systems; the rest of the app works through the registry.
import { register } from './registry';
import { v20System } from './v20';

register(v20System);

export * from './registry';
export type * from './types';
