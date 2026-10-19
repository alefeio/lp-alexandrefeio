import type { BlockType } from "@/lib/learning/blocks";

/** Tipos que podem aparecer na amostra pública. Ferramenta, resultado e atividade ficam de fora. */
export const PUBLIC_PREVIEW_TYPES = ["HEADING", "TEXT", "CALLOUT", "EXAMPLE"] as const;

export type PublicPreviewType = (typeof PUBLIC_PREVIEW_TYPES)[number];

export function acceptsPublicPreview(type: string): type is PublicPreviewType {
  return (PUBLIC_PREVIEW_TYPES as readonly string[]).includes(type);
}

export function publicPreviewFlag(type: BlockType | string, requested: boolean): boolean {
  return requested && acceptsPublicPreview(type);
}

export const LESSON_04_PUBLIC_PREVIEW_KEYS = [
  "transformar-vontade-em-plano",
  "antes-de-abrir-plataforma",
  "campanha-e-hipotese",
  "primeiro-objetivo",
  "objetivo-de-negocio",
] as const;

export const LESSON_05_PUBLIC_PREVIEW_KEYS = [
  "depois-do-clique",
  "clique-nao-encerra-campanha",
  "destino-faz-parte-da-campanha",
  "funcao-do-destino",
  "tres-perguntas-destino",
  "exemplo-destino-coerente",
] as const;

export const LESSON_10_PUBLIC_PREVIEW_KEYS = [
  "lead-nao-e-venda",
  "contato-nao-e-venda",
  "do-anuncio-ao-resultado",
  "tres-caminhos",
  "comparacao-dos-caminhos",
  "qualidade-antes-do-volume",
] as const;

export const LESSON_09_PUBLIC_PREVIEW_KEYS = [
  "campanha-comeca-pelo-resultado",
  "cadeia-do-resultado",
  "negocio-nao-e-o-botao",
  "os-seis-objetivos",
  "cada-objetivo-em-uma-frase",
  "tres-niveis-da-campanha",
] as const;

export const LESSON_08_PUBLIC_PREVIEW_KEYS = [
  "busca-anuncio-pagina",
  "cadeia-da-conversao",
  "anuncio-nao-existe-sozinho",
  "o-que-e-rsa",
  "combinacoes-do-rsa",
  "exemplo-curso-curto",
] as const;

export const LESSON_07_PUBLIC_PREVIEW_KEYS = [
  "palavra-nao-e-termo",
  "regra-e-termo",
  "keyword-e-regra",
  "exemplo-advogado-trabalhista",
  "intencao-antes-do-volume",
  "intencao-nao-e-nota",
] as const;

export const LESSON_06_PUBLIC_PREVIEW_KEYS = [
  "campanha-antes-da-plataforma",
  "pesquisa-nao-comeca-palavra-chave",
  "nao-abra-google-ainda",
  "hierarquia-pesquisa",
  "campanha-grupo-palavra-anuncio",
] as const;
