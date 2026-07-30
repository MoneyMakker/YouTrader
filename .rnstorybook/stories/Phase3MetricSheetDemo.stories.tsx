import type { Meta, StoryObj } from "@storybook/react-native";
import { Phase3MetricSheetDemo } from "./Phase3MetricSheetDemo";

const meta = {
  title: "YouTrader/Phase3/MetricExplanationSheet",
  component: Phase3MetricSheetDemo,
} satisfies Meta<typeof Phase3MetricSheetDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { variant: "default" } };
export const LargeText: Story = { args: { variant: "largeText" } };
export const ReduceMotion: Story = { args: { variant: "reduceMotion" } };
export const DarkMode: Story = { args: { variant: "dark" } };
export const LongLocalized: Story = { args: { variant: "longLocalized" } };
