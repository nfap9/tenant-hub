import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { Button } from "../../../src/components/ui/Button";

describe("Button", () => {
  it("should render primary variant by default", () => {
    const { getByText } = render(<Button onPress={() => {}}>Click me</Button>);
    expect(getByText("Click me")).toBeTruthy();
  });

  it("should handle press events", () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button onPress={onPress}>Click me</Button>);
    fireEvent.press(getByText("Click me"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("should not trigger press when disabled", () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button onPress={onPress} disabled>Click me</Button>);
    fireEvent.press(getByText("Click me"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("should show loading text when loading", () => {
    const { getByText } = render(<Button loading>Submit</Button>);
    expect(getByText("处理中...")).toBeTruthy();
  });

  it("should render secondary variant", () => {
    const { getByText } = render(<Button variant="secondary">Secondary</Button>);
    expect(getByText("Secondary")).toBeTruthy();
  });

  it("should render small size", () => {
    const { getByText } = render(<Button size="small">Small</Button>);
    expect(getByText("Small")).toBeTruthy();
  });

  it("should render with icon", () => {
    const { getByText } = render(<Button icon="log-in-outline">Login</Button>);
    expect(getByText("Login")).toBeTruthy();
  });

  it("should render ghost variant", () => {
    const { getByText } = render(<Button variant="ghost">Ghost</Button>);
    expect(getByText("Ghost")).toBeTruthy();
  });

  it("should render danger variant", () => {
    const { getByText } = render(<Button variant="danger">Delete</Button>);
    expect(getByText("Delete")).toBeTruthy();
  });
});
