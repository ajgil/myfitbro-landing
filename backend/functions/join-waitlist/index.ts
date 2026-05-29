import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, level, goal, lang = 'es', utm_params } = await req.json()

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Guardar en Base de Datos Supabase
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
    
    const { error: dbError } = await supabase
      .from('leads')
      .insert([{ email, level, goal, lang, utm_params: utm_params || {} }])

    if (dbError) {
      if (dbError.code === '23505') {
         return new Response(
          JSON.stringify({ message: 'Already registered' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      throw dbError
    }

    // 2. Enviar Email con Resend
    const subject = lang === 'en' ? 'Welcome to the MyFitBro Waitlist! 🚀' : '¡Estás en la lista de MyFitBro! 🚀'
    const htmlContent = lang === 'en' 
      ? `<p>Hey Bro! You are in. We will notify you when the beta is ready.</p>`
      : `<p>¡Qué pasa Bro! Ya estás dentro. Te avisaremos en cuanto lancemos la beta.</p>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'MyFitBro <noreply@myfitbro.app>',
        to: [email],
        subject: subject,
        html: htmlContent,
      }),
    })

    if (!res.ok) {
        const errorText = await res.text()
        console.error("Resend Error:", errorText)
    }

    return new Response(
      JSON.stringify({ message: 'Success' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
