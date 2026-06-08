import { useEffect, useState } from "react";
import { getSettings, subscribeSettings, updateSettings, type AppSettings } from "@/services/settings";

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(getSettings());
  useEffect(() => subscribeSettings(setSettings), []);
  return { settings, update: updateSettings };
}
