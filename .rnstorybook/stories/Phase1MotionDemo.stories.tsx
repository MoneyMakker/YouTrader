import type { Meta, StoryObj } from "@storybook/react-native";
import { Phase1MotionDemo } from "./Phase1MotionDemo";

const meta = {
  title: "YouTrader/Phase1/MotionDemo",
  component: Phase1MotionDemo,
} satisfies Meta<typeof Phase1MotionDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
