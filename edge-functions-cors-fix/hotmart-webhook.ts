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
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hotmart-hottok',
  };
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Verify Hotmart webhook token
function verifyHotmartToken(hottok: string | null): boolean {
  const secret = Deno.env.get('HOTMART_HOTTOK');
  
  if (!secret) {
    console.error('❌ HOTMART_HOTTOK not configured');
    return false;
  }
  
  if (!hottok) {
    console.error('❌ Missing X-HOTMART-HOTTOK header');
    return false;
  }
  
  return hottok === secret;
}

interface HotmartWebhookPayload {
  id?: string;
  creation_date?: number;
  event?: string;
  version?: string;
  data?: {
    product?: {
      id?: number;
      ucode?: string;
      name?: string;
    };
    buyer?: {
      email?: string;
      name?: string;
      first_name?: string;
      last_name?: string;
      checkout_phone?: string;
      checkout_phone_code?: string;
      document?: string;
    };
    producer?: {
      name?: string;
    };
    purchase?: {
      approved_date?: number;
      status?: string;
      transaction?: string;
      payment?: {
        type?: string;
        installments_number?: number;
      };
      full_price?: {
        value?: number;
        currency_value?: string;
      };
      offer?: {
        code?: string;
        name?: string;
      };
    };
    subscription?: {
      status?: string;
      plan?: {
        id?: number;
        name?: string;
      };
      subscriber?: {
        code?: string;
      };
    };
  };
}

// Helper functions
function getEvent(payload: HotmartWebhookPayload): string {
  return payload.event || 'PURCHASE_COMPLETE';
}

function getTransactionId(payload: HotmartWebhookPayload): string {
  return payload.data?.purchase?.transaction || payload.id || '';
}

function getCustomerEmail(payload: HotmartWebhookPayload): string | null {
  return payload.data?.buyer?.email || null;
}

function getCustomerPhone(payload: HotmartWebhookPayload): string {
  const phoneCode = payload.data?.buyer?.checkout_phone_code || '';
  const phone = payload.data?.buyer?.checkout_phone || '';
  const fullPhone = `${phoneCode}${phone}`.replace(/\D/g, '');
  return fullPhone;
}

function getProductName(payload: HotmartWebhookPayload): string {
  // Preferir nome do plano de assinatura, senão nome do produto
  return payload.data?.subscription?.plan?.name || 
         payload.data?.purchase?.offer?.name ||
         payload.data?.product?.name || '';
}

function getPlanType(productName: string): string {
  const name = productName.toLowerCase();
  
  // "Standard Plan" é o plano padrão da Hotmart → vai para premium anual
  if (name === 'standard plan') return 'premium';
  
  // Upgrade sempre vai para premium
  if (name.includes('upgrade')) return 'premium';
  
  // Planos específicos
  if (name.includes('premium')) return 'premium';
  if (name.includes('standard')) return 'standard';
  
  return 'free';
}

function getPlanPeriod(productName: string): string {
  const name = productName.toLowerCase();
  
  // "Standard Plan" é o plano padrão da Hotmart → anual
  if (name === 'standard plan') return 'anual';
  
  // Identificar por palavra-chave
  if (name.includes('mensal')) return 'mensal';
  if (name.includes('anual')) return 'anual';
  
  // Default: anual
  return 'anual';
}

function getExpirationDate(planPeriod: string): string {
  const now = new Date();
  if (planPeriod === 'mensal') {
    now.setDate(now.getDate() + 30);
  } else {
    now.setDate(now.getDate() + 365);
  }
  return now.toISOString();
}

function getPaymentAmount(payload: HotmartWebhookPayload): number {
  return payload.data?.purchase?.full_price?.value || 0;
}

function getCurrency(payload: HotmartWebhookPayload): string {
  return payload.data?.purchase?.full_price?.currency_value || 'BRL';
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  const requestId = crypto.randomUUID();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  try {
    const body = await req.text();
    const hottok = req.headers.get('X-HOTMART-HOTTOK');
    
    // Verify webhook token
    const isValidToken = verifyHotmartToken(hottok);
    if (!isValidToken) {
      console.error(`[${requestId}] ❌ Invalid Hotmart token`);
      return new Response(JSON.stringify({ error: 'Invalid token' }), { 
        status: 401, 
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }
    
    console.log(`[${requestId}] ✅ Token verified successfully`);
    
    const payload: HotmartWebhookPayload = JSON.parse(body);
    
    console.log(`[${requestId}] 📦 RAW PAYLOAD:`, body.substring(0, 500));
    console.log(`[${requestId}] 🔔 WEBHOOK RECEBIDO:`, {
      event: getEvent(payload),
      transactionId: getTransactionId(payload),
      product: getProductName(payload),
      customerEmail: getCustomerEmail(payload),
      customerPhone: getCustomerPhone(payload),
      timestamp: new Date().toISOString()
    });

    const phone = getCustomerPhone(payload);
    const email = getCustomerEmail(payload);
    
    // Hotmart pode não ter telefone obrigatório, então validamos email também
    if (!phone && !email) {
      console.error(`[${requestId}] ❌ Telefone ou email obrigatório`);
      return new Response('Phone or email required', { status: 400, headers: cors });
    }

    const event = getEvent(payload);
    const transactionId = getTransactionId(payload);
    const productName = getProductName(payload);
    const planType = getPlanType(productName);
    const planPeriod = getPlanPeriod(productName);

    // Verificar duplicata por transaction_id
    if (transactionId) {
      const { data: existing } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('transaction_id', transactionId)
        .maybeSingle();
      
      if (existing) {
        console.log(`[${requestId}] ✅ Evento já processado (idempotência)`);
        return new Response(JSON.stringify({ status: 'success', message: 'Already processed' }), { 
          status: 200, 
          headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }
    }

    // Processar webhook baseado no evento
    if (event === 'PURCHASE_COMPLETE' || event === 'PURCHASE_APPROVED') {
      await handlePurchaseComplete(phone, email, planType, planPeriod, transactionId, payload, requestId);
    } else if (event === 'SUBSCRIPTION_CANCELLATION' || event === 'PURCHASE_CANCELED') {
      await handleSubscriptionCanceled(phone, email, requestId);
    } else if (event === 'PURCHASE_REFUNDED' || event === 'PURCHASE_CHARGEBACK') {
      await handleRefund(phone, email, transactionId, requestId);
    } else if (event === 'PURCHASE_DELAYED' || event === 'PURCHASE_OVERDUE') {
      await handleOverdue(phone, email, requestId);
    } else if (event === 'SUBSCRIPTION_PLAN_CHANGE') {
      await handlePlanChange(phone, email, payload, requestId);
    } else if (event === 'PURCHASE_EXPIRED') {
      await handleExpired(phone, email, requestId);
    } else {
      console.log(`[${requestId}] ℹ️ Evento não processado: ${event}`);
    }

    return new Response(JSON.stringify({ status: 'success' }), { 
      status: 200, 
      headers: { ...cors, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`[${requestId}] ❌ Webhook error:`, error);
    return new Response('Internal error', { status: 500, headers: cors });
  }
});

async function handlePurchaseComplete(
  phone: string, 
  email: string | null, 
  planType: string, 
  planPeriod: string, 
  transactionId: string,
  payload: HotmartWebhookPayload,
  requestId: string
) {
  console.log(`[${requestId}] 💳 Processando compra aprovada - Plano: ${planType} (${planPeriod})`);
  
  try {
    // Buscar usuário existente por telefone
    let existingProfile = null;
    
    if (phone) {
      const { data: profileByPhone } = await supabase
        .rpc('find_profile_by_phone', { phone_input: phone })
        .maybeSingle();
      existingProfile = profileByPhone;
    }

    // Se não encontrou por telefone, buscar por email
    if (!existingProfile && email) {
      const { data: profileByEmail } = await supabase
        .from('profiles')
        .select('id, name, phone, email')
        .ilike('email', email)
        .maybeSingle();
      
      if (profileByEmail) {
        existingProfile = profileByEmail;
        console.log(`[${requestId}] 📧 Profile encontrado por email: ${email}`);
      }
    }

    // AUTO-CRIAR PROFILE se não existe e tem email
    if (!existingProfile && email) {
      console.log(`[${requestId}] 🆕 Criando profile automático para: ${email}`);
      
      const buyerName = payload.data?.buyer?.name || 
                       `${payload.data?.buyer?.first_name || ''} ${payload.data?.buyer?.last_name || ''}`.trim() ||
                       null;
      
      const { data: newProfile, error: profileError } = await supabase
        .from('profiles')
        .insert({
          email: email.toLowerCase().trim(),
          phone: phone || null,
          name: buyerName,
          plan_type: planType,
          plan_status: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id, name, phone, email')
        .single();

      if (profileError) {
        console.error(`[${requestId}] ⚠️ Erro ao criar profile automático:`, profileError);
      } else {
        existingProfile = newProfile;
        console.log(`[${requestId}] ✅ Profile automático criado: ${newProfile.id}`);
      }
    }

    // Verificar subscription existente
    let existingSubscription = null;
    
    if (phone) {
      const { data: subByPhone } = await supabase
        .rpc('find_subscription_by_phone', { phone_input: phone })
        .maybeSingle();
      existingSubscription = subByPhone;
    }
    
    if (!existingSubscription && email) {
      const { data: subByEmail } = await supabase
        .from('subscriptions')
        .select('*')
        .ilike('email', email)
        .eq('status', 'active')
        .maybeSingle();
      existingSubscription = subByEmail;
    }

    const now = new Date();
    const endDate = getExpirationDate(planPeriod);
    const amount = getPaymentAmount(payload);
    const currency = getCurrency(payload);

    const subscriptionData = {
      user_id: existingProfile?.id || null,
      phone: phone || null,
      email: email,
      current_plan: planType,
      plan_period: planPeriod,
      status: 'active' as const,
      start_date: now.toISOString(),
      end_date: endDate,
      transaction_id: transactionId,
      payment_method: payload.data?.purchase?.payment?.type || null,
      installments: payload.data?.purchase?.payment?.installments_number || null,
      updated_at: now.toISOString()
    };

    if (existingSubscription) {
      // RENOVAÇÃO: Atualizar subscription existente
      const { error } = await supabase
        .from('subscriptions')
        .update(subscriptionData)
        .eq('id', existingSubscription.id);

      if (error) throw error;
      console.log(`[${requestId}] ♻️ RENOVAÇÃO - Subscription atualizada: ${existingSubscription.id}`);
      
      // Registrar pagamento como renovação
      await supabase.from('payments').insert({
        user_id: existingProfile?.id || null,
        phone: phone || null,
        email: email,
        plan_type: `${planType}-${planPeriod}`,
        amount: amount,
        currency: currency,
        status: 'completed',
        transaction_id: transactionId,
        plan_status: 'renewal'
      });
      
    } else {
      // NOVA COMPRA: Criar nova subscription
      const { error } = await supabase
        .from('subscriptions')
        .insert(subscriptionData);

      if (error) throw error;
      console.log(`[${requestId}] ✅ NOVA COMPRA - Subscription criada`);
      
      // Registrar pagamento como nova compra
      await supabase.from('payments').insert({
        user_id: existingProfile?.id || null,
        phone: phone || null,
        email: email,
        plan_type: `${planType}-${planPeriod}`,
        amount: amount,
        currency: currency,
        status: 'completed',
        transaction_id: transactionId,
        plan_status: 'new'
      });
    }

    // ✅ SINCRONIZAR profiles.plan_type e profiles.plan_status baseado na subscription
    // Buscar profile por email para garantir sincronização mesmo se não existe user_id
    if (email) {
      const { data: profileToSync } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', email)
        .maybeSingle();
      
      if (profileToSync) {
        const { error: syncError } = await supabase
          .from('profiles')
          .update({
            plan_type: planType,
            plan_status: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', profileToSync.id);
        
        if (syncError) {
          console.error(`[${requestId}] ⚠️ Erro ao sincronizar profile:`, syncError);
        } else {
          console.log(`[${requestId}] 🔄 Profile sincronizado: plan_type=${planType}, plan_status=true`);
        }
      }
    }

    console.log(`[${requestId}] 🎯 Compra processada com sucesso`);
  } catch (error) {
    console.error(`[${requestId}] ❌ Erro ao processar compra:`, error);
    throw error;
  }
}

async function handleSubscriptionCanceled(phone: string, email: string | null, requestId: string) {
  console.log(`[${requestId}] 🚫 Processando cancelamento`);
  
  try {
    let subscription = null;
    
    if (phone) {
      const { data: subByPhone } = await supabase
        .rpc('find_subscription_by_phone', { phone_input: phone })
        .maybeSingle();
      subscription = subByPhone;
    }
    
    if (!subscription && email) {
      const { data: subByEmail } = await supabase
        .from('subscriptions')
        .select('*')
        .ilike('email', email)
        .eq('status', 'active')
        .maybeSingle();
      subscription = subByEmail;
    }

    if (subscription) {
      const { error } = await supabase
        .from('subscriptions')
        .update({ 
          status: 'canceled',
          updated_at: new Date().toISOString()
        })
        .eq('id', subscription.id);

      if (error) throw error;
      console.log(`[${requestId}] ✅ Subscription cancelada: ${subscription.id}`);
      
      // ✅ Sincronizar profile para free após cancelamento
      const profileEmail = subscription.email || email;
      if (profileEmail) {
        await supabase
          .from('profiles')
          .update({
            plan_type: 'free',
            plan_status: false,
            updated_at: new Date().toISOString()
          })
          .ilike('email', profileEmail);
        console.log(`[${requestId}] 🔄 Profile sincronizado para free após cancelamento`);
      }
    } else {
      console.log(`[${requestId}] ⚠️ Subscription não encontrada para cancelamento`);
    }

  } catch (error) {
    console.error(`[${requestId}] ❌ Erro ao processar cancelamento:`, error);
    throw error;
  }
}

async function handleRefund(phone: string, email: string | null, transactionId: string, requestId: string) {
  console.log(`[${requestId}] 💸 Processando reembolso`);
  
  try {
    // Atualizar pagamento para refunded
    if (transactionId) {
      await supabase
        .from('payments')
        .update({ 
          status: 'refunded',
          refunded_at: new Date().toISOString()
        })
        .eq('transaction_id', transactionId);
    }

    // Cancelar subscription
    await handleSubscriptionCanceled(phone, email, requestId);
    
    console.log(`[${requestId}] ✅ Reembolso processado`);
  } catch (error) {
    console.error(`[${requestId}] ❌ Erro ao processar reembolso:`, error);
    throw error;
  }
}

// Handler para pagamento atrasado (overdue/delayed)
async function handleOverdue(phone: string, email: string | null, requestId: string) {
  console.log(`[${requestId}] ⏰ Processando pagamento atrasado`);
  
  try {
    let subscription = null;
    
    if (phone) {
      const { data: subByPhone } = await supabase
        .rpc('find_subscription_by_phone', { phone_input: phone })
        .maybeSingle();
      subscription = subByPhone;
    }
    
    if (!subscription && email) {
      const { data: subByEmail } = await supabase
        .from('subscriptions')
        .select('*')
        .ilike('email', email)
        .eq('status', 'active')
        .maybeSingle();
      subscription = subByEmail;
    }

    if (subscription) {
      // Colocar em período de carência (grace period) - 7 dias para pagar
      const gracePeriodEnd = new Date();
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);
      
      const { error } = await supabase
        .from('subscriptions')
        .update({ 
          status: 'overdue',
          grace_period_end: gracePeriodEnd.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', subscription.id);

      if (error) throw error;
      console.log(`[${requestId}] ⚠️ Subscription em atraso: ${subscription.id} - Grace period até ${gracePeriodEnd.toISOString()}`);
      
      // ✅ Manter plan_type mas marcar plan_status=false durante overdue
      const profileEmail = subscription.email || email;
      if (profileEmail) {
        await supabase
          .from('profiles')
          .update({
            plan_status: false, // Indica que está em situação irregular
            updated_at: new Date().toISOString()
          })
          .ilike('email', profileEmail);
        console.log(`[${requestId}] 🔄 Profile plan_status=false (overdue)`);
      }
    } else {
      console.log(`[${requestId}] ⚠️ Subscription não encontrada para marcar como atrasada`);
    }

  } catch (error) {
    console.error(`[${requestId}] ❌ Erro ao processar atraso:`, error);
    throw error;
  }
}

// Handler para mudança de plano (upgrade/downgrade)
async function handlePlanChange(
  phone: string, 
  email: string | null, 
  payload: HotmartWebhookPayload,
  requestId: string
) {
  console.log(`[${requestId}] 🔄 Processando mudança de plano`);
  
  try {
    const productName = getProductName(payload);
    const newPlanType = getPlanType(productName);
    const newPlanPeriod = getPlanPeriod(productName);
    
    let subscription = null;
    
    if (phone) {
      const { data: subByPhone } = await supabase
        .rpc('find_subscription_by_phone', { phone_input: phone })
        .maybeSingle();
      subscription = subByPhone;
    }
    
    if (!subscription && email) {
      const { data: subByEmail } = await supabase
        .from('subscriptions')
        .select('*')
        .ilike('email', email)
        .in('status', ['active', 'overdue'])
        .maybeSingle();
      subscription = subByEmail;
    }

    if (subscription) {
      const oldPlan = subscription.current_plan;
      const isUpgrade = (oldPlan === 'standard' && newPlanType === 'premium') || 
                        (oldPlan === 'free' && (newPlanType === 'standard' || newPlanType === 'premium'));
      
      const newEndDate = getExpirationDate(newPlanPeriod);
      
      const { error } = await supabase
        .from('subscriptions')
        .update({ 
          current_plan: newPlanType,
          plan_period: newPlanPeriod,
          status: 'active',
          end_date: newEndDate,
          updated_at: new Date().toISOString()
        })
        .eq('id', subscription.id);

      if (error) throw error;
      
      // Atualizar profile também
      if (subscription.user_id) {
        await supabase
          .from('profiles')
          .update({
            plan_type: newPlanType,
            plan_status: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', subscription.user_id);
      }
      
      console.log(`[${requestId}] ✅ ${isUpgrade ? 'UPGRADE' : 'MUDANÇA'}: ${oldPlan} → ${newPlanType} (${newPlanPeriod})`);
    } else {
      console.log(`[${requestId}] ⚠️ Subscription não encontrada para mudança de plano`);
    }

  } catch (error) {
    console.error(`[${requestId}] ❌ Erro ao processar mudança de plano:`, error);
    throw error;
  }
}

// Handler para compra expirada
async function handleExpired(phone: string, email: string | null, requestId: string) {
  console.log(`[${requestId}] ⌛ Processando expiração`);
  
  try {
    let subscription = null;
    
    if (phone) {
      const { data: subByPhone } = await supabase
        .rpc('find_subscription_by_phone', { phone_input: phone })
        .maybeSingle();
      subscription = subByPhone;
    }
    
    if (!subscription && email) {
      const { data: subByEmail } = await supabase
        .from('subscriptions')
        .select('*')
        .ilike('email', email)
        .in('status', ['active', 'overdue'])
        .maybeSingle();
      subscription = subByEmail;
    }

    if (subscription) {
      const { error } = await supabase
        .from('subscriptions')
        .update({ 
          status: 'expired',
          updated_at: new Date().toISOString()
        })
        .eq('id', subscription.id);

      if (error) throw error;
      
      // Atualizar profile para free
      if (subscription.user_id) {
        await supabase
          .from('profiles')
          .update({
            plan_type: 'free',
            plan_status: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', subscription.user_id);
      }
      
      console.log(`[${requestId}] ✅ Subscription expirada: ${subscription.id}`);
    } else {
      console.log(`[${requestId}] ⚠️ Subscription não encontrada para expirar`);
    }

  } catch (error) {
    console.error(`[${requestId}] ❌ Erro ao processar expiração:`, error);
    throw error;
  }
}
