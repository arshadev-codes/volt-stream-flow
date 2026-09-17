// src/services/api.ts
//
// Supabase-backed replacement for the old self-hosted MySQL API
// (previously /server-mysql, now removed).
//
// Reads VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY from .env.local.
// When those are unset, isApiEnabled() returns false and
// testObjectStore.ts falls back to localStorage only — same behavior
// as before, just swapped from "is VITE_API_BASE_URL set" to
// "is Supabase configured".
//
// IMPORTANT: This file's exported shape (isApiEnabled, api.listObjects,
// api.getObject, api.createObject, api.updateObject, api.deleteObject,
// api.saveResults) intentionally matches the old api.ts exactly, so
// testObjectStore.ts did not need to change at all.

import { supabase } from "@/lib/supabaseClient";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

export const isApiEnabled = () => Boolean(SUPABASE_URL);

const TABLE = "test_objects";

export const api = {
  listObjects: async () => {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  /** Returns the existing row for this serial number, or null if free to use. */
  findBySerial: async (serialNumber: string) => {
    const { data, error } = await supabase
      .from(TABLE)
      .select("id")
      .eq("serial_number", serialNumber)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  getObject: async (id: number | string) => {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },

  createObject: async (body: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(body)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  updateObject: async (id: number | string, body: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from(TABLE)
      .update(body)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  deleteObject: async (id: number | string) => {
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) throw error;
    return { ok: true as const };
  },

  saveResults: async (
    id: number | string,
    body: { raw_result: string; analysis_result: string },
  ) => {
    const { data, error } = await supabase
      .from(TABLE)
      .update(body)
      .eq("id", id)
      .select("id, modified_at")
      .single();
    if (error) throw error;
    return { ok: true, ...data };
  },
};