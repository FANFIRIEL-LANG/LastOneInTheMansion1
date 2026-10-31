export type RoleId = "survivor" | "possessed" | "medium" | "skeptic" | "trickster" | "guardian" | "detective";
export interface Role { id: RoleId; name: string; team: "guests" | "entity"; description: string; objective: string; }
export interface Player { id: string; name: string; role: Role; revealed: boolean; }
export interface GameSetup { players: string[]; includeTrickster: boolean; narration: boolean; }
