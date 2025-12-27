import { createClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase do frontend
 *
 * Analogia Django:
 * - Isso equivale a configurar o acesso ao banco/serviços
 *   usando settings.py + variáveis de ambiente.
 */
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
