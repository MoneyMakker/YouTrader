import type { Meta, StoryObj } from "@storybook/react-native";
import { Phase5TextDemo } from "./Phase5DesignSystemDemo";

const meta = {
  title: "YouTrader/Phase5/Text",
  component: Phase5TextDemo,
} satisfies Meta<typeof Phase5TextDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Roles: Story = { args: { variant: "roles" } };
export const LongLocalized: Story = { args: { variant: "long" } };
export const LargeText: Story = { args: { variant: "largeText" } };
export const NumericTabular: Story = { args: { variant: "numeric" } };
export const Light: Story = { args: { variant: "light" } };
export const Dark: Story = { args: { variant: "dark" } };
