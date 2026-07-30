import type { Meta, StoryObj } from "@storybook/react-native";
import { Phase5ChipDemo } from "./Phase5DesignSystemDemo";

const meta = {
  title: "YouTrader/Phase5/Chip",
  component: Phase5ChipDemo,
} satisfies Meta<typeof Phase5ChipDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { variant: "default" } };
export const Selected: Story = { args: { variant: "selected" } };
export const Disabled: Story = { args: { variant: "disabled" } };
export const WithSymbol: Story = { args: { variant: "withSymbol" } };
export const LongText: Story = { args: { variant: "long" } };
export const Light: Story = { args: { variant: "light" } };
export const Dark: Story = { args: { variant: "dark" } };
