import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { readingId, deleteAll } = await req.json();
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (deleteAll) {
      // Delete all publications first (FK constraint)
      await supabase.from("dou_publications").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      // Delete all readings
      const { error } = await supabase.from("dou_readings").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!readingId) {
      return new Response(
        JSON.stringify({ error: "readingId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete publications first (FK constraint)
    await supabase
      .from("dou_publications")
      .delete()
      .eq("reading_id", readingId);

    // Delete reading
    const { error } = await supabase
      .from("dou_readings")
      .delete()
      .eq("id", readingId);

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
