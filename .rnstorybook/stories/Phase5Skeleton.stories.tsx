import type { Meta, StoryObj } from "@storybook/react-native";
import { Phase5SkeletonDemo } from "./Phase5DesignSystemDemo";

const meta = {
  title: "YouTrader/Phase5/Skeleton",
  component: Phase5SkeletonDemo,
} satisfies Meta<typeof Phase5SkeletonDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StaticReduceMotion: Story = { args: { variant: "static" } };
export const Animated: Story = { args: { variant: "animated" } };
export const Text: Story = { args: { variant: "text" } };
export const Circle: Story = { args: { variant: "circle" } };
export const CardPlaceholder: Story = { args: { variant: "card" } };
