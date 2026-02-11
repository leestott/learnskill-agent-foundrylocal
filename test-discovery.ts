import 'dotenv/config';
import { getLocalModelClient } from './src/localModelClient.js';

const client = getLocalModelClient(undefined, 'qwen2.5-1.5b');
const status = await client.checkStatus();
console.log('endpoint:', status.endpoint);
console.log('available:', status.available);
console.log('models:', status.models?.length);
console.log('active:', status.activeModel);
process.exit(0);
