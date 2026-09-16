import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://jcgiictllfybpbljhnab.supabase.co';
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_KEY || 'sb_publishable_UujMyU0IZwz0grZy7CjAmQ_Khszpwtz';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
