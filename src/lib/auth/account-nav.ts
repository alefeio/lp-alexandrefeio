export function accountNavLabels(signedIn: boolean): string[] {
  return signedIn ? ["Área do aluno", "Sair"] : ["Entrar", "Criar conta"];
}
