/** Destino do curso na UI contextual. SEO/canonical/JSON-LD continuam em `/cursos/...`. */
export function courseHref(slug: string, authenticated: boolean): string {
  return authenticated ? `/app/cursos/${slug}` : `/cursos/${slug}`;
}
