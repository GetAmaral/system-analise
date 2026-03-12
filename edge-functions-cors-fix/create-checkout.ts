import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const ALLOWED_ORIGINS = [
  'https://totalassistente.com.br',
  'https://www.totalassistente.com.br',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Links de checkout Hotmart
const CHECKOUT_LINKS: Record<string, string> = {
  'standard-mensal': 'https://pay.hotmart.com/J104038086X?off=nkwi7l8y&checkoutMode=6',
  'standard-anual': 'https://pay.hotmart.com/J104038086X?off=e862ejff&checkoutMode=6',
  'premium-mensal': 'https://pay.hotmart.com/J104038086X?off=vtb5ogds&checkoutMode=6',
  'premium-anual': 'https://pay.hotmart.com/J104038086X?off=xbjmsoxu&checkoutMode=6',
  'upgrade-anual': 'https://pay.hotmart.com/J104038086X?off=b50m5zk4&checkoutMode=6',
  'upgrade-mensal': 'https://pay.hotmart.com/J104038086X?off=b50m5zk4&checkoutMode=6',
  // Legacy support
  standard: 'https://pay.hotmart.com/J104038086X?off=e862ejff&checkoutMode=6',
  premium: 'https://pay.hotmart.com/J104038086X?off=xbjmsoxu&checkoutMode=6',
  upgrade: 'https://pay.hotmart.com/J104038086X?off=b50m5zk4&checkoutMode=6'
};

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  try {
    // Optional JWT validation - works with or without authentication
    const authHeader = req.headers.get('authorization');
    let userId = null;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    const { planType } = await req.json();

    if (!planType || !CHECKOUT_LINKS[planType]) {
      console.warn('Invalid plan type requested');
      return new Response(
        JSON.stringify({ error: 'Invalid plan type' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // Log checkout request for audit (sanitized)
    console.log('Checkout request:', {
      userId: userId || 'anonymous',
      planType,
      timestamp: new Date().toISOString()
    });

    const checkoutUrl = CHECKOUT_LINKS[planType];

    return new Response(
      JSON.stringify({ checkoutUrl }),
      { 
        status: 200, 
        headers: { ...cors, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Checkout error:', (error as Error).message);
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
});
