import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

serve(async (req) => {
  const cors = getCorsHeaders(req);
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const { profile_id, email, name, phone } = await req.json();

    console.log("Sync profile to auth received:", { profile_id, email, name, phone });

    // Validate required fields
    if (!profile_id || !email) {
      console.error("Missing required fields: profile_id or email");
      return new Response(
        JSON.stringify({ error: "profile_id and email are required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Check if user already exists in auth.users
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error("Error listing users:", listError);
      throw listError;
    }

    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (existingUser) {
      console.log("User already exists in auth.users:", existingUser.id);
      
      // If the profile_id doesn't match, update the profile to use the existing user id
      if (existingUser.id !== profile_id) {
        console.log("Updating profile to match existing auth user id");
        
        // Update profile id to match auth user id
        const { error: updateError } = await supabaseAdmin
          .from("profiles")
          .update({ id: existingUser.id })
          .eq("id", profile_id);
        
        if (updateError) {
          console.error("Error updating profile id:", updateError);
        }
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "User already exists",
          user_id: existingUser.id 
        }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Generate a random secure password (user will need to reset via email)
    const randomPassword = crypto.randomUUID() + crypto.randomUUID();

    // Create user in auth.users with the same ID as the profile
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: randomPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        name: name || "",
        phone: phone || "",
      },
    });

    if (createError) {
      console.error("Error creating auth user:", createError);
      throw createError;
    }

    console.log("Created new auth user:", newUser.user?.id);

    // Update the profile to match the new auth user id
    if (newUser.user && newUser.user.id !== profile_id) {
      console.log("Updating profile id from", profile_id, "to", newUser.user.id);
      
      // First check if there's already a profile with the new user id
      const { data: existingProfile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("id", newUser.user.id)
        .single();

      if (!existingProfile) {
        // Update the original profile to use the new auth user id
        const { error: updateProfileError } = await supabaseAdmin
          .from("profiles")
          .update({ 
            id: newUser.user.id 
          })
          .eq("id", profile_id);

        if (updateProfileError) {
          console.error("Error updating profile id:", updateProfileError);
        }
      }

      // Also update subscriptions to link to the new user id
      const { error: subError } = await supabaseAdmin
        .from("subscriptions")
        .update({ user_id: newUser.user.id })
        .ilike("email", email)
        .is("user_id", null);

      if (subError) {
        console.error("Error linking subscription:", subError);
      } else {
        console.log("Linked subscription to user");
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "User created in auth.users",
        user_id: newUser.user?.id,
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in sync-profile-to-auth:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
