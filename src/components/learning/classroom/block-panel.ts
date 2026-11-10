/** Linguagem visual por tipo de bloco — não altera comportamento. */
export function blockPanelKind(
  type: string,
): "heading" | "prose" | "insight" | "example" | "media" | "practice" | "tool" | "result" | "plain" {
  switch (type) {
    case "HEADING":
      return "heading";
    case "TEXT":
    case "CONCLUSION":
      return "prose";
    case "CALLOUT":
      return "insight";
    case "EXAMPLE":
      return "example";
    case "IMAGE":
      return "media";
    case "CHECKPOINT":
    case "ACTIVITY":
    case "CHECKLIST":
      return "practice";
    case "TOOL":
      return "tool";
    case "RESULT":
      return "result";
    default:
      return "plain";
  }
}

export function blockPanelClass(type: string): string {
  const kind = blockPanelKind(type);
  switch (kind) {
    case "heading":
      return "classroom-panel classroom-panel--heading";
    case "prose":
      return "classroom-panel classroom-panel--prose";
    case "insight":
      return "classroom-panel classroom-panel--insight";
    case "example":
      return "classroom-panel classroom-panel--example";
    case "media":
      return "classroom-panel classroom-panel--media";
    case "practice":
      return "classroom-panel classroom-panel--practice";
    case "tool":
      return "classroom-panel classroom-panel--tool";
    case "result":
      return "classroom-panel classroom-panel--result";
    default:
      return "classroom-panel";
  }
}

export function blockKindLabel(type: string): string | null {
  switch (type) {
    case "CALLOUT":
      return "Conceito";
    case "CHECKPOINT":
      return "Checkpoint";
    case "ACTIVITY":
      return "Atividade";
    case "CHECKLIST":
      return "Checklist";
    case "TOOL":
      return "Ferramenta";
    case "RESULT":
      return "Resultado";
    case "CONCLUSION":
      return "Conclusão";
    // EXAMPLE já exibe o próprio rótulo no corpo do bloco.
    default:
      return null;
  }
}
