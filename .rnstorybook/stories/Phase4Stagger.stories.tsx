import type { Meta, StoryObj } from "@storybook/react-native";
import { Phase4StaggerDemo } from "./Phase4MotionDemo";

const meta = {
  title: "YouTrader/Phase4/Stagger",
  component: Phase4StaggerDemo,
} satisfies Meta<typeof Phase4StaggerDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SmallGroup: Story = { args: { variant: "smallGroup" } };
export const ReduceMotion: Story = { args: { variant: "reduceMotion" } };
export const LongText: Story = { args: { variant: "longText" } };
export const Light: Story = { args: { variant: "light" } };
export const Dark: Story = { args: { variant: "dark" } };
