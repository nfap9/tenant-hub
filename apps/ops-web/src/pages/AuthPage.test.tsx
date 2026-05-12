import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthPage } from "./AuthPage";

vi.mock("../api/client", () => ({
  api: vi.fn(() => Promise.resolve({ name: "Tenant Hub" }))
}));

describe("AuthPage", () => {
  it("should render login and register tabs", () => {
    render(<AuthPage onAuthed={() => {}} />);
    expect(screen.getByText("登录")).toBeInTheDocument();
    expect(screen.getByText("注册")).toBeInTheDocument();
  });

  it("should render brand title", () => {
    render(<AuthPage onAuthed={() => {}} />);
    expect(screen.getByText("Tenant Hub")).toBeInTheDocument();
  });
});
