import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing STRIPE_SECRET_KEY");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-04-22.dahlia",
});
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, organisationId } = body;

    if (!organisationId) {
      return Response.json(
        { error: "Missing organisationId" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 🔍 GET ORGANISATION
    const { data: org, error: orgError } = await supabase
      .from("organisations")
      .select("*")
      .eq("id", organisationId)
      .single();

    if (orgError || !org) {
      console.error("ORG FETCH ERROR:", orgError);
      return Response.json(
        { error: "Organisation not found" },
        { status: 404 }
      );
    }

    let customerId = org.stripe_customer_id;

    // 👤 CREATE CUSTOMER IF NEEDED
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { organisationId },
      });

      customerId = customer.id;

      const { error: updateError } = await supabase
        .from("organisations")
        .update({ stripe_customer_id: customerId })
        .eq("id", organisationId);

      if (updateError) {
        console.error("CUSTOMER SAVE ERROR:", updateError);
      }
    }

    // 🧾 CREATE CHECKOUT SESSION
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID!,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/clients`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/upgrade`,
    });

    return Response.json({ url: session.url });
  } catch (err: any) {
    console.error("STRIPE ERROR:", err);
    return Response.json(
      { error: err.message || "Something went wrong" },
      { status: 500 }
    );
  }
}