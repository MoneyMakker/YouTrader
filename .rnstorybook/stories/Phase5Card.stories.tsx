import type { Meta, StoryObj } from "@storybook/react-native";
import { Phase5CardDemo } from "./Phase5DesignSystemDemo";

const meta = {
  title: "YouTrader/Phase5/Card",
  component: Phase5CardDemo,
} satisfies Meta<typeof Phase5CardDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { variant: "default" } };
export const Outlined: Story = { args: { variant: "outlined" } };
export const Elevated: Story = { args: { variant: "elevated" } };
export const Interactive: Story = { args: { variant: "interactive" } };
export const Selected: Story = { args: { variant: "selected" } };
export const LongContent: Story = { args: { variant: "long" } };
export const Light: Story = { args: { variant: "light" } };
export const Dark: Story = { args: { variant: "dark" } };
