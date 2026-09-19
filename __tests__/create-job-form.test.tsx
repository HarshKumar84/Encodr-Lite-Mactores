import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import JobsPage from "@/app/(app)/jobs/page";
import { api, ApiError } from "@/lib/client/api";

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("JobsPage Create-Job Form (Task 4)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, "get").mockResolvedValue([]);
  });

  it("shows validation error on invalid URL and does not call API", async () => {
    const postSpy = vi.spyOn(api, "post");
    const user = userEvent.setup();

    renderWithClient(<JobsPage />);

    const urlInput = screen.getByLabelText(/source url/i);
    const submitBtn = screen.getByRole("button", { name: /create job/i });

    await user.type(urlInput, "not-a-url");
    await user.click(submitBtn);

    expect(await screen.findByText(/enter a valid url/i)).toBeInTheDocument();
    expect(postSpy).not.toHaveBeenCalled();
  });

  it("submits valid form data to API and resets form on success", async () => {
    const postSpy = vi.spyOn(api, "post").mockResolvedValue({
      id: "j_test",
      title: "My custom clip",
      sourceUrl: "https://cdn.example.com/videos/clip.mp4",
      status: "NEW",
      createdAt: new Date().toISOString(),
    });
    const user = userEvent.setup();

    renderWithClient(<JobsPage />);

    const urlInput = screen.getByLabelText(/source url/i);
    const titleInput = screen.getByLabelText(/title/i);
    const submitBtn = screen.getByRole("button", { name: /create job/i });

    await user.type(urlInput, "https://cdn.example.com/videos/clip.mp4");
    await user.type(titleInput, "My custom clip");
    await user.click(submitBtn);

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith("/api/jobs", {
        sourceUrl: "https://cdn.example.com/videos/clip.mp4",
        title: "My custom clip",
      });
    });

    // Form inputs reset on success
    await waitFor(() => {
      expect(urlInput).toHaveValue("");
      expect(titleInput).toHaveValue("");
    });
  });

  it("maps server 422 fieldErrors back onto individual form fields", async () => {
    vi.spyOn(api, "post").mockRejectedValue(
      new ApiError(422, "Validation failed", {
        sourceUrl: ["Only http and https URLs are supported"],
        title: ["Keep the title under 80 characters"],
      }),
    );
    const user = userEvent.setup();

    renderWithClient(<JobsPage />);

    const urlInput = screen.getByLabelText(/source url/i);
    const titleInput = screen.getByLabelText(/title/i);
    const submitBtn = screen.getByRole("button", { name: /create job/i });

    await user.type(urlInput, "https://cdn.example.com/video.mp4");
    await user.type(titleInput, "Valid title");
    await user.click(submitBtn);

    expect(
      await screen.findByText("Only http and https URLs are supported"),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Keep the title under 80 characters"),
    ).toBeInTheDocument();
  });
});
