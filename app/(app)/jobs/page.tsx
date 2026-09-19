"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createJobSchema, type CreateJobInput } from "@/lib/schemas";
import { useCreateJob, useJobs } from "@/lib/client/hooks";
import { ApiError } from "@/lib/client/api";
import { StatusBadge } from "@/components/status-badge";

// The list half of this page is provided and will light up as soon as GET /api/jobs works
// (Task 2). Note how it handles loading, error and empty separately — we'd like the same care
// in the parts you write.
export default function JobsPage() {
  const jobs = useJobs();
  const createJob = useCreateJob();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateJobInput>({
    resolver: zodResolver(createJobSchema),
    defaultValues: { sourceUrl: "", title: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await createJob.mutateAsync(values);
      reset();
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) {
        for (const [field, messages] of Object.entries(err.fieldErrors)) {
          if ((field === "sourceUrl" || field === "title") && messages[0]) {
            setError(field, { type: "server", message: messages[0] });
          }
        }
      } else if (err instanceof Error) {
        setFormError(err.message);
      } else {
        setFormError("Failed to create job");
      }
    }
  });

  const isPending = isSubmitting || createJob.isPending;

  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-4 text-xl font-semibold">New encode job</h1>
        <form onSubmit={onSubmit} className="space-y-4 rounded-md border border-neutral-200 p-4" noValidate>
          <div>
            <label htmlFor="sourceUrl" className="mb-1 block text-sm font-medium">
              Source URL
            </label>
            <input
              id="sourceUrl"
              {...register("sourceUrl")}
              type="url"
              placeholder="https://cdn.example.com/videos/clip.mp4"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
            {errors.sourceUrl && (
              <p className="mt-1 text-xs text-red-600">{errors.sourceUrl.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="title" className="mb-1 block text-sm font-medium">
              Title <span className="font-normal text-neutral-400">(optional)</span>
            </label>
            <input
              id="title"
              {...register("title")}
              type="text"
              placeholder="My clip"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
            {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>}
          </div>

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? "Creating job…" : "Create job"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Jobs</h2>

        {jobs.isLoading && <p className="text-sm text-neutral-500">Loading jobs…</p>}

        {jobs.isError && (
          <div className="text-sm text-red-600">
            Couldn’t load jobs — is GET /api/jobs implemented?{" "}
            <button onClick={() => jobs.refetch()} className="underline">
              Retry
            </button>
          </div>
        )}

        {jobs.data?.length === 0 && (
          <p className="rounded-md border border-neutral-200 p-4 text-sm text-neutral-500">
            No jobs yet. Create one above to get started.
          </p>
        )}

        {jobs.data && jobs.data.length > 0 && (
          <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200">
            {jobs.data.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/jobs/${job.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-neutral-50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{job.title}</p>
                    <p className="truncate text-xs text-neutral-500">{job.sourceUrl}</p>
                  </div>
                  <StatusBadge value={job.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
