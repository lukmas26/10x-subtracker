import type { APIRoute } from "astro";
import { SUBSCRIPTION_ERRORS, createSubscription, parseNewSubscription } from "@/lib/services/subscriptions";

function redirectWithError(context: Parameters<APIRoute>[0], message: string) {
  return context.redirect(`/subscriptions?error=${encodeURIComponent(message)}`);
}

export const POST: APIRoute = async (context) => {
  const supabase = context.locals.supabase;
  if (!supabase) {
    return redirectWithError(context, SUBSCRIPTION_ERRORS.notConfigured);
  }

  const user = context.locals.user;
  if (!user) {
    return context.redirect("/auth/signin");
  }

  const parsed = parseNewSubscription(await context.request.formData());
  if (!parsed.ok) {
    return redirectWithError(context, parsed.error);
  }

  const result = await createSubscription(supabase, parsed.value);
  if (!result.ok) {
    return redirectWithError(context, result.error);
  }

  return context.redirect("/subscriptions?saved=1");
};
