import { z } from "zod";

export const FREE_MAX_PLAYERS = 10;

export const ServerPropertiesSchema = z.object({
  "max-players":         z.number().int().min(1).max(999).optional(),
  "difficulty":          z.enum(["peaceful", "easy", "normal", "hard"]).optional(),
  "gamemode":            z.enum(["survival", "creative", "adventure", "spectator"]).optional(),
  "pvp":                 z.boolean().optional(),
  "white-list":          z.boolean().optional(),
  "view-distance":       z.number().int().min(2).max(32).optional(),
  "simulation-distance": z.number().int().min(2).max(32).optional(),
  "level-seed":          z.string().optional(),
  "motd":                z.string().max(59).optional(),
  "allow-nether":        z.boolean().optional(),
  "spawn-animals":       z.boolean().optional(),
  "spawn-monsters":      z.boolean().optional(),
  "spawn-npcs":          z.boolean().optional(),
  "spawn-protection":    z.number().int().min(0).max(100).optional(),
  "hardcore":            z.boolean().optional(),
  "force-gamemode":      z.boolean().optional(),
  "enforce-whitelist":   z.boolean().optional(),
});

export type ServerProperties = z.infer<typeof ServerPropertiesSchema>;
