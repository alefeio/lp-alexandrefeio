export function ownedByUser(userId: string) {
  return { userId };
}

export function ownedRecord(userId: string, id: string) {
  return { id, userId };
}

export function ownedLesson(userId: string, lessonId: string) {
  return { userId, lessonId };
}

export function belongsToUser(record: { userId: string } | null | undefined, userId: string): boolean {
  return record?.userId === userId;
}
