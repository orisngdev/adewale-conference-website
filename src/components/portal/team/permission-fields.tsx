"use client";

import { useState } from "react";
import type {
  AccessLevel,
  AdminPermissionsMap,
  AdminRolePreset,
  PermissionModule,
} from "@/supabase/types";
import { PRESET_ROLE_PERMISSIONS } from "@/supabase/types";
import {
  ACCESS_LEVEL_LABELS,
  MODULE_DESCRIPTIONS,
  MODULE_LABELS,
  PERMISSION_MODULES,
  PRESET_LABELS,
  PRESET_ORDER,
  VIEW_ONLY_MODULES,
  matchPreset,
} from "@/lib/admin-permissions";

const LEVELS_FULL: AccessLevel[] = ["none", "view", "manage"];
const LEVELS_VIEW_ONLY: AccessLevel[] = ["none", "view"];

// The shared invite/edit control: a preset dropdown plus a per-module 3-way
// segmented picker (None / Read-only / Manage). Picking a named preset fills the
// grid; nudging any module flips the label to "Custom". Emits the fields the
// server actions read: `preset` and one `perm_<module>` per module (see
// permissionsFromForm in @/lib/admin-permissions).
export function TeamPermissionFields({
  defaultPreset,
  defaultPermissions,
}: {
  defaultPreset: AdminRolePreset;
  defaultPermissions: AdminPermissionsMap;
}) {
  const [perms, setPerms] = useState<AdminPermissionsMap>(defaultPermissions);
  const [preset, setPreset] = useState<AdminRolePreset>(defaultPreset);

  function applyPreset(p: AdminRolePreset) {
    if (p !== "custom" && p in PRESET_ROLE_PERMISSIONS) {
      setPerms(PRESET_ROLE_PERMISSIONS[p as Exclude<AdminRolePreset, "custom">]);
    }
    setPreset(p);
  }

  function setModule(m: PermissionModule, level: AccessLevel) {
    const next = { ...perms, [m]: level };
    setPerms(next);
    setPreset(matchPreset(next));
  }

  return (
    <div className="space-y-4">
      {/* Fields the server action reads. */}
      <input type="hidden" name="preset" value={preset} />
      {PERMISSION_MODULES.map((m) => (
        <input key={m} type="hidden" name={`perm_${m}`} value={perms[m]} />
      ))}

      <label className="block">
        <span className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
          Role preset
        </span>
        <select
          value={preset}
          onChange={(e) => applyPreset(e.target.value as AdminRolePreset)}
          className="mt-1 w-full rounded-md border border-foreground/15 bg-card px-3 py-2 text-sm outline-none focus:border-primary"
        >
          {PRESET_ORDER.map((p) => (
            <option key={p} value={p}>
              {PRESET_LABELS[p]}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-2">
        {PERMISSION_MODULES.map((m) => {
          const levels = VIEW_ONLY_MODULES.has(m) ? LEVELS_VIEW_ONLY : LEVELS_FULL;
          return (
            <div
              key={m}
              className="flex flex-col gap-2 rounded-md border border-foreground/10 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{MODULE_LABELS[m]}</p>
                <p className="text-xs text-muted-foreground">{MODULE_DESCRIPTIONS[m]}</p>
              </div>
              <div className="flex shrink-0 rounded-md border border-foreground/15 p-0.5">
                {levels.map((lvl) => {
                  const active = perms[m] === lvl;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setModule(m, lvl)}
                      aria-pressed={active}
                      className={`rounded px-3 py-1 text-xs font-semibold transition-colors ${
                        active
                          ? "bg-primary/15 text-gold-ink"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {ACCESS_LEVEL_LABELS[lvl]}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
