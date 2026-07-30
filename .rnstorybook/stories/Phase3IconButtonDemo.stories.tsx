import type { Meta, StoryObj } from "@storybook/react-native";
import { Phase3IconButtonDemo } from "./Phase3IconButtonDemo";

const meta = {
  title: "YouTrader/Phase3/IconButton",
  component: Phase3IconButtonDemo,
} satisfies Meta<typeof Phase3IconButtonDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { variant: "default" } };
export const Pressed: Story = { args: { variant: "pressed" } };
export const Disabled: Story = { args: { variant: "disabled" } };
export const LargeTouchTarget: Story = { args: { variant: "largeTouch" } };
export const IconOnlyAccessibility: Story = { args: { variant: "iconOnlyA11y" } };
export const DarkMode: Story = { args: { variant: "dark" } };
export const LightMode: Story = { args: { variant: "light" } };
