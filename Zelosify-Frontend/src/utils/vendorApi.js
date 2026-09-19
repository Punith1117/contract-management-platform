import axiosInstance from "./Axios/AxiosInstance";

const getBaseUrl = () => {
  return process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
};

export const vendorApi = {
  // GET /api/v1/vendor/openings
  getOpenings: async ({ page = 1, limit = 10, search = "", status = "" } = {}) => {
    const params = new URLSearchParams();
    if (page) params.append("page", page.toString());
    if (limit) params.append("limit", limit.toString());
    if (search) params.append("search", search);
    if (status && status !== "ALL") params.append("status", status);

    const res = await axiosInstance.get(
      `${getBaseUrl()}/api/v1/vendor/openings?${params.toString()}`
    );
    return res.data;
  },

  // GET /api/v1/vendor/openings/:id
  getOpeningById: async (id) => {
    const res = await axiosInstance.get(
      `${getBaseUrl()}/api/v1/vendor/openings/${id}`
    );
    return res.data;
  },

  // POST /api/v1/vendor/openings/:id/profiles/presign
  presignUpload: async (id, { fileName, contentType, fileSize }) => {
    const res = await axiosInstance.post(
      `${getBaseUrl()}/api/v1/vendor/openings/${id}/profiles/presign`,
      { fileName, contentType, fileSize }
    );
    return res.data;
  },

  // Direct S3 Upload via Presigned PUT URL
  uploadToS3: async (uploadUrl, file) => {
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "application/pdf",
      },
      body: file,
    });

    if (!res.ok) {
      throw new Error(`S3 direct upload failed with status ${res.status}`);
    }
  },

  // POST /api/v1/vendor/openings/:id/profiles/upload
  submitProfile: async (id, s3Key) => {
    const res = await axiosInstance.post(
      `${getBaseUrl()}/api/v1/vendor/openings/${id}/profiles/upload`,
      { s3Key }
    );
    return res.data;
  },

  // DELETE /api/v1/vendor/profiles/:id
  deleteProfile: async (profileId) => {
    const res = await axiosInstance.delete(
      `${getBaseUrl()}/api/v1/vendor/profiles/${profileId}`
    );
    return res.data;
  },

  // GET /api/v1/vendor/profiles/:id/preview
  getPreviewUrl: async (profileId) => {
    const res = await axiosInstance.get(
      `${getBaseUrl()}/api/v1/vendor/profiles/${profileId}/preview`
    );
    return res.data;
  },
};
