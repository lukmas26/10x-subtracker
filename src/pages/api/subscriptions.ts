import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { createSubscription, parseNewSubscription } from "@/lib/services/subscriptions";

function redirectWithError(context: Parameters<APIRoute>[0], message: string) {
  return context.redirect(`/subscriptions?error=${encodeURIComponent(message)}`);
}

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return redirectWithError(context, "Supabase is not configured");
  }

  const user = context.locals.user;
  if (!user) {
    return context.redirect("/auth/signin");
  }

  const parsed = parseNewSubscription(await context.request.formData());
  if (!parsed.ok) {
    return redirectWithError(context, parsed.error);
  }

  const result = await createSubscription(supabase, user.id, parsed.value);
  if (!result.ok) {
    return redirectWithError(context, result.error);
  }

  return context.redirect("/subscriptions?saved=1");
};
