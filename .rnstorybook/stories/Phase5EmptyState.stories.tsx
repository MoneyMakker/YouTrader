import type { Meta, StoryObj } from "@storybook/react-native";
import { Phase5EmptyDemo } from "./Phase5DesignSystemDemo";

const meta = {
  title: "YouTrader/Phase5/EmptyState",
  component: Phase5EmptyDemo,
} satisfies Meta<typeof Phase5EmptyDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoAction: Story = { args: { variant: "none" } };
export const OneAction: Story = { args: { variant: "one" } };
export const TwoActions: Story = { args: { variant: "two" } };
export const LongDescription: Story = { args: { variant: "long" } };
export const LargeText: Story = { args: { variant: "largeText" } };
export const DarkMode: Story = { args: { variant: "dark" } };
