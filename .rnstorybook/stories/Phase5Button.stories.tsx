import type { Meta, StoryObj } from "@storybook/react-native";
import { Phase5ButtonDemo } from "./Phase5DesignSystemDemo";

const meta = {
  title: "YouTrader/Phase5/Button",
  component: Phase5ButtonDemo,
} satisfies Meta<typeof Phase5ButtonDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Variants: Story = { args: { variant: "variants" } };
export const Sizes: Story = { args: { variant: "sizes" } };
export const Loading: Story = { args: { variant: "loading" } };
export const Disabled: Story = { args: { variant: "disabled" } };
export const IconLeading: Story = { args: { variant: "iconLeading" } };
export const FullWidth: Story = { args: { variant: "fullWidth" } };
export const LongText: Story = { args: { variant: "long" } };
export const LargeText: Story = { args: { variant: "largeText" } };
export const Light: Story = { args: { variant: "light" } };
export const Dark: Story = { args: { variant: "dark" } };
