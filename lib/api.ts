import { createClient } from "@/lib/supabase/client";
import type { Claim, Item, Wheel } from "@/lib/types";

// Thin wrappers over the SECURITY DEFINER RPCs. Errors from Postgres surface as
// supabase error.message (e.g. "submissions are closed"); we re-throw them so the
// UI can show the raw reason.

function unwrap<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  return data as T;
}

export async function createWheel(title: string): Promise<{ id: string; admin_token: string }> {
  const sb = createClient();
  const { data, error } = await sb.rpc("choicewheel_create_wheel", { p_title: title });
  // returns table(...) => array with one row
  const row = unwrap(data, error) as { id: string; admin_token: string }[];
  return row[0];
}

export async function getWheelByToken(token: string): Promise<Wheel> {
  const sb = createClient();
  const { data, error } = await sb.rpc("choicewheel_get_wheel_by_token", { p_token: token });
  return unwrap(data, error) as Wheel;
}

export async function getPublicWheel(id: string): Promise<Wheel | null> {
  const sb = createClient();
  const { data, error } = await sb.from("choicewheel_wheels").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Wheel | null;
}

export async function getItems(wheelId: string): Promise<Item[]> {
  const sb = createClient();
  const { data, error } = await sb
    .from("choicewheel_items")
    .select("*")
    .eq("wheel_id", wheelId)
    .order("created_at", { ascending: true });
  return unwrap(data, error) as Item[];
}

export async function submitItem(
  wheelId: string,
  label: string,
  submitterName: string,
): Promise<Item> {
  const sb = createClient();
  const { data, error } = await sb.rpc("choicewheel_submit_item", {
    p_wheel_id: wheelId,
    p_label: label,
    p_submitter_name: submitterName,
  });
  return unwrap(data, error) as Item;
}

export async function adminAddItem(
  token: string,
  label: string,
  submitterName: string,
): Promise<Item> {
  const sb = createClient();
  const { data, error } = await sb.rpc("choicewheel_admin_add_item", {
    p_token: token,
    p_label: label,
    p_submitter_name: submitterName,
  });
  return unwrap(data, error) as Item;
}

export async function setPublished(token: string, published: boolean): Promise<Wheel> {
  const sb = createClient();
  const { data, error } = await sb.rpc("choicewheel_admin_set_published", {
    p_token: token,
    p_published: published,
  });
  return unwrap(data, error) as Wheel;
}

export async function updateWheel(
  token: string,
  fields: { title?: string; submissions_open?: boolean; submit_deadline?: string | null },
): Promise<Wheel> {
  const sb = createClient();
  const { data, error } = await sb.rpc("choicewheel_admin_update_wheel", {
    p_token: token,
    p_title: fields.title ?? null,
    p_submissions_open: fields.submissions_open ?? null,
    p_submit_deadline: fields.submit_deadline ?? null,
  });
  return unwrap(data, error) as Wheel;
}

export async function deleteItem(token: string, itemId: string): Promise<void> {
  const sb = createClient();
  const { error } = await sb.rpc("choicewheel_admin_delete_item", {
    p_token: token,
    p_item_id: itemId,
  });
  if (error) throw new Error(error.message);
}

export async function clearItems(token: string): Promise<void> {
  const sb = createClient();
  const { error } = await sb.rpc("choicewheel_admin_clear_items", { p_token: token });
  if (error) throw new Error(error.message);
}

export async function deleteWheel(token: string): Promise<void> {
  const sb = createClient();
  const { error } = await sb.rpc("choicewheel_admin_delete_wheel", { p_token: token });
  if (error) throw new Error(error.message);
}

export async function setWinner(token: string, itemId: string): Promise<void> {
  const sb = createClient();
  const { error } = await sb.rpc("choicewheel_admin_set_winner", {
    p_token: token,
    p_item_id: itemId,
  });
  if (error) throw new Error(error.message);
}

export async function submitClaim(claim: {
  itemId: string;
  name: string;
  email: string;
  phone: string;
  country: string | null;
}): Promise<void> {
  const sb = createClient();
  const { error } = await sb.rpc("choicewheel_submit_claim", {
    p_item_id: claim.itemId,
    p_name: claim.name,
    p_email: claim.email,
    p_phone: claim.phone,
    p_country: claim.country,
  });
  if (error) throw new Error(error.message);
}

export async function getClaims(token: string): Promise<Claim[]> {
  const sb = createClient();
  const { data, error } = await sb.rpc("choicewheel_admin_get_claims", { p_token: token });
  return unwrap(data, error) as Claim[];
}
