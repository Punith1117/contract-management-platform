"use client";

import { useState, useEffect, useCallback } from "react";
import useRouter from "next/navigation";
import Link from "next/link";
import { vendorApi } from "@/utils/vendorApi";
import { Search, Briefcase, Filter, ChevronLeft, ChevronRight, Eye, RefreshCw } from "lucide-react";

export default function VendorOpeningsPage() {
  const [openings, setOpenings] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOpenings = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const response = await vendorApi.getOpenings({
        page,
        limit: 10,
        search,
        status: statusFilter,
      });

      if (response && response.data) {
        setOpenings(response.data);
        setPagination(response.pagination || { page, limit: 10, total: response.data.length, totalPages: 1 });
      }
    } catch (err) {
      console.error("Failed to fetch vendor openings:", err);
      setError(err.response?.data?.message || err.message || "Failed to load contract openings");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchOpenings(1);
  }, [fetchOpenings]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchOpenings(1);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "OPEN":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">OPEN</span>;
      case "CLOSED":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">CLOSED</span>;
      case "ON_HOLD":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">ON HOLD</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary" />
            Contract Openings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            View available contract roles for your tenant and submit candidate profiles.
          </p>
        </div>
        <button
          onClick={() => fetchOpenings(pagination.page)}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border border-border rounded-lg hover:bg-accent transition text-foreground"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card p-4 rounded-xl border border-border shadow-sm">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by title, location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </form>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open Only</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Table & Content */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-muted/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : openings.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground space-y-3">
            <Briefcase className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <h3 className="text-lg font-semibold text-foreground">No openings found</h3>
            <p className="text-sm max-w-sm mx-auto">
              There are currently no contract openings matching your filter criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-medium">
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Contract Type</th>
                  <th className="py-3 px-4">Experience Range</th>
                  <th className="py-3 px-4">Hiring Manager</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Submitted Profiles</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {openings.map((op) => (
                  <tr key={op.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-foreground">
                      <Link href={`/vendor/openings/${op.id}`} className="hover:underline hover:text-primary">
                        {op.title}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground">{op.location || "N/A"}</td>
                    <td className="py-3.5 px-4 text-muted-foreground">{op.contractType || "N/A"}</td>
                    <td className="py-3.5 px-4 text-muted-foreground font-mono text-xs">
                      {op.experienceMin} - {op.experienceMax ? `${op.experienceMax} yrs` : "+ yrs"}
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground">{op.hiringManagerName}</td>
                    <td className="py-3.5 px-4">{getStatusBadge(op.status)}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                        {op.profilesCount} profiles
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/vendor/openings/${op.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary border border-primary/20 rounded-md hover:bg-primary/10 transition"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!loading && openings.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-border bg-muted/20">
            <span className="text-xs text-muted-foreground">
              Showing page <span className="font-semibold text-foreground">{pagination.page}</span> of{" "}
              <span className="font-semibold text-foreground">{pagination.totalPages}</span> ({pagination.total} total openings)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchOpenings(pagination.page - 1)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchOpenings(pagination.page + 1)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
