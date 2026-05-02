import { createClient } from "@supabase/supabase-js";
import { env } from "../../config/index.js";
import ApiError from "../../utils/ApiError.js";

let supabaseStorageClient = null;

const getStorageBucketName = () => env.SHARE_FILES_BUCKET;

const isShareStorageConfigured = () =>
  Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && getStorageBucketName());

const ensureShareStorageConfigured = () => {
  if (isShareStorageConfigured()) {
    return;
  }

  throw new ApiError(500, "Share storage is not configured");
};

const getShareStorageClient = () => {
  ensureShareStorageConfigured();

  if (!supabaseStorageClient) {
    supabaseStorageClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  return supabaseStorageClient;
};

const shareStorage = {
  isConfigured: isShareStorageConfigured,
  getBucketName: getStorageBucketName,
  async createSignedUploadTarget({
    storagePath,
  }) {
    const client = getShareStorageClient();
    const { data, error } = await client.storage
      .from(getStorageBucketName())
      .createSignedUploadUrl(storagePath);

    if (error) {
      throw new ApiError(500, "Unable to prepare file upload");
    }

    const token =
      typeof data?.token === "string" && data.token.trim() ? data.token.trim() : "";
    const path =
      typeof data?.path === "string" && data.path.trim() ? data.path.trim() : storagePath;

    if (!token || !path) {
      throw new ApiError(500, "Invalid upload target received from storage provider");
    }

    return {
      token,
      path,
      expiresInSeconds: 7200,
    };
  },
  async removeFiles({
    storagePaths,
  }) {
    const uniqueStoragePaths = [
      ...new Set(
        Array.isArray(storagePaths)
          ? storagePaths
              .map((value) => (typeof value === "string" ? value.trim() : ""))
              .filter(Boolean)
          : []
      ),
    ];
    if (!uniqueStoragePaths.length) {
      return;
    }

    const client = getShareStorageClient();
    const { error } = await client.storage.from(getStorageBucketName()).remove(uniqueStoragePaths);
    if (error) {
      throw new ApiError(500, "Unable to remove uploaded files");
    }
  },
  async createSignedDownloadUrl({
    storagePath,
    downloadFileName,
  }) {
    const client = getShareStorageClient();
    const { data, error } = await client.storage.from(getStorageBucketName()).createSignedUrl(
      storagePath,
      env.SHARE_DOWNLOAD_URL_TTL_SECONDS,
      {
        download:
          typeof downloadFileName === "string" && downloadFileName.trim()
            ? downloadFileName.trim()
            : true,
      }
    );

    if (error || typeof data?.signedUrl !== "string" || !data.signedUrl.trim()) {
      throw new ApiError(500, "Unable to prepare file download");
    }

    return {
      url: data.signedUrl.trim(),
      expiresInSeconds: env.SHARE_DOWNLOAD_URL_TTL_SECONDS,
    };
  },
};

export default shareStorage;
