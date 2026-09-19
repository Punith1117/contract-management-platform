"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { hiringManagerApi } from "@/utils/hiringManagerApi";
import {
  ArrowLeft,
  Briefcase,
  FileText,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  User,
  X,
  RefreshCw,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

export default function HiringManagerOpeningDetailPage({ params: paramsPromise }) {
  const params = use(paramsPromise);
  const openingId = params.id;

  const [opening, setOpening] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Per-card processing state
  const [actionProcessingId, setActionProcessingId] = useState(null);

  // Preview Modal State
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewTitle, setPreviewTitle] = useState("");

  const fetchOpeningProfiles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await hiringManagerApi.getOpeningProfiles(openingId);
      if (res && res.data) {
        setOpening(res.data.opening);
        setProfiles(res.data.profiles || []);
      }
    } catch (err) {
      console.error("Error loading profiles:", err);
      setError(err.response?.data?.message || err.message || "Failed to load candidate profiles");
    } finally {
      setLoading(false);
    }
  }, [openingId]);

  useEffect(() => {
    fetchOpeningProfiles();
  }, [fetchOpeningProfiles]);

  const handleShortlist = async (profileId) => {
    try {
      setActionProcessingId(profileId);
      await hiringManagerApi.shortlistProfile(profileId);
      // Update state locally
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === profileId
            ? { ...p, status: "SHORTLISTED", shortlistedAt: new Date().toISOString(), rejectedAt: null }
            : p
        )
      );
    } catch (err) {
      console.error("Shortlist error:", err);
      alert(err.response?.data?.message || "Failed to shortlist profile");
    } finally {
      setActionProcessingId(null);
    }
  };

  const handleReject = async (profileId) => {
    try {
      setActionProcessingId(profileId);
      await hiringManagerApi.rejectProfile(profileId);
      // Update state locally
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === profileId
            ? { ...p, status: "REJECTED", rejectedAt: new Date().toISOString(), shortlistedAt: null }
            : p
        )
      );
    } catch (err) {
      console.error("Reject error:", err);
      alert(err.response?.data?.message || "Failed to reject profile");
    } finally {
      setActionProcessingId(null);
    }
  };

  const handlePreview = async (profile) => {
    try {
      setPreviewModalOpen(true);
      setPreviewLoading(true);
      setPreviewTitle(profile.fileName);
      setPreviewUrl(null);

      const res = await hiringManagerApi.getPreviewUrl(profile.id);
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

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded-lg" />
        <div className="h-48 bg-card border border-border animate-pulse rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-card border border-border animate-pulse rounded-xl" />
          <div className="h-64 bg-card border border-border animate-pulse rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !opening) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-4">
        <Link href="/hiring-manager/openings" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to My Openings
        </Link>
        <div className="p-6 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300">
          <h2 className="text-lg font-bold mb-1">Error Loading Opening</h2>
          <p className="text-sm">{error || "Opening not found or unauthorized access."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/hiring-manager/openings"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="h-4 w-4" /> Back to My Openings
        </Link>
        <button
          onClick={fetchOpeningProfiles}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-accent transition text-foreground"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Candidates
        </button>
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
            <span className="text-xs text-muted-foreground block">Experience Range</span>
            <span className="font-semibold text-foreground">
              {opening.experienceMin} - {opening.experienceMax ? `${opening.experienceMax} Yrs` : "+ Yrs"}
            </span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Submitted Profiles</span>
            <span className="font-semibold text-primary">{profiles.length} candidates</span>
          </div>
        </div>

        {opening.description && (
          <div className="pt-2 border-t border-border/60">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Description</h3>
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">{opening.description}</p>
          </div>
        )}
      </div>

      {/* Candidate Profile Evaluation Cards Grid */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          Candidate Profiles Evaluation ({profiles.length})
        </h2>

        {profiles.length === 0 ? (
          <div className="p-12 bg-card rounded-xl border border-border text-center text-muted-foreground space-y-3">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <h3 className="text-base font-semibold text-foreground">No candidate submissions yet</h3>
            <p className="text-sm max-w-sm mx-auto">
              IT Vendors will submit candidate profiles here for your review and evaluation.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {profiles.map((prof) => {
              const isShortlisted = prof.status === "SHORTLISTED";
              const isRejected = prof.status === "REJECTED";
              const isProcessing = actionProcessingId === prof.id;

              // AI Fields Check
              const hasAiData = prof.recommended !== null && prof.recommended !== undefined;

              return (
                <div
                  key={prof.id}
                  className={`bg-card rounded-2xl border p-6 shadow-sm transition-all space-y-5 relative overflow-hidden flex flex-col justify-between ${
                    isShortlisted
                      ? "border-emerald-300 dark:border-emerald-900 bg-emerald-50/20 dark:bg-emerald-950/10"
                      : isRejected
                      ? "border-rose-300 dark:border-rose-900 bg-rose-50/20 dark:bg-rose-950/10"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  {/* Card Header: File Name & Human Decision Status */}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <FileText className="h-5 w-5 text-primary shrink-0" />
                        <h3 className="font-bold text-foreground truncate text-base" title={prof.fileName}>
                          {prof.fileName}
                        </h3>
                      </div>

                      {/* Human Status Badge */}
                      {isShortlisted && (
                        <span className="px-3 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 shrink-0 flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> SHORTLISTED
                        </span>
                      )}
                      {isRejected && (
                        <span className="px-3 py-1 text-xs font-bold rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 shrink-0 flex items-center gap-1">
                          <XCircle className="h-3.5 w-3.5" /> REJECTED
                        </span>
                      )}
                      {!isShortlisted && !isRejected && (
                        <span className="px-3 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 shrink-0">
                          SUBMITTED
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                      <span>Uploaded by: <strong className="text-foreground">{prof.uploadedBy}</strong></span>
                      <span>{new Date(prof.submittedAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* AI Agent Recommendation Box */}
                  <div className="p-4 rounded-xl border border-border/80 bg-muted/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                        <Sparkles className="h-4 w-4" />
                        <span>AI Recommendation Engine</span>
                      </div>

                      {/* AI Recommendation Badge */}
                      {(() => {
                        const score = prof.recommendationScore;
                        const category = prof.decisionCategory;

                        if (category === "RECOMMENDED" || (score !== null && score !== undefined && score >= 0.75)) {
                          return (
                            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              RECOMMENDED
                            </span>
                          );
                        }

                        if (category === "BORDERLINE" || (score !== null && score !== undefined && score >= 0.50 && score < 0.75)) {
                          return (
                            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              BORDERLINE
                            </span>
                          );
                        }

                        if (category === "NOT_RECOMMENDED" || (score !== null && score !== undefined && score < 0.50) || prof.recommended === false) {
                          return (
                            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                              NOT RECOMMENDED
                            </span>
                          );
                        }

                        if (prof.recommended === true) {
                          return (
                            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              RECOMMENDED
                            </span>
                          );
                        }

                        return (
                          <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 flex items-center gap-1 border border-gray-200 dark:border-gray-700">
                            <HelpCircle className="h-3 w-3" /> AI Pending
                          </span>
                        );
                      })()}
                    </div>

                    {/* AI Score & Confidence Metrics */}
                    <div className="grid grid-cols-3 gap-2 text-center text-xs border-y border-border/60 py-2">
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Match Score</span>
                        <span className="font-bold text-foreground text-sm">
                          {prof.recommendationScore !== null && prof.recommendationScore !== undefined
                            ? `${Math.round(prof.recommendationScore * 100)}%`
                            : "Pending"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Confidence</span>
                        <span className="font-bold text-foreground text-sm">
                          {prof.recommendationConfidence !== null && prof.recommendationConfidence !== undefined
                            ? `${Math.round(prof.recommendationConfidence * 100)}%`
                            : "Pending"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Latency</span>
                        <span className="font-mono text-foreground font-medium text-xs">
                          {prof.recommendationLatencyMs !== null && prof.recommendationLatencyMs !== undefined
                            ? `${prof.recommendationLatencyMs} ms`
                            : "N/A"}
                        </span>
                      </div>
                    </div>

                    {/* AI Explanation Text */}
                    <div className="text-xs text-foreground/80 leading-relaxed">
                      <strong className="text-muted-foreground block text-[10px] uppercase">Reasoning:</strong>
                      {prof.recommendationReason || "Recommendation evaluation is currently pending."}
                    </div>
                  </div>

                  {/* Actions Bar: Human Decision Buttons */}
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/80">
                    <button
                      onClick={() => handlePreview(prof)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-primary border border-primary/20 rounded-lg hover:bg-primary/10 transition"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Preview Resume
                    </button>

                    <div className="flex items-center gap-2">
                      {/* Shortlist Button (100% Functional regardless of AI state) */}
                      <button
                        disabled={isProcessing || isShortlisted}
                        onClick={() => handleShortlist(prof.id)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition ${
                          isShortlisted
                            ? "bg-emerald-600 text-white cursor-default opacity-90"
                            : "bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                        }`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {isShortlisted ? "Shortlisted" : "Shortlist"}
                      </button>

                      {/* Reject Button (100% Functional regardless of AI state) */}
                      <button
                        disabled={isProcessing || isRejected}
                        onClick={() => handleReject(prof.id)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition ${
                          isRejected
                            ? "bg-rose-600 text-white cursor-default opacity-90"
                            : "border border-rose-200 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 dark:border-rose-900 disabled:opacity-50"
                        }`}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        {isRejected ? "Rejected" : "Reject"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
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
    </div>
  );
}
