-- Runtime de publicação. Somente colunas, chave e gatilho novos.
-- Não apaga publicação, lead, métrica nem mídia.

ALTER TABLE "landing_page_publication" ADD COLUMN "sourceDraftRevision" INTEGER;
ALTER TABLE "landing_page_publication" ADD COLUMN "snapshotHash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "landing_page_publication" ADD COLUMN "snapshotSchemaVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "landing_page_publication" ADD COLUMN "rollbackSourcePublicationId" TEXT;

ALTER TABLE "landing_page_publication"
ADD CONSTRAINT "landing_page_publication_rollbackSourcePublicationId_fkey"
FOREIGN KEY ("rollbackSourcePublicationId") REFERENCES "landing_page_publication"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION landing_page_active_publication_same_project()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."publishedPublicationId" IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM "landing_page_publication" publication
    WHERE publication."id" = NEW."publishedPublicationId"
      AND publication."landingPageProjectId" = NEW."id"
  ) THEN
    RAISE EXCEPTION 'active publication must belong to the same landing page project';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER landing_page_project_active_publication_same_project
BEFORE INSERT OR UPDATE OF "publishedPublicationId" ON "landing_page_project"
FOR EACH ROW
EXECUTE FUNCTION landing_page_active_publication_same_project();
