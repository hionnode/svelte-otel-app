import { json } from "@sveltejs/kit"
export const GET: any = async () => {
    console.log('SvelteKit app /healthz endpoint hit');
    return json({ status: 'ok', timestamp: new Date().toISOString() });
};