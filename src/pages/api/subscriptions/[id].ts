import type { APIRoute } from "astro";
import {
  SUBSCRIPTION_ERRORS,
  isSubscriptionId,
  parseNewSubscription,
  updateSubscription,
} from "@/lib/services/subscriptions";

function redirectWithError(context: Parameters<APIRoute>[0], path: string, message: string) {
  return context.redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export const POST: APIRoute = async (context) => {
  const supabase = context.locals.supabase;
  if (!supabase) {
    return redirectWithError(context, "/subscriptions", SUBSCRIPTION_ERRORS.notConfigured);
  }

  const user = context.locals.user;
  if (!user) {
    return context.redirect("/auth/signin");
  }

  // A malformed, unknown or another account's id all look the same: not found.
  const id = context.params.id ?? "";
  if (!isSubscriptionId(id)) {
    return redirectWithError(context, "/subscriptions", SUBSCRIPTION_ERRORS.notFound);
  }
  const editPath = `/subscriptions/${id}/edit`;

  const parsed = parseNewSubscription(await context.request.formData());
  if (!parsed.ok) {
    return redirectWithError(context, editPath, parsed.error);
  }

  const result = await updateSubscription(supabase, id, parsed.value);
  if (!result.ok) {
    const path = result.error === SUBSCRIPTION_ERRORS.notFound ? "/subscriptions" : editPath;
    return redirectWithError(context, path, result.error);
  }

  return context.redirect("/subscriptions?updated=1");
};
