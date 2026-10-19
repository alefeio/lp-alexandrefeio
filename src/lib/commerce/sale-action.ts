/** Aula já comprada abre o acesso. Compra só aparece quando está à venda e ainda não é do aluno. */
export function paidLessonAction(input: { open: boolean; owned: boolean }): "access" | "buy" | "soon" {
  if (input.owned) return "access";
  if (input.open) return "buy";
  return "soon";
}
