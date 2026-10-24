/**
 * Pastas no mesmo papel do CadastroCursos: prefixo lógico do projeto.
 * Não são campo nem header do POST /v1/upload.
 */
export const APIMG_LANDING_MEDIA_KIND = "landing-pages";

const FOLDER_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

export type ApimgLandingMediaEnv = {
  APIMG_UPLOAD_URL?: string;
  APIMG_API_KEY?: string;
  APIMG_UPLOAD_FOLDER?: string;
  APIMG_SITE_UPLOAD_FOLDER?: string;
};

export type ApimgLandingMediaConfig = {
  uploadUrl: string;
  apiKey: string;
  uploadFolder: string;
  siteUploadFolder: string;
  landingMediaFolder: string;
};

function folder(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed.length > 80 || !FOLDER_PATTERN.test(trimmed)) return null;
  return trimmed;
}

export function readApimgLandingMediaConfig(env?: ApimgLandingMediaEnv): ApimgLandingMediaConfig | null {
  const source = env ?? (process.env as ApimgLandingMediaEnv);
  const uploadUrl = source.APIMG_UPLOAD_URL?.trim() ?? "";
  const apiKey = source.APIMG_API_KEY?.trim() ?? "";
  const uploadFolder = folder(source.APIMG_UPLOAD_FOLDER);
  const siteUploadFolder = folder(source.APIMG_SITE_UPLOAD_FOLDER);
  if (!uploadUrl || !apiKey || !uploadFolder || !siteUploadFolder) return null;
  try {
    const url = new URL(uploadUrl);
    if (url.protocol !== "https:" || url.hostname !== "apimg.com.br" || url.username || url.password) return null;
  } catch {
    return null;
  }
  return {
    uploadUrl,
    apiKey,
    uploadFolder,
    siteUploadFolder,
    landingMediaFolder: `${siteUploadFolder}/${APIMG_LANDING_MEDIA_KIND}`,
  };
}
