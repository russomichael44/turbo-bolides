import { getStore } from '@netlify/blobs';
import { createApi } from '../lib/accounts.mjs';

// Un « magasin » JSON par type de donnée. Lecture forte : une connexion juste après l'inscription doit voir le compte.
const open = (name) => {
  const s = getStore({ name, consistency: 'strong' });
  return {
    get: (k) => s.get(k, { type: 'json' }),
    set: (k, v, o) => s.setJSON(k, v, o),
    del: (k) => s.delete(k),
  };
};

const api = createApi({ accounts: open('accounts'), saves: open('saves'), config: open('config') });

export default async (req) => api.handle(req);

export const config = { path: '/api/*' };
