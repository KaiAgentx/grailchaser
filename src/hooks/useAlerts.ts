"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { AlertRule, AlertEvent } from "@/lib/types";

export function useAlerts() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    const [rulesRes, eventsRes] = await Promise.all([
      supabase.from("alert_rules").select("*").order("created_at", { ascending: false }),
      supabase.from("alert_events").select("*, card:cards(*)").order("created_at", { ascending: false }).limit(50),
    ]);
    if (rulesRes.data) setRules(rulesRes.data);
    if (eventsRes.data) setEvents(eventsRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const addRule = async (rule: Partial<AlertRule>) => {
    const { data, error } = await supabase.from("alert_rules").insert(rule).select().single();
    if (!error && data) setRules(prev => [data, ...prev]);
    return { data, error };
  };

  const updateRule = async (id: string, updates: Partial<AlertRule>) => {
    const { error } = await supabase.from("alert_rules").update(updates).eq("id", id);
    if (!error) setRules(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    return { error };
  };

  const deleteRule = async (id: string) => {
    const { error } = await supabase.from("alert_rules").delete().eq("id", id);
    if (!error) setRules(prev => prev.filter(r => r.id !== id));
    return { error };
  };

  const dismissEvent = async (id: string) => {
    const { error } = await supabase.from("alert_events").update({ dismissed: true }).eq("id", id);
    if (!error) setEvents(prev => prev.map(e => e.id === id ? { ...e, dismissed: true } : e));
  };

  const markRead = async (id: string) => {
    const { error } = await supabase.from("alert_events").update({ read: true }).eq("id", id);
    if (!error) setEvents(prev => prev.map(e => e.id === id ? { ...e, read: true } : e));
  };

  return { rules, events, loading, fetchAlerts, addRule, updateRule, deleteRule, dismissEvent, markRead };
}
