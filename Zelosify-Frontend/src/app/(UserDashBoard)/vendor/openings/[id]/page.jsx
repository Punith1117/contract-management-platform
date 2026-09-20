"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { vendorApi } from "@/utils/vendorApi";
import {
  ArrowLeft,
  Briefcase,
  Upload,
  FileText,
  Eye,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  UserCheck,
  X,
  RefreshCw,
} from "lucide-react";

export default function VendorOpeningDetailPage({ params: paramsPromise }) {
  const params = use(paramsPromise);
  const openingId = params.id;

  const [opening, setOpening] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Batch Resume Upload State
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]); // Array of { id, file, status: 'pending'|'uploading'|'uploaded'|'failed', error?: string, progressMsg?: string }
  const [uploading, setUploading] = useState(false);
  const [batchSummary, setBatchSummary] = useState(null); // { successCount, failCount }

  // Preview Modal State
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewTitle, setPreviewTitle] = useState("");

  // Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchOpeningDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await vendorApi.getOpeningById(openingId);
      if (res && res.data) {
        setOpening(res.data);
      }
    } catch (err) {
      console.error("Error fetching opening details:", err);
      setError(err.response?.data?.message || err.message || "Failed to load opening details");
    } finally {
      setLoading(false);
    }
  }, [openingId]);

  useEffect(() => {
    fetchOpeningDetails();
  }, [fetchOpeningDetails]);

  // Handle Drag events
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const validateFile = (file) => {
    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    const isPptx =
      file.type ===
        "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
      file.name.toLowerCase().endsWith(".pptx");
    if (!isPdf && !isPptx) {
      return { valid: false, reason: "Only PDF and PPTX files supported" };
    }

    const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX_SIZE) {
      return { valid: false, reason: "File exceeds max size of 10 MB" };
    }

    return { valid: true };
  };

  const addFilesToBatch = (filesList) => {
    setBatchSummary(null);
    const newItems = [];

    Array.from(filesList).forEach((file) => {
      const fileId = `${file.name}-${file.size}-${file.lastModified}`;
      
      // Prevent duplicates in selection list
      if (selectedFiles.some((item) => item.id === fileId)) {
        return;
      }

      const validation = validateFile(file);
      if (validation.valid) {
        newItems.push({
          id: fileId,
          file,
          status: "pending",
        });
      } else {
        newItems.push({
          id: fileId,
          file,
          status: "failed",
          error: validation.reason,
        });
      }
    });

    if (newItems.length > 0) {
      setSelectedFiles((prev) => [...prev, ...newItems]);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToBatch(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToBatch(e.target.files);
      e.target.value = ""; // reset input
    }
  };

  const removeFileFromBatch = (fileId) => {
    setSelectedFiles((prev) => prev.filter((item) => item.id !== fileId));
  };

  const clearCompletedFiles = () => {
    setSelectedFiles((prev) => prev.filter((item) => item.status !== "uploaded"));
  };

  // Process Batch Upload sequentially or with small concurrency
  const handleBatchUploadSubmit = async () => {
    const pendingItems = selectedFiles.filter((item) => item.status === "pending" || item.status === "failed");
    if (pendingItems.length === 0) return;

    setUploading(true);
    setBatchSummary(null);

    let successCount = 0;
    let failCount = 0;

    for (const item of pendingItems) {
      // Skip if file itself is invalid (e.g. non-pdf or oversized)
      const val = validateFile(item.file);
      if (!val.valid) {
        failCount++;
        setSelectedFiles((prev) =>
          prev.map((f) => (f.id === item.id ? { ...f, status: "failed", error: val.reason } : f))
        );
        continue;
      }

      // Mark file as uploading
      setSelectedFiles((prev) =>
        prev.map((f) =>
          f.id === item.id ? { ...f, status: "uploading", progressMsg: "Requesting presigned URL...", error: undefined } : f
        )
      );

      try {
        // Step 1: Presign upload URL
        const presignRes = await vendorApi.presignUpload(openingId, {
          fileName: item.file.name,
          contentType: item.file.type || "application/pdf",
          fileSize: item.file.size,
        });

        const { uploadUrl, key } = presignRes;

        // Step 2: Upload PDF directly to S3
        setSelectedFiles((prev) =>
          prev.map((f) => (f.id === item.id ? { ...f, progressMsg: "Uploading to S3..." } : f))
        );
        await vendorApi.uploadToS3(uploadUrl, item.file);

        // Step 3: Submit profile metadata
        setSelectedFiles((prev) =>
          prev.map((f) => (f.id === item.id ? { ...f, progressMsg: "Creating profile record..." } : f))
        );
        await vendorApi.submitProfile(openingId, key);

        // Step 4: Mark uploaded
        setSelectedFiles((prev) =>
          prev.map((f) => (f.id === item.id ? { ...f, status: "uploaded", progressMsg: undefined } : f))
        );
        successCount++;
      } catch (err) {
        console.error(`Upload error for file ${item.file.name}:`, err);
        const errMsg = err.response?.data?.message || err.message || "Failed to upload";
        setSelectedFiles((prev) =>
          prev.map((f) => (f.id === item.id ? { ...f, status: "failed", error: errMsg, progressMsg: undefined } : f))
        );
        failCount++;
      }
    }

    setUploading(false);
    setBatchSummary({ successCount, failCount });

    // Refresh active profiles list from server
    fetchOpeningDetails();
  };

  // Handle PDF Preview
  const handlePreview = async (profile) => {
    try {
      setPreviewModalOpen(true);
      setPreviewLoading(true);
      setPreviewTitle(profile.fileName);
      setPreviewUrl(null);

      const res = await vendorApi.getPreviewUrl(profile.id);
      if (res && res.previewUrl) {
        setPreviewUrl(res.previewUrl);
      }
    } catch (err) {
      console.error("Preview error:", err);
      alert(err.response?.data?.message || "Failed to load PDF preview");
      setPreviewModalOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Handle Soft Delete
  const confirmDelete = (profile) => {
    setProfileToDelete(profile);
    setDeleteModalOpen(true);
  };

  const handleDeleteSubmit = async () => {
    if (!profileToDelete) return;

    try {
      setDeleting(true);
      await vendorApi.deleteProfile(profileToDelete.id);
      setDeleteModalOpen(false);
      setProfileToDelete(null);
      fetchOpeningDetails();
    } catch (err) {
      console.error("Delete error:", err);
      alert(err.response?.data?.message || "Failed to delete candidate profile");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded-lg" />
        <div className="h-48 bg-card border border-border animate-pulse rounded-xl" />
        <div className="h-64 bg-card border border-border animate-pulse rounded-xl" />
      </div>
    );
  }

  if (error || !opening) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-4">
        <Link href="/vendor/openings" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to Openings
        </Link>
        <div className="p-6 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300">
          <h2 className="text-lg font-bold mb-1">Error Loading Opening</h2>
          <p className="text-sm">{error || "Opening not found or unauthorized access."}</p>
        </div>
      </div>
    );
  }

  const pendingCount = selectedFiles.filter((f) => f.status === "pending" || f.status === "failed").length;
  const uploadedCount = selectedFiles.filter((f) => f.status === "uploaded").length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Top Navigation */}
      <div>
        <Link
          href="/vendor/openings"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="h-4 w-4" /> Back to All Openings
        </Link>
      </div>

      {/* Opening Header Card */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{opening.title}</h1>
              <span
                className={`px-3 py-1 text-xs font-semibold rounded-full ${
                  opening.status === "OPEN"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : opening.status === "CLOSED"
                    ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                }`}
              >
                {opening.status}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Hiring Manager: <span className="font-medium text-foreground">{opening.hiringManagerName}</span>
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground bg-muted/40 px-3 py-2 rounded-lg border border-border">
            <Clock className="h-4 w-4 text-primary" />
            Posted on {new Date(opening.postedDate).toLocaleDateString()}
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm pt-2">
          <div>
            <span className="text-xs text-muted-foreground block">Location</span>
            <span className="font-semibold text-foreground">{opening.location || "N/A"}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Contract Type</span>
            <span className="font-semibold text-foreground">{opening.contractType || "N/A"}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Experience Required</span>
            <span className="font-semibold text-foreground">
              {opening.experienceMin} - {opening.experienceMax ? `${opening.experienceMax} Yrs` : "+ Yrs"}
            </span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Active Submissions</span>
            <span className="font-semibold text-primary">{opening.profilesCount} profiles</span>
          </div>
        </div>

        {opening.description && (
          <div className="pt-2 border-t border-border/60">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Description</h3>
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">{opening.description}</p>
          </div>
        )}
      </div>

      {/* Candidate Resume Batch Upload Section */}
      {opening.status === "OPEN" ? (
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Submit Candidate Resumes (Batch PDF Upload)
            </h2>
            {uploadedCount > 0 && (
              <button
                onClick={clearCompletedFiles}
                disabled={uploading}
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition"
              >
                Clear Completed ({uploadedCount})
              </button>
            )}
          </div>

          {/* Drag & Drop Area */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
              dragActive
                ? "border-primary bg-primary/5 scale-[1.01]"
                : "border-border hover:border-primary/50 bg-muted/10"
            }`}
          >
            <input
              id="resume-file-input"
              type="file"
              multiple
              accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              onChange={handleFileSelect}
              className="hidden"
              disabled={uploading}
            />

            <div className="flex flex-col items-center justify-center space-y-3">
              <FileText className="h-10 w-10 text-primary/70" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Drag and drop candidate resume PDFs here (multiple supported), or{" "}
                  <label htmlFor="resume-file-input" className="text-primary hover:underline cursor-pointer">
                    browse files
                  </label>
                </p>
                <p className="text-xs text-muted-foreground mt-1">PDF or PPTX format only (Max 10 MB per resume)</p>
              </div>
            </div>
          </div>

          {/* Selected Files Upload Batch List */}
          {selectedFiles.length > 0 && (
            <div className="border border-border rounded-xl p-4 bg-muted/20 space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Selected Resumes ({selectedFiles.length})
              </h3>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {selectedFiles.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-card border border-border rounded-lg text-sm"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <FileText className="h-5 w-5 text-primary shrink-0" />
                      <div className="truncate">
                        <span className="font-medium text-foreground truncate block">{item.file.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {(item.file.size / (1024 * 1024)).toFixed(2)} MB
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Status Badges */}
                      {item.status === "pending" && (
                        <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                          Pending
                        </span>
                      )}

                      {item.status === "uploading" && (
                        <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 flex items-center gap-1.5">
                          <div className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                          {item.progressMsg || "Uploading..."}
                        </span>
                      )}

                      {item.status === "uploaded" && (
                        <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Uploaded
                        </span>
                      )}

                      {item.status === "failed" && (
                        <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5" />
                          {item.error || "Failed"}
                        </span>
                      )}

                      {/* Remove Button */}
                      {!uploading && (
                        <button
                          onClick={() => removeFileFromBatch(item.id)}
                          className="text-muted-foreground hover:text-rose-600 p-1"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Batch Processing Summary Feedback */}
          {batchSummary && (
            <div className="p-3 rounded-lg border text-xs flex items-center justify-between bg-card border-border">
              <span className="text-foreground font-medium">
                Batch Upload Complete:{" "}
                <span className="text-emerald-600 font-bold">{batchSummary.successCount} succeeded</span>
                {batchSummary.failCount > 0 && (
                  <span className="text-rose-600 font-bold">, {batchSummary.failCount} failed</span>
                )}
              </span>
            </div>
          )}

          {/* Upload Submit Button */}
          <div className="flex justify-end">
            <button
              disabled={pendingCount === 0 || uploading}
              onClick={handleBatchUploadSubmit}
              className="px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              {uploading
                ? "Uploading Resumes..."
                : pendingCount > 1
                ? `Submit ${pendingCount} Candidate Resumes`
                : "Submit Candidate Resume"}
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300">
          This opening is currently <strong>{opening.status}</strong> and is not accepting new candidate profile submissions.
        </div>
      )}

      {/* Submitted Profiles List Table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden space-y-4">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            Submitted Candidate Profiles ({opening.profiles.length})
          </h2>
          <button
            onClick={fetchOpeningDetails}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-accent transition text-foreground"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh List
          </button>
        </div>

        {opening.profiles.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground space-y-2">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-sm font-medium">No candidate profiles submitted yet for this opening.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-medium">
                  <th className="py-3 px-4">Candidate File Name</th>
                  <th className="py-3 px-4">Uploaded By</th>
                  <th className="py-3 px-4">Submitted Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {opening.profiles.map((prof) => (
                  <tr key={prof.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-foreground flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <span className="truncate max-w-xs">{prof.fileName}</span>
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground">{prof.uploadedBy}</td>
                    <td className="py-3.5 px-4 text-muted-foreground">
                      {new Date(prof.submittedAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                        {prof.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      {/* Preview PDF Button */}
                      <button
                        onClick={() => handlePreview(prof)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary border border-primary/20 rounded-md hover:bg-primary/10 transition"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Preview
                      </button>

                      {/* Soft Delete Button */}
                      <button
                        onClick={() => confirmDelete(prof)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 border border-rose-200 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PDF Preview Modal */}
      {previewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/40">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2 truncate">
                <FileText className="h-4 w-4 text-primary" />
                {previewTitle}
              </h3>
              <button
                onClick={() => setPreviewModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 bg-muted/20 relative">
              {previewLoading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    Loading PDF preview...
                  </div>
                </div>
              ) : previewUrl ? (
                <iframe src={previewUrl} className="w-full h-full border-none" title="PDF Preview" />
              ) : (
                <div className="p-8 text-center text-rose-600">Failed to load preview stream.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Soft Delete Confirmation Modal */}
      {deleteModalOpen && profileToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-xl border border-border p-6 shadow-2xl max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-rose-600" />
              Soft Delete Profile?
            </h3>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete candidate profile <strong className="text-foreground">{profileToDelete.fileName}</strong>?
              This will remove it from the active profile list.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                disabled={deleting}
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold border border-border rounded-lg hover:bg-accent transition"
              >
                Cancel
              </button>
              <button
                disabled={deleting}
                onClick={handleDeleteSubmit}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 transition"
              >
                {deleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
