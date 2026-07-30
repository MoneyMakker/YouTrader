import type { Meta, StoryObj } from "@storybook/react-native";
import { Phase5BadgeDemo } from "./Phase5DesignSystemDemo";

const meta = {
  title: "YouTrader/Phase5/Badge",
  component: Phase5BadgeDemo,
} satisfies Meta<typeof Phase5BadgeDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Tones: Story = { args: { variant: "tones" } };
export const WithSymbol: Story = { args: { variant: "withSymbol" } };
export const LongText: Story = { args: { variant: "long" } };
export const LargeText: Story = { args: { variant: "largeText" } };
