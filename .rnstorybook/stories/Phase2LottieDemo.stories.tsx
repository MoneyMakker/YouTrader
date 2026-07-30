import type { Meta, StoryObj } from "@storybook/react-native";
import { Phase2LottieDemo } from "./Phase2LottieDemo";

const meta = {
  title: "YouTrader/Phase2/Lottie",
  component: Phase2LottieDemo,
} satisfies Meta<typeof Phase2LottieDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AutoplayOnce: Story = { args: { variant: "once" } };
export const Loop: Story = { args: { variant: "loop" } };
export const ControlledProgress: Story = { args: { variant: "controlled" } };
export const ReduceMotionStatic: Story = { args: { variant: "reduceMotion" } };
