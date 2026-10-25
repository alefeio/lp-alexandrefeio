type PreviewWriter = {
  lessonBlock: {
    updateMany: (args: {
      where: { lessonId: string; retiredAt: null; blockKey: { in: string[] } | { notIn: string[] } };
      data: { isPublicPreview: boolean };
    }) => Promise<unknown>;
  };
};

/** Marca só os blocos introdutórios aprovados. Atividade, ferramenta e resultado ficam privados. */
export async function syncLessonPublicPreview(prisma: PreviewWriter, lessonId: string, keys: readonly string[]): Promise<void> {
  const previewKeys = [...keys];
  await prisma.lessonBlock.updateMany({
    where: { lessonId, retiredAt: null, blockKey: { in: previewKeys } },
    data: { isPublicPreview: true },
  });
  await prisma.lessonBlock.updateMany({
    where: { lessonId, retiredAt: null, blockKey: { notIn: previewKeys } },
    data: { isPublicPreview: false },
  });
}
