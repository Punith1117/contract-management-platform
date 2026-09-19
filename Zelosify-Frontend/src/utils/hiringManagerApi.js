import axiosInstance from "./Axios/AxiosInstance";

const getBaseUrl = () => {
  return process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
};

export const hiringManagerApi = {
  // GET /api/v1/hiring-manager/openings
  getOpenings: async ({ page = 1, limit = 10, search = "", status = "" } = {}) => {
    const params = new URLSearchParams();
    if (page) params.append("page", page.toString());
    if (limit) params.append("limit", limit.toString());
    if (search) params.append("search", search);
    if (status && status !== "ALL") params.append("status", status);

    const res = await axiosInstance.get(
      `${getBaseUrl()}/api/v1/hiring-manager/openings?${params.toString()}`
    );
    return res.data;
  },

  // POST /api/v1/hiring-manager/openings
  createOpening: async (openingData) => {
    const res = await axiosInstance.post(
      `${getBaseUrl()}/api/v1/hiring-manager/openings`,
      openingData
    );
    return res.data;
  },

  // GET /api/v1/hiring-manager/openings/:id/profiles
  getOpeningProfiles: async (id) => {
    const res = await axiosInstance.get(
      `${getBaseUrl()}/api/v1/hiring-manager/openings/${id}/profiles`
    );
    return res.data;
  },

  // PATCH /api/v1/hiring-manager/openings/:id/status
  updateOpeningStatus: async (id, status) => {
    const res = await axiosInstance.patch(
      `${getBaseUrl()}/api/v1/hiring-manager/openings/${id}/status`,
      { status }
    );
    return res.data;
  },

  // POST /api/v1/hiring-manager/profiles/:id/shortlist
  shortlistProfile: async (profileId) => {
    const res = await axiosInstance.post(
      `${getBaseUrl()}/api/v1/hiring-manager/profiles/${profileId}/shortlist`
    );
    return res.data;
  },

  // POST /api/v1/hiring-manager/profiles/:id/reject
  rejectProfile: async (profileId) => {
    const res = await axiosInstance.post(
      `${getBaseUrl()}/api/v1/hiring-manager/profiles/${profileId}/reject`
    );
    return res.data;
  },

  // GET /api/v1/hiring-manager/profiles/:id/preview
  getPreviewUrl: async (profileId) => {
    const res = await axiosInstance.get(
      `${getBaseUrl()}/api/v1/hiring-manager/profiles/${profileId}/preview`
    );
    return res.data;
  },
};
