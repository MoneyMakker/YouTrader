import type { Meta, StoryObj } from "@storybook/react-native";
import { Phase4NumberDemo } from "./Phase4MotionDemo";

const meta = {
  title: "YouTrader/Phase4/AnimatedNumber",
  component: Phase4NumberDemo,
} satisfies Meta<typeof Phase4NumberDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CurrencyPositive: Story = { args: { variant: "currencyPositive" } };
export const CurrencyNegative: Story = { args: { variant: "currencyNegative" } };
export const Percentage: Story = { args: { variant: "percentage" } };
export const ZeroToPositive: Story = { args: { variant: "zeroToPositive" } };
export const PositiveToNegative: Story = { args: { variant: "positiveToNegative" } };
export const RapidUpdates: Story = { args: { variant: "rapid" } };
export const LargeValue: Story = { args: { variant: "large" } };
export const ReduceMotion: Story = { args: { variant: "reduceMotion" } };
export const LargeAccessibilityText: Story = { args: { variant: "largeText" } };
