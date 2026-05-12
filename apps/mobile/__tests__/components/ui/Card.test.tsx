import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { Text } from "react-native";
import { Card } from "../../../src/components/ui/Card";

describe("Card", () => {
  it("should render children", () => {
    const { getByText } = render(
      <Card>
        <Text>Card content</Text>
      </Card>
    );
    expect(getByText("Card content")).toBeTruthy();
  });

  it("should render title and subtitle", () => {
    const { getByText } = render(<Card title="Title" subtitle="Subtitle" />);
    expect(getByText("Title")).toBeTruthy();
    expect(getByText("Subtitle")).toBeTruthy();
  });

  it("should render header action", () => {
    const { getByText } = render(
      <Card title="Title" headerAction={<Text>Action</Text>} />
    );
    expect(getByText("Action")).toBeTruthy();
  });

  it("should handle onPress", () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <Card onPress={onPress}>
        <Text>Pressable</Text>
      </Card>
    );
    fireEvent.press(getByText("Pressable"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("should render warm variant", () => {
    const { getByText } = render(
      <Card variant="warm">
        <Text>Warm</Text>
      </Card>
    );
    expect(getByText("Warm")).toBeTruthy();
  });

  it("should render outline variant", () => {
    const { getByText } = render(
      <Card variant="outline">
        <Text>Outline</Text>
      </Card>
    );
    expect(getByText("Outline")).toBeTruthy();
  });
});
