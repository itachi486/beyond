export type DialogueMessage = { role: "visitor" | "character"; text: string };
export type DiscoveryProgress = {
  version: 1;
  companion?: {characterId:string;pointId:string;assetId:string;x:number;y:number;scale:number;name:string;description:string};
  companionTask?: {message:string;kind:"edit"|"clarify";position?:{x:number;y:number}|null;operationId?:string;operation?:"create"|"edit";objectKind?:string;targetId?:string|null;state?:string;lastError?:string}|null;
  currentPoint?: string | null;
  clues?: string[];
  found: string[];
  completed: string[];
  conversations: Record<string, DialogueMessage[]>;
};
export const emptyProgress = (): DiscoveryProgress => ({
  version: 1,
  found: [],
  completed: [],
  conversations: {},
});
export function readProgress(key: string): {
  data: DiscoveryProgress;
  invalid: boolean;
} {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { data: emptyProgress(), invalid: false };
    const v = JSON.parse(raw);
    const ids = (value: unknown): value is string[] =>
      Array.isArray(value) &&
      value.length <= 100 &&
      value.every((id) => typeof id === "string" && /^[a-f0-9-]{36}$/.test(id));
    if (
      v?.version !== 1 ||
      (v.companion!==undefined&&(!v.companion||typeof v.companion!=='object'||!['characterId','pointId','assetId'].every(k=>typeof v.companion[k]==='string'&&/^[a-f0-9-]{36}$/.test(v.companion[k]))||!['x','y','scale'].every(k=>Number.isFinite(v.companion[k])&&v.companion[k]>=0&&v.companion[k]<=1)||typeof v.companion.name!=='string'||v.companion.name.length>100||typeof v.companion.description!=='string'||v.companion.description.length>2000)) ||
      (v.companionTask!==undefined&&v.companionTask!==null&&(!['edit','clarify'].includes(v.companionTask.kind)||typeof v.companionTask.message!=='string'||v.companionTask.message.length>1000)) ||
      !ids(v.found) ||
      !ids(v.completed) ||
      (v.clues !== undefined && !ids(v.clues)) ||
      (v.currentPoint !== undefined &&
        v.currentPoint !== null &&
        (typeof v.currentPoint !== "string" ||
          !/^[a-f0-9-]{36}$/.test(v.currentPoint))) ||
      !v.conversations ||
      typeof v.conversations !== "object" ||
      Array.isArray(v.conversations) ||
      Object.keys(v.conversations).length > 100 ||
      !Object.entries(v.conversations).every(
        ([id, messages]) =>
          /^[a-f0-9-]{36}(?::[a-f0-9-]{36})?$/.test(id) &&
          Array.isArray(messages) &&
          messages.length <= 200 &&
          messages.every(
            (m) =>
              m &&
              ["visitor", "character"].includes(m.role) &&
              typeof m.text === "string" &&
              m.text.length <= 2000,
          ),
      )
    )
      throw Error();
    return { data: v, invalid: false };
  } catch {
    return { data: emptyProgress(), invalid: true };
  }
}
// A future server adapter can implement this contract. No AI service is configured here.
export interface CharacterDialogueService {
  kind: "local" | "server";
  reply(input: {
    message: string;
    description: string;
    es: boolean;
    character?: {
      id: string;
      name: string;
      role?: string;
      personality?: string;
    };
    world?: { id: string; name: string; lore: string };
    discovery?: {
      id: string;
      objective: string;
      completed: boolean;
      hasClue: boolean;
    };
    history?: DialogueMessage[];
    completedObjectives?: string[];
  }): Promise<string>;
}
export const localDialogue: CharacterDialogueService = {
  kind: "local",
  async reply({
    message,
    description,
    es,
    character,
    world,
    discovery,
    history,
  }) {
    const text = message.toLowerCase(),
      name = character?.name || (es ? "Tu acompañante" : "Your companion"),
      context = description.slice(0, 500);
    if (/remember|recuerd/.test(text)) {
      const previous = history
        ?.filter((m) => m.role === "visitor")
        .at(-1)?.text;
      return previous
        ? es
          ? `En nuestra conversación guardada dijiste: “${previous.slice(0, 300)}”.`
          : `In our saved conversation you said: “${previous.slice(0, 300)}”.`
        : es
          ? "Todavía no hay mensajes anteriores guardados en esta conversación."
          : "There are no earlier saved messages in this conversation yet.";
    }
    if (/sad|lonely|afraid|triste|soledad|miedo/.test(text))
      return es
        ? `${name}: podemos ir despacio. Podemos conversar sin completar ninguna misión.`
        : `${name}: we can take our time. We can talk without completing any mission.`;
    if (
      /\b(?:hint|clue|mission|quest|help)\b|pista|misión|ayuda/.test(text) &&
      discovery?.completed
    )
      return es
        ? `${name}: este objetivo ya está completado. Podemos seguir hablando o visitar otro lugar abierto.`
        : `${name}: this objective is already complete. We can keep talking or visit another open location.`;
    if (/\b(?:hint|clue|mission|quest|help)\b|pista|misión|ayuda/.test(text))
      return es
        ? `${name}: sigue el destello dorado. ${discovery?.objective || "Toca la luz para continuar."}`
        : `${name}: follow the golden glimmer. ${discovery?.objective || "Touch the light to continue."}`;
    if (/who|name|quién|nombre/.test(text))
      return `${name}${character?.role ? ` (${character.role})` : ""}. ${context}`;
    if (/where|world|place|dónde|mundo|lugar/.test(text))
      return es
        ? `Estamos en ${world?.name || "tu mundo"}. ${world?.lore.slice(0, 400) || context}`
        : `We are in ${world?.name || "your world"}. ${world?.lore.slice(0, 400) || context}`;
    if (/hello|hi\b|hola|thanks|gracias/.test(text))
      return es
        ? `${name}: me alegra encontrarte. Podemos hablar o buscar una pista, cuando quieras.`
        : `${name}: it is good to meet you. We can talk, or look for a clue whenever you like.`;
    return es
      ? `${name}: preguntas “${message.slice(0, 180)}”. Este diálogo local no puede interpretar todas las preguntas. ${context} Puedes preguntarme por este mundo o pedir una pista.`
      : `${name}: you asked “${message.slice(0, 180)}”. This local dialogue cannot interpret every question. ${context} You can ask about this world or ask for a clue.`;
  },
};

export type DiscoveryPoint = {
  id: string;
  characterId: string;
  x: number;
  y: number;
  requires?: string[];
  objective?: string;
};
export function canDiscover(
  points: DiscoveryPoint[],
  progress: DiscoveryProgress,
  id: string,
): boolean {
  const index = points.findIndex((p) => p.id === id);
  if (index < 0) return false;
  const visiting = new Set<string>();
  function open(i: number): boolean {
    const p = points[i];
    if (visiting.has(p.id)) return false;
    visiting.add(p.id);
    const requirements = p.requires ?? (i ? [points[i - 1].id] : []);
    const result = requirements.every((required) => {
      const r = points.findIndex((p) => p.id === required);
      return (
        r >= 0 && r < i && progress.completed.includes(required) && open(r)
      );
    });
    visiting.delete(p.id);
    return result;
  }
  return open(index);
}
export function hasObjectiveClue(progress: DiscoveryProgress, id: string) {
  if (progress.clues !== undefined) return progress.clues.includes(id);
  // Compatibility only for progress created before explicit clue tracking.
  return (
    progress.conversations[id]?.some(
      (m) =>
        m.role === "character" && /golden glimmer|destello dorado/.test(m.text),
    ) || false
  );
}

export function completeObjective(
  points: DiscoveryPoint[],
  progress: DiscoveryProgress,
  id: string,
): DiscoveryProgress | null {
  if (progress.completed.includes(id)) return progress;
  if (
    !canDiscover(points, progress, id) ||
    !progress.found.includes(id) ||
    !hasObjectiveClue(progress, id)
  )
    return null;
  return {
    ...progress,
    completed: [...progress.completed, id],
    currentPoint: id,
  };
}
// Preparation only: grants must come from an authenticated server; no purchase is granted here.
export type CharacterEntitlement = {
  characterId: string;
  ownerId: string;
  tier: "free" | "premium";
  grantId: string;
  source: "free-allocation" | "purchase";
  verifiedBy: "server";
};
export const characterAccessPolicy = {
  freeAllocation: 3,
  premiumAuthority: "server",
} as const;

// World is scoped by its existing storage key; include both encounter and actual character ID.
export function conversationKey(pointId: string, characterId: string) {
  return `${pointId}:${characterId}`;
}
export function conversationMessages(
  progress: DiscoveryProgress,
  pointId: string,
  characterId: string,
): DialogueMessage[] {
  const key = conversationKey(pointId, characterId);
  if (progress.conversations[key]) return progress.conversations[key];
  // Legacy point-only history remains untouched; bind it only before a character-specific conversation exists.
  return Object.keys(progress.conversations).some((k) =>
    k.startsWith(`${pointId}:`),
  )
    ? []
    : progress.conversations[pointId] || [];
}
