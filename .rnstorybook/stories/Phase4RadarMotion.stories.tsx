import type { Meta, StoryObj } from "@storybook/react-native";
import { Phase4RadarMotionDemo } from "./Phase4RadarMotionDemo";

const meta = {
  title: "YouTrader/Phase4/RadarMetricMotion",
  component: Phase4RadarMotionDemo,
} satisfies Meta<typeof Phase4RadarMotionDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { variant: "default" } };
export const OtherMetric: Story = { args: { variant: "otherMetric" } };
export const RapidMetricSwitching: Story = { args: { variant: "rapidSwitch" } };
export const ReduceMotion: Story = { args: { variant: "reduceMotion" } };
export const LargeText: Story = { args: { variant: "largeText" } };
export const DarkMode: Story = { args: { variant: "dark" } };
