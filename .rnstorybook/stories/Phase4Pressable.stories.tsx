import type { Meta, StoryObj } from "@storybook/react-native";
import { Phase4PressableDemo } from "./Phase4MotionDemo";

const meta = {
  title: "YouTrader/Phase4/AnimatedPressable",
  component: Phase4PressableDemo,
} satisfies Meta<typeof Phase4PressableDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { variant: "default" } };
export const Disabled: Story = { args: { variant: "disabled" } };
export const ReduceMotion: Story = { args: { variant: "reduceMotion" } };
export const WithHaptic: Story = { args: { variant: "haptic" } };
export const IconControl: Story = { args: { variant: "icon" } };
export const Light: Story = { args: { variant: "light" } };
export const Dark: Story = { args: { variant: "dark" } };
